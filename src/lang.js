// The language of the help beside the Sámi: Finnish, or Norwegian Bokmål. The Sámi, spoken and written, is the same in both.
// Norwegian is early: only the places in LANG_PLACES have it, and the menu hides the rest. The words' Norwegian is the
// dictionary's (nb in data/starter-words.js); the help below was written for the game and is not yet checked by a native speaker.
const LANG = (() => {
  try {
    const chosen = localStorage.getItem("mahtte.lang");
    if (chosen === "nb" || chosen === "fi") return chosen;
  } catch {
    // nothing kept: as for someone who hasn't chosen
  }
  // Not chosen yet: Norwegian for a browser set to Norwegian, as on the start page.
  return (navigator.languages || [navigator.language]).some((l) => /^(nb|nn|no)\b/i.test(l)) ? "nb" : "fi";
})();
const LANGS = [
  { id: "fi", name: "Suomi" },
  { id: "nb", name: "Norsk" },
];
// The places a language has; a language not listed has them all.
const LANG_PLACES = { nb: new Set(["forest", "store", "classroom"]) };

// The Sámi the game teaches, chosen in the main menu: North Sámi (se), written and spoken, or Inari Sámi (smn), written only, as
// Divvun's voices are North Sámi, and for now only in the forest. The Inari words are Sátni FST's (smn in data/starter-words.js,
// from dict-sme-smn), and the Inari sentences in SMN_TEXT are drafts: neither has been checked by an Inari Sámi speaker yet.
let SAMI = (() => {
  try {
    return localStorage.getItem("mahtte.sami") === "smn" ? "smn" : "se";
  } catch {
    return "se";
  }
})();
const SAMIS = [
  { id: "se", name: "Davvisámegiella" },
  { id: "smn", name: "Anarâškielâ" },
];
const SAMI_PLACES = { smn: new Set(["forest"]) };
let SAMI_SPOKEN = SAMI === "se";
let SAMI_LANG = SAMI; // for lang="…" on Sámi text
const placeInLanguage = (place) => (!LANG_PLACES[LANG] || LANG_PLACES[LANG].has(place)) && (!SAMI_PLACES[SAMI] || SAMI_PLACES[SAMI].has(place));

// Switched in place, without reloading: both word lists are kept, and the game redoes what it built from the Sámi
// (samiChanged in game.js). The pictures are the same for both.
function setSami(id) {
  try {
    localStorage.setItem("mahtte.sami", id);
  } catch {
    // Not kept for the next visit, but it still holds for this one.
  }
  SAMI = id;
  SAMI_SPOKEN = SAMI === "se";
  SAMI_LANG = SAMI;
  window.MAHTTE_WORDS = SAMI_WORDS[SAMI];
  feedbackLink();
  samiChanged();
}

// In Inari Sámi only the words that have an Inari translation, shown in Inari. The North Sámi stays in sme; the forms and
// gradation are North Sámi's, so they go.
const SAMI_WORDS = {
  se: window.MAHTTE_WORDS,
  smn: window.MAHTTE_WORDS.filter((w) => w.smn).map((w) => ({ ...w, sme: w.lemma, lemma: w.smn, forms: {}, gradation: null })),
};
window.MAHTTE_WORDS = SAMI_WORDS[SAMI];

const SMN_NOTICE = {
  fi: "Anarâškielâ eli inarinsaame on kokeilu: vain metsä, eikä ääntä vielä ole. Inarinsaamen sanoja ja lauseita ei ole vielä tarkistettu.",
  nb: "Anarâškielâ, enaresamisk, er et forsøk: bare skogen, og ingen lyd ennå. De enaresamiske ordene og setningene er ikke kontrollert ennå.",
};

// What is said in Inari Sámi, with the Finnish and Norwegian beside it. Drafts, put together from Sátni FST's dictionaries and
// spelled by Voikko's Inari Sámi speller, for an Inari Sámi speaker to check (2026-11-12).
const SMN_TEXT = {
  question: (name) => `Mii tuu nommâ lii? Muu nommâ lii ${name}.`,
  bures: (name) => (name ? `Tiervâ, ${name}!` : "Tiervâ!"),
  thisWord: (word) => `Taat lii ${word}.`,
  thisPerson: (word) => `Sun lii ${word}.`,
  right: [
    ["Riehtâ!", "Oikein!", "Riktig!"],
    ["Šiev!", "Hyvä!", "Bra!"],
    ["Čeppi!", "Taitava!", "Flink!"],
    ["Kavnih tom!", "Löysit sen!", "Du fant den!"],
    ["Tot lâi riehtâ!", "Se oli oikein!", "Det var riktig!"],
  ],
  wrong: [
    ["Ij lamaš.", "Ei ollut.", "Det var ikke den."],
    ["Ij val!", "Ei vielä!", "Ikke ennå!"],
    ["Keččâl val!", "Yritä vielä!", "Prøv igjen!"],
    ["Uusâ val!", "Etsi vielä!", "Let videre!"],
  ],
};

