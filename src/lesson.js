// A lesson in the small classroom. The character sits at a desk and can't get up. The teacher writes a number in Sámi on the board, and
// whoever knows it raises a hand: E, and then the number goes into a keypad like the shop's. Left too long, a classmate answers instead.
const LESSON = { rounds: 8, teacherAt: [12.3, 3.3], myChair: 4, firstMs: 2200, writeMsPerLetter: 120, writeLeastMs: 900, nextMs: 800, wipeMs: 450, handMs: 1100, longestWord: 30, speakUpAfterMs: 20000, speakUpSaysMs: 3600, swingLeastMs: 10000, swingMoreMs: 20000, swingForMs: 1600, bubbleLingerMs: 1500, bubbleReadMsPerLetter: 55, bubbleWide: 130, walk: 0.0035, boardFrom: 3.4, boardTo: 11 };
const LESSON_TEACHERS = ["teacher", "teacher_blue", "teacher_red"];
// Each classmate's voice: one of the two characters' lines, played higher.
const LESSON_VOICES = { classmate_gakti: ["biret", 1.14], classmate_gakti_two: ["biret", 1.2], classmate_fleece: ["mahtte", 1.2], classmate_anorak: ["mahtte", 1.14], classmate_wool: ["biret", 1.25], classmate_parka: ["mahtte", 1.28] };
const LESSON_TOUCH = matchMedia("(hover: none) and (pointer: coarse)").matches;
// The Sámi keyboard layout, after a picture from the user that they think is Divvun's. The keys for punctuation give way to ⌫ and OK.
const LESSON_KEY_ROWS = ["ášertyuiopåŋ", "asdfghjkløæđ", "žzčcvbnm"].map((row) => [...row]);
// Classmates' names, chosen anew each round to go with who they are: all listed as such in the dictionary, and for the user to check.
const LESSON_NAMES = {
  biret: ["Máret", "Elle", "Ánne", "Inga", "Márjá", "Sárá", "Rávdná", "Risten", "Áile", "Gáddjá"],
  mahtte: ["Niillas", "Issát", "Heaika", "Ánte", "Jovnna", "Áilu", "Mihkkal", "Ásllat", "Nillá", "Juhán"],
};
const lessonNameFile = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const LESSON_CLASSMATES = ["classmate_anorak", "classmate_wool", "classmate_parka", "classmate_fleece"];
const LESSON_TEXT = {
  guide: "Istut omalla paikallasi, etkä voi nousta. Opettaja kirjoittaa taululle luvun saameksi. Kun tiedät sen, viittaa painamalla E tai Viittaa-painiketta ja näppäile luku numeroina. Jos odotat liian kauan, luokkatoveri vastaa ensin.",
  guideAudio: "Istut omalla paikallasi, etkä voi nousta. Opettaja sanoo luvun saameksi. Kun tiedät sen, viittaa painamalla E tai Viittaa-painiketta ja näppäile luku numeroina. Jos odotat liian kauan, luokkatoveri vastaa ensin.",
  guideWords: "Istut omalla paikallasi, etkä voi nousta. Opettaja kirjoittaa taululle luvun numeroina. Kun tiedät sen, viittaa painamalla E tai Viittaa-painiketta ja kirjoita luku sanana saameksi. Saat kirjoittaa rauhassa: kukaan muu ei vastaa sillä aikaa.",
  raise: "Viittaa",
  promptWords: "Kirjoita taulun luku saameksi",
  prompt: "Mikä luku taululla on?",
  promptAudio: "Mikä luku se on?",
  start: "Katso taulua. Kun tiedät luvun, viittaa.",
  notYet: "Ei vielä. Katso taulua ja yritä uudelleen.",
  beaten: (name, word, number) => `${escapeText(name)} ehti ensin: <span lang="${SAMI_LANG}">${escapeText(word)}</span> = ${number}.`,
  right: (word, number) => `<span class="word" lang="${SAMI_LANG}">${escapeText(word)}</span> <span class="translation">= ${number}</span>`,
  close: "Sulje",
  wrongWord: "Ei ihan. Korjaa ja yritä uudelleen.",
  speechSe: (on) => `Saamenkielinen teksti: ${on ? "päällä" : "pois"}`,
  speechFi: (on) => `Suomenkielinen teksti: ${on ? "päällä" : "pois"}`,
};
// What's said aloud, in writing: Sámi and Finnish. The same as the lines in tools/fetch_voices.py.
const LESSON_SPEECH = {
  hello: ["Bures, mánát!", "Hei, lapset!"],
  wrong: ["Ii dat lean.", "Ei se ollut."],
  end: ["Giitu, mánát!", "Kiitos, lapset!"],
  whichDigit: ["Mii nummir dát lea?", "Mikä numero tämä on?"],
  whichNumber: ["Mii lohku dát lea?", "Mikä luku tämä on?"],
  answer: (number) => [`Dát lea ${window.MAHTTE_NUMBERS[number]}. Leago nu?`, `Tämä on ${number}. Onko niin?`],
  praise: ([say, sayFi], number, name) => [`${say} Dát lea ${window.MAHTTE_NUMBERS[number]}. Buorre, ${name}!`, `${sayFi} Tämä on ${number}. Hyvä, ${name}!`],
};
if (LANG === "nb") {
  Object.assign(LESSON_TEXT, LESSON_TEXT_NB);
  for (const [key, nb] of Object.entries(LESSON_SPEECH_NB)) {
    const sme = LESSON_SPEECH[key];
    LESSON_SPEECH[key] = typeof sme === "function" ? (...args) => [sme(...args)[0], nb(...args)] : [sme[0], nb];
  }
}
// Things in the room, by x and y; the last is how high they stand, for one on a desk.
const LESSON_PLANTS = [["lesson_plant", 2.7, 2.7], ["lesson_plant", 2.7, 11.1], ["flower", 13.2, 2.8], ["flower", 5, 4.6]];

