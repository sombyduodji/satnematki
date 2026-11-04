// Animals and things as small 3D models, each a list of boxes facing +y: [x0, x1, y0, y1, z0, z1, colour].
// x and y are in 16ths of a tile, which is about one pixel on screen, and z is in pixels above the ground.
// Most are built from the smooth shapes below, the rest from boxes. Each takes a frame: 0 stands, 1 and 2 are the two steps of a walk, for a bird 3 and 4 are its wingbeat and 5 is a peck,
// and for the dog 5 and 6 are its wagging tail.
const animalBox = (x0, x1, y0, y1, z0, z1, colour) => [x0, x1, y0, y1, z0, z1, colour];
// A box centred across the animal.
const across = (half, y0, y1, z0, z1, colour) => animalBox(-half, half, y0, y1, z0, z1, colour);
// The same box on both sides.
const bothSides = (x0, x1, y0, y1, z0, z1, colour) => [animalBox(x0, x1, y0, y1, z0, z1, colour), animalBox(-x1, -x0, y0, y1, z0, z1, colour)];

// A left and a right copy of something.
const sides = (make) => [make(1), make(-1)];

// Four legs seen from a stride: frames 1 and 2 swing opposite pairs.
function legs(x, y, height, r, colour, frame) {
  const stride = frame === 1 ? 1.6 : frame === 2 ? -1.6 : 0;
  return [[x, y, stride], [-x, y, -stride], [x, -y, -stride], [-x, -y, stride]].map(([lx, ly, swing]) =>
    tube([lx, ly, height], [lx, ly + swing, r * 0.9 + (swing > 0 ? 0.5 : 0)], r, r * 0.9, colour));
}

function birdLegs(x, height, colour, frame) {
  return sides((s) => tube([s * x, 0, height], [s * x, 0.6, (s > 0 ? frame === 1 : frame === 2) ? 1 : 0.3], 0.4, 0.3, colour));
}

// Folded at the sides on the ground, spread in frame 3 and raised in frame 4.
function birdWings(x, y, z, span, frame, colour) {
  if (frame === 3) return sides((s) => ball(s * (x + span / 2), y, z, span / 2 + 0.5, 2.6, 0.5, colour));
  if (frame === 4) return sides((s) => tube([s * x, y, z], [s * (x + span * 0.5), y, z + span * 0.7], 1.8, 0.6, colour));
  return sides((s) => ball(s * x, y, z - 0.4, 0.8, 3, span > 6 ? 4.4 : 2, colour));
}

const eyes = (x, y, z, r = 0.7, colour = "#22222c") => sides((s) => ball(s * x, y, z, r, r, r, colour));

// Marks shapes that turn with the head and not the body.
const asHead = (shapes) => shapes.map((shape) => ({ ...shape, head: true }));

