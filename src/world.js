// The world: an isometric place seen through a camera that follows the character. Drawing only;
// the rules and the movement are in game.js. The places come from tools/make_map.py.
const TILE = 16;
let placeName, MAP, START, SPOTS, WIDTH, HEIGHT, WORLD_W, WORLD_H, OX, forestAt, trees, treeMap;
const SOLID_TILES = new Set("vQewBWXKSCMDRZPETVGHYJIOUNAokn_"); // _ is nothing at all, beyond the walls of a room that isn't square
const BLOCK_TILES = new Set("vQeBWXKSCMDRZPETVGHYJIOUNokn")
// The places played as a trip to the shops: basket, list, till, bag and door.
const SHOPS = new Set(["store", "gearstore"]);
const isShop = (place) => SHOPS.has(place);;
// Food stands in its fixture, this far above the floor.
// How far towards the aisle, in tiles from the tile's middle, things stand in a fixture of the rooms made with tools/rooms3d.py.
const IN_FRONT = { tools: 0.13, fishing: 0.13 };
// In the general store every thing is stocked on all of its tiles: two side by side on each, or one of what's wide, as if hung up there.
// Some come in several looks, one to a tile: the backpacks are four of the classmates' ten from tools/make_animals.py (the flag,
// a reindeer under the midnight sun, the northern lights, a rainbow), standing on the shelf under the rail.
const WIDE_STOCK = new Set(["saw", "spade", "oar", "rod", "fishnet", "rubberboots", "boat", "snowscooter", "pulk", "lavvu", "backpack"]);
const STOCK_LOOKS = { backpack: ["backpack-0", "backpack-3", "backpack-4", "backpack-8"] };
const stockCopies = (o) => (placeName !== "gearstore" || !o.tiles ? [o]
  : o.tiles.flatMap(([x, y], i) => (WIDE_STOCK.has(o.word.sprite) ? [0] : [-0.21, 0.21]).map((dx) => ({
    ...o, x, y, tiles: undefined, copyDx: dx, of: o, drawSprite: STOCK_LOOKS[o.word.sprite]?.[i % STOCK_LOOKS[o.word.sprite].length],
  }))));
const RAISED = { pallet: 15, meat: 11, shelf: 11, fridge: 8, freezer: 10, produce: 8, desk: 9, bookshelf: 14.8, table: 10, tools: 3, fishing: 3, clothes: 4, platform: 3 };
const canvas = document.getElementById("world");
// In kauppa-gl.html the GPU draws instead (src/gl/), through a stand-in that takes the same calls. Elsewhere, or without WebGL 2, the 2D canvas.
const ctx = (window.SATNE_GL && window.makeGLContext?.(canvas)) || canvas.getContext("2d", { alpha: false }); // nothing shows through it, and knowing that saves the browser work
const ANIMALS = new Set(["gumpe", "geatki", "albbas", "boazu", "beana", "njoammil", "loddi", "guovza", "rieban", "oarri", "sahpan", "gahttu", "savza", "gussa", "spiidni", "vuonccis", "cuoppu", "skuolfi", "beaiveloddi", "rievssat", "goahppil", "garanas", "njukca", "goaskin", "jievjaskuolfi", "beahceloddi"]);
const FLOATING = new Set(["guolli", "fanas"]);

function noise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const isWater = (t) => t === "w" || t === "b";
const pick = (list, value) => list[Math.floor(value * list.length) % list.length];


// Draws row by row, so a thing bends and squashes instead of sliding as one
// picture: the bottom stays put, the top leans, and height changes with squash.
const LEAN_BANDS = 5;
function drawLiving(image, x, y, { lean = 0, squash = 0, flip = false } = {}) {
  const rows = image.height;
  // Row by row as always, each taken from the finer picture where the place is drawn finer.
  const source = viewDetail > 1 ? doubledImage(image) : image;
  const fine = source.width / image.width;
  // A lean with nothing else is a few bands, each moved over a little more towards the top: plain copies, as a slanted picture
  // cost the forest most of a frame.
  if (!squash && !flip) {
    const bands = Math.min(LEAN_BANDS, rows);
    for (let band = 0; band < bands; band++) {
      const from = Math.round((band * rows) / bands), to = Math.round(((band + 1) * rows) / bands);
      const shift = Math.round(lean * (1 - (from + to) / 2 / rows) * CANVAS_DETAIL) / CANVAS_DETAIL;
      ctx.drawImage(source, 0, from * fine, source.width, (to - from) * fine, x + shift, y + from, image.width, to - from);
    }
    return;
  }
  let lastY = null;
  for (let row = rows - 1; row >= 0; row--) {
    const up = rows - 1 - row;
    const destY = y + rows - 1 - Math.round(up * (1 - squash));
    const destX = Math.round((x + lean * (up / rows)) * CANVAS_DETAIL) / CANVAS_DETAIL; // as finely as the canvas can show, so it bends and doesn't step
    if (destY === lastY) continue;
    lastY = destY;
    if (flip) {
      ctx.save();
      ctx.translate(destX + image.width, destY);
      ctx.scale(-1, 1);
      ctx.drawImage(source, 0, row * fine, source.width, fine, 0, 0, image.width, 1);
      ctx.restore();
    } else {
      ctx.drawImage(source, 0, row * fine, source.width, fine, destX, destY, image.width, 1);
    }
  }
}

// How much of the world is in view, 16:10 unless the place shows as much as fits the window: see chooseCanvasDetail.
const BASE_VIEW_W = 304, BASE_VIEW_H = 190;
let VIEW_W = BASE_VIEW_W, VIEW_H = BASE_VIEW_H;
const HW = 16, HH = 8, TOP_PAD = 60, WATER_DROP = 4, EDGE = 10, MARGIN = 80;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const isoX = (x, y) => (x - y) * HW + OX;
const isoY = (x, y) => (x + y) * HH + TOP_PAD;
const SHADOW = "#0a1c2c";

const smooth = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = noise(ix, iy), b = noise(ix + 1, iy), c = noise(ix, iy + 1), d = noise(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
};
const tileOr = (x, y, other) => (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT ? other : MAP[y][x]);

// How deep in the forest each tile is, so the ground darkens under the trees.
const measureForest = () => MAP.map((row, y) => [...row].map((_, x) => {
  let n = 0;
  for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (tileOr(x + a, y + b, "t") === "t") n++;
  return n / 25;
}));

// ------------------------------------------------------------- ground colours
const GRASS_RAMP = ["#3f7c40", "#4a8a45", "#55984a", "#60a44f", "#6daf55", "#7cb95c"];
const FOREST_RAMP = ["#2c5c38", "#33683b", "#3b743e", "#458043"];
const DIRT = ["#b4966a", "#c0a274", "#cbae7f", "#d6bb8d", "#a68a60"];

function groundPixel(tx, ty, wx, wy) {
  const grain = noise(wx, wy);
  const broad = smooth(wx / 46, wy / 46) * 0.7 + smooth(wx / 13, wy / 13) * 0.3;
  const forest = (forestAt[ty][tx] + (forestAt[ty][Math.min(WIDTH - 1, tx + 1)] + forestAt[Math.min(HEIGHT - 1, ty + 1)][tx]) / 2) / 2;
  const level = broad + (grain - 0.5) * 0.22;
  if (forest > 0.3 + (grain - 0.5) * 0.14) {
    if (smooth(wx / 9 + 40, wy / 9) > 0.8) return grain > 0.4 ? "#b5c6a3" : "#9fb392"; // pale moss and lichen
    return FOREST_RAMP[Math.max(0, Math.min(3, Math.floor(level * 4)))];
  }
  return GRASS_RAMP[Math.max(0, Math.min(5, Math.floor(level * 6)))];
}

// Town and indoor ground.
function asphaltPixel(wx, wy) {
  const grain = noise(wx, wy);
  return grain > 0.97 ? "#7a7f86" : grain < 0.03 ? "#44484e" : smooth(wx / 11, wy / 11) > 0.55 ? "#5c6168" : "#565b62";
}

// Lines between the bays and across each end. A bay is two tiles deep, so none between its two rows.
function bayPixel(wx, wy, lx, ly) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const line = lx < 1.2
    || (lx > 14.8 && tileOr(tx + 1, ty, "a") !== "q")
    || (ly < 1.2 && tileOr(tx, ty - 1, "a") !== "q")
    || (ly > 14.8 && tileOr(tx, ty + 1, "a") !== "q");
  return line ? "#e8e8df" : asphaltPixel(wx, wy);
}

function pavementPixel(wx, wy, lx, ly) {
  if (lx % 8 < 0.8 || ly % 8 < 0.8) return "#8b8c88";
  return noise(wx, wy) > 0.9 ? "#a8a9a3" : "#b4b5ae";
}

function woodFloorPixel(wx, wy, lx, ly) {
  if (ly % 5.33 < 0.7) return "#6f4726";
  const board = Math.floor(ly / 5.33) + Math.floor(wy / TILE) * 3;
  if ((lx + board * 5) % 16 < 0.7) return "#6f4726";
  const grain = noise(Math.floor(wx / 3), wy);
  return grain > 0.75 ? "#a9743f" : grain > 0.3 ? "#b98249" : "#c28c52";
}

function tiledFloorPixel(wx, wy) {
  const light = (Math.floor(wx / TILE) + Math.floor(wy / TILE)) % 2 === 0;
  const grain = noise(wx, wy);
  return light ? (grain > 0.92 ? "#dcd8cc" : "#e8e4d8") : grain > 0.92 ? "#b4c4c8" : "#c0d0d4";
}

function classroomFloorPixel(wx, wy, lx, ly) {
  if (lx < 0.6 || ly < 0.6) return "#a79d86";
  const grain = noise(wx, wy);
  return grain > 0.93 ? "#bfb59c" : smooth(wx / 17, wy / 17) > 0.5 ? "#cdc3a9" : "#c6bca2";
}

function carpetPixel(wx, wy) {
  const fluff = noise(wx, wy);
  return fluff > 0.8 ? "#b97f70" : fluff > 0.35 ? "#ad7264" : "#a2685b";
}

function bathroomFloorPixel(wx, wy, lx, ly) {
  if (lx % 8 < 0.6 || ly % 8 < 0.6) return "#9fb8c0";
  return noise(wx, wy) > 0.9 ? "#c4dde2" : "#d0e6ea";
}

const SITTING_ON_SOFA = new Set(["eadni", "viellja"]);
const FLOORS = { c: carpetPixel, j: bathroomFloorPixel, a: asphaltPixel, q: bayPixel, s: pavementPixel, F: woodFloorPixel, f: tiledFloorPixel, L: classroomFloorPixel };

function pathPixel(tx, ty, wx, wy, lx, ly) {
  const grain = noise(wx, wy);
  const wob = smooth(wx / 5, wy / 5) * 4;
  const open = (a, b) => { const t = tileOr(tx + a, ty + b, "g"); return t !== "p" && t !== "b"; };
  const edge = (open(-1, 0) && lx < wob) || (open(1, 0) && 15 - lx < wob) || (open(0, -1) && ly < wob) || (open(0, 1) && 15 - ly < wob);
  if (edge) return groundPixel(tx, ty, wx, wy);
  if (grain > 0.975) return "#8c7350"; // pebbles
  if (grain < 0.03) return "#e4cda2";
  return DIRT[Math.floor(smooth(wx / 3, wy / 3) * 4.99)];
}

function waterPixel(tx, ty, wx, wy, lx, ly) {
  const dry = (a, b) => { const t = tileOr(tx + a, ty + b, "g"); return t !== "w" && t !== "b"; };
  const fromN = dry(0, -1) ? ly : 99, fromS = dry(0, 1) ? 15 - ly : 99;
  const fromW = dry(-1, 0) ? lx : 99, fromE = dry(1, 0) ? 15 - lx : 99;
  const grain = noise(wx, wy);
  if (Math.min(fromN, fromW) < 2) return "#123a6b"; // banks on the sunny side shade the water
  if (Math.min(fromS, fromE) < 1 && grain > 0.35) return "#c9ecf8"; // foam
  const shore = Math.min(fromN, fromS, fromW, fromE) + (grain - 0.5) * 3;
  if (shore < 3) return "#4f9fd2";
  const streak = noise(Math.floor(wx / 7), wy);
  if (shore < 6) return streak > 0.5 ? "#3a86c2" : "#3379b4";
  return streak > 0.75 ? "#2f75b4" : streak > 0.35 ? "#2767a4" : "#215a96";
}

function diamond(g, tx, ty, drop, colour) {
  const cx = isoX(tx, ty), top = isoY(tx, ty) + drop;
  for (let row = 0; row < 2 * HH; row++) {
    const half = row < HH ? (row + 1) * 2 : (2 * HH - row) * 2;
    for (let sx = -half; sx < half; sx++) {
      const a = (sx + 0.5) / HW, b = (row + 0.5) / HH;
      const u = Math.min(0.999, Math.max(0, (a + b) / 2)), v = Math.min(0.999, Math.max(0, (b - a) / 2));
      g.fillStyle = colour((tx + u) * TILE, (ty + v) * TILE, u * TILE, v * TILE);
      g.fillRect(cx + sx, top + row, 1, 1);
    }
  }
}

// Bank faces: earth with stones and hanging grass. The side away from the sun is darker.
function bankFace(g, tx, ty, depth, east) {
  const cx = isoX(tx, ty), top = isoY(tx, ty);
  const tones = east ? ["#3c2a1b", "#46311f", "#503825"] : ["#5e432a", "#6d4e30", "#7c5a39"];
  for (let i = 0; i < HW; i++) {
    const x = east ? cx + HW - 1 - i : cx - HW + i;
    const y0 = top + HH + Math.floor(i / 2);
    for (let d = 0; d < depth; d++) {
      const n = noise(x, y0 + d + tx);
      g.fillStyle = d === 0 ? "#2f6232" : d === 1 && n > 0.5 ? "#3f7538" : n > 0.94 ? "#9b9a92" : tones[Math.floor(n * 3)];
      g.fillRect(x, y0 + d, 1, 1);
    }
  }
}

// ------------------------------------------------------------------ the trees
function addOutline(g, w, h, thick) {
  g.fillStyle = OUTLINE;
  for (let pass = 0; pass < thick; pass++) {
    const data = g.getImageData(0, 0, w, h).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) g.fillRect(x, y, 1, 1);
    }
  }
}

function outlined(w, h, paint, thick = 1) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  paint(g);
  addOutline(g, w, h, thick);
  return c;
}

function unoutlined(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"));
  return c;
}

function makePine(height, seed) {
  const w = Math.round(height * 0.74);
  return outlined(w, height, (g) => {
    const cx = w / 2;
    g.fillStyle = "#3a2518"; g.fillRect(cx - 2, height - 8, 4, 7);
    g.fillStyle = "#6a4528"; g.fillRect(cx - 2, height - 8, 1, 7);
    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const top = 1 + Math.floor((t * (height - 12)) / tiers);
      const bottom = top + Math.floor((height - 8) / tiers) + 3;
      const widest = 3 + (t + 1) * (w / 2 - 4) / tiers;
      for (let y = top; y <= bottom; y++) {
        const f = (y - top) / (bottom - top);
        const half = Math.max(1, Math.round(widest * f + noise(y, seed) * 1.4));
        for (let x = -half; x < half; x++) {
          const side = x / half;
          const n = noise(x + 50, y + seed);
          let c = "#1f5a3a";
          if (side < -0.35 + (n - 0.5) * 0.5) c = n > 0.7 ? "#4f9a5a" : "#358052";
          else if (side > 0.35 + (n - 0.5) * 0.5) c = "#123c2a";
          if (f > 0.82) c = "#123c2a";
          if (f > 0.7 && side < -0.2 && n > 0.75) c = "#6cb56a";
          g.fillStyle = c;
          g.fillRect(Math.round(cx + x), y, 1, 1);
        }
      }
    }
  });
}

function makeBirch(seed) {
  return outlined(22, 32, (g) => {
    g.fillStyle = "#e9e6da"; g.fillRect(10, 14, 3, 17);
    g.fillStyle = "#b9b5a8"; g.fillRect(12, 14, 1, 17);
    for (let y = 15; y < 31; y += 3) { g.fillStyle = "#2d2a2a"; g.fillRect(10 + (y + seed) % 2, y, 2, 1); }
    const blobs = [[11, 8, 8], [6, 11, 5], [16, 11, 5], [8, 5, 5], [14, 5, 5], [11, 14, 5]];
    for (const [x, y, r] of blobs) {
      for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) {
        if (a * a + b * b > r * r) continue;
        const px = x + a, py = y + b;
        const n = noise(px + seed * 3, py);
        const light = (a + b) / r + (n - 0.5) * 1.1;
        g.fillStyle = light < -0.75 ? "#b4d66a" : light < -0.1 ? "#86b84d" : light < 0.6 ? "#5f9a40" : "#3f7632";
        g.fillRect(px, py, 1, 1);
      }
    }
  });
}
const PINES = [makePine(30, 1), makePine(38, 2), makePine(46, 3)];
const BIRCHES = [makeBirch(1), makeBirch(2)];