// The pens on the board's tray, in the colours of the Sámi flag. What each writes is a little deeper where the true colour wouldn't show on
// white: yellow writes as dark gold with a thin edge.
const LESSON_PENS = [
  { body: "#dc241f", ink: "#c81e18" },
  { body: "#0035ad", ink: "#0035ad" },
  { body: "#007229", ink: "#007229" },
  { body: "#ffce00", ink: "#b87a00", edge: "rgba(84, 50, 0, 0.6)" },
];
const LESSON_BACKPACKS = 10; // to choose from each round, from tools/make_animals.py
const LESSON_BOARD_DEPTH = 0; // after the walls, which are behind everything, and before all in the room
let lesson = null;

function setupLesson() {
  const now = performance.now();
  const looks = shuffled(["classmate_gakti", "classmate_gakti_two", ...shuffled(LESSON_CLASSMATES).slice(0, 3)]);
  lesson = {
    pen: Math.floor(Math.random() * LESSON_PENS.length), backpacks: shuffled(Array.from({ length: LESSON_BACKPACKS }, (_, i) => i)), people: [], teacher: LESSON_TEACHERS[Math.floor(Math.random() * LESSON_TEACHERS.length)], teacherX: LESSON.teacherAt[0], teacherY: LESSON.teacherAt[1],
    numbers: shuffled(Array.from({ length: theme.most + 1 }, (_, number) => number)), current: null, wipeAt: null, wiped: null, nextAt: Infinity, typed: "", typing: false, handUntil: 0, handAt: 0, started: false, ended: false, bubbles: [],
  };
  objects = [];
  const names = { biret: shuffled(LESSON_NAMES.biret), mahtte: shuffled(LESSON_NAMES.mahtte) };
  chairs.forEach((chair, index) => {
    const look = index === LESSON.myChair ? null : looks.pop();
    lesson.people.push({ chair, me: !look, handUntil: 0, handAt: 0, look, name: look ? names[LESSON_VOICES[look][0]].pop() : null });
  });
  sitOn(chairs[LESSON.myChair], now);
  placeCamera();
  roundSize = LESSON.rounds;
  stars = 0;
  targets = [];
  document.fonts?.load('16px "Satnematki Hand"', "čđŋšŧž");
  showPrompt();
  showGuideBox(LESSON_TEXT.start);
}

const lessonSay = (...lines) => playVoice(...lines);
// One person's turn to speak: who, what it says in writing, and the lines that say it.
const lessonTurn = (who, [se, fi], ...lines) => ({ who, se, fi, lines });
// Says the turns one after another. Each one's bubble comes up with its first line and lasts until that person has finished.
function lessonSpeak(...turns) {
  const shown = [];
  const speech = playVoice(...turns.flatMap((turn) => turn.lines.map((line, i) => (i ? line : { src: line.src ?? line, rate: line.rate, onStart: () => shown.push(lessonShowBubble(turn)) }))));
  speech.then(() => shown.forEach(lessonReleaseBubble));
  return speech;
}
const lessonMyLine = (name) => `audio/${name}-${VOICES[look.gender]}.mp3`;
// One of the teacher's praises, then "Dát lea" and the number by itself, and "Buorre" with the name of whoever answered.
// Two of the praises are left out here, as they would say "buorre" twice.
const LESSON_PRAISES = [0, 1, 4, 5, 6, 7, 8, 9, 10, 11];
function lessonPraise(number, name) {
  const praise = LESSON_PRAISES[Math.floor(Math.random() * LESSON_PRAISES.length)];
  // Her lines leave out "Gávdnet dan!", so they count without it.
  return lessonTurn("teacher", LESSON_SPEECH.praise(TEXT.right.filter(([say]) => say !== "Gávdnet dan!")[praise], number, name), `audio/teacher-praise-${praise}.mp3`, "audio/teacher-it-is.mp3", `audio/teacher-number-${number}.mp3`, `audio/teacher-good-${lessonNameFile(name)}.mp3`);
}

