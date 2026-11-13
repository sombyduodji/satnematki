// Sátnegirji, the word book: every word a player has found, with its picture, its sound, and stars for finding it often.
// Each player has a book of their own, kept in the browser under their player id: a new player starts with an empty one,
// and picking an earlier player again brings theirs back. Loaded before game.js; it uses the game's names only when called.

const BOOK_STARS_AT = [3, 10, 25]; // finds for one, two and three stars
const BOOK_TEXT = {
  fi: {
    title: "Sátnegirji",
    menu: (found, all) => `Sanakirjasi: ${found} / ${all} sanaa löydetty`,
    fresh: (n) => `${n} uutta!`,
    words: "sanaa",
    all: "Kaikki",
    back: "← Päävalikko",
    notYet: "vielä löytämättä",
    more: (n) => `+${n} sanaa vielä löytämättä – valitse paikka`,
    legend: "Kosketa sanaa, niin se liikkuu ja kuulet sen. ★ = löydetty 3 kertaa · ★★ = 10 kertaa · ★★★ = 25 kertaa. Harmaat sanat odottavat vielä löytäjäänsä.",
    newWords: (n) => (n === 1 ? "Sátnegirjiin tuli uusi sana" : `Sátnegirjiin tuli ${n} uutta sanaa`),
    gotStar: "sai tähden",
    freshMark: "UUSI",
    close: "Sulje",
    tapToGo: "Kosketa tai paina välilyöntiä, niin peli jatkuu",
    first: "Ensimmäinen sana Sátnegirjiin!",
  },
  nb: {
    title: "Sátnegirji",
    menu: (found, all) => `Ordboka di: ${found} av ${all} ord funnet`,
    fresh: (n) => `${n} nye!`,
    words: "ord",
    all: "Alle",
    back: "← Hovedmeny",
    notYet: "ikke funnet ennå",
    more: (n) => `+${n} ord ikke funnet ennå – velg et sted`,
    legend: "Trykk på et ord, så beveger det seg og du hører det. ★ = funnet 3 ganger · ★★ = 10 ganger · ★★★ = 25 ganger. De grå ordene venter fortsatt på å bli funnet.",
    newWords: (n) => (n === 1 ? "Ett nytt ord i Sátnegirji" : `${n} nye ord i Sátnegirji`),
    gotStar: "fikk en stjerne",
    freshMark: "NY",
    close: "Lukk",
    tapToGo: "Trykk på skjermen eller mellomromstasten for å fortsette",
    first: "Det første ordet i Sátnegirji!",
  },
};
// In Inari Sámi the book is a sänikirje, kept apart from the North Sámi one.
// There are no Inari voices yet, so a word is only seen moving.
const BOOK_SMN = {
  fi: [["Sátnegirjiin", "Sänikirjeeseen"], ["Sátnegirji", "Sänikirje"], [" ja kuulet sen", ""]],
  nb: [["Sátnegirji", "Sänikirje"], [" og du hører det", ""]],
};
const bookText = () => {
  const text = BOOK_TEXT[LANG] ?? BOOK_TEXT.fi;
  if (SAMI !== "smn") return text;
  const swap = (value) => (typeof value === "function" ? (...args) => swap(value(...args)) : typeof value === "string" ? (BOOK_SMN[LANG] ?? BOOK_SMN.fi).reduce((s, [a, b]) => s.split(a).join(b), value) : value);
  return Object.fromEntries(Object.entries(text).map(([key, value]) => [key, swap(value)]));
};

// What can be found in each place, in the menu's order, as the rounds there choose their words.
const BOOK_PLACES = [
  ["forest", (w) => w.theme === "animal"],
  ["store", (w) => w.theme === "food" && window.MAHTTE_MAPS.store.stock[w.sprite]],
  ["home", (w) => w.theme === "home"],
  ["library", (w) => w.theme === "item"],
  ["city", (w) => w.theme === "vehicle" || w.theme === "lot"],
  ["gearstore", (w) => w.theme === "gear" && window.MAHTTE_MAPS.gearstore.stock?.[w.sprite]],
];

// The places open in this language, each with its words.
function bookPlaces() {
  return BOOK_PLACES.filter(([place]) => !CLOSED_PLACES.has(place) && placeOnDevice(place)).map(([place, belongs]) => ({
    place,
    title: THEMES.find((t) => (t.menuPlace ?? t.place) === place)?.title ?? place,
    words: window.MAHTTE_WORDS.filter(belongs),
  }));
}

