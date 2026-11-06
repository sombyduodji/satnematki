"use strict";
// What src/gl/gl2d.js does with the world once it's drawn: sunlight shafts through the windows, a soft glow round what's bright,
// a slight colour mood, the zoom eased from one step to the next, and the frame put on the screen.
//
// Quality, which a slow device lowers by itself (and the test page can set):
//   0  the pictures as they are, nothing added
//   1  people lit by where they stand, their shadows, the colour mood
//   2  and the light shafts and the glow, at half and quarter size
//   3  the shafts with twice the samples
(function () {
  const QUAD_VS = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // A pixel of the half-size picture is a line of sight through the room. Walking it from near the viewer down to the floor,
  // whatever of it the sun reaches through a window glows a little, until something solid stands in the way.
  const SHAFTS_FS = (light) => `#version 300 es
  precision highp float;
  ${light}
  uniform vec2 uFull; uniform float uSamples; uniform float uTime; uniform float uShaftTop;
  in vec2 vUv;
  out vec4 outColour;
  void main() {
    if (uLit == 0) { outColour = vec4(0.0); return; }
    vec2 dev = vec2(vUv.x, 1.0 - vUv.y) * uFull;
    vec2 w = worldPx(dev);
    float noise0 = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (uSpace == 1) {
      // Outdoors, between the trees: the line of sight goes up from the ground at w, and a point on it at height z is in the sun
      // where its shadow would fall in the sun, shadowStep · z further along. Only deep in the trees, where shafts can be seen.
      float deep = lightAt(w).b;
      if (deep < 0.02) { outColour = vec4(0.0); return; }
      float acc = 0.0;
      for (int i = 0; i < 32; i++) {
        if (float(i) >= uSamples) break;
        float z = uShaftTop * (float(i) + noise0) / uSamples;
        acc += lightAt(w + vec2(0.0, z) + uShadowStep * z).r;
      }
      float shaft = acc / uSamples * deep;
      outColour = vec4(vec3(1.0, 0.95, 0.78) * shaft * 0.11, 1.0);
      return;
    }
    float u = w.x - uOrigin.x, v = w.y - uOrigin.y;
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float top = uWindowZ.y + 2.0, acc = 0.0, dust = 0.0;
    for (int i = 0; i < 32; i++) {
      if (float(i) >= uSamples) break;
      float z = top * (1.0 - (float(i) + noise) / uSamples);
      vec3 p = vec3(v + z + u * 0.5, v + z - u * 0.5, z);
      if (!inRoom(p.xy)) continue;
      if (z < heightAt(p.xy)) break; // the line of sight meets a shelf or a counter: nothing behind it shows
      float s = sunAt(p, 4);
      acc += s;
      // Specks of dust drifting in the light, slowly.
      vec3 cell = floor(p * 0.7 + vec3(uTime * 0.05, uTime * 0.03, -uTime * 0.08));
      float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      dust += s * step(0.9975, h);
    }
    float shaft = acc / uSamples;
    outColour = vec4(vec3(1.0, 0.88, 0.66) * (shaft * 0.42 + dust * 0.35), 1.0);
  }`;

  const BRIGHT_FS = `#version 300 es
  precision highp float;
  uniform sampler2D uScene; uniform vec2 uTexel;
  in vec2 vUv; out vec4 outColour;
  void main() {
    vec3 c = vec3(0.0);
    for (int y = -1; y <= 1; y += 2) for (int x = -1; x <= 1; x += 2) c += texture(uScene, vUv + vec2(x, y) * uTexel).rgb;
    c *= 0.25;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    outColour = vec4(c * smoothstep(0.72, 0.98, l), 1.0);
  }`;

  const BLUR_FS = `#version 300 es
  precision highp float;
  uniform sampler2D uSource; uniform vec2 uStep;
  in vec2 vUv; out vec4 outColour;
  void main() {
    vec3 c = texture(uSource, vUv).rgb * 0.2270270270;
    c += (texture(uSource, vUv + uStep * 1.3846153846).rgb + texture(uSource, vUv - uStep * 1.3846153846).rgb) * 0.3162162162;
    c += (texture(uSource, vUv + uStep * 3.2307692308).rgb + texture(uSource, vUv - uStep * 3.2307692308).rgb) * 0.0702702703;
    outColour = vec4(c, 1.0);
  }`;

  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  uniform sampler2D uScene; uniform sampler2D uSnap; uniform sampler2D uShafts; uniform sampler2D uBloom;
  uniform vec2 uOut; uniform vec2 uSceneSize; uniform vec2 uSnapSize;
  uniform float uScaleNew; uniform float uScaleOld; uniform float uMixNew; // the zoom on its way
  uniform float uShaft; uniform float uGlow; uniform float uMood;
  out vec4 outColour;
  vec2 sharpUv(vec2 px, vec2 size) {
    vec2 seam = floor(px + 0.5);
    vec2 d = max(fwidth(px), vec2(1e-4));
    px = seam + clamp((px - seam) / d, -0.5, 0.5);
    return px / size;
  }
  void main() {
    vec2 frag = gl_FragCoord.xy, middle = uOut * 0.5;
    vec2 pNew = (frag - middle) / uScaleNew + uSceneSize * 0.5;
    vec3 c;
    bool inNew = all(greaterThanEqual(pNew, vec2(0.0))) && all(lessThan(pNew, uSceneSize));
    if (uMixNew < 1.0) {
      vec2 pOld = (frag - middle) / uScaleOld + uSnapSize * 0.5;
      vec3 old = texture(uSnap, sharpUv(pOld, uSnapSize)).rgb;
      vec3 now = inNew ? texture(uScene, sharpUv(pNew, uSceneSize)).rgb : old;
      c = mix(old, now, uMixNew);
    } else {
      vec2 uv = sharpUv(pNew, uSceneSize);
      c = texture(uScene, uv).rgb;
      c += texture(uShafts, uv).rgb * uShaft;
      c += texture(uBloom, uv).rgb * uGlow;
    }
    if (uMood > 0.0) {
      // The mood: a little more colour, cool in the shade and warm in the light, and the corners a shade darker.
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 graded = mix(vec3(l), c, 1.07);
      graded *= mix(vec3(0.965, 0.985, 1.035), vec3(1.035, 1.0, 0.955), smoothstep(0.15, 0.85, l));
      vec2 q = frag / uOut - 0.5;
      graded *= 1.0 - 0.22 * pow(clamp(length(q * vec2(1.0, uOut.y / uOut.x)) * 1.35, 0.0, 1.0), 2.6);
      c = mix(c, graded, uMood);
    }
    outColour = vec4(c, 1.0);
  }`;

  class Target {
    constructor(gl, w, h) {
      this.w = w; this.h = h;
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    }
    free(gl) { gl.deleteTexture(this.texture); gl.deleteFramebuffer(this.fb); }
  }

  const QUALITY_KEY = "mahtte.gl.quality";

  class Post {
    constructor(gl, owner) {
      this.gl = gl;
      this.owner = owner;
      this.scenes = [null, null];
      this.current = 0;
      this.snap = null;
      this.zoomAnim = null;
      this.lastZoom = null;
      this.quality = 2;
      try {
        const kept = localStorage.getItem(QUALITY_KEY);
        if (kept !== null) this.quality = Math.max(0, Math.min(3, Number(kept)));
      } catch { /* private windows */ }
      this.autoQuality = true;
      this.fps = { from: 0, frames: 0, last: 0, shown: 0, times: [] };
      this.lightTexture = null;
      this.lightReady = false;
      this.quadVbo = gl.createBuffer();
      this.quadVao = gl.createVertexArray();
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.programs = null;
      this.timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      this.queries = [];
      this.gpuMs = null;
      this.black = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.black);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      // Until a place with a light map is loaded, the light map is a single dark texel.
      this.noLight = this.black;
      // Made now, with the sprites' own: made later, inside the first frame with its GPU timer running, the first one failed on
      // ANGLE with Vulkan (no log, no error) and the next frame had to make them again.
      this.makePrograms(owner.lightGlsl);
    }

    setQuality(q, byHand = true) {
      this.quality = Math.max(0, Math.min(3, q));
      if (byHand) {
        this.autoQuality = false;
        try { localStorage.setItem(QUALITY_KEY, String(this.quality)); } catch { /* private windows */ }
      }
    }

    // The light for a place: its map and where its sun and windows are, from art/<place>/light.js.
    useLight(info, src) {
      const gl = this.gl;
      this.light = info;
      this.owner.light = info;
      this.lightReady = false;
      this.lightPixels = null;
      if (!info) return;
      const image = new Image();
      image.onload = () => {
        if (this.light !== info) return;

        this.lightTexture ??= gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.lightTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Read back as well, to tell whether someone stands in the sun: only then do they throw a shadow from it. From the texture, as
        // a 2D canvas would lose the colours where the map's alpha, a height, is 0.
        try {
          const w = image.naturalWidth, h = image.naturalHeight, data = new Uint8Array(w * h * 4);
          const fb = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.lightTexture, 0);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.deleteFramebuffer(fb);
          this.lightPixels = { data, w, h };
        } catch { /* without it everyone throws one, as before */ }
        this.lightReady = true;
      };
      image.src = src;
    }

    makePrograms(lightGlsl) {
      const gl = this.gl;
      this.programs = {
        shafts: compileQuad(gl, SHAFTS_FS(lightGlsl)),
        bright: compileQuad(gl, BRIGHT_FS),
        blur: compileQuad(gl, BLUR_FS),
        composite: compileQuad(gl, COMPOSITE_FS),
      };
    }

    // How much sun there is where someone stands, from 0 to 1, at a point of the light map (the floor's units, or the screen's pixels).
    sunAt(mx, my) {
      const p = this.lightPixels;
      if (!p) return 1;
      const x = Math.max(0, Math.min(p.w - 1, Math.floor(mx))), y = Math.max(0, Math.min(p.h - 1, Math.floor(my)));
      return p.data[(y * p.w + x) * 4] / 255;
    }

    target(name, w, h) {
      const had = this[name];
      if (had && had.w === w && had.h === h) return had;
      had?.free(this.gl);
      return (this[name] = new Target(this.gl, w, h));
    }

    beginScene(w, h) {
      const gl = this.gl;
      if (this.timer && this.queries.length < 4) {
        const query = gl.createQuery();
        gl.beginQuery(this.timer.TIME_ELAPSED_EXT, query);
        this.queryOpen = query;
      }
      // With no effects, straight onto the screen: one pass less, which a weak or software GPU notices. The zoom is then not eased.
      this.direct = this.quality === 0;
      if (this.direct) {
        this.zoomStarting = false;
        this.zoomAnim = null;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.w = w; this.h = h;
        return;
      }
      if (this.zoomStarting) {
        // The frame before the zoom stays, to be eased away from.
        this.zoomStarting = false;
        this.snap = this.scenes[this.current];
        this.current = 1 - this.current;
      }
      let scene = this.scenes[this.current];
      if (!scene || scene.w !== w || scene.h !== h) {
        if (scene && scene !== this.snap) scene.free(gl);
        scene = this.scenes[this.current] = new Target(gl, w, h);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.w = w; this.h = h;
    }

    lightUniforms(program, view) {
      const gl = this.gl, u = program.uniforms, L = this.light;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lightReady ? this.lightTexture : this.noLight);
      gl.uniform1i(u.uLight, 1);
      gl.uniform1i(u.uLit, L && this.lightReady ? 1 : 0);
      if (view) {
        gl.uniform2f(u.uCam, view.camX, view.camY);
        gl.uniform1f(u.uDetail, view.detail);
        gl.uniform2f(u.uOrigin, view.ox, view.topPad);
      }
      if (L) {
        const indoors = L.space !== "screen";
        gl.uniform1i(u.uSpace, indoors ? 0 : 1);
        gl.uniform2f(u.uLightSize, L.size[0], L.size[1]);
        gl.uniform3f(u.uSun, ...L.sun);
        gl.uniform2f(u.uShadowStep, ...L.shadowStep);
        const len = Math.hypot(...L.shadowStep) || 1;
        gl.uniform2f(u.uToLight, -L.shadowStep[0] / len, -L.shadowStep[1] / len);
        if (indoors) {
          gl.uniform4f(u.uRoom, ...L.room);
          gl.uniform2f(u.uWindowZ, L.windowLow, L.windowHigh);
          gl.uniform1f(u.uHeightTop, L.heightTop);
          // Up to four windows in each back wall, the rest none: an older light.js has three.
          const four = (list) => [...list, [0, 0], [0, 0], [0, 0], [0, 0]].slice(0, 4).flat();
          gl.uniform2fv(u.uWinX, four(L.windowsX));
          gl.uniform2fv(u.uWinY, four(L.windowsY));
          gl.uniform2f(u.uMullion, ...L.mullion);
        }
        if (u.uShaftTop) gl.uniform1f(u.uShaftTop, L.shaftTop ?? 0);
      }
    }

    useSpriteProgram(sprite, additive) {
      const gl = this.gl, u = sprite.uniforms;
      gl.useProgram(sprite.program);
      gl.uniform2f(u.uSize, this.w, this.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.owner.atlas.texture);
      gl.uniform1i(u.uAtlas, 0);
      gl.uniform1i(u.uQuality, this.quality);
      gl.uniform3f(u.uShadow, 0.04, 0.07, 0.12);
      this.lightUniforms(sprite, this.owner.view);
      gl.enable(gl.BLEND);
      if (additive) gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    // The game says where its camera is before it draws, and how far it's zoomed.
    view(view) {
      if (this.lastZoom !== null && view.zoom !== this.lastZoom && this.scenes[this.current] && this.quality > 0) {
        this.zoomStarting = true;
        this.zoomAnim = { from: this.lastZoom, to: view.zoom, elapsed: 0, last: null, ms: 300 };
      }
      this.lastZoom = view.zoom;
    }

    quadPass(program, target) {
      const gl = this.gl;
      gl.useProgram(program.program);
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      this.owner.stats.draws++;
    }

    bind(unit, texture, program, name) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(program.uniforms[name], unit);
    }

    finish(view) {
      const gl = this.gl, now = performance.now();
      if (!this.programs) this.makePrograms(this.owner.lightGlsl);
      gl.disable(gl.BLEND);
      if (this.direct) {
        this.endQuery();
        this.measure(now);
        return;
      }
      const scene = this.scenes[this.current];
      let anim = this.zoomAnim, t = 1;
      if (anim) {
        // By the frames shown rather than the clock, as the first frames at a new zoom wait for pictures made at the new size.
        anim.elapsed += Math.min(now - (anim.last ?? now), 33);
        anim.last = now;
        t = Math.min(1, anim.elapsed / anim.ms);
        if (t >= 1 || !this.snap) {
          this.zoomAnim = anim = null;
          t = 1;
          if (this.snap) {
            this.snap.free(gl);
            if (this.scenes[1 - this.current] === this.snap) this.scenes[1 - this.current] = null;
            this.snap = null;
          }
        }
      }
      const effects = this.quality >= 2 && !anim && this.light && this.lightReady;
      let shafts = this.black, bloom = this.black;
      if (effects) {
        const P = this.programs;
        // The shafts, at half size.
        const half = this.target("halfTarget", Math.max(1, scene.w >> 1), Math.max(1, scene.h >> 1));
        gl.useProgram(P.shafts.program);
        this.lightUniforms(P.shafts, this.owner.view);
        gl.uniform2f(P.shafts.uniforms.uFull, scene.w, scene.h);
        gl.uniform1f(P.shafts.uniforms.uSamples, this.quality >= 3 ? 28 : 14);
        gl.uniform1f(P.shafts.uniforms.uTime, now / 1000);
        this.quadPass(P.shafts, half);
        shafts = half.texture;
        // The glow, at a quarter: what's bright, blurred both ways twice.
        const qw = Math.max(1, scene.w >> 2), qh = Math.max(1, scene.h >> 2);
        const a = this.target("quarterA", qw, qh), b = this.target("quarterB", qw, qh);
        gl.useProgram(P.bright.program);
        this.bind(0, scene.texture, P.bright, "uScene");
        gl.uniform2f(P.bright.uniforms.uTexel, 1 / scene.w, 1 / scene.h);
        this.quadPass(P.bright, a);
        for (let pass = 0; pass < 2; pass++) {
          gl.useProgram(P.blur.program);
          this.bind(0, a.texture, P.blur, "uSource");
          gl.uniform2f(P.blur.uniforms.uStep, (1 + pass) / qw, 0);
          this.quadPass(P.blur, b);
          gl.useProgram(P.blur.program);
          this.bind(0, b.texture, P.blur, "uSource");
          gl.uniform2f(P.blur.uniforms.uStep, 0, (1 + pass) / qh);
          this.quadPass(P.blur, a);
        }
        bloom = a.texture;
      }
      const C = this.programs.composite, u = C.uniforms;
      gl.useProgram(C.program);
      this.bind(0, scene.texture, C, "uScene");
      this.bind(1, (anim && this.snap ? this.snap : scene).texture, C, "uSnap");
      this.bind(2, shafts, C, "uShafts");
      this.bind(3, bloom, C, "uBloom");
      gl.uniform2f(u.uOut, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(u.uSceneSize, scene.w, scene.h);
      if (anim && this.snap) {
        const e = t * t * (3 - 2 * t), zoom = anim.from + (anim.to - anim.from) * e;
        gl.uniform2f(u.uSnapSize, this.snap.w, this.snap.h);
        gl.uniform1f(u.uScaleNew, zoom / anim.to);
        gl.uniform1f(u.uScaleOld, zoom / anim.from);
        gl.uniform1f(u.uMixNew, Math.min(1, t * 1.6) * 0.999);
      } else {
        gl.uniform2f(u.uSnapSize, scene.w, scene.h);
        gl.uniform1f(u.uScaleNew, 1);
        gl.uniform1f(u.uScaleOld, 1);
        gl.uniform1f(u.uMixNew, 1);
      }
      gl.uniform1f(u.uShaft, effects ? 1 : 0);
      gl.uniform1f(u.uGlow, effects ? 0.32 : 0);
      gl.uniform1f(u.uMood, this.quality >= 1 && this.light ? 1 : 0);
      this.quadPass(C, null);
      this.endQuery();
      this.measure(now);
    }

    endQuery() {
      if (this.queryOpen) {
        this.gl.endQuery(this.timer.TIME_ELAPSED_EXT);
        this.queries.push(this.queryOpen);
        this.queryOpen = null;
      }
      this.readQueries();
    }

    readQueries() {
      const gl = this.gl;
      while (this.queries.length) {
        const query = this.queries[0];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
        if (!gl.getParameter(this.timer.GPU_DISJOINT_EXT)) this.gpuMs = this.gpuMs === null ? ns / 1e6 : this.gpuMs * 0.9 + (ns / 1e6) * 0.1;
        gl.deleteQuery(query);
        this.queries.shift();
      }
    }

    // Like keepItSmooth in src/world.js: a few seconds well under 60 frames a second, and the effects go down a step.
    measure(now) {
      const f = this.fps;
      f.times.push(now);
      while (f.times.length && now - f.times[0] > 1000) f.times.shift();
      f.shown = f.times.length;
      if (now - f.last > 250) { f.from = now; f.frames = 0; }
      f.last = now;
      f.frames++;
      if (now - f.from < 4000) return;
      if (this.autoQuality && this.quality > 0 && (f.frames * 1000) / (now - f.from) < 50) {
        this.quality--;
        console.info(`Sátnemátki GL: effects down to ${this.quality}, as frames were slow`);
      }
      f.from = now;
      f.frames = 0;
    }
  }

  function compileQuad(gl, fs) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, QUAD_VS], [gl.FRAGMENT_SHADER, fs]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader: ${gl.isContextLost() ? "context lost" : gl.getShaderInfoLog(shader)} | ${source.slice(0, 120).replace(/\s+/g, " ")}`);
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

  window.SatneGLPost = Post;
})();