// After the rules have been read.
function lessonBegin() {
  const now = performance.now();
  lesson.started = true;
  lesson.nextAt = now + LESSON.firstMs;
  timer.running = true;
  lessonSpeak(lessonTurn("teacher", LESSON_SPEECH.hello, "audio/teacher-hello.mp3"));
  showPrompt();
}

// She goes to the board and writes the next number.
function lessonWrite(now) {
  // When the classmates have answered all of them, the numbers start again, shuffled, but not with the one just done.
  if (!lesson.numbers.length) lesson.numbers = shuffled(Array.from({ length: theme.most + 1 }, (_, n) => n)).filter((n) => n !== lesson.current?.number);
  const number = lesson.numbers.pop();
  const word = window.MAHTTE_NUMBERS[number];
  // Which way round: the word on the board and the number to type, or at the hard level the number on the board and the word to write.
  const shown = theme.inWords ? String(number) : word;
  lesson.current = { number, word, shown, at: now, until: now + Math.max(LESSON.writeLeastMs, shown.length * LESSON.writeMsPerLetter), asked: false, waitFrom: null };
  lesson.typed = "";
  lesson.nextAt = Infinity;
  lessonSay(); // whatever was still being said is over
}

function updateLesson(dt, now) {
  if (!lesson) return;
  document.getElementById("pad").classList.toggle("typing", lesson.typing); // the keys are there, so the button needn't be
  lessonMoveTeacher(dt, now);
  lessonSwingLegs(now);
  if (!lesson.started || lesson.ended || paused) return;
  const current = lesson.current;
  if (!current) {
    if (now >= lesson.nextAt) lessonWrite(now);
    return;
  }
  if (!current.asked && now >= current.until) {
    current.asked = true;
    current.waitFrom = now;
    const question = `audio/teacher-which-${current.number < 10 ? "digit" : "number"}.mp3`;
    // The question only, never the number: that would give the answer away.
    if (!lesson.typing && !current.answered) lessonSpeak(lessonTurn("teacher", current.number < 10 ? LESSON_SPEECH.whichDigit : LESSON_SPEECH.whichNumber, ...(audioOnly ? [`audio/teacher-number-${current.number}.mp3`] : []), question));
  }
  // Left too long, a classmate gets there first.
  if (current.asked && !current.answered && !lesson.typing && now - current.waitFrom >= LESSON.speakUpAfterMs) lessonSpeakUp(now);
}

// Now and then one of the children, whoever isn't busy, swings their legs for a moment.
function lessonSwingLegs(now) {
  if (now < (lesson.nextSwingAt ??= now + LESSON.swingLeastMs * Math.random())) return;
  lesson.nextSwingAt = now + LESSON.swingLeastMs + Math.random() * LESSON.swingMoreMs;
  const idle = lesson.people.filter((person) => !(person.me ? lesson.handAt && now < lesson.handUntil : now < person.handUntil));
  const person = idle[Math.floor(Math.random() * idle.length)];
  if (person) person.swingUntil = now + LESSON.swingForMs;
}

// The teacher follows her writing along the board, and then steps aside so that it can be read.
function lessonMoveTeacher(dt, now) {
  const current = lesson.current;
  const writing = current && !current.asked && !current.answered && now < current.until;
  const [from, to] = lesson.writtenFrom ?? [LESSON.boardFrom + 0.8, LESSON.boardTo - 0.4];
  // The writing waits until she's at the board to write it.
  if (writing && !current.reached) {
    if (Math.hypot(from - lesson.teacherX, 2.7 - lesson.teacherY) < 0.3) current.reached = true;
    else {
      current.at += dt;
      current.until += dt;
    }
  }
  const along = writing && current.reached ? (now - current.at) / (current.until - current.at) : 0;
  const toX = writing ? from + along * (to - from) : LESSON.teacherAt[0];
  const toY = writing ? 2.7 : LESSON.teacherAt[1];
  const dx = toX - lesson.teacherX, dy = toY - lesson.teacherY, away = Math.hypot(dx, dy);
  // Following her own writing she only edges along, still facing the board with the pen; further than that she walks.
  const edging = writing && away < 0.6 && Math.abs(dy) < 0.2;
  lesson.teacherMoving = away > 0.08 && !edging;
  if (away > 0.08) {
    const step = Math.min(away, LESSON.walk * dt);
    lesson.teacherX += (dx / away) * step;
    lesson.teacherY += (dy / away) * step;
  }
  if (lesson.teacherMoving) lesson.teacherFacing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);
  else lesson.teacherFacing = writing ? 2 : 0;
}