const MODELS = {
  boazu: (frame) => [
    ...legs(2.6, 5.5, 7, 0.95, "#5f4a34", frame),
    ball(0, 0, 10, 3.9, 8.2, 4, "#8a6a48"),
    ball(0, -7, 10.6, 2.6, 2, 2.6, "#efe6d4"),
    tube([0, 6, 11], [0, 9.5, 16], 3, 2.2, "#efe6d4"),
    ball(0, 11, 16.5, 2, 3.8, 2.2, "#8a6a48"),
    ball(0, 14, 15.5, 1.3, 1.6, 1.2, "#5f4a34"),
    ...eyes(2, 11.5, 17.3),
    ...sides((s) => ball(s * 2.4, 9.5, 18.2, 1.2, 0.6, 0.6, "#5f4a34")),
    ...sides((s) => tube([s * 1.3, 10, 18.5], [s * 2.8, 8.5, 24], 0.5, 0.4, "#5c3a1e")),
    ...sides((s) => tube([s * 2.2, 9, 22], [s * 2.2, 12, 24], 0.45, 0.35, "#5c3a1e")),
    ...sides((s) => tube([s * 2.8, 8.5, 24], [s * 4.5, 7, 26], 0.4, 0.3, "#5c3a1e")),
  ],
  beana: (frame) => {
    const wag = frame === 5 ? 1 : frame === 6 ? -1 : 0;
    return [
      ...legs(1.6, 4, 4.6, 0.9, "#8f6a42", frame > 2 ? 0 : frame),
      ball(0, 0, 6.7, 2.9, 6.5, 2.9, "#b88a5a"),
      ball(0, 4.5, 6, 2, 1.8, 2.2, "#d6b48a"),
      tube([0, -6, 8], [wag * 3, -9, 13], 0.85, 0.5, "#8f6a42"),
      ball(0, 7.5, 10, 2.6, 3, 2.6, "#b88a5a"),
      tube([0, 9.5, 9.5], [0, 12, 9], 1.4, 1.1, "#d6b48a"),
      ball(0, 12.7, 9.3, 0.8, 0.5, 0.7, "#22222c"),
      ...eyes(2.2, 8.6, 10.8),
      ...sides((s) => tube([s * 2, 7, 12], [s * 2.8, 6.5, 9.2], 1, 0.8, "#7a5a38")),
    ];
  },
  loddi: (frame) => {
    const down = frame === 5 ? 3.5 : 0, on = frame === 5 ? 1.5 : 0; // pecking, the head goes down and forward
    return [
      ...(frame === 3 || frame === 4 ? [] : birdLegs(1, 3.2, "#c9842e", frame)),
      ball(0, 0, 6, 2.8, 4.2, 3.2, "#4d7fb0"),
      ball(0, 2.2, 5.4, 2, 2.4, 2.3, "#d9552e"),
      tube([0, -3.5, 6], [0, -8, 7.5 + on], 1, 0.6, "#2f5578"),
      ...birdWings(2.5, -0.5, 6.4, 5, frame, "#2f5578"),
      ball(0, 3 + on, 9 - down, 2.3, 2.4, 2.3, "#4d7fb0"),
      tube([0, 5 + on, 8.8 - down], [0, 7 + on, 8.2 - down], 0.6, 0.2, "#f2c14e"),
      ...eyes(2, 3.8 + on, 9.6 - down),
    ];
  },
  njoammil: (frame) => [
    ...sides((s) => ball(s * 2.6, -3, 3 - (frame === 1 ? 0 : 0.6), 1.4, 3, 2.4, "#c9c5b8")),
    ...sides((s) => tube([s * 1.3, 3, 4], [s * 1.3, 3.8 + (frame === 1 ? 1.5 : 0), 0.7], 0.75, 0.65, "#c9c5b8")),
    ball(0, -0.5, 5.8, 3.2, 5.2, 3.6, "#ddd9cd"),
    ball(0, -6, 6.5, 1.6, 1.4, 1.6, "#ffffff"),
    ball(0, 5, 9.5, 2.4, 3, 2.4, "#ddd9cd"),
    ball(0, 7.7, 9.2, 0.7, 0.5, 0.6, "#d98a94"),
    ...eyes(2.1, 5.8, 10.3),
    ...sides((s) => tube([s * 1, 4, 11.5], [s * 1.4, 2.5, 18], 1, 0.7, "#c9c5b8")),
    ...sides((s) => tube([s * 1, 4.4, 12.5], [s * 1.4, 3.1, 17], 0.45, 0.35, "#e8b8c0")),
  ],
  guovza: (frame) => [
    ...legs(3.2, 6, 6, 1.6, "#4a3019", frame),
    ball(0, -1, 10, 5.5, 9.5, 6, "#6e4a2c"),
    ball(0, 2.5, 14, 4.2, 4, 3, "#7a5433"),
    ball(0, 10, 11.5, 3.8, 4, 3.6, "#6e4a2c"),
    tube([0, 12, 10.5], [0, 15, 10], 2, 1.6, "#b89268"),
    ball(0, 16.2, 10.6, 1, 0.6, 0.8, "#22222c"),
    ...eyes(2.8, 12, 12.6),
    ...sides((s) => ball(s * 3, 9, 15, 1.4, 1, 1.4, "#4f341f")),
  ],
  rieban: (frame) => [
    ...legs(1.3, 3.5, 4.6, 0.65, "#3a2a22", frame),
    tube([0, -5.5, 6.5], [0, -10, 5.8], 0.8, 1.8, "#d9772a"),
    tube([0, -10, 5.8], [0, -13, 5.8], 1.8, 1.4, "#d9772a"),
    ball(0, -14.2, 5.8, 1.3, 1.6, 1.2, "#ffffff"),
    ball(0, 0, 6.3, 2.2, 6, 2.4, "#d9772a"),
    ball(0, 4.5, 5.6, 1.6, 1.8, 1.9, "#ffffff"),
    ball(0, 6.7, 9, 2.3, 2.6, 2.2, "#d9772a"),
    tube([0, 8, 8.4], [0, 12, 7.8], 1.4, 0.5, "#ffffff"),
    ball(0, 12.5, 7.9, 0.55, 0.4, 0.5, "#22222c"),
    ...eyes(2, 7.8, 9.8),
    ...sides((s) => tube([s * 1.4, 6.5, 10.6], [s * 1.7, 6.2, 14], 1, 0.25, "#d9772a")),
    ...sides((s) => tube([s * 1.6, 6.3, 12.8], [s * 1.7, 6.2, 14], 0.5, 0.25, "#3a2a22")),
  ],
  oarri: (frame) => {
    const rise = frame === 1 ? 1 : 0; // sits up a little between hops
    return [
      ...sides((s) => ball(s * 1.6, 0.8, 0.8, 1.1, 2.2, 0.8, "#6e3218")),
      ball(0, -1, 3.8, 2.6, 3, 3.4, "#a84d24"),
      ball(0, 1, 7.4 + rise, 1.9, 2, 3.4, "#a84d24"),
      ball(0, 2.3, 7 + rise, 1.2, 1, 2.6, "#f4ead6"),
      ...sides((s) => tube([s * 1.3, 2.5, 8 + rise], [s * 0.8, 3.8, 6.5 + rise], 0.55, 0.45, "#6e3218")),
      ball(0, 2.2, 11.4 + rise, 2.1, 2.4, 2, "#a84d24"),
      tube([0, 3.8, 11 + rise], [0, 5.2, 10.6 + rise], 1, 0.6, "#c9682f"),
      ball(0, 5.6, 10.8 + rise, 0.4, 0.3, 0.35, "#22222c"),
      ...eyes(1.8, 3, 12 + rise),
      ...sides((s) => tube([s * 1.2, 1.6, 13 + rise], [s * 1.4, 1.2, 15.5 + rise], 0.7, 0.2, "#6e3218")),
      // A paler, bushy tail standing clear of the back in an S, thin at the root and curling over at the top.
      tube([0, -3, 2], [0, -7, 4], 1, 2.6, "#d9783a"),
      tube([0, -7, 4], [0, -8.5, 10], 2.6, 3, "#e0883f"),
      tube([0, -8.5, 10], [0, -6, 15.5], 3, 1.8, "#ee9f55"),
      tube([0, -6, 15.5], [0, -3, 16], 1.8, 0.8, "#ee9f55"),
    ];
  },
  skuolfi: (frame) => [
    ...(frame === 3 || frame === 4 ? [] : sides((s) => ball(s * 1.6, 1, 0.7, 1.3, 1.8, 0.7, "#c9842e"))),
    ball(0, 0, 7, 4.3, 3.7, 5.6, "#8a6f4e"),
    ball(0, 2.2, 6.5, 3, 1.8, 4.4, "#e0d0ae"),
    ...[[-1.5, 8.5], [1.5, 8.5], [0, 6.5], [-1.5, 4.5], [1.5, 4.5]].map(([x, z]) => ball(x, 3.9, z, 0.55, 0.25, 0.55, "#6b5338")),
    tube([0, -3, 3.5], [0, -5.5, 1.5], 1.5, 1, "#5c462e"),
    ...birdWings(4, -0.3, 7.5, 10, frame, "#5c462e"),
    // A big round head that turns on its own: it looks at the player, as an owl does.
    ...asHead([
      ball(0, 0, 14, 5, 4.6, 4.4, "#8a6f4e"),
      ...sides((s) => ball(s * 2.1, 3.4, 14.4, 2.4, 1.1, 2.4, "#e0d0ae")),
      ...sides((s) => ball(s * 2.1, 4.2, 14.6, 1.4, 0.6, 1.4, "#f2c14e")),
      ...sides((s) => ball(s * 2.1, 4.7, 14.6, 0.75, 0.35, 0.75, "#22222c")),
      tube([0, 4.4, 13.2], [0, 5.2, 11.8], 0.7, 0.25, "#c9842e"),
      ...sides((s) => tube([s * 3, 0, 17], [s * 4, -0.5, 20.5], 1.1, 0.3, "#5c462e")),
    ]),
  ],
  cuoppu: (frame) => {
    const back = frame === 1 ? 2.5 : 0; // the hind legs stretch out in a hop
    return [
      ...sides((s) => ball(s * 5, -2 - back, 2, 2, 4, 1.8, "#2f8238")),
      ...sides((s) => tube([s * 3, 3.5, 2.5], [s * 4, 5.5, 0.6], 0.8, 0.7, "#2f8238")),
      ball(0, -0.5, 3.6, 4.6, 5, 3.2, "#44a64e"),
      ball(0, 3.5, 2.4, 3, 2.8, 1.6, "#d9e8b0"),
      ball(0, 3.5, 4.8, 3.4, 2.8, 2.4, "#44a64e"),
      ...sides((s) => ball(s * 2, 3.2, 7, 1.4, 1.4, 1.3, "#d9e8b0")),
      ...sides((s) => ball(s * 2.2, 4.3, 7.2, 0.7, 0.4, 0.7, "#22222c")),
    ];
  },
  sahpan: (frame) => [
    ...legs(1.1, 2, 1.2, 0.5, "#7a7a84", frame),
    ball(0, -0.5, 2.9, 2.4, 4.2, 2.6, "#9a9aa2"),
    tube([0, -4.5, 2.2], [1, -8, 1.2], 0.4, 0.3, "#d9a0a8"),
    tube([1, -8, 1.2], [-0.5, -11, 1.8], 0.3, 0.25, "#d9a0a8"),
    tube([0, 2.5, 3.6], [0, 6.5, 2.6], 2, 0.7, "#9a9aa2"),
    ball(0, 7, 2.6, 0.45, 0.35, 0.4, "#d9798a"),
    ...eyes(1.5, 4, 3.8, 0.55),
    ...sides((s) => ball(s * 1.6, 2.6, 6, 1.4, 0.4, 1.4, "#d9a0a8")),
  ],
  // Only the thin body: the wings are too fine for boxes, and drawButterflyWings in world.js draws them.
  beaiveloddi: () => [across(0.3, -2.5, 2.5, 0, 0.6, "#2b2b3a")],
  gahttu: (frame) => [
    ...legs(1.5, 3.2, 4.6, 0.75, "#6e6e78", frame),
    {
      ...ball(0, 0, 6.5, 2.4, 5.6, 2.6, "#8d8d95"),
      paint: ([, y]) => (Math.abs(((y + 20) % 3) - 1.5) < 0.5 ? "#6e6e78" : "#8d8d95"),
    },
    tube([0, -5.5, 7.5], [0, -8, 12], 0.75, 0.65, "#6e6e78"),
    tube([0, -8, 12], [0, -7, 15.5], 0.65, 0.5, "#6e6e78"),
    ball(0, 6, 10, 2.6, 2.4, 2.4, "#8d8d95"),
    ball(0, 8.2, 9.5, 0.6, 0.35, 0.45, "#d98a94"),
    ...eyes(2, 7.2, 10.6, 0.7, "#2f8238"),
    ...sides((s) => tube([s * 1.7, 5.6, 11.6], [s * 1.9, 5.4, 14.2], 1, 0.2, "#6e6e78")),
  ],
  savza: (frame) => [
    ...legs(2.2, 3.5, 3.8, 0.8, "#2b2b3a", frame),
    ball(0, 0, 7.5, 4.6, 6.4, 4.6, "#f0ede2"),
    ...[[2.5, 3, 10], [-2.5, 3, 10], [2.5, -3, 10], [-2.5, -3, 10], [0, 0, 11.5], [3.8, 0, 7.5], [-3.8, 0, 7.5], [0, -5.5, 7.5]].map(([x, y, z]) => ball(x, y, z, 2.2, 2.2, 2, "#fbf8ee")),
    ball(0, 6.5, 9, 2.2, 2.8, 2.4, "#3a3a48"),
    ball(0, 5.6, 11.2, 1.8, 1.6, 1.2, "#fbf8ee"),
    ...eyes(1.9, 7.5, 9.6, 0.6, "#f2c14e"),
    ...sides((s) => ball(s * 2.8, 5.8, 10, 1.3, 0.6, 0.6, "#3a3a48")),
  ],
  gussa: (frame) => [
    ...legs(3.2, 6.5, 7, 1.1, "#d9d4c8", frame),
    ball(0, -4, 5.8, 2, 2.2, 1.6, "#eda7a7"),
    {
      ...ball(0, 0, 11, 4.8, 9, 5, "#eeeae0"),
      paint: ([x, y, z]) => (Math.sin(x * 0.6 + y * 0.5) + Math.sin(y * 0.7 - z * 0.6) > 0.6 ? "#5f4030" : "#eeeae0"),
    },
    tube([0, -9, 13], [0, -10, 6], 0.45, 0.4, "#5f4030"),
    ball(0, -10, 5.5, 0.9, 0.9, 1.4, "#5f4030"),
    ball(0, 10, 14, 2.8, 3.8, 2.8, "#eeeae0"),
    tube([0, 12.5, 13], [0, 14, 12.6], 2, 1.8, "#eda7a7"),
    ...sides((s) => ball(s * 0.8, 15.5, 13, 0.4, 0.25, 0.4, "#22222c")),
    ...eyes(2.5, 11, 15),
    ...sides((s) => ball(s * 3.4, 8.5, 15.6, 1.4, 0.6, 0.7, "#5f4030")),
    ...sides((s) => tube([s * 1.6, 9, 16.5], [s * 2.6, 9, 19], 0.5, 0.25, "#d9c9a4")),
  ],
  spiidni: (frame) => [
    ...legs(2.1, 3.5, 3.2, 0.9, "#c97f84", frame),
    ball(0, 0, 6.6, 4, 6.6, 3.9, "#eda7a7"),
    tube([0, -6.5, 8], [1, -8, 9.5], 0.45, 0.4, "#c97f84"),
    tube([1, -8, 9.5], [0, -8.5, 10.5], 0.4, 0.35, "#c97f84"),
    ball(0, 6.4, 7.2, 3, 2.8, 2.8, "#eda7a7"),
    tube([0, 8, 6.8], [0, 10.2, 6.8], 1.8, 1.7, "#eda7a7"),
    ball(0, 11.5, 6.8, 1.7, 0.5, 1.4, "#d9798a"),
    ...sides((s) => ball(s * 0.6, 12, 6.8, 0.35, 0.2, 0.4, "#8e4a55")),
    ...eyes(2.2, 8, 8.3),
    ...sides((s) => tube([s * 2, 5.5, 9.4], [s * 3, 6.8, 11], 1.1, 0.3, "#c97f84")),
  ],
  bin: () => [
    across(4, -4, 4, 0, 13, "#3a7d44"),
    across(4.5, -4.5, 4.5, 11, 13, "#2f6636"),
    across(2.5, -2.5, 2.5, 13, 13.5, "#22222c"),
    across(2, 4, 4.5, 4, 9, "#6fc774"),
  ],
  vuonccis: (frame) => {
    const down = frame === 5 ? 5 : 0, on = frame === 5 ? 1.5 : 0;
    return [
      ...birdLegs(1.25, 3.2, "#c9842e", frame),
      ball(0, 0, 7, 3.6, 4.8, 3.8, "#f0ede2"),
      tube([0, -4, 8 + on], [0, -7, 12 + on], 2, 1, "#e0dccf"),
      ...sides((s) => ball(s * 3.4, -0.5, 7, 0.7, 3, 2.4, "#d9d4c8")),
      tube([0, 2.8, 8.5], [0, 3.6 + on, 10.5 - down], 1.8, 1.6, "#f0ede2"),
      ball(0, 3.8 + on, 12 - down, 2, 2.2, 2, "#f0ede2"),
      ...[2.8, 3.8, 4.8].map((y, i) => ball(0, y + on, 14.2 - down - (i === 1 ? 0 : 0.3), 0.55, 0.7, 0.9, "#d13a30")),
      ball(0, 6.2 + on, 10.6 - down, 0.5, 0.5, 0.9, "#d13a30"),
      tube([0, 5.6 + on, 12 - down], [0, 7.4 + on, 11.6 - down], 0.6, 0.2, "#f2c14e"),
      ...eyes(1.7, 4.6 + on, 12.5 - down),
    ];
  },
};

