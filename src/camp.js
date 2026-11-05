// The lávvu camp: a slow evening instead of a race. Fell a birch, saw it, split the logs at the block, gather branches and build a fire, then cook, make
// a drink, look after the dog and go to bed. Things are named as they are met, and nothing is asked for or timed.
// The fire is an open one in a ring of stones, after a photograph the user gave as a reference, and the kettle stands on the ground beside it: for the user to check.
const CAMP_PLACES = {
  lavvu: [10.5, 11.5], door: [12.75, 13.75], block: [15.5, 12.5], fire: [15, 17], tree: [22.5, 13.5], logs: [24.6, 14.8], kettle: [15.4, 19.5],
  backpack: [12.1, 15.6], bowl: [10, 16.4], start: [14.5, 15.5],
  inDoor: [37, 26], inEnter: [36.6, 25.6], bed: [33.2, 25], hearth: [35.5, 23.5],
};
const CAMP_BRANCHES = [[18.5, 20.5], [12.5, 20.5], [20.5, 16.5], [8.5, 17.5], [18.5, 10.5]];
const CAMP_ROOM = [31, 20, 39, 28]; // the inside, kept out of sight from outdoors and the other way round
const CAMP_TIME = { chops: 5, saws: 4, logs: 2, splitsPerLog: 2, roastMs: 7000, boilMs: 9000, burnMs: 260000, billetFuel: 0.45, darkenMs: 70000, lateMs: 540000, sleepMs: 3200, firstStickMs: 22000, fallMs: 1100 };
const CAMP_REACH = { thing: 1.5, door: 1.15, fire: 2.7, dog: 1.5 };
const CAMP_WORK = { chop: { row: 101, ms: 560, hitAt: 330 }, saw: { row: 102, ms: 500, hitAt: 250 }, throw: { row: 103, ms: 420, hitAt: 210 } };
// Where the tool is in each of the six frames of those rows, from the feet: across, up, and its turn.
const CAMP_HOLD = {
  chop: [[3, -30, -0.5], [2, -32, -0.9], [5, -30, -0.3], [10, -24, 0.7], [11, -12, 1.5], [10, -11, 1.6]],
  saw: [[6, -13, 1.57], [8, -13, 1.57], [11, -13, 1.57], [12, -13, 1.57], [10, -13, 1.57], [7, -13, 1.57]],
  throw: [[0, -28, -1], [2, -32, -0.6], [5, -32, 0], null, null, null],
};
const CAMP_HELD = {
  axe: ["axe", 0, 0.9], saw: ["saw", 0, 0.75], stick: ["stick", 0, 0.9], longlog: ["longlog", 0, 0.8], billet: ["billet", 0, 0.9], kettle: ["kettle", 0, 0.8], kettleFull: ["kettle", 0, 0.8],
  sausage: ["roastsausage", 0, 0.9], sausageDone: ["roastsausage", 1, 0.9], bread: ["roastbread", 0, 0.9], breadDone: ["roastbread", 1, 0.9], dogfood: ["dogfood", 0, 0.7],
};
const CAMP_PACK = [["sausage", "sausage", "sausage"], ["bread", "bread", "bread"], ["kettle", "kettle", "kettle"], ["dogfood", "dogfood", "dogfood"]];
const CAMP_DRINKS = ["coffee", "tea", "cocoa"];
const CAMP_DOG_MAX = 12;
const CAMP_DOG = { walk: 0.0017, run: 0.0058, stepMs: 170, runStepMs: 90, nearFire: 3, sitWithin: 1.5, lookWithin: 5, roamFrom: 6, keepFromHeld: 2.6, stickFrom: 2.5, stickFar: 5.5, routeEveryMs: 400, drinkLeast: 120000, drinkMore: 180000, drinkMs: 3600, eatMs: 5000 };
const CAMP_TEXT = {
  guide: "Täällä ei ole kiirettä. Kaada koivu, sahaa se, halkaise puut kirveellä, kerää oksat ja tee nuotio. Sitten paista ruokaa, keitä juotavaa ja pidä huolta koirastasi. Kun työt on tehty, mene laavuun nukkumaan.",
  keys: "E: ota, käytä tai mene laavuun. B: avaa reppu. Q: laske kädestä.",
  dogTitle: "Mikä koirasi nimi on?", dogNote: "Se on suomenlapinkoira. Nimen voi vaihtaa myöhemmin.", dogHint: "Koiran nimi", dogDefault: "Čáppa",
  pack: "Niestelávka eli eväsreppu", putAway: "Sulje", changeDog: "Vaihda koiran nimi", drinks: "Mitä keität?",
  notTired: "In leat vel váiban. Mus leat vel barggut.", notTiredFi: "En ole vielä väsynyt. Minulla on vielä töitä.",
  play: "Háliidatgo stoahkat?", playFi: "Haluatko leikkiä? Ota keppi E:llä ja heitä se E:llä. Q laskee sen jalkoihisi.",
  night: "Buorre idja!", nightFi: "Hyvää yötä!", ended: "Hyvää yötä! Päivän työt on tehty.", learned: "Tänä iltana opit nämä sanat",
};
const CAMP_CHORES = [["fire", "dolla", "Tee nuotio"], ["food", "biebmu", "Syö jotain"], ["drink", "gáffe, deadja, kakáo", "Keitä juotavaa"], ["dog", "beana", "Ruoki koira"], ["sleep", "oađđinseahkka", "Mene nukkumaan"]];
const CAMP_STAGES = {
  axe: { sme: "Váldde ákšu", fi: "Ota kirves pölkyltä", line: "camp-axe", at: "block" }, fell: { sme: "Čuohpa muora", fi: "Kaada koivu", line: "camp-fell", at: "tree" },
  saw: { sme: "Váldde sahá", fi: "Ota saha pölkyn luota", line: "camp-saw", at: "block" }, cut: { sme: "Sahá muora", fi: "Sahaa puu", line: "camp-cut", at: "logs" },
  carry: { sme: "dimbbar", fi: "Kanna puut pölkyn luo", at: "logs" }, split: { sme: "hálgu", fi: "Halkaise puut kirveellä", at: "block" },
  stack: { sme: "hálgu", fi: "Vie halot kiviringin luo" }, branches: { sme: "Čohkke ovssiid", fi: "Kerää oksia", line: "camp-branches" },
  kindle: { sme: "oaksi", fi: "Laita oksat puiden päälle", at: "fire" }, light: { sme: "Cahkket dola", fi: "Sytytä nuotio", line: "camp-light", at: "fire" },
};

let camp = null;

function campDogName() {
  try {
    return localStorage.getItem("mahtte.dog") || "";
  } catch {
    return "";
  }
}

function setupCamp() {
  camp = {
    stage: "axe", hand: null, chops: 0, saws: 0, logsMoved: 0, splits: 0, stacked: 0, branches: CAMP_BRANCHES.map(([x, y]) => ({ x, y })), billets: [], fuel: 0, lit: false, dark: 0, clock: 0, lastChore: null,
    done: {}, kettle: null, roast: null, inside: false, fallAt: null, sleeping: null, met: new Set(), smoke: [], embers: [], chips: [], steam: 0, bowlFull: false, stick: null, flight: null, brought: false, pending: null, flicker: 1, nextCrackle: 0,
    dog: { x: 18.5, y: 15.5, facing: 3, frame: 0, clock: 0, mode: "roam", target: null, next: 1500, stuck: 0, has: false, wagUntil: 0, drinkIn: 90000 + Math.random() * 60000, wait: 0, hop: 0, nextBark: 0, moving: false },
  };
  Object.assign(me, { x: CAMP_PLACES.start[0], y: CAMP_PLACES.start[1], hidden: false });
  buildCampAhead();
}

// A picture takes a moment to draw the first time, so the big ones are made as the place opens and the dog a little at a time.
function buildCampAhead() {
  campLavvuImage();
  const ahead = (facing, frame, carrying) => queueFinePicture(`laphund/${facing}/${frame}/${facing}/${carrying}/${viewDetail}`, "laphund", facing, frame, facing, carrying);
  for (let facing = 0; facing < 4; facing++) for (let frame = 0; frame <= 10; frame++) ahead(facing, frame);
  for (let facing = 0; facing < 4; facing++) for (let frame = 0; frame <= 4; frame++) ahead(facing, frame, "stick");
  // Last in the queue, so first to be made, with the lit fire and its picture first of all.
  for (const frame of [1, 2, 3, 0, 4]) campFireImage(frame);
}

// Drawn in one go when it's needed, the fire would hold up a phone for a long time. Until a stage of it is ready, the last one shows.
let campFireShown = null;
function campFireImage(frame) {
  const key = `campfire/0/${frame}/0/undefined/${viewDetail}`;
  if (modelImages.has(key)) return (campFireShown = modelImages.get(key));
  if (!campFireShown && frame === 5) return (campFireShown = modelImage("campfire", 0, 5)); // the bare ring, as the place opens
  queueFinePicture(key, "campfire", 0, frame, 0);
  return campFireShown ?? modelImage("campfire", 0, 5);
}

let campLavvu = null;
function campLavvuImage() {
  if (!campLavvu) {
    campLavvu = makeModelImage("camp_lavvu", 0, 0, 0, undefined, 4);
    campLavvu.detail = 2; // built at half size, drawn at twice that
  }
  return campLavvu;
}

