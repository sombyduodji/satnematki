// One loop: the game names a Sámi word, the player walks their character to the thing it
// means. Touching anything shows its word and translation, so a child who knows
// no words yet can learn by exploring. There is no way to lose.
const WORDS_PER_ROUND = 8;
const PLACING_TRIES = 20;
const BEST_TIMES = 10;

const TEXT = {
  find: "Etsi:",
  found: "Löysit sen!",
  thisIs: "Tämä on",
  thisIsPerson: "Hän on",
  plural: "Monta:",
  done: "Hienoa! Löysit kaikki.",
  again: "Pelaa uudestaan",
  start: "Liiku nuolinäppäimillä tai napauta. Kaksi näppäintä yhdessä liikkuu polkujen suuntaan. Shift pohjassa juokset, välilyönti hyppää, C kyykistyy. Kun kosket johonkin, näet sen nimen.",
  ready: "Valmis",
  makeCharacter: "Tee oma hahmosi",
  // The spoken lines. question and bures must match tools/fetch_voices.py.
  question: (name) => `Mii du namma lea? Mu namma lea ${name}.`,
  questionFi: (name) => `Mikä sinun nimesi on? Minun nimeni on ${name}.`,
  bures: (name) => (name ? `Bures, ${name}!` : "Bures!"),
  buresFi: (name) => (name ? `Hei, ${name}!` : "Hei!"),
  yourName: "Kirjoita nimesi",
  // Sámi and Finnish, in the same order as PRAISE and WRONG in tools/fetch_voices.py.
  right: [
    ["Riekta!", "Oikein!"],
    ["Nu lea!", "Niin on!"],
    ["Buorre!", "Hyvä!"],
    ["Hui buorre!", "Todella hyvä!"],
    ["Čeahppi!", "Taitava!"],
    ["Gávdnet dan!", "Löysit sen!"],
    ["Dat lei riekta!", "Se oli oikein!"],
    ["Hui bures!", "Todella hyvin!"],
    ["Hui čeahppi!", "Todella taitava!"],
    ["Nu fal!", "Niinpä!"],
    ["Don máhtát dan!", "Sinä osaat sen!"],
    ["Juo, nu lea!", "Kyllä, niin on!"],
    ["Dat lea riekta!", "Se on oikein!"],
  ],
  wrong: [
    ["Ii lean, geahččaleadnu ođđasit!", "Ei ollut, yritetään uudelleen!"],
    ["Ii dat lean.", "Ei se ollut."],
    ["Geahččaleadnu ođđasit!", "Yritetään uudelleen!"],
    ["Ii vel!", "Ei vielä!"],
    ["Ii lean dat. Geahččaleadnu vel!", "Ei ollut se. Yritetään vielä!"],
    ["Ii lean riekta.", "Ei ollut oikein."],
    ["Geahččal vel!", "Yritä vielä!"],
    ["Geahččal ođđasit!", "Yritä uudelleen!"],
    ["Oza vel!", "Etsi vielä!"],
    ["Ale vuollán!", "Älä luovuta!"],
    ["Dat lei juoga eará.", "Se oli jotain muuta."],
  ],
  thisWord: (word) => `Dát lea ${word}.`,
  thisWordFi: (word) => `Tämä on ${word}.`,
  // People are "he or she", not "this".
  thisPerson: (word) => `Son lea ${word}.`,
  thisPersonFi: (word) => `Hän on ${word}.`,
  // What the window at the start of a map says: what to find there, then how to move.
  guide: {
    goal: {
      home: "Etsi se tai hän, jonka nimi lukee ylhäällä. Mene lähelle, niin näet, oliko se oikea.",
      animals: "Etsi eläin, jonka nimi lukee ylhäällä. Mene sen luo, niin näet, oliko se oikea.",
      "city-names": "Etsi se, jonka nimi lukee ylhäällä. Mene sen luo, niin näet, oliko se oikea.",
      "city-mixed": "Etsi ajoneuvo, jonka nimi ja väri lukevat ylhäällä, esimerkiksi biila: ruoksat.",
      city: "Etsi ajoneuvo, joka lukee ylhäällä, esimerkiksi rukses biila.",
      "library-books": "Kaikki ovat kirjoja, joten katso väriä. Etsi hyllyistä kirja, jonka väri lukee ylhäällä.",
      "library-mixed": "Etsi tavara, jonka nimi ja väri lukevat ylhäällä, esimerkiksi girji: ruoksat. Kirjat ovat hyllyissä, kynät ja vihot pöydillä.",
      library: "Etsi tavara, joka lukee ylhäällä, esimerkiksi rukses girji. Kirjat ovat hyllyissä, kynät ja vihot pöydillä.",
      store: "Hae ostoslistan ruoat järjestyksessä. Ne ovat hyllyissä, jääkaapeissa, pakastimissa ja laatikoissa.",
      classroom: "Etsi oikea numero pulpetilta. Mene pulpetin tuolin luo ja paina C, niin istut ja katsot numeron. Puhelimessa paina Istu tai napauta pulpettia.",
    },
    move: "Liiku nuolilla tai WASD-näppäimillä tai napauta. Puhelimessa käytä painikkeita.",
    run: "Juokse: pidä Shift pohjassa. Juostessa et voi koskea mihinkään, ja jos osut johonkin, liu'ut mahallasi!",
    jump: {
      forest: "Hyppää: välilyönti. Jos hyppäät päin puuta, kaadut!",
      city: "Hyppää: välilyönti. Jos hyppäät päin ajoneuvoa tai seinää, kaadut!",
      indoors: "Hyppää: välilyönti. Jos hyppäät päin hyllyä tai seinää, kaadut!",
      classroom: "Luokassa ei hypitä.",
    },
    crouch: "Kyykisty: C.",
    crouchClassroom: "Kyykisty: C, kun tuoli ei ole lähellä.",
    ok: "OK",
  },
  startClassroom: "Liiku nuolinäppäimillä tai napauta. Shift pohjassa juokset. Paina C tuolin luona, niin istut ja katsot numeron. Muualla C kyykistyy.",
  emptyDesk: "Tällä pulpetilla ei ole numeroa.",
  run: "Juokse",
  sit: "Istu",
  yourTime: "Aikasi:",
  bestTimes: "Parhaat ajat",
  newRecord: "Uusi ennätys!",
  choosePlace: (name) => (name ? `Hei, ${name}! Minne mennään?` : "Minne mennään?"),
  mainMenu: "Päävalikkoon",
  changePlayer: "Vaihda pelaajaa",
  playAgain: "Pelaa taas",
  demoNotice: "Tämä on vain teknologiademo. Ominaisuudet ja pelattavuus voivat vielä muuttua paljon mahdollista lopullista versiota varten. Yhtäkään käännöstä ei ole tarkistettu, ja ne on tehty automaattisesti.",
  best: "Paras:",
  back: "← Takaisin",
  chooseLevel: "valitse taso",
  level: "Taso",
  levels: (count) => `${count} tasoa`,
};

// What a round looks for, and where. A theme hands out the words to find and a few others beside them.
const wordsOfTheme = (theme) => window.MAHTTE_WORDS.filter((w) => w.theme === theme);
const BIG_THINGS = new Set(["car", "bus", "truck", "tractor"]);

// Numbers from 0 to the most, each on a desk. Some are left over and are never asked for.
function numberWords(most, findCount, extraCount) {
  const words = shuffled(Array.from({ length: most + 1 }, (_, number) => ({
    lemma: window.MAHTTE_NUMBERS[number],
    fi: String(number),
    number,
    place: "desk",
  })));
  return { find: words.slice(0, findCount), extra: words.slice(findCount, findCount + extraCount) };
}

function plainWords(theme, findCount, extraCount) {
  const words = shuffled(wordsOfTheme(theme));
  return { find: words.slice(0, findCount), extra: words.slice(findCount, findCount + extraCount) };
}

// Every combination of a few things and a few colours, so the same colour and the same thing both
// appear and neither alone is the answer.
function colouredWords(theme, findCount, extraCount, makeWord, { nouns, firstNouns = [], nounCount = 4, colourCount = 4 } = {}) {
  const all = wordsOfTheme(theme).filter((w) => !nouns || nouns.includes(w.sprite));
  const rest = shuffled(all.filter((w) => !firstNouns.includes(w.sprite)));
  const chosenNouns = [...all.filter((w) => firstNouns.includes(w.sprite)), ...rest].slice(0, nounCount);
  const chosenColours = shuffled(wordsOfTheme("colour")).slice(0, colourCount);
  const combinations = shuffled(chosenNouns.flatMap((noun) => chosenColours.map((colour) => ({
    sprite: noun.sprite,
    colour: colour.sprite,
    place: noun.place,
    big: BIG_THINGS.has(noun.sprite),
    ...makeWord(noun, colour),
  }))));
  return { find: combinations.slice(0, findCount), extra: combinations.slice(findCount, findCount + extraCount) };
}

// Easy: the noun and the colour in their base forms. "biila: ruoksat" to find, "biila lea ruoksat" once found.
const easyPhrase = (noun, colour) => ({
  spoken: "easy",
  lemma: `${noun.lemma} lea ${colour.forms["Sg+Nom"][0]}`,
  fi: `${noun.fi} on ${colour.fi}`,
  aim: colour.forms["Sg+Nom"][0],
  aimOf: noun.lemma,
  thisWord: `Dát ${noun.lemma} lea ${colour.forms["Sg+Nom"][0]}.`,
  thisWordFi: `Tämä ${noun.fi} on ${colour.fi}.`,
  forms: { "Pl+Nom": [`${noun.forms["Pl+Nom"][0]} leat ${colour.forms["Pl+Nom"][0]}`] },
});

// Harder: the colour's attributive form goes before the noun. "rukses biila".
const attributivePhrase = (noun, colour) => ({
  spoken: "hard",
  lemma: `${colour.forms.Attr[0]} ${noun.lemma}`,
  fi: `${colour.fi} ${noun.fi}`,
  forms: { "Pl+Nom": [`${colour.forms.Attr[0]} ${noun.forms["Pl+Nom"][0]}`] },
});

// On the easy level a round has one kind of thing in every colour, so the colour is all there is to read.
const EASY = { nounCount: 1, colourCount: 7 };

// The car park's first level has only names to read, so what it draws keeps one look unless it can be any colour.
const LOT_COLOURS = { taxi: "white", ambulance: "white", firetruck: "red", trailer: "grey" };
function carParkWords(findCount, extraCount) {
  const colours = wordsOfTheme("colour").map((colour) => colour.sprite);
  const parked = [...wordsOfTheme("vehicle"), ...wordsOfTheme("lot").filter((w) => w.place === "bay")].map((word) => ({
    ...word,
    colour: LOT_COLOURS[word.sprite] || shuffled(colours)[0],
  }));
  const words = shuffled([...parked, ...wordsOfTheme("lot").filter((w) => w.place === "land"), ...wordsOfTheme("animal").filter((w) => w.sprite === "boazu")]);
  return { find: words.slice(0, findCount), extra: words.slice(findCount, findCount + extraCount) };
}

const THEMES = [
  { id: "home", title: "Koti", place: "home", sprite: "sofa", words: () => plainWords("home", 8, 99) },
  { id: "animals", title: "Eläimet", place: "forest", sprite: "rieban", words: () => plainWords("animal", 8, 3) },
  { id: "city-names", title: "Parkkipaikka", level: "helppo", example: "biila", place: "city", sprite: "car", colour: "red", words: () => carParkWords(8, 4) },
  { id: "city-mixed", title: "Parkkipaikka", level: "keskitaso", example: "biila: vielgat", place: "city", sprite: "bus", colour: "yellow", words: () => colouredWords("vehicle", 6, 5, easyPhrase) },
  { id: "city", title: "Parkkipaikka", level: "vaikeampi", example: "vilges biila", place: "city", sprite: "truck", colour: "blue", words: () => colouredWords("vehicle", 6, 5, attributivePhrase) },
  { id: "library-books", title: "Kirjasto", level: "helppo", example: "girji: alit", place: "library", sprite: "book", colour: "blue", words: () => colouredWords("item", 5, 2, easyPhrase, { ...EASY, nouns: ["book"] }) },
  { id: "library-mixed", title: "Kirjasto", level: "keskitaso", example: "peanna: čáhppat", place: "library", sprite: "pen", colour: "red", words: () => colouredWords("item", 6, 5, easyPhrase) },
  { id: "library", title: "Kirjasto", level: "vaikeampi", example: "vilges girji", place: "library", sprite: "notebook", colour: "green", words: () => colouredWords("item", 6, 5, attributivePhrase) },
  { id: "store", title: "Kauppa", place: "store", sprite: "apple", ordered: true, words: () => plainWords("food", 5, 6) },
  { id: "numbers-10", title: "Luokka", level: "0–10", place: "classroom", number: 7, desks: true, words: () => numberWords(10, 7, 4) },
  { id: "numbers-20", title: "Luokka", level: "0–20", place: "classroom", number: 15, desks: true, words: () => numberWords(20, 10, 8) },
  { id: "numbers-100", title: "Luokka", level: "0–100", place: "classroom", number: 64, desks: true, words: () => numberWords(100, 10, 8) },
];
let theme = null;
let shoppingList = [];
const translation = (word) => word.fi;