// Smooth shapes, for things that aren't boxes. A model of these is lit and drawn by drawRoundModel in world.js.
const ball = (x, y, z, rx, ry, rz, colour) => ({ kind: "ball", at: [x, y, z], radii: [rx, ry, rz], colour });
const tube = (from, to, r0, r1, colour) => ({ kind: "tube", from, to, r0, r1, colour });
const rounded = (x0, x1, y0, y1, z0, z1, r, colour) => ({ kind: "box", low: [x0, y0, z0], high: [x1, y1, z1], r, colour });

// Things on shelves and tables, standing still and facing +y. Those that come in colours take one from COLOURS.
const WHITE = "#f4f1e8", PAGES = "#eee8d8", DARK = "#2b2b3a", STEEL = "#b5bcc6";
Object.assign(MODELS, {
  book: (frame, colour) => {
    const c = COLOURS[colour];
    return [
      across(4, -1.25, 1.25, 0, 11.5, c[1]),
      animalBox(3.4, 4.1, -1, 1, 0.5, 11, PAGES),
      animalBox(-4.5, -3.5, -1.25, 1.25, 0, 11.5, c[2]),
      animalBox(-2.5, 3, 1.25, 1.5, 7, 9.5, c[3]),
      animalBox(-1.5, 2, 1.25, 1.5, 5.25, 6, c[3]),
    ];
  },
  pen: (frame, colour) => {
    const c = COLOURS[colour];
    return [
      tube([-5, 0, 1.4], [4.5, 0, 1.4], 1.3, 1.3, c[1]),
      tube([-7.5, 0, 1.4], [-2, 0, 1.4], 1.5, 1.5, c[2]),
      tube([-5.5, 1.5, 2], [-2.5, 1.5, 2], 0.45, 0.45, STEEL),
      tube([4.5, 0, 1.4], [7, 0, 1.4], 1.1, 0.3, STEEL),
      ball(8, 0, 1.4, 0.5, 0.4, 0.4, DARK),
    ];
  },
  pencil: (frame, colour) => {
    const c = COLOURS[colour];
    return [
      tube([-6, 0, 1.3], [4, 0, 1.3], 1.2, 1.2, c[1]),
      tube([-7, 0, 1.3], [-6, 0, 1.3], 1.25, 1.25, STEEL),
      ball(-8.5, 0, 1.3, 1.6, 1.2, 1.2, "#eda7a7"),
      tube([4, 0, 1.3], [7.5, 0, 1.3], 1.2, 0.3, "#e0c49a"),
      ball(8, 0, 1.3, 0.6, 0.35, 0.35, DARK),
    ];
  },
  notebook: (frame, colour) => {
    const c = COLOURS[colour];
    return [
      across(5, -6, 6, 0, 0.5, c[1]),
      across(4.8, -5.8, 5.8, 0.5, 1.5, PAGES),
      across(5, -6, 6, 1.5, 2, c[1]),
      animalBox(-2, 3, -3, 2, 2, 2.2, WHITE),
      ...[-4, -2, 0, 2, 4].map((y) => animalBox(-5.8, -5, y - 0.4, y + 0.4, 0, 2.5, STEEL)),
    ];
  },
  apple: () => [
    ball(0, 0, 6, 6.5, 6.5, 6, "#d6443a"),
    ball(0, 0, 11.6, 1.8, 1.8, 0.7, "#8e1f22"),
    tube([0, 0, 11], [0.8, -0.6, 14.5], 0.55, 0.45, "#5c3a1e"),
    ball(3.5, -1.5, 13.2, 3, 1.3, 0.7, "#3e8e41"),
  ],
  banana: () => {
    const curve = (y, colour) => [
      tube([-8, y, 7], [-4, y, 3], 1.2, 2.2, colour),
      tube([-4, y, 3], [4, y, 3], 2.2, 2.2, colour),
      tube([4, y, 3], [8, y, 7], 2.2, 1, colour),
      ball(8.4, y, 7.5, 0.8, 0.7, 0.7, "#4a3a22"),
    ];
    return [...curve(-2, "#e0b53a"), ...curve(2, "#f7d24e"), tube([-8.5, -2, 7.5], [-8.5, 2, 7.5], 1.1, 1.1, "#7a6a2c")];
  },
  bread: () => [
    rounded(-5, 5, -8, 8, 0, 6, 1.5, "#b9793a"),
    {
      ...tube([0, -6.5, 5.5], [0, 6.5, 5.5], 5, 5, "#c98a48"),
      // The loaf's scored top, and the pale cut end facing the viewer.
      paint: ([x, y, z]) => (y > 7.6 ? "#f0dcb0" : z > 8 && Math.abs(((y + 12) % 4) - 2) < 0.45 ? "#8e5a28" : "#c98a48"),
    },
  ],
  milk: () => [
    across(3, -3, 3, 0, 11, "#2f6fc2"),
    across(3.1, 3, 3.2, 3.5, 7.5, WHITE),
    animalBox(-1.5, 1.5, 3, 3.3, 7.5, 8.5, WHITE),
    animalBox(3, 3.1, -3, 3, 3.5, 7.5, "#dcdcd4"),
    across(3, -3, 3, 11, 12, WHITE),
    across(2, -3, 3, 12, 13, WHITE),
    across(0.75, -3.25, 3.25, 13, 15, "#dcdcd4"),
  ],
  cheese: () => [
    {
      ...rounded(-7, 7, -6.5, 6.5, 0, 8, 0.6, "#f2c94e"),
      // A wedge seen from its wide end: a triangle from above, with holes in its sides.
      cuts: [[0.55, 0.83, 0, 2.6], [0.55, -0.83, 0, 2.6]],
      holes: [[-2, 3.4, 4, 1.7], [1.5, 1.6, 2.5, 1.2], [-3.5, 3.8, 6.6, 1], [-4.5, 0, 8, 1.6], [0.5, 0.5, 8, 1.1]],
    },
  ],
  egg: () => [tube([0, 0, 4.6], [0, 0, 9.4], 4.6, 2.5, "#f6eedd")],
  potato: () => [
    ball(0, 0, 3.8, 7, 5, 3.8, "#b08b55"),
    ball(-2.5, 1, 4.4, 4, 3.5, 3.2, "#b9965c"),
    ...[[3, 3.8, 3.4], [-1.5, 3.8, 4], [1, -1, 7], [5.5, -0.5, 4.8], [-4.5, 2.5, 6]].map(([x, y, z]) => ball(x, y, z, 0.6, 0.6, 0.6, "#6e5230")),
  ],
  carrot: () => [
    tube([-5, 0, 3.4], [8, 0, 1.2], 3.3, 0.4, "#ee8a2e"),
    ...[-3, 0, 3].map((x) => ball(x, 2.2 - (x + 3) * 0.2, 4.4 - (x + 3) * 0.2, 0.9, 0.5, 0.25, "#c96a22")),
    tube([-7, 0, 3.4], [-11, -2.5, 5.5], 0.8, 0.5, "#3e8e41"),
    tube([-7, 0, 3.4], [-12, 0.5, 4], 0.8, 0.5, "#4fa653"),
    tube([-7, 0, 3.4], [-11, 3, 3], 0.8, 0.5, "#3e8e41"),
  ],
  butter: () => [
    across(3.5, -6, 6, 0, 5, "#f2d765"),
    across(3.5, -6, 0, 5, 5.2, "#f8e48a"),
    across(3.6, -6, 1.5, 0, 5.3, "#d8dbe0"),
    across(2.25, -4.5, 0, 5.3, 5.5, "#2f6fc2"),
    across(0.5, 1.5, 6, 5, 5.2, "#fbeea8"),
  ],
  // The ring sausage sold in the Nordic countries.
  sausage: () => [
    tube([-8, -2, 2.8], [-3.5, 1, 2.8], 2.7, 2.8, "#b5533f"),
    tube([-3.5, 1, 2.8], [3.5, 1, 2.8], 2.8, 2.8, "#b5533f"),
    tube([3.5, 1, 2.8], [8, -2, 2.8], 2.8, 2.7, "#b5533f"),
    tube([-9.8, -3.2, 2.8], [-11, -4, 2.8], 0.45, 0.6, "#efe6d4"),
    tube([9.8, -3.2, 2.8], [11, -4, 2.8], 0.45, 0.6, "#efe6d4"),
  ],
  berries: () => [
    ...[[-3.5, 0.5, 3.2, "#b0263a"], [3, -1.5, 3.2, "#c92f42"], [0, 3.5, 3.2, "#d13a48"], [-0.5, -3.5, 3.2, "#b0263a"], [0, 0, 8, "#d8434f"]].map(([x, y, z, colour]) => ball(x, y, z, 3.2, 3.2, 3.2, colour)),
    ...[[-3.5, 3, 5, "#6e1420"], [3, 1.2, 5, "#6e1420"], [0, 2.6, 10, "#6e1420"]].map(([x, y, z, colour]) => ball(x, y, z, 0.6, 0.6, 0.5, colour)),
    tube([0, 0, 11], [0.5, 0, 13], 0.4, 0.4, "#5c3a1e"),
    ball(2.8, -0.8, 12.6, 2.8, 1.2, 0.6, "#3e8e41"),
  ],
  icecream: () => [
    {
      ...tube([0, 0, 1], [0, 0, 10], 0.7, 3.8, "#e0ad6a"),
      paint: ([x, y, z]) => (Math.abs(((x + y + z * 2 + 40) % 3) - 1.5) < 0.4 ? "#c08a48" : "#e0ad6a"),
    },
    ball(0, 0, 12.5, 4.7, 4.7, 4.1, "#f3b8c4"),
    ball(0.5, 0.5, 16.2, 2.6, 2.6, 2.2, "#fbe3e8"),
  ],
  guolli: () => [
    {
      ...ball(0, 0, 4, 8, 2.8, 3.8, "#7f9db2"),
      paint: ([, , z]) => (z < 2.6 ? "#e3ebee" : z > 5.8 ? "#5f7f96" : "#8fa9ba"),
    },
    tube([-7, 0, 4], [-11.5, 0, 7.5], 1.1, 0.9, "#5f7f96"),
    tube([-7, 0, 4], [-11.5, 0, 0.8], 1.1, 0.9, "#5f7f96"),
    tube([-2, 0, 7.4], [2, 0, 7.4], 0.5, 0.9, "#5f7f96"),
    ball(5, 2, 5, 0.9, 0.7, 0.9, "#ffffff"),
    ball(5.3, 2.5, 5, 0.5, 0.4, 0.5, "#22222c"),
  ],
  coffee: () => [
    across(3.25, -2.25, 2.25, 0, 10.5, "#3a2a22"),
    across(3.25, -1.25, 1.25, 10.5, 12, "#2c1f18"),
    across(2.5, 2.25, 2.45, 3, 8.5, "#d13a30"),
    animalBox(-1.25, 1.25, 2.25, 2.6, 4.5, 7, "#f2c14e"),
    animalBox(3.25, 3.4, -1.5, 1.5, 4, 8, "#d13a30"),
  ],
  sugar: () => [
    across(3.25, -2.25, 2.25, 0, 10, "#f4f1e8"),
    across(2.75, -1.25, 1.25, 10, 11.5, "#e6e2d6"),
    across(3.25, 2.25, 2.4, 6, 8.5, "#2f6fc2"),
    across(1.75, 2.25, 2.5, 2.5, 5, "#62a0e6"),
  ],
  salt: () => [
    {
      ...tube([0, 0, 2.5], [0, 0, 8], 3.2, 3.2, "#2f6fc2"),
      paint: ([, , z]) => (z > 3.5 && z < 7 ? WHITE : "#2f6fc2"),
    },
    tube([0, 0, 11], [0, 0, 12.5], 2.2, 1.6, "#d6d6ce"),
  ],
});