const campNear = (at, reach) => Math.hypot(me.x - at[0], me.y - at[1]) < reach;
const campWord = (sprite) => window.MAHTTE_WORDS.find((word) => word.sprite === sprite);
const campAt = (name) => CAMP_PLACES[name];
const campNearWater = () => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => tileOr(Math.floor(me.x + a * 0.8), Math.floor(me.y + b * 0.8), "g") === "w");
const campLitFire = () => camp?.lit && !camp.inside;

// Names a thing the first time it's met, with its picture and its word said.
function campMeet(sprite, picture = sprite) {
  if (!camp || camp.met.has(sprite)) return;
  camp.met.add(sprite);
  const word = campWord(sprite);
  if (!word) return;
  heardWords.push(word);
  cardEl.className = "right";
  preview = null;
  cardEl.innerHTML = audioOnly ? `<div class="note">${TEXT.listen}</div>` : `<div><div class="note">${TEXT.thisIs}</div>
    <div><span class="word" lang="se">${escapeText(word.lemma)}</span> <span class="translation">= ${escapeText(translation(word))}</span></div></div>`;
  const image = picture.getContext ? picture : pictureOf({ sprite: picture });
  const canvasEl = document.createElement("canvas");
  canvasEl.width = image.width;
  canvasEl.height = image.height;
  canvasEl.getContext("2d").drawImage(image, 0, 0);
  cardEl.prepend(canvasEl);
  playVoice(wordLine(word));
}

function campSay(sme, fi, line) {
  saying = { say: sme, until: performance.now() + 3200 };
  cardEl.className = "";
  cardEl.innerHTML = audioOnly ? `<div class="note">${escapeText(fi)}</div>` : `<div><span lang="se">${escapeText(sme)}</span><div class="note">${escapeText(fi)}</div></div>`;
  if (line) playVoice(`audio/${line}-${VOICES[look.gender]}.wav`);
}

function campChoreDone(chore) {
  if (camp.done[chore]) return;
  camp.done[chore] = true;
  sparkles.push({ x: me.x - 0.5, y: me.y - 0.5, born: performance.now() });
  playImpact("brush");
  showPrompt();
}

function campStage(stage) {
  camp.stage = stage;
  showPrompt();
}

// Work to the left or right of the screen, with the character held still until it's done.
function campWork(name, target, now, onHit) {
  const before = me.facing;
  startAction(CAMP_WORK[name] ? name : "pat", now);
  me.facing = before;
  action.flip = isoX(target[0], target[1]) < isoX(me.x, me.y);
  me.heldUntil = now + ACTIONS[action.name].ms;
  camp.pending = onHit ? { at: now + (CAMP_WORK[name]?.hitAt ?? 300), run: onHit } : null;
}

function campHand(hand) {
  camp.hand = hand;
  playImpact("brush");
}

// ------------------------------------------------------------- what E does here
function campChop(now) {
  campWork("chop", campAt("tree"), now, () => {
    camp.chops++;
    campChips(campAt("tree"), "#e8d4ae", 8);
    campThunk(150);
    if (camp.chops >= CAMP_TIME.chops) {
      camp.fallAt = performance.now();
      camp.hand = null;
      campStage("saw");
    }
  });
}

function campSaw(now) {
  campWork("saw", campAt("logs"), now, () => {
    camp.saws++;
    campChips(campAt("logs"), "#dcc08c", 5);
    campNoise(240, 2600, 0.05);
    if (camp.saws >= CAMP_TIME.saws) {
      camp.hand = null;
      campMeet("longlog");
      campStage("carry");
    }
  });
}

function campSplitBillets(now) {
  campWork("chop", campAt("block"), now, () => {
    campThunk(190);
    campChips(campAt("block"), "#e8d4ae", 6);
    const [x, y] = campAt("block");
    camp.billets.push({ x: x + 0.9 + Math.random() * 0.8, y: y + 0.6 + Math.random() * 1 });
    campMeet("billet");
  });
}

// One split of a log at the block: a billet falls beside it. The stage moves on when all the logs are split.
function campSplitLog(now) {
  campWork("chop", campAt("block"), now, () => {
    camp.splits++;
    campThunk(190);
    campChips(campAt("block"), "#e8d4ae", 6);
    const [x, y] = campAt("block");
    camp.billets.push({ x: x + 0.9 + Math.random() * 0.8, y: y + 0.6 + Math.random() * 1 });
    campMeet("billet");
    if (camp.splits >= CAMP_TIME.logs * CAMP_TIME.splitsPerLog) {
      camp.hand = null;
      campStage("stack");
    }
  });
}

// Where a thrown stick comes down: as far as it goes the way the character faces, where the dog can get to it. Near the
// fire, in the trees or too close to the thrower won't do, so it goes a little to the side, and in the end to the dog's feet.
function campStickLanding(dx, dy) {
  const reach = campDogReach(camp.dog.x, camp.dog.y);
  const heading = Math.atan2(dy, dx);
  for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, 3.14]) {
    for (let far = CAMP_DOG.stickFar; far >= CAMP_DOG.stickFrom; far -= 0.5) {
      const x = me.x + Math.cos(heading + turn) * far, y = me.y + Math.sin(heading + turn) * far;
      if (campCellFree(x, y) && reach.cameFrom.has(campCell(x, y))) return [x, y];
    }
  }
  return [camp.dog.x, camp.dog.y];
}

function campThrow(now) {
  const dirs = { S: [1, 1], N: [-1, -1], E: [1, -1], W: [-1, 1], SE: [1, 0], SW: [0, 1], NE: [0, -1], NW: [-1, 0] };
  const [dx, dy] = dirs[me.facing] ?? [1, 1];
  const [x, y] = campStickLanding(dx, dy);
  campWork("throw", [me.x + dx, me.y + dy], now, () => {
    camp.hand = null;
    camp.flight = { fromX: me.x, fromY: me.y, x, y, born: performance.now(), ms: 520 };
    campNoise(90, 900, 0.03);
  });
  playVoice(`audio/camp-fetch-${VOICES[look.gender]}.wav`);
}

function campPat(now) {
  const dog = camp.dog;
  campWork("pat", [dog.x, dog.y], now);
  dog.wagUntil = now + 3500;
  sparkles.push({ x: dog.x - 0.5, y: dog.y - 0.5, born: now });
  campSay(`${TEXT_BUORRE(campDogName())}`, "Hyvä koira!", "camp-gooddog");
  campMeet("beana", "laphund");
}
const TEXT_BUORRE = (name) => `Buorre beana${name ? `, ${name}` : ""}!`;

function campStartRoast(kind, now) {
  const until = now + CAMP_TIME.roastMs;
  camp.roast = { kind, until };
  me.heldUntil = until;
  me.moveX = me.moveY = 0;
}

function campEat(now, chore = "food") {
  startAction("pick", now);
  const eaten = camp.hand;
  camp.hand = null;
  campChoreDone(chore);
  playImpact("brush");
  return eaten;
}

function campGiveBite(now) {
  const dog = camp.dog;
  campWork("pat", [dog.x, dog.y], now);
  dog.eat = CAMP_DOG.eatMs / 2;
  dog.fed = true;
  dog.wagUntil = now + 5000;
  camp.bitten = true;
  campMeet("knife");
  campChoreDone("dog");
}

function campAddWood(now) {
  campWork("pat", campAt("fire"), now, () => {
    camp.hand = null;
    camp.fuel = Math.min(1, camp.fuel + CAMP_TIME.billetFuel);
    campThunk(120);
    for (let i = 0; i < 8; i++) campEmber();
  });
}

function campLight(now) {
  campWork("pat", campAt("fire"), now, () => {
    camp.lit = true;
    camp.fuel = 1;
    campStage("free");
    campMeet("campfire", modelImages.has(`campfire/0/0/0/undefined/${viewDetail}`) ? "campfire" : croppedImage(campFireImage(4)));
    campChoreDone("fire");
    campNoise(700, 1200, 0.1);
  });
  campMeet("match");
}

function campEnter(now) {
  camp.fade = now;
  camp.inside = true;
  [me.x, me.y] = campAt("inEnter");
  me.facing = "NW";
  placeCamera();
  campMeet("lavvu", "lavvu");
}

function campLeave(now) {
  camp.fade = now;
  camp.inside = false;
  [me.x, me.y] = [campAt("door")[0] + 0.25, campAt("door")[1] + 0.25];
  me.facing = "S";
  placeCamera();
}

function campSleep(now) {
  const allDone = camp.done.fire && camp.done.food && camp.done.drink && camp.done.dog;
  if (!allDone && camp.clock < CAMP_TIME.lateMs) {
    campMeet("sleepingbag");
    campSay(CAMP_TEXT.notTired, CAMP_TEXT.notTiredFi, "camp-nottired");
    return;
  }
  camp.sleeping = now;
  me.hidden = true;
  me.route = [];
  held.clear();
  camp.done.sleep = true;
  showPrompt();
  campSay(CAMP_TEXT.night, CAMP_TEXT.nightFi, "camp-goodnight");
}