function lessonNote(html) {
  cardEl.className = "";
  cardEl.innerHTML = `<div class="note">${html}</div>`;
}

// The number has been said, one way or another: the board is wiped and the next one comes.
function lessonNext(speech) {
  const number = lesson.current.number;
  lesson.current.answered = true;
  speech.then(() => {
    if (!lesson || lesson.ended) return;
    lesson.wiped = { word: lesson.current?.shown, at: performance.now() };
    lesson.current = null;
    lesson.nextAt = performance.now() + LESSON.nextMs;
  });
  return number;
}

function lessonSpeakUp(now) {
  const others = lesson.people.filter((person) => !person.me);
  const helper = others[Math.floor(Math.random() * others.length)];
  const [voiceName, rate] = LESSON_VOICES[helper.look];
  const { number, word } = lesson.current;
  helper.handAt = now;
  helper.handUntil = now + LESSON.speakUpSaysMs;
  helper.swingUntil = 0;
  if (!audioOnly) lessonNote(LESSON_TEXT.beaten(helper.name, word, number));
  lessonNext(lessonSpeak(
    lessonTurn(helper, LESSON_SPEECH.answer(number), { src: `audio/number-${number}-${voiceName}.mp3`, rate }, { src: `audio/is-it-so-${voiceName}.mp3`, rate }),
    lessonPraise(number, helper.name),
  ));
}

// E, or the on-screen button: up goes the hand, and the keypad opens.
function lessonRaise(now) {
  if (!lesson?.started || lesson.ended || paused || lesson.typing || !lesson.current || lesson.current.answered || now < (me.heldUntil ?? 0)) return;
  lesson.handAt = now;
  lesson.handUntil = Infinity;
  lesson.typing = true;
  if (!theme.inWords) lesson.typed = ""; // a long word needn't be written again from the start
  playImpact("brush");
  lessonSay();
  lessonKeypad();
}

function lessonKeypad(note = "") {
  const button = (key) => `<button data-key="${key}">${key}</button>`;
  const keys = theme.inWords
    ? LESSON_KEY_ROWS.map((row, i) => `<div class="key-row">${[...row, ...(i === LESSON_KEY_ROWS.length - 1 ? ["⌫", "OK"] : [])].map(button).join("")}</div>`).join("")
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].map(button).join("");
  cardEl.className = `keypad${theme.inWords ? " letters" : ""}`;
  // The word goes in a real text field, so that whatever the player's own keyboard can write comes through, accents and all. On a
  // touch screen it's only for show, as the keys below are there and the phone's own keyboard would cover the board.
  cardEl.innerHTML = `${theme.inWords ? `<input class="sum" lang="${SAMI_LANG}" maxlength="${LESSON.longestWord}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${LESSON_TEXT.promptWords}" ${LESSON_TOUCH ? "readonly" : ""}>` : `<div class="sum">${escapeText(lesson.typed) || "&nbsp;"}</div>`}
    <div class="note">${escapeText(note)}</div>
    <div class="keys">${keys}</div>
    <button id="lesson-close">${LESSON_TEXT.close}</button>`;
  cardEl.querySelectorAll("[data-key]").forEach((button) => button.addEventListener("click", () => {
    button.blur();
    lessonTypeKey(button.dataset.key);
  }));
  cardEl.querySelector("#lesson-close").addEventListener("click", lessonCloseKeypad);
  const field = cardEl.querySelector("input.sum");
  if (!field) return;
  field.value = lesson.typed;
  field.addEventListener("input", (event) => {
    if (event.isComposing) return; // a letter still being put together, such as an accent waiting for its vowel
    field.value = field.value.toLowerCase().replace(/[^\p{L}]/gu, "");
    lesson.typed = field.value;
  });
  field.addEventListener("compositionend", () => field.dispatchEvent(new Event("input")));
  if (!LESSON_TOUCH) {
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }
}

function lessonCloseKeypad() {
  lesson.typing = false;
  lesson.handUntil = performance.now() + 150;
  if (lesson.current?.waitFrom) lesson.current.waitFrom = performance.now();
  cardEl.className = "";
  cardEl.innerHTML = "";
}

function lessonTypeKey(key) {
  if (!lesson?.typing) return;
  if (key === "OK") return lessonConfirm();
  if (key === "⌫") lesson.typed = lesson.typed.slice(0, -1);
  else if (lesson.typed.length < (theme.inWords ? LESSON.longestWord : 3)) lesson.typed += key;
  lessonKeypad();
}