function setLanguage(id) {
  try {
    localStorage.setItem("mahtte.lang", id);
  } catch {
    return; // nowhere to keep it, so it would be lost on the reload
  }
  location.reload(); // everything is built in the language it starts with
}

// Nouns that take "et": "Dette er et ekorn", and those said without one, as food often is: "Dette er melk". The rest take "en".
const NB_NEUTER = new Set(["ekorn", "hus", "tre", "eple", "egg", "brød", "knekkebrød", "rugbrød", "jordbær"]);
const NB_MASS = new Set(["melk", "ost", "smør", "kaffe", "te", "saft", "brus", "sjokolade", "syltetøy", "iskrem", "kjøttdeig", "reinkjøtt",
  "røykekjøtt", "svinekjøtt", "kål", "slikkeri", "kjeks", "tyttebær", "molte"]);
// A number is said bare: "Dette er 7."
const nbThisIs = (word) => `Dette er ${NB_MASS.has(word) || /^\d+$/.test(word) ? "" : NB_NEUTER.has(word) ? "et " : "en "}${word}.`;

// The Norwegian of TEXT in src/game.js, by the same keys. right and wrong give only the Norwegian, in the same order.
const TEXT_NB = {
  find: "Finn:",
  found: "Du fant den!",
  thisIs: "Dette er",
  thisIsPerson: "Dette er",
  plural: "Flere:",
  done: "Flott! Du fant alle.",
  again: "Spill igjen",
  start: "Gå med piltastene eller trykk på skjermen. To taster samtidig går langs stiene. Hold Shift nede for å løpe, mellomrom hopper, E tar eller ser på det som er nær, C huker deg ned.",
  ready: "Ferdig",
  makeCharacter: "Lag din egen figur",
  questionFi: (name) => `Hva heter du? Jeg heter ${name}.`,
  buresFi: (name) => (name ? `Hei, ${name}!` : "Hei!"),
  yourName: "Skriv navnet ditt",
  right: ["Riktig!", "Sånn er det!", "Bra!", "Veldig bra!", "Flink!", "Du fant den!", "Det var riktig!", "Kjempebra!", "Veldig flink!", "Nettopp!", "Du kan det!", "Ja, sånn er det!", "Det er riktig!"],
  wrong: ["Nei, la oss prøve igjen!", "Det var ikke den.", "La oss prøve igjen!", "Ikke ennå!", "Det var ikke den. La oss prøve en gang til!", "Det var ikke riktig.", "Prøv en gang til!", "Prøv igjen!", "Let videre!", "Ikke gi opp!", "Det var noe annet."],
  thisWordFi: nbThisIs,
  thisPersonFi: (word) => `Dette er ${word}.`,
  guide: {
    goal: {
      store: "Ta en kurv ved døra med E-tasten, og hent matvarene på handlelista i den rekkefølgen du vil. Gå så til kassa: legg varene på båndet én om gangen med E, ta en pose og gå til døra. Hvis du faller, havner varene på gulvet: gå over dem, så får du dem tilbake.",
      "store-count": "Ta en kurv ved døra og hent matvarene på handlelista. På lista står det hvor mange du trenger av hver, og E tar én om gangen. I kassa legger du varene på båndet, hører prisen på samisk og taster den inn. Ta så en pose og gå til døra.",
      classroom: "Finn riktig tall på en pult. Gå bort til stolen ved pulten og trykk E, så setter du deg og ser på tallet. På mobilen trykker du Sett deg eller på pulten.",
      forest: "Finn dyret som står øverst. Gå bort til det og trykk E, så ser du om det var riktig. Noen dyr sover: snik deg bort til dem ved å holde C nede. Hvis du går eller løper nær dem, våkner dyret og løper sin vei.",
    },
    move: "Gå med piltastene eller WASD, eller trykk på skjermen. På mobilen bruker du knappene.",
    run: "Løp: hold Shift nede. Når du løper, kan du ikke ta noe, og hvis du treffer noe, faller du eller sklir på magen!",
    jump: {
      forest: "Hopp: mellomrom. Hvis du hopper rett på et tre, faller du!",
      camp: "Hopp: mellomrom. Hvis du hopper rett på et tre, faller du!",
      city: "Hopp: mellomrom. Hvis du hopper rett på et kjøretøy eller en vegg, faller du!",
      indoors: "Hopp: mellomrom. Hvis du hopper rett på en hylle eller en vegg, faller du!",
      classroom: "Hopp: mellomrom. Hvis du hopper rett på en pult, faller du!",
    },
    listen: "Hør hva figuren ber deg finne, gå bort til det og trykk E. Du kan høre det igjen med knappen eller R-tasten. Ordene vises når runden er ferdig.",
    crouch: "E: ta eller se på det som er nær. Hold C nede: huk deg ned og gå sakte.",
    crouchClassroom: "E eller C: sett deg på stolen. Når ingen stol er nær, huker C deg ned, og da kan du gå sakte.",
    ok: "OK",
  },
  useIt: "Ta eller se",
  needBasket: "Ta først en kurv ved døra.",
  notOnList: "Dette står ikke på handlelista.",
  taken: () => "Dette er allerede i kurven min.",
  notOnListFi: (word) => `Nei, ${nbThisIs(word.nb).slice(0, -1).replace(/^Dette/, "dette")}, og det står ikke på handlelista.`,
  shoppingList: "Handleliste",
  pickFallen: "Plukk opp varene som falt ned.",
  storePay: "Ta med varene til kassa.",
  storePrice: "Hør prisen og betal med E.",
  storePriceTyped: "Hør prisen, tast den inn og trykk OK.",
  wrongPrice: "Ikke helt. Hør en gang til.",
  storeBag: "Ta en pose ved enden av kassa.",
  storeDoor: "Gå til døra.",
  startClassroom: "Gå med piltastene eller trykk på skjermen. Hold Shift nede for å løpe. Trykk E ved en stol, så setter du deg og ser på tallet. C huker deg ned.",
  emptyDesk: "Det er ikke noe tall på denne pulten.",
  activityNotes: { "Lær tallene": "Grunnleggende", "Skriv tallene": "Middels", "Skriv med ord": "Vanskelig" },
  entrance: "Inngang",
  take: "Ta",
  helpOn: "Hjelpebobler: på",
  clockOn: "Klokke: på",
  clockOff: "Klokke: av",
  helpOff: "Hjelpebobler: av",
  run: "Løp",
  sit: "Sett deg",
  yourTime: "Tiden din:",
  bestTimes: "Beste tider",
  bestTimesAudio: "Beste tider, bare lyd",
  newRecord: "Ny rekord!",
  secondBest: "Nest beste tid!",
  thirdBest: "Tredje beste tid!",
  foundThese: "Du fant disse",
  newInBook: "NY",
  choosePlace: (name) => (name ? `Hei, ${name}! Hvor skal vi?` : "Hvor skal vi?"),
  mainMenu: "Til hovedmenyen",
  changePlayer: "Bytt spiller",
  choosePlayer: "Velg spiller",
  orMakeNew: "eller lag en ny figur nedenfor",
  begin: "Start",
  noTimesYet: "Ingen tider ennå",
  playAgain: "Spill igjen",
  comingLater: "Kommer senere",
  modeBoth: "Lyd og tekst",
  player: "Spiller",
  switchText: "Tekst",
  switchHelp: "Hjelp",
  switchClock: "Klokke",
  samiAsk: "Hvilken samisk lærer du?",
  samiNotes: { se: "nordsamisk · alle steder · lyd", smn: "enaresamisk · bare Skogen · ingen lyd ennå" },
  samiChosen: "valgt",
  samiTrial: "forsøk",
  on: "på",
  off: "av",
  textOn: "lyd og tekst",
  textOff: "bare lyd",
  modeAudio: "Bare lyd",
  modeHint: "Ordene høres bare, og de vises når runden er ferdig.",
  listen: "Lytt",
  hearAgain: "Hør igjen",
  notYet: "Ikke ennå. Hør hva vi leter etter.",
  heardWords: "Du hørte disse ordene",
  demoNotice: "Dette er bare en teknologidemo. Funksjoner og spillbarhet kan fortsatt endre seg mye før en eventuell ferdig versjon. Ingen av oversettelsene er kontrollert, og de er laget automatisk.",
  earlyNotice: "Den norske versjonen er i tidlig utvikling. Foreløpig er skogen, matbutikken og skolen oversatt. De andre stedene kommer senere.",
  best: "Beste:",
  back: "← Tilbake",
  chooseLevel: "velg nivå",
  chooseActivity: "velg oppgave",
  level: "Nivå",
  levels: (count) => `${count} nivåer`,
  // Below: what isn't in TEXT itself.
  titles: { forest: "Skogen", store: "Matbutikken", classroom: "Skolen" },
  activities: { "Opettele numerot": "Lær tallene", "Kirjoita numerot": "Skriv tallene", "Kirjoita sanalla": "Skriv med ord" },
  levelNames: { helppo: "lett", keskitaso: "middels", vaikeampi: "vanskeligere" },
  // What STORE_HINTS in src/game.js say beside the Sámi.
  storeHints: {
    basket: "Ta en kurv", till: "Gå til kassa", wait: "Vent på tur", basketDown: "Sett kurven på disken", basketCloser: "Sett kurven på disken",
    belt: "Legg den på båndet", full: "Båndet er fullt", pay: "Betal", bag: "Ta en pose", door: "Gå til døra",
  },
  sections: { "Pelattava demo": "Spillbar demo", "Numerot ja luvut": "Sifre og tall" },
  choices: {
    Hahmo: "Figur", Poika: "Gutt", Tyttö: "Jente", Hiusväri: "Hårfarge", Hiukset: "Hår", Silmät: "Øyne",
    Platina: "Platina", Vaalea: "Lys", Punainen: "Rød", Ruskea: "Brun", Tumma: "Mørk", Musta: "Svart", Harmaa: "Grå",
    Sininen: "Blå", Vihreä: "Grønn", Pinkki: "Rosa", Liila: "Lilla",
  },
  // The Norwegian Kennel Club's names for the breeds in DOG_BREEDS (src/world.js).
  dogBreeds: {
    lapinkoira: "finsk lapphund", lapinporokoira: "lapsk vallhund", pystykorva: "finsk spets", pohjanpystykorva: "norrbottenspets",
    hirvikoira: "norsk elghund", karhukoira: "karelsk bjørnehund", husky: "siberian husky", labradori: "labrador retriever",
  },
};