// What E can do just now, with the task of the moment first.
function campHint() {
  if (!camp || camp.sleeping) return null;
  const hand = camp.hand;
  if (camp.inside) {
    if (campNear(campAt("bed"), 2.2)) return { sme: "Mana nohkkat", fi: "Mene nukkumaan", line: "camp-sleep", act: campSleep };
    if (campNear(campAt("inDoor"), 1.5)) return { sme: "lávvu", fi: "Mene ulos", act: campLeave };
    return null;
  }
  const stage = CAMP_STAGES[camp.stage];
  const atBlock = campNear(campAt("block"), CAMP_REACH.thing), atFire = campNear(campAt("fire"), CAMP_REACH.fire);
  switch (camp.stage) {
    case "axe":
      if (atBlock) return { ...stage, act: () => { campHand("axe"); campMeet("axe"); campStage("fell"); } };
      break;
    case "fell":
      if (hand === "axe" && campNear(campAt("tree"), CAMP_REACH.thing)) return { ...stage, act: (now) => { campMeet("birch"); campChop(now); } };
      break;
    case "saw":
      if (atBlock && !camp.fallingNow) return { ...stage, act: () => { campHand("saw"); campMeet("saw"); campStage("cut"); } };
      break;
    case "cut":
      if (hand === "saw" && campNear(campAt("logs"), 2)) return { ...stage, act: campSaw };
      break;
    case "carry":
      if (!hand && campNear(campAt("logs"), 2)) return { ...stage, act: () => campHand("longlog") };
      if (hand === "longlog" && atBlock) return { sme: "dimbbar", fi: "Laske puu pölkyn viereen", act: () => {
        camp.hand = null;
        camp.logsMoved++;
        campThunk(110);
        if (camp.logsMoved >= CAMP_TIME.logs) campStage("split");
      } };
      break;
    case "split":
      if (atBlock && hand === "axe") return { ...stage, act: campSplitLog };
      if (atBlock && !hand) return { sme: "ákšu", fi: "Ota kirves", act: () => campHand("axe") };
      break;
    case "stack": {
      if (hand === "billet" && atFire) return { sme: "hálgu", fi: "Pinoa halko kivirinkiin", act: () => {
        camp.hand = null;
        camp.stacked++;
        campThunk(110);
        if (camp.stacked >= CAMP_TIME.logs * CAMP_TIME.splitsPerLog) campStage("branches");
      } };
      const lying = camp.billets.find((b) => campNear([b.x, b.y], 1.2));
      if (!hand && lying) return { sme: "hálgu", fi: "Ota halko", act: () => {
        camp.billets = camp.billets.filter((b) => b !== lying);
        campHand("billet");
      } };
      break;
    }
    case "branches": {
      const branch = camp.branches.find((b) => campNear([b.x, b.y], CAMP_REACH.thing));
      if (branch) return { ...stage, act: (now) => {
        startAction("pick", now);
        camp.branches = camp.branches.filter((b) => b !== branch);
        campMeet("stick");
        playImpact("brush");
        if (!camp.branches.length) campStage("kindle");
      } };
      break;
    }
    case "kindle":
      if (atFire) return { ...stage, act: (now) => campWork("pat", campAt("fire"), now, () => campStage("light")) };
      break;
    case "light":
      if (atFire) return { ...stage, act: campLight };
      break;
    default:
  }
  if (hand === "stick") return { sme: "oaksi", fi: "Heitä keppi (Q: laske jalkoihin)", act: campThrow };
  if (campNear(campAt("door"), CAMP_REACH.door)) return { sme: "lávvu", fi: "Mene sisään", act: campEnter };
  if (camp.lit && atFire) {
    if (hand === "billet") return { sme: "Bija muora dollii", fi: "Lisää puu nuotioon", line: "camp-wood", act: campAddWood };
    if (hand === "sausage" || hand === "bread") return { sme: hand === "sausage" ? "Base márffi" : "Base láibbi", fi: "Paista nuotiolla", line: hand === "sausage" ? "camp-roast" : null, act: (now) => campStartRoast(hand, now) };
    if (hand === "kettleFull") return { sme: "Vuošša čázi", fi: "Laske pannu nuotion viereen", line: "camp-boil", act: (now) => {
      startAction("pick", now);
      camp.kettle = { boilAt: now + CAMP_TIME.boilMs };
      camp.hand = null;
      campThunk(240);
    } };
  }
  if (camp.kettle && campNear(campAt("kettle"), CAMP_REACH.thing) && camp.kettle.boilAt < performance.now()) return { sme: "gievdni", fi: "Tee juotavaa", act: campOpenDrinks };
  if (hand === "kettle" && campNearWater()) return { sme: "Viečča čázi", fi: "Täytä pannu", line: "camp-water", act: (now) => {
    startAction("pick", now);
    camp.hand = "kettleFull";
    campMeet("water");
    campMeet("river");
    campNoise(500, 700, 0.06);
  } };
  if (hand === "dogfood" && campNear(campAt("bowl"), CAMP_REACH.thing)) return { sme: "lihtti", fi: "Laita ruokaa kuppiin", act: (now) => {
    startAction("pick", now);
    camp.hand = null;
    camp.bowlFull = true;
    campMeet("bowl");
    campMeet("dogfood");
    campChoreDone("dog");
  } };
  const billet = camp.billets.find((b) => campNear([b.x, b.y], 1));
  if (!hand && billet) return { sme: "hálgu", fi: "Ota halko", act: () => {
    camp.billets = camp.billets.filter((b) => b !== billet);
    campHand("billet");
  } };
  if (camp.lit && atBlockOrAxe(atBlock, hand)) return hand === "axe"
    ? { sme: "hálgu", fi: "Halkaise puuta", act: campSplitBillets }
    : { sme: "ákšu", fi: "Ota kirves", act: () => campHand("axe") };
  if (!hand && camp.stick && campNear([camp.stick.x, camp.stick.y], 1.1)) return { sme: "oaksi", fi: "Ota keppi", act: () => {
    camp.stick = null;
    campHand("stick");
    campMeet("stick");
  } };
  if (campNear([camp.dog.x, camp.dog.y], CAMP_REACH.dog)) {
    const name = campDogName() || "beana";
    if (hand === "sausageDone" && !camp.bitten) return { sme: name, fi: "Leikkaa koiralle pala makkaraa", act: campGiveBite };
    if (!hand) return { sme: name, fi: "Silitä koiraa", act: campPat };
  }
  if (hand === "sausageDone" || hand === "breadDone") return { sme: hand === "sausageDone" ? "márfi" : "láibi", fi: "Syö", act: (now) => { campMeet(hand === "sausageDone" ? "sausage" : "bread"); campEat(now); } };
  if (!hand && camp.stage === "free" && campNear(campAt("backpack"), CAMP_REACH.thing)) return { sme: "niestelávka", fi: "Avaa reppu", act: campOpenPack };
  if (campNear(campAt("bowl"), 1.2)) campMeet("bowl");
  return null;
}
const atBlockOrAxe = (atBlock, hand) => atBlock && (!hand || hand === "axe");

// Q: out of the hands, the tools back where they were and a stick at the feet.
function campPutDown() {
  if (!camp || !camp.hand || me.heldUntil > performance.now()) return;
  if (camp.hand === "stick") camp.stick = campOutOfFire(me.x + 0.4, me.y + 0.4);
  if (camp.hand === "billet") camp.billets.push(campOutOfFire(me.x + 0.4, me.y + 0.4));
  if (camp.stage === "fell" && camp.hand === "axe") camp.stage = "axe";
  if (camp.stage === "cut" && camp.hand === "saw") camp.stage = "saw";
  camp.hand = null;
  playImpact("brush");
  showPrompt();
}

// ------------------------------------------------------------- windows
function campPanel(html) {
  closeResults();
  paused = true;
  held.clear();
  const panel = document.createElement("div");
  panel.id = "results";
  panel.setAttribute("role", "dialog");
  panel.innerHTML = `<div class="panel camp-panel">${html}</div>`;
  document.body.append(panel);
  return panel;
}

function campThumb(sprite, frame = 0) {
  const image = croppedImage(makeModelImage(sprite, 0, frame, 0, undefined, 2));
  const canvasEl = document.createElement("canvas");
  canvasEl.width = image.width;
  canvasEl.height = image.height;
  canvasEl.getContext("2d").drawImage(image, 0, 0);
  return canvasEl;
}

function campPickButton(sprite, onClick) {
  const word = campWord(sprite);
  const button = document.createElement("button");
  button.append(campThumb(sprite === "kettle" ? "kettle" : sprite));
  const label = document.createElement("span");
  label.innerHTML = `<b lang="se">${escapeText(word.lemma)}</b> ${audioOnly ? "" : escapeText(translation(word))}`;
  button.append(label);
  button.addEventListener("click", () => {
    closeResults();
    paused = false;
    onClick();
  });
  return button;
}