function lessonConfirm() {
  if (!lesson.typed) return;
  const now = performance.now(), { number, word } = lesson.current;
  const right = theme.inWords ? lesson.typed === word : Number(lesson.typed) === number;
  // A misspelt word stays open to be put right, and the classmates still wait.
  if (!right && theme.inWords) {
    lessonKeypad(LESSON_TEXT.wrongWord);
    lessonSpeak(lessonTurn("teacher", LESSON_SPEECH.wrong, "audio/teacher-wrong.mp3"));
    return;
  }
  lesson.typing = false;
  lesson.handUntil = now + LESSON.handMs;
  if (!right) {
    me.heldUntil = now + WRONG_HOLD_MS;
    if (lesson.current.waitFrom) lesson.current.waitFrom = now;
    lessonNote(LESSON_TEXT.notYet);
    lessonSpeak(lessonTurn("teacher", LESSON_SPEECH.wrong, "audio/teacher-wrong.mp3"));
    return;
  }
  stars++;
  heardWords.push({ lemma: word, fi: String(number), nb: String(number), number, place: "desk" });
  sparkles.push({ x: me.x - 0.5, y: me.y - 1, born: now });
  cardEl.className = "right answered";
  cardEl.innerHTML = `<div>${LESSON_TEXT.right(word, number)}</div>`;
  showPrompt();
  // The character says it and asks, and the teacher answers. All of it is joined from separate lines.
  const speech = lessonSpeak(
    lessonTurn(lesson.people.find((person) => person.me), LESSON_SPEECH.answer(number), lessonMyLine(`number-${number}`), lessonMyLine("is-it-so")),
    lessonPraise(number, CHARACTER_NAMES[VOICES[look.gender]]),
    ...(stars >= LESSON.rounds ? [lessonTurn("teacher", LESSON_SPEECH.end, "audio/teacher-end.mp3")] : []),
  );
  if (stars >= LESSON.rounds) {
    lesson.ended = true;
    lesson.current.answered = true;
    finishRound(loadName() || "", speech);
    return;
  }
  lessonNext(speech);
}

function lessonPrompt() {
  if (!lesson) {
    promptEl.innerHTML = "";
    return;
  }
  // The same pill as the other places: what the teacher asks, and a slot for each number of the lesson.
  promptEl.className = "quest";
  promptEl.innerHTML = `<span class="ask"><b>${theme.inWords ? LESSON_TEXT.promptWords : audioOnly ? LESSON_TEXT.promptAudio : LESSON_TEXT.prompt}</b></span>
    ${audioOnly ? `<button id="hear-again">🔊 ${TEXT.hearAgain}</button>` : ""}`;
  promptEl.prepend(questBadge(null, theme.inWords ? "✏️" : "🔢"));
  promptEl.append(questSlots());
  promptEl.querySelector("#hear-again")?.addEventListener("click", () => {
    if (lesson.current) lessonSay(`audio/teacher-number-${lesson.current.number}.mp3`);
  });
}

// Which picture of someone seated is showing: the raised hand, or just sitting.
const handFrame = (since) => (since < 120 ? 0 : 1 + (Math.floor(since / 260) % 2));
function lessonSeatFrame(now) {
  if (!lesson.handAt || now >= lesson.handUntil) return null;
  return handFrame(now - lesson.handAt);
}

// The classmates' pictures, from tools/make_mahtte.py: the same frame as the player's, the hand on the first row and sitting on the second.
const classmateSheets = new Map();
function classmateSheet(look) {
  if (!classmateSheets.has(look)) classmateSheets.set(look, Object.assign(new Image(), { src: `art/classmates/${look}.png` }));
  return classmateSheets.get(look);
}

// Sitting still, or for a moment swinging the legs: the row's first picture, then six of swinging.
function lessonSeatColumn(now) {
  const mine = lesson.people.find((person) => person.me);
  return mine?.swingUntil > now ? 1 + Math.floor(now / SIT.swingMs) % 6 : 0;
}