// The home: furniture in warm colours, and a family who are busy with something. Facing +y as built.
const WOOD = "#a9743f", WOOD_DARK = "#7a4c28", ENAMEL = "#f2efe6", SKIN = "#eabf9f";

// A face looking along +y, with its own hair in front of or behind it.
const head = (z, hair, r = 3.5) => asHead([
  ...hair,
  ball(0, 0, z, r, r * 0.97, r, SKIN),
  ...sides((s) => ball(s * r * 0.37, r * 0.86, z + 0.4, 0.55, 0.3, 0.6, "#22222c")),
  ball(0, r * 0.94, z - r * 0.34, 0.8, 0.2, 0.3, "#b55a4a"),
]);

// Sitting on something z high, with feet on the floor.
const sittingLegs = (z, colour) => sides((s) => [
  tube([s * 1.5, 0, z], [s * 1.5, 4, z], 1.6, 1.4, colour),
  tube([s * 1.5, 4, z], [s * 1.5, 5, 1.2], 1.3, 1.1, colour),
  ball(s * 1.5, 5.8, 0.9, 1.2, 1.8, 0.9, "#3a3a48"),
]).flat();

Object.assign(MODELS, {
  sofa: () => [
    rounded(-19, 19, -8, 8, 0.6, 8, 2, "#a8483a"),
    rounded(-19, 19, -8, -3, 3, 17, 2.5, "#b5533f"),
    ...sides((s) => rounded(s * 21 - 3.5, s * 21 + 3.5, -8, 8, 0.6, 12, 2.5, "#953d32")),
    ...[-9, 9].map((x) => rounded(x - 8.5, x + 8.5, -3, 8.4, 7, 10, 1.4, "#c4604a")),
    ...[-9, 9].map((x) => rounded(x - 7.5, x + 7.5, -4.5, -2.5, 10, 16, 1, "#c4604a")),
    ball(-14, -1, 12.5, 3, 1.4, 2.8, "#f2c14e"),
  ],
  tv: (frame) => [
    rounded(-10, 10, -4, 4, 0, 6, 0.8, WOOD),
    tube([0, 0, 6], [0, 0, 8], 1.2, 1.2, "#2c2c36"),
    {
      ...rounded(-11, 11, -1.2, 1.2, 8, 22, 0.7, "#2c2c36"),
      // The screen, showing something that changes.
      paint: ([x, y, z]) => (y < 0.9 || Math.abs(x) > 9.8 || z < 9.2 || z > 20.8 ? "#2c2c36"
        : frame ? (z > 15 ? "#7fc4e8" : "#5fa860") : (x > 0 ? "#f2c14e" : z > 14 ? "#7fc4e8" : "#d0604a")),
    },
  ],
  table: () => [
    ...sides((s) => [-1, 1].map((e) => tube([s * 14, e * 8, 0.5], [s * 14, e * 8, 9], 0.9, 0.9, WOOD_DARK))).flat(),
    rounded(-17, 17, -11, 11, 9, 11, 0.6, WOOD),
    tube([-5, -1, 11.5], [-5, -1, 13.5], 1.5, 1.5, "#f4f1e8"),
    ball(5, 2, 12, 4, 4, 1.2, "#f4f1e8"),
    ball(5, 2, 13, 2.2, 2.2, 0.9, "#d6443a"),
  ],
  chair: () => [
    ...sides((s) => [-1, 1].map((e) => tube([s * 4, e * 4, 0.5], [s * 4, e * 4, 7], 0.6, 0.6, WOOD_DARK))).flat(),
    rounded(-5, 5, -5, 5, 7, 8.5, 0.5, WOOD),
    ...sides((s) => tube([s * 4, -4.5, 8], [s * 4, -4.5, 17], 0.6, 0.6, WOOD_DARK)),
    rounded(-5, 5, -5.2, -3.8, 12, 17.5, 0.5, WOOD),
  ],
  stove: () => [
    rounded(-8, 8, -7.5, 7.5, 0, 15, 0.8, ENAMEL),
    rounded(-6.5, 6.5, 7.5, 7.8, 2.5, 10, 0.1, "#3a3a48"),
    rounded(-5.5, 5.5, 7.8, 8.6, 10.5, 11.2, 0.2, STEEL),
    rounded(-8, 8, -7.5, 7.5, 15, 15.5, 0.2, "#2c2c36"),
    ...[-4, 0, 4].map((x) => ball(x, 8, 13, 0.7, 0.4, 0.7, "#55555f")),
    tube([-3.5, 0, 16], [-3.5, 0, 19.5], 3.6, 3.6, "#c8372d"),
    ball(-3.5, 0, 23.2, 3.4, 3.4, 0.7, "#a82a24"),
    tube([3.5, -3, 16], [6, -3, 16], 2, 2, "#3a3a48"),
  ],
  cupboard: () => [
    rounded(-12, 12, -6, 6, 0, 22, 0.8, "#c98f58"),
    rounded(-12, 12, -6, 6, 22, 23, 0.3, "#e6d3b0"),
    ...[-6, 6].map((x) => rounded(x - 5.2, x + 5.2, 6, 6.2, 1.5, 20.5, 0.1, "#dba66e")),
    ...[-1.5, 1.5].map((x) => ball(x, 6.6, 11.5, 0.5, 0.5, 1, "#5c3a1e")),
    tube([-6, 0, 24], [-6, 0, 26], 2, 2.4, "#3e8e41"),
  ],
  fridge: () => [
    rounded(-7.5, 7.5, -7, 7, 0, 29, 1.5, ENAMEL),
    rounded(-7.5, 7.5, 7, 7.2, 19, 19.5, 0.05, "#a4aab0"),
    tube([-5, 7.6, 21], [-5, 7.6, 26], 0.45, 0.45, "#8d95a3"),
    tube([-5, 7.6, 8], [-5, 7.6, 17], 0.45, 0.45, "#8d95a3"),
    ball(3, 7.2, 24, 1, 0.2, 1, "#d6443a"),
    ball(0, 7.2, 12, 1.5, 0.2, 1, "#2f6fc2"),
  ],
  // A chest freezer, low and white with frost on its lid, so it's not taken for the fridge.
  freezer: () => [
    rounded(-11, 11, -7, 7, 0, 12, 1.2, "#dfe9ee"),
    {
      ...rounded(-11.5, 11.5, -7.5, 7.5, 12, 14, 0.8, "#c7deea"),
      paint: ([x, y]) => (Math.abs(((x + y + 40) % 6) - 3) < 0.4 || Math.abs(((x - y + 40) % 6) - 3) < 0.4 ? "#f4fbff" : "#b8d8e8"),
    },
    rounded(-3, 3, 7.5, 8.4, 10, 12.5, 0.3, "#8d95a3"),
  ],
  toilet: () => [
    rounded(-5, 5, -9, -4, 0.5, 16, 1, ENAMEL),
    tube([0, -2, 0.5], [0, 1, 5], 3, 3.8, ENAMEL),
    ball(0, 1.5, 7.5, 5.2, 6.5, 2, ENAMEL),
    ball(0, 1.5, 9.3, 4.6, 5.8, 0.7, "#dfe3e6"),
    ball(0, -7, 16.5, 1, 1, 0.5, "#b5bcc6"),
  ],
  bathtub: () => [
    rounded(-10.5, 10.5, -20, 20, 0.5, 12, 3, ENAMEL),
    rounded(-8.5, 8.5, -18, 18, 11, 12.4, 1.5, "#7fc4e8"),
    ball(-3, -4, 12.5, 2, 2, 0.8, "#ffffff"),
    ball(3, 6, 12.5, 2.4, 2.4, 0.8, "#ffffff"),
    tube([0, -19, 12], [0, -19, 16], 0.7, 0.7, STEEL),
    tube([0, -19, 16], [0, -15.5, 15], 0.7, 0.5, STEEL),
    ball(4, 11, 13.4, 1.6, 1.6, 1.4, "#f2c14e"),
    ball(4, 12.4, 15.2, 1, 1, 1, "#f2c14e"),
  ],
  shower: () => [
    rounded(-9, 9, -9, 9, 0, 1.6, 0.6, ENAMEL),
    rounded(-9, 9, -9, -8, 1, 30, 0.2, "#c0dcea"),
    rounded(-9, -8, -9, 9, 1, 30, 0.2, "#aed0e0"),
    tube([-6, -6, 2], [-6, -6, 28], 0.5, 0.5, STEEL),
    tube([-6, -6, 28], [-2, -2, 28], 0.5, 0.5, STEEL),
    ball(-1, -1, 27, 2.4, 2.4, 0.7, STEEL),
    ...[[-2, -1, 22], [0, 0, 18], [-1, 1, 13], [1, -1, 9], [0, 2, 5]].map(([x, y, z]) => ball(x, y, z, 0.35, 0.35, 1, "#7fc4e8")),
    {
      ...rounded(6, 7, -9, 8, 3, 30, 0.2, "#f2c14e"),
      paint: ([, y]) => (Math.abs(((y + 40) % 5) - 2.5) < 1 ? "#e6a93a" : "#f2c94e"),
    },
    tube([6.5, -9, 30], [6.5, 9, 30], 0.4, 0.4, STEEL),
  ],
  sink: () => [
    tube([0, -2, 0.5], [0, -2, 10], 1.8, 2.4, ENAMEL),
    ball(0, 0, 12, 7, 6, 2.8, ENAMEL),
    ball(0, 0, 14, 5.4, 4.4, 0.9, "#a8d0e0"),
    tube([0, -5, 13.5], [0, -5, 17], 0.6, 0.6, STEEL),
    tube([0, -5, 17], [0, -2.5, 16], 0.6, 0.45, STEEL),
    ball(4.5, -5, 14.8, 1.2, 0.9, 0.7, "#f2c14e"),
  ],
  washer: () => [
    rounded(-8, 8, -7, 7, 0, 18, 1, ENAMEL),
    ball(0, 7, 8.5, 4.8, 0.7, 4.8, "#a4aab0"),
    ball(0, 7.4, 8.5, 3.6, 0.7, 3.6, "#5a90b0"),
    ball(-1, 7.9, 9.5, 1.2, 0.3, 1, "#c6e4f2"),
    rounded(-6.5, -1, 7, 7.3, 15, 17, 0.1, "#b5bcc6"),
    ball(5, 7.2, 16, 1, 0.3, 1, "#8d95a3"),
  ],
  mirror: () => [
    rounded(-5, 5, -1.2, 1.2, 0.6, 27, 1.2, WOOD),
    {
      ...rounded(-3.7, 3.7, 1, 1.5, 2.5, 25.5, 0.2, "#bfe0ee"),
      paint: ([x, , z]) => (Math.abs(x + z / 3 - 5) < 1 ? "#f0fbff" : "#a8d4e8"),
    },
    ...sides((s) => tube([s * 3.5, 0, 0.5], [s * 4.5, 3, 0.4], 0.6, 0.6, WOOD_DARK)),
  ],
  bookcase: () => [
    rounded(-14, 14, -5, 5, 0, 25, 0.5, WOOD_DARK),
    {
      ...rounded(-13, 13, 4.8, 5.3, 1, 24, 0.1, "#46291a"),
      // Rows of books between the shelves, not quite filling them.
      paint: ([x, , z]) => {
        const row = Math.floor((z - 1) / 7.7), height = (z - 1) % 7.7;
        if (height < 0.9) return WOOD_DARK;
        const n = Math.floor((x + 40 + row * 3) / 2.2);
        const colours = ["#d13a30", "#2f6fc2", "#f2c14e", "#3a9a48", "#eeeee6", "#6a3a8a", "#e08a2e"];
        return height < 6.4 - (n * 37 % 3) * 0.7 ? colours[(n * 5 + row) % colours.length] : "#46291a";
      },
    },
  ],
  lamp: () => [
    ball(0, 0, 1, 4, 4, 1, WOOD_DARK),
    tube([0, 0, 1], [0, 0, 22], 0.6, 0.6, "#7a6a3e"),
    tube([0, 0, 28], [0, 0, 22], 2.8, 5.4, "#f7d27a"),
    ball(0, 0, 23, 2.2, 2.2, 1.2, "#fff5cc"),
  ],
  // Woven stripes, as on a raanu. Lying flat, so it's walked on.
  rug: () => [{
    ...rounded(-23, 23, -17, 17, 0, 0.9, 0.3, "#a8483a"),
    paint: ([, y]) => ["#a8483a", "#e6c15a", "#a8483a", "#3f6c9a", "#f0e6cf", "#3f6c9a", "#a8483a", "#e6c15a", "#a8483a"][Math.min(8, Math.floor((y + 17) / 3.78))],
  }],
  flower: () => [
    tube([0, 0, 0.5], [0, 0, 6], 2.8, 3.8, "#c0683c"),
    ball(0, 0, 6.3, 3.5, 3.5, 0.5, "#3e2a1a"),
    tube([0, 0, 6], [0.5, 0, 14], 0.45, 0.4, "#3e8e41"),
    ball(3, 0.5, 10, 3, 1.2, 0.5, "#3e8e41"),
    ball(-2.5, 0, 12, 2.6, 1.2, 0.5, "#4fa653"),
    ...[0, 1, 2, 3, 4].map((i) => ball(0.5 + Math.cos(i * 1.257) * 2.4, 0, 15.5 + Math.sin(i * 1.257) * 2.4, 1.7, 0.7, 1.7, "#e8588a")),
    ball(0.5, 0.6, 15.5, 1.2, 0.6, 1.2, "#f2c14e"),
  ],
  bed: () => [
    rounded(-13, 13, -21, 21, 0.5, 6, 1, WOOD),
    rounded(-13.5, 13.5, -22.5, -20.5, 0.5, 16, 1, WOOD_DARK),
    rounded(-12, 12, -20, 20, 5, 9, 1.8, "#f4f1e8"),
    {
      ...rounded(-12.7, 12.7, -7, 20.5, 5.5, 10, 2, "#5a8fb5"),
      paint: ([x, y]) => (Math.abs(((x + y + 60) % 8) - 4) < 1 ? "#7fb0d0" : "#5a8fb5"),
    },
    ball(-5.5, -15, 10, 5, 3.5, 1.8, "#ffffff"),
    ball(5.5, -15, 10, 5, 3.5, 1.8, "#fff4d8"),
  ],
  wardrobe: () => [
    rounded(-13, 13, -6.5, 6.5, 0, 31, 0.8, "#8e6a4a"),
    rounded(-14, 14, -7, 7, 31, 32.5, 0.4, "#6b4e36"),
    ...[-6.5, 6.5].map((x) => rounded(x - 5.8, x + 5.8, 6.5, 6.7, 1.5, 29.5, 0.1, "#a67e5a")),
    ...[-1.2, 1.2].map((x) => tube([x, 7, 13], [x, 7, 17], 0.4, 0.4, "#e6d3b0")),
  ],

  // Mother, on the sofa watching television, with a rounder build.
  eadni: (frame) => [
    ...sittingLegs(8, "#3f5a84"),
    ball(0, 0.4, 11.5, 5, 4.4, 5.2, "#8e4a7a"),
    ball(0, 0, 15.5, 3.8, 3.2, 2.2, "#8e4a7a"),
    ...sides((s) => tube([s * 4.6, 0, 15], [s * 5, 2.8, 10.8], 1.3, 1.1, "#8e4a7a")),
    ...sides((s) => tube([s * 5, 2.8, 10.8], [s * 1.4, 5, 10.2], 1.1, 0.9, SKIN)),
    // Knitting on her lap, the needles working.
    ball(0, 5.6, 10 + frame * 0.4, 2.4, 1.6, 1.3, "#e6c15a"),
    ...head(20, [
      ball(0, -0.7, 20.5, 4, 3.7, 4, "#5a3a22"),
      ball(0, -1.4, 24.5, 1.9, 1.8, 1.6, "#5a3a22"),
    ], 3.7),
  ],
  // Father, stirring a pot at the stove and looking over his shoulder.
  áhčči: (frame) => {
    const stir = frame ? 1 : -1;
    return [
      ...sides((s) => [
        tube([s * 1.6, 0, 11], [s * 1.6, 0, 1.6], 1.8, 1.5, "#4a4a58"),
        ball(s * 1.6, 0.8, 0.9, 1.3, 2, 0.9, "#2c2c36"),
      ]).flat(),
      tube([0, 0, 11.5], [0, 0, 18.5], 3.6, 3.2, "#3e7a58"),
      rounded(-3.2, 3.2, 2.6, 3.5, 8, 16, 0.3, "#f4f1e8"),
      tube([-3.6, 0, 18.5], [-3.8, 1, 12], 1.1, 0.9, "#3e7a58"),
      tube([3.6, 0, 18.5], [2.6, 3.5, 15], 1.1, 1, "#3e7a58"),
      tube([2.6, 3.5, 15], [stir, 7.5, 14.5], 1, 0.8, SKIN),
      tube([stir, 7.5, 15], [stir * 1.5, 8.5, 18], 0.3, 0.3, WOOD_DARK),
      // Bald, with a short beard.
      ...head(23, [
        ball(0, 1.6, 21.3, 2.8, 2, 1.9, "#3a2a1c"),
        ...sides((s) => ball(s * 3.4, 0.2, 22.8, 0.8, 0.9, 1, SKIN)),
      ], 3.6),
    ];
  },
  // Sister, smaller than the others, sitting on the bedroom floor and playing with a doll.
  oabbá: (frame) => {
    const lift = frame ? 1.2 : 0; // the doll takes a little hop in her hands
    return [
      ...sides((s) => [
        tube([s * 1.2, 0, 1.6], [s * 3.2, 2, 1.1], 1.2, 1, "#b5533f"),
        tube([s * 3.2, 2, 1.1], [s * 0.6, 3.5, 0.9], 0.9, 0.8, "#b5533f"),
      ]).flat(),
      tube([0, 0, 2], [0, 0, 6.5], 2.4, 2, "#e6a93a"),
      ...sides((s) => tube([s * 2.3, 0, 6.5], [s * 1.5, 3.6, 5 + lift], 0.7, 0.6, "#e6a93a")),
      // The doll: a dress, arms, a head and yellow hair.
      tube([0, 4.4, 3.2 + lift], [0, 4.4, 5.8 + lift], 1.7, 0.8, "#d8588a"),
      ...sides((s) => tube([s * 0.8, 4.4, 5.6 + lift], [s * 1.6, 4.8, 4.6 + lift], 0.3, 0.3, SKIN)),
      ball(0, 4.4, 7.2 + lift, 1.3, 1.3, 1.3, SKIN),
      ball(0, 4, 7.9 + lift, 1.45, 1.2, 1, "#f2c14e"),
      ...sides((s) => ball(s * 0.5, 5.5, 7.3 + lift, 0.25, 0.15, 0.25, "#22222c")),
      ...head(10.4, [
        ball(0, -0.5, 11, 3.2, 3, 3.1, "#b0662c"),
        ...sides((s) => tube([s * 2.7, -0.4, 10], [s * 3, 0.9, 5.8], 0.85, 0.55, "#b0662c")),
      ], 2.9),
    ];
  },
  // Brother, beside his mother and laughing at the television, with hair and colours like Máhtte's.
  viellja: (frame) => [
    ...sittingLegs(8, "#6b4a32"),
    tube([0, 0, 8.5], [0, 0, 14], 3.2, 2.6, "#2f5fa8"),
    tube([0, 0, 9.6], [0, 0, 10.4], 3.3, 3.2, "#f2c14e"),
    tube([0, 0, 14.2], [0, 0, 15], 2.5, 1.9, "#d13a30"),
    ...sides((s) => tube([s * 3.1, 0, 14], [s * 3.2, 3, 9.6], 0.95, 0.85, "#2f5fa8")),
    ...sides((s) => ball(s * 3.2, 3.4, 9.2, 1, 1, 1, SKIN)),
    ...head(18.4 + frame * 0.5, [
      ball(0, -0.5, 19.6 + frame * 0.5, 3.8, 3.6, 3.1, "#5e3a20"),
      ball(0, 2.2, 21 + frame * 0.5, 2.8, 1.5, 1, "#5e3a20"),
    ]),
  ],
});