function campOpenPack() {
  if (!camp || camp.inside || camp.sleeping || camp.stage !== "free") {
    if (camp?.stage !== "free") campSay("niestelávka", "Tee ensin nuotio.");
    return;
  }
  campMeet("backpack");
  const panel = campPanel(`<h2>${escapeText(CAMP_TEXT.pack)}</h2><div class="camp-items"></div>
    <div class="buttons"><button id="camp-dog-name">${escapeText(CAMP_TEXT.changeDog)}</button><button id="camp-close">${escapeText(CAMP_TEXT.putAway)}</button></div>`);
  const items = panel.querySelector(".camp-items");
  for (const [sprite, hand] of CAMP_PACK) items.append(campPickButton(sprite, () => {
    campHand(hand);
    campMeet(sprite);
  }));
  const close = panel.querySelector("#camp-close");
  close.addEventListener("click", () => {
    closeResults();
    paused = false;
  });
  panel.querySelector("#camp-dog-name").addEventListener("click", () => campAskDogName());
  close.focus();
}

function campOpenDrinks() {
  const panel = campPanel(`<h2>${escapeText(CAMP_TEXT.drinks)}</h2><div class="camp-items"></div>`);
  const items = panel.querySelector(".camp-items");
  for (const sprite of CAMP_DRINKS) items.append(campPickButton(sprite, () => {
    startAction("pick", performance.now());
    camp.kettle = null;
    campMeet(sprite);
    campMeet("kuksa");
    campChoreDone("drink");
  }));
  items.querySelector("button").focus();
}

function campAskDogName() {
  const panel = campPanel(`<h2>${escapeText(CAMP_TEXT.dogTitle)}</h2><p>${escapeText(CAMP_TEXT.dogNote)}</p>
    <form class="camp-name"><input maxlength="${CAMP_DOG_MAX}" aria-label="${escapeText(CAMP_TEXT.dogHint)}" placeholder="${escapeText(CAMP_TEXT.dogDefault)}"><button>${TEXT.guide.ok}</button></form>`);
  panel.querySelector(".panel").prepend(campThumb("laphund", 5));
  const input = panel.querySelector("input");
  input.value = campDogName();
  panel.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      localStorage.setItem("mahtte.dog", input.value.trim() || CAMP_TEXT.dogDefault);
    } catch {
      // Private windows may refuse; the dog is then just "beana".
    }
    closeResults();
    paused = false;
    showPrompt();
  });
  input.focus();
}

function campEnd() {
  const panel = campPanel(`<h2>${escapeText(CAMP_TEXT.ended)}</h2>${heardWords.length ? `<p>${escapeText(CAMP_TEXT.learned)}</p><ul class="heard"></ul>` : ""}
    <div class="buttons"><button id="camp-again">${TEXT.playAgain}</button><button id="camp-menu">${TEXT.mainMenu}</button></div>`);
  const list = panel.querySelector(".heard");
  for (const word of list ? heardWords : []) {
    const row = document.createElement("li");
    row.innerHTML = `<b lang="se">${escapeText(word.lemma)}</b> = ${escapeText(translation(word))}`;
    list.append(row);
  }
  panel.querySelector("#camp-again").addEventListener("click", () => enterTheme(theme));
  panel.querySelector("#camp-menu").addEventListener("click", () => showPlaces());
}

// The list of the evening's work on its paper, with what is still only ahead greyed by what's first.
function campList() {
  const paper = document.createElement("ul");
  paper.className = "paper-list";
  paper.lang = "se";
  const add = (sme, fi, done) => {
    const row = document.createElement("li");
    row.textContent = sme;
    const note = document.createElement("small");
    note.textContent = fi;
    row.append(note);
    if (done) row.className = "bought";
    paper.append(row);
  };
  const stage = CAMP_STAGES[camp?.stage];
  for (const [chore, sme, fi] of CAMP_CHORES) {
    if (chore === "fire" && stage) add(stage.sme, stage.fi, false);
    else add(sme, fi, camp?.done[chore]);
  }
  return paper;
}

// ------------------------------------------------------------- the evening, as time goes
function updateCamp(dt, now) {
  if (!camp) return;
  camp.clock += dt;
  camp.flicker = 0.92 + Math.sin(now / 83) * 0.04 + Math.sin(now / 37) * 0.03 + Math.sin(now / 211) * 0.04;
  if (camp.pending && now >= camp.pending.at) {
    const run = camp.pending.run;
    camp.pending = null;
    run();
  }
  camp.fallingNow = camp.fallAt !== null && now - camp.fallAt < CAMP_TIME.fallMs;
  if (camp.fallAt !== null && !camp.felled && now - camp.fallAt >= CAMP_TIME.fallMs) {
    camp.felled = true;
    campThunk(70);
    campChips([campAt("tree")[0] + 1.6, campAt("tree")[1]], "#d8d0b8", 14);
  }
  const dusk = camp.lit ? CAMP_TIME.darkenMs : CAMP_TIME.darkenMs * 4;
  camp.dark = Math.min(camp.lit ? 1 : 0.55, camp.dark + dt / dusk);
  if (camp.lit) {
    camp.fuel = Math.max(0.18, camp.fuel - dt / CAMP_TIME.burnMs);
    if (Math.random() < dt * 0.012) campSmoke();
    if (Math.random() < dt * 0.006 * camp.fuel) campEmber();
    if (now > camp.nextCrackle && !camp.inside && !paused) {
      camp.nextCrackle = now + 100 + Math.random() * 700;
      const away = Math.hypot(me.x - campAt("fire")[0], me.y - campAt("fire")[1]);
      if (away < 12) campNoise(14 + Math.random() * 30, 1800 + Math.random() * 3000, (0.05 * camp.fuel) / (1 + away * 0.25));
    }
  }
  if (camp.roast && now >= camp.roast.until) {
    camp.hand = `${camp.roast.kind}Done`;
    campMeet(camp.roast.kind === "sausage" ? "sausage" : "bread");
    camp.roast = null;
  }
  if (camp.kettle && camp.kettle.boilAt < now && Math.random() < dt * 0.012) camp.smoke.push({ x: campAt("kettle")[0], y: campAt("kettle")[1], high: 11, born: now, life: 900, steam: true, drift: 0.01 });
  for (const list of ["smoke", "embers", "chips"]) camp[list] = camp[list].filter((part) => now - part.born < part.life);
  if (camp.sleeping && now - camp.sleeping > CAMP_TIME.sleepMs && !camp.ended) {
    camp.ended = true;
    campEnd();
  }
  updateCampDog(dt, now);
  if (camp.flight && now - camp.flight.born >= camp.flight.ms) {
    camp.stick = { x: camp.flight.x, y: camp.flight.y };
    camp.flight = null;
    if (!camp.inside && !camp.dog.has) camp.dog.mode = "fetch";
  }
  if (camp.fade && now - camp.fade > 500) camp.fade = null;
}

function campSmoke() {
  const [x, y] = campAt("fire");
  camp.smoke.push({ x: x + (Math.random() - 0.5) * 1.2, y: y + (Math.random() - 0.5) * 0.6, high: 26 + 18 * camp.fuel, born: performance.now(), life: 3800 + Math.random() * 2000, drift: 0.004 + Math.random() * 0.004 });
}

function campEmber() {
  const [x, y] = campAt("fire");
  camp.embers.push({ x: x + (Math.random() - 0.5) * 1.3, y: y + (Math.random() - 0.5) * 0.5, born: performance.now(), life: 900 + Math.random() * 1200, drift: (Math.random() - 0.5) * 0.02, rise: 0.02 + Math.random() * 0.02 });
}

function campChips([x, y], colour, count) {
  const now = performance.now();
  for (let i = 0; i < count; i++) camp.chips.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, colour, born: now, life: 350 + Math.random() * 250, dx: (Math.random() - 0.5) * 0.05, up: 0.03 + Math.random() * 0.05 });
}