// The Norwegian of LESSON_TEXT and LESSON_SPEECH in src/lesson.js: what's said keeps its Sámi, with Norwegian under it.
const LESSON_TEXT_NB = {
  guide: "Du sitter på plassen din og kan ikke reise deg. Læreren skriver et tall på samisk på tavla. Når du kan det, rekker du opp hånda ved å trykke E eller på Rekk opp hånda, og taster tallet med sifre. Hvis du venter for lenge, svarer en klassekamerat først.",
  guideAudio: "Du sitter på plassen din og kan ikke reise deg. Læreren sier et tall på samisk. Når du kan det, rekker du opp hånda ved å trykke E eller på Rekk opp hånda, og taster tallet med sifre. Hvis du venter for lenge, svarer en klassekamerat først.",
  guideWords: "Du sitter på plassen din og kan ikke reise deg. Læreren skriver et tall med sifre på tavla. Når du kan det, rekker du opp hånda ved å trykke E eller på Rekk opp hånda, og skriver tallet med ord på samisk. Du kan skrive i ro: ingen andre svarer imens.",
  raise: "Rekk opp hånda",
  promptWords: "Skriv tallet på tavla på samisk",
  prompt: "Hvilket tall står på tavla?",
  promptAudio: "Hvilket tall er det?",
  start: "Se på tavla. Når du kan tallet, rekker du opp hånda.",
  notYet: "Ikke ennå. Se på tavla og prøv igjen.",
  beaten: (name, word, number) => `${escapeText(name)} rakk det først: <span lang="${SAMI_LANG}">${escapeText(word)}</span> = ${number}.`,
  close: "Lukk",
  wrongWord: "Ikke helt. Rett det og prøv igjen.",
  speechSe: (on) => `Samisk tekst: ${on ? "på" : "av"}`,
  speechFi: (on) => `Norsk tekst: ${on ? "på" : "av"}`,
};
// Only the Norwegian line; the Sámi beside it stays LESSON_SPEECH's own.
const LESSON_SPEECH_NB = {
  hello: "Hei, barn!",
  wrong: "Det var ikke det.",
  end: "Takk, barn!",
  whichDigit: "Hvilket siffer er dette?",
  whichNumber: "Hvilket tall er dette?",
  answer: (number) => `Dette er ${number}. Stemmer det?`,
  praise: ([, sayNb], number, name) => `${sayNb} Dette er ${number}. Bra, ${name}!`,
};