// Character art comes from tools/make_mahtte.py, one sheet per combination.
// Everything facing left is mirrored. Jump and crouch are drawn facing the player.
const CHOICES = [
  { key: "gender", label: "Hahmo", options: [["boy", "Poika"], ["girl", "Tyttö"]] },
  { key: "outfit", label: "Gákti", options: [["ohcejohka", "1"], ["karasjohka", "2"]] }, // numbered on purpose: no place names for players
  { key: "hair", label: "Hiusväri", options: [["blond", "Vaalea"], ["brown", "Ruskea"], ["red", "Punainen"]] },
  { key: "length", label: "Hiukset", byGender: true },
];
// Each gender has its own styles, the same ones as HAIR_STYLES in tools/make_mahtte.py.
const STYLES = {
  boy: [["short", "Lyhyet"], ["tousled", "Pörröiset"], ["mid", "Puolipitkät"]],
  girl: [["mid", "Puolipitkät"], ["long", "Pitkät"], ["braids", "Letit"]],
};
const HAIR_SWATCHES = { blond: "#e6c46e", brown: "#7a4d2b", red: "#b5472a" };
const DEFAULT_STYLE = { boy: "short", girl: "long" };
const optionsFor = (choice, { gender }) => (choice.byGender ? STYLES[gender] : choice.options);
const NAMES = { boy: "Máhtte", girl: "Biret" };
const VOICES = { boy: "mahtte", girl: "biret" };
const BUBBLE_MIN_MS = 1800;
const NAME_MAX = 15;
const LINE_MAX_MS = 8000; // a line that never finishes must not silence the rest of the game
const ANNOUNCE_MS = 3000;
const ANNOUNCE_PAUSE_MS = 900; // after the last find, before the next word appears
const DEFAULT_LOOK = { gender: "boy", outfit: "ohcejohka", hair: "brown", length: "short" };
const FRAME_W = 24;
const FRAME_H = 40;
const IDLE_ROW = { down: 0, up: 1, right: 2, left: 2 };
const ACTIONS = {
  cheer: { row: 6, ms: 540 },
};
const CROUCH_ROW = 8;
// Momentum rows: idle and walk again for each direction and sway, then the lifted hem.
const SWAY_ROWS = 10;
const SWAYS = [-2, -1, 1, 2];
const LIFT_ROW = { down: 34, up: 35 };
const FACING = { down: 0, up: 1, right: 2, left: 2 };
const DIAGONAL_ROWS = 36; // idle and walk, facing lower right then upper right, for each sway
const WALK_FRAME_MS = 47.5;
const FALL_ROW = 9;
// Rising, top and coming down. Facing left is mirrored.
const JUMP_ROWS = { S: 56, N: 57, E: 58, W: 58, SE: 59, SW: 59, NE: 60, NW: 60 };
const WIPE_ROW = 61;
const RUN_ROWS = 62;
const RUN_SWAYS = 7;
const RUN_FACING = { S: 0, N: 1, E: 2, W: 2, SE: 3, SW: 3, NE: 4, NW: 4 };
const SLIDE_ROW = 97;
const SIT_ROW = 98;
// lookAhead: a straight run into something within this many tiles dives in time. pathWidth: how close to the runner's
// centre line it must be. contact: how much of a step being pushed back by anything counts as hitting it, so only
// a shallow brush along something is run past.
const SLIDE = { ms: 340, lookAhead: 1.1, pathWidth: 0.1, contact: 0.3, restMs: 380 };
const RUN = { speed: 1.8, animation: 1.7, cloth: 1.9, stepStrength: 1.5 };
const JUMP = { ms: 520, height: 14, clears: 6 }; // height is half the character; above clears, low things pass under
const dusty = () => placeName === "forest"; // puffs of dust are for outdoors in the forest, not town or indoors
const DUST = { path: "240, 228, 196", ground: "214, 208, 164" }; // pale, to show on both; none on the bridge, in town or indoors
const LINE_FADE = 0.07; // seconds a line takes to fade when something new is said over it
const SOUND_AHEAD = 0.015; // sounds start this far ahead, as starting "now" can already be slightly too late
const SOFT_START = 0.012; // seconds for a sound to fade in; starting at full level clicks
const KNOCK = { sitAt: 220, wipeAt: 1000, wipeFrameMs: 120, pushMs: 220, pushSpeed: 0.003 };
// Getting up, two strokes with each hand while bent over, then shaking the hem.
const WIPE_ORDER = [0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7];
const sheetCache = new Map();

function sheetFor({ outfit, gender, hair, length }) {
  const name = `${outfit}-${gender}-${hair}-${length}`;
  if (!sheetCache.has(name)) {
    const image = new Image();
    image.src = `art/mahtte/sprites/${name}.png`;
    sheetCache.set(name, image);
  }
  return sheetCache.get(name);
}

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

const promptEl = document.getElementById("prompt");
const cardEl = document.getElementById("card");
const pictureCache = new Map();
function pictureOf(word) {
  const key = `${word.sprite}/${word.colour || ""}/${word.number ?? ""}`;
  if (!pictureCache.has(key)) {
    pictureCache.set(key, word.number !== undefined ? numberCard(word.number)
      : VEHICLES[word.sprite] ? vehiclePicture(word.sprite, word.colour)
      : MODELS[word.sprite] ? modelPicture(word.sprite, word.colour)
      : spriteCanvas(SPRITES[word.sprite], word.colour));
  }
  return pictureCache.get(key);
}

// A number on a sheet of paper, for the top of a desk.
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001010010", "111101111101111", "111101111001111"];
function numberCard(number) {
  const text = String(number);
  const scale = 2;
  const c = document.createElement("canvas");
  c.width = text.length * 8 + 4;
  c.height = SPRITE_SIZE;
  const g = c.getContext("2d");
  g.fillStyle = OUTLINE;
  g.fillRect(0, 2, c.width, 16);
  g.fillStyle = "#fbf6e8";
  g.fillRect(1, 3, c.width - 2, 14);
  g.fillStyle = "#c8372d";
  [...text].forEach((digit, i) => {
    [...DIGITS[digit]].forEach((bit, k) => {
      if (bit === "1") g.fillRect(3 + i * 8 + (k % 3) * scale, 5 + Math.floor(k / 3) * scale, scale, scale);
    });
  });
  return c;
}

let look = loadLook();
let chosen = look !== null;
look = look || { ...DEFAULT_LOOK };
let walkClock = 0;
let action = null; // { name, start } while an animation plays
let crouching = false;
let objects = [];
let targets = [];
let stars = 0;
let roundSize = 0;
let sparkles = [];
let preview = null;
const timer = { ms: 0, running: false, shown: null };
const timerEl = document.getElementById("timer");
let roundEnding = 0; // leaving before the results appear cancels them
let paused = true; // no moving while the chooser or the greeting is open
let greeted = false;
let greeting = 0; // a newer greeting or the chooser cancels the one waiting to finish
const voice = typeof Audio === "function" ? new Audio() : null;
const held = new Set();
let tapped = null; // a key press shorter than one frame still moves a little
let runKey = false; // Shift, or the run button on the on-screen pad

function loadLook() {
  try {
    const saved = JSON.parse(localStorage.getItem("mahtte.look"));
    return saved?.gender in STYLES && CHOICES.every((c) => optionsFor(c, saved).some(([id]) => id === saved[c.key])) ? saved : null;
  } catch {
    return null;
  }
}

function saveLook() {
  try {
    localStorage.setItem("mahtte.look", JSON.stringify(look));
  } catch {
    // Private windows may refuse; the choice still holds for this visit.
  }
}

function cleanName(text) {
  return text.normalize("NFC").replace(/[^\p{L}\p{M} '-]/gu, "").trim().slice(0, NAME_MAX).trim();
}

// null until the player has answered. An empty name means they went on without one.
function loadName() {
  try {
    const saved = localStorage.getItem("mahtte.name");
    return saved === null ? null : cleanName(saved);
  } catch {
    return null;
  }
}

function saveName(name) {
  try {
    localStorage.setItem("mahtte.name", name);
  } catch {
    // Private windows may refuse; the game asks again on the next visit.
  }
}

function loadTimes(themeId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`mahtte.times.${themeId}`));
    return Array.isArray(saved) ? saved.filter((t) => Number.isFinite(t?.ms)) : [];
  } catch {
    return [];
  }
}

// Adds a time and returns the best ones, with the new one marked.
function addTime(ms, name, themeId) {
  const entry = { ms, name };
  const times = [...loadTimes(themeId), entry].sort((a, b) => a.ms - b.ms).slice(0, BEST_TIMES);
  try {
    localStorage.setItem(`mahtte.times.${themeId}`, JSON.stringify(times));
  } catch {
    // Private windows may refuse; the list still shows for this round.
  }
  return { times, place: times.indexOf(entry) };
}