// Small sounds made in the browser: a thud of wood and short bursts of noise, which together are the fire's crackle.
let campNoiseBuffer = null;
function campNoise(ms, pitch, level) {
  if (!sound) return;
  if (!campNoiseBuffer) {
    campNoiseBuffer = sound.createBuffer(1, sound.sampleRate, sound.sampleRate);
    const data = campNoiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = sound.createBufferSource(), filter = sound.createBiquadFilter(), gain = sound.createGain();
  source.buffer = campNoiseBuffer;
  filter.type = "bandpass";
  filter.frequency.value = pitch;
  gain.gain.setValueAtTime(level, sound.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, sound.currentTime + ms / 1000);
  source.connect(filter).connect(gain).connect(sound.destination);
  source.start(0, Math.random() * 0.5, ms / 1000 + 0.02);
}

function campThunk(pitch) {
  if (!sound) return;
  const tone = sound.createOscillator(), gain = sound.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(pitch * 1.6, sound.currentTime);
  tone.frequency.exponentialRampToValueAtTime(pitch * 0.6, sound.currentTime + 0.12);
  gain.gain.setValueAtTime(0.16, sound.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, sound.currentTime + 0.16);
  tone.connect(gain).connect(sound.destination);
  tone.start();
  tone.stop(sound.currentTime + 0.18);
  campNoise(60, pitch * 8, 0.08);
}

function campBark() {
  if (!sound) return;
  const tone = sound.createOscillator(), filter = sound.createBiquadFilter(), gain = sound.createGain();
  tone.type = "sawtooth";
  tone.frequency.setValueAtTime(420, sound.currentTime);
  tone.frequency.exponentialRampToValueAtTime(230, sound.currentTime + 0.11);
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  gain.gain.setValueAtTime(0.0001, sound.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, sound.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, sound.currentTime + 0.15);
  tone.connect(filter).connect(gain).connect(sound.destination);
  tone.start();
  tone.stop(sound.currentTime + 0.17);
}

// ------------------------------------------------------------- the dog
const campBlocked = (x, y) => {
  const tile = tileOr(Math.floor(x), Math.floor(y), "X");
  return SOLID_TILES.has(tile) || tile === "t" || x > 27;
};
const campFromFire = (x, y) => Math.hypot(x - campAt("fire")[0], y - campAt("fire")[1]);
const campCellFree = (x, y) => !campBlocked(x, y) && campFromFire(x, y) > CAMP_DOG.nearFire + 0.1;

// What's put down beside the fire stays clear of the stones.
function campOutOfFire(x, y) {
  const away = campFromFire(x, y), [fx, fy] = campAt("fire");
  if (away >= 1.8) return { x, y };
  const size = away || 1;
  return { x: fx + ((x - fx) / size) * 1.8, y: fy + ((y - fy) / size) * 1.8 };
}

// Everywhere the dog can run from where it is, on a grid of half tiles, so that it can go round what stands in the way.
const campCell = (x, y) => `${Math.floor(x * 2)},${Math.floor(y * 2)}`;
function campDogReach(fromX, fromY) {
  let startX = fromX, startY = fromY;
  if (!campCellFree(startX, startY)) {
    // Beside the fire or something solid: from the nearest free place.
    let best = Infinity;
    for (let a = -3; a <= 3; a += 0.5) for (let b = -3; b <= 3; b += 0.5) {
      const x = fromX + a, y = fromY + b;
      if (campCellFree(x, y) && Math.hypot(a, b) < best) [best, startX, startY] = [Math.hypot(a, b), x, y];
    }
  }
  const start = [Math.floor(startX * 2), Math.floor(startY * 2)];
  const cameFrom = new Map([[`${start}`, null]]);
  const open = [start];
  for (let at = 0; at < open.length; at++) {
    const [cx, cy] = open[at];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const next = [cx + a, cy + b], key = `${next}`;
      if (cameFrom.has(key) || !campCellFree((next[0] + 0.5) / 2, (next[1] + 0.5) / 2)) continue;
      if (a && b && (!campCellFree((cx + a + 0.5) / 2, (cy + 0.5) / 2) || !campCellFree((cx + 0.5) / 2, (cy + b + 0.5) / 2))) continue; // no cutting corners
      cameFrom.set(key, `${cx},${cy}`);
      open.push(next);
    }
  }
  return { cameFrom, open };
}

// The way to a place, or as near to it as the dog can get. The last step is the place itself when it can be stood on.
function campDogRoute(dog, toX, toY) {
  const { cameFrom, open } = campDogReach(dog.x, dog.y);
  let end = campCell(toX, toY);
  const exact = cameFrom.has(end);
  if (!exact) {
    let best = Infinity;
    for (const [cx, cy] of open) {
      const away = Math.hypot((cx + 0.5) / 2 - toX, (cy + 0.5) / 2 - toY);
      if (away < best) [best, end] = [away, `${cx},${cy}`];
    }
  }
  const route = [];
  for (let at = end; at; at = cameFrom.get(at)) {
    const [cx, cy] = at.split(",").map(Number);
    route.unshift([(cx + 0.5) / 2, (cy + 0.5) / 2]);
  }
  route.shift(); // where it already is
  if (exact) route.push([toX, toY]);
  return route;
}

// Along a route, worked out again now and then as things and people move. True on arriving.
function campDogRun(dog, toX, toY, speed, dt) {
  dog.routeIn = (dog.routeIn ?? 0) - dt;
  if (!dog.route || dog.routeIn <= 0) {
    dog.route = campDogRoute(dog, toX, toY);
    dog.routeIn = CAMP_DOG.routeEveryMs;
  }
  if (!dog.route.length) return true;
  const [x, y] = dog.route[0];
  if (campDogMove(dog, x, y, speed, dt)) dog.route.shift();
  return !dog.route.length;
}

function campDogMove(dog, toX, toY, speed, dt) {
  const dx = toX - dog.x, dy = toY - dog.y, away = Math.hypot(dx, dy);
  dog.moving = away > 0.05;
  if (!dog.moving) return true;
  const step = Math.min(away, speed * dt);
  let nx = dog.x + (dx / away) * step, ny = dog.y + (dy / away) * step;
  // Round the fire, never through it, and the same for what stands in the way.
  const [fx, fy] = campAt("fire");
  const fromFire = Math.hypot(nx - fx, ny - fy);
  if (fromFire < CAMP_DOG.nearFire) {
    nx = fx + ((nx - fx) / (fromFire || 1)) * CAMP_DOG.nearFire;
    ny = fy + ((ny - fy) / (fromFire || 1)) * CAMP_DOG.nearFire;
  }
  if (!campBlocked(nx, ny)) [dog.x, dog.y] = [nx, ny];
  else if (!campBlocked(nx, dog.y)) dog.x = nx;
  else if (!campBlocked(dog.x, ny)) dog.y = ny;
  else {
    dog.stuck += dt;
    if (dog.stuck > 400) {
      dog.stuck = 0;
      dog.target = null;
      dog.next = 0;
      if (dog.mode !== "roam") dog.mode = "roam";
    }
  }
  dog.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);
  return away < 0.1;
}

const campFaceMe = (dog) => {
  const dx = me.x - dog.x, dy = me.y - dog.y;
  dog.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);
};

function campDogTarget(dog) {
  const fromX = camp.inside ? campAt("door")[0] : me.x, fromY = camp.inside ? campAt("door")[1] : me.y;
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2, far = 1.5 + Math.random() * CAMP_DOG.roamFrom;
    const x = fromX + Math.cos(angle) * far, y = fromY + Math.sin(angle) * far;
    if (!campBlocked(x, y) && Math.hypot(x - campAt("fire")[0], y - campAt("fire")[1]) > CAMP_DOG.nearFire + 0.3) return [x, y];
  }
  return [dog.x, dog.y];
}

function updateCampDog(dt, now) {
  const dog = camp.dog;
  dog.clock += dt;
  dog.hop = 0;
  const stepMs = (run) => Math.floor(dog.clock / (run ? CAMP_DOG.runStepMs : CAMP_DOG.stepMs)) % 2;
  const wag = () => Math.floor(dog.clock / (dog.wagUntil > now ? 80 : 130)) % 2;
  const away = Math.hypot(me.x - dog.x, me.y - dog.y);
  dog.drinkIn -= dt;
  if (paused || camp.sleeping) {
    dog.frame = 5;
    return;
  }
  if (dog.eat > 0) {
    dog.eat -= dt;
    dog.frame = 9;
    return;
  }
  // The first time, it brings a stick of its own and asks.
  if (!camp.brought && camp.clock > CAMP_TIME.firstStickMs && dog.mode === "roam" && !camp.hand && !camp.inside) {
    camp.brought = true;
    dog.has = true;
    dog.mode = "bring";
    dog.first = true;
  }
  if (dog.mode === "fetch") {
    if (!camp.stick) dog.mode = "roam";
    else if (campDogRun(dog, camp.stick.x, camp.stick.y, CAMP_DOG.run, dt) || Math.hypot(camp.stick.x - dog.x, camp.stick.y - dog.y) < 0.35) {
      dog.route = null;
      camp.stick = null;
      dog.has = true;
      dog.mode = "bring";
    }
    dog.frame = 1 + stepMs(true);
    return;
  }
  if (dog.mode === "bring") {
    if (camp.inside) {
      dog.has = false;
      camp.stick = { x: dog.x, y: dog.y };
      dog.mode = "roam";
      return;
    }
    const toX = me.x + (dog.x > me.x ? 0.9 : -0.9), toY = me.y + (dog.y > me.y ? 0.5 : -0.5);
    // If the character stands by the fire, as near as it may go will have to do.
    const arrived = campDogRun(dog, toX, toY, CAMP_DOG.run, dt);
    if (away < 1.2 || arrived) {
      dog.route = null;
      dog.has = false;
      camp.stick = campOutOfFire(dog.x + (me.x - dog.x) * 0.4, dog.y + (me.y - dog.y) * 0.4);
      dog.mode = "roam";
      dog.wagUntil = now + 4000;
      dog.next = 1500;
      campBark();
      if (dog.first) {
        dog.first = false;
        campSay(CAMP_TEXT.play, CAMP_TEXT.playFi, "camp-play");
      }
    } else {
      dog.frame = 1 + stepMs(true);
    }
    return;
  }
  if (dog.mode === "drink" || dog.mode === "bowl") {
    if (dog.wait > 0) {
      dog.wait -= dt;
      dog.frame = 9;
      if (dog.wait <= 0) {
        if (dog.mode === "bowl") camp.bowlFull = false;
        dog.mode = "roam";
        dog.next = 800;
      }
      return;
    }
    if (campDogMove(dog, dog.target[0], dog.target[1], CAMP_DOG.walk * 1.4, dt)) {
      dog.wait = dog.mode === "bowl" ? CAMP_DOG.eatMs : CAMP_DOG.drinkMs;
      dog.facing = dog.mode === "bowl" ? 1 : 2;
      if (dog.mode === "drink") campNoise(300, 900, 0.03);
    }
    dog.frame = 1 + stepMs(false);
    return;
  }
  // With a stick in the hand it's all eagerness, a little way off, bowing and barking gently.
  if (camp.hand === "stick" && !camp.inside) {
    campFaceMe(dog);
    if (away > CAMP_DOG.keepFromHeld + 0.8) {
      campDogMove(dog, me.x, me.y, CAMP_DOG.run * 0.7, dt);
      dog.frame = 1 + stepMs(true);
      campFaceMe(dog);
      return;
    }
    const beat = Math.floor(dog.clock / 700) % 4;
    dog.frame = beat === 2 ? 8 : beat === 3 ? 10 : 3 + wag();
    dog.hop = beat === 0 ? Math.abs(Math.sin(dog.clock / 90)) * 3 : 0;
    if (now > dog.nextBark) {
      dog.nextBark = now + 1800 + Math.random() * 1600;
      campBark();
    }
    return;
  }
  if (camp.bowlFull) {
    dog.mode = "bowl";
    dog.target = [campAt("bowl")[0] - 0.7, campAt("bowl")[1] + 0.1];
    return;
  }
  if (dog.drinkIn <= 0) {
    dog.drinkIn = CAMP_DOG.drinkLeast + Math.random() * CAMP_DOG.drinkMore;
    let y = dog.y;
    while (y > 3 && tileOr(Math.floor(dog.x), Math.floor(y), "t") !== "w") y -= 0.5;
    dog.mode = "drink";
    dog.target = [dog.x, y + 1];
    return;
  }
  if (!camp.inside && away < CAMP_DOG.sitWithin) {
    // Close by, it sits and looks up, wagging.
    campFaceMe(dog);
    dog.moving = false;
    dog.target = null;
    dog.frame = 6 + wag();
    return;
  }
  if (!camp.inside && away < CAMP_DOG.lookWithin && !dog.target) {
    campFaceMe(dog);
    dog.frame = 3 + wag();
    dog.next -= dt;
    if (dog.next <= 0) {
      dog.target = campDogTarget(dog);
      dog.next = 2500 + Math.random() * 3500;
    }
    return;
  }
  if (!dog.target) {
    dog.next -= dt;
    dog.frame = 5;
    if (dog.next <= 0) dog.target = campDogTarget(dog);
    if (away > CAMP_DOG.roamFrom + 2 && !camp.inside) dog.target = campDogTarget(dog);
    return;
  }
  if (campDogMove(dog, dog.target[0], dog.target[1], away > CAMP_DOG.roamFrom + 2 ? CAMP_DOG.walk * 2 : CAMP_DOG.walk, dt)) {
    dog.target = null;
    dog.next = 1500 + Math.random() * 3000;
  }
  dog.frame = dog.moving ? 1 + stepMs(false) : 0;
}