function bookWords() {
  const seen = new Map();
  for (const { words } of bookPlaces()) for (const w of words) if (!seen.has(w.sprite)) seen.set(w.sprite, w);
  return [...seen.values()];
}

// The book is kept under the player's id; before there is one, under "".
function bookKey() {
  let id = "";
  try { id = localStorage.getItem("mahtte.player") ?? ""; } catch { /* none */ }
  return `mahtte.book.${id}${SAMI === "smn" ? ".smn" : ""}`;
}

// { sprite: { n: finds, m: misses, c: colour last found in, s: how it was spoken, v: 1 once seen in the book } }
function loadBook() {
  try {
    const book = JSON.parse(localStorage.getItem(bookKey()));
    return book && typeof book === "object" ? book : {};
  } catch {
    return {};
  }
}

function saveBook(book) {
  try {
    localStorage.setItem(bookKey(), JSON.stringify(book));
    // Books of players no longer kept are let go.
    const ids = new Set(loadPlayers().map((p) => p.id));
    Object.keys(localStorage).filter((k) => k.startsWith("mahtte.book.p") && !ids.has(k.slice("mahtte.book.".length).replace(/\.smn$/, ""))).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Private windows may refuse; the book then lasts this visit only.
  }
}

const bookStars = (n) => BOOK_STARS_AT.filter((at) => n >= at).length;

// What this round brought: words new to the book, and words that reached a new star.
let bookRound = { fresh: [], starred: [] };
function bookNewRound() {
  bookRound = { fresh: [], starred: [] };
  if (theme && BOOK_PLACES.some(([place]) => place === (theme.menuPlace ?? theme.place))) bookHud(true); // not for numbers or the camp
}

// The little book in the corner of the game, with how many words are in it. Finds fly into it.
function bookHud(show) {
  let hud = document.getElementById("book-hud");
  if (!show) {
    bookPartyEnd?.();
    if (hud) hud.hidden = true;
    return null;
  }
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "book-hud";
    hud.innerHTML = `<span class="icon" aria-hidden="true">📖</span><span class="count"></span>`;
    document.getElementById("timer").after(hud); // in the corner, between the clock and the zoom
  }
  const book = loadBook();
  hud.querySelector(".count").textContent = String(bookWords().filter((w) => book[w.sprite]?.n).length);
  hud.title = bookText().title;
  hud.hidden = false;
  return hud;
}

// Where a thing in the world is on the page, in the view's own pixels.
function bookScreenSpot(object) {
  const canvasEl = document.getElementById("world");
  const view = document.getElementById("view").getBoundingClientRect();
  const box = canvasEl.getBoundingClientRect();
  const x = (isoX(object.x + 0.5, object.y + 0.5) - cam.x) / VIEW_W, y = (isoY(object.x + 0.5, object.y + 0.5) - 12 - cam.y) / VIEW_H;
  return { x: box.left - view.left + x * box.width, y: box.top - view.top + y * box.height };
}

