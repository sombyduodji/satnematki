// A lesson in the small classroom. The character sits at a desk and can't get up. The teacher writes a number in Sámi on the board, and
// whoever knows it raises a hand: E, and then the number goes into a keypad like the shop's. Left too long, a classmate answers instead.
const LESSON = { rounds: 8, teacherAt: [10.3, 3.3], myChair: 1, firstMs: 2200, writeMsPerLetter: 120, writeLeastMs: 900, nextMs: 800, wipeMs: 450, handMs: 1100, longestWord: 30, speakUpAfterMs: 20000, speakUpSaysMs: 3200, swingLeastMs: 10000, swingMoreMs: 20000, swingForMs: 1600, walk: 0.0035, praises: 12, boardFrom: 3.4, boardTo: 9, sunPanes: [[3, 4], [4, 5], [7, 8], [8, 9]] };
const LESSON_TEACHERS = ["teacher", "teacher_blue", "teacher_red"];
// Each classmate's voice: one of the two characters' lines, played higher.
const LESSON_VOICES = { classmate_gakti: ["biret", 1.14], classmate_anorak: ["mahtte", 1.14], classmate_wool: ["biret", 1.25], classmate_parka: ["mahtte", 1.28] };
const LESSON_TOUCH = matchMedia("(hover: none) and (pointer: coarse)").matches;
// The Sámi keyboard layout, after a picture from the user that they think is Divvun's. The keys for punctuation give way to ⌫ and OK.
const LESSON_KEY_ROWS = ["ášertyuiopåŋ", "asdfghjkløæđ", "žzčcvbnm"].map((row) => [...row]);
const LESSON_CLASSMATES = ["classmate_anorak", "classmate_wool", "classmate_parka"];
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
  beaten: (word, number) => `Luokkatoveri ehti ensin: <span lang="se">${escapeText(word)}</span> = ${number}.`,
  right: (word, number) => `<span class="word" lang="se">${escapeText(word)}</span> <span class="translation">= ${number}</span>`,
  close: "Sulje",
  says: (shown) => `Dát lea ${shown}.`,
  wrongWord: "Ei ihan. Korjaa ja yritä uudelleen.",
};
// Things in the room, by x and y; the last is how high they stand, for one on a desk.
const LESSON_PLANTS = [["lesson_plant", 2.7, 2.7], ["lesson_plant", 2.7, 11.1], ["flower", 11.2, 2.8], ["flower", 6.5, 4.5, 13]];

const LESSON_BOARD_DEPTH = 10.59; // after the wall behind the board
let lesson = null;

function setupLesson() {
  const now = performance.now();
  const looks = ["classmate_gakti", ...shuffled(LESSON_CLASSMATES).slice(0, 2)];
  lesson = {
    people: [], teacher: LESSON_TEACHERS[Math.floor(Math.random() * LESSON_TEACHERS.length)], teacherX: LESSON.teacherAt[0], teacherY: LESSON.teacherAt[1],
    numbers: shuffled(Array.from({ length: theme.most + 1 }, (_, number) => number)), current: null, wipeAt: null, wiped: null, nextAt: Infinity, typed: "", typing: false, handUntil: 0, handAt: 0, started: false, ended: false,
  };
  objects = [];
  chairs.forEach((chair, index) => {
    lesson.people.push({ chair, me: index === LESSON.myChair, handUntil: 0, handAt: 0, look: index === LESSON.myChair ? null : looks.pop() });
  });
  sitOn(chairs[LESSON.myChair], now);
  placeCamera();
  roundSize = LESSON.rounds;
  stars = 0;
  targets = [];
  document.fonts?.load('16px "Satnematki Hand"', "čđŋšŧž");
  buildLessonAhead();
  showPrompt();
  lessonNote(LESSON_TEXT.start);
}

function buildLessonAhead() {
  const ahead = (sprite, frame, facing) => queueFinePicture(`${sprite}/${facing}/${frame}/${facing}/none/${viewDetail}`, sprite, facing, frame, facing, "none");
  for (const person of lesson.people) if (person.look) for (const frame of [5, 6, 7, 8]) ahead(`person_${person.look}`, frame, 2);
  for (const facing of [0, 1, 2, 3]) for (const frame of [0, 1, 2, 3]) ahead(`person_${lesson.teacher}`, frame, facing);
}