// Solid tiles are boxes standing on the map, drawn in with the trees so things can pass behind.
const FOOD_COLOURS = ["#d13a30", "#f2c630", "#3a9a48", "#2f6fc2", "#e08a2e", "#eeeee6"];
const SPINE_COLOURS = ["#b53a30", "#2f6fc2", "#d8a82a", "#3a8a48", "#6a3a8a", "#d8d2c0", "#2a4a6a"];
const GARMENT_COLOURS = ["#2f5fa8", "#b53a30", "#d8a82a", "#3a8a48", "#6b7a4a", "#d8d2c0", "#2a4a6a"];
const BLOCK_STYLE = {
  B: { height: 46, top: "#3c4048", left: "#a4806a", right: "#7a5c4c" },
  W: { height: 30, top: "#54483f", left: "#d8cdb6", right: "#ac9f88" },
  o: { height: 30, top: "#54483f", left: "#d8cdb6", right: "#ac9f88" }, // the same wall with a window, in the showroom
  X: { height: 7, top: "#6e665a", left: "#a89c88", right: "#857a68" },
  K: { height: 22, top: "#7a4c28", left: "#5c3a1e", right: "#46291a" },
  S: { height: 16, top: "#e0dcd0", left: "#b0aca0", right: "#8c887c" },
  R: { height: 26, top: "#d8dde0", left: "#d8e8f0", right: "#a8bcc8" },
  Z: { height: 10, top: "#a8dcf0", left: "#e8ecec", right: "#b8c0c4" },
  P: { height: 8, top: "#8a5f35", left: "#a9743f", right: "#7a5230" },
  E: { height: 10, top: "#d8b078", left: "#a9743f", right: "#7a5230" },
  T: { height: 13, top: "#a9743f", left: "#7a4c28", right: "#5c3a1e" },
  V: { height: 32, top: "#54483f", left: "#d8cdb6", right: "#ac9f88" },
  G: { height: 32, top: "#54483f", left: "#d8cdb6", right: "#ac9f88" },
  C: { height: 11, top: "#7c8a94", left: "#5a6670", right: "#46525c" },
  M: { height: 11, top: "#dfe6e8", left: "#a8c4cc", right: "#7f98a0" },
  D: { height: 10, top: "#b98249", left: "#7a4c28", right: "#5c3a1e" },
  O: { height: 26, top: "#6a4426", left: "#b98a56", right: "#7a4c28" },
  U: { height: 18, top: "#8c9198", left: "#3f4650", right: "#5a616a" },
  N: { height: 3, top: "#5b6672", left: "#7b8794", right: "#4c5661" },
  // Home: warm walls with a faint stripe, windows in two of the three, and low walls between the rooms.
  H: { height: 9, top: "#8a5a3a", left: "#e8d3ac", right: "#c9ae84" },
  Y: { height: 30, top: "#6b4a32", left: "#ecd3a4", right: "#d6b98a" },
  J: { height: 30, top: "#6b4a32", left: "#ecd3a4", right: "#d6b98a" },
  I: { height: 30, top: "#6b4a32", left: "#ecd3a4", right: "#d6b98a" },
};

function makeBlock(tile, seed) {
  const { height, top, left, right } = BLOCK_STYLE[tile];
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 16 + height;
  const g = c.getContext("2d");
  const dot = (x, y, colour) => {
    g.fillStyle = colour;
    g.fillRect(x, y, 1, 1);
  };
  for (let x = 0; x < 32; x++) {
    const onLeft = x < 16;
    const start = onLeft ? 8 + Math.floor(x / 2) : 16 - Math.floor((x - 15) / 2);
    const across = onLeft ? x : x - 16;
    for (let row = 0; row < height; row++) {
      let colour = onLeft ? left : right;
      const n = noise(x + seed * 7, row + seed);
      if (tile === "B") {
        if (across % 6 >= 2 && across % 6 <= 4 && row % 11 >= 3 && row % 11 <= 8 && row < height - 8) colour = onLeft ? (n > 0.8 ? "#ffe680" : "#8fc3e0") : "#5c8cac";
        else if (row % 4 === 0) colour = onLeft ? "#94705c" : "#6c4e40";
      } else if (tile === "W") {
        if (row > height - 4) colour = onLeft ? "#8a7458" : "#6a5844";
      } else if (tile === "K") {
        // Rows of book spines between the shelves.
        const shelf = row % 9;
        if (shelf > 1 && across > 0 && across < 15) colour = pick(SPINE_COLOURS, noise(Math.floor(across / 2) + seed * 3, Math.floor(row / 9) + seed));
        if (shelf > 1 && !onLeft) colour = colour === right ? right : "#3a2a24";
      } else if (tile === "S") {
        const shelf = row % 7;
        if (shelf >= 2 && shelf <= 5 && across > 0 && across < 15) colour = pick(FOOD_COLOURS, noise(Math.floor(across / 3) + seed * 5, Math.floor(row / 7) + seed));
        if (shelf >= 2 && !onLeft && colour !== right) colour = n > 0.5 ? "#7c7a70" : right;
      } else if ((tile === "C" || tile === "M") && row === 2) {
        colour = "#c8372d";
      } else if (tile === "R") {
        // Lit glass doors with cold shelves behind.
        if (row < 3 || row > height - 4 || across % 8 === 0) colour = onLeft ? "#eef0f0" : "#b8c4cc";
        else if (row % 7 === 3) colour = onLeft ? "#7fa8bc" : "#5f8294";
        else colour = onLeft ? (n > 0.85 ? "#e4f6ff" : "#b8e0f0") : "#7fb0c4";
      } else if (tile === "Z") {
        if (row > 1 && row < 5) colour = onLeft ? "#3a8fd0" : "#2a6a9c";
      } else if (tile === "O") {
        // A board full of peg holes, on a darker frame.
        if (row < 2 || row > height - 3) colour = onLeft ? "#6a4426" : "#553419";
        else if (onLeft && across % 3 === 1 && row % 3 === 1) colour = "#6a4426";
      } else if (tile === "U") {
        // A bar with clothes hanging from it close together, over a dark back and a low foot.
        const hanging = pick(GARMENT_COLOURS, noise(Math.floor(across / 5) + seed * 5, seed));
        const hem = height - 6 - Math.floor(noise(Math.floor(across / 5) + seed * 3, seed + 1) * 4);
        if (row < 2) colour = onLeft ? "#c9ced4" : "#8c9198";
        else if (row > height - 3) colour = onLeft ? "#5a616a" : "#3f4650";
        else if (onLeft && row < hem && across % 5 !== 4) colour = hanging;
      } else if (tile === "N") {
        if (row === 0) colour = onLeft ? "#a3aeb9" : "#6d7883";
      } else if (tile === "P") {
        if (row % 3 === 2) colour = onLeft ? "#6f4726" : "#553419"; // gaps between the slats
      } else if (tile === "E") {
        // A tabletop on four legs, with the floor showing between them.
        if (row >= 3 && across > 1 && across < 14) colour = null;
      } else if (tile === "T" && onLeft && row > 3 && row % 4 === 0) {
        colour = "#5c3a1e"; // drawers
      } else if (tile === "V" && onLeft) {
        // The blackboard, with chalk numbers on it.
        if (row >= 5 && row < 25) {
          colour = "#2f5a44";
          const chalk = noise(Math.floor(across / 3) + seed * 11, Math.floor(row / 5));
          if (chalk > 0.72 && across % 3 !== 2 && row % 5 !== 0) colour = "#dfe8dc";
        } else if (row >= 25 && row < 27) {
          colour = "#7a4c28";
        }
      } else if ((tile === "G" || tile === "J") && !onLeft || (tile === "I" || tile === "o") && onLeft) {
        // Windows looking out at the sky.
        if (row >= 5 && row < 24 && across > 2 && across < 13) colour = row % 9 === 3 || across === 8 ? "#eeeadf" : row > 16 ? "#a8d8c0" : "#a8d4f0";
      }
      if ("YJI".includes(tile) && (colour === left || colour === right)) {
        if (row > height - 4) colour = onLeft ? "#9a6a44" : "#7a5234"; // the skirting board
        else if (across % 4 === 0) colour = onLeft ? "#e2c694" : "#c9ab7c";
      }
      if (colour) dot(x, start + row, colour);
    }
    // The top of the box.
    for (let y = 8 - (onLeft ? Math.floor(x / 2) : 8 - Math.floor((x - 15) / 2)); y < start; y++) {
      const n = noise(x + seed, y * 3);
      // A freezer's glass lid catches the light; a crate is full of something leafy underneath.
      dot(x, y, tile === "N" ? (y % 3 === 0 ? "#525d68" : top) : tile === "Z" ? ((x + y) % 7 < 2 ? "#e0f4fc" : top) : tile === "P" ? (n > 0.5 ? "#5f9a40" : "#4a8036") : top);
    }
  }
  return c;
}

const blockImages = new Map();
function blockImage(tile, seed) {
  const key = `${tile}${seed % 5}`;
  if (!blockImages.has(key)) blockImages.set(key, makeBlock(tile, seed % 5));
  return blockImages.get(key);
}

// The forest's trees come from tools/make_forest.py, one kind to each part of the map: width and height in the world's pixels.
// Must match TREES there. The picture itself is fine, at FOREST_DETAIL, and the plain one only holds its size in the world.
const FOREST_DETAIL = 4;
const FOREST_TREES = { P: [[48, 88], [54, 102], [58, 116]], S: [[40, 66], [46, 80], [52, 94]], B: [[34, 70], [38, 84], [42, 98]], J: [[16, 24], [18, 30]], R: [[30, 40], [34, 46]] };
const forestTreeImages = new Map();
// A fine picture made ready at the canvas's own detail, so the forest's hundred trees aren't shrunk from four times over every frame.
function fittedFine(image) {
  const fine = image.fine, detail = CANVAS_DETAIL;
  if (detail >= 4 || !fine.complete || !fine.naturalWidth) return fine;
  if (image.fitted?.detail !== detail) {
    const fitted = (image.fitted = { detail, ready: null });
    fittedImage(fine, image.width * detail, image.height * detail).then((ready) => (fitted.ready = ready));
  }
  return image.fitted.ready ?? fine;
}

function forestTreeImage(kind, which) {
  const key = `${kind}-${which}`;
  if (!forestTreeImages.has(key)) {
    const plain = document.createElement("canvas");
    [plain.width, plain.height] = FOREST_TREES[kind][which];
    plain.fine = new Image();
    plain.fine.src = `art/forest/tree-${key}.png`;
    forestTreeImages.set(key, plain);
  }
  return forestTreeImages.get(key);
}

// The old church in the forest, scenery from tools/make_forest.py. Its yard can be walked in, through the open gate, and the building
// can't. It comes in two pictures, as the fence's near sides go in front of anyone in the yard. Its middle is at (x0 + x1) / 2, (y0 + y1) / 2;
// ax and ay are where that lands in the picture. depth is between what stands behind it and in front. Must match CHURCH, CHURCH_SIZE and
// CHURCH_ANCHOR there.
const FOREST_CHURCH = { x0: 46, y0: 27, x1: 58, y1: 37, w: 360, h: 214, ax: 180, ay: 112, depth: 85 };
let forestChurchImage = null, forestFenceImage = null;
// The church and its fence at the size they're drawn: scaling such big pictures every frame cost several milliseconds.
function churchPicture(entry, src) {
  if (!entry || entry.detail !== CANVAS_DETAIL) {
    entry = loadFitted(src, () => [FOREST_CHURCH.w * CANVAS_DETAIL, FOREST_CHURCH.h * CANVAS_DETAIL]);
    entry.detail = CANVAS_DETAIL;
  }
  return entry;
}

const STORE_CELL = { width: 32, height: 64 }; // a tile's picture in the world's pixels
// Where each place made ahead has its tiles, from tools/make_store.py, tools/make_classrooms.py and the rooms of tools/rooms3d.py.
const madeTiles = () => (placeName === "store" ? window.MAHTTE_STORE : window.MAHTTE_CLASSROOMS?.[placeName] ?? window.MAHTTE_ROOMS?.[placeName]);
const madeSheets = new Map();
function madeSheet() {
  const key = `${placeName}/${CANVAS_DETAIL}`;
  if (!madeSheets.has(key)) {
    const scale = CANVAS_DETAIL / 4;
    madeSheets.set(key, loadFitted(`art/${placeName}/fixtures.webp`, (image) => [image.naturalWidth * scale, image.naturalHeight * scale]));
  }
  return madeSheets.get(key);
}
function placeThings() {
  const list = [];
  const treeKinds = window.MAHTTE_MAPS[placeName].trees;
  for (let ty = 0; ty < HEIGHT; ty++) for (let tx = 0; tx < WIDTH; tx++) {
    const tile = MAP[ty][tx];
    if (BLOCK_TILES.has(tile) && madeTiles()) {
      // Some tiles have nothing to show, such as the far half of a wall.
      const place = madeTiles()[`${tx},${ty}`];
      if (place) list.push({ tx, ty, block: true, made: place, image: STORE_CELL, x: isoX(tx, ty), y: isoY(tx, ty) + 14, mx: tx + 0.5, my: ty + 0.5 });
      // A sign over what's for sale, in the same way.
      const sign = madeTiles()[`${tx},${ty}s`];
      if (sign) list.push({ tx, ty, block: true, made: sign, image: STORE_CELL, x: isoX(tx, ty), y: isoY(tx, ty) + 14, mx: tx + 0.5, my: ty + 0.5 });
    } else if (BLOCK_TILES.has(tile)) {
      list.push({ tx, ty, block: true, image: blockImage(tile, tx * 3 + ty), x: isoX(tx, ty), y: isoY(tx, ty) + 14, mx: tx + 0.5, my: ty + 0.5 });
    } else if (tile === "t" && madeTiles()?.[`${tx},${ty}`]) {
      // A tree made with the place, as the car park's birches: drawn like a fixture, and still a trunk to walk round in its middle.
      list.push({ tx, ty, made: madeTiles()[`${tx},${ty}`], image: STORE_CELL, x: isoX(tx, ty), y: isoY(tx, ty) + 14, mx: tx + 0.5, my: ty + 0.5, trunk: 0.16 });
    } else if (tile === "t") {
      const birch = forestAt[ty][tx] < 0.35 ? noise(tx * 2, ty) > 0.45 : noise(tx * 2, ty) > 0.86;
      const choices = treeKinds ? FOREST_TREES[treeKinds[ty][tx]].map((_, which) => forestTreeImage(treeKinds[ty][tx], which)) : birch ? BIRCHES : PINES;
      const x = isoX(tx, ty) + Math.round((noise(tx, ty + 2) - 0.5) * 9);
      const y = isoY(tx, ty) + HH + Math.round((noise(tx + 2, ty) - 0.5) * 5);
      const a = (x - OX) / HW, b = (y - TOP_PAD) / HH;
      // How far a trunk keeps the character off: the forest's big pines, spruces and birches more than the small trees under them.
      const trunk = treeKinds ? { P: 0.26, S: 0.24, B: 0.2 }[treeKinds[ty][tx]] : undefined;
      list.push({ tx, ty, image: choices[Math.floor(noise(tx, ty * 3) * choices.length) % choices.length], x, y, mx: (a + b) / 2, my: (b - a) / 2, trunk });
    }
  }
  return list;
}

// A piece of furniture from a room's sheet, where it goes in the world: from tools/rooms3d.py, in picture pixels, four to the world's pixel.
function paintPiece([sx, sy, w, h, left, top]) {
  const { ready, plain } = madeSheet(), sheet = ready ?? plain, scale = ready ? CANVAS_DETAIL / 4 : 1;
  if (!sheet) return;
  ctx.lit = false; // its light is in it already
  ctx.drawImage(sheet, sx * scale, sy * scale, w * scale, h * scale, left / 4, top / 4, w / 4, h / 4);
  ctx.lit = true;
}

// Sets everything up for one of the places. Each is drawn once and kept.
const builtWorlds = new Map();
function loadPlace(name) {
  setViewDetail(name);
  const place = window.MAHTTE_MAPS[name];
  placeName = name;
  MAP = place.rows;
  START = place.start;
  SPOTS = place.spots;
  WIDTH = MAP[0].length;
  HEIGHT = MAP.length;
  WORLD_W = (WIDTH + HEIGHT) * HW + MARGIN * 2;
  WORLD_H = (WIDTH + HEIGHT) * HH + TOP_PAD + EDGE + 60;
  OX = HEIGHT * HW + MARGIN;
  forestAt = measureForest();
  treeMap = trees = placeThings();
  worldImage = builtWorlds.get(name) || null;
  lastDraw = null;
  // The GPU lights what moves by the light baked for the place, where there is one.
  if (ctx.gpu) ctx.useLight(window.MAHTTE_LIGHTS?.[name] ?? null, `art/${name}/light.png`);
}

