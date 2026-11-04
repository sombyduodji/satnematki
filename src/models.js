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
  // After a photograph the user gave, of reindeer on a road in summer: a pale tan coat with darker patches where it is
  // moulting, a long thick neck carried low, a dark muzzle and dark around the eye, long thin legs that darken towards
  // big splayed hooves, and thick antlers in dark velvet that sweep back and up, with blunt tips and a tine over the face.
  boazu: (frame) => {
    const stride = frame === 1 ? 1.8 : frame === 2 ? -1.8 : 0;
    const feet = [[3, 5.6, stride], [-3, 5.6, -stride], [3, -5.6, -stride], [-3, -5.6, stride]];
    return [
      ...feet.flatMap(([x, y, swing]) => [
        tube([x, y, 13], [x, y + swing * 0.5, 7], 1.1, 0.65, "#a08a6c"),
        tube([x, y + swing * 0.5, 7], [x, y + swing, 1.6], 0.6, 0.5, "#4e3f30"),
        ball(x, y + swing + 0.5, 0.9, 1.25, 1.7, 0.9, "#2b2219"),
      ]),
      { ...ball(0, -0.5, 14.5, 4.6, 8.8, 4.7, "#cdbc9f"), paint: mottled(["#d9cbb0", "#cdbc9f", "#cdbc9f", "#7d6a55"], 1) },
      ball(0, -9, 15.8, 1.4, 1, 1.2, "#f0ead9"),
      tube([0, 6, 15.6], [0, 11.5, 16.2], 3.4, 2.2, "#d9cbb0"),
      ball(0, 8, 12.2, 2.2, 3, 2, "#e8decb"),
      {
        ...ball(0, 13.6, 16.4, 2.2, 3.6, 2.2, "#cdbc9f"),
        paint: ([, y, z]) => (y > 15 || (y > 13.4 && z < 16.2) ? "#4a3b2d" : "#cdbc9f"),
      },
      ball(0, 17, 15.2, 1.9, 1.8, 1.6, "#2b2219"),
      ...eyes(2.1, 14.2, 17.2, 0.95, "#2b2219"),
      ...sides((s) => ball(s * 2.6, 11.8, 18.2, 1.3, 0.6, 0.7, "#8a7458")),
      ...sides((s) => tube([s * 1.2, 12, 18.2], [s * 5, 9, 25], 0.75, 0.6, "#5c4430")),
      ...sides((s) => tube([s * 5, 9, 25], [s * 6.6, 11.5, 33], 0.6, 0.45, "#5c4430")),
      ...sides((s) => tube([s * 5.3, 9.4, 27], [s * 8.4, 7.6, 29.5], 0.4, 0.3, "#5c4430")),
      ...sides((s) => tube([s * 1.3, 12.4, 19.2], [s * 1.8, 17.2, 21.5], 0.55, 0.4, "#5c4430")),
    ];
  },
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
  // A full glass with a straw.
  juice: () => [
    { ...rounded(-3.8, 3.8, -3.8, 3.8, 0, 12, 1.4, "#f2a23a"), paint: ([, , z]) => (z > 10 ? "#dfeef2" : "#f2a23a") },
    tube([1.4, 0, 9], [3.4, 0.4, 16.5], 0.45, 0.45, "#d13a30"),
    ball(-3.4, 2.6, 10.6, 2.2, 0.5, 2.2, "#ee8a2e"),
  ],
  yoghurt: () => [
    { ...rounded(-3.8, 3.8, -3.8, 3.8, 0, 8, 1.4, "#f4f1e8"), paint: ([, , z]) => (z > 2.5 && z < 6 ? "#d8588a" : "#f4f1e8") },
    rounded(-4.4, 4.4, -4.4, 4.4, 8, 8.6, 0.2, "#c9ccd2"),
  ],
  flour: () => [
    { ...rounded(-5, 5, -3.5, 3.5, 0, 14, 0.8, "#f0e8d6"), paint: ([, y, z]) => (y > 2 && z > 4 && z < 10 ? "#c9a24e" : "#f0e8d6") },
    rounded(-5, 5, -1.2, 1.2, 14, 15.5, 0.4, "#e6dcc4"),
  ],
  rice: () => [
    { ...rounded(-4.5, 4.5, -3, 3, 0, 13, 0.8, "#f4f1e8"), paint: ([, y, z]) => (y > 2 && z > 7 ? "#3e8a7a" : "#f4f1e8") },
    ...[[-2, 3.1, 3.5], [0, 3.1, 2.2], [2, 3.1, 3.8], [-0.8, 3.1, 4.8], [1.2, 3.1, 5.4]].map(([x, y, z]) => ball(x, y, z, 0.8, 0.2, 0.4, "#c9c2b0")),
  ],
  // Only 50 grams, as reindeer meat is dear: a small plate of slices.
  reindeermeat: () => onPlate([[-2.8, -1.8], [0.4, -2.2], [3, -1.2], [-2.2, 1.8], [1, 1.8], [3.4, 1.8]].map(([x, y], i) => ball(x, y, 1.7, 2, 1.5, 0.9, i % 2 ? "#6e2e28" : "#8f3c32"))),
  steak: () => onPlate([
    { ...ball(0, 0, 2.2, 6.2, 5.2, 1.6, "#a02e26"), paint: ([x, y]) => (Math.hypot(x / 6.2, y / 5.2) > 0.72 ? "#f6e8c8" : Math.abs(x) < 0.7 ? "#f4f1e8" : "#a02e26") },
  ]),
  mince: () => onPlate([
    { ...ball(0, 0, 3, 5.2, 4.8, 2.8, "#b5544a"), paint: ([x, y, z]) => ((Math.round(x * 1.6) + Math.round(y * 1.6) + Math.round(z * 1.6)) % 3 === 0 ? "#d07a6e" : "#b5544a") },
  ], 6.4),
  pork: () => onPlate([
    { ...ball(-1, 0, 2, 5, 4, 1.3, "#e27f7a"), paint: ([x, y]) => (Math.hypot((x + 1) / 5, y / 4) > 0.8 ? "#f6eedd" : "#e27f7a") },
    tube([3.4, -0.4, 2.2], [6.6, -0.8, 2.2], 0.9, 0.8, "#f4f1e8"),
    ball(6.8, -0.8, 2.2, 1.2, 1.2, 1, "#f4f1e8"),
  ]),
  tea: () => [
    { ...rounded(-5, 5, -3, 3, 0, 10, 0.4, "#3e8a5e"), paint: ([, y, z]) => (y > 2.6 && z > 3 && z < 7.5 ? "#f2c14e" : "#3e8a5e") },
    tube([5.2, 3, 8], [6.5, 3, 3.5], 0.15, 0.15, "#f4f1e8"),
    rounded(5.6, 7.4, 2.9, 3.1, 1.5, 3.5, 0.05, "#d13a30"),
  ],
  chocolate: () => [
    { ...rounded(-7, 7, -4, 4, 0, 2, 0.3, "#5a3a22"), paint: ([x, y]) => (x < 0 ? "#2f5fa8" : (Math.abs(((x + 14) % 3.5) - 1.75) < 0.25 || Math.abs(((y + 8) % 4)) < 0.4 ? "#3e2614" : "#5a3a22")) },
  ],
  // Wrapped sweets with twisted ends.
  candy: () => [[-3.2, 2, 2.2, "#d8588a"], [3.4, 1.4, 2.2, "#f2c14e"], [0, -3, 2.2, "#3e8a4e"], [0.2, 0.8, 6, "#d13a30"]].flatMap(([x, y, z, c]) => [
    ball(x, y, z, 2.6, 2.2, 2.2, c),
    ...sides((s) => ball(x + s * 3.2, y, z, 1.1, 1.2, 1.4, "#f4f1e8")),
  ]),
  cookie: () => [
    ...[0, 1, 2].map((i) => {
      const y = -3 + i * 3;
      return { ...tube([0, y, 2.4], [0, y + 0.5, 3], 5, 5, "#c98d4a"), paint: ([px, py]) => ((Math.round(px * 1.2) + Math.round(py * 1.6)) % 4 === 0 ? "#5a3a22" : "#c98d4a") };
    }),
  ],
  // A small one, for one or two.
  cake: () => [
    rounded(-6.5, 6.5, -6.5, 6.5, 0, 0.6, 0.2, "#e6dfc8"),
    { ...rounded(-5, 5, -5, 5, 0.6, 7, 2, "#f6eedd"), paint: ([, , z]) => (z > 3.2 && z < 4.2 ? "#d8588a" : "#f6eedd") },
    ...[[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].map(([x, y]) => ball(x, y, 7.6, 1.2, 1.2, 1.1, "#d9283a")),
  ],
  // A shop's cola bottle: dark, with a red label and cap, and no real brand on it.
  soda: () => [
    ...fizzyBottle("#3e2214", "#d13a30", "#d13a30"),
    ball(0, 3.8, 8.8, 2.2, 0.25, 0.5, "#f4f1e8"),
  ],
  pizza: () => [
    ball(0, 0, 1.3, 9, 9, 1.3, "#d9a862"),
    ball(0, 0, 2.1, 7.6, 7.6, 0.9, "#d9472e"),
    ...[[-3, -2], [3, -3], [0, 3], [4, 2.5], [-4.5, 2]].map(([x, y]) => ball(x, y, 2.9, 1.5, 1.5, 0.4, "#8e1f1a")),
    ...[[0, -4.5], [-1.8, 0.2], [2, 0.5], [-1, 5.2], [5, -0.5]].map(([x, y]) => ball(x, y, 2.9, 1.2, 0.9, 0.3, "#f2d27a")),
  ],
  mushroom: () => [
    tube([0, 0, 0.5], [0, 0, 6], 2.2, 2.6, "#efe6d4"),
    { ...ball(0, 0, 7, 6.5, 6.5, 4, "#e6dcc4"), paint: ([x, y, z]) => (z < 6.2 ? "#b39a78" : "#e6dcc4") },
  ],
  lingonberry: () => [
    ...[[-3, 2, 2.4], [3, 2, 2.4], [0, -2.6, 2.4], [-3, -2.4, 2.4], [3, -2.2, 2.4], [0, 2.6, 2.4], [-1.4, 0, 5.8], [1.8, 0.5, 5.8], [0, 0, 9]].map(([x, y, z], i) => ball(x, y, z, 2.1, 2.1, 2.1, i % 2 ? "#c9202f" : "#a81828")),
    ball(1.5, -1.5, 11, 2.8, 1.2, 0.5, "#2f6f32"),
    ball(-2, 1.5, 10.4, 2.4, 1, 0.5, "#3e8e41"),
  ],
  cloudberry: () => [
    ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return tube([0, 0, 0.8], [Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0.5], 1.1, 0.5, "#6b7a3a"); }),
    ...[[0, 0, 4.6, 3.6], [-3.4, 1.4, 5.4, 2.5], [3.4, 1.4, 5.4, 2.5], [-2, -3, 5.4, 2.5], [2.2, -3, 5.4, 2.5], [0, 3.4, 5.8, 2.5], [-1.8, 0.8, 8.4, 2.3], [1.8, 0.6, 8.6, 2.3], [0, -1.2, 10.2, 2.1]].map(([x, y, z, r], i) => ball(x, y, z, r, r, r, i % 2 ? "#f2a23a" : "#e88a22")),
  ],
  jam: () => [
    { ...rounded(-4.2, 4.2, -4.2, 4.2, 0, 10, 1.6, "#b0263a"), paint: ([, , z]) => (z > 3 && z < 7 ? "#f4f1e8" : "#b0263a") },
    rounded(-3.8, 3.8, -3.8, 3.8, 10, 12, 0.4, "#f2c14e"),
  ],
  gum: () => [
    { ...rounded(-5, 5, -2, 2, 0, 3, 0.4, "#5ab0d9"), paint: ([x]) => (Math.abs(x) < 1.8 ? "#f4f1e8" : "#5ab0d9") },
  ],
  // A cinnamon roll, with its swirl on top.
  bun: () => [
    { ...ball(0, 0, 3.8, 7.4, 7.4, 3.8, "#d9a862"), paint: ([x, y, z]) => (z > 4.4 && (Math.atan2(y, x) + Math.hypot(x, y) * 1.5 + 12.56) % 3.14 < 0.9 ? "#7a4a22" : "#d9a862") },
  ],
  pancake: () => [
    ball(0, 0, 0.9, 8, 8, 0.9, "#e8c47a"),
    ball(0.4, -0.3, 2.3, 7.4, 7.4, 0.9, "#ddb368"),
    ball(-0.3, 0.3, 3.7, 7, 7, 0.9, "#e8c47a"),
    ball(0, 0, 4.9, 2.6, 2.6, 0.7, "#d9283a"),
  ],
  // An open carton of six.
  egg: () => [
    { ...rounded(-11, 11, -7, 7, 0, 4, 0.8, "#a8957a"), paint: ([x, , z]) => (z < 3.2 && Math.abs(((x + 33) % 7.33) - 3.67) < 0.5 ? "#8f7d64" : "#a8957a") },
    rounded(-11.5, 11.5, -8.5, -7, 3, 11, 0.6, "#b9a88a"),
    rounded(-7, 7, -8.8, -8.4, 5, 9, 0.2, "#3e74c9"),
    ...[-7.3, 0, 7.3].flatMap((x) => [-3.2, 3.2].map((y) => ball(x, y, 5.6, 2.9, 2.9, 3.2, "#f6eedd"))),
  ],
  tomato: () => [
    ball(0, 0, 5.4, 6.5, 6.5, 5.4, "#d6382e"),
    ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return tube([0, 0, 10.6], [Math.cos(a) * 3, Math.sin(a) * 3, 10.4], 0.6, 0.3, "#3e8e41"); }),
    tube([0, 0, 10.6], [0.5, 0, 12.4], 0.5, 0.4, "#3e8e41"),
  ],
  cucumber: () => [
    { ...tube([-10, 0, 3], [10, 0, 3], 2.8, 2.6, "#3e8a3e"), paint: ([x]) => ((x + 40) % 4 < 1 ? "#5aa652" : "#3e8a3e") },
    ball(-10.4, 0, 3, 1.4, 1.6, 1.6, "#2f6f32"),
  ],
  onion: () => [
    { ...ball(0, 0, 5.2, 6, 6, 5.2, "#c98d3a"), paint: ([x]) => ((x + 40) % 3 < 0.7 ? "#a8702a" : "#c98d3a") },
    tube([0, 0, 9.5], [0.3, 0, 13.5], 1.3, 0.3, "#d9b06a"),
    ball(0, 0, 0.8, 1.6, 1.6, 0.7, "#8a6a48"),
  ],
  cabbage: () => [
    { ...ball(0, 0, 6.6, 7.4, 7.4, 6.6, "#8fc26a"), paint: ([x, y]) => (Math.abs(x * 0.6 + y * 0.3) < 0.5 || Math.abs(y * 0.7 - x * 0.3 - 2) < 0.4 ? "#c9e0a8" : "#8fc26a") },
    ...[[-5, 3, 4], [5, -3, 5], [3, 5, 8]].map(([x, y, z]) => ball(x, y, z, 3.6, 3.6, 2.6, "#6fa84f")),
  ],
  lettuce: () => [
    ...[[0, 0, 4, 7], [-4, 2, 4, 4.4], [4, 2, 4.4, 4.6], [-3, -3, 5, 4.2], [3, -3, 4.6, 4.4], [0, 4, 5.4, 4.2]].map(([x, y, z, r], i) => ball(x, y, z, r, r, r * 0.8, i % 2 ? "#7fbe55" : "#5e9e42")),
    rounded(-5, 5, -5, 5, 0, 2.4, 1, "#6b4a32"),
  ],
  orange: () => [
    { ...ball(0, 0, 6, 6.2, 6.2, 6, "#ee8a2e"), paint: ([x, y, z]) => ((Math.round(x * 2) + Math.round(y * 2) + Math.round(z * 2)) % 7 === 0 ? "#d9761f" : "#ee8a2e") },
    ball(0, 0, 11.8, 1, 1, 0.4, "#3e6a2e"),
  ],
  pear: () => [
    ball(0, 0, 4.8, 5.4, 5.4, 4.8, "#c2c94e"),
    tube([0, 0, 7], [0, 0, 12], 4, 2.2, "#c2c94e"),
    tube([0, 0, 13.2], [0.8, -0.3, 15.6], 0.5, 0.4, "#5c3a1e"),
    ball(0.8, 2.8, 5.6, 1.6, 0.8, 2, "#d9a24e"),
  ],
  lemon: () => [
    ball(0, 0, 4.6, 7, 4.6, 4.4, "#f2d23a"),
    ...[-1, 1].map((s) => ball(s * 7.4, 0, 4.6, 1.3, 1.4, 1.3, "#e6c12e")),
  ],
  // A little punnet of them.
  strawberry: () => [
    ...[[-3.6, -2.4], [0, -2.8], [3.6, -2.4], [-3.4, 2.4], [0.2, 2.6], [3.6, 2.4], [-1.6, 0], [1.8, 0]].flatMap(([x, y], i) => [
      { ...ball(x, y, 6 + (i > 5 ? 1.2 : 0), 2.2, 2.2, 2.3, "#d9283a"), paint: ([px, py, pz]) => ((Math.round(px * 1.6) + Math.round(py * 1.6) + Math.round(pz * 1.6)) % 4 === 0 ? "#f2d278" : "#d9283a") },
      ball(x, y, 8.2 + (i > 5 ? 1.2 : 0), 1.3, 1.3, 0.5, "#3e8e41"),
    ]),
    { ...rounded(-6.4, 6.4, -5, 5, 0, 6, 0.5, "#3e74c9"), paint: ([x, , z]) => (z > 4.8 ? "#f4f1e8" : Math.abs(((x + 26) % 2.6) - 1.3) < 0.3 ? "#2f5fa8" : "#3e74c9") },
  ],
  grapes: () => [
    ...[[0, 0, 3], [-2.3, 0.5, 5.4], [2.3, -0.5, 5.4], [0, 2.3, 5.6], [0, -2.3, 5.4], [-4, 1, 8], [4, -1, 8], [-1.5, 2.8, 8.2], [1.5, -2.8, 8.2], [-2, -1.5, 8.6], [2, 1.5, 8.8], [-4, -2, 10.4], [4, 2, 10.4], [0, 0, 11], [-1.8, 3, 10.8], [1.8, -3, 10.8]].map(([x, y, z], i) => ball(x, y, z, 2.3, 2.3, 2.3, i % 3 ? "#6a3a8e" : "#7f4aa8")),
    tube([0, 0, 12.6], [0.6, -0.4, 15], 0.5, 0.4, "#5c3a1e"),
    ball(3, -1, 14, 3, 1.4, 0.7, "#3e8e41"),
  ],
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
  // A cup of it, as a pack of coffee can't be told from any other pack.
  coffee: () => [
    { ...rounded(-4.6, 4.6, -4.6, 4.6, 0, 8.5, 2, "#f4f1e8"), paint: ([x]) => (x < -3.4 ? "#d6d0c4" : "#f4f1e8") },
    ball(0, 0, 8.4, 3.8, 3.8, 0.5, "#3e2614"),
    tube([4.6, 0, 6.5], [7.4, 0, 5.2], 0.8, 0.8, "#f4f1e8"),
    tube([7.4, 0, 5.2], [4.6, 0, 2.6], 0.8, 0.8, "#f4f1e8"),
    tube([-1, 0, 10], [-1.6, 0, 13], 0.35, 0.2, "#c9ccd2"),
    tube([1.4, 0, 10], [2, 0, 13.5], 0.35, 0.2, "#c9ccd2"),
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

// ------------------------------------------------------------- people in the store
// Food small enough for a basket or the till's belt, from z upwards.
const SMALL_FOOD = {
  apple: (x, y, z, k = 1) => ball(x, y, z + k, 1.1 * k, 1.1 * k, 1.1 * k, "#d13a30"),
  orange: (x, y, z, k = 1) => ball(x, y, z + k, 1.05 * k, 1.05 * k, 1.05 * k, "#e8902e"),
  milk: (x, y, z, k = 1) => ({ ...rounded(x - k, x + k, y - k, y + k, z, z + 3.6 * k, 0.2, "#f4f1e8"), paint: ([, , pz]) => (pz < z + 1.6 * k ? "#3e74c9" : "#f4f1e8") }),
  bread: (x, y, z, k = 1) => tube([x - 1.5 * k, y, z + 0.8], [x + 1.5 * k, y + 0.5, z + 1.2], k, 0.9 * k, "#c9925a"),
  cheese: (x, y, z, k = 1) => rounded(x - 1.2 * k, x + 1.2 * k, y - 0.9 * k, y + 0.9 * k, z, z + 1.5 * k, 0.2, "#f2c14e"),
  greens: (x, y, z, k = 1) => ball(x, y, z + 0.8 * k, 1.3 * k, 1.3 * k, k, "#4f9a3e"),
};

// A basket on the arm, with what's in it showing over the rim.
const shoppingBasket = (x, y, z, colour, goods, k) => [
  ...goods.map((good, i) => SMALL_FOOD[good](x + (i - (goods.length - 1) / 2) * 1.6 * k, y + (i % 2 ? 0.7 : -0.7) * k, z, k)),
  { ...rounded(x - 3.2 * k, x + 3.2 * k, y - 2.3 * k, y + 2.3 * k, z - 3 * k, z + k, 0.5, colour), paint: ([, , pz]) => (pz > z + 0.2 * k ? "#f4f1e8" : colour) },
  ...sides((s) => tube([x + s * 2.4 * k, y, z + k], [x, y, z + 4 * k], 0.25, 0.25, "#2c2c36")),
];

// Bags in the Sámi flag's colours, after a photograph the user gave of a tote with the flag on it: the flag itself with
// its ring, or just its stripes, up and down or across. Each as a tote with cream handles or as a plastic carrier bag.
const SAMI_RED = "#d13a30", SAMI_GREEN = "#3e8a4e", SAMI_YELLOW = "#f2c14e", SAMI_BLUE = "#2f5fa8";
const SAMI_STRIPES = [SAMI_RED, SAMI_GREEN, SAMI_YELLOW, SAMI_BLUE];
const BAG_PATTERNS = {
  flag: (across, up) => {
    const centre = across + 0.3;
    if (Math.abs(Math.hypot(centre, up) - 2.1) < 0.45) return centre < 0 ? SAMI_BLUE : SAMI_RED;
    return centre < -0.7 ? SAMI_RED : centre < 0 ? SAMI_GREEN : centre < 0.7 ? SAMI_YELLOW : SAMI_BLUE;
  },
  upright: (across) => SAMI_STRIPES[Math.max(0, Math.min(3, Math.floor((across + 3.6) / 1.8)))],
  level: (across, up) => SAMI_STRIPES[Math.max(0, Math.min(3, Math.floor((3.25 - up) / 1.625)))],
};
const BAGS = ["flag", "upright", "level"].flatMap((pattern) => ["tote", "plastic"].map((shape) => ({ pattern, shape })));

function samiBag(x, y, z, k, which) {
  const { pattern, shape } = BAGS[which];
  const paint = ([px, , pz]) => BAG_PATTERNS[pattern]((px - x) / k, (pz - z) / k + 3.25);
  if (shape === "tote") {
    return [
      SMALL_FOOD.bread(x, y, z - 0.4 * k, k),
      { ...rounded(x - 3.6 * k, x + 3.6 * k, y - 1.3 * k, y + 1.3 * k, z - 6.5 * k, z, 0.4, SAMI_RED), paint },
      ...sides((s) => tube([x + s * 2 * k, y, z], [x, y, z + 3 * k], 0.35, 0.3, "#f0e8d6")),
    ];
  }
  // Soft and bulging, with what's in it showing and two thin handles cut from the bag itself.
  return [
    SMALL_FOOD.greens(x, y, z - 1.4 * k, k),
    { ...ball(x, y, z - 3.6 * k, 3.7 * k, 1.9 * k, 3.5 * k, SAMI_RED), paint },
    ...sides((s) => ({ ...tube([x + s * 2.6 * k, y, z - 1.8 * k], [x + s * 0.5, y, z + 2.6 * k], 0.55, 0.3, SAMI_RED), paint: () => paint([x + s * 2.6 * k, 0, z - 1.8 * k]) })),
  ];
}

const PERSON_HAIR = {
  bald: (z, r) => sides((s) => ball(s * r * 0.95, 0.2, z - 0.2, r * 0.22, r * 0.25, r * 0.28, SKIN)),
  fringe: (z, r, c) => [ball(0, -r * 0.5, z - 0.5, r * 0.95, r * 0.7, r * 0.75, c)],
  short: (z, r, c) => [ball(0, -0.5, z + 0.7, r * 1.04, r, r * 0.92, c)],
  long: (z, r, c) => [ball(0, -0.7, z + 0.5, r * 1.08, r, r, c), ball(0, -1.6, z - 2.5, r * 0.95, r * 0.7, r * 1.05, c)],
  bun: (z, r, c) => [ball(0, -0.5, z + 0.7, r * 1.04, r, r * 0.92, c), ball(0, -1.3, z + r + 0.6, r * 0.5, r * 0.5, r * 0.45, c)],
  braids: (z, r, c) => [ball(0, -0.5, z + 0.5, r * 1.05, r, r * 0.95, c), ...sides((s) => tube([s * r * 0.85, -0.3, z - 0.5], [s * r * 0.95, 0.9, z - 5], 0.8, 0.5, c))],
  cap: (z, r, c) => [ball(0, -0.3, z + 1.2, r * 1.05, r * 1.02, r * 0.85, c), ball(0, r * 0.9, z + 1.4, r * 0.75, r * 0.65, 0.3, c)],
  beanie: (z, r, c) => [ball(0, -0.2, z + 1, r * 1.08, r * 1.06, r * 0.95, c), ball(0, -0.2, z + r + 0.7, 0.8, 0.8, 0.7, "#f4f1e8")],
};

// k is height, w is build. Frames: 0 stands, 1 and 2 walk, 3 reaches forward, 4 pays by card.
// What they carry comes as the colour: how many goods show in the basket, "none", or "bag" and which one.
const PERSON_LOOKS = {
  grandpa: { k: 0.94, w: 1.05, legs: "#54545e", top: "#6b7a4a", hair: "fringe", hairColour: "#c9c9c9", beard: "#d6d6d6", glasses: true, stick: true, basket: "#c84a3a", goods: ["milk", "bread", "cheese"], stoop: true, pace: 0.75 },
  grandma: { k: 0.88, w: 1.12, legs: "#4a4a58", skirt: "#5a4a7a", top: "#a0607a", hair: "bun", hairColour: "#d9d9d9", glasses: true, basket: "#3e74c9", goods: ["apple", "greens", "cheese"], pace: 0.8 },
  bald: { k: 1.04, w: 1.18, legs: "#3f4a5a", top: "#c9722e", hair: "bald", basket: "#3e8a4e", goods: ["cheese", "bread", "milk"] },
  bearded: { k: 1.16, w: 1, legs: "#2f3a4a", top: "#3e6a8a", hair: "short", hairColour: "#5a3a22", beard: "#5a3a22", basket: "#c84a3a", goods: ["orange", "bread", "milk"] },
  tall: { k: 1.22, w: 0.86, legs: "#6b5338", top: "#d6d0c4", stripe: "#7a2f3a", hair: "long", hairColour: "#2e2620", basket: "#3e74c9", goods: ["milk", "apple", "greens"] },
  midwoman: { k: 1, w: 1, legs: "#30384a", top: "#3e8a7a", hair: "long", hairColour: "#b0662c", basket: "#d18f2e", goods: ["greens", "orange", "milk"] },
  midman: { k: 1.02, w: 1.04, legs: "#3a3a48", top: "#4a6ea0", hair: "short", hairColour: "#8f8f8f", basket: "#d18f2e", goods: ["milk", "cheese", "apple"] },
  youngman: { k: 1.06, w: 0.92, legs: "#28324a", top: "#8e3a4a", hair: "cap", hairColour: "#2f5fa8", basket: "#3e8a4e", goods: ["bread", "orange", "milk"] },
  youngwoman: { k: 0.97, w: 0.9, legs: "#7a8aa0", top: "#e0b03a", hair: "braids", hairColour: "#d9b45a", basket: "#c84a3a", goods: ["apple", "cheese", "greens"] },
  teen: { k: 0.86, w: 0.84, legs: "#3a3a48", top: "#6a4aa0", hair: "beanie", hairColour: "#3e8a4e", basket: "#c84a3a", goods: ["orange", "bread", "apple"], pace: 1.15 },
  girl: { k: 0.66, w: 0.82, legs: "#b5533f", top: "#d8588a", hair: "braids", hairColour: "#8a5a2c", basket: "#3e74c9", goods: ["apple", "orange", "bread"], pace: 1.2 },
  boy: { k: 0.6, w: 0.8, legs: "#3f5a84", top: "#e6a93a", hair: "cap", hairColour: "#d13a30", basket: "#3e8a4e", goods: ["orange", "apple", "cheese"], pace: 1.2 },
  cashier: { k: 1, w: 1, legs: "#30384a", top: "#f4f1e8", apron: "#2f5fa8", badge: "#f2c14e", hair: "bun", hairColour: "#5a3a22" },
  butcher: { k: 1.1, w: 1.12, legs: "#30384a", top: "#f4f1e8", apron: "#c9ccd2", stripe: "#7a2f3a", hair: "cap", hairColour: "#f4f1e8", beard: "#5a3a22", knife: true },
  stocker: { k: 1.08, w: 1.02, legs: "#30384a", top: "#f4f1e8", apron: "#2f5fa8", badge: "#f2c14e", hair: "short", hairColour: "#2e2620", beard: "#2e2620", pace: 1.2 },
};

// A shape moved, for carrying a whole model.
const shifted = (shape, dx, dy, dz) => {
  const move = ([x, y, z]) => [x + dx, y + dy, z + dz];
  if (shape.kind === "ball") return { ...shape, at: move(shape.at) };
  if (shape.kind === "tube") return { ...shape, from: move(shape.from), to: move(shape.to) };
  const paint = shape.paint && (([x, y, z]) => shape.paint([x - dx, y - dy, z - dz]));
  return { ...shape, low: move(shape.low), high: move(shape.high), ...(paint ? { paint } : {}) };
};

function personModel(p) {
  return (frame, carrying) => {
    const k = p.k, w = p.w;
    const leg = 11 * k, body = 7.6 * k, r = 3.6 * (0.8 + 0.2 * k);
    const top = leg + body, z = top + r + 0.6;
    const stride = frame === 1 ? 1.7 * k : frame === 2 ? -1.7 * k : 0;
    const hand = [3.7 * w + 0.5, 0.6, leg + 0.6];
    const parts = [
      ...sides((s) => [
        tube([s * 1.6 * w, 0, leg], [s * 1.6 * w, s * stride, 1.6], 1.75 * w * (0.7 + 0.3 * k), 1.35 * (0.7 + 0.3 * k), p.legs),
        ball(s * 1.6 * w, s * stride + 0.8, 0.9, 1.3, 2, 0.9, "#2c2c36"),
      ]).flat(),
      tube([0, p.stoop ? 0.6 : 0, leg - 0.4], [0, p.stoop ? 1.6 : 0, top], 3.8 * w, 3.2 * w, p.top),
      tube([-3.7 * w, 0, top], [-hand[0], hand[1], hand[2]], 1.1, 0.95, p.top),
      ball(-hand[0], hand[1], hand[2], 0.9, 0.9, 0.9, SKIN),
    ];
    if (p.skirt) parts.push(tube([0, 0, leg - 3 * k], [0, 0, leg + 1], 3.9 * w + 0.8, 3.6 * w, p.skirt));
    if (p.stripe) parts.push(tube([0, 0, leg + body * 0.5], [0, 0, leg + body * 0.5 + 1.4], 3.75 * w, 3.5 * w, p.stripe));
    if (p.apron) parts.push(rounded(-3 * w, 3 * w, 2.5 * w, 3.5 * w, leg - 3, top - 0.8, 0.3, p.apron));
    if (p.badge) parts.push(ball(1.6 * w, 3.6 * w, top - 1.6, 0.6, 0.2, 0.4, p.badge));
    if (p.stick) parts.push(tube([-hand[0], hand[1] + 0.6, hand[2]], [-hand[0] - 0.4, 3, 0.3], 0.3, 0.3, "#6b4a32"));
    if (frame === 3 || frame === 4) {
      // Up to a shelf, or out with a card.
      const out = frame === 3 ? [2.6 * w, 7, top + 1.5] : [1.8 * w, 6, leg + 3.5];
      parts.push(tube([3.7 * w, 0.2, top], out, 1.1, 0.9, p.top), ball(...out, 0.9, 0.9, 0.9, SKIN));
      if (p.knife) parts.push(rounded(out[0] - 0.25, out[0] + 0.25, out[1], out[1] + 3.6, out[2] - 0.5, out[2] + 0.4, 0.05, "#c9ccd2"));
      if (frame === 4) parts.push(rounded(out[0] - 0.8, out[0] + 0.8, out[1], out[1] + 1.8, out[2] + 0.3, out[2] + 0.6, 0.05, "#2f5fa8"));
      else if (p.goods && typeof carrying === "number") parts.push(SMALL_FOOD[p.goods[Math.min(carrying, 2)]](out[0], out[1] + 1, out[2] - 1));
    } else {
      parts.push(tube([3.7 * w, 0, top], hand, 1.1, 0.95, p.top), ball(...hand, 0.9, 0.9, 0.9, SKIN));
    }
    // In the other hand while reaching, so it stays on the arm that hangs down.
    const side = frame === 3 || frame === 4 ? -1 : 1;
    const size = Math.max(0.7, Math.min(1, k + 0.05));
    const carriedX = side * (hand[0] + 0.3 + 2 * size);
    if (carrying === "stack") parts.push(...MODELS.basket_stack(0, 4).map((shape) => shifted(shape, 0, 5.5, leg - 1)));
    else if (`${carrying}`.startsWith("bag")) parts.push(...samiBag(carriedX * 1.1, 0.6, Math.max(leg - 2, size * 9), size * 1.3, Number(carrying.slice(3))));
    else if (p.basket && carrying !== "none") parts.push(...shoppingBasket(carriedX, 0.6, leg - 2.4, p.basket, p.goods.slice(0, carrying), size));
    const hair = [...PERSON_HAIR[p.hair](z, r, p.hairColour)];
    if (p.beard) hair.push(ball(0, 1.7, z - r * 0.62, r * 0.78, r * 0.55, r * 0.55, p.beard));
    if (p.glasses) hair.push(...sides((s) => ball(s * r * 0.37, r * 0.93, z + 0.4, 0.8, 0.12, 0.7, "#22222c")));
    return [...parts, ...head(z, hair, r)];
  };
}

// On the till's counter, drawn from the counter's top. The belt runs along x, towards the door.
Object.assign(MODELS, {
  ...Object.fromEntries(Object.entries(PERSON_LOOKS).map(([name, look]) => [`person_${name}`, personModel(look)])),
  ...Object.fromEntries(Object.entries(SMALL_FOOD).map(([name, make]) => [`good_${name}`, () => [make(0, 0, 0.5, 1.1)]])),
  // One tile's length of belt, as the counter is drawn tile by tile; the last stops short of the register.
  till_belt: () => [rounded(-8, 8, -5, 5, -0.2, 0.5, 0.1, "#23232a")],
  till_belt_end: () => [rounded(-8, -1, -5, 5, -0.2, 0.5, 0.1, "#23232a")],
  till_register: () => [
    rounded(-4, 4, -3, 3, 0, 3, 0.5, "#d6d3ca"),
    rounded(-3, 3, -2.2, 2.2, 3, 3.6, 0.2, "#3e3e48"),
    tube([0, -1.8, 3.5], [0, -1.8, 7], 0.6, 0.5, "#8e8e96"),
    { ...rounded(-3, 3, -2.3, -1.2, 7, 11, 0.3, "#3e3e48"), paint: ([, y, z]) => (y > -1.4 && z > 7.6 && z < 10.4 ? "#7fd6a0" : "#3e3e48") },
    { ...rounded(-3, 3, -0.8, 0.4, 7, 11, 0.3, "#3e3e48"), paint: ([, y, z]) => (y > 0.2 && z > 7.6 && z < 10.4 ? "#bfe6f2" : "#3e3e48") },
    rounded(4.6, 8.6, -2.4, 2.4, 0, 1.2, 0.3, "#5a5a64"),
    ball(6.6, 0, 1.3, 1.1, 1.1, 0.25, "#d13a30"),
  ],
  player_basket: () => shoppingBasket(0, 0, 3, "#c84a3a", [], 1),
  till_bag: (frame, which) => samiBag(0, 0, 9, 1.3, which),
  // The way out, its glass doors slid aside, with a green sign over it.
  store_door: () => [
    ...sides((s) => rounded(s * 17 - 1.2, s * 17 + 1.2, -1.2, 1.2, 0, 32, 0.3, "#5a6670")),
    rounded(-18.2, 18.2, -1.2, 1.2, 32, 35, 0.4, "#5a6670"),
    rounded(-4, 4, 1.3, 1.8, 32.6, 34.6, 0.2, "#3e9a5e"),
    ...sides((s) => ({
      ...rounded(s * 12 - 3.8, s * 12 + 3.8, -0.5, 0.5, 0.5, 31.5, 0.1, "#bfe0ec"),
      paint: ([x, , z]) => (Math.abs(x - s * 12) > 3.2 || z < 1.5 || z > 30.5 ? "#7c8a94" : (x + z) % 9 < 1.4 ? "#e6f4f8" : "#bfe0ec"),
    })),
  ],
  store_mat: () => [{ ...rounded(-13, 13, -7, 7, 0, 0.5, 0.2, "#4a5560"), paint: ([x, y]) => (Math.abs(x) > 11.4 || Math.abs(y) > 5.6 || (x + 40) % 4 < 1 ? "#3a444e" : "#4a5560") }],
  // Baskets stacked inside each other, ready to take.
  // On the meat counter: the big piece being cut, on a board.
  meat_board: () => [
    rounded(-7, 7, -5.5, 5.5, 0, 1.2, 0.2, "#b98249"),
    { ...ball(-0.5, 0, 4.6, 5.6, 4, 3.6, "#a83a32"), paint: ([x]) => (Math.abs(((x + 30) % 3.4) - 1.7) < 0.3 ? "#f0d8cc" : "#a83a32") },
    ...[3, 4.6].map((x, i) => rounded(x, x + 0.8, -3, 3, 1.2, 4.6 - i, 0.1, "#b84a40")),
  ],
  // For minced meat, which isn't cut: a steel grinder with its handle going round, and mince coming out into a tray.
  meat_grinder: (frame) => {
    const [cx, cz] = [[0, 3.4], [3.4, 0], [0, -3.4], [-3.4, 0]][frame % 4];
    return [
      rounded(-7, 7, -5.5, 5.5, 0, 1, 0.3, "#c9ccd2"),
      tube([-2.5, 0, 1], [-2.5, 0, 6.5], 2, 2.4, "#8e96a0"),
      tube([-5, 0, 7.5], [2.4, 0, 7.5], 2.4, 2.1, "#a8b0ba"),
      tube([-2.5, 0, 9], [-2.5, 0, 12.5], 2, 3.4, "#c9ccd2"),
      ball(-2.5, 0, 12.4, 2.6, 2.6, 0.6, "#a83a32"),
      tube([-5.5, 0, 7.5], [-6.5, 0, 7.5], 0.5, 0.5, "#6a7078"),
      tube([-6.5, 0, 7.5], [-6.5 , cx, 7.5 + cz], 0.4, 0.4, "#6a7078"),
      ball(-6.5, cx, 7.5 + cz, 0.8, 0.8, 0.8, "#2c2c36"),
      rounded(3, 7, -3, 3, 1, 2, 0.3, "#f4f1e8"),
      { ...ball(5, 0, 2.8, 1.9, 2.4, 1.3, "#b5544a"), paint: ([x, y, z]) => ((Math.round(x * 1.8) + Math.round(y * 1.8) + Math.round(z * 1.8)) % 3 === 0 ? "#d07a6e" : "#b5544a") },
      ...[0, 1].map((i) => tube([3.4, -0.8 + i * 1.6, 7], [4.4, -0.8 + i * 1.6, 3.6], 0.3, 0.3, "#b5544a")),
    ];
  },
  // A small trolley with up to three cardboard boxes, closed, so what's in them doesn't show.
  stock_trolley: (frame, boxes = 3) => [
    ...[[-5, -3.5], [5, -3.5], [-5, 3.5], [5, 3.5]].map(([x, y]) => ball(x, y, 1, 0.9, 0.9, 0.9, "#2c2c36")),
    rounded(-6.5, 6.5, -4.5, 4.5, 2, 3.2, 0.2, "#8e8e96"),
    ...(boxes > 0 ? [rounded(-5.5, 0, -3.8, 3.8, 3.2, 8.5, 0.3, "#b9956a"), rounded(-5.5, 0, -0.4, 0.4, 8.4, 8.8, 0.05, "#d9c49a")] : []),
    ...(boxes > 1 ? [rounded(0.5, 5.5, -3.2, 3.2, 3.2, 7, 0.3, "#c9a57a"), rounded(0.5, 5.5, -0.3, 0.3, 6.9, 7.2, 0.05, "#e0cda8")] : []),
    ...(boxes > 2 ? [rounded(-3.5, 3, -3, 3, 8.5, 11.5, 0.3, "#a8835a"), rounded(-3.5, 3, -0.3, 0.3, 11.4, 11.7, 0.05, "#c9ae84")] : []),
    tube([6.5, -4.5, 3.2], [7.5, -4.5, 13], 0.35, 0.35, "#5a6670"),
    tube([6.5, 4.5, 3.2], [7.5, 4.5, 13], 0.35, 0.35, "#5a6670"),
    tube([7.5, -4.5, 13], [7.5, 4.5, 13], 0.35, 0.35, "#5a6670"),
  ],
  // The way the staff go in and out, on the left wall: no customer goes there.
  staff_door: () => [
    rounded(-0.6, 0.6, -11, 11, 0, 30, 0.2, "#5a6670"),
    rounded(-0.9, 0.9, -9.5, 9.5, 0.5, 28.5, 0.2, "#8e6a4a"),
    rounded(0.8, 1.2, -4, 4, 19, 25, 0.1, "#f4f1e8"),
    ball(1.2, 0, 22, 0.2, 2.2, 2.2, "#d13a30"),
    ball(1.2, -6.5, 13, 0.6, 0.9, 0.9, "#e6c15a"),
  ],
  basket_stack: (frame, count = 5) => ["#c84a3a", "#3e74c9", "#3e8a4e", "#d18f2e", "#c84a3a"].slice(0, Math.min(5, count)).flatMap((colour, i, shown) => [
    { ...rounded(-4.2, 4.2, -3, 3, i * 1.4, i * 1.4 + 3.6, 0.5, colour), paint: ([, , z]) => (z > i * 1.4 + 2.8 ? "#f4f1e8" : colour) },
    ...(i === shown.length - 1 ? sides((s) => tube([s * 3.2, 0, i * 1.4 + 3.6], [0, 0, i * 1.4 + 7], 0.25, 0.25, "#2c2c36")) : []),
  ]),
});

// A peck: these shapes moved forward and down.
// A plastic bottle with a waist, a label round its middle, a sloping shoulder and a screw cap.
const fizzyBottle = (drink, label, cap) => [
  tube([0, 0, 0.9], [0, 0, 4.4], 3.6, 3.5, drink),
  tube([0, 0, 4.4], [0, 0, 6], 3.1, 3.1, drink),
  { ...tube([0, 0, 6.4], [0, 0, 11], 3.6, 3.6, label) },
  tube([0, 0, 11.4], [0, 0, 15.6], 3.5, 1.3, drink),
  tube([0, 0, 15.6], [0, 0, 17.4], 1.2, 1.2, "#dfeef2"),
  tube([0, 0, 17.6], [0, 0, 19], 1.4, 1.4, cap),
];

// Sold at the meat counter on a plate, not in a pack.
// A tray with clear plastic stretched over it, shown by its pale rim and a couple of shiny streaks.
const onPlate = (meat, high = 4) => [
  rounded(-7, 7, -6, 6, 0, 1.2, 0.4, "#f4f1e8"),
  ...meat,
  ...[[-7, -6, 7, -6], [7, -6, 7, 6], [7, 6, -7, 6], [-7, 6, -7, -6]].map(([x0, y0, x1, y1]) => tube([x0, y0, 1.4], [x1, y1, 1.4], 0.3, 0.3, "#dfeef2")),
  tube([-4.5, 2.5, high], [-1, 4.5, high], 0.28, 0.28, "#f8fcfd"),
  tube([1.5, -4.5, high], [4.5, -2.5, high], 0.28, 0.28, "#f8fcfd"),
];

const lowered = (shapes, forward, down) => shapes.map((shape) => {
  const move = ([x, y, z]) => [x, y + forward, z - down];
  if (shape.kind === "ball") return { ...shape, at: move(shape.at) };
  return { ...shape, from: move(shape.from), to: move(shape.to) };
});

// Birds of the Sámi region, for the forest.
const mottled = (colours, size) => ([x, y, z]) => {
  const n = Math.sin(x * 1.7 + y * 0.9) + Math.sin(y * 1.3 - z * 1.1) + Math.sin(z * 1.9 + x * 0.7);
  return colours[Math.min(colours.length - 1, Math.max(0, Math.floor((n + 3) / 6 * colours.length * size)))];
};

Object.assign(MODELS, {
  // In summer colours, to suit the green forest: finely mottled rust brown, with a white belly and a white patch on the
  // wing, white feathered legs, a raised neck and a red comb over the eye. Turns white in winter, if there's ever snow.
  rievssat: (frame) => {
    const feathers = mottled(["#7a4f28", "#a06a38", "#b98249", "#d0a468"], 1);
    return [
      ...(frame === 3 || frame === 4 ? [] : sides((s) => tube([s * 1.5, 0.5, 3.4], [s * 1.5, 1.2, 0.6], 0.9, 0.8, "#f4f1e8"))),
      tube([0, -5, 6.5], [0, -8.5, 7], 1.5, 1, "#3a2a1c"),
      { ...ball(0, -0.5, 6.8, 4.2, 6, 4, "#a06a38"), paint: (p) => (p[2] < 5 ? "#f4f1e8" : feathers(p)) },
      ...(frame === 3 || frame === 4 ? birdWings(3.8, -0.5, 8, 9, frame, "#f4f1e8") : sides((s) => ball(s * 3.9, -2, 5.6, 0.5, 2.8, 1.2, "#f4f1e8"))),
      tube([0, 3.4, 9], [0, 4.4, 13], 2.1, 1.7, "#b5763c"),
      ball(0, 4.8, 14.4, 2.4, 2.6, 2.3, "#b5763c"),
      ...sides((s) => ball(s * 1.8, 5.1, 15.8, 0.7, 1.1, 0.5, "#e0342c")),
      ...eyes(2, 5.7, 14.7, 0.5),
      tube([0, 7.2, 14.2], [0, 8.4, 13.7], 0.6, 0.25, "#2b2b3a"),
    ];
  },
  // A large mottled brown ground bird with a rusty breast and a barred, rounded tail.
  goahppil: (frame) => [
    ...(frame === 3 || frame === 4 ? [] : birdLegs(1.5, 4, "#6b5338", frame > 2 ? 0 : frame)),
    { ...ball(0, -0.5, 8.5, 5, 7.5, 5.2, "#8a6a48"), paint: mottled(["#5f4a34", "#8a6a48", "#a98258"], 1) },
    ball(0, 4.5, 8.5, 3.2, 2.6, 3.4, "#c47a3a"),
    { ...tube([0, -6.5, 8.5], [0, -10.5, 7], 1.2, 2.2, "#5f4a34"), paint: ([, y]) => (y < -10 ? "#2f2418" : "#6b5338") },
    ...birdWings(4.8, -1, 9.5, 12, frame, "#6b5338"),
    ...lowered([
      tube([0, 5, 11], [0, 6.5, 15], 2, 1.5, "#8a6a48"),
      ball(0, 7, 16, 2, 2.4, 1.9, "#8a6a48"),
      tube([0, 8.8, 16], [0, 10.2, 15.6], 0.7, 0.3, "#d9c9a4"),
      ...eyes(1.7, 7.8, 16.6, 0.45),
    ], frame === 5 ? 2 : 0, frame === 5 ? 8 : 0),
  ],
  // The male in display, after a photograph the user gave: dark, with a great fan of a tail raised behind him, a
  // shining green breast, a white spot at the shoulder, a brown wing, a red brow, a pale beak and a shaggy beard.
  beahceloddi: (frame) => [
    ...(frame === 3 || frame === 4 ? [] : birdLegs(1.8, 5, "#6b5338", frame > 2 ? 0 : frame)),
    ...[-68, -50, -33, -17, 0, 17, 33, 50, 68].map((angle) => {
      const a = (angle * Math.PI) / 180;
      return {
        ...tube([0, -5, 10], [Math.sin(a) * 11, -9 + Math.abs(Math.sin(a)) * 2, 10 + Math.cos(a) * 12], 0.9, 1.5, "#2b2b36"),
        paint: ([x, , z]) => (Math.hypot(x, z - 10) > 9.5 ? "#4a4a58" : "#2b2b36"),
      };
    }),
    { ...ball(0, 0, 9, 5, 6.5, 5.2, "#2f2f3a"), paint: ([x, y, z]) => (y > 2.5 && z > 8 && z < 12.5 ? "#2f8a6a" : z < 5.5 ? "#23232c" : "#2f2f3a") },
    ...(frame === 3 || frame === 4 ? birdWings(4.5, -1.5, 10, 14, frame, "#7a5433") : sides((s) => ball(s * 4.5, -1.5, 9.5, 1, 4, 3.2, "#7a5433"))),
    ...sides((s) => ball(s * 5, 2, 11.4, 0.6, 0.9, 0.9, "#f4f1e8")),
    ...lowered([
      tube([0, 3, 12], [0, 4.5, 19], 2.4, 1.7, "#3a3a48"),
      ball(0, 5, 20.5, 2.1, 2.7, 2, "#2f2f3a"),
      ...sides((s) => ball(s * 1.6, 5.2, 22, 0.8, 1.1, 0.5, "#d13a30")),
      tube([0, 7, 20.8], [0, 9, 21.6], 1, 0.5, "#e6dfc8"),
      tube([0, 5.6, 19], [0, 6, 16.5], 1.1, 0.4, "#20202a"),
      ...eyes(1.9, 6, 20.6, 0.45),
    ], frame === 5 ? 3 : 0, frame === 5 ? 11 : 0),
  ],
  // All black, big and sleek, with a heavy beak and a wedge of a tail.
  garanas: (frame) => [
    ...(frame === 3 || frame === 4 ? [] : birdLegs(1.3, 4, "#20202a", frame)),
    ball(0, -0.5, 8, 3.7, 7, 4.3, "#33333f"),
    ball(0, 4.8, 8.6, 2.5, 2.2, 2.8, "#2b2b36"),
    tube([0, -6.5, 8], [0, -12, 6.8], 2, 0.6, "#2b2b36"),
    ...birdWings(3.5, -1.5, 9.2, 13, frame, "#3f3f50"),
    ...lowered([
      ball(0, 6.5, 12, 2.6, 3.2, 2.6, "#33333f"),
      tube([0, 9, 12.2], [0, 13, 11.3], 1.2, 0.35, "#15151b"),
      ...eyes(2.2, 7.6, 12.8, 0.5, "#a4aab0"),
    ], frame === 5 ? 1.5 : 0, frame === 5 ? 7 : 0),
  ],
  // White and long-necked, its beak yellow with a black tip, as on a whooper swan.
  njukca: (frame) => [
    ...(frame === 3 || frame === 4 ? [] : birdLegs(1.8, 4, "#2b2b3a", frame > 2 ? 0 : frame)),
    ball(0, -2, 8, 5, 8.5, 5, "#f4f1e8"),
    tube([0, -9.5, 9], [0, -12, 10.5], 2, 0.8, "#f4f1e8"),
    ...birdWings(4.6, -3, 9.6, 12, frame, "#ece8dc"),
    tube([0, 5, 10], [0, 6.5, 15], 2, 1.6, "#f4f1e8"),
    tube([0, 6.5, 15], [0, 6, 21], 1.6, 1.3, "#f4f1e8"),
    ball(0, 7, 22.2, 1.9, 2.5, 1.7, "#f4f1e8"),
    tube([0, 9, 22], [0, 11.2, 21.2], 0.9, 0.6, "#f2c14e"),
    tube([0, 11.2, 21.2], [0, 12.6, 20.8], 0.6, 0.3, "#22222c"),
    ...eyes(1.6, 8, 22.6, 0.4),
  ],
  // Big and brown with a paler head, feathered legs and a hooked yellow beak.
  goaskin: (frame) => [
    ...(frame === 3 || frame === 4 ? [] : [
      ...sides((s) => tube([s * 2.2, 0.5, 6], [s * 2.2, 1, 1.6], 1.5, 1, "#6b4a2c")),
      ...sides((s) => ball(s * 2.2, 2, 0.8, 1.3, 1.8, 0.8, "#e6b93a")),
    ]),
    { ...ball(0, 0, 11, 5.2, 7, 7, "#6b4a2c"), paint: mottled(["#4f341f", "#6b4a2c", "#7a5433"], 1) },
    tube([0, -6, 8], [0, -11, 4.5], 2.4, 1.6, "#4f341f"),
    ...birdWings(5, -0.5, 13, 19, frame, "#4f341f"),
    ball(0, 4.5, 18.5, 3.2, 3.4, 3.2, "#b89268"),
    tube([0, 7.4, 18.8], [0, 9.6, 18.4], 1.2, 0.8, "#e6b93a"),
    tube([0, 9.6, 18.4], [0, 10, 16.8], 0.7, 0.3, "#3a2a1c"),
    ...eyes(2.6, 6, 19.6, 0.55, "#2b1a10"),
  ],
  // The white owl of the fells: egg-shaped with the head running into the body, fine dark bars, no ear tufts and
  // narrow yellow eyes. The head still turns to the player.
  jievjaskuolfi: (frame) => {
    const barred = ([x, , z]) => (Math.abs(((z + 40) % 2.2) - 1.1) < 0.28 && Math.sin(x * 2.1 + z) > -0.2 ? "#6e6e78" : "#f7f4ea");
    return [
      ...(frame === 3 || frame === 4 ? [] : sides((s) => ball(s * 1.7, 1.6, 0.9, 1.6, 2, 0.9, "#f7f4ea"))),
      { ...ball(0, 0, 8, 5.4, 4.8, 7.4, "#f7f4ea"), paint: barred },
      tube([0, -3.5, 4], [0, -6, 1.8], 1.8, 1.1, "#ece8dc"),
      ...birdWings(5, -0.3, 9, 11, frame, "#ece8dc"),
      ...asHead([
        ball(0, 0, 15.5, 4.8, 4.4, 3.8, "#fbf8ee"),
        ...sides((s) => ball(s * 2, 4, 16, 1.5, 0.5, 0.75, "#f2c14e")),
        ...sides((s) => ball(s * 2, 4.4, 16, 0.7, 0.25, 0.65, "#22222c")),
        tube([0, 4.2, 15], [0, 4.9, 13.9], 0.55, 0.2, "#3a3a48"),
      ]),
    ];
  },
});

// How each animal moves, and the shape of its shadow. Things only have a shadow.
const ANIMAL_WAYS = {
  boazu: { shadow: [23, 8] }, beana: { greets: true, near: 3.2, shadow: [15, 6] }, loddi: { flights: true, pecks: true, shadow: [9, 4] },
  njoammil: { hops: true, shadow: [12, 5] }, guovza: { shadow: [22, 9] }, rieban: { shadow: [16, 5] },
  oarri: { hops: true, shadow: [9, 3] }, skuolfi: { flights: true, looks: true, shadow: [11, 5] }, cuoppu: { hops: true, shadow: [12, 5] },
  sahpan: { shadow: [9, 4] }, beaiveloddi: { flies: true, shadow: [4, 2] }, gahttu: { shadow: [14, 5] },
  bin: { shadow: [12, 6] }, guolli: { shadow: [12, 3] }, savza: { shadow: [15, 7] }, gussa: { shadow: [22, 8] }, spiidni: { shadow: [15, 7] }, vuonccis: { pecks: true, shadow: [11, 5] },
  rievssat: { flights: true, shadow: [12, 5] }, goahppil: { pecks: true, crosses: true, shadow: [16, 6] }, beahceloddi: { pecks: true, crosses: true, shadow: [18, 7] }, garanas: { flights: true, pecks: true, crosses: true, shadow: [15, 5] },
  njukca: { crosses: true, shadow: [18, 7] }, goaskin: { flights: true, crosses: true, shadow: [18, 7] }, jievjaskuolfi: { flights: true, looks: true, crosses: true, shadow: [12, 5] },
  // Those who stay where they are and keep doing something: the time each picture lasts, and where they look.
  eadni: { acts: 300, shadow: [0, 0] }, viellja: { acts: 900, shadow: [0, 0] }, oabbá: { acts: 700, shadow: [12, 5] },
  áhčči: { acts: 420, head: 0, shadow: [12, 5] }, tv: { acts: 1100, shadow: [14, 6] },
};