function formatTime(ms) {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

function showTimer() {
  const text = formatTime(timer.ms);
  if (text === timer.shown) return;
  timer.shown = text;
  timerEl.textContent = text;
}

function closeResults() {
  document.getElementById("results")?.remove();
}

// The round is over. Play stops at once; when the character has finished speaking, the time and
// the best times appear, with the way to go on.
async function finishRound(name, speech) {
  timer.running = false;
  paused = true;
  held.clear();
  tapped = null;
  me.route = [];
  crouching = false;
  announcement++;
  document.getElementById("announce")?.remove();
  const { times, place } = addTime(timer.ms, name, theme.id);
  const mine = ++roundEnding;
  await Promise.all([speech, new Promise((resolve) => setTimeout(resolve, ANNOUNCE_PAUSE_MS))]);
  if (mine === roundEnding) showResults(times, place);
}

function showResults(times, place) {
  closeResults();
  const results = document.createElement("div");
  results.id = "results";
  results.setAttribute("role", "dialog");
  results.innerHTML = `<div class="panel">
      <h2>${TEXT.done}</h2>
      <div class="note">${TEXT.yourTime}</div>
      <div class="time">${formatTime(timer.ms)}</div>
      ${place === 0 ? `<div class="record">${TEXT.newRecord}</div>` : ""}
      <h3>${TEXT.bestTimes}</h3>
      <ol></ol>
      <div class="buttons"><button id="again">${TEXT.again}</button><button id="places">${TEXT.mainMenu}</button></div>
    </div>`;
  times.forEach((time, i) => {
    const row = document.createElement("li");
    if (i === place) row.className = "new";
    row.textContent = time.name ? `${formatTime(time.ms)}  ${time.name}` : formatTime(time.ms);
    results.querySelector("ol").append(row);
  });
  document.body.append(results);
  results.querySelector("#again").addEventListener("click", newRound);
  results.querySelector("#places").addEventListener("click", showPlaces);
  results.querySelector("#again").focus();
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function enterTheme(chosenTheme) {
  theme = chosenTheme;
  document.body.classList.remove("menu");
  try {
    localStorage.setItem("mahtte.last", theme.id);
  } catch {
    // Private windows may refuse; the menu then just offers no shortcut.
  }
  prepareLines(answerLines());
  enterPlace(theme.place);
  setPadForTheme();
  newRound();
  showGuide();
}

// In the classroom the on-screen pad sits instead of jumping and crouching.
function setPadForTheme() {
  document.getElementById("jump").hidden = !!theme?.desks;
  document.getElementById("crouch").textContent = theme?.desks ? TEXT.sit : "Kyykky";
}

// The rules first, and the round waits until the player has read them.
function showGuide() {
  paused = true;
  announcement++;
  document.getElementById("announce")?.remove();
  const guide = TEXT.guide;
  const inClassroom = theme.place === "classroom";
  const lines = [
    guide.goal[inClassroom ? "classroom" : theme.id],
    guide.move,
    guide.run,
    guide.jump[theme.place] || guide.jump.indoors,
    inClassroom ? guide.crouchClassroom : guide.crouch,
  ];
  const level = theme.level ? ` (${theme.level})` : "";
  closeResults();
  const panel = document.createElement("div");
  panel.id = "results";
  panel.setAttribute("role", "dialog");
  panel.innerHTML = `<div class="panel"><h2>${theme.title}${level}</h2><ul></ul><div class="buttons"><button id="guide-ok">${guide.ok}</button></div></div>`;
  for (const line of lines) {
    const row = document.createElement("li");
    row.textContent = line;
    panel.querySelector("ul").append(row);
  }
  document.body.append(panel);
  const ok = panel.querySelector("#guide-ok");
  ok.addEventListener("click", () => {
    closeResults();
    paused = false;
    announce();
  });
  ok.focus();
}

function newRound() {
  // Nothing appears on top of the character or behind anything, everything can be walked to,
  // and no way through is cut off.
  const clear = ([x, y]) => Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y) > 1.5;
  closeResults();
  roundEnding++;
  timerEl.hidden = false;
  paused = false;
  me.sittingOn = null;
  const { find, extra } = theme.words();
  const picked = [...find, ...extra];
  for (let attempt = 0; attempt < PLACING_TRIES; attempt++) {
    const used = new Set();
    objects = picked.map((word) => {
      if (word.place === "home") {
        const [x, y, facing] = SPOTS.home[word.sprite];
        return { word, x, y, facing, phase: Math.random() * 3000 };
      }
      // A large thing needs a larger clear view, so it can only take some of the spots.
      const large = word.big || word.sprite === "viessu";
      const spots = word.place === "land" && large ? OPEN_SPOTS.large : OPEN_SPOTS[word.place];
      // Only a thing standing free could land on the character; the rest are in fixtures.
      const spot = shuffled(spots).find((s) => (word.place !== "land" || clear(s)) && !used.has(`${s}`));
      used.add(`${spot}`);
      return { word, x: spot[0], y: spot[1], phase: Math.random() * 3000 };
    });
    if (everythingInReach()) break;
  }
  prepareLines(objects.map((o) => wordLine(o.word))); // only this round's, as there are hundreds in all
  buildAnimalsAhead();
  targets = shuffled(find);
  shoppingList = theme.ordered ? [...targets] : [];
  roundSize = find.length;
  stars = 0;
  me.route = [];
  touching.clear();
  timer.ms = 0;
  timer.running = false;
  timer.shown = null;
  showTimer();
  showPrompt();
  showStartCard();
}

function escapeText(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function showPrompt() {
  const starRow = "★".repeat(stars) + "☆".repeat(roundSize - stars);
  if (!theme) {
    promptEl.innerHTML = `<span>${escapeText(TEXT.choosePlace(loadName()))}</span>`;
  } else if (targets.length) {
    const aim = targets[0].aim || targets[0].lemma;
    const aimOf = targets[0].aimOf ? `<span class="aim-of" lang="se">${escapeText(targets[0].aimOf)}:</span>` : "";
    promptEl.innerHTML = `<span>${TEXT.find}</span>${aimOf}
      <span class="target waiting${aim.length > 12 ? " long" : ""}" lang="se">${escapeText(aim)}</span>
      <span class="stars" aria-label="${stars}/${roundSize}">${starRow}</span>`;
    if (shoppingList.length) {
      const list = document.createElement("ol");
      list.className = "shopping";
      list.lang = "se";
      shoppingList.forEach((word) => {
        const row = document.createElement("li");
        row.textContent = word.lemma;
        if (!targets.includes(word)) row.className = "bought";
        else if (word === targets[0]) row.className = "now";
        list.append(row);
      });
      promptEl.append(list);
    }
  } else {
    promptEl.innerHTML = `<span>${TEXT.done}</span>
      <span class="stars" aria-label="${stars}/${roundSize}">${starRow}</span>`;
  }
}

// One line at a time: new lines wait for the one being spoken, and replace any still waiting.
let voiceQueue = [];
let voiceDone = null;
let voiceBusy = false;

// Lines are decoded ahead and played through the same sound channel as the footsteps. Two separate audio
// streams opening and closing is a common cause of dropouts. Opened as a file the browser can't load them this way,
// so then they play through the page's audio element instead.
const lineBuffers = new Map();
let lineNumber = 0;
let currentLine = null;

function lineBuffer(src) {
  if (!lineBuffers.has(src)) {
    lineBuffers.set(src, fetch(src)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data ? sound.decodeAudioData(data) : null))
      .catch(() => null));
  }
  return lineBuffers.get(src);
}

// Decodes a place's lines one at a time, before they're needed, so the first of each doesn't stutter.
async function prepareLines(lines) {
  if (!sound) return;
  for (const line of lines) await lineBuffer(line);
}

function answerLines() {
  const id = VOICES[look.gender];
  return [...TEXT.right.map((_, i) => `audio/praise-${i}-${id}.wav`), ...TEXT.wrong.map((_, i) => `audio/wrong-${i}-${id}.wav`)];
}

// The line that says what a thing is, as fetched by tools/fetch_voices.py.
function wordLine(word, id = VOICES[look.gender]) {
  if (word.number !== undefined) return `audio/number-${word.number}-${id}.wav`;
  if (word.spoken) return `audio/${word.spoken}-${word.sprite}-${word.colour}-${id}.wav`;
  return `audio/word-${word.sprite}-${id}.wav`;
}

async function playNextLine() {
  const src = voiceQueue.shift();
  if (!src) {
    voiceBusy = false;
    const done = voiceDone;
    voiceDone = null;
    done?.();
    return;
  }
  voiceBusy = true;
  const mine = ++lineNumber;
  const next = () => {
    if (mine !== lineNumber) return;
    lineNumber++;
    currentLine = null;
    voice.onended = voice.onerror = null;
    playNextLine();
  };
  setTimeout(next, LINE_MAX_MS);
  wakeSound();
  const ready = sound && await Promise.race([
    sound.resume().then(() => true, () => false),
    new Promise((resolve) => setTimeout(() => resolve(false), 250)),
  ]);
  const buffer = ready && sound.state === "running" ? await lineBuffer(src) : null;
  if (mine !== lineNumber) return;
  if (buffer) {
    const source = sound.createBufferSource();
    source.buffer = buffer;
    const gain = sound.createGain();
    source.connect(gain).connect(sound.destination);
    source.onended = next;
    // After the fade of whatever was speaking, so the two don't talk over each other.
    source.start(Math.max(sound.currentTime + SOUND_AHEAD, lineFadeEnds));
    currentLine = { source, gain };
    return;
  }
  voice.onended = voice.onerror = next;
  voice.src = src;
  voice.play().catch(next);
}

// Finishes when the lines have played, can't play or were replaced, and never fails.
function playVoice(...lines) {
  return new Promise((resolve) => {
    if (!voice) {
      resolve();
      return;
    }
    voiceDone?.();
    voiceQueue = lines;
    voiceDone = resolve;
    // The newest thing touched is what matters: what was being said fades away and this takes over.
    if (voiceBusy) silenceLine();
    playNextLine();
  });
}

// Ends the line now speaking with a short fade rather than a click, and cancels one still waiting to start.
let lineFadeEnds = 0;
function silenceLine() {
  lineNumber++;
  if (currentLine) {
    const { source, gain } = currentLine;
    const now = sound.currentTime;
    lineFadeEnds = now + LINE_FADE;
    source.onended = null;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, lineFadeEnds);
    source.stop(lineFadeEnds);
    currentLine = null;
  }
  voice.pause();
  voice.onended = voice.onerror = null;
}

function stopVoice() {
  if (!voice) return;
  silenceLine();
  voiceQueue = [];
  voiceBusy = false;
  voiceDone?.();
  voiceDone = null;
}

// Never the same line twice in a row.
const lastLine = new Map();
function pickLine(lines) {
  let index;
  do {
    index = Math.floor(Math.random() * lines.length);
  } while (index === lastLine.get(lines) && lines.length > 1);
  lastLine.set(lines, index);
  return index;
}

// The word to find appears big over the world, then moves to its place in the header.
let announcement = 0;
function announce() {
  announcement++;
  document.getElementById("announce")?.remove();
  const target = promptEl.querySelector(".target");
  if (!target) return;
  target.classList.add("waiting");
  const mine = announcement;
  const land = () => {
    if (mine !== announcement || !el.isConnected) return;
    el.remove();
    target.classList.remove("waiting");
    target.animate?.([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 350 });
  };
  const el = document.createElement("div");
  el.id = "announce";
  el.lang = "se";
  el.innerHTML = `<div class="label"></div><div></div>`;
  el.firstChild.textContent = targets[0]?.aimOf ? `${TEXT.find} ${targets[0].aimOf}` : TEXT.find;
  el.lastChild.textContent = target.textContent;
  el.style.fontSize = getComputedStyle(target).fontSize; // starts the same size as the word it lands on
  document.body.append(el);
  if (!el.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    land();
    return;
  }
  const home = target.getBoundingClientRect();
  const world = canvas.getBoundingClientRect();
  el.style.left = `${home.left}px`;
  el.style.top = `${home.top}px`;
  const big = Math.min(2.4, (world.width * 0.86) / el.offsetWidth); // never wider than the game view
  const dx = world.left + world.width / 2 - home.left - (el.offsetWidth * big) / 2;
  const dy = world.top + world.height / 2 - home.top - (el.offsetHeight * big) / 2;
  const at = (scale) => `translate(${dx}px, ${dy}px) scale(${scale})`;
  const backing = "rgba(32, 48, 58, 0.9)";
  const held = { backgroundColor: backing, boxShadow: `0 0 0 8px ${backing}` };
  const motion = el.animate([
    { offset: 0, transform: at(big * 0.5), opacity: 0, ...held },
    { offset: 0.1, transform: at(big * 1.08), opacity: 1, ...held },
    { offset: 0.16, transform: at(big), opacity: 1, ...held },
    { offset: 0.68, transform: at(big), opacity: 1, ...held },
    { offset: 1, transform: "translate(0, 0) scale(1)", opacity: 1, backgroundColor: "rgba(32, 48, 58, 0)", boxShadow: "0 0 0 0 rgba(32, 48, 58, 0)" },
  ], { duration: ANNOUNCE_MS, easing: "ease-in-out" });
  el.firstChild.animate(
    [{ offset: 0, opacity: 1 }, { offset: 0.62, opacity: 1 }, { offset: 0.72, opacity: 0 }, { offset: 1, opacity: 0 }],
    { duration: ANNOUNCE_MS, fill: "forwards" },
  );
  motion.onfinish = land;
  setTimeout(land, ANNOUNCE_MS + 200); // finish events can wait while the tab is in the background
}

// After a find, the next word waits for the character to finish speaking.
async function announceAfter(speech) {
  const mine = ++announcement;
  await Promise.all([speech, new Promise((resolve) => setTimeout(resolve, ANNOUNCE_PAUSE_MS))]);
  if (mine === announcement && targets.length && !paused) announce();
}

