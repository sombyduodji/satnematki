// Pixel art as text: one character is one pixel, "." is transparent.
// The characters are drawn by tools/make_mahtte.py, the trees in world.js.
const PALETTE = {
  k: "#2b2b3a", w: "#ffffff", b: "#8a5a2b", B: "#5c3a1e", g: "#a4aab0", G: "#6b7075",
  r: "#c8372d", y: "#f2c14e", u: "#2f6fc2", U: "#1f4a8a", c: "#8fd3ff", s: "#f0c8a0",
  o: "#e08a2e", n: "#3e8e41", N: "#2b6a30", t: "#c9a877", e: "#efe3c8", h: "#4a2f1a",
  f: "#dc7a2c", O: "#a4672e", p: "#f3a8b0", P: "#c97a88", R: "#8e1f22", Y: "#c99a28",
};
// A thing that comes in many colours is drawn with 1, 2 and 3: the colour, its shadow and its light.
const COLOURS = {
  red: { 1: "#d13a30", 2: "#8e2024", 3: "#ee6a58" },
  blue: { 1: "#2f6fc2", 2: "#1f4a8a", 3: "#62a0e6" },
  yellow: { 1: "#f2c630", 2: "#b98c18", 3: "#ffe680" },
  green: { 1: "#3a9a48", 2: "#22702f", 3: "#6fc774" },
  white: { 1: "#eeeee6", 2: "#b5b5ae", 3: "#ffffff" },
  black: { 1: "#3a3a48", 2: "#22222c", 3: "#62626f" },
  grey: { 1: "#9a9ea6", 2: "#6c7078", 3: "#c6cad0" },
};

const SPRITES = {
  viessu: [
    "....kkkkkkkk....",
    "...krrrrrrrrk.BB",
    "..krrrrrrrrrrkBB",
    ".krrrrrrrrrrrrk.",
    "krrrrrrrrrrrrrrk",
    "kkkkkkkkkkkkkkkk",
    ".tttttttttttttt.",
    ".tcctttttttcctt.",
    ".tcctttBBttcctt.",
    ".tttttBBBBttttt.",
    ".tttttBBBBttttt.",
    ".tttttBBBBttttt.",
  ],
  goahti: [
    ".......BB.......",
    "......B..B......",
    "......gggg......",
    ".....gggggg.....",
    ".....gggggg.....",
    "....gggggggg....",
    "....gggggggg....",
    "...gggggGgggg...",
    "...ggggGkGggg...",
    "..gggggGkGgggg..",
    "..ggggGkkkGggg..",
    ".gggggGkkkGgggg.",
    ".gggggGkkkGgggg.",
  ],
  geadgi: [
    "................",
    "................",
    ".....gggg.......",
    "...ggggggggg....",
    "..gggwgggggGG...",
    ".gggggggggggGG..",
    ".ggggggggggGGG..",
    "gggggggggGGGGGG.",
    "gGgggggggGGGGGG.",
    ".GGGGGGGGGGGGG..",
  ],
  fanas: [
    "................",
    ".......B........",
    ".......B........",
    ".......B........",
    ".......B........",
    "b......B.......b",
    "bb.............b",
    "tbbbbbbbbbbbbbbt",
    "tttttttttttttttb",
    ".bbbbbbbbbbbbbb.",
    "..BBBBBBBBBBBB..",
    "...BBBBBBBBBB...",
  ],
  girji: [
    "................",
    "..rrrrrrrrrrrr..",
    "..rrrrrrrrrrrr..",
    "..rryyyyyyyyrr..",
    "..rryrrrrrryrr..",
    "..rrrrrrrrrrrr..",
    "..rrryyyyyyrrr..",
    "..rrrrrrrrrrrr..",
    "..rrrrrrrrrrrr..",
    "..rrrrrrrrrrrr..",
    "..eeeeeeeeeeee..",
    "..BBBBBBBBBBBB..",
  ],
  biila: [
    "................",
    "................",
    "....uuuuuuuu....",
    "...ucccuucccu...",
    "..uucccuucccuu..",
    ".uuuuuuuuuuuuuu.",
    "yuuuuuuuuuuuuuuu",
    "yuuuuuuuuuuuuuur",
    "uuuUUUuuuuUUUuuu",
    "...kkk....kkk...",
    "...kgk....kgk...",
    "...kkk....kkk...",
  ],
  skuter: [
    "................",
    "..........kk....",
    ".........k......",
    "cc.......k......",
    ".ccrrr...k......",
    "..crrrrrrrkkkkk.",
    "..rrrrrrrrrkkkk.",
    ".rrrrrrrrrrrrkk.",
    "rrrrrrrrrrrrrrr.",
    "..k..kkkkkkkkkk.",
    ".G.......kGGGkk.",
    "GGGGGGG..kkkkkk.",
  ],




};

const SPRITE_SIZE = 18; // 16 pixels plus one on each side for the outline; vehicles are wider
const OUTLINE = "#1b1420";

function spriteCanvas(rows, colour) {
  const wide = Math.max(16, ...rows.map((row) => row.length));
  const palette = colour ? { ...PALETTE, ...COLOURS[colour], c: "#8fd3ff" } : PALETTE;
  const canvas = document.createElement("canvas");
  canvas.width = wide + 2;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d");
  const top = 16 - rows.length; // everything stands on the bottom edge of its tile
  const solid = (x, y) => rows[y]?.[x] && rows[y][x] !== ".";
  ctx.fillStyle = OUTLINE;
  for (let y = -1; y <= rows.length; y++) {
    for (let x = -1; x <= wide; x++) {
      if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) {
        ctx.fillRect(x + 1, top + y + 1, 1, 1);
      }
    }
  }
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x + 1, top + y + 1, 1, 1);
    });
  });
  return canvas;
}