// ------------------------------------------------------------- the room
// What's written on the white board, which is made with the room in tools/make_classrooms.py: it must match LESSON_BOARD there.
function lessonPaintBoard() {
  const [x0, x1, wall, low, high] = [LESSON.boardFrom, LESSON.boardTo, 2.08, 10, 30];
  const at = (x, up) => [isoX(x, wall), isoY(x, wall) - up];
  // Going along the wall as the board does.
  const now = performance.now();
  const onWall = (x, up, wallAt = wall) => ctx.transform(1, HH / HW, 0, 1, isoX(x, wallAt), isoY(x, wallAt) - up);
  // The pens lie on the tray at the board's right end, but for the one the teacher has picked up.
  LESSON_PENS.forEach(({ body }, i) => {
    if (i === lesson.pen) return;
    ctx.save();
    onWall(x1 - 2.75 + i * 0.62, low - 0.1, 2.14);
    ctx.fillStyle = "#23262a";
    ctx.fillRect(-0.25, -1.65, 8.5, 1.8);
    ctx.fillStyle = body;
    ctx.fillRect(0, -1.4, 6, 1.3);
    ctx.fillStyle = "#f4f4f0";
    ctx.fillRect(6, -1.4, 1, 1.3);
    ctx.fillStyle = body;
    ctx.fillRect(7, -1.1, 1, 0.7);
    ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
    ctx.fillRect(0.3, -1.3, 5.4, 0.34);
    ctx.restore();
  });
  const paintWord = (word, shown, alpha) => {
    const [left, bottom] = at(x0 + 0.3, (low + high) / 2 - 4);
    const room = (x1 - x0 - 0.6) * HW;
    ctx.save();
    ctx.transform(1, HH / HW, 0, 1, left, bottom);
    ctx.font = '20px "Satnematki Hand", cursive';
    const scale = Math.min(1, room / ctx.measureText(word).width);
    const wide = ctx.measureText(word).width, margin = (room - wide * scale) / 2;
    if (word === lesson.current?.shown) lesson.writtenFrom = [x0 + 0.3 + margin / HW, x1 - 0.3 - margin / HW]; // the teacher's hand follows it
    ctx.translate(margin, 0);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(-1, -22, (wide + 2) * shown, 32);
    ctx.clip();
    ctx.globalAlpha = alpha;
    const pen = LESSON_PENS[lesson.pen];
    ctx.textBaseline = "alphabetic";
    if (pen.edge) {
      ctx.strokeStyle = pen.edge;
      ctx.lineWidth = 0.5;
      ctx.strokeText(word, 0, 0);
    }
    ctx.fillStyle = pen.ink;
    ctx.fillText(word, 0, 0);
    ctx.restore();
  };
  const current = lesson.current;
  if (current && !audioOnly) paintWord(current.shown, Math.max(0, Math.min(1, (now - current.at) / (current.until - current.at))), 1);
  const wiped = lesson.wiped;
  if (wiped?.word && !audioOnly && now - wiped.at < LESSON.wipeMs) paintWord(wiped.word, 1, 1 - (now - wiped.at) / LESSON.wipeMs);
}

function lessonScene(scene, now, seen) {
  if (!lesson) return;
  scene.push({ d: 1000, paint: () => paintLessonBubbles(now) });
  // After the wall behind it, and before the teacher in front of it.
  scene.push({ d: LESSON_BOARD_DEPTH, box: [isoX(LESSON.boardFrom, 2), isoY(LESSON.boardFrom, 2) - 32, isoX(LESSON.boardTo, 2), isoY(LESSON.boardTo, 2) - 8], paint: () => { ctx.lit = false; lessonPaintBoard(); ctx.lit = true; } }); // the board has its light painted in
  const person = (sprite, x, y, facing, frame, inFront = 0) => {
    const cx = isoX(x, y), cy = isoY(x, y);
    if (!seen(cx, cy, 90)) return;
    scene.push({ d: x + y + inFront, box: [cx - 22, cy - 60, cx + 22, cy + 10], paint: () => {
      ctx.fillStyle = SHADOW;
      ctx.globalAlpha = 0.2;
      castShadow(ctx, Math.round(cx) - 3, Math.round(cy) + 1, 9, 5);
      ctx.globalAlpha = 1;
      if (ctx.gpu) ctx.casting = true; // the GPU lays their shadow in the sun
      paintImage(modelImage(sprite, facing, frame, facing, "none"), Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y);
    } });
  };
  // At the board she reaches up to write, and otherwise walks or faces the class.
  const writing = lesson.current && !lesson.current.asked && !lesson.teacherMoving;
  // Writing, her hand goes along the board with the pen, back and forth a little.
  const frame = lesson.teacherMoving ? 1 + (Math.floor(now / 170) % 2) : writing ? [3, 14, 3, 15][Math.floor(now / 160) % 4] : 0;
  person(`person_${lesson.teacher}`, lesson.teacherX, lesson.teacherY, lesson.teacherFacing ?? 0, frame, Math.max(0, LESSON_BOARD_DEPTH + 0.01 - lesson.teacherX - lesson.teacherY)); // always in front of the board
  for (const someone of lesson.people) {
    if (someone.me) continue;
    const up = now >= someone.handAt && now < someone.handUntil;
    const [column, row] = up ? [handFrame(now - someone.handAt), 0] : [someone.swingUntil > now ? 1 + Math.floor(now / SIT.swingMs) % 6 : 0, 1];
    const { x, y } = someone.chair;
    scene.push({ d: x + y + 0.15, box: [isoX(x, y) - 18, isoY(x, y) - 42, isoX(x, y) + 22, isoY(x, y) + 10], paint: () => { // the chair's back goes in front of them
      const cx = Math.round(isoX(x, y)), cy = Math.round(isoY(x, y));
      ctx.fillStyle = SHADOW;
      ctx.globalAlpha = 0.3;
      castShadow(ctx, cx - 3, cy + 2, 19, 7);
      ctx.globalAlpha = 1;
      const sheet = classmateSheet(someone.look);
      if (ctx.gpu && sheet.complete) ctx.casting = true;
      if (sheet.complete) ctx.drawImage(sheet, column * FRAME_W * SHEET_DETAIL, row * FRAME_H * SHEET_DETAIL, FRAME_W * SHEET_DETAIL, FRAME_H * SHEET_DETAIL, cx - 12, cy + 4 - FRAME_H - SIT.seatUp, FRAME_W, FRAME_H);
    } });
  }
  // Everyone's backpack on the floor beside their desk.
  lesson.people.forEach(({ chair }, i) => {
    const x = chair.deskX + 1.42, y = chair.deskY + 0.86;
    const cx = isoX(x, y), cy = isoY(x, y);
    scene.push({ d: x + y, box: [cx - 12, cy - 20, cx + 14, cy + 8], paint: () => {
      ctx.fillStyle = SHADOW;
      ctx.globalAlpha = 0.26;
      castShadow(ctx, Math.round(cx) - 3, Math.round(cy) + 1, 11, 5);
      ctx.globalAlpha = 1;
      paintImage(modelImage(`backpack-${lesson.backpacks[i]}`, 0, 0), Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y);
    } });
  });
  for (const [sprite, x, y, high = 0] of LESSON_PLANTS) {
    const cx = isoX(x, y), cy = isoY(x, y);
    scene.push({ d: x + y + (high ? 1 : 0), box: [cx - 16, cy - 40 - high, cx + 16, cy + 10], paint: () => {
      if (!high) {
        ctx.fillStyle = SHADOW;
        ctx.globalAlpha = 0.2;
        castShadow(ctx, Math.round(cx) - 3, Math.round(cy) + 1, 11, 6);
        ctx.globalAlpha = 1;
      }
      paintImage(modelImage(sprite, 0, 0), Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y - high);
    } });
  }
}