// Sun from the upper left, so shadows fall long to the lower right.
// A soft-edged patch of shade, made once for each size and then only copied: drawing it strip by strip was half the work of a frame.
const shadowPictures = new Map();
function castShadow(g, cx, cy, length, width) {
  if (g !== ctx) { // for a picture of the world made once, on its own pixels
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const half = Math.max(1, Math.round(width * Math.sin(Math.min(1, t * 1.15 + 0.12) * Math.PI) ** 0.7));
      g.fillRect(cx + i, Math.round(cy + i * 0.42 - half / 2), 1, half);
    }
    return;
  }
  const key = `${length}/${width}/${g.fillStyle}/${CANVAS_DETAIL}`;
  let picture = shadowPictures.get(key);
  if (!picture) {
    picture = document.createElement("canvas");
    picture.width = (length + 1) * CANVAS_DETAIL;
    picture.height = (Math.ceil(length * 0.42) + width + 2) * CANVAS_DETAIL;
    const p = picture.getContext("2d");
    p.fillStyle = g.fillStyle;
    p.scale(CANVAS_DETAIL, CANVAS_DETAIL);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const half = Math.max(1, Math.round(width * Math.sin(Math.min(1, t * 1.15 + 0.12) * Math.PI) ** 0.7));
      p.fillRect(i, Math.round(width / 2 + 1 + i * 0.42 - half / 2), 1, half);
    }
    shadowPictures.set(key, picture);
  }
  g.drawImage(picture, cx, cy - width / 2 - 1, picture.width / CANVAS_DETAIL, picture.height / CANVAS_DETAIL);
}

// ------------------------------------------------------------- building the world
function scatter(g, tx, ty) {
  const cx = isoX(tx, ty), cy = isoY(tx, ty) + HH;
  for (let i = 0; i < 5; i++) {
    const n = noise(tx * 7 + i * 13, ty * 5 + i);
    const x = cx - 11 + Math.floor(noise(tx + i, ty * 2 + 9) * 22);
    const y = cy - 5 + Math.floor(noise(tx * 2 + 3, ty + i) * 10);
    if (Math.abs(x - cx) / 16 + Math.abs(y - cy) / 8 > 0.9) continue;
    if (n < 0.45) { // grass tuft
      g.fillStyle = "#2f6232"; g.fillRect(x, y, 1, 3); g.fillRect(x + 2, y + 1, 1, 2);
      g.fillStyle = "#86c766"; g.fillRect(x + 1, y - 1, 1, 3);
    } else if (n < 0.62) { // flowers
      g.fillStyle = "#2f6232"; g.fillRect(x, y + 1, 1, 1);
      g.fillStyle = pick(["#f7f3e3", "#f4d35e", "#c9a0e8", "#f7f3e3"], noise(tx * 3, ty * 5 + i));
      g.fillRect(x, y, 1, 1);
    } else if (n < 0.7) { // a small stone with its shadow
      g.fillStyle = "rgba(10, 28, 44, 0.35)"; g.fillRect(x + 1, y + 2, 4, 1);
      g.fillStyle = "#7f8488"; g.fillRect(x, y, 4, 2);
      g.fillStyle = "#b5bbbf"; g.fillRect(x, y, 2, 1);
    } else if (n < 0.76) { // berries
      g.fillStyle = "#2c6a38"; g.fillRect(x, y, 3, 2);
      g.fillStyle = "#c8323f"; g.fillRect(x, y, 1, 1); g.fillRect(x + 2, y + 1, 1, 1);
    } else if (n < 0.83) { // a low shrub
      g.fillStyle = "rgba(10, 28, 44, 0.3)"; g.fillRect(x + 1, y + 3, 7, 1);
      g.fillStyle = "#2d6236"; g.fillRect(x, y, 7, 3);
      g.fillStyle = "#4a8f49"; g.fillRect(x + 1, y - 1, 4, 2);
      g.fillStyle = "#79b961"; g.fillRect(x + 1, y - 1, 2, 1);
    }
  }
}

function buildWorld() {
  const image = document.createElement("canvas");
  image.width = WORLD_W; image.height = WORLD_H;
  const g = image.getContext("2d");
  // Beyond the map: a dark forest or dark town, so the edge of the world never shows.
  g.fillStyle = placeName === "forest" || placeName === "camp" ? "#14302a" : placeName === "city" ? "#23262c" : "#191614";
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  if (placeName === "forest" || placeName === "camp") {
    const dark = outlined(30, 40, (d) => d.drawImage(PINES[1], 1, 0));
    const shade = dark.getContext("2d");
    shade.globalCompositeOperation = "source-atop";
    shade.fillStyle = "rgba(10, 34, 30, 0.82)";
    shade.fillRect(0, 0, 30, 40);
    for (let y = -20; y < WORLD_H; y += 13) for (let x = -20 + (y % 26 ? 11 : 0); x < WORLD_W; x += 22) g.drawImage(dark, x + Math.floor(noise(x, y) * 8), y);
  }

  for (let sum = 0; sum < WIDTH + HEIGHT; sum++) {
    for (let ty = 0; ty < HEIGHT; ty++) {
      const tx = sum - ty;
      if (tx < 0 || tx >= WIDTH) continue;
      const tile = MAP[ty][tx];
      if (tile === "_") continue;
      const eastEdge = tileOr(tx + 1, ty, "_") === "_", southEdge = tileOr(tx, ty + 1, "_") === "_";
      if (isWater(tile)) {
        diamond(g, tx, ty, WATER_DROP, (wx, wy, lx, ly) => waterPixel(tx, ty, wx, wy, lx, ly));
      } else {
        diamond(g, tx, ty, 0, tile === "p"
          ? (wx, wy, lx, ly) => pathPixel(tx, ty, wx, wy, lx, ly)
          : FLOORS[tile] || (BLOCK_TILES.has(tile) ? () => "#3a3a3a" : (wx, wy) => groundPixel(tx, ty, wx, wy)));
        const low = (t) => isWater(t);
        if (eastEdge || low(tileOr(tx + 1, ty, "g"))) bankFace(g, tx, ty, eastEdge ? EDGE : WATER_DROP, true);
        if (southEdge || low(tileOr(tx, ty + 1, "g"))) bankFace(g, tx, ty, southEdge ? EDGE : WATER_DROP, false);
        if (tile === "g" || tile === "t") scatter(g, tx, ty);
      }
    }
  }
  // Bridges sit at ground level over the water.
  for (let ty = 0; ty < HEIGHT; ty++) for (let tx = 0; tx < WIDTH; tx++) {
    if (MAP[ty][tx] !== "b") continue;
    const cx = isoX(tx, ty), top = isoY(tx, ty);
    g.fillStyle = "rgba(10, 28, 44, 0.45)";
    for (let i = 0; i < 14; i++) g.fillRect(cx - 12 + i, top + 12 + Math.floor(i / 2), 1, 3);
    diamond(g, tx, ty, 0, (wx, wy, lx, ly) => {
      const u = lx / TILE, v = ly / TILE;
      if (u < 0.14 || u > 0.86) return waterPixel(tx, ty, wx, wy, lx, ly);
      if (u < 0.2 || u > 0.8) return "#4a2e18";
      const plank = Math.floor(v * 5);
      const n = noise(wx, wy);
      if ((v * 5) % 1 < 0.14) return "#5c3a1e";
      return n > 0.8 ? "#8a5f35" : plank % 2 ? "#9b6b3a" : "#b5854f";
    });
  }
  // All cast shadows go on one layer first, so where they overlap they don't get darker.
  const layer = document.createElement("canvas");
  layer.width = WORLD_W; layer.height = WORLD_H;
  const s = layer.getContext("2d");
  s.fillStyle = SHADOW;
  for (const t of trees) {
    if (t.block) castShadow(s, t.x + 4, t.y - 2, 22, 12);
    else castShadow(s, t.x - 3, t.y, Math.round(t.image.height * 0.72), Math.round(t.image.width * 0.34));
  }
  g.globalAlpha = 0.34;
  g.drawImage(layer, 0, 0);
  g.globalAlpha = 1;
  builtWorlds.set(placeName, image);
  return image;
}

const houseImage = outlined(36, 40, (g) => {
  const cx = 17, cy = 36, wall = 11;
  const poly = (pts, colour) => {
    g.fillStyle = colour;
    const xs = pts.map((p) => p[0]);
    for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
      const at = x + 0.5, ys = [];
      pts.forEach(([x0, y0], i) => {
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((x0 <= at && at < x1) || (x1 <= at && at < x0)) ys.push(y0 + ((at - x0) / (x1 - x0)) * (y1 - y0));
      });
      if (ys.length >= 2) { const top = Math.round(Math.min(...ys)); g.fillRect(x, top, 1, Math.round(Math.max(...ys)) - top); }
    }
  };
  const peak = [cx + 7, cy - 3.5 - wall - 8], back = [peak[0] - 14, peak[1] - 7];
  poly([[peak[0] - 4, peak[1] - 8], [peak[0] - 1, peak[1] - 6.5], [peak[0] - 1, peak[1] + 1], [peak[0] - 4, peak[1]]], "#5c3a1e");
  poly([[cx - 14, cy - 7], [cx, cy], [cx, cy - wall], [cx - 14, cy - 7 - wall]], "#d9bb8c");
  for (let i = 1; i < 4; i++) poly([[cx - 14, cy - 7 - i * 3], [cx, cy - i * 3], [cx, cy - i * 3 - 0.8], [cx - 14, cy - 7 - i * 3 - 0.8]], "#bd9d6e"); // boards
  poly([[cx, cy], [cx + 14, cy - 7], [cx + 14, cy - 7 - wall], peak, [cx, cy - wall]], "#9d7f55");
  poly([[cx - 15, cy - 7 - wall - 0.5], [cx - 1, cy - wall + 0.5], peak, back], "#bb2a2d");
  for (let i = 1; i < 4; i++) poly([[cx - 15 + i * 2, cy - 7 - wall - i * 2], [cx - 1 + i * 2, cy - wall - i * 2], [cx - 1 + i * 2, cy - wall - i * 2 - 0.8], [cx - 15 + i * 2, cy - 7 - wall - i * 2 - 0.8]], "#962226"); // roof rows
  poly([back, peak, [peak[0] - 1, peak[1] + 2], [back[0] - 1, back[1] + 2]], "#e44c3b");
  poly([[cx + 5, cy - 2], [cx + 9, cy - 4], [cx + 9, cy - 12], [cx + 5, cy - 10]], "#4a2e18");
  poly([[cx - 11, cy - 11], [cx - 7, cy - 9], [cx - 7, cy - 13], [cx - 11, cy - 15]], "#8fd3ff");
  poly([[cx - 5, cy - 8], [cx - 1, cy - 6], [cx - 1, cy - 10], [cx - 5, cy - 12]], "#8fd3ff");
});

const cam = { x: 0, y: 0, lookX: 0, lookY: 0 };
const CAMERA = { followMs: 260, ahead: 16, aheadMs: 420 };
let worldImage = null;
let lastDraw = null;

// At a lesson nobody walks, so the view stays where the board and all the desks can be seen.
const LESSON_VIEW = { x: 20, y: 101 };
function placeCamera() {
  if (placeName === "lesson") {
    cam.x = OX + LESSON_VIEW.x - VIEW_W / 2;
    cam.y = TOP_PAD + LESSON_VIEW.y - VIEW_H / 2;
    return;
  }
  cam.x = isoX(me.x, me.y) - VIEW_W / 2;
  cam.y = isoY(me.x, me.y) - 14 - VIEW_H / 2;
}

// Fills a shape pixel by pixel, keeping its edges hard.
const fillShape = (points, colour) => fillShapeOn(ctx, points, colour);

function fillShapeOn(g, points, colour) {
  g.fillStyle = colour;
  const xs = points.map((p) => p[0]);
  for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
    const at = x + 0.5, ys = [];
    points.forEach(([x0, y0], i) => {
      const [x1, y1] = points[(i + 1) % points.length];
      if ((x0 <= at && at < x1) || (x1 <= at && at < x0)) ys.push(y0 + ((at - x0) / (x1 - x0)) * (y1 - y0));
    });
    if (ys.length >= 2) {
      const top = Math.round(Math.min(...ys));
      g.fillRect(x, top, 1, Math.max(1, Math.round(Math.max(...ys)) - top));
    }
  }
}

// ------------------------------------------------------------- parked vehicles
// Drawn from the same angle as the world, as boxes in tile units. x is across the bay and y along it, with the nose
// at the far end of the bay, so the back and the right side are what can be seen; the truck, fire engine and tractor face out. Sizes are in VEHICLES in game.js.
const VEHICLE_ANCHOR = { x: 60, y: 62 };
// A vehicle's shadow on the ground in the sun, from its model in src/models.js: for each point of the ground round it, whether the model
// is in the way of the sun. Made once for each kind, at three times the world's detail and softened at its edge, and laid down as a
// shadow by the GPU.
// left and top: where it goes from the vehicle's middle on the ground, in the world's pixels.
const vehicleShadows = new Map();
function vehicleShadow(sprite, sun) {
  const key = `${sprite}/${sun.join()}`;
  if (vehicleShadows.has(key)) return vehicleShadows.get(key);
  const shapes = MODELS[sprite]?.(0, "grey");
  if (!shapes?.[0]?.kind) return null;
  const bounds = shapes.map(shapeBounds);
  const lo = [0, 1, 2].map((i) => Math.min(...bounds.map((b) => b[0][i]))), hi = [0, 1, 2].map((i) => Math.max(...bounds.map((b) => b[1][i])));
  const [sx, sy, sz] = sun, along = hi[2] / sz; // how far to look towards the sun from the ground, to clear the top
  // On the screen: the footprint, and the same where its top's shadow falls.
  const corners = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [0, hi[2]]) {
    const gx = x - (sx / sz) * z, gy = y - (sy / sz) * z;
    corners.push([gx - gy, (gx + gy) / 2]);
  }
  const DETAIL = 3, SOFT = 2; // how many of its pixels its edge is softened over
  const left = Math.floor(Math.min(...corners.map((c) => c[0]))) - 2, top = Math.floor(Math.min(...corners.map((c) => c[1]))) - 2;
  const w = (Math.ceil(Math.max(...corners.map((c) => c[0]))) + 2 - left) * DETAIL, h = (Math.ceil(Math.max(...corners.map((c) => c[1]))) + 2 - top) * DETAIL;
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const g = canvas.getContext("2d");
  const image = g.createImageData(w, h);
  const distance = (p) => Math.min(...shapes.map((shape) => shapeDistance(shape, p)));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = left + (i + 0.5) / DETAIL, v = top + (j + 0.5) / DETAIL;
    const x0 = v + u / 2, y0 = v - u / 2;
    // Only where the ray towards the sun passes through the model's box.
    let t0 = 0, t1 = along;
    for (const [o, d, a, b] of [[x0, sx, lo[0], hi[0]], [y0, sy, lo[1], hi[1]], [0, sz, lo[2], hi[2]]]) {
      if (Math.abs(d) < 1e-6) { if (o < a || o > b) t1 = -1; continue; }
      const ta = (a - o) / d, tb = (b - o) / d;
      t0 = Math.max(t0, Math.min(ta, tb));
      t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t1 < t0) continue;
    for (let t = t0, k = 0; t <= t1 && k < 48; k++) {
      const d = distance([x0 + sx * t, y0 + sy * t, sz * t]);
      if (d < 0.15) { image.data[(j * w + i) * 4 + 3] = 255; break; }
      t += Math.max(d, 0.25);
    }
  }
  // A soft edge: the shadow blurred a little, across and then down.
  const a = new Float32Array(w * h), b = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) a[k] = image.data[k * 4 + 3];
  const blur = (from, to, step, count, stride) => {
    for (let line = 0; line < count; line++) for (let i = 0; i < (step === 1 ? w : h); i++) {
      let sum = 0, n = 0;
      for (let k = -SOFT; k <= SOFT; k++) {
        const at = i + k;
        if (at < 0 || at >= (step === 1 ? w : h)) continue;
        sum += from[line * stride + at * step];
        n++;
      }
      to[line * stride + i * step] = sum / n;
    }
  };
  blur(a, b, 1, h, w);
  blur(b, a, w, w, 1);
  for (let k = 0; k < w * h; k++) image.data[k * 4 + 3] = Math.round(a[k]);
  g.putImageData(image, 0, 0);
  Object.assign(canvas, { detail: DETAIL, left, top });
  vehicleShadows.set(key, canvas);
  return canvas;
}