// The game page's own words, by element id: [text, aria-label].
const PAGE_NB = {
  world: [null, "Spillverden"],
  zoom: [null, "Zoom"],
  "guide-close": [null, "Lukk hjelpen"],
  "guide-open": [null, "Vis hjelpen"],
  pad: [null, "Bevegelse"],
  run: ["Løp"],
  jump: ["Hopp"],
  use: ["Ta"],
  crouch: ["Huk"],
  "camp-pack": ["Sekk"],
  "camp-drop": ["Legg ned"],
  "credits-line": ["Ord: GiellaLT / Divvun / Giellatekno (CC BY 4.0). Bøyningsformer: lang-sme (GPL-3.0). Tale: Divvun / Giellatekno."],
  "about-link": ["Om spillet (på finsk)"],
  "credits-link": ["Skapere og lisenser"],
  "feedback-link": ["Gi tilbakemelding"],
  "change-outfit": ["Endre figur"],
  "change-place": ["Hovedmeny"],
};
const PAD_NB = { up: "Opp", left: "Til venstre", down: "Ned", right: "Til høyre" };

// TEXT_NB laid over TEXT: objects key by key, right and wrong pair by pair beside the same Sámi.
function textInLanguage(text) {
  if (SAMI === "smn") {
    for (const key of ["question", "bures", "thisWord", "thisPerson"]) text[key] = SMN_TEXT[key];
    for (const key of ["right", "wrong"]) text[key] = SMN_TEXT[key].map(([smn, fi]) => [smn, fi]);
  }
  if (SAMI === "smn") text.earlyNotice = SMN_NOTICE[LANG] ?? SMN_NOTICE.fi;
  if (LANG !== "nb") return text;
  const lay = (into, from) => {
    for (const [key, value] of Object.entries(from)) {
      if ((key === "right" || key === "wrong") && SAMI === "smn") into[key] = SMN_TEXT[key].map(([smn, , nb]) => [smn, nb]);
      else if (key === "right" || key === "wrong") into[key] = into[key].map(([sme], i) => [sme, value[i]]);
      else if (value && typeof value === "object" && !Array.isArray(value) && into[key] && typeof into[key] === "object") lay(into[key], value);
      else into[key] = value;
    }
  };
  lay(text, TEXT_NB);
  if (SAMI === "smn") text.earlyNotice = SMN_NOTICE.nb;
  return text;
}