function showBubble(say, note) {
  paused = true;
  cardEl.className = "greeting";
  cardEl.innerHTML = "";
  const figure = document.createElement("figure");
  const canvasEl = document.createElement("canvas");
  canvasEl.width = FRAME_W;
  canvasEl.height = FRAME_H;
  const nameEl = document.createElement("figcaption");
  nameEl.lang = "se";
  nameEl.textContent = NAMES[look.gender];
  figure.append(canvasEl, nameEl);
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<div class="say" lang="se"></div><div class="note"></div>`;
  bubble.querySelector(".say").textContent = say;
  bubble.querySelector(".note").textContent = note;
  cardEl.append(figure, bubble);
  preview = canvasEl.getContext("2d");
  return bubble;
}

function askName() {
  document.body.classList.add("menu");
  const speaker = NAMES[look.gender];
  const id = VOICES[look.gender];
  const bubble = showBubble(TEXT.question(speaker), TEXT.questionFi(speaker));
  const form = document.createElement("form");
  form.autocomplete = "off";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = NAME_MAX;
  input.value = loadName() || "";
  input.setAttribute("aria-label", TEXT.yourName);
  input.placeholder = TEXT.yourName;
  const send = document.createElement("button");
  send.textContent = TEXT.ready;
  form.append(input, send);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = cleanName(input.value);
    saveName(name);
    sayHello(name);
  });
  bubble.append(form);
  input.focus();
  playVoice(`audio/question-${id}.wav`);
}

// The bubble has the name; the spoken line is a plain "Bures!", so nothing leaves the player's device.
async function sayHello(name) {
  document.body.classList.add("menu");
  const mine = ++greeting;
  greeted = true;
  showBubble(TEXT.bures(name), TEXT.buresFi(name));
  await Promise.all([
    new Promise((resolve) => setTimeout(resolve, BUBBLE_MIN_MS)),
    playVoice(`audio/bures-${VOICES[look.gender]}.wav`),
  ]);
  if (mine === greeting) showPlaces();
}

// The menu of places: at the start, after a round, or whenever the player asks.
function showPlaces() {
  closeResults();
  roundEnding++;
  timerEl.hidden = true;
  paused = true;
  theme = null;
  targets = [];
  objects = [];
  preview = null;
  announcement++;
  document.getElementById("announce")?.remove();
  timer.running = false;
  showPrompt();
  document.body.classList.add("menu");
  menuPlaces();
  buildPlacesAhead();
}

// The menu fills the page, so nothing needs scrolling to, and asks one thing at a time: where, and then how hard.
// Pictures carry it for a child who doesn't read yet.
function menuButton({ look: picture, title, small, example, onClick, className }) {
  const button = document.createElement("button");
  if (className) button.className = className;
  if (picture) {
    const image = pictureOf(picture);
    const canvasEl = document.createElement("canvas");
    canvasEl.width = image.width;
    canvasEl.height = image.height;
    canvasEl.getContext("2d").drawImage(image, 0, 0);
    button.append(canvasEl);
  }
  const titleEl = document.createElement("span");
  titleEl.className = "title";
  titleEl.textContent = title;
  button.append(titleEl);
  if (example) {
    const exampleEl = document.createElement("span");
    exampleEl.className = "example";
    exampleEl.lang = "se";
    exampleEl.textContent = example;
    button.append(exampleEl);
  }
  if (small) {
    const smallEl = document.createElement("small");
    smallEl.textContent = small;
    button.append(smallEl);
  }
  button.addEventListener("click", onClick);
  return button;
}

const themeLook = (option) => ({ sprite: option.sprite, colour: option.colour, number: option.number });
const bestOf = (option) => loadTimes(option.id)[0];
const bestText = (option) => (bestOf(option) ? `${TEXT.best} ${formatTime(bestOf(option).ms)}` : "");

function lastTheme() {
  try {
    return THEMES.find((option) => option.id === localStorage.getItem("mahtte.last"));
  } catch {
    return undefined;
  }
}

function menuPlaces() {
  showPrompt();
  cardEl.className = "places";
  cardEl.innerHTML = "";
  // Who is playing, walking on the spot, and the way to change that.
  const who = document.createElement("div");
  who.className = "who";
  const avatar = document.createElement("canvas");
  avatar.width = FRAME_W;
  avatar.height = FRAME_H;
  preview = avatar.getContext("2d");
  const name = document.createElement("span");
  name.textContent = loadName() || NAMES[look.gender];
  const player = document.createElement("button");
  player.id = "change-player";
  player.textContent = TEXT.changePlayer;
  player.addEventListener("click", changePlayer);
  who.append(avatar, name, player);
  const notice = document.createElement("p");
  notice.className = "demo-notice";
  notice.textContent = TEXT.demoNotice;
  cardEl.append(notice, who);
  const last = lastTheme();
  if (last) {
    cardEl.append(menuButton({
      look: themeLook(last),
      title: `${TEXT.playAgain}: ${last.title}${last.level ? ` (${last.level})` : ""}`,
      small: bestText(last),
      className: "continue",
      onClick: () => enterTheme(last),
    }));
  }
  const grid = document.createElement("div");
  grid.className = "menu-grid";
  const titles = [...new Set(THEMES.map((option) => option.title))];
  for (const title of titles) {
    const levels = THEMES.filter((option) => option.title === title);
    const played = levels.filter(bestOf).length;
    grid.append(menuButton({
      look: themeLook(levels[0]),
      title,
      small: levels.length > 1 ? `${"●".repeat(played)}${"○".repeat(levels.length - played)} ${TEXT.levels(levels.length)}` : bestText(levels[0]),
      onClick: () => (levels.length > 1 ? menuLevels(title, levels) : enterTheme(levels[0])),
    }));
  }
  cardEl.append(grid);
  cardEl.querySelector("button.continue, .menu-grid button").focus();
}

function menuLevels(title, levels) {
  promptEl.innerHTML = `<span>${escapeText(title)}: ${TEXT.chooseLevel}</span>`;
  preview = null;
  cardEl.className = "places";
  cardEl.innerHTML = "";
  const back = document.createElement("button");
  back.id = "menu-back";
  back.textContent = TEXT.back;
  back.addEventListener("click", menuPlaces);
  const grid = document.createElement("div");
  grid.className = "menu-grid levels";
  levels.forEach((option, index) => {
    grid.append(menuButton({
      look: themeLook(option),
      title: `${TEXT.level} ${index + 1}: ${option.level}`,
      example: option.example,
      small: bestText(option),
      onClick: () => enterTheme(option),
    }));
  });
  cardEl.append(back, grid);
  grid.querySelector("button").focus();
}

// The arrow keys move between the buttons, so a player already at the keyboard needn't reach for the mouse.
function moveMenuFocus(dx, dy) {
  const from = document.activeElement.getBoundingClientRect();
  const fromX = from.left + from.width / 2, fromY = from.top + from.height / 2;
  let best = null, bestScore = Infinity;
  for (const button of cardEl.querySelectorAll("button")) {
    if (button === document.activeElement) continue;
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2 - fromX, y = box.top + box.height / 2 - fromY;
    const along = x * dx + y * dy, aside = Math.abs(x * dy) + Math.abs(y * dx);
    if (along <= 0) continue;
    const score = along + aside * 3;
    if (score < bestScore) {
      bestScore = score;
      best = button;
    }
  }
  best?.focus();
}

// Drawing a whole place takes a moment, which is a hitch if it happens as a round starts. Do it while the menu is up.
let buildingAhead = false;
async function buildPlacesAhead() {
  if (buildingAhead) return;
  buildingAhead = true;
  for (const name of Object.keys(window.MAHTTE_MAPS)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (theme || cardEl.className !== "places") break; // someone chose; finish it another time
    if (builtWorlds.has(name)) continue;
    const showing = placeName;
    loadPlace(name);
    buildWorld();
    loadPlace(showing);
  }
  buildingAhead = false;
}

// A new player: the character chooser, then the name question with nothing filled in.
function changePlayer() {
  try {
    localStorage.removeItem("mahtte.name");
  } catch {
    // Private windows may refuse; the old name is then only offered as a suggestion.
  }
  showChooser();
}

function greet() {
  const name = loadName();
  if (name === null) askName();
  else sayHello(name);
}

function showChooser() {
  document.body.classList.add("menu");
  promptEl.innerHTML = `<span>${TEXT.makeCharacter}</span>`;
  closeResults();
  roundEnding++;
  paused = true;
  greeting++;
  stopVoice();
  cardEl.className = "chooser";
  cardEl.innerHTML = "";
  const figure = document.createElement("figure");
  const canvasEl = document.createElement("canvas");
  canvasEl.width = FRAME_W;
  canvasEl.height = FRAME_H;
  const nameEl = document.createElement("figcaption");
  nameEl.lang = "se";
  figure.append(canvasEl, nameEl);
  const rows = document.createElement("div");
  rows.className = "choices";
  const refresh = () => {
    nameEl.textContent = NAMES[look.gender];
    rows.querySelectorAll("button[data-key]").forEach((b) => {
      b.setAttribute("aria-pressed", String(look[b.dataset.key] === b.dataset.value));
    });
    saveLook();
  };
  for (const choice of CHOICES) {
    const { key, label } = choice;
    const row = document.createElement("div");
    row.className = "choice";
    row.innerHTML = `<span class="note">${label}</span>`;
    const options = document.createElement("div");
    options.className = "options";
    row.append(options);
    for (const [value, text] of optionsFor(choice, look)) {
      const button = document.createElement("button");
      button.textContent = text;
      if (key === "hair") {
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = HAIR_SWATCHES[value];
        button.prepend(swatch);
      }
      button.dataset.key = key;
      button.dataset.value = value;
      button.addEventListener("click", () => {
        look[key] = value;
        if (key === "gender") {
          // The list of styles changes with the gender, so the rows are drawn again.
          if (!STYLES[value].some(([id]) => id === look.length)) look.length = DEFAULT_STYLE[value];
          showChooser();
          cardEl.querySelector(`button[data-key=gender][data-value=${value}]`).focus();
          return;
        }
        refresh();
      });
      options.append(button);
    }
    rows.append(row);
  }
  const ready = document.createElement("button");
  ready.id = "ready";
  ready.textContent = TEXT.ready;
  ready.addEventListener("click", () => {
    chosen = true;
    saveLook();
    greeted = true;
    askName();
  });
  rows.append(ready);
  cardEl.append(figure, rows);
  preview = canvasEl.getContext("2d");
  refresh();
  cardEl.querySelector("button[aria-pressed=true]")?.focus();
}

function showStartCard() {
  paused = false;
  preview = null;
  cardEl.className = "";
  cardEl.innerHTML = `<div class="note">${theme?.desks ? TEXT.startClassroom : TEXT.start}</div>`;
  announce();
}

let rightSpeech = null;

function showCard(word, right) {
  preview = null;
  cardEl.className = right ? "right" : "";
  const plural = word.forms?.["Pl+Nom"]?.[0];
  cardEl.innerHTML = `<div>
      <div class="note">${right ? TEXT.found : FAMILY.has(word.sprite) ? TEXT.thisIsPerson : TEXT.thisIs}</div>
      <div><span class="word" lang="se">${escapeText(word.lemma)}</span>
        <span class="translation">= ${escapeText(translation(word))}</span></div>
      ${plural ? `<div class="note">${TEXT.plural} <span lang="se">${escapeText(plural)}</span></div>` : ""}
    </div>`;
  const picture = document.createElement("canvas");
  const image = pictureOf(word);
  picture.width = image.width;
  picture.height = image.height;
  picture.getContext("2d").drawImage(image, 0, 0);
  cardEl.prepend(picture);
  cardEl.classList.add("answered");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<div class="say" lang="se"></div><div class="note"></div>`;
  const line = pickLine(right ? TEXT.right : TEXT.wrong);
  const [say, sayFi] = (right ? TEXT.right : TEXT.wrong)[line];
  const person = FAMILY.has(word.sprite);
  bubble.querySelector(".say").textContent = `${say} ${word.thisWord || (person ? TEXT.thisPerson : TEXT.thisWord)(word.lemma)}`;
  bubble.querySelector(".note").textContent = `${sayFi} ${word.thisWordFi || (person ? TEXT.thisPersonFi : TEXT.thisWordFi)(translation(word))}`;
  cardEl.append(bubble);
  const id = VOICES[look.gender];
  const lines = [`audio/${right ? "praise" : "wrong"}-${line}-${id}.wav`, wordLine(word, id)];
  // A find is always said in full: what is bumped into meanwhile stays quiet, and another find waits its turn.
  if (right) {
    if (rightSpeech) {
      voiceQueue.push(...lines);
      return rightSpeech;
    }
    rightSpeech = playVoice(...lines).then(() => {
      rightSpeech = null;
    });
    return rightSpeech;
  }
  return rightSpeech ? Promise.resolve() : playVoice(...lines);
}

function touch(object, now) {
  const right = targets[0] === object.word;
  const speech = showCard(object.word, right);
  if (!right) return;
  stars++;
  targets.shift();
  // Furniture and family stay where they are, but aren't asked about or spoken for again.
  if (object.word.place === "home") object.done = true;
  else objects = objects.filter((o) => o !== object);
  sparkles.push({ x: object.x, y: object.y, born: now });
  if (!me.sittingOn) startAction("cheer", now);
  showPrompt();
  if (targets.length) announceAfter(speech);
  else finishRound(loadName() || "", speech);
}

function startAction(name, now) {
  action = { name, start: now };
  me.facing = "S";
  me.route = [];
}

// ------------------------------------------------------------------ cloth and hair
// The hem and hair hang from the body on a soft spring. They trail behind a walk,
// and when the body stops or turns they carry on a little and swing back.
const CLOTH = {
  stiffness: 0.00022, // a swing takes about 420 ms
  damping: 0.0062,
  kick: 0.016, // how hard a change of speed throws the cloth
  trail: 1.4, // pixels behind the body while walking
  swingMs: 760, // twice the walk cycle, so the cloth swings more slowly than the legs
  swingAcross: 1.2, // side to side, when walking toward or away from the viewer
  swingAlong: 0.5, // in and out of the trail, when walking sideways
  liftAt: 0.45,
};
const cloth = { x: 0, y: 0, vx: 0, vy: 0, moveX: 0, moveY: 0 };

// moveX and moveY are the direction of walking on the screen, or zero.
function updateCloth(state, moveX, moveY, dt) {
  state.vx -= CLOTH.kick * (moveX - state.moveX);
  state.vy -= CLOTH.kick * (moveY - state.moveY);
  Object.assign(state, { moveX, moveY });
  // Short steps, so a slow frame can't make the spring blow up.
  for (let left = Math.min(dt, 100); left > 0; left -= 8) {
    const ms = Math.min(left, 8);
    state.vx += (CLOTH.stiffness * (-CLOTH.trail * moveX - state.x) - CLOTH.damping * state.vx) * ms;
    state.vy += (CLOTH.stiffness * (-CLOTH.trail * moveY - state.y) - CLOTH.damping * state.vy) * ms;
    state.x += state.vx * ms;
    state.y += state.vy * ms;
  }
}