// ------------------------------------------------------------- what's said, in writing
// Bubbles over whoever speaks, in Sámi and in Finnish. Each language can be switched off where the level is chosen; on unless so.
let lessonSpeechShown = { se: true, fi: true };
try {
  lessonSpeechShown = { se: localStorage.getItem("mahtte.speech.se") !== "off", fi: localStorage.getItem("mahtte.speech.fi") !== "off" };
} catch {
  // Private windows may refuse; the bubbles just stay on.
}

function lessonSpeechSwitches() {
  const switches = document.createElement("div");
  switches.className = "speech-switches";
  for (const language of ["se", "fi"]) {
    const button = document.createElement("button");
    button.className = "speech-switch";
    const show = () => {
      const on = lessonSpeechShown[language];
      button.textContent = language === "se" ? LESSON_TEXT.speechSe(on) : LESSON_TEXT.speechFi(on);
      button.setAttribute("aria-pressed", String(on));
    };
    button.addEventListener("click", () => {
      lessonSpeechShown[language] = !lessonSpeechShown[language];
      try {
        localStorage.setItem(`mahtte.speech.${language}`, lessonSpeechShown[language] ? "on" : "off");
      } catch {
        // The choice still holds for this visit.
      }
      show();
    });
    show();
    switches.append(button);
  }
  return switches;
}

function lessonShowBubble({ who, se, fi }) {
  const now = performance.now();
  const bubble = { who, se, fi, at: now, until: Infinity };
  if (!lesson) return bubble;
  lesson.bubbles.forEach(lessonReleaseBubble);
  lesson.bubbles = lesson.bubbles.filter((other) => other.who !== who && now < other.until);
  lesson.bubbles.push(bubble);
  return bubble;
}

// That person has finished: the bubble stays a little longer, and long enough for a slower reader.
function lessonReleaseBubble(bubble) {
  if (bubble.until !== Infinity) return;
  bubble.until = Math.max(performance.now() + LESSON.bubbleLingerMs, bubble.at + Math.max(bubble.se.length, bubble.fi.length) * LESSON.bubbleReadMsPerLetter);
}