function drawVehicleBoxes(g, sprite, colour) {
  const [mid, dark, light] = [COLOURS[colour][1], COLOURS[colour][2], COLOURS[colour][3]];
  const point = (x, y, z) => [VEHICLE_ANCHOR.x + (x - y) * HW, VEHICLE_ANCHOR.y + (x + y) * HH - z];
  const shape = (points, fill) => fillShapeOn(g, points, fill);
  const top = (x0, x1, y0, y1, z, fill) => shape([point(x0, y0, z), point(x1, y0, z), point(x1, y1, z), point(x0, y1, z)], fill);
  const right = (x, y0, y1, z0, z1, fill) => shape([point(x, y1, z0), point(x, y0, z0), point(x, y0, z1), point(x, y1, z1)], fill);
  const back = (y, x0, x1, z0, z1, fill) => shape([point(x0, y, z0), point(x1, y, z0), point(x1, y, z1), point(x0, y, z1)], fill);
  const box = (x0, x1, y0, y1, z0, z1, topFill = light, backFill = mid, rightFill = dark) => {
    right(x1, y0, y1, z0, z1, rightFill);
    back(y1, x0, x1, z0, z1, backFill);
    top(x0, x1, y0, y1, z1, topFill);
  };
  const GLASS = "#8fc8e8", GLASS_DARK = "#5a90b0", TYRE = "#24242c", HUB = "#8d95a3", LAMP = "#e0342c", LIGHT = "#f2c14e", STEEL_LINE = "#8d95a3";
  // A wheel on the visible side; the far one shows under the back.
  const wheel = (x, y, size) => {
    right(x, y - size, y + size, 0, size * 22, TYRE);
    right(x, y - size * 0.4, y + size * 0.4, size * 7, size * 14, HUB);
  };
  if (sprite === "car" || sprite === "taxi") {
    box(-0.38, 0.38, -0.72, 0.72, 2, 7);
    box(-0.32, 0.32, -0.3, 0.46, 7, 12, light, GLASS, GLASS_DARK);
    right(0.32, -0.08, -0.04, 7, 12, dark); // the pillar between the windows
    top(-0.32, 0.32, -0.3, 0.46, 12, light);
    back(0.72, -0.3, -0.17, 4, 6, LAMP);
    back(0.72, 0.17, 0.3, 4, 6, LAMP);
    back(0.72, -0.1, 0.1, 3, 5, "#eeeee6");
    wheel(0.38, -0.42, 0.14);
    wheel(0.38, 0.42, 0.14);
    if (sprite === "taxi") box(-0.14, 0.14, 0, 0.14, 12, 15, LIGHT, LIGHT, "#c99a28");
  } else if (sprite === "ambulance") {
    box(-0.41, 0.41, -0.8, 0.83, 2, 16);
    right(0.41, -0.8, 0.83, 7, 10, "#d13a30");
    right(0.41, -0.68, -0.34, 11, 15, GLASS_DARK);
    back(0.83, -0.41, 0.41, 7, 10, "#d13a30");
    back(0.83, -0.32, -0.04, 11, 15, GLASS);
    back(0.83, 0.04, 0.32, 11, 15, GLASS);
    back(0.83, -0.38, -0.26, 4, 6, LAMP);
    back(0.83, 0.26, 0.38, 4, 6, LAMP);
    box(-0.2, 0.2, -0.4, -0.26, 16, 18, "#4a8fe0", "#2f6fc2", "#1f4a8a");
    wheel(0.41, -0.48, 0.14);
    wheel(0.41, 0.5, 0.14);
  } else if (sprite === "firetruck") {
    // Reversed in with the cab facing out, like the truck, and a ladder along the roof.
    const METAL = "#44444e", STEEL = "#c6cad0";
    box(-0.3, 0.3, -0.9, 0.9, 1, 5, METAL, METAL, "#2c2c36");
    box(-0.42, 0.42, -0.95, 0.3, 5, 18);
    right(0.42, -0.95, 0.3, 10, 12, "#f2c14e");
    for (const y of [-0.7, -0.3]) right(0.42, y, y + 0.28, 13, 16, STEEL);
    box(-0.2, -0.14, -0.9, 0.42, 18, 20, STEEL, STEEL, "#9a9ea6");
    box(0.14, 0.2, -0.9, 0.42, 18, 20, STEEL, STEEL, "#9a9ea6");
    for (let y = -0.82; y < 0.38; y += 0.2) box(-0.14, 0.14, y, y + 0.04, 19, 20, STEEL, STEEL, "#9a9ea6");
    box(-0.4, 0.4, 0.38, 0.95, 4, 18);
    right(0.4, 0.38, 0.95, 7, 8, "#f2c14e");
    back(0.95, -0.4, 0.4, 7, 8, "#f2c14e");
    back(0.95, -0.34, 0.34, 10, 16, GLASS);
    right(0.4, 0.5, 0.86, 10, 16, GLASS_DARK);
    back(0.95, -0.36, -0.22, 5, 7, "#fff3b0");
    back(0.95, 0.22, 0.36, 5, 7, "#fff3b0");
    back(0.95, -0.42, 0.42, 3, 5, METAL);
    box(-0.2, 0.2, 0.58, 0.72, 18, 20, "#4a8fe0", "#2f6fc2", "#1f4a8a");
    wheel(0.42, -0.62, 0.14);
    wheel(0.42, -0.28, 0.14);
    wheel(0.42, 0.66, 0.14);
  } else if (sprite === "van") {
    box(-0.39, 0.39, -0.48, 0.78, 2, 14);
    box(-0.37, 0.37, -0.78, -0.48, 2, 8);
    right(0.39, -0.44, -0.12, 8, 13, GLASS_DARK);
    back(0.78, -0.3, 0.3, 8, 13, GLASS);
    back(0.78, -0.02, 0.02, 3, 14, dark);
    back(0.78, -0.37, -0.25, 4, 6, LAMP);
    back(0.78, 0.25, 0.37, 4, 6, LAMP);
    wheel(0.39, -0.48, 0.14);
    wheel(0.39, 0.44, 0.14);
  } else if (sprite === "snowmobile") {
    // Skis at the front, the track under a long seat at the back.
    box(-0.22, -0.12, -0.6, -0.14, 0, 1, "#2c2c36", "#2c2c36", "#22222c");
    box(0.12, 0.22, -0.6, -0.14, 0, 1, "#2c2c36", "#2c2c36", "#22222c");
    box(-0.16, 0.16, 0, 0.58, 0, 4, "#2c2c36", "#2c2c36", "#22222c");
    box(-0.2, 0.2, -0.46, 0.06, 2, 8);
    box(-0.15, 0.15, -0.4, -0.3, 8, 13, light, GLASS, GLASS);
    box(-0.15, 0.15, 0.02, 0.56, 4, 9, "#2c2c36", "#44444e", "#22222c");
    back(0.56, -0.1, 0.1, 5, 7, LAMP);
  } else if (sprite === "trailer") {
    box(-0.04, 0.04, -0.74, -0.2, 3, 4, "#2c2c36", "#2c2c36", "#22222c");
    box(-0.35, 0.35, -0.3, 0.72, 3, 5, dark, dark, dark);
    box(-0.35, -0.29, -0.3, 0.72, 5, 9);
    box(-0.35, 0.35, -0.3, -0.24, 5, 9);
    box(0.29, 0.35, -0.3, 0.72, 5, 9);
    box(-0.35, 0.35, 0.66, 0.72, 5, 9);
    back(0.72, -0.33, -0.21, 6, 8, LAMP);
    back(0.72, 0.21, 0.33, 6, 8, LAMP);
    wheel(0.35, 0.18, 0.14);
  } else if (sprite === "truck") {
    // Reversed into the bay, as a truck is what shows it best: the cab with its windscreen faces the viewer, and
    // the taller load box stands behind it on a dark chassis.
    const METAL = "#44444e";
    box(-0.3, 0.3, -0.9, 0.9, 1, 5, METAL, METAL, "#2c2c36");
    box(-0.42, 0.42, -0.95, 0.26, 5, 24);
    for (const y of [-0.66, -0.34, -0.02]) right(0.42, y, y + 0.04, 6, 23, mid);
    right(0.42, -0.95, 0.26, 21, 22, light);
    box(-0.4, 0.4, 0.36, 0.95, 4, 18);
    back(0.95, -0.34, 0.34, 10, 16, GLASS);
    right(0.4, 0.5, 0.86, 10, 16, GLASS_DARK);
    back(0.95, -0.17, 0.17, 6, 9, "#2c2c36");
    back(0.95, -0.36, -0.22, 6, 8, "#fff3b0");
    back(0.95, 0.22, 0.36, 6, 8, "#fff3b0");
    back(0.95, -0.42, 0.42, 3, 5, METAL);
    box(0.4, 0.47, 0.9, 0.95, 11, 16, METAL, METAL, METAL);
    wheel(0.42, -0.62, 0.14);
    wheel(0.42, -0.28, 0.14);
    wheel(0.42, 0.66, 0.14);
  } else if (sprite === "bus") {
    box(-0.42, 0.42, -0.96, 0.96, 2, 17);
    for (let y = -0.82; y < 0.82; y += 0.36) right(0.42, y, y + 0.28, 9, 14, GLASS_DARK);
    right(0.42, -0.96, 0.96, 6, 7, "#eeeee6");
    back(0.96, -0.36, 0.36, 9, 15, GLASS);
    back(0.96, -0.38, -0.24, 4, 6, LAMP);
    back(0.96, 0.24, 0.38, 4, 6, LAMP);
    wheel(0.42, -0.58, 0.14);
    wheel(0.42, 0.58, 0.14);
  } else if (sprite === "tractor") {
    // Reversed in like the truck: the narrow hood and small front wheels face out, the huge round rear wheels and the
    // glass cab behind them. A wheel is round in the side plane, r pixels tall and wide across x0 to x1.
    const METAL = "#44444e";
    const disc = (x, y, z, r, fill) => shape(Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      return point(x, y + (Math.cos(angle) * r) / 18, z + Math.sin(angle) * r);
    }), fill);
    const roundWheel = (x0, x1, y, r) => {
      for (let x = x0; x < x1; x += 0.02) disc(x, y, r, r, "#1a1a22");
      disc(x1, y, r, r, TYRE);
      disc(x1, y, r, r * 0.62, light);
      disc(x1, y, r, r * 0.42, mid);
      disc(x1, y, r, r * 0.16, METAL);
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2, dy = Math.cos(angle) / 18, dz = Math.sin(angle);
        shape([point(x1, y + dy * r, r + dz * r), point(x1, y + dy * r * 0.82, r + dz * r * 0.82), point(x1, y + (dy * r * 0.82) + 0.04, r + dz * r * 0.82), point(x1, y + dy * r + 0.04, r + dz * r)], "#3a3a44");
      }
    };
    roundWheel(-0.46, -0.3, -0.34, 10);
    roundWheel(-0.25, -0.17, 0.5, 5);
    box(-0.2, 0.2, -0.62, -0.08, 4, 11);
    box(-0.1, 0.1, -0.08, 0.68, 4, 7, METAL, METAL, "#2c2c36");
    box(-0.16, 0.16, -0.1, 0.72, 7, 13);
    right(0.16, 0.05, 0.6, 9, 10, dark);
    back(0.72, -0.12, 0.12, 8, 12, "#2c2c36");
    for (let z = 9; z < 12; z += 1.5) back(0.72, -0.12, 0.12, z, z + 0.5, STEEL_LINE);
    back(0.72, -0.16, -0.12, 10, 12, "#fff3b0");
    back(0.72, 0.12, 0.16, 10, 12, "#fff3b0");
    box(0.07, 0.11, 0.3, 0.34, 13, 22, METAL, METAL, "#2c2c36");
    box(0.06, 0.12, 0.29, 0.35, 21, 23, "#2c2c36", "#2c2c36", "#22222c");
    box(-0.25, 0.25, -0.58, -0.04, 11, 22, light, GLASS, GLASS_DARK);
    right(0.25, -0.33, -0.29, 11, 22, dark);
    back(-0.04, -0.03, 0.03, 11, 22, dark);
    right(0.25, -0.58, -0.54, 11, 22, dark);
    right(0.25, -0.08, -0.04, 11, 22, dark);
    box(-0.29, 0.29, -0.62, 0, 22, 24, light, mid, dark);
    box(0.24, 0.42, -0.62, -0.06, 19.5, 21, light, mid, dark);
    roundWheel(0.17, 0.25, 0.5, 5);
    roundWheel(0.3, 0.46, -0.34, 10);
  } else if (sprite === "moto") {
    wheel(0.04, -0.42, 0.15);
    box(-0.1, 0.1, -0.3, 0.3, 4, 9);
    box(-0.08, 0.08, 0.02, 0.32, 9, 11, "#2c2c36", "#2c2c36", "#2c2c36");
    box(-0.13, 0.13, -0.38, -0.32, 9, 15, "#44444e", GLASS, GLASS);
    wheel(0.04, 0.42, 0.15);
    back(0.3, -0.06, 0.06, 6, 8, LAMP);
  } else if (sprite === "bike") {
    wheel(0.02, -0.34, 0.15);
    right(0.02, -0.3, 0.34, 6, 7, mid);
    right(0.02, -0.22, 0.14, 3, 4, mid);
    right(0.02, 0.1, 0.16, 3, 9, mid);
    right(0.02, -0.26, -0.2, 3, 11, mid);
    box(-0.04, 0.04, 0.06, 0.22, 9, 10, "#2c2c36", "#2c2c36", "#2c2c36");
    box(-0.14, 0.14, -0.28, -0.24, 11, 12, "#44444e", "#44444e", "#44444e");
    wheel(0.02, 0.34, 0.15);
  }
}

const vehicleImages = new Map();
function vehicleImage(sprite, colour) {
  const key = `${sprite}/${colour}`;
  if (!vehicleImages.has(key)) vehicleImages.set(key, outlined(120, 90, (g) => drawVehicleBoxes(g, sprite, colour)));
  return vehicleImages.get(key);
}

// ------------------------------------------------------------- animals
// Models from animals.js at the world's angle. The far faces are hidden, the top is lit and the right is in shadow.
const MODEL_ANCHOR = { x: 60, y: 60 };
const MODEL_FACINGS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // the way each of the four faces on the map

function shaded(colour, amount) {
  const value = parseInt(colour.slice(1), 16);
  const part = (shift) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * amount)));
  return `rgb(${part(16)}, ${part(8)}, ${part(0)})`;
}

// Each box after everything it stands in front of. A box's middle isn't enough for thin things such as eyes.
function inDrawingOrder(boxes) {
  const behind = (a, b) => a.x1 <= b.x0 || a.y1 <= b.y0 || a.z1 <= b.z0;
  const before = (a, b) => behind(a, b) && !behind(b, a);
  const depth = (b) => (b.x0 + b.x1 + b.y0 + b.y1) / 4 + (b.z0 + b.z1) / 2;
  const left = [...boxes].sort((a, b) => depth(a) - depth(b));
  const order = [];
  while (left.length) {
    const next = Math.max(0, left.findIndex((box) => !left.some((other) => other !== box && before(other, box))));
    order.push(left.splice(next, 1)[0]);
  }
  return order;
}

// Flat wings that fold upwards from the body, always raised a little so their shape shows from this angle.
function drawButterflyWings(g, point, [fx, fy], frame) {
  const tipHeight = [3.5, 7, 11][frame];
  const size = 1.4;
  const wingPoint = (side, x, y) => {
    const z = 0.5 + (x / 5) * tipHeight;
    return point(side * x * size * fy + y * size * fx, y * size * fy - side * x * size * fx, z);
  };
  const shape = (side, corners, colour) => fillShapeOn(g, corners.map(([x, y]) => wingPoint(side, x, y)), colour);
  for (const side of [-1, 1]) {
    shape(side, [[0.3, 0], [3.2, -0.6], [3, -3.2], [0.3, -2]], "#f2c14e");
    shape(side, [[0.3, 2.2], [4, 3.6], [5, 1], [0.3, 0]], "#ee8f2e");
    shape(side, [[3.9, 3.5], [5, 1], [4.4, 1], [3.5, 3]], "#6b3a1e");
    shape(side, [[1.8, 1.6], [2.8, 2], [3, 1.2], [2, 1]], "#ffe680");
  }
}

// A shape as built facing +y, turned to face another way on the map.
function turnedShape(shape, [fx, fy]) {
  const turn = ([x, y, z]) => [x * fy + y * fx, y * fy - x * fx, z];
  const turned = { ...shape, turn: [fx, fy] };
  if (shape.kind === "ball") {
    turned.at = turn(shape.at);
    const [rx, ry, rz] = shape.radii;
    turned.radii = fx ? [ry, rx, rz] : [rx, ry, rz];
  } else if (shape.kind === "tube") {
    turned.from = turn(shape.from);
    turned.to = turn(shape.to);
  } else {
    const a = turn(shape.low), b = turn(shape.high);
    turned.low = a.map((v, i) => Math.min(v, b[i]));
    turned.high = a.map((v, i) => Math.max(v, b[i]));
  }
  return turned;
}

// The corners of the box a shape fits in, to skip looking at pixels it can't reach.
function shapeBounds(shape) {
  if (shape.kind === "ball") return [shape.at.map((v, i) => v - shape.radii[i]), shape.at.map((v, i) => v + shape.radii[i])];
  if (shape.kind === "box") return [shape.low, shape.high];
  const r = Math.max(shape.r0, shape.r1);
  return [shape.from.map((v, i) => Math.min(v, shape.to[i]) - r), shape.from.map((v, i) => Math.max(v, shape.to[i]) + r)];
}

// How far a point is from a smooth shape, negative inside it.
function shapeDistance(shape, [px, py, pz]) {
  let d;
  if (shape.kind === "ball") {
    const [cx, cy, cz] = shape.at, [rx, ry, rz] = shape.radii;
    const x = px - cx, y = py - cy, z = pz - cz;
    const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    d = k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  } else if (shape.kind === "tube") {
    const [ax, ay, az] = shape.from, [bx, by, bz] = shape.to;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const along = Math.max(0, Math.min(1, ((px - ax) * ux + (py - ay) * uy + (pz - az) * uz) / (ux * ux + uy * uy + uz * uz)));
    d = Math.hypot(px - ax - ux * along, py - ay - uy * along, pz - az - uz * along) - (shape.r0 + (shape.r1 - shape.r0) * along);
  } else {
    const q = [px, py, pz].map((v, i) => Math.abs(v - (shape.low[i] + shape.high[i]) / 2) - (shape.high[i] - shape.low[i]) / 2 + shape.r);
    d = Math.hypot(...q.map((v) => Math.max(v, 0))) + Math.min(Math.max(...q), 0) - shape.r;
  }
  for (const [nx, ny, nz, k] of shape.cuts || []) d = Math.max(d, px * nx + py * ny + pz * nz - k);
  for (const [hx, hy, hz, r] of shape.holes || []) d = Math.max(d, r - Math.hypot(px - hx, py - hy, pz - hz));
  return d;
}