// The sway the sprite shows, in its own direction: a left-facing sprite is mirrored.
function clothSway(state, dir, walking, clock, most = 2) {
  const swing = Math.sin((clock / CLOTH.swingMs) * Math.PI * 2);
  const across = dir === "up" || dir === "down";
  const sway = state.x + (walking ? swing * (across ? CLOTH.swingAcross : CLOTH.swingAlong) : 0);
  const pixels = Math.max(-most, Math.min(most, Math.round(sway)));
  return dir === "left" ? -pixels : pixels;
}

function poseRow(walking, dir, sway) {
  const pose = (walking ? 3 : 0) + FACING[dir];
  return sway === 0 ? pose : SWAY_ROWS + pose * SWAYS.length + SWAYS.indexOf(sway);
}

let crouchClock = 0;
// Rounded, as an animal can be between tiles.
// At home things have their sizes, and the smallest wins, so someone on the sofa is found before the sofa.
const objectAt = (x, y) => objects.find((o) => Math.round(o.x) === x && (Math.round(o.y) === y || (o.word.place === "bay" && o.y + 1 === y)));
function thingAtPoint(x, y) {
  const homeThings = objects.filter((o) => o.word.place === "home" && pointToBox(x, y, vehicleBox(o)) < 0.2);
  const area = (o) => HOME_THINGS[o.word.sprite][0] * HOME_THINGS[o.word.sprite][1];
  return homeThings.sort((p, q) => area(p) - area(q))[0] || objectAt(Math.floor(x), Math.floor(y));
}

// ------------------------------------------------------------- free movement
// The character is at a point on the map, not on a tile. 1 is one tile; a tile's centre is at .5.
const MOVE = { speed: 0.0042, radius: 0.2, trunk: 0.13, thing: 0.3, house: 0.5, reach: 0.12, nudgeMs: 90, stuckMs: 500 };
const me = { x: START.x + 0.5, y: START.y + 0.5, facing: "S", moving: false, moveX: 0, moveY: 0, nudge: null, nudgeLeft: 0, route: [], goal: null, closest: Infinity, stuck: 0, height: 0, jumpedAt: null, knockedAt: null, hitTree: null, running: false, slideAt: null, restAt: null, slideLeft: false, sittingOn: null, sitAt: null, sitWhenThere: null };
const touching = new Set();
const puffs = [];

let treesNear = new Map();

// Screen direction to the sprite to show: eight directions, four of them from the diagonal sheet.
function facingOf(screenX, screenY) {
  const names = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const octant = Math.round(Math.atan2(screenY, screenX) / (Math.PI / 4));
  return names[(octant + 8) % 8];
}

const isLarge = (o) => o.word.sprite === "viessu" || o.word.big;
const solidSize = (o) => (isLarge(o) ? MOVE.house : MOVE.thing);
const canPassOver = (o) => me.height >= JUMP.clears && !isLarge(o);
// A thing in water or in a fixture stands on a tile that is solid already, and is touched from beside it.
const standsFree = (o) => o.word.place === "land";
const thingReach = (o) => (boxed(o) ? MOVE.radius + 0.12 : standsFree(o) ? solidSize(o) + MOVE.radius + 0.1 : 0.95);

// Width and length of a parked vehicle in tiles, in the two-tile bay that starts at its tile.
const VEHICLES = {
  car: [0.78, 1.46], truck: [0.86, 1.92], bus: [0.86, 1.94], tractor: [0.92, 1.72], moto: [0.3, 1.12], bike: [0.24, 1.0],
  taxi: [0.78, 1.46], ambulance: [0.82, 1.66], firetruck: [0.86, 1.92], van: [0.78, 1.6], snowmobile: [0.46, 1.2], trailer: [0.72, 1.46],
};
// Things at home, in tiles across and along as built, with the rug flat on the floor to be walked over.
const HOME_THINGS = {
  sofa: [2.75, 1.02], tv: [1.4, 0.55], table: [2.2, 1.45], chair: [0.7, 0.7], stove: [1.05, 1], cupboard: [1.55, 0.8], fridge: [1, 0.95],
  freezer: [1.5, 1], toilet: [0.72, 1.05], bathtub: [1.35, 2.55], shower: [1.15, 1.15], sink: [0.9, 0.75], washer: [1.05, 0.95], mirror: [0.7, 0.3],
  bookcase: [1.8, 0.65], lamp: [0.55, 0.55], rug: [2.9, 2.15], flower: [0.5, 0.5], bed: [1.7, 2.8], wardrobe: [1.75, 0.9],
  eadni: [0.5, 0.9], viellja: [0.5, 0.9], // sitting, with their feet out in front of the sofa
  oabbá: [0.5, 0.5], áhčči: [0.5, 0.5],
};
const FLAT_THINGS = new Set(["rug"]);
const FAMILY = new Set(["eadni", "áhčči", "oabbá", "viellja"]); // the same as in tools/fetch_voices.py
// The two on the sofa share its whole front between the armrests, split at its middle: from their own middle,
// how far their box reaches left, right, back and forward. The sofa itself answers from its back, sides and armrests.
const SITTING_BOXES = { eadni: [-0.1, 0.6, -0.15, 0.45], viellja: [-0.6, 0.1, -0.15, 0.45] };
const boxed = (o) => o.word.place === "bay" || o.word.place === "home";

function vehicleBox(o) {
  if (SITTING_BOXES[o.word.sprite]) {
    const [left, right, back, forward] = SITTING_BOXES[o.word.sprite];
    return { x0: o.x + 0.5 + left, x1: o.x + 0.5 + right, y0: o.y + 0.5 + back, y1: o.y + 0.5 + forward };
  }
  if (o.word.place === "home") {
    const [across, along] = HOME_THINGS[o.word.sprite];
    const [wide, long] = o.facing % 2 ? [along, across] : [across, along];
    return { x0: o.x + 0.5 - wide / 2, x1: o.x + 0.5 + wide / 2, y0: o.y + 0.5 - long / 2, y1: o.y + 0.5 + long / 2 };
  }
  const [wide, long] = VEHICLES[o.word.sprite];
  const cx = o.x + 0.5, cy = o.y + 1;
  return { x0: cx - wide / 2, x1: cx + wide / 2, y0: cy - long / 2, y1: cy + long / 2 };
}

const pointToBox = (x, y, box) => Math.hypot(x - Math.max(box.x0, Math.min(box.x1, x)), y - Math.max(box.y0, Math.min(box.y1, y)));
// How far a point is from a thing: from the edge of a parked vehicle, otherwise from the thing's centre.
const awayFrom = (o, x, y) => (boxed(o) ? pointToBox(x, y, vehicleBox(o)) : Math.hypot(x - o.x - 0.5, y - o.y - 0.5));

function pushOutOfBox(box) {
  const nx = Math.max(box.x0, Math.min(box.x1, me.x)), ny = Math.max(box.y0, Math.min(box.y1, me.y));
  const dx = me.x - nx, dy = me.y - ny;
  const d = Math.hypot(dx, dy);
  if (d >= MOVE.radius) return;
  me.hitTree = { mx: nx, my: ny };
  if (d === 0) {
    const sides = [[me.x - box.x0, -1, 0], [box.x1 - me.x, 1, 0], [me.y - box.y0, 0, -1], [box.y1 - me.y, 0, 1]];
    const [gap, ox, oy] = sides.sort((a, b) => a[0] - b[0])[0];
    me.x += ox * (gap + MOVE.radius);
    me.y += oy * (gap + MOVE.radius);
    return;
  }
  me.x = nx + (dx / d) * MOVE.radius;
  me.y = ny + (dy / d) * MOVE.radius;
}

const SIT_CHAIR_SIZE = 0.15;

function pushOutOfCircle(cx, cy, r) {
  const dx = me.x - cx, dy = me.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r || d === 0) return;
  me.hitX = cx;
  me.hitY = cy;
  me.x = cx + (dx / d) * r;
  me.y = cy + (dy / d) * r;
}

function pushOutOfTile(tx, ty) {
  const nx = Math.max(tx, Math.min(tx + 1, me.x)), ny = Math.max(ty, Math.min(ty + 1, me.y));
  const dx = me.x - nx, dy = me.y - ny;
  const d = Math.hypot(dx, dy);
  if (d >= MOVE.radius) return;
  // Anything built knocks a jumper down as trunks do, measured from its nearest point. Water only stops them.
  if (tileOr(tx, ty, "g") !== "w") me.hitTree = { mx: nx, my: ny };
  if (d === 0) {
    // Inside the tile: leave by the nearest side.
    const sides = [[me.x - tx, -1, 0], [tx + 1 - me.x, 1, 0], [me.y - ty, 0, -1], [ty + 1 - me.y, 0, 1]];
    const [gap, ox, oy] = sides.sort((a, b) => a[0] - b[0])[0];
    me.x += ox * (gap + MOVE.radius);
    me.y += oy * (gap + MOVE.radius);
    return;
  }
  me.x = nx + (dx / d) * MOVE.radius;
  me.y = ny + (dy / d) * MOVE.radius;
}

// Only trunks, things and water block, and being pushed out sideways is what makes the character slide.
function collide() {
  for (let pass = 0; pass < 2; pass++) {
    const tx = Math.floor(me.x), ty = Math.floor(me.y);
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const x = tx + a, y = ty + b;
      if (SOLID_TILES.has(tileOr(x, y, "g"))) pushOutOfTile(x, y);
      const tree = treesNear.get(`${x},${y}`);
      if (tree && Math.hypot(me.x - tree.mx, me.y - tree.my) < MOVE.trunk + MOVE.radius) {
        me.hitTree = tree;
        pushOutOfCircle(tree.mx, tree.my, MOVE.trunk + MOVE.radius);
      }
    }
    for (const chair of chairs) pushOutOfCircle(chair.x, chair.y, SIT_CHAIR_SIZE + MOVE.radius);
    for (const o of objects) {
      if (boxed(o) && !FLAT_THINGS.has(o.word.sprite)) pushOutOfBox(vehicleBox(o));
      if (!standsFree(o) || canPassOver(o)) continue;
      if (isLarge(o) && Math.hypot(me.x - o.x - 0.5, me.y - o.y - 0.5) < solidSize(o) + MOVE.radius) me.hitTree = { mx: o.x + 0.5, my: o.y + 0.5 };
      pushOutOfCircle(o.x + 0.5, o.y + 0.5, solidSize(o) + MOVE.radius);
    }
    me.x = Math.max(MOVE.radius, Math.min(WIDTH - MOVE.radius, me.x));
    me.y = Math.max(MOVE.radius, Math.min(HEIGHT - MOVE.radius, me.y));
  }
}

function touchThings(now) {
  const reached = [];
  for (const o of objects) {
    if (o.word.place === "desk" || o.done) continue; // these are read by sitting at the desk
    const reach = thingReach(o);
    const away = awayFrom(o, me.x, me.y);
    if (away < reach && !touching.has(o)) {
      reached.push(o);
    } else if (away > reach + 0.2) {
      touching.delete(o); // a little further than it takes to touch, so standing at the edge can't repeat it
    }
  }
  // On the way to something tapped at home, furniture passed on the way isn't what the player meant.
  if (me.goal?.word.place === "home" && me.route.length && !reached.includes(me.goal)) return;
  if (!reached.length) return;
  // One thing at a time: what was tapped, or else the smallest, so someone on the sofa counts and not the sofa.
  const size = (o) => (o.word.place === "home" ? HOME_THINGS[o.word.sprite][0] * HOME_THINGS[o.word.sprite][1] : 1);
  const chosen = reached.includes(me.goal) ? me.goal : reached.sort((p, q) => size(p) - size(q) || awayFrom(p, me.x, me.y) - awayFrom(q, me.x, me.y))[0];
  // While a find is being said, anything else waits, and counts as touched only once that has finished.
  if (rightSpeech && targets[0] !== chosen.word) return;
  reached.forEach((o) => touching.add(o));
  touch(chosen, now);
  if (chosen === me.goal) me.route = []; // brushing past something else doesn't end the walk
}

// Tapping: the planner uses the same rules as walking, on a grid finer than the tiles, so a
// trunk or thing reaching into the next tile can't trap a route.
function blockedAt(x, y, goal, room = MOVE.radius - 0.02) { // standing right against something still counts as free
  if (x < room || y < room || x > WIDTH - room || y > HEIGHT - room) return true;
  const tx = Math.floor(x), ty = Math.floor(y);
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cx = tx + a, cy = ty + b;
    if (SOLID_TILES.has(tileOr(cx, cy, "g"))) {
      const nx = Math.max(cx, Math.min(cx + 1, x)), ny = Math.max(cy, Math.min(cy + 1, y));
      if (Math.hypot(x - nx, y - ny) < room) return true;
    }
    const tree = treesNear.get(`${cx},${cy}`);
    if (tree && Math.hypot(x - tree.mx, y - tree.my) < MOVE.trunk + room) return true;
  }
  if (chairs.some((chair) => Math.hypot(x - chair.x, y - chair.y) < SIT_CHAIR_SIZE + room)) return true;
  if (objects.some((o) => o !== goal && boxed(o) && !FLAT_THINGS.has(o.word.sprite) && pointToBox(x, y, vehicleBox(o)) < room)) return true;
  return objects.some((o) => o !== goal && standsFree(o) && Math.hypot(x - o.x - 0.5, y - o.y - 0.5) < solidSize(o) + room);
}

