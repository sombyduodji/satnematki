"use strict";
// The game's pictures drawn by the GPU (WebGL 2), for trying out in kauppa-gl.html.
//
// It stands in for the 2D canvas the game draws on: src/world.js makes the same calls as always (drawImage, fillRect, save, scale…),
// and this gathers them into a few batched draws instead of copying one picture at a time on the CPU. Every picture the game draws
// is packed into one texture array (atlas pages of 2048×2048) the first time it's drawn, trimmed to what isn't see-through, so a whole
// frame is usually one draw call. The world is drawn into a picture of the canvas's own size, at the game's own pixels, and only then
// lit and coloured (src/gl/post.js) and put on the screen, where the page scales it by whole numbers as before.
//
// Only the store is lit for now, from art/store/light.png (tools/make_store_light.py). Everything else just draws as it did.
(function () {
  const PAGE = 2048; // atlas page size
  const PAD = 2; // empty texels round each picture
  const WHOLE_MOST = 1024; // a picture larger than this either way is packed piece by piece, as it's drawn
  const FLOATS = 18; // per vertex: pos 2, uv 2, clamp rect 4, colour 4, foot 2, layer 1, mode 1, extra 2
  const MOST_QUADS = 16384;
  const MODE = { LIT: 0, BAKED: 1, SOLID: 2, SUN_SHADOW: 3, LAMP_SHADOW: 4, NIGHT: 5, RIM: 6, GRADIENT: 7 };

  const colourCache = new Map();
  const colourProbe = document.createElement("canvas").getContext("2d");
  const COLOUR_CACHE_MOST = 1024;
  const RGB_TEXT = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
  function parseColour(style) {
    if (typeof style !== "string") return [0, 0, 0, 1]; // gradients and patterns aren't needed in the store
    // rgb() and rgba() are read straight off and not kept: the game makes them anew every frame with the strength changing, as the
    // river's glints, and keeping each was a store that grew all the time a place was open.
    const direct = RGB_TEXT.exec(style);
    if (direct) return [direct[1] / 255, direct[2] / 255, direct[3] / 255, direct[4] === undefined ? 1 : Number(direct[4])];
    let rgba = colourCache.get(style);
    if (rgba) return rgba;
    if (colourCache.size >= COLOUR_CACHE_MOST) colourCache.clear(); // and anything else that comes in endless kinds can't grow it either
    colourProbe.fillStyle = "#000";
    colourProbe.fillStyle = style;
    const s = colourProbe.fillStyle; // the browser's own form: #rrggbb or rgba(r, g, b, a)
    if (s[0] === "#") rgba = [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, 1];
    else {
      const n = s.match(/[\d.]+/g).map(Number);
      rgba = [n[0] / 255, n[1] / 255, n[2] / 255, n[3] ?? 1];
    }
    colourCache.set(style, rgba);
    return rgba;
  }

  const sameMatrix = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5];

  // ------------------------------------------------------------------ the atlas
  // On an Adreno GPU (Qualcomm phones) the atlas grows without copying its pages on the GPU (copyTexSubImage3D from a layer):
  // on a Galaxy S25 (Adreno 830) pictures showed bits of others, as from pages copied wrong. Elsewhere the quicker copy stays.
  const gpuName = (gl) => {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return `${gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)}`;
  };

  class Atlas {
    constructor(gl, mostLayers) {
      this.gl = gl;
      this.copyOnGrow = !/adreno/i.test(gpuName(gl));
      this.mostLayers = mostLayers;
      this.layers = 0;
      this.texture = null;
      this.generation = 0; // when it was last emptied: older entries are stale
      this.uploads = 0;
      this.grow(4);
      this.scratch = document.createElement("canvas");
      this.scratchG = this.scratch.getContext("2d", { willReadFrequently: true });
    }

    grow(layers) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, PAGE, PAGE, layers);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.texture && this.copyOnGrow) {
        // What's packed already is copied over, page by page.
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
        for (let layer = 0; layer < this.layers; layer++) {
          gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.texture, 0, layer);
          gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 0, 0, PAGE, PAGE);
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        gl.deleteTexture(this.texture);
        for (let layer = this.layers; layer < layers; layer++) this.shelves.push({ y: 0, rows: [] });
      } else {
        // Without the copy, the bigger texture starts empty and what was packed is packed again as it's drawn, as when the atlas empties.
        if (this.texture) {
          gl.deleteTexture(this.texture);
          this.generation++;
        }
        this.shelves = Array.from({ length: layers }, () => ({ y: 0, rows: [] }));
        this.white = null;
      }
      this.texture = texture;
      this.layers = layers;
      // One white texel, for plain fills, so that they needn't break the batch.
      if (!this.white) {
        this.white = this.place(4, 4);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); // WebGL refuses it for plain bytes, as after another upload
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, this.white.x, this.white.y, this.white.layer, 4, 4, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(64).fill(255));
      }
    }

    // A shelf packer: rows of similar height, each page filled top to bottom.
    place(w, h) {
      const fw = w + PAD * 2, fh = h + PAD * 2;
      if (fw > PAGE || fh > PAGE) return null;
      for (let layer = 0; layer < this.layers; layer++) {
        const page = this.shelves[layer];
        for (const row of page.rows) {
          if (fh <= row.h && fh >= row.h * 0.6 && row.x + fw <= PAGE) {
            const at = { layer, x: row.x + PAD, y: row.y + PAD };
            row.x += fw;
            return at;
          }
        }
        if (page.y + fh <= PAGE) {
          const row = { y: page.y, h: fh, x: fw };
          page.rows.push(row);
          page.y += fh;
          return { layer, x: PAD, y: row.y + PAD };
        }
      }
      return undefined; // full
    }

    // Room for a picture, growing the texture or emptying it all when it's full.
    room(w, h, onEmptied) {
      let at = this.place(w, h);
      if (at !== undefined) return at;
      onEmptied(); // what's waiting to be drawn uses the texture as it is
      if (this.layers < this.mostLayers) {
        this.grow(Math.min(this.mostLayers, this.layers * 2));
        return this.place(w, h);
      }
      this.generation++;
      this.shelves = this.shelves.map(() => ({ y: 0, rows: [] }));
      this.white = null;
      this.white = this.place(4, 4);
      this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.texture);
      this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); // as above: not for plain bytes
      this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, 0, this.white.x, this.white.y, this.white.layer, 4, 4, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(64).fill(255));
      return this.place(w, h);
    }

    // What isn't see-through in a picture, as x, y, w, h. Only for pictures the game made itself, as reading them back costs a little.
    trimmed(source, x, y, w, h) {
      const g = this.scratchG;
      this.scratch.width = w;
      this.scratch.height = h;
      g.clearRect(0, 0, w, h);
      g.drawImage(source, x, y, w, h, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let row = 0; row < h; row++) {
        const base = row * w * 4;
        for (let col = 0; col < w; col++) {
          if (data[base + col * 4 + 3]) {
            if (col < x0) x0 = col;
            if (col > x1) x1 = col;
            if (row < y0) y0 = row;
            y1 = row;
          }
        }
      }
      if (x1 < 0) return null;
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    upload(source, sx, sy, sw, sh, at, fromScratch) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      if (fromScratch || sx || sy || sw !== (source.naturalWidth || source.width) || sh !== (source.naturalHeight || source.height)) {
        // A piece of a bigger picture goes by way of a small canvas.
        const g = this.scratchG;
        if (!fromScratch) {
          this.scratch.width = sw;
          this.scratch.height = sh;
          g.clearRect(0, 0, sw, sh);
          g.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
        } else {
          const piece = g.getImageData(sx, sy, sw, sh);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, at.x, at.y, at.layer, sw, sh, 1, gl.RGBA, gl.UNSIGNED_BYTE, piece);
          this.uploads++;
          return;
        }
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, at.x, at.y, at.layer, sw, sh, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.scratch);
      } else {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, at.x, at.y, at.layer, sw, sh, 1, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      this.uploads++;
    }
  }

  // A picture with a texture of its own: one too big for the atlas but not for the GPU (a whole place's picture of the world),
  // or one the game draws anew while it plays (the camp's dark, gradients), which is sent again every time it's drawn.
  class Single {
    constructor(gl, w, h) {
      this.gl = gl;
      this.w = w; this.h = h;
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, w, h, 1);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D_ARRAY, k, v);
      this.lastUsed = 0;
      this.freed = false;
    }
    upload(source) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, this.w, this.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    free() { this.gl.deleteTexture(this.texture); this.freed = true; }
  }

  // A gradient, kept as it was made, to be painted by the browser's own 2D canvas when it's used.
  class Gradient {
    constructor(kind, args) { this.kind = kind; this.args = args; this.stops = []; }
    addColorStop(at, colour) { this.stops.push([at, colour]); }
    on(g) {
      const made = this.kind === "radial" ? g.createRadialGradient(...this.args) : g.createLinearGradient(...this.args);
      for (const [at, colour] of this.stops) made.addColorStop(at, colour);
      return made;
    }
  }

  // ------------------------------------------------------------------ shaders
  const SPRITE_VS = `#version 300 es
  layout(location=0) in vec2 aPos;
  layout(location=1) in vec2 aUv;
  layout(location=2) in vec4 aRect;
  layout(location=3) in vec4 aColour;
  layout(location=4) in vec2 aFoot;
  layout(location=5) in vec2 aLayerMode;
  layout(location=6) in vec2 aExtra;
  uniform vec2 uSize;
  out vec2 vUv; out vec4 vRect; out vec4 vColour; out vec2 vFoot; out vec2 vDev; out vec2 vExtra;
  flat out int vMode; flat out float vLayer;
  void main() {
    vUv = aUv; vRect = aRect; vColour = aColour; vFoot = aFoot; vDev = aPos; vExtra = aExtra;
    vLayer = aLayerMode.x; vMode = int(aLayerMode.y + 0.5);
    gl_Position = vec4(aPos.x / uSize.x * 2.0 - 1.0, 1.0 - aPos.y / uSize.y * 2.0, 0.0, 1.0);
  }`;

  const LIGHT_GLSL = `
  uniform sampler2D uLight;
  uniform vec2 uLightSize;
  uniform vec2 uCam; uniform float uDetail; uniform vec2 uOrigin; // the world's OX and TOP_PAD
  uniform vec3 uSun; uniform vec4 uRoom; uniform vec2 uWindowZ; uniform float uHeightTop;
  uniform vec2 uWinX[4]; uniform vec2 uWinY[4]; uniform vec2 uMullion; // the windows' crossbar: how high, and half its width
  uniform int uLit; // whether the place has a light map
  uniform int uSpace; // 0: the map is of the floor, in the world's units (rooms); 1: of the screen, in the world's pixels (the forest)
  uniform vec2 uShadowStep; // how far a shadow reaches on the screen for each unit of height
  uniform vec2 uToLight; // towards the sun, on the screen
  vec2 worldPx(vec2 dev) { return dev / uDetail + uCam; }
  // The point on the floor (z = 0) that a pixel of the world shows, in the world's units.
  vec2 floorAt(vec2 w) { float u = w.x - uOrigin.x, v = w.y - uOrigin.y; return vec2(v + u * 0.5, v - u * 0.5); }
  vec4 lightAt(vec2 p) { return texture(uLight, p / uLightSize); }
  // Where in the light map a pixel of the world is.
  vec2 mapAt(vec2 w) { return uSpace == 1 ? w : floorAt(w); }
  float heightAt(vec2 p) { return texture(uLight, p / uLightSize).a * uHeightTop; }
  bool inRoom(vec2 p) { return p.x > uRoom.x && p.y > uRoom.y && p.x < uRoom.z && p.y < uRoom.w; }
  // Back along the sun, whether a point sees the sky through a pane: as through_a_window() in tools/make_store.py.
  float throughWindow(vec3 p) {
    float lit = 0.0;
    float t = max(p.x - uRoom.x, 0.0) / -uSun.x;
    float y = p.y + uSun.y * t, z = p.z + uSun.z * t;
    for (int i = 0; i < 4; i++) {
      vec2 w = uWinX[i]; float mid = (w.x + w.y) * 0.5;
      float inside = step(w.x + 3.0, y) * step(y, w.y - 3.0) * step(uWindowZ.x + 1.0, z) * step(z, uWindowZ.y - 1.0);
      inside *= step(uMullion.y, abs(y - mid)) * step(uMullion.y, abs(z - uMullion.x));
      lit = max(lit, inside);
    }
    t = max(p.y - uRoom.y, 0.0) / -uSun.y;
    float x = p.x + uSun.x * t; z = p.z + uSun.z * t;
    for (int i = 0; i < 4; i++) {
      vec2 w = uWinY[i]; float mid = (w.x + w.y) * 0.5;
      float inside = step(w.x + 3.0, x) * step(x, w.y - 3.0) * step(uWindowZ.x + 1.0, z) * step(z, uWindowZ.y - 1.0);
      inside *= step(uMullion.y, abs(x - mid)) * step(uMullion.y, abs(z - uMullion.x));
      lit = max(lit, inside);
    }
    return lit;
  }
  // Sun at a point in the room, with what stands in its way, by the heights in the light map.
  float sunAt(vec3 p, int steps) {
    if (throughWindow(p) < 0.5) return 0.0;
    for (int i = 1; i <= 12; i++) {
      if (i > steps) break;
      vec3 q = p + uSun * (float(i) * 5.0);
      if (!inRoom(q.xy)) break;
      if (q.z < heightAt(q.xy)) return 0.0;
    }
    return 1.0;
  }`;

  const SPRITE_FS = (lighting) => `#version 300 es
  #define LIGHTING ${lighting}
  precision highp float;
  precision highp sampler2DArray;
  uniform sampler2DArray uAtlas;
  uniform int uQuality;
  uniform vec3 uShadow;
  ${LIGHT_GLSL}
  in vec2 vUv; in vec4 vRect; in vec4 vColour; in vec2 vFoot; in vec2 vDev; in vec2 vExtra;
  flat in int vMode; flat in float vLayer;
  out vec4 outColour;
  uniform vec2 uTexSize; // the texture's size: an atlas page, or a picture of its own
  // Hard-edged however it's scaled, and smooth only across a texel's edge: a whole-number scale looks just as the canvas did.
  vec2 sharp(vec2 px) {
    vec2 seam = floor(px + 0.5);
    vec2 d = max(fwidth(px), vec2(1e-4));
    px = seam + clamp((px - seam) / d, -0.5, 0.5);
    return clamp(px, vRect.xy + 0.5, vRect.zw - 0.5);
  }
  vec4 tex(vec2 px) { return texture(uAtlas, vec3(px / uTexSize, vLayer)); }
  void main() {
    if (vMode == 2) { outColour = vColour; return; }
    if (vMode == 5) {
      // The camp's dark, thinner round the fire: the gradient of paintCampNight in src/camp.js, worked out here. vFoot is the fire,
      // vExtra how far its light reaches across and down.
      float d = length((vDev - vFoot) / vExtra);
      float t = clamp((d - 0.05) / 0.95, 0.0, 1.0);
      float hole = d < 0.05 ? 1.0 : t < 0.42 ? mix(1.0, 0.82, t / 0.42) : t < 0.75 ? mix(0.82, 0.3, (t - 0.42) / 0.33) : mix(0.3, 0.0, (t - 0.75) / 0.25);
      outColour = vColour * (1.0 - hole);
      return;
    }
    // Pictures are hard-edged, to keep the pixel art crisp; shadows are smooth, as a shadow's edge is soft.
    vec2 px = vMode == 3 || vMode == 4 ? clamp(vUv, vRect.xy + 0.5, vRect.zw - 0.5) : sharp(vUv);
    vec4 c = tex(px);
    if (vMode == 7) {
      // A gradient: its colours are a row on the atlas (vRect), and how far along it this is comes from vFoot. For a radial one
      // vFoot is where this is from the middle, by the outer radius, and vExtra.x the inner radius by the outer; for a linear one
      // vFoot.x is already how far along.
      float t = vExtra.y > 0.5 ? vFoot.x : (length(vFoot) - vExtra.x) / max(1e-4, 1.0 - vExtra.x);
      t = clamp(t, 0.0, 1.0);
      vec4 g = tex(vec2(mix(vRect.x + 0.5, vRect.z - 0.5, t), vRect.y + 0.5));
      outColour = g * vColour.a;
      return;
    }
    if (vMode == 6) {
      // Firelight on the side facing the fire and dusk on the other, only where the picture is: campRimPaint in src/camp.js.
      // vColour.xy is the way to the fire, z the strength; vFoot where this is in the whole picture, 0 to 1; vExtra its size by half its longer side.
      vec2 u = vColour.xy;
      float s = vColour.z;
      float t = (1.0 - dot((vFoot - 0.5) * vExtra, u)) * 0.5;
      vec4 a = vec4(1.0, 0.690, 0.329, min(0.8, s * 0.95)), b = vec4(1.0, 0.549, 0.235, min(0.28, s * 0.3));
      vec4 m = vec4(0.118, 0.078, 0.157, 0.0), e = vec4(0.047, 0.047, 0.133, min(0.55, s * 0.65));
      t = clamp(t, 0.0, 1.0);
      vec4 g = t < 0.42 ? mix(a, b, t / 0.42) : t < 0.62 ? mix(b, m, (t - 0.42) / 0.2) : mix(m, e, (t - 0.62) / 0.38);
      float k = g.a * c.a * vColour.a;
      outColour = vec4(g.rgb * k, k);
      return;
    }
    #if LIGHTING
    if (vMode == 3 || vMode == 4) {
      // A shadow lies on the floor: none where something stands, and the sun's only where there's sun to take away.
      vec2 p = mapAt(worldPx(vDev));
      if (uSpace == 0 && (heightAt(p) > 0.5 || !inRoom(p))) discard;
      // Soft at its edge: the picture's cover here and round about, over a few of its pixels, so that a figure's hard pixel edges
      // don't show in its long shadow.
      float cover = 0.0, weight = 0.0;
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
        float k = 3.0 - 0.5 * (abs(float(i)) + abs(float(j)));
        cover += tex(clamp(px + vec2(float(i), float(j)) * 0.75, vRect.xy + 0.5, vRect.zw - 0.5)).a * k;
        weight += k;
      }
      float a = cover / weight * vColour.a;
      if (vMode == 3) a *= lightAt(p).r;
      outColour = vec4(uShadow * a, a);
      return;
    }
    #endif
    c *= vColour.a;
    #if LIGHTING
    if (vMode == 0 && uLit == 1 && uQuality > 0 && c.a > 0.0) {
      vec2 f = mapAt(worldPx(vFoot));
      float up = max(0.0, (vFoot.y - vDev.y) / uDetail);
      vec4 l = lightAt(f);
      float sun;
      vec3 k, warm;
      if (uSpace == 1) {
        // Outdoors: in the sun, or cooler and dimmer in a tree's shade, as the ground under them is.
        sun = l.r;
        warm = vec3(1.12, 1.07, 0.96);
        k = mix(vec3(0.8, 0.85, 0.95), warm, sun);
      } else {
        sun = sunAt(vec3(f, up), uQuality > 1 ? 10 : 5);
        k = vec3(0.93 + 0.08 * l.g + 0.16 * l.b);
        warm = vec3(1.28, 1.14, 0.9);
        k = mix(k, k * warm, sun * 0.6);
      }
      // A warm edge on the side the light comes from: towards the sun if in it, else up towards the lamps.
      vec2 toLight = sun > 0.0 ? uToLight : vec2(0.0, -1.0);
      vec2 step1 = (toLight.x * dFdx(vUv) + toLight.y * dFdy(vUv)) * uDetail * 1.2;
      float beyond = tex(clamp(px + step1, vRect.xy + 0.5, vRect.zw - 0.5)).a;
      float rim = c.a * (1.0 - beyond);
      vec3 rimColour = sun > 0.0 ? warm * 0.42 * sun : vec3(1.0, 0.97, 0.9) * 0.1 * (0.3 + l.g);
      c.rgb = c.rgb * k + rimColour * rim * c.a;
    }
    #endif
    outColour = c;
  }`;

  function compile(gl, vs, fs) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(program, i).name.replace(/\[0\]$/, "");
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  }

  // ------------------------------------------------------------------ the stand-in for a 2D context
  class GLContext {
    constructor(canvas, gl) {
      this.canvas = canvas;
      this.gl = gl;
      this.gpu = true;
      const most = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
      this.atlas = new Atlas(gl, Math.min(8, most)); // at most 128 MB; when it fills, it empties and packs again
      this.entries = new WeakMap(); // source → { generation, version, whole entry, or pieces }
      this.atlasRef = { atlas: this.atlas, get texture() { return this.atlas.texture; }, w: PAGE, h: PAGE };
      this.maxSingle = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      this.singles = new Set(); // textures of their own, freed when they haven't been drawn for a while
      this.live = new WeakMap(); // canvas drawn anew while playing → its texture
      this.frame = 0;
      this.batchTex = this.atlasRef;
      this.scratch2d = Object.assign(document.createElement("canvas"), { glLive: true });
      // Without effects the shader has no light in it at all: a software GPU runs every branch, even those no pixel takes.
      this.sprites = [compile(gl, SPRITE_VS, SPRITE_FS(0)), compile(gl, SPRITE_VS, SPRITE_FS(1))];
      this.vertices = new Float32Array(MOST_QUADS * 4 * FLOATS);
      this.quads = 0;
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
      const indices = new Uint16Array(MOST_QUADS * 6);
      for (let q = 0, v = 0; q < MOST_QUADS; q++, v += 4) indices.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      // 16384 quads need 65536 vertices: exactly what 16-bit indices reach.
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      const stride = FLOATS * 4;
      [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 4, 8], [4, 2, 12], [5, 2, 14], [6, 2, 16]].forEach(([at, size, offset]) => {
        gl.enableVertexAttribArray(at);
        gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset * 4);
      });
      gl.bindVertexArray(null);

      this.state = { m: [1, 0, 0, 1, 0, 0], alpha: 1, fill: [0, 0, 0, 1], fillStyle: "#000", clip: null, additive: false };
      this.stack = [];
      this.path = [];
      this.font = "10px sans-serif";
      this.textAlign = "start";
      this.textBaseline = "alphabetic";
      this.strokeStyle = "#000";
      this.lineWidth = 1;
      this.imageSmoothingEnabled = true;
      this.imageSmoothingQuality = "low";
      this.texts = new Map();
      this.measure = document.createElement("canvas").getContext("2d");
      this.batchLit = false;
      this.casting = null; // set by the game just before drawing someone who casts a shadow: true, or how much of its picture is height
      this.shadowPaint = null; // set by the game just before drawing a shadow's own picture, as dark as this, as a vehicle's
      this.inFrame = false;
      this.stats = { draws: 0, quads: 0, uploads: 0, drawsShown: 0, quadsShown: 0 };
      this.lightGlsl = LIGHT_GLSL;
      this.view = null;
      this.post = new window.SatneGLPost(gl, this);
      this.light = null;
      this.lit = true; // what's drawn now takes the light; the store's own pictures already have theirs
      // Should the GPU drop everything (a driver reset, a laptop waking), the page starts again once it's back, rather than staying black.
      canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
      canvas.addEventListener("webglcontextrestored", () => location.reload());
    }

    // ---- state
    get globalAlpha() { return this.state.alpha; }
    set globalAlpha(v) { this.state.alpha = v; }
    get fillStyle() { return this.state.fillStyle; }
    set fillStyle(v) { this.state.fillStyle = v; this.state.fill = v instanceof Gradient ? [0, 0, 0, 1] : parseColour(v); }
    get globalCompositeOperation() { return this.state.additive ? "lighter" : "source-over"; }
    set globalCompositeOperation(v) {
      const additive = v === "lighter";
      if (additive !== this.state.additive) { this.flush(); this.state.additive = additive; }
    }
    // As a 2D canvas, save and restore keep the text's settings too: a speech bubble's centred text mustn't move the board's words.
    save() {
      this.stack.push({ ...this.state, m: [...this.state.m], text: [this.font, this.textAlign, this.textBaseline, this.strokeStyle, this.lineWidth, this.imageSmoothingEnabled] });
    }
    restore() {
      const back = this.stack.pop();
      if (!back) return;
      [this.font, this.textAlign, this.textBaseline, this.strokeStyle, this.lineWidth, this.imageSmoothingEnabled] = back.text;
      delete back.text;
      if (back.additive !== this.state.additive || back.clip !== this.state.clip) this.flush();
      this.state = back;
    }
    transform(a, b, c, d, e, f) {
      const [m0, m1, m2, m3, m4, m5] = this.state.m;
      this.state.m = [m0 * a + m2 * b, m1 * a + m3 * b, m0 * c + m2 * d, m1 * c + m3 * d, m0 * e + m2 * f + m4, m1 * e + m3 * f + m5];
    }
    setTransform(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { this.state.m = typeof a === "object" ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f]; }
    resetTransform() { this.state.m = [1, 0, 0, 1, 0, 0]; }
    scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
    translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }

    // ---- frames
    // Where the camera is, before anything of the frame is drawn: camX, camY and detail as in draw(), zoom, and the world's OX and TOP_PAD.
    setView(view) {
      this.view = view;
      this.post.view(view);
    }

    // The light of a place, or null for none: its map's details from art/<place>/light.js and the map's picture.
    useLight(info, src) { this.post.useLight(info, src); }

    begin() {
      if (this.inFrame) return;
      this.inFrame = true;
      this.stats.draws = this.stats.quads = 0;
      this.post.beginScene(this.canvas.width, this.canvas.height);
    }

    // Called by the game when the frame is drawn. `view` says where the camera is, for the light.
    present(view) {
      this.begin();
      this.flush();
      this.post.finish(view);
      this.inFrame = false;
      this.stats.drawsShown = this.stats.draws;
      this.stats.quadsShown = this.stats.quads;
      this.stats.uploads = this.atlas.uploads;
      this.frame++;
      if (this.frame % 120 === 0) {
        for (const single of this.singles) {
          if (this.frame - single.lastUsed > 600) { single.free(); this.singles.delete(single); }
        }
      }
    }

    // ---- batching
    flush() {
      if (!this.quads) return;
      const gl = this.gl;
      const program = this.sprites[this.batchLit ? 1 : 0];
      this.post.useSpriteProgram(program, this.state.additive);
      const tex = this.batchTex;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.texture);
      gl.uniform2f(program.uniforms.uTexSize, tex.w, tex.h);
      tex.pending = false;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices, 0, this.quads * 4 * FLOATS);
      const clip = this.drawnClip;
      if (clip) {
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.floor(clip[0]), Math.floor(this.canvas.height - clip[3]), Math.ceil(clip[2] - clip[0]), Math.ceil(clip[3] - clip[1]));
      }
      gl.drawElements(gl.TRIANGLES, this.quads * 6, gl.UNSIGNED_SHORT, 0);
      if (clip) gl.disable(gl.SCISSOR_TEST);
      gl.bindVertexArray(null);
      this.stats.draws++;
      this.stats.quads += this.quads;
      this.quads = 0;
    }

    // One quad: four corners in the canvas's pixels, texels on the atlas, and how it's to be drawn.
    quad(corners, uv, rect, tex, layer, colour, mode, foot, scissor = this.state.clip?.box ?? null, feet = null, extra = null) {
      if (scissor !== this.drawnClip) {
        this.flush();
        this.drawnClip = scissor;
      }
      if (tex !== this.batchTex) {
        this.flush();
        this.batchTex = tex;
      }
      tex.pending = true;
      // What takes the light goes through the shader that has it, and the rest, the floor most of all, through the plain one.
      const lit = this.post.quality > 0 && !!this.light && (mode === MODE.LIT || mode === MODE.SUN_SHADOW || mode === MODE.LAMP_SHADOW);
      if (lit !== this.batchLit) {
        this.flush();
        this.batchLit = lit;
      }
      if (this.quads >= MOST_QUADS) this.flush();
      let o = this.quads * 4 * FLOATS;
      const v = this.vertices;
      for (let i = 0; i < 4; i++) {
        v[o] = corners[i * 2]; v[o + 1] = corners[i * 2 + 1];
        v[o + 2] = uv[i * 2]; v[o + 3] = uv[i * 2 + 1];
        v[o + 4] = rect[0]; v[o + 5] = rect[1]; v[o + 6] = rect[2]; v[o + 7] = rect[3];
        v[o + 8] = colour[0]; v[o + 9] = colour[1]; v[o + 10] = colour[2]; v[o + 11] = colour[3];
        v[o + 12] = feet ? feet[i * 2] : foot[0]; v[o + 13] = feet ? feet[i * 2 + 1] : foot[1];
        v[o + 14] = layer; v[o + 15] = mode;
        v[o + 16] = extra ? extra[0] : 0; v[o + 17] = extra ? extra[1] : 0;
        o += FLOATS;
      }
      this.quads++;
    }

    // ---- what's drawn
    fillRect(x, y, w, h) {
      this.begin();
      const m = this.state.m;
      if (this.state.fillStyle instanceof Gradient && this.gradientRect(this.state.fillStyle, x, y, w, h)) return;
      if (this.state.fillStyle instanceof Gradient) {
        const c = this.corners(m, x, y, w, h);
        this.via2d([[[c[0], c[1]], [c[2], c[3]], [c[4], c[5]], [c[6], c[7]]]]);
        return;
      }
      const clip = this.state.clip;
      let scissor = clip?.box ?? null;
      if (clip?.local && sameMatrix(clip.m, m)) {
        // Clipped exactly where it's drawn, rather than to a rectangle on the screen.
        const [lx, ly, lw, lh] = clip.local;
        const x0 = Math.max(x, lx), y0 = Math.max(y, ly), x1 = Math.min(x + w, lx + lw), y1 = Math.min(y + h, ly + lh);
        if (x1 <= x0 || y1 <= y0) return;
        x = x0; y = y0; w = x1 - x0; h = y1 - y0;
        scissor = null;
      }
      const white = this.atlas.white, [r, g, b, a] = this.state.fill;
      const alpha = a * this.state.alpha;
      const corners = this.corners(m, x, y, w, h);
      const cx = white.x + 2, cy = white.y + 2;
      this.quad(corners, [cx, cy, cx, cy, cx, cy, cx, cy], [white.x, white.y, white.x + 4, white.y + 4], this.atlasRef, white.layer, [r * alpha, g * alpha, b * alpha, alpha], MODE.SOLID, [0, 0], scissor);
    }

    // A gradient's colours as a row of 256 texels on the atlas, kept for the next time. Stops whose see-through differs only by a
    // common factor (a fire's glow as it flickers) share a row, the factor going on as the quad's own alpha.
    gradientRamp(gradient) {
      const most = Math.max(1e-6, ...gradient.stops.map(([, c]) => parseColour(c)[3]));
      const key = gradient.stops.map(([at, c]) => { const [r, g, b, a] = parseColour(c); return `${at.toFixed(3)}:${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)},${(a / most).toFixed(3)}`; }).join("|");
      this.ramps ??= new Map();
      let ramp = this.ramps.get(key);
      if (ramp && ramp.generation === this.atlas.generation) return [ramp, most];
      const c = document.createElement("canvas");
      c.width = 256; c.height = 1;
      const g = c.getContext("2d");
      const line = g.createLinearGradient(0, 0, 256, 0);
      for (const [at, colour] of gradient.stops) {
        const [r, gg, b, a] = parseColour(colour);
        line.addColorStop(Math.max(0, Math.min(1, at)), `rgba(${Math.round(r * 255)}, ${Math.round(gg * 255)}, ${Math.round(b * 255)}, ${a / most})`);
      }
      g.fillStyle = line;
      g.fillRect(0, 0, 256, 1);
      const entry = this.entryFor(c, 0, 0, 256, 1);
      if (!entry) return null;
      ramp = { entry, generation: this.atlas.generation };
      if (this.ramps.size > 200) this.ramps.clear();
      this.ramps.set(key, ramp);
      return [ramp, most];
    }

    // A gradient over a rectangle drawn by the GPU itself: linear ones, and radial ones whose two circles share a middle.
    gradientRect(gradient, x, y, w, h) {
      const args = gradient.args;
      const radial = gradient.kind === "radial";
      if (radial && (args[0] !== args[3] || args[1] !== args[4] || !(args[5] > 0))) return false;
      const made = this.gradientRamp(gradient);
      if (!made) return false;
      const [{ entry }, most] = made;
      const local = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      let feet, extra;
      if (radial) {
        const [cx, cy, r0, , , r1] = args;
        feet = local.flatMap(([px, py]) => [(px - cx) / r1, (py - cy) / r1]);
        extra = [r0 / r1, 0];
      } else {
        const [x0, y0, x1, y1] = args, dx = x1 - x0, dy = y1 - y0, len = dx * dx + dy * dy || 1;
        feet = local.flatMap(([px, py]) => [((px - x0) * dx + (py - y0) * dy) / len, 0]);
        extra = [0, 1];
      }
      const corners = this.corners(this.state.m, x, y, w, h);
      const rect = [entry.ax, entry.ay, entry.ax + entry.w, entry.ay + entry.h];
      const a = most * this.state.alpha;
      this.quad(corners, [0, 0, 0, 0, 0, 0, 0, 0], rect, entry.tex, entry.layer, [a, a, a, a], MODE.GRADIENT, [0, 0], undefined, feet, extra);
      return true;
    }

    // What the GPU stand-in can't fill itself, a gradient: painted by the browser's 2D canvas over just the part of the screen it
    // covers, and then drawn as a picture. shapes are in the canvas's pixels.
    via2d(shapes) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const shape of shapes) for (const [x, y] of shape) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const box = this.state.clip?.box;
      if (box) { x0 = Math.max(x0, box[0]); y0 = Math.max(y0, box[1]); x1 = Math.min(x1, box[2]); y1 = Math.min(y1, box[3]); }
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
      x1 = Math.min(this.canvas.width, Math.ceil(x1)); y1 = Math.min(this.canvas.height, Math.ceil(y1));
      if (x1 <= x0 || y1 <= y0) return;
      const c = this.scratch2d, w = x1 - x0, h = y1 - y0;
      // It only grows, in steps, so that its texture isn't made again for every size.
      if (c.width < w || c.height < h) { c.width = Math.max(c.width, Math.ceil(w / 128) * 128); c.height = Math.max(c.height, Math.ceil(h / 128) * 128); }
      const g = c.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);
      g.setTransform(1, 0, 0, 1, -x0, -y0);
      g.beginPath();
      for (const shape of shapes) shape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      const m = this.state.m;
      g.setTransform(m[0], m[1], m[2], m[3], m[4] - x0, m[5] - y0); // the gradient is where it was made
      g.fillStyle = this.state.fillStyle.on(g);
      g.globalAlpha = this.state.alpha;
      g.fill();
      const keep = { m: this.state.m, alpha: this.state.alpha, lit: this.lit, clip: this.state.clip };
      this.state.m = [1, 0, 0, 1, 0, 0];
      this.state.alpha = 1;
      this.state.clip = null;
      this.lit = false;
      this.drawImage(c, 0, 0, w, h, x0, y0, w, h);
      this.state.m = keep.m;
      this.state.alpha = keep.alpha;
      this.state.clip = keep.clip;
      this.lit = keep.lit;
    }

    clearRect() {} // the frame starts empty

    corners(m, x, y, w, h) {
      const x1 = x + w, y1 = y + h;
      return [
        m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5],
        m[0] * x1 + m[2] * y + m[4], m[1] * x1 + m[3] * y + m[5],
        m[0] * x1 + m[2] * y1 + m[4], m[1] * x1 + m[3] * y1 + m[5],
        m[0] * x + m[2] * y1 + m[4], m[1] * x + m[3] * y1 + m[5],
      ];
    }

    // Where a picture, or a piece of it, is on the atlas, packing it there the first time.
    entryFor(source, sx, sy, sw, sh) {
      const w = source.naturalWidth || source.width, h = source.naturalHeight || source.height;
      if (!w || !h || (source instanceof HTMLImageElement && !source.complete)) return null;
      let record = this.entries.get(source);
      const version = source.glVersion ?? 0;
      if (!record || record.generation !== this.atlas.generation || record.version !== version || record.w !== w || record.h !== h) {
        record = { generation: this.atlas.generation, version, w, h, whole: undefined, pieces: null };
        this.entries.set(source, record);
      }
      const emptied = () => { this.flush(); };
      if (source.glLive) {
        // Drawn anew by the game since it was last seen: sent again, after whatever is waiting to be drawn from it.
        if (w > this.maxSingle || h > this.maxSingle) return null;
        let single = this.live.get(source);
        if (!single || single.freed || single.w !== w || single.h !== h) {
          if (single && !single.freed) { this.flush(); single.free(); this.singles.delete(single); }
          single = new Single(this.gl, w, h);
          this.live.set(source, single);
          this.singles.add(single);
        }
        if (single.pending) this.flush();
        single.upload(source);
        single.lastUsed = this.frame;
        return { tex: single, layer: 0, ax: 0, ay: 0, sx: 0, sy: 0, w, h };
      }
      if ((w > WHOLE_MOST || h > WHOLE_MOST) && w <= this.maxSingle && h <= this.maxSingle) {
        // Too big for an atlas page: a texture of its own, as it is.
        if (!record.single || record.single.freed) {
          record.single = new Single(this.gl, w, h);
          record.single.upload(source);
          this.atlas.uploads++;
          this.singles.add(record.single);
          record.whole = { tex: record.single, layer: 0, ax: 0, ay: 0, sx: 0, sy: 0, w, h };
        }
        record.single.lastUsed = this.frame;
        return record.whole;
      }
      if (w <= WHOLE_MOST && h <= WHOLE_MOST) {
        if (record.whole === undefined) {
          // The game's own pictures are mostly empty canvas round a person or a thing: only what shows is packed.
          const made = source instanceof HTMLCanvasElement && w * h > 64 * 64;
          const box = made ? this.atlas.trimmed(source, 0, 0, w, h) : { x: 0, y: 0, w, h };
          if (!box) { record.whole = null; return null; }
          const at = this.atlas.room(box.w, box.h, emptied);
          if (record.generation !== this.atlas.generation) return this.entryFor(source, sx, sy, sw, sh);
          if (!at) { record.whole = null; return null; }
          this.atlas.upload(source, box.x, box.y, box.w, box.h, at, made);
          record.whole = { tex: this.atlasRef, layer: at.layer, ax: at.x, ay: at.y, sx: box.x, sy: box.y, w: box.w, h: box.h };
        }
        return record.whole;
      }
      // A big sheet: each piece that's drawn from it, packed on its own.
      record.pieces ??= new Map();
      const x0 = Math.floor(sx + 1e-3), y0 = Math.floor(sy + 1e-3), x1 = Math.min(w, Math.ceil(sx + sw - 1e-3)), y1 = Math.min(h, Math.ceil(sy + sh - 1e-3));
      const key = `${x0},${y0},${x1},${y1}`;
      let piece = record.pieces.get(key);
      if (piece === undefined) {
        const box = this.atlas.trimmed(source, x0, y0, x1 - x0, y1 - y0);
        if (!box) { record.pieces.set(key, null); return null; }
        const at = this.atlas.room(box.w, box.h, emptied);
        if (record.generation !== this.atlas.generation) return this.entryFor(source, sx, sy, sw, sh);
        if (!at) return null;
        this.atlas.upload(this.atlas.scratch, box.x, box.y, box.w, box.h, at, true);
        piece = { tex: this.atlasRef, layer: at.layer, ax: at.x, ay: at.y, sx: x0 + box.x, sy: y0 + box.y, w: box.w, h: box.h };
        record.pieces.set(key, piece);
      }
      return piece;
    }

    drawImage(source, a, b, c, d, e, f, g, h) {
      let sx, sy, sw, sh, dx, dy, dw, dh;
      const w = source?.naturalWidth || source?.width, hgt = source?.naturalHeight || source?.height;
      if (!w || !hgt) return;
      if (e === undefined) {
        sx = 0; sy = 0; sw = w; sh = hgt; dx = a; dy = b;
        dw = c === undefined ? w : c; dh = d === undefined ? hgt : d;
      } else {
        sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h;
      }
      if (sw <= 0 || sh <= 0) return;
      this.begin();
      const entry = this.entryFor(source, sx, sy, sw, sh);
      if (!entry) return;
      // What's asked for, cut to what was packed.
      const cx0 = Math.max(sx, entry.sx), cy0 = Math.max(sy, entry.sy);
      const cx1 = Math.min(sx + sw, entry.sx + entry.w), cy1 = Math.min(sy + sh, entry.sy + entry.h);
      if (cx1 <= cx0 || cy1 <= cy0) return;
      const kx = dw / sw, ky = dh / sh;
      let qx = dx + (cx0 - sx) * kx, qy = dy + (cy0 - sy) * ky, qw = (cx1 - cx0) * kx, qh = (cy1 - cy0) * ky;
      let u0 = entry.ax + (cx0 - entry.sx), v0 = entry.ay + (cy0 - entry.sy), u1 = u0 + (cx1 - cx0), v1 = v0 + (cy1 - cy0);
      const m = this.state.m, clip = this.state.clip;
      let scissor = clip?.box ?? null;
      if (clip?.local && sameMatrix(clip.m, m) && qw > 0 && qh > 0) {
        // Clipped exactly, in the picture's own coordinates, as a clipped word on the board leans with it.
        const [lx, ly, lw, lh] = clip.local;
        const x0 = Math.max(qx, lx), y0 = Math.max(qy, ly), x1 = Math.min(qx + qw, lx + lw), y1 = Math.min(qy + qh, ly + lh);
        if (x1 <= x0 || y1 <= y0) return;
        const du = (u1 - u0) / qw, dv = (v1 - v0) / qh;
        u0 += (x0 - qx) * du; u1 = u0 + (x1 - x0) * du;
        v0 += (y0 - qy) * dv; v1 = v0 + (y1 - y0) * dv;
        qx = x0; qy = y0; qw = x1 - x0; qh = y1 - y0;
        scissor = null;
      }
      const corners = this.corners(m, qx, qy, qw, qh);
      const uv = [u0, v0, u1, v0, u1, v1, u0, v1];
      const rect = [entry.ax, entry.ay, entry.ax + entry.w, entry.ay + entry.h];
      // Where it stands: the middle of its lowest edge on the screen.
      const ys = [corners[1], corners[3], corners[5], corners[7]];
      const foot = [(corners[0] + corners[2] + corners[4] + corners[6]) / 4, Math.max(...ys)];
      const alpha = this.state.alpha;
      if (this.casting && this.post.quality > 0 && this.light) this.shadows(corners, uv, rect, entry.tex, entry.layer, foot, alpha, typeof this.casting === "number" ? this.casting : 1);
      this.casting = null;
      // A picture that is a shadow, laid on the ground as someone's is: dark only where the sun reaches.
      if (this.shadowPaint !== null) {
        const strength = this.shadowPaint;
        this.shadowPaint = null;
        if (this.post.quality > 0 && this.light) this.quad(corners, uv, rect, entry.tex, entry.layer, [0, 0, 0, strength * alpha], MODE.SUN_SHADOW, foot, scissor);
        return;
      }
      const rim = this.rimNext;
      if (rim) {
        this.rimNext = null;
        // Where each corner is in the whole picture asked for, as the light's gradient spans all of it.
        const q = (x, y) => [(x - dx) / dw, (y - dy) / dh];
        const feet = [...q(qx, qy), ...q(qx + qw, qy), ...q(qx + qw, qy + qh), ...q(qx, qy + qh)];
        this.quad(corners, uv, rect, entry.tex, entry.layer, [rim.ux, rim.uy, rim.strength, alpha], MODE.RIM, foot, scissor, feet, rim.size);
        return;
      }
      this.quad(corners, uv, rect, entry.tex, entry.layer, [1, 1, 1, alpha], this.lit ? MODE.LIT : MODE.BAKED, foot, scissor);
    }

    // The camp's fire lighting a picture from one side: campRim in src/camp.js, done here instead of on a canvas of its own.
    // ux, uy point from the picture to the fire on the screen; flip as the picture itself was drawn mirrored.
    drawRim(image, sx, sy, sw, sh, dx, dy, dw, dh, ux, uy, strength, flip) {
      const span = Math.max(dw, dh) / 2;
      this.rimNext = { ux: flip ? -ux : ux, uy, strength, size: [dw / span, dh / span] };
      const lit = this.lit;
      this.lit = false;
      if (flip) {
        this.save();
        this.translate(dx + dw, dy);
        this.scale(-1, 1);
        this.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
        this.restore();
      } else this.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
      this.rimNext = null;
      this.lit = lit;
    }

    // The camp's evening dark over the view, x, y, w, h in the world's pixels, with a soft hole where the fire is: at fireX, fireY,
    // reaching glow across and 0.62 of it down. rgba is the dark's colour, as a 0–1 array.
    nightOverlay(x, y, w, h, rgba, fireX, fireY, glow) {
      this.begin();
      const m = this.state.m, white = this.atlas.white;
      const corners = this.corners(m, x, y, w, h);
      const cx = white.x + 2, cy = white.y + 2;
      const scale = Math.hypot(m[0], m[1]);
      const fire = glow > 0 ? [m[0] * fireX + m[2] * fireY + m[4], m[1] * fireX + m[3] * fireY + m[5]] : [-1e6, -1e6];
      const reach = glow > 0 ? [glow * scale, glow * 0.62 * scale] : [1, 1];
      const a = rgba[3] * this.state.alpha;
      this.quad(corners, [cx, cy, cx, cy, cx, cy, cx, cy], [white.x, white.y, white.x + 4, white.y + 4], this.atlasRef, white.layer, [rgba[0] * a, rgba[1] * a, rgba[2] * a, a], MODE.NIGHT, fire, undefined, null, reach);
    }

    // Someone standing in the light lays a shadow on the floor: long and dark away from the sun, and faint and short from the
    // lamps above. The picture is laid down flat, its top swung out to where the light would throw it.
    // tall: how much of the picture's height above its lowest point is really height, for what's seen from above as well as from the
    // side, as a parked vehicle, whose picture also reaches back along the ground; 1 for someone standing.
    shadows(corners, uv, rect, tex, layer, foot, alpha, tall = 1) {
      const D = this.view?.detail ?? 1, L = this.light;
      const lay = ([across, down], strength, mode) => {
        // across, down: how far the shadow reaches on the screen for each unit of height.
        const out = [];
        for (let i = 0; i < 4; i++) {
          const x = corners[i * 2], y = corners[i * 2 + 1], up = ((foot[1] - y) / D) * tall;
          out.push(x + across * up * D, foot[1] + down * up * D);
        }
        this.quad(out, uv, rect, tex, layer, [0, 0, 0, strength * alpha], mode, foot);
      };
      const v = this.view;
      // A shadow from the sun only for who stands in it: in a building's shade, there's none to throw.
      const sx = v ? foot[0] / D + v.camX : 0, sy = v ? foot[1] / D + v.camY : 0;
      const sun = !v ? 1 : L.space === "screen" ? this.post.sunAt(sx, sy) : this.post.sunAt((sy - v.topPad) + (sx - v.ox) / 2, (sy - v.topPad) - (sx - v.ox) / 2);
      if (sun > 0.05) lay(L.shadowStep, 0.42 * sun, MODE.SUN_SHADOW);
      // The two nearest lamps.
      if (!v) return;
      const wx = foot[0] / D + v.camX - v.ox, wy = foot[1] / D + v.camY - v.topPad;
      const px = wy + wx / 2, py = wy - wx / 2;
      const near = L.lamps.map(([lx, ly]) => [lx, ly, Math.hypot(px - lx, py - ly)]).sort((p, q) => p[2] - q[2]).slice(0, 2);
      for (const [lx, ly, dist] of near) {
        if (dist < 1) continue;
        const k = Math.min(0.55, dist / 90); // from overhead the shadow is short; further off it's longer
        const strength = 0.16 * Math.exp(-(dist * dist) / 9000);
        if (strength < 0.02) continue;
        const ox = ((px - lx) / dist) * k, oy = ((py - ly) / dist) * k; // on the floor, for each unit of height
        lay([ox - oy, (ox + oy) / 2], strength, MODE.LAMP_SHADOW);
      }
    }

    // ---- paths: only what the game uses, rectangles, round rectangles and ellipses, filled; and a rectangle to clip to
    beginPath() { this.path = []; this.pathRect = null; this.pathParts = 0; }
    closePath() {}
    moveTo(x, y) { this.path.push([this.point(x, y)]); }
    lineTo(x, y) { if (!this.path.length) this.path.push([]); this.path.at(-1).push(this.point(x, y)); }
    point(x, y) { const m = this.state.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    rect(x, y, w, h) {
      this.path.push([this.point(x, y), this.point(x + w, y), this.point(x + w, y + h), this.point(x, y + h)]);
      this.pathRect = this.path.length === 1 ? { local: [x, y, w, h], m: [...this.state.m] } : null;
    }
    roundRect(x, y, w, h, r = 0) {
      r = Math.min(typeof r === "number" ? r : r[0] ?? 0, w / 2, h / 2);
      const shape = [];
      const corner = (cx, cy, from) => { for (let i = 0; i <= 4; i++) { const t = from + (i / 4) * (Math.PI / 2); shape.push(this.point(cx + Math.cos(t) * r, cy + Math.sin(t) * r)); } };
      corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
      this.path.push(shape);
    }
    ellipse(cx, cy, rx, ry, rotation = 0, from = 0, to = Math.PI * 2) {
      const shape = [], n = 20, c = Math.cos(rotation), s = Math.sin(rotation);
      for (let i = 0; i <= n; i++) {
        const t = from + ((to - from) * i) / n, ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
        shape.push(this.point(cx + ex * c - ey * s, cy + ex * s + ey * c));
      }
      this.path.push(shape);
    }
    arc(cx, cy, r, from, to) { this.ellipse(cx, cy, r, r, 0, from, to); }
    fill() {
      this.begin();
      if (this.state.fillStyle instanceof Gradient) { this.via2d(this.path); return; }
      const white = this.atlas.white, [r, g, b, a] = this.state.fill, alpha = a * this.state.alpha;
      const cx = white.x + 2, cy = white.y + 2, uv = [cx, cy, cx, cy, cx, cy, cx, cy], rect = [white.x, white.y, white.x + 4, white.y + 4];
      const colour = [r * alpha, g * alpha, b * alpha, alpha];
      // A fan of triangles, each as a quad with its last corner twice: fine for the convex shapes the game fills.
      for (const shape of this.path) {
        for (let i = 1; i + 1 < shape.length; i++) {
          const [p0, p1, p2] = [shape[0], shape[i], shape[i + 1]];
          this.quad([...p0, ...p1, ...p2, ...p2], uv, rect, this.atlasRef, white.layer, colour, MODE.SOLID, [0, 0]);
        }
      }
    }
    stroke() {}

    // How much sun there is at a point of the world, in its pixels, from the place's light map: 1 where there's none to go by.
    sunHere(wx, wy) {
      const L = this.light, v = this.view;
      if (!L || !v) return 1;
      return L.space === "screen" ? this.post.sunAt(wx, wy) : this.post.sunAt((wy - v.topPad) + (wx - v.ox) / 2, (wy - v.topPad) - (wx - v.ox) / 2);
    }
    clip() {
      // A rectangle on the screen round the path, which is all the game clips to.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const shape of this.path) for (const [x, y] of shape) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const old = this.state.clip?.box;
      if (old) { x0 = Math.max(x0, old[0]); y0 = Math.max(y0, old[1]); x1 = Math.min(x1, old[2]); y1 = Math.min(y1, old[3]); }
      // A single rectangle is also kept as it was given, to clip exactly what's then drawn the same way.
      const exact = this.pathRect && this.path.length === 1 && !this.state.clip ? this.pathRect : null;
      this.state.clip = { box: [x0, y0, Math.max(x0, x1), Math.max(y0, y1)], local: exact?.local, m: exact?.m };
    }

    // ---- text: drawn once on a small canvas, at the screen's size, and then like any other picture
    measureText(text) { this.measure.font = this.font; return this.measure.measureText(text); }
    fillText(text, x, y) { this.text(text, x, y, false); }
    strokeText(text, x, y) { this.text(text, x, y, true); }
    text(text, x, y, stroke) {
      const m = this.state.m, scale = Math.hypot(m[0], m[1]) || 1;
      const colour = stroke ? this.strokeStyle : this.state.fillStyle;
      const key = `${this.font}|${scale}|${stroke}|${this.lineWidth}|${colour}|${this.textAlign}|${this.textBaseline}|${text}`;
      let made = this.texts.get(key);
      if (!made) {
        const g = this.measure;
        g.font = this.font;
        const metrics = g.measureText(text);
        const pad = 2 + this.lineWidth;
        const w = Math.ceil((metrics.width + pad * 2) * scale), h = Math.ceil((metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + pad * 2) * scale) || 1;
        const c = document.createElement("canvas");
        c.width = Math.max(1, w); c.height = Math.max(1, h);
        const t = c.getContext("2d");
        t.scale(scale, scale);
        t.font = this.font;
        t.textBaseline = "alphabetic";
        t.fillStyle = colour; t.strokeStyle = colour; t.lineWidth = this.lineWidth;
        const left = pad, base = pad + metrics.actualBoundingBoxAscent;
        if (stroke) t.strokeText(text, left, base);
        else t.fillText(text, left, base);
        const shift = this.textAlign === "center" ? metrics.width / 2 : this.textAlign === "right" || this.textAlign === "end" ? metrics.width : 0;
        const drop = this.textBaseline === "middle" ? (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2 : this.textBaseline === "top" ? metrics.actualBoundingBoxAscent : 0;
        made = { c, ox: -pad - shift, oy: -pad - metrics.actualBoundingBoxAscent + drop, w: c.width / scale, h: c.height / scale };
        if (this.texts.size > 400) this.texts.clear();
        this.texts.set(key, made);
      }
      const lit = this.lit;
      this.lit = false;
      this.drawImage(made.c, x + made.ox, y + made.oy, made.w, made.h);
      this.lit = lit;
    }

    createRadialGradient(...args) { return new Gradient("radial", args); }
    createLinearGradient(...args) { return new Gradient("linear", args); }
    getImageData(x, y, w, h) { return new ImageData(Math.max(1, w), Math.max(1, h)); }
  }

  // Makes the GPU's stand-in, or returns null where WebGL 2 isn't to be had, for the game to use the 2D canvas as always.
  window.makeGLContext = function makeGLContext(canvas) {
    if (location.protocol === "file:") {
      // Opened as a file, the browser won't hand the pictures to WebGL. tools/serve.py serves the game for it.
      console.info("Sátnemátki: the GPU needs the game served (python3 tools/serve.py); drawing with the 2D canvas.");
      return null;
    }
    // Tried first on a canvas of its own: once the game's canvas is WebGL's it can't go back to 2D, should something fail.
    try {
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe) return null;
      // WebGL done by the CPU (no driver the browser trusts) is slower than the 2D canvas: the canvas draws there, unless ?gl=force.
      const info = probe.getExtension("WEBGL_debug_renderer_info");
      const renderer = info ? String(probe.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
      if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(renderer) && new URLSearchParams(location.search).get("gl") !== "force") {
        console.info(`Sátnemátki: WebGL is done in software here (${renderer}), so the 2D canvas draws.`);
        probe.getExtension("WEBGL_lose_context")?.loseContext();
        return null;
      }
      compile(probe, SPRITE_VS, SPRITE_FS(0));
      compile(probe, SPRITE_VS, SPRITE_FS(1));
      probe.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (error) {
      console.error("Sátnemátki: WebGL 2 can't draw the game here, so the 2D canvas does:", error);
      return null;
    }
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) return null;
    try {
      return new GLContext(canvas, gl);
    } catch (error) {
      console.error("WebGL drawing failed to start:", error);
      return null;
    }
  };
  window.SATNE_GL_MODE = MODE;
})();