// The newest first, and one that would land on a newer one waits out of sight. Not when only listening.
function paintLessonBubbles(now) {
  if (audioOnly) return;
  const painted = [];
  for (const bubble of [...lesson.bubbles].reverse()) {
    if (now >= bubble.until || (!lessonSpeechShown.se && !lessonSpeechShown.fi)) continue;
    const name = bubble.who.name ? `${bubble.who.name}: ` : "";
    const se = lessonSpeechShown.se ? name + bubble.se : "";
    const fi = lessonSpeechShown.fi ? (se ? "" : name) + bubble.fi : "";
    // The teacher's goes under her, as over her head it would hide the board.
    const box = bubble.who === "teacher"
      ? lessonBubbleBox(se, fi, isoX(lesson.teacherX, lesson.teacherY), isoY(lesson.teacherX, lesson.teacherY) + 8, true)
      : lessonBubbleBox(se, fi, isoX(bubble.who.chair.x, bubble.who.chair.y), isoY(bubble.who.chair.x, bubble.who.chair.y) - 38);
    if (painted.some((other) => box.left < other.left + other.wide + 2 && other.left < box.left + box.wide + 2 && box.top < other.top + other.high + 8 && other.top < box.top + box.high + 8)) continue;
    painted.push(box);
    lessonPaintBubble(box);
  }
}

const LESSON_BUBBLE_SE = "bold 9px sans-serif", LESSON_BUBBLE_FI = "8px sans-serif";

function lessonBubbleRows(text, font) {
  if (!text) return [];
  ctx.font = font;
  const rows = [];
  for (const word of text.split(" ")) {
    const row = rows.length ? `${rows.at(-1)} ${word}` : word;
    if (rows.length && ctx.measureText(row).width <= LESSON.bubbleWide) rows[rows.length - 1] = row;
    else rows.push(word);
  }
  return rows.map((row) => ({ row, font, wide: ctx.measureText(row).width, high: font === LESSON_BUBBLE_SE ? 10 : 9, colour: font === LESSON_BUBBLE_SE ? "#1f2a38" : "#4c5c6b" }));
}

function lessonBubbleBox(text, finnish, x, y, below = false) {
  const rows = [...lessonBubbleRows(text, LESSON_BUBBLE_SE), ...lessonBubbleRows(finnish, LESSON_BUBBLE_FI)];
  const wide = Math.ceil(Math.max(...rows.map((row) => row.wide))) + 10;
  const high = 4 + rows.reduce((sum, row) => sum + row.high, 0);
  // Whole on screen, even when who is speaking stands near the edge of the view or out of it. On the screen's pixels, as the view is, so that it
  // neither shakes against the picture standing still in the world nor against the screen while it's held at the edge.
  const pixel = (value) => Math.round(value * CANVAS_DETAIL) / CANVAS_DETAIL;
  const viewX = pixel(cam.x), viewY = pixel(cam.y);
  const top = Math.max(viewY + 3, Math.min(viewY + VIEW_H - high - 9, pixel(below ? y : y - high)));
  const left = Math.max(viewX + 3, Math.min(viewX + VIEW_W - wide - 3, pixel(x - wide / 2)));
  // The tail only points at someone who can be seen.
  const inView = x > viewX && x < viewX + VIEW_W && y > viewY && y < viewY + VIEW_H;
  return { rows, wide, high, top, left, below, inView, x: pixel(Math.max(left + 6, Math.min(left + wide - 6, x))) };
}

function lessonPaintBubble({ rows, wide, high, top, left, below, inView, x }) {
  // The tail points at who is speaking, from whichever side the bubble is on.
  const edge = below ? top : top + high, way = below ? -1 : 1;
  ctx.save();
  ctx.fillStyle = "#1f2a38";
  ctx.beginPath();
  ctx.roundRect(left - 1, top - 1, wide + 2, high + 2, 5);
  if (inView) {
    ctx.moveTo(x - 4, edge);
    ctx.lineTo(x, edge + 6 * way);
    ctx.lineTo(x + 4, edge);
  }
  ctx.fill();
  ctx.fillStyle = "#fffdf4";
  ctx.beginPath();
  ctx.roundRect(left, top, wide, high, 4);
  if (inView) {
    ctx.moveTo(x - 3, edge - way);
    ctx.lineTo(x, edge + 4 * way);
    ctx.lineTo(x + 3, edge - way);
  }
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let at = top + 2;
  for (const { row, font, high: rowHigh, colour } of rows) {
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.fillText(row, left + wide / 2, at + rowHigh / 2 + 0.5);
    at += rowHigh;
  }
  ctx.restore();
}

// One short line in a bubble, as the shop's cashier says.
const lessonBubble = (text, x, y) => lessonPaintBubble(lessonBubbleBox(text, "", x, y));

// A touch of warmth over everything.
function paintLessonWarmth(camX, camY) {
  ctx.fillStyle = "rgba(255, 196, 110, 0.07)";
  ctx.fillRect(camX, camY, VIEW_W, VIEW_H);
}