function clearLine(ax, ay, bx, by, goal) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 10);
  for (let i = 1; i <= steps; i++) {
    if (blockedAt(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps, goal)) return false;
  }
  return true;
}

const GRID = 4; // grid cells to a tile
const gridKey = (cx, cy) => cy * WIDTH * GRID + cx;

// Spreads from the character over everywhere they can walk, nearest first, until visit says stop.
function spreadOverGrid(visit) {
  // Start from every cell in clear reach, as the character may be standing between grid cells.
  const from = new Map();
  const queue = [];
  const startX = Math.floor(me.x * GRID), startY = Math.floor(me.y * GRID);
  for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
    const cell = [startX + a, startY + b];
    if (clearLine(me.x, me.y, (cell[0] + 0.5) / GRID, (cell[1] + 0.5) / GRID)) {
      from.set(gridKey(...cell), null);
      queue.push(cell);
    }
  }
  queue.sort((p, q) => Math.hypot(p[0] - startX, p[1] - startY) - Math.hypot(q[0] - startX, q[1] - startY));
  for (let head = 0; head < queue.length; head++) {
    const [cx, cy] = queue[head];
    if (visit(cx, cy, (cx + 0.5) / GRID, (cy + 0.5) / GRID)) break;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + a, ny = cy + b;
      if (from.has(gridKey(nx, ny)) || blockedAt((nx + 0.5) / GRID, (ny + 0.5) / GRID)) continue;
      if (a && b && (blockedAt((cx + a + 0.5) / GRID, (cy + 0.5) / GRID) || blockedAt((cx + 0.5) / GRID, (cy + b + 0.5) / GRID))) continue;
      from.set(gridKey(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  return from;
}

// Whether the character can walk to within reach of every thing placed, and to every path and
// bridge tile that can be walked to with nothing placed. Only the path tiles are compared, as a
// trunk can stand so close to a tile that it could never be reached anyway.
let pathCells = [];
let openPathCells = null;

function pathCellsFromHere() {
  const reached = spreadOverGrid(() => false);
  return pathCells.filter(({ key }) => reached.has(key));
}

// The floor a thing stands on is taken, of course; what matters is the way around it.
const underAThing = ({ x, y }) => objects.some((o) => standsFree(o) && Math.hypot(x - o.x - 0.5, y - o.y - 0.5) < solidSize(o) + MOVE.radius + 0.1);

function everythingInReach() {
  if (!openPathCells) {
    const placed = objects;
    objects = [];
    openPathCells = pathCellsFromHere();
    objects = placed;
  }
  const waiting = new Set(objects);
  const reached = spreadOverGrid((cx, cy, x, y) => {
    for (const o of waiting) {
      // A number is read from the desk's chair, so that is what has to be reached.
      const atDesk = o.word.place === "desk";
      const away = atDesk ? Math.hypot(x - o.x - 0.5, y - o.y - 1.42) : awayFrom(o, x, y);
      if (away < (atDesk ? SIT.reach : thingReach(o))) waiting.delete(o);
    }
    return false;
  });
  return waiting.size === 0 && openPathCells.every((cell) => reached.has(cell.key) || underAThing(cell));
}

// Whether a thing of this size standing here shows in full, with nothing in front of it on the screen.
function openSpot([x, y], halfWide, tall) {
  const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
  return !treeMap.some((t) => {
    if (t.mx + t.my <= x + y + 1) return false;
    const left = t.x - t.image.width / 2, top = t.y + 2 - t.image.height;
    return cx + halfWide > left && cx - halfWide < left + t.image.width && cy + 8 > top && cy - tall < t.y; // things float lower in water
  });
}
let OPEN_SPOTS = { land: [], water: [], large: [] };

// Moves the character to a place and works out what its map allows.
function enterPlace(name) {
  loadPlace(name);
  treesNear = new Map(treeMap.filter((t) => !t.block).map((t) => [`${t.tx},${t.ty}`, t]));
  pathCells = [];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if ("pbafFLcj".includes(MAP[y][x])) pathCells.push({ key: gridKey(x * GRID + GRID / 2, y * GRID + GRID / 2), x: x + (GRID / 2 + 0.5) / GRID, y: y + (GRID / 2 + 0.5) / GRID });
  }
  openPathCells = null;
  OPEN_SPOTS = {
    land: SPOTS.land.filter((s) => openSpot(s, 10, 20)),
    water: SPOTS.water.filter((s) => openSpot(s, 10, 20)),
    large: SPOTS.land.filter((s) => openSpot(s, 18, 36)),
    // In a fixture, the rest of its own row is no obstacle; things are drawn in front of it.
    shelf: SPOTS.shelf || [],
    fridge: SPOTS.fridge || [],
    freezer: SPOTS.freezer || [],
    produce: SPOTS.produce || [],
    desk: SPOTS.desk || [],
    bay: SPOTS.bay || [],
    bookshelf: SPOTS.bookshelf || [],
    table: SPOTS.table || [],
    home: SPOTS.home || {},
  };
  Object.assign(me, { x: START.x + 0.5, y: START.y + 0.5, facing: "S", route: [], goal: null, jumpedAt: null, knockedAt: null, height: 0, moveX: 0, moveY: 0, moving: false, running: false, slideAt: null, restAt: null, sittingOn: null, sitWhenThere: null });
  puffs.length = 0;
  sparkles = [];
  setChairs();
  placeCamera();
}

function routeToPoint(goalX, goalY, closeEnough) {
  const size = GRID;
  const key = gridKey;
  me.closest = Infinity;
  me.stuck = 0;
  me.goal = thingAtPoint(goalX, goalY) || null;
  me.walkedOnTo = null;
  if (me.goal) [goalX, goalY] = [me.goal.x + 0.5, me.goal.y + (me.goal.word.place === "bay" ? 1 : 0.5)];
  // Tapping a tree or the river walks up to it. Tapping a thing walks until it is in reach.
  const open = !me.goal && !blockedAt(goalX, goalY);
  const near = closeEnough ?? (me.goal ? thingReach(me.goal) + (me.goal.word.place === "home" ? -0.02 : 0.15) : open ? 0.2 : 0.7);
  let found = null;
  let closest = null;
  let closestAway = Infinity;
  const from = spreadOverGrid((cx, cy, x, y) => {
    const away = me.goal && boxed(me.goal) ? pointToBox(x, y, vehicleBox(me.goal)) : Math.hypot(x - goalX, y - goalY);
    if (away < closestAway) {
      closestAway = away;
      closest = [cx, cy];
    }
    if (away < near) found = [cx, cy];
    return found;
  });
  // Somewhere that can't be reached, like the middle of the river: walk as close as possible.
  found = found || closest;
  if (!found) return [];
  const points = [];
  for (let at = found; at; at = from.get(key(...at))) points.unshift([(at[0] + 0.5) / size, (at[1] + 0.5) / size]);
  // Straighten: from each point, go to the furthest one with a clear line.
  const route = [];
  let ax = me.x, ay = me.y;
  for (let i = 0; i < points.length;) {
    let j = points.length - 1;
    while (j > i && !clearLine(ax, ay, points[j][0], points[j][1])) j--;
    route.push(points[j]);
    [ax, ay] = points[j];
    i = j + 1;
  }
  if (me.goal || open) route.push([goalX, goalY]);
  return route;
}

// A press shorter than one frame still moves a little.
const keyVector = () => {
  let ix = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
  let iy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
  if (tapped) {
    me.nudge = tapped;
    me.nudgeLeft = MOVE.nudgeMs;
    tapped = null;
  }
  if (!ix && !iy && me.nudgeLeft > 0) [ix, iy] = DIRS[me.nudge];
  return [ix, iy];
};

function knockDown(tree, now) {
  me.knockedAt = now;
  me.lastPat = null;
  me.jumpedAt = null;
  me.height = 0;
  me.route = [];
  const dx = me.x - tree.mx, dy = me.y - tree.my;
  const d = Math.hypot(dx, dy) || 1;
  me.knockX = dx / d;
  me.knockY = dy / d;
  if (dusty()) puffs.push({ x: me.x, y: me.y, born: now + KNOCK.sitAt, count: 8 });
  playImpact("tree");
  playImpact("sit", KNOCK.sitAt / 1000);
}

const knockEnds = () => KNOCK.wipeAt + WIPE_ORDER.length * KNOCK.wipeFrameMs;

// ---------------------------------------------------- footsteps
// The sound is made here rather than recorded: filtered noise and a low tone, a little different each step.
let sound = null;
let noiseBuffer = null;
const STEP_EVERY_MS = WALK_FRAME_MS * 4;

function wakeSound() {
  if (!sound) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    sound = new Context();
    noiseBuffer = makeNoise(sound); // ready now, not during the first step
  }
  if (sound.state !== "running") sound.resume().catch(() => {});
}

function makeNoise(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

function noiseBurst(context, output, noise, at, { type, frequency, q = 0.7, level, ms }) {
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + SOFT_START);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + SOFT_START + ms / 1000);
  source.connect(filter).connect(gain).connect(output);
  source.start(at, Math.random() * 0.8, ms / 1000 + SOFT_START + 0.02);
}

function lowTone(context, output, at, { from, to, level, ms }) {
  const tone = context.createOscillator();
  tone.frequency.setValueAtTime(from, at);
  tone.frequency.exponentialRampToValueAtTime(to, at + ms / 1000);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + SOFT_START);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + SOFT_START + ms / 1000);
  tone.connect(gain).connect(output);
  tone.start(at);
  tone.stop(at + SOFT_START + ms / 1000 + 0.02);
}

// Forest: a soft rustle. Path: a small crunch. Bridge: a low thump that echoes under the planks.
function footstepSound(context, noise, surface, at, strength = 1) {
  const vary = () => 0.85 + Math.random() * 0.3;
  const output = context.createGain();
  output.gain.value = strength * vary();
  output.connect(context.destination);
  if (surface === "bridge") {
    const echo = context.createDelay(0.5);
    echo.delayTime.value = 0.12;
    const fade = context.createGain();
    fade.gain.value = 0.3;
    output.connect(echo);
    echo.connect(fade).connect(context.destination);
    fade.connect(echo);
    lowTone(context, output, at, { from: 90 * vary(), to: 52, level: 0.07, ms: 190 });
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 320, level: 0.015, ms: 45 });
  } else if (surface === "asphalt") {
    // A firm, dull tap on hard ground.
    lowTone(context, output, at, { from: 150 * vary(), to: 90, level: 0.018, ms: 45 });
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 650 * vary(), q: 1.2, level: 0.014, ms: 40 });
  } else if (surface === "tiles") {
    // A small bright click, as shoes on a shop floor.
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 2300 * vary(), q: 3, level: 0.013, ms: 25 });
    lowTone(context, output, at, { from: 420 * vary(), to: 300, level: 0.006, ms: 30 });
  } else if (surface === "lino") {
    // A soft rubbery pat on the classroom floor.
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 1000 * vary(), q: 1.5, level: 0.012, ms: 40 });
    lowTone(context, output, at, { from: 130 * vary(), to: 85, level: 0.012, ms: 50 });
  } else if (surface === "wood") {
    // A soft hollow knock on floorboards, quiet as a library should be.
    lowTone(context, output, at, { from: 190 * vary(), to: 125, level: 0.016, ms: 70 });
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 550, level: 0.005, ms: 35 });
  } else if (surface === "path") {
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 1500 * vary(), level: 0.012, ms: 65 });
    noiseBurst(context, output, noise, at + 0.03, { type: "lowpass", frequency: 1100 * vary(), level: 0.008, ms: 55 });
    lowTone(context, output, at, { from: 110, to: 75, level: 0.008, ms: 60 });
  } else {
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 800 * vary(), level: 0.014, ms: 110 });
    lowTone(context, output, at, { from: 95, to: 65, level: 0.01, ms: 70 });
  }
}