// ------------------------------------------------------------- pictures in the scene
const campLightNow = () => {
  if (!camp) return null;
  if (camp.inside) return { x: campAt("hearth")[0], y: campAt("hearth")[1], reach: 7, strength: 0.5 };
  if (!camp.lit) return null;
  return { x: campAt("fire")[0], y: campAt("fire")[1], reach: 9 + 3 * camp.fuel, strength: 0.45 + 0.55 * camp.fuel };
};

// Lights what's near the fire on the side that faces it and darkens the other, through its own shape.
// Going through a canvas of its own for each of up to a hundred things, every frame, is too much for a phone. So what stands still
// keeps a few ready-lit pictures, by the fire's direction and strength, and only the character and the dog are lit anew each frame.
const campRimCanvas = document.createElement("canvas");
const CAMP_RIM = { turns: 8, levels: 5, buildsPerFrame: 3, mostPixels: 6000000 };
let campRimPictures = new Map(), campRimPixels = 0, campRimBuilds = 0;

function campRim(image, sx, sy, sw, sh, dx, dy, dw, dh, worldX, worldY, flip = false, live = false) {
  const light = campLightNow();
  if (!light) return;
  const away = Math.hypot(worldX - light.x, worldY - light.y);
  if (away >= light.reach) return;
  const strength = (1 - away / light.reach) ** 0.7 * light.strength * camp.flicker;
  if (strength < 0.02) return;
  const screenX = isoX(light.x, light.y) - isoX(worldX, worldY), screenY = isoY(light.x, light.y) - isoY(worldX, worldY) + dh * 0.35;
  const size = Math.hypot(screenX, screenY) || 1;
  const w = Math.ceil(dw * viewDetail), h = Math.ceil(dh * viewDetail);
  if (live || sx || sy || flip) {
    if (campRimCanvas.width < w) campRimCanvas.width = w;
    if (campRimCanvas.height < h) campRimCanvas.height = h;
    campRimPaint(campRimCanvas.getContext("2d"), image, sx, sy, sw, sh, w, h, screenX / size, screenY / size, strength, flip);
    ctx.drawImage(campRimCanvas, 0, 0, w, h, dx, dy, dw, dh);
    return;
  }
  const turn = Math.round((Math.atan2(screenY, screenX) / (Math.PI * 2)) * CAMP_RIM.turns);
  const level = Math.round((strength / camp.flicker) * CAMP_RIM.levels);
  if (!level) return;
  let pictures = campRimPictures.get(image);
  if (!pictures) campRimPictures.set(image, pictures = new Map());
  const key = turn * 100 + level;
  let lit = pictures.get(key);
  if (!lit) {
    if (campRimBuilds <= 0) return; // next frame, so that lighting the fire doesn't make them all at once
    campRimBuilds--;
    campRimPixels += w * h;
    if (campRimPixels > CAMP_RIM.mostPixels) { // enough to keep in memory: start again with what's in view
      campRimPictures = new Map([[image, pictures = new Map()]]);
      campRimPixels = w * h;
    }
    lit = document.createElement("canvas");
    lit.width = w;
    lit.height = h;
    const angle = (turn / CAMP_RIM.turns) * Math.PI * 2;
    campRimPaint(lit.getContext("2d"), image, sx, sy, sw, sh, w, h, Math.cos(angle), Math.sin(angle), level / CAMP_RIM.levels, false);
    pictures.set(key, lit);
  }
  ctx.drawImage(lit, 0, 0, w, h, dx, dy, dw, dh);
}

function campRimPaint(g, image, sx, sy, sw, sh, w, h, ux, uy, strength, flip) {
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  if (flip) {
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
    g.restore();
  } else g.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  g.globalCompositeOperation = "source-atop";
  const cx = w / 2, cy = h / 2, span = Math.max(w, h) * 0.5;
  const shade = g.createLinearGradient(cx + ux * span, cy + uy * span, cx - ux * span, cy - uy * span);
  shade.addColorStop(0, `rgba(255, 176, 84, ${Math.min(0.8, strength * 0.95)})`);
  shade.addColorStop(0.42, `rgba(255, 140, 60, ${Math.min(0.28, strength * 0.3)})`);
  shade.addColorStop(0.62, "rgba(30, 20, 40, 0)");
  shade.addColorStop(1, `rgba(12, 12, 34, ${Math.min(0.55, strength * 0.65)})`);
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
}

const campPaintModel = (image, cx, cy, worldX, worldY, lift = 0, live = false) => {
  paintImage(image, Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y - lift);
  const detail = image.detail ?? 1;
  campRim(image, 0, 0, image.width, image.height, Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y - lift, image.width / detail, image.height / detail, worldX, worldY, false, live);
};