// Sounds made here, like the footsteps, kept under the voices: a soft chime as a word lands in the book, a brighter one for a
// new word or a star. The first word of all gets a recorded fanfare instead (bookFanfare).
function bookNote(at, frequency, length, { type = "triangle", volume = 0.08, bright = 2400 } = {}) {
  const osc = sound.createOscillator(), gain = sound.createGain(), filter = sound.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = frequency;
  filter.type = "lowpass";
  filter.frequency.value = bright;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
  gain.gain.setValueAtTime(volume, at + length * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(filter).connect(gain).connect(sound.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

// The first word's fanfare: Kenney's steel-drum jingle (CC0, see CREDITS.md), played as a file, so it also works opened from disk.
function bookFanfare() {
  try {
    const fanfare = new Audio("audio/book-fanfare.mp3");
    fanfare.volume = 0.55;
    fanfare.play().catch(() => {});
  } catch {
    // No sound then; the confetti still shows.
  }
}

const NOTE = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568 };
function bookSoundEffect(kind) {
  wakeSound();
  if (kind === "fanfare") return bookFanfare();
  if (!sound || sound.state !== "running") return;
  const at = sound.currentTime + SOUND_AHEAD;
  if (kind === "fresh" || kind === "star") {
    [NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) => bookNote(at + i * 0.07, f, 0.35, { type: "sine", volume: 0.04 }));
  } else {
    bookNote(at, NOTE.G5, 0.25, { type: "sine", volume: 0.03 });
  }
}

const bookCalm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A find flies from where it was into the book, over the game and without holding anything up. A word new to the book
// leaves a golden trail; a new star sparkles out of the book.
function bookFly(word, entry, object, kind, stars) {
  const hud = bookHud(true);
  if (!hud || !object || document.body.classList.contains("menu")) return;
  const view = document.getElementById("view");
  const from = bookScreenSpot(object);
  const hudBox = hud.getBoundingClientRect(), viewBox = view.getBoundingClientRect();
  const to = { x: hudBox.left - viewBox.left + 16, y: hudBox.top - viewBox.top + hudBox.height / 2 };
  const land = () => {
    if (kind !== "first") bookSoundEffect(kind);
    hud.querySelector(".count").textContent = String(bookWords().filter((w) => loadBook()[w.sprite]?.n).length);
    hud.classList.remove("bump");
    void hud.offsetWidth; // to start the bump again
    hud.classList.add("bump");
    if (kind === "star") {
      const star = document.createElement("span");
      star.className = "book-star";
      star.textContent = "★".repeat(stars);
      hud.append(star);
      setTimeout(() => star.remove(), 1200);
    }
  };
  if (bookCalm()) return land();
  const picture = bookPicture(word, entry);
  picture.className = `book-fly${kind === "fresh" || kind === "first" ? " fresh" : ""}`;
  picture.style.left = `${from.x}px`;
  picture.style.top = `${from.y}px`;
  view.append(picture);
  const dx = to.x - from.x, dy = to.y - from.y, lift = Math.min(80, Math.abs(dx) * 0.3 + 30);
  const frames = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    offset: t,
    transform: `translate(-50%, -50%) translate(${dx * t}px, ${dy * t - Math.sin(Math.PI * t) * lift}px) scale(${1.4 - t * 1.0})`,
    opacity: t === 1 ? 0.6 : 1,
  }));
  const flight = picture.animate(frames, { duration: kind === "fresh" || kind === "first" ? 900 : 700, easing: "ease-in" });
  if (kind === "fresh" || kind === "first") {
    // The trail: a few golden sparks dropped along the way.
    for (let i = 1; i <= 6; i++) {
      setTimeout(() => {
        const t = i / 7;
        const spark = document.createElement("span");
        spark.className = "book-spark";
        spark.style.left = `${from.x + dx * t}px`;
        spark.style.top = `${from.y + dy * t - Math.sin(Math.PI * t) * lift}px`;
        view.append(spark);
        setTimeout(() => spark.remove(), 700);
      }, i * 110);
    }
  }
  flight.onfinish = () => {
    picture.remove();
    land();
  };
}