// Louder than a step: landing from a jump, hitting a trunk, sitting down hard, brushing the cloth off.
function impactSound(context, noise, kind, at) {
  const output = context.createGain();
  output.gain.value = 0.85 + Math.random() * 0.3;
  output.connect(context.destination);
  if (kind === "chair") {
    // A chair taking someone's weight.
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 750, q: 1, level: 0.02, ms: 95 });
    lowTone(context, output, at, { from: 150, to: 105, level: 0.012, ms: 80 });
  } else if (kind === "scrape") {
    // Shoes and cloth skidding along the floor.
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 1300, q: 0.8, level: 0.05, ms: 440 });
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 500, level: 0.04, ms: 300 });
  } else if (kind === "land") {
    lowTone(context, output, at, { from: 105, to: 55, level: 0.11, ms: 120 });
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 500, level: 0.03, ms: 70 });
  } else if (kind === "tree") {
    // A knock on the trunk, then the branches shaking.
    lowTone(context, output, at, { from: 210, to: 85, level: 0.38, ms: 110 });
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 1100, q: 1.5, level: 0.3, ms: 50 });
    noiseBurst(context, output, noise, at + 0.03, { type: "highpass", frequency: 3000, level: 0.05, ms: 420 });
  } else if (kind === "sit") {
    lowTone(context, output, at, { from: 100, to: 42, level: 0.42, ms: 170 });
    noiseBurst(context, output, noise, at, { type: "lowpass", frequency: 700, level: 0.16, ms: 90 });
  } else {
    noiseBurst(context, output, noise, at, { type: "bandpass", frequency: 1800, level: 0.035, ms: 60 });
  }
}

function playImpact(kind, delay = 0) {
  wakeSound();
  if (!sound || sound.state !== "running") return;
  noiseBuffer = noiseBuffer || makeNoise(sound);
  impactSound(sound, noiseBuffer, kind, sound.currentTime + SOUND_AHEAD + delay);
}

const surfaceUnder = () => {
  const tile = tileOr(Math.floor(me.x), Math.floor(me.y), "g");
  if (tile === "b") return "bridge";
  if (tile === "f" || tile === "j") return "tiles";
  if (tile === "c") return "lino";
  if (tile === "L") return "lino";
  if (tile === "F") return "wood";
  if ("asq".includes(tile)) return "asphalt";
  return tile === "p" ? "path" : "ground";
};

function stepOn(now, dust = 5, strength = 1) {
  wakeSound(); // browsers may hold sound back past the first press, so keep asking
  const surface = surfaceUnder();
  if (DUST[surface]) puffs.push({ x: me.x, y: me.y, born: now, count: dust, life: 900, step: true, colour: DUST[surface] });
  if (!sound || sound.state !== "running") return;
  noiseBuffer = noiseBuffer || makeNoise(sound);
  footstepSound(sound, noiseBuffer, surface, sound.currentTime + SOUND_AHEAD, strength);
}

function updateJump(now) {
  if (me.jumpedAt === null) return;
  const t = (now - me.jumpedAt) / JUMP.ms;
  if (t >= 1) {
    me.jumpedAt = null;
    me.height = 0;
    cloth.vy += 0.012; // the hem drops and bounces back on landing
    stepOn(now, 6);
    playImpact("land");
    collide(); // come down beside a thing, not inside it
    return;
  }
  me.height = JUMP.height * 4 * t * (1 - t);
}

// ---------------------------------------------------- animals
// They potter between the open spots near where they started, so they are never behind a tree or in the way of a
// path, and hold still once the player is close or heading for them, so they can always be reached.
const WANDER = { walk: 0.00028, hop: 0.00055, fly: 0.0005, flight: 0.0016, flightHigh: 18, beatMs: 110, landMs: 300, lookEveryMs: 350, flutterMs: 70, wagMs: 90, peckEveryMs: 1500, peckMs: 560, peckRestMs: 3500, peckBeatMs: 140, step: 3.5, home: 6, near: 1.8, restMs: 1300, moreRestMs: 3600, hopMs: 340, stepMs: 170 };

const facingTowards = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2));
// A short flight rises and comes down over its whole length.
const flightHeight = (o, a) => Math.sin((1 - Math.hypot(a.aim[0] - o.x, a.aim[1] - o.y) / a.total) * Math.PI) * WANDER.flightHigh;
// Comes down where it is, so that a bird stopped in the air doesn't drop.
function endFlight(o, a, now) {
  if (ANIMAL_WAYS[o.word.sprite].flights) {
    a.landFrom = flightHeight(o, a);
    a.landAt = now;
  }
  a.aim = null;
}

function updateAnimals(dt, now) {
  for (const o of objects) {
    if (!ANIMALS.has(o.word.sprite)) continue;
    const a = o.animal ??= { homeX: o.x, homeY: o.y, facing: Math.floor(Math.random() * 4), restUntil: now + Math.random() * WANDER.moreRestMs, aim: null, clock: Math.random() * 1000, hopAt: null };
    const way = ANIMAL_WAYS[o.word.sprite];
    if ((way.looks || way.greets) && now - (a.lookedAt ?? -Infinity) > WANDER.lookEveryMs) {
      a.head = facingTowards(me.x - o.x - 0.5, me.y - o.y - 0.5);
      a.lookedAt = now;
    }
    const close = Math.hypot(me.x - o.x - 0.5, me.y - o.y - 0.5) < (way.near ?? WANDER.near);
    a.greeting = !!way.greets && close;
    if (a.greeting) a.facing = a.head; // turns to the player and stays to wag its tail
    if (o === me.goal || close) {
      if (a.aim) endFlight(o, a, now);
      a.restUntil = Math.max(a.restUntil, now + 500);
      continue;
    }
    if (!a.aim) {
      if (now < a.restUntil) continue;
      a.aim = nextAnimalSpot(o, a);
      if (a.aim) a.total = Math.hypot(a.aim[0] - o.x, a.aim[1] - o.y);
      a.restUntil = now + WANDER.restMs + Math.random() * WANDER.moreRestMs + (way.pecks ? WANDER.peckRestMs : 0); // birds stay to feed
      if (!a.aim) a.hopAt = now; // nowhere to go, so a jump on the spot
      continue;
    }
    const dx = a.aim[0] - o.x, dy = a.aim[1] - o.y;
    const left = Math.hypot(dx, dy);
    const step = (way.flights ? WANDER.flight : way.flies ? WANDER.fly : way.hops ? WANDER.hop : WANDER.walk) * dt;
    a.clock += dt;
    a.facing = facingTowards(dx, dy);
    const nextX = left <= step ? a.aim[0] : o.x + (dx / left) * step, nextY = left <= step ? a.aim[1] : o.y + (dy / left) * step;
    if (blockedAt(nextX + 0.5, nextY + 0.5, o, 0.2)) {
      endFlight(o, a, now);
    } else {
      o.x = nextX;
      o.y = nextY;
      if (left <= step) {
        a.aim = null;
        if (!way.flights && Math.random() < 0.5) a.hopAt = now; // and sometimes a jump on arriving
      }
    }
  }
}

function nextAnimalSpot(o, a) {
  const taken = (x, y) => objects.some((other) => other !== o && (Math.hypot(other.x - x, other.y - y) < 1.2 || (other.animal?.aim && Math.hypot(other.animal.aim[0] - x, other.animal.aim[1] - y) < 1.2)));
  return shuffled(OPEN_SPOTS.land).find(([x, y]) => {
    const away = Math.hypot(x - o.x, y - o.y);
    return away > 0.5 && away < WANDER.step
      && Math.hypot(x - a.homeX, y - a.homeY) < WANDER.home
      && Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y) > WANDER.near + 0.5
      && !taken(x, y)
      && clearLine(o.x + 0.5, o.y + 0.5, x + 0.5, y + 0.5, o);
  }) || null;
}

// A few quick pecks at the ground every so often.
function pecking(o, way, now) {
  if (!way.pecks) return false;
  const into = (now + o.phase) % WANDER.peckEveryMs;
  return into < WANDER.peckMs && Math.floor(into / WANDER.peckBeatMs) % 2 === 0;
}