// How each animal moves, and the shape of its shadow. Things only have a shadow.
const ANIMAL_WAYS = {
  boazu: { shadow: [20, 7] }, beana: { greets: true, near: 3.2, shadow: [15, 6] }, loddi: { flights: true, pecks: true, shadow: [9, 4] },
  njoammil: { hops: true, shadow: [12, 5] }, guovza: { shadow: [22, 9] }, rieban: { shadow: [16, 5] },
  oarri: { hops: true, shadow: [9, 3] }, skuolfi: { flights: true, looks: true, shadow: [11, 5] }, cuoppu: { hops: true, shadow: [12, 5] },
  sahpan: { shadow: [9, 4] }, beaiveloddi: { flies: true, shadow: [4, 2] }, gahttu: { shadow: [14, 5] },
  bin: { shadow: [12, 6] }, guolli: { shadow: [12, 3] }, savza: { shadow: [15, 7] }, gussa: { shadow: [22, 8] }, spiidni: { shadow: [15, 7] }, vuonccis: { pecks: true, shadow: [11, 5] },
  // Those who stay where they are and keep doing something: the time each picture lasts, and where they look.
  eadni: { acts: 300, shadow: [0, 0] }, viellja: { acts: 900, shadow: [0, 0] }, oabbá: { acts: 700, shadow: [12, 5] },
  áhčči: { acts: 420, head: 0, shadow: [12, 5] }, tv: { acts: 1100, shadow: [14, 6] },
};