const MODEL_LIGHT = (() => {
  const [x, y, z] = [-0.35, 0.45, 0.82];
  const size = Math.hypot(x, y, z);
  return [x / size, y / size, z / size];
})();

// Looks at each pixel along the world's viewing angle until it meets a shape, and lights it in a few flat bands,
// which is what keeps it looking like pixel art. Slow, but done once for each thing and then kept.
function* roundModelRows(g, shapes, detail) {
  const distance = (p) => Math.min(...shapes.map((shape) => shapeDistance(shape, p)));
  const bounds = shapes.map(shapeBounds);
  const left = Math.floor(Math.min(...bounds.map(([low, high]) => low[0] - high[1]))) + MODEL_ANCHOR.x - 1;
  const right = Math.ceil(Math.max(...bounds.map(([low, high]) => high[0] - low[1]))) + MODEL_ANCHOR.x + 1;
  const top = Math.floor(Math.min(...bounds.map(([low, high]) => (low[0] + low[1]) / 2 - high[2]))) + MODEL_ANCHOR.y - 1;
  const bottom = Math.ceil(Math.max(...bounds.map(([low, high]) => (high[0] + high[1]) / 2 - low[2]))) + MODEL_ANCHOR.y + 1;
  const fine = (edge) => edge * detail;
  for (let py = Math.max(0, fine(top)); py < Math.min(g.canvas.height, fine(bottom)); py++) {
    yield; // a row at a time, for pictures made bit by bit while the game runs
    for (let px = Math.max(0, fine(left)); px < Math.min(g.canvas.width, fine(right)); px++) {
    const sx = (px + 0.5) / detail - MODEL_ANCHOR.x, sy = (py + 0.5) / detail - MODEL_ANCHOR.y;
    const x0 = sy + sx / 2, y0 = sy - sx / 2;
    let t = 40, hit = null;
    for (let step = 0; step < 70 && t > -40; step++) {
      const p = [x0 + t, y0 + t, t];
      const d = distance(p);
      if (d < 0.03) {
        hit = p;
        break;
      }
      t -= d / Math.sqrt(3);
    }
    if (!hit) continue;
    const shape = shapes.reduce((a, b) => (shapeDistance(a, hit) <= shapeDistance(b, hit) ? a : b));
    const e = 0.08;
    const n = [0, 1, 2].map((i) => {
      const up = [...hit], down = [...hit];
      up[i] += e;
      down[i] -= e;
      return distance(up) - distance(down);
    });
    const size = Math.hypot(...n) || 1;
    const lit = (n[0] * MODEL_LIGHT[0] + n[1] * MODEL_LIGHT[1] + n[2] * MODEL_LIGHT[2]) / size;
    const inHole = shape.holes?.some(([hx, hy, hz, r]) => Math.hypot(hit[0] - hx, hit[1] - hy, hit[2] - hz) < r + 0.15);
    // A painted pattern is laid out on the model as built, so it turns with it.
    const [fx, fy] = shape.turn;
    const built = [hit[0] * fy - hit[1] * fx, hit[1] * fy + hit[0] * fx, hit[2]];
    const colour = inHole ? "#c9992e" : shape.paint ? shape.paint(built) : shape.colour;
    g.fillStyle = shaded(colour, lit > 0.82 ? 1.14 : lit > 0.45 ? 1 : lit > 0.05 ? 0.84 : 0.68);
    g.fillRect(px, py, 1, 1);
    }
  }
}

function drawRoundModel(g, shapes, detail = 1) {
  const rows = roundModelRows(g, shapes, detail);
  while (!rows.next().done);
}

function drawModel(g, sprite, facing, frame, headFacing, colour, detail = 1) {
  const parts = MODELS[sprite](frame, colour);
  if (parts[0].kind) {
    drawRoundModel(g, parts.map((shape) => turnedShape(shape, MODEL_FACINGS[shape.head ? headFacing : facing])), detail);
    return;
  }
  g.save();
  g.scale(detail, detail);
  // Turns a box from facing +y to the way the animal, or its head, faces.
  const turned = parts.map(([x0, x1, y0, y1, z0, z1, colour, isHead]) => {
    const [fx, fy] = MODEL_FACINGS[isHead ? headFacing : facing];
    const xs = [x0 * fy + y0 * fx, x1 * fy + y1 * fx], ys = [y0 * fy - x0 * fx, y1 * fy - x1 * fx];
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0, z1, colour };
  });
  const point = (x, y, z) => [MODEL_ANCHOR.x + x - y, MODEL_ANCHOR.y + (x + y) / 2 - z];
  if (sprite === "beaiveloddi") drawButterflyWings(g, point, MODEL_FACINGS[facing], frame);
  for (const { x0, x1, y0, y1, z0, z1, colour } of inDrawingOrder(turned)) {
    fillShapeOn(g, [point(x1, y1, z0), point(x1, y0, z0), point(x1, y0, z1), point(x1, y1, z1)], shaded(colour, 0.72));
    fillShapeOn(g, [point(x0, y1, z0), point(x1, y1, z0), point(x1, y1, z1), point(x0, y1, z1)], shaded(colour, 0.92));
    fillShapeOn(g, [point(x0, y0, z1), point(x1, y0, z1), point(x1, y1, z1), point(x0, y1, z1)], shaded(colour, 1.1));
  }
  g.restore();
}

const modelImages = new Map();
// These places are drawn at double detail, so that things are easier to recognize.
const DETAIL_PLACES = { home: FOREST_DETAIL, forest: FOREST_DETAIL, city: FOREST_DETAIL, library: FOREST_DETAIL, store: FOREST_DETAIL, gearstore: FOREST_DETAIL, camp: 2, classroom: FOREST_DETAIL, lesson: FOREST_DETAIL };
let viewDetail = 1;
// The characters are finer than the things around them, so the canvas has room for them, as far as the screen can show it.
// More would only be work for the browser to shrink again.
let CANVAS_DETAIL = 4;
let mostDetail = 4; // comes down if this device can't keep up
// With room for it, the game is sized in whole steps, so that each of its pixels is exactly one or two of the screen's and nothing is blurred:
// how many screen pixels to each of the world's, largest first, and how fine the picture is drawn for that.
const SCREEN_STEPS = [[4, 4], [3, 3], [2, 2], [1, 2]];
let screenStep = 0;
// In these places the window shows more of the world instead of a bigger picture of it: this many screen pixels to each of the world's.
const WIDE_VIEW_PLACES = new Set(["store", "classroom", "forest", "library", "home", "city", "gearstore"]);
const ZOOMS = [1, 2, 3, 4];
// The forest only close up: further out, its animals are too small to find.
const PLACE_ZOOMS = { forest: [3, 4] };
const zoomsIn = (place) => PLACE_ZOOMS[place] ?? ZOOMS;
let viewPlace = null;
const MOST_PIXELS = { x: 1920, y: 1080 }; // the game window is never larger than this, whatever the screen, and nothing beyond it is drawn
// 3× to begin with, and then whatever was last chosen in that place.
const ZOOM_FIRST = 3;
let VIEW_ZOOM = ZOOM_FIRST;
function keptZoom(place) {
  try {
    const kept = Number(localStorage.getItem(`mahtte.zoom.${place}`));
    if (zoomsIn(place).includes(kept)) return kept;
  } catch {
    // Private windows may refuse; it just starts from the usual zoom.
  }
  return ZOOM_FIRST;
}
const zoomButtons = document.getElementById("zoom");
function showZoom() {
  for (const button of zoomButtons.children) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.zoom) === VIEW_ZOOM));
    button.hidden = !zoomsIn(viewPlace).includes(Number(button.dataset.zoom));
  }
}
showZoom();
zoomButtons.addEventListener("click", (event) => {
  const zoom = Number(event.target.dataset?.zoom);
  if (!zoom || !zoomsIn(viewPlace).includes(zoom)) return;
  VIEW_ZOOM = zoom;
  mostDetail = 4; // a finer view may be just what this device can do, and a coarser one is measured again
  try {
    localStorage.setItem(`mahtte.zoom.${viewPlace}`, String(zoom));
  } catch {
    // It still holds for this visit.
  }
  showZoom();
  fitCanvas();
  placeCamera();
  event.target.blur(); // so that the keys go on moving the character
});
function chooseCanvasDetail() {
  const ratio = window.devicePixelRatio || 1;
  VIEW_W = BASE_VIEW_W;
  VIEW_H = BASE_VIEW_H;
  if (window.innerWidth >= 700 && !document.body.classList.contains("menu")) {
    // Room for the game and everything else on the page too, the links under it among them, so that nothing needs scrolling to.
    const view = canvas.parentElement, page = view?.closest("main");
    const around = page ? Math.max(24, Math.ceil(page.getBoundingClientRect().height - view.getBoundingClientRect().height)) : 24;
    const roomX = Math.min(window.innerWidth - 32, MOST_PIXELS.x), roomY = Math.min(window.innerHeight - around, MOST_PIXELS.y);
    let step, detail;
    if (WIDE_VIEW_PLACES.has(viewPlace)) {
      step = detail = VIEW_ZOOM;
      VIEW_W = Math.floor(roomX / step);
      VIEW_H = Math.floor(roomY / step);
    } else {
      [step, detail] = SCREEN_STEPS.find(([size]) => size <= Math.min(roomX / VIEW_W, roomY / VIEW_H)) ?? SCREEN_STEPS.at(-1);
    }
    screenStep = step;
    zoomButtons.hidden = !WIDE_VIEW_PLACES.has(viewPlace);
    document.documentElement.style.setProperty("--game", `${VIEW_W * step}px`);
    CANVAS_DETAIL = Math.min(mostDetail, detail);
  } else {
    screenStep = 0;
    zoomButtons.hidden = true;
    document.documentElement.style.removeProperty("--game");
    const wide = canvas.parentElement?.clientWidth || Math.min(window.innerWidth, 720);
    CANVAS_DETAIL = Math.max(2, Math.min(mostDetail, Math.ceil((wide * ratio) / VIEW_W)));
  }
  canvas.classList.toggle("crisp", screenStep > CANVAS_DETAIL); // stretched to fit, so kept hard-edged rather than smeared
}

function fitCanvas() {
  chooseCanvasDetail();
  if (canvas.width !== VIEW_W * CANVAS_DETAIL || canvas.height !== VIEW_H * CANVAS_DETAIL) {
    canvas.width = VIEW_W * CANVAS_DETAIL;
    canvas.height = VIEW_H * CANVAS_DETAIL;
  }
}
// Looked at with every frame rather than waiting to be told, so that the game never stays larger than the window.
let fittedTo = "";
function keepFitted() {
  const size = `${window.innerWidth}x${window.innerHeight}`;
  if (size === fittedTo) return;
  fittedTo = size;
  fitCanvas();
}

// A slow device gets a finer picture only as long as it can draw it smoothly: after a few seconds well under this rate, one step coarser, for the rest of the visit.
const SMOOTH = { fps: 50, afterMs: 4000, gapMs: 250 }; // the aim is a steady 60
let smoothFrom = 0, smoothFrames = 0, smoothLast = 0;
function keepItSmooth(now) {
  if (now - smoothLast > SMOOTH.gapMs) { // away from the tab, or something being loaded: that's no measure
    smoothFrom = now;
    smoothFrames = 0;
  }
  smoothLast = now;
  smoothFrames++;
  if (now - smoothFrom < SMOOTH.afterMs) return;
  if (CANVAS_DETAIL > 2 && (smoothFrames * 1000) / (now - smoothFrom) < SMOOTH.fps) {
    // Half the size if it divides evenly, as each pixel then is exactly two of the screen's.
    mostDetail = screenStep && screenStep % 2 === 0 && CANVAS_DETAIL > screenStep / 2 ? screenStep / 2 : CANVAS_DETAIL === 3 ? 2 : Math.max(2, CANVAS_DETAIL - 1);
    fitCanvas();
  }
  smoothFrom = now;
  smoothFrames = 0;
}