// Each picture of an animal takes a moment to draw the first time, so this round's are made a few at a time now.
async function buildAnimalsAhead() {
  const round = objects;
  for (const sprite of new Set(objects.map((o) => o.word.sprite))) {
    if (!ANIMALS.has(sprite)) continue;
    for (let facing = 0; facing < 4; facing++) {
      for (let frame = 0; frame < 3; frame++) {
        if (round !== objects) return;
        modelImage(sprite, facing, frame);
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
}

// Which picture of an animal to draw now, and how high off the ground.
function animalPose(o, now) {
  const a = o.animal;
  const way = ANIMAL_WAYS[o.word.sprite];
  if (way?.acts) return { facing: o.facing ?? 0, frame: Math.floor((now + o.phase) / way.acts) % 2, lift: 0, head: way.head };
  if (!a) return { facing: o.facing ?? 0, frame: 0, lift: 0 };
  if (way.flights) {
    const beat = 3 + (Math.floor(now / WANDER.beatMs) % 2);
    if (a.aim) return { facing: a.facing, frame: beat, lift: Math.round(flightHeight(o, a)) };
    const head = way.looks ? a.head ?? a.facing : a.facing;
    const landing = a.landAt === undefined ? 1 : (now - a.landAt) / WANDER.landMs;
    if (landing < 1) return { facing: a.facing, frame: beat, lift: Math.round(a.landFrom * (1 - landing)), head };
    // With nowhere to go it stretches its wings for a moment.
    if (a.hopAt !== null && now - a.hopAt < WANDER.hopMs) return { facing: a.facing, frame: beat, lift: 0, head };
    return { facing: a.facing, frame: pecking(o, way, now) ? 5 : 0, lift: 0, head };
  }
  if (way.flies) {
    const flutter = [0, 1, 2, 1][Math.floor((now + o.phase) / WANDER.flutterMs) % 4];
    return { facing: a.facing, frame: flutter, lift: 8 + Math.round(Math.sin((now + o.phase) / 420) * 3 + Math.sin((now + o.phase) / 170)) };
  }
  if (a.aim && way.hops) {
    const lift = Math.round(Math.sin(((a.clock % WANDER.hopMs) / WANDER.hopMs) * Math.PI) * 4);
    return { facing: a.facing, frame: lift ? 1 : 0, lift };
  }
  if (a.aim) return { facing: a.facing, frame: 1 + (Math.floor(a.clock / WANDER.stepMs) % 2), lift: 0 };
  const hop = a.hopAt === null ? 1 : (now - a.hopAt) / WANDER.hopMs;
  if (hop < 1) return { facing: a.facing, frame: 1, lift: Math.round(Math.sin(hop * Math.PI) * 5) };
  if (a.greeting) return { facing: a.facing, frame: 5 + (Math.floor(now / WANDER.wagMs) % 2), lift: 0 };
  return { facing: a.facing, frame: pecking(o, way, now) ? 5 : 0, lift: 0 };
}

// ---------------------------------------------------- chairs
// Each desk has a fixed chair. C at a chair sits down, looks at the desk's number and gets up again.
const SIT = { reach: 0.75, walkUpTo: 0.5, downMs: 180, lookMs: 950, upMs: 180, swingMs: 130, forward: 2 };
let chairs = [];

function setChairs() {
  chairs = [];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (MAP[y][x] === "E") chairs.push({ x: x + 0.5, y: y + 1.42, deskX: x, deskY: y, angle: Math.PI });
  }
}

const chairNearMe = () => chairs
  .map((chair) => ({ chair, away: Math.hypot(chair.x - me.x, chair.y - me.y) }))
  .filter(({ away }) => away < SIT.reach)
  .sort((p, q) => p.away - q.away)[0]?.chair;

function sitOn(chair, now) {
  me.x = chair.x;
  me.y = chair.y;
  me.facing = "NE"; // towards the desk
  me.sittingOn = chair;
  me.sitAt = now;
  me.looked = false;
  me.route = [];
  me.sitWhenThere = null;
  if (!timer.running && timer.ms === 0 && targets.length) timer.running = true;
  playImpact("chair");
}

// The C key, or the Istu or Kyykky button: sits at a chair in the classroom, crouches anywhere else.
function sitOrCrouch(repeat) {
  if (paused) return;
  const chair = theme?.desks && chairNearMe();
  if (!chair) {
    crouching = true;
    return;
  }
  if (repeat || me.sittingOn || me.slideAt !== null || me.restAt !== null || me.knockedAt !== null) return;
  sitOn(chair, performance.now());
}

function moveSitting(now) {
  const since = now - me.sitAt;
  if (!me.looked && since >= SIT.downMs) {
    me.looked = true;
    const thing = objects.find((o) => o.x === me.sittingOn.deskX && o.y === me.sittingOn.deskY);
    if (thing) touch(thing, now);
    else showEmptyDesk();
  }
  if (since >= SIT.downMs + SIT.lookMs + SIT.upMs) {
    // Stands up behind the chair, clear of it, as the pushing-out only works from outside its centre.
    me.y = me.sittingOn.y + SIT_CHAIR_SIZE + MOVE.radius + 0.02;
    me.sittingOn = null;
    collide();
    if (!paused) playImpact("chair");
  }
}

function showEmptyDesk() {
  preview = null;
  cardEl.className = "answered";
  cardEl.innerHTML = `<div class="bubble"><div class="say"></div></div>`;
  cardEl.querySelector(".say").textContent = TEXT.emptyDesk;
}

// A straight line ahead, narrow enough that only a real hit counts: the runner's centre would meet something.
function runningIntoSomething(mx, my, furthest) {
  for (let along = 0.1; along <= Math.min(furthest, SLIDE.lookAhead); along += 0.1) {
    if (blockedAt(me.x + mx * along, me.y + my * along, undefined, SLIDE.pathWidth)) return true;
  }
  return false;
}

function startSlide(mx, my, now) {
  me.slideAt = now;
  me.slideX = mx;
  me.slideY = my;
  me.slideLeft = mx - my < 0;
  me.route = [];
  playImpact("scrape");
}

// On the tummy until it stops, a moment lying still, then up to brush off. No sitting first.
function endSlide(now) {
  me.slideAt = null;
  me.restAt = now;
  playImpact("land");
}

function moveSlide(dt, now) {
  const t = (now - me.slideAt) / SLIDE.ms;
  if (t >= 1) {
    endSlide(now);
    return;
  }
  const beforeX = me.x, beforeY = me.y;
  const step = MOVE.speed * RUN.speed * 0.6 * (1 - t * 0.5) * dt;
  me.x += me.slideX * step;
  me.y += me.slideY * step;
  collide();
  // Stopped against the desk.
  if (t > 0.2 && Math.hypot(me.x - beforeX, me.y - beforeY) < step * 0.2) endSlide(now);
}

function moveCharacter(dt, now) {
  if (me.sittingOn) {
    me.running = false;
    me.moving = false;
    me.moveX = me.moveY = 0;
    tapped = null;
    moveSitting(now);
    return;
  }
  if (me.slideAt !== null || me.restAt !== null) {
    me.running = false;
    me.moving = false;
    me.moveX = me.moveY = 0;
    tapped = null;
    if (me.slideAt !== null) {
      moveSlide(dt, now);
    } else if (now - me.restAt > SLIDE.restMs) {
      me.restAt = null;
      me.knockedAt = now - KNOCK.wipeAt;
      me.knockX = me.knockY = 0;
      me.lastPat = null;
    }
    return;
  }
  if (me.knockedAt !== null) {
    const since = now - me.knockedAt;
    if (since < KNOCK.pushMs) {
      me.x += me.knockX * KNOCK.pushSpeed * dt;
      me.y += me.knockY * KNOCK.pushSpeed * dt;
      collide();
    }
    me.moveX = me.moveY = 0;
    me.moving = false;
    tapped = null;
    if (since >= knockEnds()) me.knockedAt = null;
    return;
  }
  updateJump(now);
  me.nudgeLeft = Math.max(0, me.nudgeLeft - dt);
  const [ix, iy] = keyVector();
  let mx = 0, my = 0;
  if (ix || iy) {
    // Keys follow the screen: W goes straight up, W+A goes up and left along the paths.
    me.route = [];
    me.sitWhenThere = null;
    mx = ix + iy;
    my = iy - ix;
  } else if (me.route.length) {
    const [gx, gy] = me.route[0];
    mx = gx - me.x;
    my = gy - me.y;
    if (Math.hypot(mx, my) < MOVE.reach) {
      me.route.shift();
      me.closest = Infinity;
      mx = my = 0;
      // Planned while another animal stood in the way or around furniture: the last steps are walked straight.
      if (!me.route.length && me.goal && (ANIMALS.has(me.goal.word.sprite) || me.goal.word.place === "home") && !touching.has(me.goal) && me.walkedOnTo !== me.goal) {
        me.walkedOnTo = me.goal;
        me.route = [[me.goal.x + 0.5, me.goal.y + 0.5]];
      }
    }
  }
  // Tapped a desk: sit down on arriving at its chair.
  if (me.sitWhenThere && !paused) {
    if (Math.hypot(me.sitWhenThere.x - me.x, me.sitWhenThere.y - me.y) < SIT.reach) {
      sitOn(me.sitWhenThere, now);
      me.moving = false;
      return;
    }
    if (!me.route.length) me.sitWhenThere = null;
  }
  const len = Math.hypot(mx, my);
  const moving = len > 0 && !paused && !crouching;
  // A tapped route to a thing slows to a walk on arriving, as a runner would only run into it and can't touch it.
  const arriving = !ix && !iy && me.goal && me.route.length && awayFrom(me.goal, me.x, me.y) < thingReach(me.goal) + SLIDE.lookAhead;
  me.running = moving && runKey && !arriving;
  if (moving) {
    // Keys run on until stopped, but a tapped route turns at its next point.
    const ahead = ix || iy ? Infinity : len;
    if (me.running && me.jumpedAt === null && runningIntoSomething(mx / len, my / len, ahead)) {
      if (!timer.running && timer.ms === 0 && targets.length) timer.running = true;
      startSlide(mx / len, my / len, now);
      me.moving = false;
      return;
    }
    if (!timer.running && timer.ms === 0 && targets.length) timer.running = true; // the first move of the round
    if (action) action = null; // moving ends a cheer or a jump at once
    const beforeX = me.x, beforeY = me.y;
    const step = Math.min(MOVE.speed * (me.running ? RUN.speed : 1) * dt, 0.2);
    me.hitX = null;
    me.hitTree = null;
    me.x += (mx / len) * step;
    me.y += (my / len) * step;
    const aimX = me.x, aimY = me.y;
    collide();
    if (me.running && me.jumpedAt === null && Math.hypot(me.x - aimX, me.y - aimY) > step * SLIDE.contact) {
      startSlide(mx / len, my / len, now);
      me.moving = false;
      return;
    }
    // Jumping into a trunk, a shelf or anything else tall rather than past it knocks the character down.
    if (me.height > 0 && me.hitTree) {
      const tx = me.hitTree.mx - beforeX, ty = me.hitTree.my - beforeY;
      if ((tx * mx + ty * my) / (Math.hypot(tx, ty) * len) > 0.6) {
        knockDown(me.hitTree, now);
        return;
      }
    }
    // Walking almost straight into a trunk or a thing: step around it on the nearer side.
    if (me.height === 0 && me.hitX !== null && Math.hypot(me.x - beforeX, me.y - beforeY) < step * 0.6) {
      const px = -my / len, py = mx / len;
      const side = (beforeX - me.hitX) * px + (beforeY - me.hitY) * py >= 0 ? 1 : -1;
      me.x = beforeX + (px * side * 0.85 + (mx / len) * 0.15) * step;
      me.y = beforeY + (py * side * 0.85 + (my / len) * 0.15) * step;
      collide();
    }
    const X = mx - my, Y = (mx + my) / 2;
    const size = Math.hypot(X, Y);
    me.moveX = X / size;
    me.moveY = Y / size;
    me.facing = facingOf(X, Y);
    walkClock += dt * (me.running ? RUN.animation : 1);
    const stepNumber = Math.floor(walkClock / STEP_EVERY_MS);
    if (stepNumber !== me.lastStep && me.jumpedAt === null) stepOn(now, 5, me.running ? RUN.stepStrength : 1);
    me.lastStep = stepNumber;
    // A tapped route gives up if something blocks it, instead of pushing forever.
    if (me.route.length && !ix && !iy) {
      const left = Math.hypot(me.route[0][0] - me.x, me.route[0][1] - me.y);
      if (left < me.closest - 0.02) {
        me.closest = left;
        me.stuck = 0;
      } else {
        me.stuck += dt;
      }
      if (me.stuck > MOVE.stuckMs) me.route = [];
    }
  } else {
    me.moveX = me.moveY = 0;
  }
  me.moving = moving;
  // Reaching something counts on landing, not in the air. A runner can't pick anything up.
  if (!paused && me.jumpedAt === null && !me.running) touchThings(now);
}

// Jumping and crouching; walking and standing are chosen where the character is drawn.
function playerFrame(now) {
  if (action) {
    const { row, ms } = ACTIONS[action.name];
    return [row, Math.min(5, Math.floor(((now - action.start) / ms) * 6))];
  }
  if (crouching) {
    crouchClock += 1;
    return [CROUCH_ROW, crouchClock < 16 ? Math.floor(crouchClock / 6) : 3 + (Math.floor(now / 500) % 2 ? 0 : 2)];
  }
  return null;
}

function drawPreview(now) {
  if (!preview) return;
  const sheet = sheetFor(look);
  preview.clearRect(0, 0, FRAME_W, FRAME_H);
  if (sheet.complete) {
    preview.drawImage(sheet, (Math.floor(now / 210) % 8) * FRAME_W, IDLE_ROW.down * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(now - last, 50));
  last = now;
  if (action && now - action.start > ACTIONS[action.name].ms) action = null;
  if (!crouching) crouchClock = 0;
  moveCharacter(dt, now);
  if (!paused) updateAnimals(dt, now);
  if (timer.running && !paused) {
    timer.ms += dt;
    showTimer();
  }
  const blown = me.running ? RUN.cloth : 1; // running blows the hem and hair much further back
  updateCloth(cloth, me.moveX * blown, me.moveY * blown, dt);
  draw(now);
  drawPreview(now);
  requestAnimationFrame(frame);
}

function jump() {
  if (paused || crouching || theme?.desks || me.jumpedAt !== null || me.knockedAt !== null) return;
  action = null;
  me.jumpedAt = performance.now();
}

// Browsers only allow sound after the player has pressed something, and differ in what counts.
for (const type of ["pointerdown", "pointerup", "mousedown", "touchend", "click", "keyup"]) {
  document.addEventListener(type, wakeSound, true);
}
document.addEventListener("keydown", (event) => {
  wakeSound();
  if (event.key === "Shift") runKey = true;
  if (document.body.classList.contains("menu") && event.target.tagName !== "INPUT") {
    const way = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (way) {
      event.preventDefault();
      moveMenuFocus(...way);
    }
    if (event.key === "Escape") document.getElementById("menu-back")?.click();
    return;
  }
  if (paused) return;
  if (event.target.tagName === "BUTTON" && event.key === " ") return;
  if (event.key === " ") {
    event.preventDefault();
    if (!event.repeat) jump();
    return;
  }
  if (event.key.toLowerCase() === "c") {
    sitOrCrouch(event.repeat);
    return;
  }
  const dir = KEYS[event.key] || KEYS[event.key.toLowerCase()];
  if (!dir) return;
  event.preventDefault();
  if (!event.repeat) tapped = dir;
  held.add(dir);
});
document.addEventListener("keyup", (event) => {
  if (event.key === "Shift") runKey = false;
  if (event.key.toLowerCase() === "c") crouching = false;
  held.delete(KEYS[event.key] || KEYS[event.key.toLowerCase()]);
});
window.addEventListener("blur", () => {
  runKey = false;
  held.clear();
  crouching = false;
});

// Tapping walks to the place tapped, seen through the camera.
canvas.addEventListener("pointerdown", (event) => {
  if (!targets.length || paused) return;
  const box = canvas.getBoundingClientRect();
  const a = (((event.clientX - box.left) / box.width) * VIEW_W + Math.round(cam.x) - OX) / HW;
  const b = (((event.clientY - box.top) / box.height) * VIEW_H + Math.round(cam.y) - TOP_PAD) / HH;
  // Tapping a desk or its chair walks to the chair and sits down.
  const mapX = (a + b) / 2, mapY = (b - a) / 2;
  const chair = theme?.desks && chairs.find((c) => (Math.floor(mapX) === c.deskX && Math.floor(mapY) === c.deskY) || Math.hypot(mapX - c.x, mapY - c.y) < 0.4);
  me.route = chair ? routeToPoint(chair.x, chair.y, SIT.walkUpTo) : routeToPoint(mapX, mapY);
  me.sitWhenThere = chair || null;
});

const jumpButton = document.getElementById("jump");
jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jump();
});
const runButton = document.getElementById("run");
runButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  runKey = true;
});
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  runButton.addEventListener(type, () => {
    runKey = false;
  });
}
const crouchButton = document.getElementById("crouch");
crouchButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  sitOrCrouch(false);
});
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  crouchButton.addEventListener(type, () => {
    crouching = false;
  });
}

document.querySelectorAll("#pad button[data-dir]").forEach((button) => {
  const dir = button.dataset.dir;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (paused) return;
    tapped = dir;
    held.add(dir);
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(type, () => held.delete(dir));
  }
});

document.getElementById("change-outfit").addEventListener("click", showChooser);
document.getElementById("change-place").addEventListener("click", () => {
  if (cardEl.className !== "chooser" && cardEl.className !== "greeting") showPlaces();
});

placeCamera();
showPrompt();
if (chosen) greet();
else showChooser();
requestAnimationFrame(frame);