// The very first word in a player's book: confetti in the flag's colours, and the book open on its first page for a moment.
// The game waits, clock and all, until the player taps it away or presses a key, so the round's time isn't spoiled.
let bookCelebrating = false;
let bookPartyEnd = null; // to close it from outside, as on leaving the place
function bookCelebrate(word, entry) {
  const t = bookText();
  const view = document.getElementById("view");
  document.getElementById("book-party")?.remove();
  const party = document.createElement("div");
  party.id = "book-party";
  party.setAttribute("role", "status");
  const page = document.createElement("div");
  page.className = "page";
  page.insertAdjacentHTML("beforeend", `<div class="head">${t.first}</div>`);
  page.append(bookPicture(word, entry));
  page.insertAdjacentHTML("beforeend", `<div class="se" lang="${SAMI_LANG}">${escapeText(word.lemma)}</div><div class="tr">${escapeText(translation(word))}</div>
    <div class="go">${t.tapToGo}</div>`);
  party.append(page);
  if (!bookCalm()) {
    const colours = ["#c8102e", "#0a5ec2", "#ffc61e", "#2e9e4a"];
    for (let i = 0; i < 60; i++) {
      const bit = document.createElement("i");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % 4];
      bit.style.animationDelay = `${Math.random() * 0.6}s`;
      bit.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      bit.style.setProperty("--drift", `${(Math.random() - 0.5) * 120}px`);
      bit.style.setProperty("--spin", `${(Math.random() - 0.5) * 1080}deg`);
      party.append(bit);
    }
  }
  view.append(party);
  bookSoundEffect("fanfare");
  bookCelebrating = true;
  paused = true;
  held.clear();
  me.route = [];
  me.goal = null;
  const shownAt = performance.now();
  const done = (event, now = false) => {
    if (!now && performance.now() - shownAt < 600) return; // not by a press that was already on its way
    bookPartyEnd = null;
    event?.preventDefault();
    event?.stopImmediatePropagation();
    window.removeEventListener("keydown", onKey, true);
    party.removeEventListener("pointerdown", done);
    bookCelebrating = false;
    held.clear();
    if (targets.length && !document.getElementById("results") && !document.body.classList.contains("menu")) {
      paused = false;
      // The next word was to be asked while the game waited here, and wasn't: ask it now, after any praise still being said.
      announceAfter(rightSpeech ?? Promise.resolve());
    }
    party.classList.add("leaving");
    setTimeout(() => party.remove(), 300);
  };
  // The key that closes it does only that: no jump or step comes with it.
  const onKey = (event) => {
    if ([" ", "Enter", "Escape", "e", "E"].includes(event.key)) done(event);
    else if (!event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  party.addEventListener("pointerdown", done);
  bookPartyEnd = () => done(null, true);
}

function bookFound(word, object) {
  if (!word?.sprite || word.number !== undefined) return;
  const book = loadBook();
  const first = !Object.values(book).some((e) => e.n);
  const entry = book[word.sprite] ?? { n: 0 };
  const before = bookStars(entry.n);
  entry.n++;
  if (word.colour) entry.c = word.colour;
  if (word.spoken) entry.s = word.spoken;
  else delete entry.s;
  book[word.sprite] = entry;
  saveBook(book);
  const plain = window.MAHTTE_WORDS.find((w) => w.sprite === word.sprite) ?? word;
  const starred = entry.n > 1 && bookStars(entry.n) > before;
  if (entry.n === 1) bookRound.fresh.push(plain);
  else if (starred) bookRound.starred.push([plain, bookStars(entry.n)]);
  // The card of the find shows the word's stars in the book, as on its page there.
  const wordLine = cardEl.classList.contains("answered") && cardEl.querySelector(".word")?.parentElement;
  if (wordLine && !cardEl.querySelector(".card-stars")) {
    wordLine.insertAdjacentHTML("afterend", `<div class="card-stars" aria-label="${bookStars(entry.n)} / 3">${starsHtml(entry.n)}</div>`);
  }
  bookFly(plain, entry, object, first ? "first" : entry.n === 1 ? "fresh" : starred ? "star" : "again", bookStars(entry.n));
  if (first) setTimeout(() => !document.body.classList.contains("menu") && bookCelebrate(plain, entry), bookCalm() ? 0 : 900);
}

function bookMissed(word) {
  if (!word?.sprite || word.number !== undefined) return;
  const book = loadBook();
  const entry = book[word.sprite] ?? { n: 0 };
  entry.m = (entry.m ?? 0) + 1;
  book[word.sprite] = entry;
  saveBook(book);
}

function bookPicture(word, entry) {
  const canvasEl = document.createElement("canvas");
  try {
    menuCanvas({ sprite: word.sprite, colour: entry?.c }, canvasEl);
  } catch {
    canvasEl.width = canvasEl.height = 1;
  }
  return canvasEl;
}

// How a word is said: on its own, or for a coloured thing, as it was said when found.
function bookSound(word, entry) {
  const id = VOICES[look.gender];
  if (entry?.s && entry.c) return `audio/${entry.s}-${word.sprite}-${entry.c}-${id}.mp3`;
  return `audio/word-${word.sprite}-${id}.mp3`;
}

const starsHtml = (n) => [0, 1, 2].map((i) => (i < bookStars(n) ? "★" : '<span class="off">★</span>')).join("");

// The button in the main menu.
function bookButton() {
  const t = bookText();
  const book = loadBook();
  const words = bookWords();
  const found = words.filter((w) => book[w.sprite]?.n).length;
  const unseen = words.filter((w) => book[w.sprite]?.n && !book[w.sprite].v).length;
  const button = document.createElement("button");
  button.className = "wordbook-open";
  button.innerHTML = `<span class="book-icon" aria-hidden="true">📖</span><span class="wb-text"><span class="title" lang="${SAMI_LANG}">${t.title}</span>
    <small>${t.menu(found, words.length)}</small></span>${unseen ? `<span class="new-badge">${t.fresh(unseen)}</span>` : ""}`;
  button.addEventListener("click", () => showBook("all"));
  return button;
}

// The book itself, all of it or one place at a time.
function showBook(tab = "all") {
  const t = bookText();
  document.body.classList.add("menu");
  showPrompt();
  cardEl.className = "places";
  cardEl.innerHTML = "";
  const book = loadBook();
  const places = bookPlaces();
  const words = bookWords();
  const has = (w) => Boolean(book[w.sprite]?.n);
  const found = words.filter(has).length;
  const wrap = document.createElement("div");
  wrap.className = "wb";
  const back = document.createElement("button");
  back.id = "menu-back";
  back.textContent = t.back;
  back.addEventListener("click", showPlaces);
  const head = document.createElement("div");
  head.className = "wb-head";
  head.innerHTML = `<h2><span aria-hidden="true">📖</span> <span lang="${SAMI_LANG}">${t.title}</span></h2><span class="sub">${found} / ${words.length} ${t.words}</span>
    <span class="wb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${words.length}" aria-valuenow="${found}"><i style="width:${words.length ? (100 * found) / words.length : 0}%"></i></span>`;
  const tabs = document.createElement("div");
  tabs.className = "wb-tabs";
  for (const { place, title, words: inPlace } of [{ place: "all", title: t.all, words }, ...places]) {
    const button = document.createElement("button");
    button.setAttribute("aria-pressed", String(place === tab));
    button.textContent = `${title} ${inPlace.filter(has).length}/${inPlace.length}`;
    button.addEventListener("click", () => showBook(place));
    tabs.append(button);
  }
  const grid = document.createElement("div");
  grid.className = "wb-grid";
  const inTab = tab === "all" ? words : places.find((p) => p.place === tab)?.words ?? [];
  const unseen = (w) => has(w) && !book[w.sprite].v;
  // New ones first, then the rest found, then what's still to find; on the "all" page those are only counted.
  const shown = [...inTab].sort((a, b) => unseen(b) - unseen(a) || has(b) - has(a));
  const hidden = tab === "all" ? shown.filter((w) => !has(w)).length : 0;
  for (const w of tab === "all" ? shown.filter(has) : shown) {
    const entry = book[w.sprite];
    const card = document.createElement("button");
    card.append(bookPicture(w, entry));
    if (has(w)) {
      if (unseen(w)) {
        card.classList.add("fresh");
        card.dataset.fresh = t.freshMark;
      }
      card.insertAdjacentHTML("beforeend", `${SAMI_SPOKEN ? '<span class="say" aria-hidden="true">🔊</span>' : ""}<span class="se" lang="${SAMI_LANG}">${escapeText(w.lemma)}</span>
        <span class="tr">${escapeText(translation(w))}</span><span class="stars" aria-label="${bookStars(entry.n)} / 3">${starsHtml(entry.n)}</span>`);
      card.addEventListener("click", () => bookPage(w, entry, card));
    } else {
      card.className = "unfound";
      card.disabled = true;
      card.insertAdjacentHTML("beforeend", `<span class="se">? ? ?</span><span class="tr">${t.notYet}</span>`);
    }
    grid.append(card);
  }
  if (hidden) {
    const more = document.createElement("button");
    more.className = "unfound more";
    more.innerHTML = `<span class="tr">${t.more(hidden)}</span>`;
    more.addEventListener("click", () => showBook(places[0]?.place ?? "all"));
    grid.append(more);
  }
  const legend = document.createElement("p");
  legend.className = "wb-legend";
  legend.textContent = t.legend;
  wrap.append(back, head, tabs, grid, legend);
  cardEl.append(wrap);
  // Seen now: they stay marked new on this page, not the next time.
  let changed = false;
  for (const w of inTab) if (unseen(w)) { book[w.sprite].v = 1; changed = true; }
  if (changed) saveBook(book);
  (tabs.querySelector("[aria-pressed=true]") ?? back).focus();
}


// ---------------------------------------------------------------- a word's own page
// Touching a found word opens it big: the animal moves as it does in the forest, from the same picture sheets (art/animals/),
// and the voice says "Dát lea …". Touching the animal plays it again. A thing with no moves of its own bounces instead.

// The moves, from what the sheet holds: standing (0), a tail wagged (5, 6, the dog) or swished (8, 9), pecking (5, the birds),
// a gallop (10, 11), head down to graze (13), a hop (1), four steps of a walk (20–23), a wingbeat (30–33) and a flutter (40–45).
// Each step is a picture, the way it faces (row 0 and 1 both face the player, 2 and 3 away), how long, and how high a hop or flight.
function bookMoves(frames, rows) {
  const has = (f) => frames.includes(f);
  const steps = [];
  const add = (f, r, ms, up = 0) => steps.push({ f, r: r % rows, ms, up });
  const other = rows > 1 ? 1 : 0; // the other way that still looks at the player
  add(0, 0, 500);
  if (has(40)) { // a butterfly flutters all the while, rising and falling
    for (let k = 0; k < 4; k++) for (const f of [40, 41, 42, 43, 44, 45]) add(f, k % 2 ? other : 0, 60, 26);
    return steps;
  }
  const wag = (r, times) => { for (let k = 0; k < times; k++) { add(5, r, 100); add(6, r, 100); } };
  const swish = (r, times) => { for (let k = 0; k < times; k++) { add(8, r, 150); add(9, r, 150); } };
  if (has(5) && has(6)) wag(0, 6);
  else if (has(8) && has(9)) swish(0, 3);
  if (rows > 1) { // a look the other way, and back
    add(0, other, 700);
    if (has(5) && has(6)) wag(other, 4);
    add(0, 0, 400);
  }
  if (has(20)) for (let k = 0; k < 2; k++) for (const f of [20, 21, 22, 23]) add(f, 0, 110);
  if (has(10) && has(11)) for (let k = 0; k < 2; k++) { add(10, other, 120, 6); add(11, other, 120, 6); }
  if (has(13)) { add(13, 0, 1000); add(0, 0, 300); }
  if (has(5) && !has(6)) for (let k = 0; k < 3; k++) { add(5, 0, 180); add(0, 0, 160); }
  if (has(30)) { for (let k = 0; k < 4; k++) for (const f of [30, 31, 32, 33]) add(f, 0, 70, 36); add(0, 0, 300); }
  if (has(1)) for (let k = 0; k < 3; k++) { add(1, k % 2 ? other : 0, 260, 22); add(0, k % 2 ? other : 0, 180); }
  if (frames.length === 1 && rows > 1) for (const r of [1, 2, 3, 0]) add(0, r, 280, 6); // a thing turns round once
  add(0, 0, 600);
  return steps;
}

// The sheet a word's picture is cut from, if it has one: the dog of this round's breed, and things in a colour by their colour.
function bookSheetName(word, entry) {
  const animals = window.MAHTTE_ANIMALS ?? {};
  if (word.sprite === "beana") return animals[`beana-${typeof dogBreed === "string" ? dogBreed : "lapinkoira"}`] ? `beana-${dogBreed}` : null;
  if (entry?.c && animals[`${word.sprite}-${entry.c}`]) return `${word.sprite}-${entry.c}`;
  return animals[word.sprite] ? word.sprite : null;
}

function bookAnimation(word, entry) {
  const name = bookSheetName(word, entry);
  const info = name && window.MAHTTE_ANIMALS[name];
  if (!info || (info.frames.length === 1 && info.rows === 1)) return null; // nothing to move: it bounces instead
  const sheet = new Image();
  sheet.src = `art/animals/${name}.png`;
  const canvasEl = document.createElement("canvas");
  canvasEl.className = "moving";
  const scale = Math.min(320 / info.w, 220 / info.h);
  const pad = 46; // room above for a hop or a flight, and below for its shadow
  canvasEl.width = Math.round(info.w * scale);
  canvasEl.height = Math.round(info.h * scale + pad);
  const g = canvasEl.getContext("2d");
  const steps = bookMoves(info.frames, info.rows);
  const total = steps.reduce((sum, step) => sum + step.ms, 0);
  let started = null, frame = 0;
  const draw = (now) => {
    if (!canvasEl.isConnected && started !== null) return; // closed
    if (started === null) started = now;
    let t = bookCalm() ? 0 : now - started, step = steps[0], into = 0;
    if (t >= total) t = total - 1; // ends standing, until touched again
    for (const s of steps) {
      if (t < s.ms) { step = s; into = t / s.ms; break; }
      t -= s.ms;
    }
    // A hop or a flight rises and falls over its run of steps, not each picture on its own.
    let up = 0;
    if (step.up) {
      const i = steps.indexOf(step);
      let first = i, last = i;
      while (first > 0 && steps[first - 1].up === step.up) first--;
      while (last < steps.length - 1 && steps[last + 1].up === step.up) last++;
      const run = steps.slice(first, last + 1).reduce((sum, s) => sum + s.ms, 0);
      const done = steps.slice(first, i).reduce((sum, s) => sum + s.ms, 0) + into * step.ms;
      up = Math.sin((Math.PI * done) / run) * step.up;
    }
    g.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (sheet.complete && sheet.naturalWidth) {
      const column = Math.max(0, info.frames.indexOf(step.f));
      const ground = canvasEl.height - pad * 0.35;
      g.fillStyle = `rgba(20, 33, 61, ${0.18 - up / 400})`;
      g.beginPath();
      g.ellipse(canvasEl.width / 2, ground - 4, canvasEl.width * (0.3 - up / 600), 8, 0, 0, Math.PI * 2);
      g.fill();
      g.imageSmoothingQuality = "high";
      g.drawImage(sheet, column * info.w, step.r * info.h, info.w, info.h, 0, ground - info.h * scale - up, info.w * scale, info.h * scale);
    }
    if (now - started < total + 100 || !sheet.complete) frame = requestAnimationFrame(draw);
  };
  canvasEl.replay = () => {
    cancelAnimationFrame(frame);
    started = null;
    frame = requestAnimationFrame(draw);
  };
  sheet.onload = () => canvasEl.replay();
  frame = requestAnimationFrame(draw);
  return canvasEl;
}

function bookPage(word, entry, from) {
  const t = bookText();
  document.getElementById("book-page")?.remove();
  const page = document.createElement("div");
  page.id = "book-page";
  page.setAttribute("role", "dialog");
  page.setAttribute("aria-label", word.lemma);
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  const close = document.createElement("button");
  close.className = "close";
  close.setAttribute("aria-label", t.close);
  close.textContent = "✕";
  const stage = document.createElement("button");
  stage.className = "stage";
  if (SAMI_SPOKEN) stage.setAttribute("aria-label", TEXT.hearAgain); // Inari Sámi has no sound yet: the picture only moves again
  const moving = bookAnimation(word, entry);
  const picture = moving ?? bookPicture(word, entry);
  if (!moving) picture.className = "bouncing";
  stage.append(picture);
  const plural = word.forms?.["Pl+Nom"]?.[0];
  const again = document.createElement("button");
  again.className = "again";
  again.textContent = `🔊 ${TEXT.hearAgain}`;
  sheet.append(close, stage);
  sheet.insertAdjacentHTML("beforeend", `<div class="se" lang="${SAMI_LANG}">${escapeText(word.lemma)}</div><div class="tr">${escapeText(translation(word))}</div>
    ${plural ? `<div class="pl">${TEXT.plural} <span lang="${SAMI_LANG}">${escapeText(plural)}</span></div>` : ""}
    <div class="stars" aria-label="${bookStars(entry.n)} / 3">${starsHtml(entry.n)}</div>`);
  if (SAMI_SPOKEN) sheet.append(again);
  page.append(sheet);
  document.body.append(page);
  const play = () => {
    playVoice(bookSound(word, entry));
    if (moving) moving.replay();
    else {
      picture.classList.remove("bouncing");
      void picture.offsetWidth; // to start the bounce again
      picture.classList.add("bouncing");
    }
  };
  const shut = () => {
    window.removeEventListener("keydown", onKey, true);
    page.remove();
    from?.focus();
  };
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      shut();
    }
  };
  window.addEventListener("keydown", onKey, true);
  close.addEventListener("click", shut);
  page.addEventListener("click", (event) => event.target === page && shut());
  stage.addEventListener("click", play);
  again.addEventListener("click", play);
  playVoice(bookSound(word, entry));
  close.focus();
}