// A picture decoded ahead of time at the size it'll be on the screen, so that it's only copied from then on: no scaling for every frame,
// and no decoding in the middle of one.
async function fittedImage(image, width, height) {
  const w = Math.round(width), h = Math.round(height);
  try {
    const fitted = await createImageBitmap(image, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    if (fitted.width === w && fitted.height === h) return fitted;
    fitted.close();
  } catch {
    // Some browsers can't resize this way; a canvas does the same.
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(image, 0, 0, w, h);
  return c;
}

function loadFitted(src, size) {
  // The plain picture is there to draw until the fitted one is.
  const entry = { ready: null, plain: null };
  const image = new Image();
  image.onload = async () => {
    entry.plain = image;
    const [w, h] = size(image);
    entry.ready = await fittedImage(image, w, h);
    entry.plain = null;
  };
  image.src = src;
  return entry;
}

function setViewDetail(place) {
  viewPlace = place;
  VIEW_ZOOM = keptZoom(place);
  showZoom();
  viewDetail = DETAIL_PLACES[place] ?? 1;
  chooseCanvasDetail();
  canvas.width = VIEW_W * CANVAS_DETAIL;
  canvas.height = VIEW_H * CANVAS_DETAIL;
  fineQueue.length = 0;
  fineQueued.clear();
}

// What a made-ahead person has with them, to draw over them. Drawn the first time it's wanted, a little at a time.
function carriedImage(sprite, facing, frame, carrying) {
  if (!sprite?.startsWith("person_") || !window.MAHTTE_ANIMALS?.[sprite.replace("person_gear_", "person_")] || carrying === "none" || carrying === undefined) return null;
  const name = `carried_${sprite.slice(7)}`;
  const hand = frame === 3 || frame === 4 ? 3 : 0;
  if (!window.MAHTTE_ANIMALS[`${name}-${carrying}`] && (!MODELS[name] || !MODELS[name](hand, carrying).length)) return null;
  return modelImage(name, facing, hand, facing, carrying);
}

// Draws a picture at its size in the world, however finely it was made.
function paintImage(image, x, y) {
  const detail = image.detail ?? 1;
  ctx.drawImage(image, x + (image.offsetX ?? 0), y + (image.offsetY ?? 0), image.width / detail, image.height / detail);
}

function makeModelImage(sprite, facing, frame, headFacing, colour, detail) {
  const paint = (g) => drawModel(g, sprite, facing, frame, headFacing, colour, detail);
  // A butterfly's wings are thin enough that an outline would make them all outline.
  const image = sprite === "beaiveloddi" ? unoutlined(120 * detail, 90 * detail, paint) : outlined(120 * detail, 90 * detail, paint, detail);
  image.detail = detail;
  return image;
}

function plainModelImage(sprite, facing, frame, headFacing = facing, colour) {
  const key = `${sprite}/${facing}/${frame}/${headFacing}/${colour}/1`;
  if (!modelImages.has(key)) modelImages.set(key, makeModelImage(sprite, facing, frame, headFacing, colour, 1));
  return modelImages.get(key);
}

// People and animals have many pictures, so a fine one is made only when it's needed, a little at a time between frames,
// with the plain one showing until it's ready. That keeps the game from stuttering.
const FINE_BUDGET_MS = 4, FINE_REST_MS = 8;
const fineQueue = [];
const fineQueued = new Set();
let finePumping = false;

function queueFinePicture(key, sprite, facing, frame, headFacing, colour) {
  if (fineQueued.has(key)) return;
  if (!MODELS[sprite](frame, colour)[0].kind) { // built of boxes, which is quick
    modelImages.set(key, makeModelImage(sprite, facing, frame, headFacing, colour, viewDetail));
    return;
  }
  fineQueued.add(key);
  fineQueue.push(function* make() {
    const detail = viewDetail, w = 120 * detail, h = 90 * detail;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const shapes = MODELS[sprite](frame, colour).map((shape) => turnedShape(shape, MODEL_FACINGS[shape.head ? headFacing : facing]));
    yield* roundModelRows(g, shapes, detail);
    yield;
    addOutline(g, w, h, detail);
    c.detail = detail;
    modelImages.set(key, c);
    fineQueued.delete(key);
  }());
  if (!finePumping) {
    finePumping = true;
    setTimeout(pumpFinePictures, 0);
  }
}

function pumpFinePictures() {
  const start = performance.now();
  while (fineQueue.length && performance.now() - start < FINE_BUDGET_MS) {
    // The newest first, as that's what is on the screen now.
    const job = fineQueue[fineQueue.length - 1];
    if (job.next().done) fineQueue.splice(fineQueue.indexOf(job), 1);
  }
  if (fineQueue.length) setTimeout(pumpFinePictures, FINE_REST_MS);
  else finePumping = false;
}

// Animals made ahead by tools/make_animals.py. They're sharp from the start, and the game needn't draw them.
const BAKED_DETAIL = 4;
const bakedSheets = new Map();
// One breed of dog to a round. They're all simply the word for dog, and the card only names the breed once it's found.
const DOG_BREEDS = { lapinkoira: "suomenlapinkoira", lapinporokoira: "lapinporokoira", pystykorva: "suomenpystykorva", pohjanpystykorva: "pohjanpystykorva", hirvikoira: "norjanhirvikoira", karhukoira: "karjalankarhukoira", husky: "siperianhusky", labradori: "labradorinnoutaja" };
let dogBreed = "lapinkoira";
const chooseDogBreed = () => { const breeds = Object.keys(DOG_BREEDS); dogBreed = breeds[Math.floor(Math.random() * breeds.length)]; };
function bakedAnimal(sprite, facing, frame) {
  if (!bakedSheets.has(sprite)) bakedSheets.set(sprite, Object.assign(new Image(), { src: `art/animals/${sprite}.png` }));
  const sheet = bakedSheets.get(sprite);
  if (!sheet.complete || !sheet.naturalWidth) return null;
  const { frames, rows, x, y, w, h } = window.MAHTTE_ANIMALS[sprite];
  const column = Math.max(0, frames.indexOf(frame));
  const key = `baked/${sprite}/${facing}/${frames[column]}/${CANVAS_DETAIL}`;
  if (!modelImages.has(key)) {
    const c = document.createElement("canvas");
    // People come in many pictures, so each only as big as it needs to be. Others are looked at by where they are in the whole picture.
    const tight = sprite.startsWith("person_") || sprite.startsWith("carried_");
    // Only as fine as the screen will show, so that it's copied rather than scaled every time it's drawn.
    const scale = CANVAS_DETAIL / BAKED_DETAIL;
    c.width = tight ? Math.ceil(w * scale) : 120 * CANVAS_DETAIL;
    c.height = tight ? Math.ceil(h * scale) : 90 * CANVAS_DETAIL;
    c.detail = CANVAS_DETAIL;
    if (tight) {
      c.offsetX = Math.round((x / BAKED_DETAIL) * CANVAS_DETAIL) / CANVAS_DETAIL;
      c.offsetY = Math.round((y / BAKED_DETAIL) * CANVAS_DETAIL) / CANVAS_DETAIL;
    }
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(sheet, column * w, (facing % rows) * h, w, h, tight ? 0 : Math.round(x * scale), tight ? 0 : Math.round(y * scale), Math.ceil(w * scale), Math.ceil(h * scale));
    modelImages.set(key, c);
  }
  return modelImages.get(key);
}
// Standing, a tail swishes now and then: a few pictures back and forth, each animal keeping its own time.
const SWISH_MS = 170, SWISH_EVERY = 34;
// The game asks for a step or a wingbeat as one of two pictures. Where the sheet has more, they run through in their order, and big birds beat slower.
const STEP_FRAME_MS = 95, BEAT_FRAME_MS = 62, BIG_BEAT_FRAME_MS = 105, FLUTTER_FRAME_MS = 58;
const BIG_BIRDS = new Set(["goaskin", "njukca", "beahceloddi", "goahppil"]);
function swishFrame(sprite, frame) {
  const { frames } = window.MAHTTE_ANIMALS[sprite] ?? window.MAHTTE_ANIMALS[`beana-${dogBreed}`];
  const time = performance.now() + sprite.length * 47;
  if (frames.includes(40)) return 40 + Math.floor(time / FLUTTER_FRAME_MS) % 6;
  if (frames.includes(30) && (frame === 3 || frame === 4)) return 30 + Math.floor(time / (BIG_BIRDS.has(sprite) ? BIG_BEAT_FRAME_MS : BEAT_FRAME_MS)) % 4;
  if (frames.includes(20) && (frame === 1 || frame === 2)) return 20 + Math.floor(time / STEP_FRAME_MS) % 4;
  const [one, other] = frames.includes(8) ? [8, 9] : frames.includes(6) ? [5, 6] : [];
  if (frame !== 0 || !one) return frame;
  const beat = Math.floor((performance.now() + sprite.charCodeAt(0) * 907 + sprite.length * 311) / SWISH_MS) % SWISH_EVERY;
  return beat === 0 || beat === 4 ? one : beat === 2 || beat === 6 ? other : frame;
}

// In a place made ahead, what's on its way stays away for the moment it takes to load, rather than being drawn the old way first.
const NOTHING_YET = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
function modelImage(sprite, facing, frame, headFacing = facing, colour) {
  // An owl's body is near enough round, so that turning all of it does for its head turning to look.
  // A thing that comes in several kinds has a picture for each, named after the kind.
  const baked = sprite === "beana" ? `beana-${dogBreed}` : window.MAHTTE_ANIMALS?.[`${sprite}-${colour}`] ? `${sprite}-${colour}` : sprite.replace("person_gear_", "person_");
  if (window.MAHTTE_ANIMALS?.[baked]) return bakedAnimal(baked, sprite === "jievjaskuolfi" ? headFacing : facing, swishFrame(baked, frame)) ?? (madeTiles() ? NOTHING_YET : plainModelImage(sprite === "gumpe" || sprite === "geatki" || sprite === "albbas" ? "beana" : sprite, facing, frame, headFacing, colour));
  if (viewDetail === 1) return plainModelImage(sprite, facing, frame, headFacing, colour);
  const key = `${sprite}/${facing}/${frame}/${headFacing}/${colour}/${viewDetail}`;
  if (!modelImages.has(key)) {
    // Home is full of round furniture, too much to make in one go as the place opens.
    if (sprite.startsWith("person_") || sprite.startsWith("carried_") || ANIMALS.has(sprite) || sprite === "laphund" || placeName === "home") {
      queueFinePicture(key, sprite, facing, frame, headFacing, colour);
      return modelImages.get(key) ?? plainModelImage(sprite, facing, frame, headFacing, colour);
    }
    modelImages.set(key, makeModelImage(sprite, facing, frame, headFacing, colour, viewDetail));
  }
  return modelImages.get(key);
}

// Twice the size with Scale2x, which rounds off stair-steps and keeps a picture's drawing and colours exactly.
function doubledImage(image) {
  if (image.fine) return fittedFine(image);
  const w = image.width, h = image.height;
  const from = new Uint32Array(image.getContext("2d").getImageData(0, 0, w, h).data.buffer);
  const c = document.createElement("canvas");
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext("2d");
  const out = g.createImageData(w * 2, h * 2);
  const to = new Uint32Array(out.data.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = y * w + x, e = from[at];
    const b = y ? from[at - w] : e, d = x ? from[at - 1] : e, f = x + 1 < w ? from[at + 1] : e, u = y + 1 < h ? from[at + w] : e;
    const top = y * 2 * w * 2 + x * 2, under = top + w * 2;
    if (b !== u && d !== f) {
      to[top] = d === b ? d : e;
      to[top + 1] = b === f ? f : e;
      to[under] = d === u ? d : e;
      to[under + 1] = u === f ? f : e;
    } else to[top] = to[top + 1] = to[under] = to[under + 1] = e;
  }
  g.putImageData(out, 0, 0);
  c.detail = 2;
  image.fine = c;
  return c;
}

// An image cut out of its empty surroundings, for the menu and the word card.
const vehiclePicture = (sprite, colour) => (MODELS[sprite] ? modelPicture(sprite, colour) : croppedImage(vehicleImage(sprite, colour)));
const modelPicture = (sprite, colour) => croppedImage(modelImage(sprite, 0, sprite === "beaiveloddi" ? 1 : 0, 0, colour)); // wings half raised

function croppedImage(image) {
  const { data } = image.getContext("2d").getImageData(0, 0, image.width, image.height);
  let x0 = image.width, x1 = 0, y0 = image.height, y1 = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (!data[(y * image.width + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const c = document.createElement("canvas");
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  c.getContext("2d").drawImage(image, -x0, -y0);
  c.detail = image.detail;
  return c;
}

// A chair, drawn in two parts so that someone sitting comes between its seat and its back.
const chairPoint = (chair, a, b, up) => {
  const cos = Math.cos(chair.angle), sin = Math.sin(chair.angle);
  const x = chair.x + a * cos - b * sin, y = chair.y + a * sin + b * cos;
  return [isoX(x, y), isoY(x, y) - up];
};

// Birch wood with a dark edge: it has to stand out from the blue of the gákti in front of it.
const CHAIR_LOOK = { size: 0.3, seat: 6, backBottom: 3, backTop: 18, edge: "#3a2a1c", wood: "#dcb880", light: "#ecd2a0", shade: "#b89058", leg: "#6a4a2c" };

// The classrooms' chair, from tools/make_classrooms.py, in the same two parts. Must match CHAIR_W, CHAIR_H and CHAIR_FOOT there.
const CHAIR_PICTURE = { w: 28, h: 36, foot: 22 };
const chairPictures = {};
function drawMadeChair(chair, part) {
  chairPictures[part] ??= Object.assign(new Image(), { src: `art/classroom/chair-${part}.png` });
  ctx.lit = false; // made with its light in, as the room was
  if (chairPictures[part].complete) ctx.drawImage(chairPictures[part], isoX(chair.x, chair.y) - CHAIR_PICTURE.w / 2, isoY(chair.x, chair.y) - CHAIR_PICTURE.foot, CHAIR_PICTURE.w, CHAIR_PICTURE.h);
  ctx.lit = true;
}

function drawChairSeat(chair) {
  if (madeTiles()) return drawMadeChair(chair, "seat");
  const { size, seat, edge, wood, leg } = CHAIR_LOOK;
  const point = (a, b, up) => chairPoint(chair, a, b, up);
  const corners = [[-size, -size], [size, -size], [size, size], [-size, size]];
  ctx.fillStyle = SHADOW;
  ctx.globalAlpha = 0.3;
  castShadow(ctx, Math.round(isoX(chair.x, chair.y)) - 3, Math.round(isoY(chair.x, chair.y)) + 1, 13, 5);
  ctx.globalAlpha = 1;
  ctx.fillStyle = leg;
  for (const [a, b] of corners) {
    const [x, y] = point(a, b, 0);
    ctx.fillRect(Math.round(x), Math.round(y) - seat, 2, seat);
  }
  fillShape(corners.map(([a, b]) => point(a, b, seat + 1)), edge);
  fillShape(corners.map(([a, b]) => point(a * 0.82, b * 0.82, seat + 1)), wood);
}

function drawChairBack(chair) {
  if (madeTiles()) return drawMadeChair(chair, "back");
  const { size, backBottom, backTop, edge, wood, light, shade } = CHAIR_LOOK;
  const point = (a, b, up) => chairPoint(chair, a, b, up);
  // One solid panel, as wide as the seat, that hides the lower back of whoever sits there.
  const panel = (inset, bottom, top, colour) => fillShape([
    point(-size + inset, -size, bottom), point(size - inset, -size, bottom), point(size - inset, -size, top), point(-size + inset, -size, top),
  ], colour);
  panel(0, backBottom, backTop + 1, edge);
  panel(0.04, backBottom + 1, backTop, wood);
  panel(0.04, backTop - 3, backTop, light);
  panel(0.04, backBottom + 1, backBottom + 3, shade);
}

const isFootDust = (puff) => puff.step && !puff.high;

function paintPuff(puff, now) {
  const age = (now - puff.born) / (puff.life || 420);
  if (age < 0 || age >= 1) return;
  const x0 = isoX(puff.x, puff.y) + (puff.side || 0), y0 = isoY(puff.x, puff.y) - (puff.high || 0);
  // Step dust stays strong for a while and hangs where the foot landed, so it leaves a trail.
  const strength = puff.step ? 1 - age * age : 1 - age;
  ctx.fillStyle = `rgba(${puff.colour || "226, 212, 178"}, ${(puff.step ? 0.95 : 0.8) * strength})`;
  for (let i = 0; i < puff.count; i++) {
    const angle = (i / puff.count) * Math.PI * 2 + puff.born;
    const r = (puff.step ? 2 + (i % 3) : 3) + age * (puff.step ? 5 : 9);
    const size = puff.step ? (age < 0.5 ? 3 : age < 0.8 ? 2 : 1) : age > 0.65 ? 1 : 2;
    ctx.fillRect(Math.round(x0 + Math.cos(angle) * r), Math.round(y0 + Math.sin(angle) * r * 0.5 - age * (puff.step ? 7 : 3)), size, size);
  }
}

const SPILLED_SCALE = 0.7;
const IN_BASKET = { high: 6, wide: 6, apart: 2, sinks: 3, rim: 1 }; // the front rim, below the basket's middle, hides what is under it

// The player's basket, with the tops of the last things put in it just showing inside.
function paintCarried(cx, cy, [dx, dy]) {
  const [swingX, swingY] = basketSwing();
  const x = cx + dx + swingX, y = cy + dy + swingY;
  if (cart.bag) {
    paintImage(modelImage("till_bag", 0, 0, 0, Number(cart.bag.slice(3))), x - MODEL_ANCHOR.x, y - MODEL_ANCHOR.y + 8);
    return;
  }
  paintImage(modelImage("player_basket", 0, 0), x - MODEL_ANCHOR.x, y - MODEL_ANCHOR.y + 3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 12, y - 20, 24, 20 + IN_BASKET.rim);
  ctx.clip();
  ctx.imageSmoothingEnabled = true; // at this size, single pixels picked out would only be speckles
  cart.goods.slice(-3).forEach((word, i, shown) => {
    const image = pictureOf(word);
    const fit = Math.min(IN_BASKET.wide / image.width, IN_BASKET.high / image.height);
    const wide = image.width * fit, high = image.height * fit;
    ctx.drawImage(image, x + (i - (shown.length - 1) / 2) * IN_BASKET.apart - wide / 2, y + IN_BASKET.sinks - high, wide, high);
  });
  ctx.restore();
}

// The forest's ground, in pieces from tools/make_forest.py that load as they come near. Only the river and a little grass move, gently.
const FOREST_CHUNK = 512 / FOREST_DETAIL; // in the world's pixels
const MADE_GROUNDS = { forest: { folder: "art/forest", back: "#14302a" }, store: { folder: "art/store", back: "#191614" }, classroom: { folder: "art/classroom", back: "#191614" }, lesson: { folder: "art/lesson", back: "#191614" }, library: { folder: "art/library", back: "#191614" }, home: { folder: "art/home", back: "#191614" }, city: { folder: "art/city", back: "#23262c" }, gearstore: { folder: "art/gearstore", back: "#191614" } };
const forestChunks = new Map();
function forestChunk(folder, column, row) {
  const key = `${folder}/ground-${column}-${row}.webp`;
  let chunk = forestChunks.get(key);
  if (!chunk || chunk.detail !== CANVAS_DETAIL) {
    chunk = loadFitted(key, () => [FOREST_CHUNK * CANVAS_DETAIL, FOREST_CHUNK * CANVAS_DETAIL]);
    chunk.detail = CANVAS_DETAIL;
    forestChunks.set(key, chunk);
  }
  return chunk;
}

function paintMadeGround(camX, camY, { folder, back }) {
  ctx.fillStyle = back;
  ctx.fillRect(camX, camY, VIEW_W, VIEW_H);
  const columns = Math.ceil(WORLD_W / FOREST_CHUNK), rows = Math.ceil(WORLD_H / FOREST_CHUNK);
  const c0 = Math.floor(camX / FOREST_CHUNK), r0 = Math.floor(camY / FOREST_CHUNK);
  const c1 = Math.floor((camX + VIEW_W) / FOREST_CHUNK), r1 = Math.floor((camY + VIEW_H) / FOREST_CHUNK);
  // One piece further round is fetched ahead of being needed.
  for (let r = Math.max(0, r0 - 1); r <= Math.min(rows - 1, r1 + 1); r++) for (let c = Math.max(0, c0 - 1); c <= Math.min(columns - 1, c1 + 1); c++) {
    const chunk = forestChunk(folder, c, r), image = chunk.ready ?? chunk.plain;
    if (c >= c0 && c <= c1 && r >= r0 && r <= r1 && image) ctx.drawImage(image, c * FOREST_CHUNK, r * FOREST_CHUNK, FOREST_CHUNK, FOREST_CHUNK);
  }
}

function paintForestLife(now, seen) {
  for (let ty = 0; ty < HEIGHT; ty++) for (let tx = 0; tx < WIDTH; tx++) {
    const tile = MAP[ty][tx];
    const cx = isoX(tx, ty), cy = isoY(tx, ty);
    if (!seen(cx, cy)) continue;
    if (tile === "w") {
      // Long soft glints drifting along the flow, fading in and out.
      for (let i = 0; i < 2; i++) {
        const s = noise(tx + i * 7, ty);
        const along = ((now / (2600 + s * 1800) + s) % 1);
        const glint = Math.sin(along * Math.PI) * 0.34;
        ctx.fillStyle = `rgba(190, 228, 248, ${glint})`;
        ctx.fillRect(cx - 12 + along * 18 + s * 6, cy + 5 + along * 9 + i * 3 + s * 3, 3 + s * 3, 0.5);
      }
    } else if (tile === "g" && noise(tx, ty + 30) > 0.62) {
      // A few blades leaning in the same slow wind as the trees.
      const lean = Math.sin(now / 2200 + tx * 1.7 + ty * 0.9) * 0.9;
      const x = cx - 4 + noise(tx, ty + 31) * 9, y = cy + 5 + noise(tx + 31, ty) * 5;
      ctx.fillStyle = "#4a8f49";
      ctx.fillRect(x, y - 1.5, 0.5, 2);
      ctx.fillStyle = "#a4d67a";
      ctx.fillRect(x + lean * 0.5, y - 3, 0.5, 1.75);
    }
  }
}

// With #fps on the address, how many pictures a second are being drawn, for trying out how fast the game runs.
const frameTimes = [];
function paintFrameRate(now, camX, camY) {
  frameTimes.push(now);
  while (frameTimes.length && now - frameTimes[0] > 1000) frameTimes.shift();
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#000";
  ctx.fillRect(camX + 3, camY + 3, 62, 11);
  ctx.fillStyle = "#7fff7f";
  ctx.fillText(`${frameTimes.length} fps, ${CANVAS_DETAIL}x`, camX + 5, camY + 11);
}

// A few z's rising from whoever is asleep, so that a child can see it from afar.
function paintSleepZ(cx, cy, now, phase) {
  ctx.save();
  ctx.textAlign = "center";
  for (let i = 0; i < 2; i++) {
    const along = ((now + phase) / 2600 + i / 2) % 1;
    ctx.font = `bold ${4 + along * 3}px sans-serif`;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(along * Math.PI) * 0.85})`;
    ctx.fillText("z", cx + 3 + along * 5, cy - 8 - along * 12);
  }
  ctx.restore();
}

function draw(now) {
  if (!worldImage && !MADE_GROUNDS[placeName]) worldImage = buildWorld();
  const dt = lastDraw === null ? 16 : Math.max(0, Math.min(now - lastDraw, 100));
  lastDraw = now;
  const moveX = me.moveX, moveY = me.moveY;

  // The camera eases after the player and looks a little ahead of the walk.
  const ahead = 1 - Math.exp(-dt / CAMERA.aheadMs);
  cam.lookX += (moveX * CAMERA.ahead - cam.lookX) * ahead;
  cam.lookY += (moveY * CAMERA.ahead - cam.lookY) * ahead;
  const follow = 1 - Math.exp(-dt / CAMERA.followMs);
  if (placeName === "lesson") placeCamera();
  else {
    cam.x += (isoX(me.x, me.y) + cam.lookX - VIEW_W / 2 - cam.x) * follow;
    cam.y += (isoY(me.x, me.y) - 14 + cam.lookY - VIEW_H / 2 - cam.y) * follow;
  }
  // A place smaller than the view stays in the middle of it.
  cam.x = WORLD_W <= VIEW_W ? (WORLD_W - VIEW_W) / 2 : Math.max(0, Math.min(WORLD_W - VIEW_W, cam.x));
  cam.y = WORLD_H <= VIEW_H ? (WORLD_H - VIEW_H) / 2 : Math.max(0, Math.min(WORLD_H - VIEW_H, cam.y));
  keepFitted();
  // On the screen's pixels rather than the world's, so that the view glides instead of stepping three pixels at a time.
  const camX = Math.round(cam.x * CANVAS_DETAIL) / CANVAS_DETAIL, camY = Math.round(cam.y * CANVAS_DETAIL) / CANVAS_DETAIL;
  const seen = (x, y, pad = 60) => x > camX - pad && x < camX + VIEW_W + pad && y > camY - pad && y < camY + VIEW_H + pad;

  if (ctx.gpu) ctx.setView({ camX, camY, detail: CANVAS_DETAIL, zoom: VIEW_ZOOM, ox: OX, topPad: TOP_PAD });
  ctx.save();
  ctx.scale(CANVAS_DETAIL, CANVAS_DETAIL);
  const shrinking = CANVAS_DETAIL < 4; // the fine pictures come out even when they're smoothed down to fit
  ctx.imageSmoothingEnabled = shrinking && !!MADE_GROUNDS[placeName];
  ctx.translate(-camX, -camY);
  ctx.lit = false; // the floor's pictures have their light already
  if (MADE_GROUNDS[placeName]) paintMadeGround(camX, camY, MADE_GROUNDS[placeName]);
  else if (viewDetail > 1) ctx.drawImage(doubledImage(worldImage), camX * 2, camY * 2, VIEW_W * 2, VIEW_H * 2, camX, camY, VIEW_W, VIEW_H);
  else ctx.drawImage(worldImage, camX, camY, VIEW_W, VIEW_H, camX, camY, VIEW_W, VIEW_H);

  ctx.lit = true;
  if (placeName === "forest") paintForestLife(now, seen);
  // River glints along the flow, and grass moving in the wind.
  if (!MADE_GROUNDS[placeName]) for (let ty = 0; ty < HEIGHT; ty++) for (let tx = 0; tx < WIDTH; tx++) {
    const tile = MAP[ty][tx];
    const cx = isoX(tx, ty), cy = isoY(tx, ty);
    if (!seen(cx, cy)) continue;
    if (tile === "w") {
      const s = (tx * 7 + ty * 13) % 5;
      const drift = Math.floor(now / 170 + s * 9 + tx * 3) % 22;
      ctx.fillStyle = "#6cb6ea";
      for (let i = 0; i < 5; i++) ctx.fillRect(cx - 12 + drift + i, cy + WATER_DROP + 1 + s + Math.floor((drift + i) / 2), 1, 1);
      if (Math.floor(now / 420 + s) % 3 === 0) { ctx.fillStyle = "#e4f6ff"; ctx.fillRect(cx - 3 + s * 2, cy + WATER_DROP + 7 + s, 2, 1); }
    } else if (tile === "g" && noise(tx, ty + 30) > 0.72) {
      const sway = Math.sin(now / 520 + tx * 1.7 + ty * 0.9) > 0.1 ? 1 : 0;
      const x = cx - 4 + Math.floor(noise(tx, ty + 31) * 9), y = cy + 5 + Math.floor(noise(tx + 31, ty) * 5);
      ctx.fillStyle = "#3c7a3c"; ctx.fillRect(x, y, 1, 2);
      ctx.fillStyle = "#8fd06e"; ctx.fillRect(x + sway, y - 2, 1, 2);
    }
  }

  const scene = [], madeTilesNow = [];
  const onScreen = (value) => Math.round(value * CANVAS_DETAIL) / CANVAS_DETAIL;
  const footX = onScreen(isoX(me.x, me.y)), footY = onScreen(isoY(me.x, me.y));
  for (const chair of chairs) {
    const chairBox = [isoX(chair.x, chair.y) - 14, isoY(chair.x, chair.y) - 22, isoX(chair.x, chair.y) + 14, isoY(chair.x, chair.y) + 14];
    scene.push({ d: chair.x + chair.y - 0.01, box: chairBox, paint: () => drawChairSeat(chair) });
    // Whoever sits leans against the back, and it's in front of them, as it's nearer. In a lesson every chair has someone.
    scene.push({ d: chair.x + chair.y + (chair === me.sittingOn || theme?.lesson ? 0.2 : 0.01), box: chairBox, paint: () => drawChairBack(chair) });
  }
  for (const t of treeMap) {
    // Only what can reach the view, with room for its lean. Tall trees were too many of those to draw just in case.
    if (t.block ? !seen(t.x, t.y, 70) : t.x + t.image.width / 2 + 3 < camX || t.x - t.image.width / 2 - 3 > camX + VIEW_W || t.y + 4 < camY || t.y - t.image.height > camY + VIEW_H) continue;
    // In front of the character and covering them, a tree turns see-through.
    const left = t.x - t.image.width / 2, top = t.y + 2 - t.image.height + (t.made ? t.made[5] / 4 : 0);
    const covers = !"CMETHXZD".includes(MAP[t.ty]?.[t.tx]) && t.mx + t.my > me.x + me.y && footX + 8 > left && footX - 8 < left + t.image.width && footY > top && footY - 30 < t.y;
    // In the forest, an animal behind a tree shows through it too, as there it's what's being looked for.
    const hidesThing = placeName === "forest" && !t.block && objects.some((o) => {
      if (o.x + 0.5 + o.y + 0.5 >= t.mx + t.my) return false;
      const ox = isoX(o.x + 0.5, o.y + 0.5), oy = isoY(o.x + 0.5, o.y + 0.5);
      return ox + 8 > left && ox - 8 < left + t.image.width && oy > top && oy - 16 < t.y;
    });
    if (t.image.fine?.complete === false) continue; // a tree's picture still loading; a doubled block's is a canvas, ready at once
    const madeBox = t.made && [t.x - 16 + t.made[4] / 4, t.y - 62 + t.made[5] / 4, t.x - 16 + (t.made[4] + t.made[2]) / 4, t.y - 62 + (t.made[5] + t.made[3]) / 4];
    (t.made ? madeTilesNow : scene).push({ d: t.mx + t.my, box: madeBox, paint: () => {
      if (covers || hidesThing) ctx.globalAlpha = placeName === "forest" ? 0.1 : placeName === "store" ? 0.3 : 0.5;
      ctx.lit = false; // trees and fixtures have their light painted in already
      if (t.made) {
        const { ready, plain } = madeSheet(), sheet = ready ?? plain, scale = ready ? CANVAS_DETAIL / 4 : 1;
        const [sx, sy, w, h, ox, oy] = t.made;
        ctx.lit = false;
        if (sheet) ctx.drawImage(sheet, sx * scale, sy * scale, w * scale, h * scale, t.x - 16 + ox / 4, t.y + 2 - 64 + oy / 4, w / 4, h / 4);
        ctx.lit = true;
      } else if (t.block) {
        if (viewDetail > 1) paintImage(doubledImage(t.image), t.x - 16, t.y + 2 - t.image.height);
        else ctx.drawImage(t.image, t.x - 16, t.y + 2 - t.image.height);
      } else {
        // In the forest the wind is slow and each tree keeps to its own time: lively, but not enough to make anyone queasy.
        const wind = placeName === "forest"
          ? (Math.sin(now / 2600 + t.tx * 2 + t.ty) + Math.sin(now / 1100 + t.tx) * 0.25) * 0.8
          : (Math.sin(now / 1300 + t.tx * 2 + t.ty) + Math.sin(now / 470 + t.tx) * 0.4) * 1.4;
        drawLiving(t.image, t.x - Math.floor(t.image.width / 2), t.y + 2 - t.image.height, { lean: wind });
        if (placeName === "camp") campRim(t.image, 0, 0, t.image.width, t.image.height, t.x - Math.floor(t.image.width / 2), t.y + 2 - t.image.height, t.image.width, t.image.height, t.mx, t.my);
      }
      ctx.lit = true;
      ctx.globalAlpha = 1;
    }});
  }
  if (placeName === "forest") {
    const church = FOREST_CHURCH;
    forestChurchImage = churchPicture(forestChurchImage, "art/forest/church.png");
    const churchNow = forestChurchImage.ready ?? forestChurchImage.plain;
    const middleX = (church.x0 + church.x1) / 2, middleY = (church.y0 + church.y1) / 2;
    const left = isoX(middleX, middleY) - church.ax, top = isoY(middleX, middleY) - church.ay;
    if (churchNow && seen(left + church.w / 2, top + church.h / 2, 240)) {
      forestFenceImage = churchPicture(forestFenceImage, "art/forest/church-fence.png");
      const fenceNow = forestFenceImage.ready ?? forestFenceImage.plain;
      const inYard = me.x < church.x1 && me.y < church.y1;
      // In the open part of the yard, by the gable and in the corner between the arms, the character is in front of the church.
      const behind = inYard && !(me.x >= 56 || (me.x >= 54 && me.y >= 33));
      const near = footX > left && footX < left + church.w && footY > top && footY - 30 < top + church.h;
      const mine = me.x + me.y;
      scene.push({ d: behind ? Math.max(church.depth, mine + 0.02) : Math.min(church.depth, mine - 0.02), paint: () => {
        // Whoever walks round behind it can still be seen.
        if (behind && near) ctx.globalAlpha = 0.72;
        ctx.lit = false;
        ctx.drawImage(churchNow, left, top, church.w, church.h);
        ctx.lit = true;
        ctx.globalAlpha = 1;
      } });
      if (fenceNow) scene.push({ d: mine + (inYard ? 0.03 : -0.03), paint: () => { ctx.lit = false; ctx.drawImage(fenceNow, left, top, church.w, church.h); ctx.lit = true; } });
    }
  }
  for (const o of objects.flatMap(stockCopies)) {
    if (o.word.place === "bay") {
      const box = vehicleBox(o);
      const vx = isoX((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2), vy = isoY((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
      if (!seen(vx, vy, 90)) continue;
      // Behind a long vehicle or in front of it depends on both ends, not just its middle.
      const behind = me.x < box.x1 + 0.1 && me.y < box.y1 + 0.1;
      // Far vehicles first among themselves; the small step never passes the player.
      scene.push({ d: me.x + me.y + (behind ? 0.02 : -0.02) + (box.x0 + box.y0) * 1e-4, paint: () => {
        ctx.fillStyle = SHADOW;
        ctx.globalAlpha = 0.34;
        castShadow(ctx, Math.round(isoX(box.x1, box.y1)) - 2, Math.round(isoY(box.x1, box.y1)) - 3, 22, 8);
        ctx.globalAlpha = 1;
        // A round, shaded model where there is one (src/models.js).
        if (MODELS[o.word.sprite]) {
          // Its shadow right under it, its own footprint on the ground, a little wider and softer at the edge; and where the GPU draws, its
          // shadow in the sun too, as the player's. Both go with it when it's found.
          const under = (grow, lean) => [[box.x0 - grow, box.y0 - grow], [box.x1 + grow + lean, box.y0 - grow], [box.x1 + grow + lean, box.y1 + grow + lean], [box.x0 - grow, box.y1 + grow + lean]]
            .map(([x, y]) => [isoX(x, y), isoY(x, y)]);
          for (const [grow, lean, alpha] of [[0.14, 0.12, 0.14], [0.05, 0.06, 0.18], [-0.03, 0.02, 0.22]]) {
            ctx.globalAlpha = alpha;
            fillShape(under(grow, lean), SHADOW);
          }
          ctx.globalAlpha = 1;
          // In the sun, the shadow of its own shape, as the player's: worked out from its model, laid on the ground from its wheels.
          if (ctx.gpu && ctx.light) {
            const sun = ctx.sunHere(vx, vy), shade = vehicleShadow(o.word.sprite, ctx.light.sun);
            if (sun > 0.05 && shade) {
              ctx.shadowPaint = 0.42 * sun;
              ctx.drawImage(shade, Math.round(vx) + shade.left, Math.round(vy) + shade.top, shade.width / shade.detail, shade.height / shade.detail);
            }
          }
          paintImage(modelImage(o.word.sprite, 0, 0, 0, o.word.colour), Math.round(vx) - MODEL_ANCHOR.x, Math.round(vy) - MODEL_ANCHOR.y);
        } else ctx.drawImage(vehicleImage(o.word.sprite, o.word.colour), vx - VEHICLE_ANCHOR.x, vy - VEHICLE_ANCHOR.y);
      }});
      continue;
    }
    if (o.word.place === "home") {
      const box = vehicleBox(o);
      const hx = isoX(o.x + 0.5, o.y + 0.5), hy = isoY(o.x + 0.5, o.y + 0.5);
      if (!seen(hx, hy, 90)) continue;
      const flat = FLAT_THINGS.has(o.word.sprite);
      const behind = me.x < box.x1 + 0.1 && me.y < box.y1 + 0.1;
      // Someone on the sofa counts as in front of it.
      const middle = (box.x0 + box.x1 + box.y0 + box.y1) / 2 + (SITTING_ON_SOFA.has(o.word.sprite) ? 1 : 0);
      // A rug is under everything. Otherwise as for parked vehicles, but kept in front of the walls behind it.
      let depth = flat ? -1 : (behind ? Math.max(me.x + me.y + 0.02, middle) : Math.min(me.x + me.y - 0.02, middle)) + middle * 1e-3;
      // Whoever sits on a sofa made with the room is in front of it, and so after it when it's drawn again over someone behind it.
      if (SITTING_ON_SOFA.has(o.word.sprite) && madeTiles()?.["piece:sofa"]) {
        const sofa = objects.find((other) => other.word.sprite === "sofa");
        const sofaBox = sofa && vehicleBox(sofa);
        if (sofaBox && me.x < sofaBox.x1 + 0.1 && me.y < sofaBox.y1 + 0.1) {
          const sofaMiddle = (sofaBox.x0 + sofaBox.x1 + sofaBox.y0 + sofaBox.y1) / 2;
          depth = Math.max(depth, Math.max(me.x + me.y + 0.02, sofaMiddle) + sofaMiddle * 1e-3 + 0.01);
        }
      }
      // Made with the room, by tools/make_home.py, it's in the floor's pictures already: drawn again only over someone behind it.
      const piece = madeTiles()?.[`piece:${o.word.sprite}`];
      if (piece) {
        if (!flat && behind) scene.push({ d: depth, paint: () => paintPiece(piece) });
        continue;
      }
      scene.push({ d: depth, paint: () => {
        const pose = animalPose(o, now);
        if (!flat && ANIMAL_WAYS[o.word.sprite]?.shadow?.[0] !== 0) {
          ctx.fillStyle = SHADOW;
          ctx.globalAlpha = 0.22;
          castShadow(ctx, Math.round(isoX(box.x1, box.y1)) - 2, Math.round(isoY(box.x1, box.y1)) - 2, 16, 6);
          ctx.globalAlpha = 1;
        }
        paintImage(modelImage(o.word.sprite, pose.facing, pose.frame, pose.head, o.word.colour), Math.round(hx) - MODEL_ANCHOR.x, Math.round(hy) - MODEL_ANCHOR.y);
      }});
      continue;
    }
    const raised = RAISED[o.word.place] || 0;
    const room = !!window.MAHTTE_ROOMS?.[placeName], forward = room ? IN_FRONT[o.word.place] ?? 0 : 0;
    const cx = isoX(o.x, o.y) - forward * HW + (o.copyDx ?? 0) * HW, onWater = o.word.place === "water";
    const cy = isoY(o.x, o.y) + HH + forward * HH + (o.copyDx ?? 0) * HH + (onWater ? WATER_DROP : 0) - raised;
    if (!seen(cx, cy)) continue;
    if (o.tiles) continue; // on its shelf already, as part of the store's pictures, or among its colour's books in the library
    // Something in a fixture is drawn after the fixtures beside it, or they would cover it. In a room made ahead, its own fixture is
    // already in the picture, so it only needs to be in front of that one, and stays behind whoever stands in the aisle before it.
    // Nor are the fixture's own tiles beside it drawn again over it, where it reaches over them, as a snowmobile's skis over its platform.
    scene.push({ d: o.x + o.y + (raised ? (room ? 1.45 : 2.2) : 1), inFixture: room && raised > 0, box: [cx - 16, cy - 40, cx + 16, cy + 8], paint: () => {
      ctx.fillStyle = SHADOW;
      ctx.globalAlpha = 0.34;
      if (raised) ctx.globalAlpha = 0;
      else if (o.word.sprite === "viessu") castShadow(ctx, cx - 6, cy + 2, 30, 13);
      else if (o.word.big) castShadow(ctx, cx - 8, cy + 2, 28, 9);
      else if (MODELS[o.word.sprite]) {
        const [length, width] = ANIMAL_WAYS[o.word.sprite].shadow;
        castShadow(ctx, Math.round(cx) - 3, Math.round(cy) + 1, length, width);
      } else if (!onWater) castShadow(ctx, cx - 4, cy + 2, 15, 6);
      else castShadow(ctx, cx - 6, cy + 2, 12, 2);
      ctx.globalAlpha = 1;
      if (o.word.sprite === "viessu") { ctx.drawImage(houseImage, cx - 17, cy + 3 - 36); return; }
      if (MODELS[o.word.sprite]) {
        const pose = animalPose(o, now);
        const bob = onWater ? Math.round(Math.sin((now + o.phase) / 520)) : 0;
        ctx.globalAlpha = o.fade ?? 1;
        if (ctx.gpu && !pose.lift && !onWater) ctx.casting = true; // standing on the ground, it has a shadow in the light
        paintImage(modelImage(o.drawSprite ?? o.word.sprite, pose.facing, pose.frame, pose.head, o.word.colour), Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y - pose.lift - bob);
        if (pose.asleep) paintSleepZ(cx, cy, now, o.phase);
        ctx.globalAlpha = 1;
        return;
      }
      // In a bookcase a book stands as the others do, spine out; its card still shows the cover.
      const image = pictureOf(o.word);
      let lift = 0, squash = 0, lean = 0, flip = false;
      if (onWater && FLOATING.has(o.word.sprite)) {
        lift = Math.round(Math.sin((now + o.phase) / 520));
        lean = Math.sin((now + o.phase) / 700) * 1.5;
      }
      drawLiving(image, cx - Math.floor(image.width / 2), cy + 3 - image.height - lift, { lean, squash, flip });
    }});
  }
  // What stands at home that isn't asked for, made with the room: as the furniture, drawn again only over someone behind it.
  decorThings.forEach((o, i) => {
    const piece = madeTiles()?.[`piece:decor-${i}`];
    if (!piece) return;
    const box = vehicleBox(o);
    if (!(me.x < box.x1 + 0.1 && me.y < box.y1 + 0.1)) return;
    const middle = (box.x0 + box.x1 + box.y0 + box.y1) / 2;
    scene.push({ d: Math.max(me.x + me.y + 0.02, middle) + middle * 1e-3, paint: () => paintPiece(piece) });
  });
  for (const thing of storeLife(now)) {
    const cx = onScreen(isoX(thing.x, thing.y)), cy = onScreen(isoY(thing.x, thing.y) + HH - (thing.lift || 0));
    if (!seen(cx, cy)) continue;
    scene.push({ d: thing.d ?? thing.x + thing.y + 1 + (thing.order || 0), box: [cx - 22, cy - 60, cx + 22, cy + 10], paint: () => {
      ctx.globalAlpha = (thing.alpha ?? 1) * 0.34;
      if (thing.shadow) {
        ctx.fillStyle = SHADOW;
        castShadow(ctx, cx - 3, cy + 1, 13, 5);
      }
      ctx.globalAlpha = thing.alpha ?? 1;
      if (thing.marker) {
        // Points out the basket to take first.
        ctx.fillStyle = "#ffd25a";
        for (let row = 0; row < 5; row++) ctx.fillRect(cx - 5 + row, cy - 12 + row, 11 - row * 2, 1);
        ctx.globalAlpha = 1;
        return;
      }
      if (thing.picture) {
        const image = pictureOf(thing.picture), worldWide = image.width / (image.detail ?? 1), worldHigh = image.height / (image.detail ?? 1);
        const scale = Math.min(thing.scale ?? SPILLED_SCALE, (thing.fits ?? Infinity) / Math.max(worldWide, worldHigh)), wide = Math.round(worldWide * scale), high = Math.round(worldHigh * scale);
        ctx.drawImage(image, cx - Math.floor(wide / 2), cy - high + 2, wide, high);
        ctx.globalAlpha = 1;
        return;
      }
      if (ctx.gpu) ctx.casting = true; // the GPU lays their shadow in the light
      paintImage(modelImage(thing.sprite, thing.facing, thing.frame, thing.facing, thing.carrying), cx - MODEL_ANCHOR.x, cy - MODEL_ANCHOR.y);
      const carried = carriedImage(thing.sprite, thing.facing, thing.frame, thing.carrying);
      if (carried) paintImage(carried, cx - MODEL_ANCHOR.x, cy - MODEL_ANCHOR.y);
      ctx.globalAlpha = 1;
    }});
  }
  if (placeName === "camp") campScene(scene, now, seen);
  if (placeName === "lesson") lessonScene(scene, now, seen);
  // Eight directions: the game's own sheet for straight ones, the diagonal sheet for the rest.
  const facingName = me.facing;
  const mirrored = facingName === "W" || facingName === "SW" || facingName === "NW";
  const straight = { N: "up", S: "down", E: "right", W: "left" }[facingName];
  const clothDir = straight || (mirrored ? "left" : "right");
  const sway = clothSway(cloth, clothDir, me.moving, walkClock, me.running ? 3 : 2);
  const col = me.moving ? Math.floor(walkClock / WALK_FRAME_MS) % 8 : Math.floor(now / 210) % 8;
  let sheet, row, frameCol = col, flip = mirrored;
  const knocked = me.knockedAt === null ? null : now - me.knockedAt;
  if (me.sittingOn) {
    const since = now - me.sitAt;
    sheet = sheetFor(look);
    row = LESSON_SIT_ROW; // facing the desk, as in a lesson: the side view sat beside the chair
    flip = false;
    const hand = theme?.lesson ? lessonSeatFrame(now) : null;
    if (hand !== null) {
      row = LESSON_HAND_ROW;
      frameCol = hand;
    } else if (theme?.lesson) frameCol = lesson ? lessonSeatColumn(now) : 0;
    else if (since < SIT.downMs || since > SIT.downMs + SIT.lookMs) frameCol = 0;
    else frameCol = 1 + Math.floor((since - SIT.downMs) / SIT.swingMs) % 6; // the legs swing from the seat's edge
  } else if (me.slideAt !== null) {
    sheet = sheetFor(look);
    row = SLIDE_ROW;
    frameCol = now - me.slideAt < 50 ? 0 : 1 + Math.floor((now - me.slideAt) / 70) % 3;
    flip = me.slideLeft;
  } else if (me.restAt !== null) {
    sheet = sheetFor(look);
    row = SLIDE_ROW;
    frameCol = now - me.restAt < SLIDE.restMs * 0.7 ? 4 : 5;
    flip = me.slideLeft;
  } else if (knocked !== null) {
    sheet = sheetFor(look);
    flip = false;
    if (knocked < KNOCK.sitAt) {
      row = FALL_ROW;
      frameCol = knocked < KNOCK.sitAt / 2 ? 0 : 1;
    } else if (knocked < KNOCK.wipeAt) {
      row = FALL_ROW;
      frameCol = Math.floor(knocked / 320) % 2 ? 3 : 2; // sits and blinks, dazed
    } else {
      row = WIPE_ROW;
      const beat = Math.min(WIPE_ORDER.length - 1, Math.floor((knocked - KNOCK.wipeAt) / KNOCK.wipeFrameMs));
      frameCol = WIPE_ORDER[beat];
      // Each stroke's end knocks a little dust off the cloth beside that hand.
      if ((frameCol === 3 || frameCol === 5) && beat !== me.lastPat) {
        me.lastPat = beat;
        if (dusty()) puffs.push({ x: me.x, y: me.y, born: now, count: 5, high: 9, side: frameCol === 3 ? -5 : 5, life: 480, step: true });
        playImpact("brush");
      }
    }
  } else if (me.running) {
    sheet = sheetFor(look);
    row = RUN_ROWS + RUN_FACING[facingName] * RUN_SWAYS + sway + 3;
  } else if (me.jumpedAt !== null) {
    const t = (now - me.jumpedAt) / JUMP.ms;
    sheet = sheetFor(look);
    row = JUMP_ROWS[facingName];
    frameCol = t < 0.35 ? 0 : t < 0.65 ? 1 : 2;
  } else if (crouching && me.moving && !action) {
    sheet = sheetFor(look);
    row = CROUCH_WALK_ROWS + RUN_FACING[facingName];
  } else if (action || crouching) {
    sheet = sheetFor(look);
    [row, frameCol] = playerFrame(now);
    flip = !!action?.flip;
  } else if (straight) {
    sheet = sheetFor(look);
    row = !me.moving && sway === 0 && straight in LIFT_ROW && Math.abs(cloth.y) > CLOTH.liftAt
      ? LIFT_ROW[straight]
      : poseRow(me.moving, straight, sway);
  } else {
    sheet = sheetFor(look);
    row = DIAGONAL_ROWS + ((me.moving ? 2 : 0) + (facingName.startsWith("N") ? 1 : 0)) * 5 + sway + 2;
  }
  if (!me.hidden) scene.push({ d: me.x + me.y, box: [footX - 20, footY - 46, footX + 20, footY + 10], paint: () => {
    // Sitting, the drawing already has them at seat height.
    const cx = footX, ground = footY, cy = footY - Math.round(me.height) - (me.sittingOn ? SIT.seatUp : 0);
    ctx.fillStyle = SHADOW;
    // In the air the shadow stays on the ground, and gets smaller and fainter.
    ctx.globalAlpha = 0.34 - me.height * 0.01;
    castShadow(ctx, cx - 3, ground + 2, 19 - Math.round(me.height * 0.4), 7 - Math.round(me.height * 0.15));
    ctx.globalAlpha = 1;
    if (!sheet.complete) return;
    const carried = carriedBasket();
    if (carried && !carried[2]) paintCarried(cx, cy, carried);
    ctx.imageSmoothingEnabled = shrinking;
    if (ctx.gpu) ctx.casting = true;
    if (flip) {
      ctx.save();
      ctx.translate(cx + 12, cy + 4 - FRAME_H);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sheetX(frameCol, row), sheetY(row), FRAME_W * SHEET_DETAIL, FRAME_H * SHEET_DETAIL, 0, 0, FRAME_W, FRAME_H);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sheetX(frameCol, row), sheetY(row), FRAME_W * SHEET_DETAIL, FRAME_H * SHEET_DETAIL, cx - 12, cy + 4 - FRAME_H, FRAME_W, FRAME_H);
    }
    ctx.imageSmoothingEnabled = shrinking && !!MADE_GROUNDS[placeName];
    paintTalkingMouth(ctx, row, frameCol, cx - 12, cy + 4 - FRAME_H, flip, 1, now);
    if (carried && carried[2]) paintCarried(cx, cy, carried);
    if (placeName === "camp") {
      campFireShadow(me.x, me.y, 22);
      campRim(sheet, sheetX(frameCol, row), sheetY(row), FRAME_W * SHEET_DETAIL, FRAME_H * SHEET_DETAIL, cx - 12, cy + 4 - FRAME_H, FRAME_W, FRAME_H, me.x, me.y, flip);
      campPaintHeld(cx, cy, now, flip);
    }
  }});
  // Foot dust lies on the ground where the foot landed, so someone walking towards the viewer leaves it behind them.
  for (const puff of puffs) {
    if (isFootDust(puff)) scene.push({ d: puff.x + puff.y - 0.01, box: [isoX(puff.x, puff.y) - 16, isoY(puff.x, puff.y) - 16, isoX(puff.x, puff.y) + 16, isoY(puff.x, puff.y) + 16], paint: () => paintPuff(puff, now) });
  }
  // A tile made into the floor's pictures is there already, and is only drawn again to cover what's behind it. Without a box a thing could be anywhere.
  const before = scene.length;
  for (const tile of madeTilesNow) {
    const [x0, y0, x1, y1] = tile.box;
    for (let i = 0; i < before; i++) {
      const { d, box, inFixture } = scene[i];
      if (!inFixture && d < tile.d && (!box || (box[0] < x1 && box[2] > x0 && box[1] < y1 && box[3] > y0))) {
        scene.push(tile);
        break;
      }
    }
  }
  scene.sort((a, b) => a.d - b.d);
  for (const item of scene) item.paint();

  // Stars around the head while sitting on the ground.
  if (knocked !== null && knocked >= KNOCK.sitAt && knocked < KNOCK.wipeAt) {
    for (let i = 0; i < 3; i++) {
      const angle = now / 170 + (i * Math.PI * 2) / 3;
      const x = footX + Math.round(Math.cos(angle) * 9), y = footY - 25 + Math.round(Math.sin(angle) * 3);
      ctx.fillStyle = "#ffe08a";
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = "#fffbe0";
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Dust from sitting down or brushing the gákti stays in front; foot dust was drawn in the scene above.
  for (let p = puffs.length - 1; p >= 0; p--) {
    const puff = puffs[p];
    if (now - puff.born >= (puff.life || 420)) {
      puffs.splice(p, 1);
      continue;
    }
    if (!isFootDust(puff)) paintPuff(puff, now);
  }

  sparkles = sparkles.filter((sp) => now - sp.born < 700);
  for (const sp of sparkles) {
    const age = (now - sp.born) / 700;
    const sx = isoX(sp.x + 0.5, sp.y + 0.5), sy = isoY(sp.x + 0.5, sp.y + 0.5) - 8;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + age;
      const r = 3 + age * 16;
      ctx.fillStyle = i % 2 ? "#fff3b0" : "#ffc93c";
      ctx.fillRect(Math.round(sx + Math.cos(angle) * r), Math.round(sy + Math.sin(angle) * r * 0.6 - age * 6), age > 0.6 ? 1 : 2, age > 0.6 ? 1 : 2);
    }
  }

  // Drifting specks of light, for the open air of the forest only.
  for (let i = 0; i < (placeName === "forest" ? 8 : 0); i++) {
    // Fixed in the world and not on the screen, so that they don't swim against the ground as the camera moves.
    const wrap = (value, size) => ((value % size) + size) % size;
    const x = wrap(noise(i, 4) * 1200 + now / (160 + i * 16) + Math.sin(now / 2400 + i) * 5 - camX, VIEW_W + 40);
    const y = wrap(noise(i, 8) * 900 + Math.sin(now / 1900 + i * 2) * 5 + now / (420 + i * 30) - camY, VIEW_H + 40);
    ctx.fillStyle = i % 3 ? "rgba(255, 250, 215, 0.42)" : "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(camX + x - 20, camY + y - 20, 0.6, 0.6);
  }
  if (placeName === "camp") paintCampNight(now, camX, camY);
  if (location.hash === "#fps") paintFrameRate(now, camX, camY);
  if (MADE_GROUNDS[placeName] && !ctx.gpu) keepItSmooth(now); // the GPU turns its effects down instead
  if (placeName === "lesson") paintLessonWarmth(camX, camY);
  ctx.restore();
  // Home has a warm light over everything.
  if (placeName === "home") {
    ctx.fillStyle = "rgba(255, 176, 96, 0.08)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (ctx.gpu) ctx.present();
}

loadPlace("forest");