const lessonSay = (...lines) => playVoice(...lines);
const lessonMyLine = (name) => `audio/${name}-${VOICES[look.gender]}.wav`;
// One of the teacher's praises, then "Dát lea" and the number by itself.
const lessonPraise = (number) => [`audio/teacher-praise-${Math.floor(Math.random() * LESSON.praises)}.wav`, "audio/teacher-it-is.wav", `audio/teacher-number-${number}.wav`];

// After the rules have been read.
function lessonBegin() {
  const now = performance.now();
  lesson.started = true;
  lesson.nextAt = now + LESSON.firstMs;
  timer.running = true;
  lessonSay("audio/teacher-hello.wav");
  showPrompt();
}

// She goes to the board and writes the next number.
function lessonWrite(now) {
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
    const question = `audio/teacher-which-${current.number < 10 ? "digit" : "number"}.wav`;
    if (!lesson.typing && !current.answered) lessonSay(...(audioOnly ? [`audio/teacher-number-${current.number}.wav`] : []), question);
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
  const along = writing ? (now - current.at) / (current.until - current.at) : 0;
  const [from, to] = lesson.writtenFrom ?? [LESSON.boardFrom + 0.8, LESSON.boardTo - 0.4];
  const toX = writing ? from + along * (to - from) : LESSON.teacherAt[0];
  const toY = writing ? 2.7 : LESSON.teacherAt[1];
  const dx = toX - lesson.teacherX, dy = toY - lesson.teacherY, away = Math.hypot(dx, dy);
  lesson.teacherMoving = away > 0.08;
  if (lesson.teacherMoving) {
    const step = Math.min(away, LESSON.walk * dt);
    lesson.teacherX += (dx / away) * step;
    lesson.teacherY += (dy / away) * step;
    lesson.teacherFacing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);
  } else lesson.teacherFacing = writing ? 2 : 0;
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
  helper.says = LESSON_TEXT.says(theme.inWords ? word : number);
  if (!audioOnly) lessonNote(LESSON_TEXT.beaten(word, number));
  lessonNext(lessonSay(
    { src: `audio/number-${number}-${voiceName}.wav`, rate },
    { src: `audio/is-it-so-${voiceName}.wav`, rate },
    ...lessonPraise(number),
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
  cardEl.innerHTML = `${theme.inWords ? `<input class="sum" lang="se" maxlength="${LESSON.longestWord}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${LESSON_TEXT.promptWords}" ${LESSON_TOUCH ? "readonly" : ""}>` : `<div class="sum">${escapeText(lesson.typed) || "&nbsp;"}</div>`}
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
  lessonNote(LESSON_TEXT.start);
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
    lessonSay("audio/teacher-wrong.wav");
    return;
  }
  lesson.typing = false;
  lesson.handUntil = now + LESSON.handMs;
  if (!right) {
    me.heldUntil = now + WRONG_HOLD_MS;
    if (lesson.current.waitFrom) lesson.current.waitFrom = now;
    lessonNote(LESSON_TEXT.notYet);
    lessonSay("audio/teacher-wrong.wav");
    return;
  }
  stars++;
  heardWords.push({ lemma: word, fi: String(number), number, place: "desk" });
  sparkles.push({ x: me.x - 0.5, y: me.y - 1, born: now });
  cardEl.className = "right";
  cardEl.innerHTML = `<div>${LESSON_TEXT.right(word, number)}</div>`;
  showPrompt();
  // The character says it and asks, and the teacher answers. All of it is joined from separate lines.
  const speech = lessonSay(lessonMyLine(`number-${number}`), lessonMyLine("is-it-so"), ...lessonPraise(number), ...(stars >= LESSON.rounds ? ["audio/teacher-end.wav"] : []));
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
  const row = "★".repeat(stars) + "☆".repeat(roundSize - stars);
  promptEl.innerHTML = `<span>${theme.inWords ? LESSON_TEXT.promptWords : audioOnly ? LESSON_TEXT.promptAudio : LESSON_TEXT.prompt}</span>
    ${audioOnly ? `<button id="hear-again">🔊 ${TEXT.hearAgain}</button>` : ""}
    <span class="stars" aria-label="${stars}/${roundSize}">${row}</span>`;
  promptEl.querySelector("#hear-again")?.addEventListener("click", () => {
    if (lesson.current) lessonSay(`audio/teacher-number-${lesson.current.number}.wav`);
  });
}

// Which picture of the seated character is showing: the raised hand, or just sitting.
function lessonSeatFrame(now) {
  if (!lesson.handAt || now >= lesson.handUntil) return null;
  const since = now - lesson.handAt;
  return since < 120 ? 0 : 1 + (Math.floor(since / 260) % 2);
}

// Sitting still, or for a moment swinging the legs: the row's first picture, then six of swinging.
function lessonSeatColumn(now) {
  const mine = lesson.people.find((person) => person.me);
  return mine?.swingUntil > now ? 1 + Math.floor(now / SIT.swingMs) % 6 : 0;
}

// ------------------------------------------------------------- the room
// What the sun through the windows lays on the floor, painted once into the world.
function lessonSunlight(g) {
  const corner = (x, y) => [isoX(x, y), isoY(x, y) + HH];
  g.save();
  g.fillStyle = "rgba(255, 226, 150, 0.34)";
  for (const [from, to] of LESSON.sunPanes) {
    const a = from + 0.08, b = to - 0.08;
    g.beginPath();
    g.moveTo(...corner(2, a));
    g.lineTo(...corner(2, b));
    g.lineTo(...corner(7, b + 1.7));
    g.lineTo(...corner(7, a + 1.7));
    g.closePath();
    g.fill();
  }
  g.restore();
}

// A good white board on the wall behind the teacher, in an aluminium frame with a tray for the pens.
function lessonPaintBoard() {
  const [x0, x1, wall, low, high] = [LESSON.boardFrom, LESSON.boardTo, 2, 9, 28];
  const at = (x, up) => [isoX(x, wall), isoY(x, wall) + HH - up];
  const shape = (points, colour) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    points.forEach((point, i) => (i ? ctx.lineTo(...point) : ctx.moveTo(...point)));
    ctx.closePath();
    ctx.fill();
  };
  const face = (a, b, down, up) => [at(a, down), at(b, down), at(b, up), at(a, up)];
  shape(face(x0 + 0.08, x1 + 0.08, low - 1.5, high - 1.5), "rgba(60, 40, 24, 0.28)"); // its shadow on the wall
  shape(face(x0, x1, low, high), "#aeb6bd");
  shape(face(x0, x1, high - 0.6, high), "#dfe4e8");
  shape(face(x0 + 0.1, x1 - 0.1, low + 0.8, high - 0.8), "#fbfcfb");
  // The light from the windows, falling across it from the left.
  shape(face(x0 + 0.1, x0 + 1.6, low + 0.8, high - 0.8), "rgba(255, 236, 190, 0.5)");
  shape([at(x0 + 2.2, low + 0.8), at(x0 + 3, low + 0.8), at(x0 + 3.9, high - 0.8), at(x0 + 3.1, high - 0.8)], "rgba(226, 234, 240, 0.7)");
  // The tray, with two pens and an eraser.
  shape(face(x0 - 0.05, x1 + 0.05, low - 1.6, low), "#8d959c");
  shape(face(x0 - 0.05, x1 + 0.05, low - 0.5, low), "#c8ced3");
  shape(face(x0 + 3.9, x0 + 4.35, low, low + 0.9), "#2f5fa8");
  shape(face(x0 + 4.5, x0 + 4.95, low, low + 0.9), "#c8372d");
  shape(face(x0 + 1.1, x0 + 1.8, low, low + 1.6), "#40464e");
  // What's written on it, going along the wall as the board does.
  const now = performance.now();
  const paintWord = (word, shown, alpha) => {
    const [left, bottom] = at(x0 + 0.3, low + 5);
    const room = (x1 - x0 - 0.6) * HW;
    ctx.save();
    ctx.transform(1, HH / HW, 0, 1, left, bottom);
    ctx.font = '15px "Satnematki Hand", cursive';
    const scale = Math.min(1, room / ctx.measureText(word).width);
    const wide = ctx.measureText(word).width, margin = (room - wide * scale) / 2;
    if (word === lesson.current?.shown) lesson.writtenFrom = [x0 + 0.3 + margin / HW, x1 - 0.3 - margin / HW]; // the teacher's hand follows it
    ctx.translate(margin, 0);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(-1, -18, (wide + 2) * shown, 26);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#1f3a78";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(word, 0, 0);
    ctx.restore();
  };
  const current = lesson.current;
  if (current && !audioOnly) paintWord(current.shown, Math.min(1, (now - current.at) / (current.until - current.at)), 1);
  const wiped = lesson.wiped;
  if (wiped?.word && !audioOnly && now - wiped.at < LESSON.wipeMs) paintWord(wiped.word, 1, 1 - (now - wiped.at) / LESSON.wipeMs);
}

function lessonScene(scene, now, seen) {
  if (!lesson) return;
  // After the wall behind it, and before the teacher in front of it.
  scene.push({ d: LESSON_BOARD_DEPTH, paint: () => lessonPaintBoard() });
  const person = (sprite, x, y, facing, frame, inFront = 0) => {
    const cx = isoX(x, y), cy = isoY(x, y);
    if (!seen(cx, cy, 90)) return;
    scene.push({ d: x + y + inFront, paint: () => {
      ctx.fillStyle = SHADOW;
      ctx.globalAlpha = 0.2;
      castShadow(ctx, Math.round(cx) - 3, Math.round(cy) + 1, 9, 5);
      ctx.globalAlpha = 1;
      paintImage(modelImage(sprite, facing, frame, facing, "none"), Math.round(cx) - MODEL_ANCHOR.x, Math.round(cy) - MODEL_ANCHOR.y);
    } });
  };
  // At the board she reaches up to write, and otherwise walks or faces the class.
  const writing = lesson.current && !lesson.current.asked && !lesson.teacherMoving;
  const frame = lesson.teacherMoving ? 1 + (Math.floor(now / 170) % 2) : writing ? 3 : 0;
  person(`person_${lesson.teacher}`, lesson.teacherX, lesson.teacherY, lesson.teacherFacing ?? 0, frame, Math.max(0, LESSON_BOARD_DEPTH + 0.01 - lesson.teacherX - lesson.teacherY)); // always in front of the board
  for (const someone of lesson.people) {
    if (someone.me) continue;
    const up = now >= someone.handAt && now < someone.handUntil;
    const swinging = someone.swingUntil > now;
    const frame = up ? 6 : swinging ? 7 + (Math.floor(now / 210) % 2) : 5;
    person(`person_${someone.look}`, someone.chair.x, someone.chair.y - 0.1, 2, frame, 0.15); // over the chair's back, so that they can be seen
    if (up && someone.says) scene.push({ d: 1000, paint: () => lessonBubble(someone.says, isoX(someone.chair.x, someone.chair.y), isoY(someone.chair.x, someone.chair.y) - 38) });
  }
  for (const [sprite, x, y, high = 0] of LESSON_PLANTS) {
    const cx = isoX(x, y), cy = isoY(x, y);
    scene.push({ d: x + y + (high ? 1 : 0), paint: () => {
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

// What a classmate says, in a bubble over their head.
function lessonBubble(text, x, y) {
  ctx.save();
  ctx.font = "bold 9px sans-serif";
  const wide = Math.ceil(ctx.measureText(text).width) + 10, top = Math.round(Math.max(cam.y + 3, y - 14));
  // Whole on screen, even when who is speaking stands near the edge of the view.
  const left = Math.round(Math.max(cam.x + 3, Math.min(cam.x + VIEW_W - wide - 3, x - wide / 2)));
  x = Math.max(left + 6, Math.min(left + wide - 6, x));
  ctx.fillStyle = "#1f2a38";
  ctx.beginPath();
  ctx.roundRect(left - 1, top - 1, wide + 2, 16, 5);
  ctx.moveTo(x - 4, top + 14);
  ctx.lineTo(x, top + 20);
  ctx.lineTo(x + 4, top + 14);
  ctx.fill();
  ctx.fillStyle = "#fffdf4";
  ctx.beginPath();
  ctx.roundRect(left, top, wide, 14, 4);
  ctx.moveTo(x - 3, top + 13);
  ctx.lineTo(x, top + 18);
  ctx.lineTo(x + 3, top + 13);
  ctx.fill();
  ctx.fillStyle = "#1f2a38";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + wide / 2, top + 7.5);
  ctx.restore();
}

// A touch of warmth over everything.
function paintLessonWarmth(camX, camY) {
  ctx.fillStyle = "rgba(255, 196, 110, 0.07)";
  ctx.fillRect(camX, camY, VIEW_W, VIEW_H);
}
