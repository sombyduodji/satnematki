// The language of the help beside the Sámi: Finnish, or Norwegian Bokmål. The Sámi, spoken and written, is the same in both.
// Norwegian is early: only the places in LANG_PLACES have it, and the menu hides the rest. The words' Norwegian is the
// dictionary's (nb in data/starter-words.js); the help below was written for the game and is not yet checked by a native speaker.
const LANG = (() => {
  try {
    return localStorage.getItem("mahtte.lang") === "nb" ? "nb" : "fi";
  } catch {
    return "fi";
  }
})();
const LANGS = [
  { id: "fi", name: "Suomi" },
  { id: "nb", name: "Norsk" },
];
// The places a language has; a language not listed has them all.
const LANG_PLACES = { nb: new Set(["forest"]) };
const placeInLanguage = (place) => !LANG_PLACES[LANG] || LANG_PLACES[LANG].has(place);

function setLanguage(id) {
  try {
    localStorage.setItem("mahtte.lang", id);
  } catch {
    return; // nowhere to keep it, so it would be lost on the reload
  }
  location.reload(); // everything is built in the language it starts with
}

// Nouns that take "et": "Dette er et ekorn". The rest take "en".
const NB_NEUTER = new Set(["ekorn", "hus", "tre"]);
const nbThisIs = (word) => `Dette er ${NB_NEUTER.has(word) ? "et" : "en"} ${word}.`;

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
  take: "Ta",
  helpOn: "Hjelpebobler: på",
  helpOff: "Hjelpebobler: av",
  run: "Løp",
  sit: "Sett deg",
  yourTime: "Tiden din:",
  bestTimes: "Beste tider",
  bestTimesAudio: "Beste tider, bare lyd",
  newRecord: "Ny rekord!",
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
  modeAudio: "Bare lyd",
  modeHint: "Ordene høres bare, og de vises når runden er ferdig.",
  listen: "Lytt",
  hearAgain: "Hør igjen",
  notYet: "Ikke ennå. Hør hva vi leter etter.",
  heardWords: "Du hørte disse ordene",
  demoNotice: "Dette er bare en teknologidemo. Funksjoner og spillbarhet kan fortsatt endre seg mye før en eventuell ferdig versjon. Ingen av oversettelsene er kontrollert, og de er laget automatisk.",
  earlyNotice: "Den norske versjonen er i tidlig utvikling. Foreløpig er bare skogen oversatt. De andre stedene kommer senere.",
  best: "Beste:",
  back: "← Tilbake",
  chooseLevel: "velg nivå",
  chooseActivity: "velg oppgave",
  level: "Nivå",
  levels: (count) => `${count} nivåer`,
  // Below: what isn't in TEXT itself.
  titles: { forest: "Skogen" },
  sections: { "Pelattava demo": "Spillbar demo" },
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

// The game page's own words, by element id: [text, aria-label].
const PAGE_NB = {
  world: [null, "Spillverden"],
  zoom: [null, "Zoom"],
  "guide-close": [null, "Lukk hjelpen"],
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
  "change-outfit": ["Endre figur"],
  "change-place": ["Hovedmeny"],
};
const PAD_NB = { up: "Opp", left: "Til venstre", down: "Ned", right: "Til høyre" };

// TEXT_NB laid over TEXT: objects key by key, right and wrong pair by pair beside the same Sámi.
function textInLanguage(text) {
  if (LANG !== "nb") return text;
  const lay = (into, from) => {
    for (const [key, value] of Object.entries(from)) {
      if (key === "right" || key === "wrong") into[key] = into[key].map(([sme], i) => [sme, value[i]]);
      else if (value && typeof value === "object" && !Array.isArray(value) && into[key] && typeof into[key] === "object") lay(into[key], value);
      else into[key] = value;
    }
  };
  lay(text, TEXT_NB);
  return text;
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