// A long shadow thrown away from the fire.
function campFireShadow(worldX, worldY, long) {
  const light = campLightNow();
  if (!light || camp.inside) return;
  const away = Math.hypot(worldX - light.x, worldY - light.y);
  if (away < 0.6 || away > light.reach) return;
  const ux = (worldX - light.x) / away, uy = (worldY - light.y) / away;
  const fromX = isoX(worldX, worldY), fromY = isoY(worldX, worldY), far = long * (0.04 + away * 0.012);
  const toX = isoX(worldX + ux * far * 2, worldY + uy * far * 2), toY = isoY(worldX + ux * far * 2, worldY + uy * far * 2);
  ctx.fillStyle = "#0c0a1c";
  ctx.globalAlpha = 0.34 * (1 - away / light.reach) * light.strength + 0.08;
  ctx.beginPath();
  ctx.moveTo(fromX - uy * 5, fromY + ux * 2.5);
  ctx.lineTo(fromX + uy * 5, fromY - ux * 2.5);
  ctx.lineTo(toX + uy * 7, toY - ux * 3.5);
  ctx.lineTo(toX - uy * 7, toY + ux * 3.5);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function campPaintFlames(now) {
  const [x, y] = campAt("fire");
  const baseX = isoX(x, y), baseY = isoY(x, y) - 10;
  const tongues = 13;
  for (let i = 0; i < tongues; i++) {
    const across = i / (tongues - 1) - 0.5;
    const swell = 1 - (Math.abs(across) * 1.75) ** 2;
    // Tall in the middle and licking up in separate tongues, all leaning a little with the air.
    const height = (10 + 26 * camp.fuel) * swell * (0.62 + 0.26 * Math.sin(now / 110 + i * 2.1) + 0.14 * Math.sin(now / 43 + i * 3.7));
    const px = baseX + across * 19, py = baseY + across * 5 + (i % 2) * 1.5;
    for (let s = 0; s < height; s += 0.5) {
      const up = s / height;
      const lean = (Math.sin(now / 170 + s * 0.28 + i * 0.7) * 2 + Math.sin(now / 900) * 2 - 1.5) * up;
      const half = (1 - up) ** 0.8 * (1.3 + swell * 1.3);
      ctx.fillStyle = up < 0.22 ? "#fff6c4" : up < 0.45 ? "#ffd65a" : up < 0.74 ? "#ff9430" : "#e24a1c";
      ctx.fillRect(px + lean - half, py - s, half * 2, 0.5);
    }
  }
}

function campPaintKettleFire(now) {
  const kettle = camp.kettle;
  if (!kettle) return;
  const [x, y] = campAt("kettle");
  campPaintModel(modelImage("kettle", 0, 0), isoX(x, y), isoY(x, y), x, y);
}

// Everything the camp adds to the scene, each put in its place by depth.
function campScene(scene, now, seen) {
  if (!camp) return;
  campRimBuilds = CAMP_RIM.buildsPerFrame;
  const push = (x, y, paint, extra = 0) => {
    if (seen(isoX(x, y), isoY(x, y), 150)) scene.push({ d: x + y + extra, paint });
  };
  const model = (sprite, x, y, frame = 0, colour, extra = 0) => push(x, y, () => campPaintModel(modelImage(sprite, 0, frame, 0, colour), isoX(x, y), isoY(x, y), x, y), extra);
  const [lx, ly] = campAt("lavvu");
  const behind = me.x + me.y < lx + ly && Math.abs(isoX(me.x, me.y) - isoX(lx, ly)) < 44 && !camp.inside;
  push(lx, ly, () => {
    const image = campLavvuImage(), wide = image.width / image.detail, high = image.height / image.detail;
    const cx = Math.round(isoX(lx, ly)) - MODEL_ANCHOR.x * 2, cy = Math.round(isoY(lx, ly)) - MODEL_ANCHOR.y * 2;
    if (behind) ctx.globalAlpha = 0.55;
    ctx.drawImage(image, cx, cy, wide, high);
    if (!behind) campRim(image, 0, 0, image.width, image.height, cx, cy, wide, high, lx + 1.6, ly + 1.6);
    ctx.globalAlpha = 1;
  });
  // The tree stands, falls, and lies.
  const [tx, ty] = campAt("tree");
  if (camp.felled) {
    model("stump", tx, ty);
    if (camp.saws < CAMP_TIME.saws) model("felledbirch", tx + 0.2, ty + 0.1);
  } else if (camp.fallAt !== null) {
    const along = Math.min(1, (now - camp.fallAt) / CAMP_TIME.fallMs);
    push(tx, ty, () => {
      const image = modelImage("birch", 0, 1);
      ctx.save();
      ctx.translate(Math.round(isoX(tx, ty)), Math.round(isoY(tx, ty)));
      ctx.rotate(along * along * 2.02);
      ctx.drawImage(image, -MODEL_ANCHOR.x, -MODEL_ANCHOR.y, image.width / image.detail, image.height / image.detail);
      ctx.restore();
    });
  } else model("birch", tx, ty, camp.chops ? 1 : 0);
  // The block, with the tools by it.
  const [bx, by] = campAt("block");
  model("stump", bx, by);
  if (camp.hand !== "axe" && camp.stage !== "fell") push(bx, by, () => campPaintHeldAt("axe", isoX(bx, by) + 1, isoY(bx, by) - 15, 0.4), 0.01);
  if (camp.hand !== "saw" && (camp.stage === "axe" || camp.stage === "fell" || camp.stage === "saw")) push(bx + 0.7, by + 0.2, () => campPaintHeldAt("saw", isoX(bx + 0.7, by + 0.2), isoY(bx + 0.7, by + 0.2) - 8, 0.15));
  // The logs where they were sawn, until they've been carried off.
  const [gx, gy] = campAt("logs");
  if (camp.saws >= CAMP_TIME.saws) for (let i = camp.logsMoved + (camp.hand === "longlog" ? 1 : 0); i < CAMP_TIME.logs; i++) model("longlog", gx, gy + i * 0.5);
  // The logs by the block until they're split, with the one being split on top of it.
  const logsLeft = camp.logsMoved - Math.floor(camp.splits / CAMP_TIME.splitsPerLog);
  if (camp.stage === "carry" || camp.stage === "split") {
    for (let i = 1; i < logsLeft; i++) model("longlog", bx + 1.2, by - 0.4 + i * 0.5);
    if (logsLeft > 0) push(bx, by, () => campPaintModel(modelImage("longlog", 0, 0), isoX(bx, by), isoY(bx, by), bx, by, 10), 0.02);
  }
  // The fire, as it's built.
  const [fx, fy] = campAt("fire");
  const fireFrame = camp.lit ? 4 : camp.stage === "light" ? 3 : camp.stacked ? (camp.stacked > CAMP_TIME.logs ? 2 : 1) : camp.stage === "branches" || camp.stage === "kindle" ? 2 : 5;
  push(fx, fy, () => paintImage(campFireImage(fireFrame), Math.round(isoX(fx, fy)) - MODEL_ANCHOR.x, Math.round(isoY(fx, fy)) - MODEL_ANCHOR.y)); // it lights itself
  if (camp.lit) push(fx, fy, () => campPaintFlames(now), 0.02);
  if (camp.kettle) push(...campAt("kettle"), () => campPaintKettleFire(now));
  for (const branch of camp.branches) model("stick", branch.x, branch.y);
  for (const billet of camp.billets) model("billet", billet.x, billet.y);
  if (camp.stick) model("stick", camp.stick.x, camp.stick.y);
  if (camp.flight) {
    const along = Math.min(1, (now - camp.flight.born) / camp.flight.ms);
    const x = camp.flight.fromX + (camp.flight.x - camp.flight.fromX) * along, y = camp.flight.fromY + (camp.flight.y - camp.flight.fromY) * along;
    push(x, y, () => paintImage(modelImage("stick", (Math.floor(now / 70) % 4), 0), Math.round(isoX(x, y)) - MODEL_ANCHOR.x, Math.round(isoY(x, y)) - MODEL_ANCHOR.y - Math.round(Math.sin(along * Math.PI) * 22) - 8));
  }
  model("backpack", ...campAt("backpack"));
  model("bowl", ...campAt("bowl"), camp.bowlFull ? 1 : 0);
  // The dog.
  const dog = camp.dog;
  if (!camp.inside) push(dog.x, dog.y, () => {
    const cx = isoX(dog.x, dog.y), cy = isoY(dog.x, dog.y);
    ctx.fillStyle = SHADOW;
    ctx.globalAlpha = 0.3;
    castShadow(ctx, Math.round(cx) - 3, Math.round(cy) + 1, 16, 6);
    ctx.globalAlpha = 1;
    campFireShadow(dog.x, dog.y, 14);
    campPaintModel(modelImage("laphund", dog.facing, dog.frame, dog.facing, dog.has ? "stick" : undefined), cx, cy, dog.x, dog.y, Math.round(dog.hop), true);
  });
  // Inside: the hearth, the pad and the bag, and whoever is asleep in it.
  model("hearth", ...campAt("hearth"));
  const [ix, iy] = campAt("bed");
  model("sleepingpad", ix, iy, 0, undefined, -0.4);
  model("sleepingbag", ix, iy, camp.sleeping ? 1 : 0, HAIR_SWATCHES[look.hair], -0.2);
  // The canvas rising from the back walls to the smoke opening, behind everything else inside.
  if (camp.inside) scene.push({ d: -1, paint: () => campPaintCone() });
  if (helpRound && camp.inside) {
    const [dx, dy] = campAt("inDoor");
    push(dx, dy, () => {
      ctx.fillStyle = "#ffd25a";
      const cx = isoX(dx, dy), cy = isoY(dx, dy) - 26 + Math.sin(now / 180) * 2;
      for (let row = 0; row < 5; row++) ctx.fillRect(cx - 5 + row, cy + row, 11 - row * 2, 1);
    }, 100);
  }
  // The arrow at what's next, when help is on.
  if (helpRound && !camp.inside && CAMP_STAGES[camp.stage]) {
    const at = campStageAt();
    if (at) push(at[0], at[1], () => {
      ctx.fillStyle = "#ffd25a";
      const cx = isoX(at[0], at[1]), cy = isoY(at[0], at[1]) - (camp.stage === "fell" ? 62 : 22) + Math.sin(now / 180) * 2;
      for (let row = 0; row < 5; row++) ctx.fillRect(cx - 5 + row, cy + row, 11 - row * 2, 1);
    }, 100);
  }
}

const CAMP_WALL = 30, CAMP_PEAK = 175;
const campConePoints = () => {
  const [x0, y0, x1, y1] = CAMP_ROOM;
  const at = (x, y, up) => [isoX(x, y), isoY(x, y) - up];
  return { back: at(x0, y0, CAMP_WALL), left: at(x0, y1, CAMP_WALL), right: at(x1, y0, CAMP_WALL), front: at(x1, y1, 0), peak: at((x0 + x1) / 2, (y0 + y1) / 2, CAMP_PEAK) };
};

function campPaintCone() {
  const { back, left, right, peak } = campConePoints();
  const face = (a, b, colour) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(...peak);
    ctx.fill();
  };
  face(left, back, "#c9bb9a");
  face(back, right, "#ad9f80");
  // The poles, leaning in to the opening at the top, with the sky showing through it.
  ctx.strokeStyle = "#5c4430";
  ctx.lineWidth = 1;
  for (let along = 0; along <= 4; along++) for (const [a, b] of [[left, back], [back, right]]) {
    ctx.beginPath();
    ctx.moveTo(a[0] + (b[0] - a[0]) * (along / 4), a[1] + (b[1] - a[1]) * (along / 4));
    ctx.lineTo(...peak);
    ctx.stroke();
  }
  ctx.fillStyle = "#1a2348";
  ctx.beginPath();
  ctx.ellipse(peak[0], peak[1] + 3, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function campStageAt() {
  const name = CAMP_STAGES[camp.stage].at;
  if (name === "logs" && camp.hand === "longlog") return campAt("block");
  if (name) return campAt(name);
  if (camp.stage === "stack") {
    if (camp.hand === "billet") return campAt("fire");
    return camp.billets[0] ? [camp.billets[0].x, camp.billets[0].y] : null;
  }
  return camp.stage === "branches" && camp.branches[0] ? [camp.branches[0].x, camp.branches[0].y] : null;
}

const campHeldPictures = new Map();
function campHeldPicture(hand) {
  if (!campHeldPictures.has(hand)) {
    const [sprite, frame] = CAMP_HELD[hand];
    campHeldPictures.set(hand, croppedImage(makeModelImage(sprite, 0, frame, 0, undefined, 2)));
  }
  return campHeldPictures.get(hand);
}

function campPaintHeldAt(hand, x, y, turn = 0, flip = false) {
  const [, , size] = CAMP_HELD[hand];
  const image = campHeldPicture(hand), wide = (image.width / image.detail) * size, high = (image.height / image.detail) * size;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(turn);
  ctx.drawImage(image, -wide / 2, -high * 0.8, wide, high);
  ctx.restore();
}

// Called as the character is drawn: what's in the hands, and in work where the hands are in that frame.
function campPaintHeld(cx, cy, now, flip) {
  if (!camp) return;
  const hand = camp.hand;
  const hold = action && CAMP_HOLD[action.name];
  if (hold) {
    const place = hold[Math.min(5, Math.floor(((now - action.start) / ACTIONS[action.name].ms) * 6))];
    const tool = action.name === "throw" ? "stick" : action.name === "chop" ? "axe" : "saw";
    if (place) campPaintHeldAt(tool, cx + (flip ? -place[0] : place[0]), cy + place[1], flip ? -place[2] : place[2]);
    return;
  }
  if (camp.roast) {
    // Held out over the fire, with the fat dripping and the smoke of it.
    const toLeft = isoX(campAt("fire")[0], campAt("fire")[1]) < isoX(me.x, me.y);
    campPaintHeldAt(camp.roast.kind, cx + (toLeft ? -9 : 9), cy - 10, 0.1, toLeft);
    return;
  }
  if (!hand) return;
  const [dx, dy] = CARRIED[me.facing] ?? [8, -8];
  const swing = Math.round(Math.sin(walkClock / 90) * (me.moving ? 1 : 0));
  campPaintHeldAt(hand, cx + dx, cy + dy + 2 + swing, dx < 0 ? -0.1 : 0.1, dx < 0);
}

// Over the finished scene: smoke and sparks, then the evening's dark with the fire's light taken out of it.
const campNightCanvas = document.createElement("canvas");
function paintCampNight(now, camX, camY) {
  if (!camp) return;
  for (const part of camp.smoke) {
    const age = (now - part.born) / part.life;
    const x = isoX(part.x, part.y) + (now - part.born) * part.drift + Math.sin(now / 900 + part.born) * age * 6, y = isoY(part.x, part.y) - part.high - age * (part.steam ? 16 : 62);
    const size = (part.steam ? 1.2 : 2) + age * (part.steam ? 3 : 9);
    ctx.fillStyle = part.steam ? `rgba(238, 240, 245, ${0.5 * (1 - age)})` : `rgba(170, 170, 182, ${0.26 * (1 - age) * Math.min(1, age * 5)})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size * 0.8);
  }
  for (const part of camp.embers) {
    const since = now - part.born, age = since / part.life;
    ctx.fillStyle = age < 0.5 ? "#ffd65a" : "#ff7a2a";
    ctx.fillRect(isoX(part.x, part.y) + since * part.drift, isoY(part.x, part.y) - 18 - since * part.rise, 0.5, 0.5);
  }
  for (const part of camp.chips) {
    const since = now - part.born;
    ctx.fillStyle = part.colour;
    ctx.fillRect(isoX(part.x, part.y) + since * part.dx, isoY(part.x, part.y) - 12 - since * part.up + since * since * 0.00018, 1, 1);
  }
  const w = VIEW_W * viewDetail, h = VIEW_H * viewDetail;
  if (campNightCanvas.width !== w) {
    campNightCanvas.width = w;
    campNightCanvas.height = h;
  }
  const g = campNightCanvas.getContext("2d");
  const dark = camp.inside ? 0.6 : camp.dark;
  // From a low orange sun to deep blue night.
  const mix = (a, b) => Math.round(a + (b - a) * dark);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, w, h);
  g.fillStyle = camp.inside ? "rgba(26, 18, 40, 0.42)" : `rgba(${mix(214, 12)}, ${mix(104, 16)}, ${mix(58, 50)}, ${0.2 + 0.62 * dark})`;
  g.fillRect(0, 0, w, h);
  const light = campLightNow();
  const lightX = light ? (isoX(light.x, light.y) - camX) * viewDetail : 0, lightY = light ? (isoY(light.x, light.y) - 4 - camY) * viewDetail : 0;
  const glow = light ? light.reach * 15 * camp.flicker * viewDetail : 0;
  if (light) {
    g.globalCompositeOperation = "destination-out";
    g.save();
    g.translate(lightX, lightY);
    g.scale(1, 0.62);
    const hole = g.createRadialGradient(0, 0, glow * 0.05, 0, 0, glow);
    hole.addColorStop(0, "rgba(0, 0, 0, 1)");
    hole.addColorStop(0.42, "rgba(0, 0, 0, 0.82)");
    hole.addColorStop(0.75, "rgba(0, 0, 0, 0.3)");
    hole.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = hole;
    g.fillRect(-glow, -glow, glow * 2, glow * 2);
    g.restore();
  }
  ctx.drawImage(campNightCanvas, camX, camY, VIEW_W, VIEW_H);
  if (light) {
    // And the warmth of it on the ground.
    ctx.save();
    ctx.translate(lightX / viewDetail + camX, lightY / viewDetail + camY);
    ctx.scale(1, 0.62);
    ctx.globalCompositeOperation = "lighter";
    const reach = glow / viewDetail * 0.8;
    const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    warm.addColorStop(0, `rgba(255, 150, 60, ${0.3 * light.strength})`);
    warm.addColorStop(0.5, `rgba(255, 110, 40, ${0.12 * light.strength})`);
    warm.addColorStop(1, "rgba(255, 90, 30, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
    ctx.restore();
    if (camp.lit && !camp.inside) {
      // The heart of the fire stays bright through the dark.
      ctx.save();
      ctx.globalAlpha = 0.55;
      campPaintFlames(now);
      ctx.restore();
    }
  }
  // Each side's other half is out of sight.
  ctx.fillStyle = camp.inside ? "#0b090e" : "#0d1a1c";
  ctx.beginPath();
  if (camp.inside) {
    const { left, right, front, peak } = campConePoints();
    ctx.rect(camX - 2, camY - 2, VIEW_W + 4, VIEW_H + 4);
    ctx.moveTo(...left);
    ctx.lineTo(...front);
    ctx.lineTo(...right);
    ctx.lineTo(...peak);
    ctx.closePath();
    ctx.fill("evenodd");
  } else {
    ctx.moveTo(isoX(30, 0), isoY(30, 0) - 50);
    ctx.lineTo(isoX(46, 0), isoY(46, 0) - 50);
    ctx.lineTo(isoX(46, 32), isoY(46, 32) + 60);
    ctx.lineTo(isoX(30, 32), isoY(30, 32) + 60);
    ctx.closePath();
    ctx.fill();
  }
  if (camp.fade) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.min(1, (now - camp.fade) / 500)})`;
    ctx.fillRect(camX, camY, VIEW_W, VIEW_H);
  }
  if (camp.sleeping) {
    ctx.fillStyle = `rgba(4, 4, 14, ${Math.min(1, (now - camp.sleeping) / CAMP_TIME.sleepMs)})`;
    ctx.fillRect(camX, camY, VIEW_W, VIEW_H);
  }
}

// The floor inside: a bed of birch twigs under reindeer skins, for the user to check.
const campFloorPixel = (wx, wy) => {
  const n = noise(Math.floor(wx / 2), Math.floor(wy / 2));
  return n > 0.82 ? "#6e5a38" : n > 0.5 ? "#8a7448" : n > 0.2 ? "#a08a58" : "#5e7a3e";
};