// Feedback by e-mail, with the version and language in the subject so a reply can be matched to the build.
function feedbackLink() {
  const feedback = document.getElementById("feedback-link");
  if (!feedback) return;
  const version = document.querySelector("#game-title small")?.textContent ?? "";
  const subject = `Sátnemátki ${version} (${LANG}${SAMI === "smn" ? ", smn" : ""}): ${LANG === "nb" ? "tilbakemelding" : "palaute"}`;
  feedback.href = `mailto:satni@somby.fi?subject=${encodeURIComponent(subject)}`;
}

// The page itself, and the flag buttons beside the title.
function pageInLanguage() {
  document.documentElement.lang = LANG;
  if (LANG === "nb") {
    for (const [id, [text, label]] of Object.entries(PAGE_NB)) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (text) el.textContent = text;
      if (label) el.setAttribute("aria-label", label);
    }
    for (const [dir, label] of Object.entries(PAD_NB)) document.querySelector(`#pad [data-dir=${dir}]`)?.setAttribute("aria-label", label);
  }
  feedbackLink();
  const holder = document.getElementById("lang-switch");
  if (!holder) return;
  holder.setAttribute("aria-label", LANG === "nb" ? "Språk" : "Kieli");
  for (const { id, name } of LANGS) {
    const button = document.createElement("button");
    button.className = `flag flag-${id}`;
    button.title = name;
    button.setAttribute("aria-label", name);
    button.setAttribute("aria-pressed", String(id === LANG));
    button.addEventListener("click", () => id !== LANG && setLanguage(id));
    holder.append(button);
  }
}
pageInLanguage();
