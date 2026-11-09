// One loop: the game names a Sámi word, the player walks their character to the thing it
// means. Touching anything shows its word and translation, so a child who knows
// no words yet can learn by exploring. There is no way to lose.
const WORDS_PER_ROUND = 8;
const FOREST_APART = 14; // tiles between things placed in the forest, if there's room
const STORE_APART = 7; // and on the store's shelves, around the store
const PLACING_TRIES = 20;
const BEST_TIMES = 10;

// Foods bought as a mass stay singular in a shopping list's object form (mielkki, vuoja); the rest are plural (moniid, tomáhtaid).
// Must match UNCOUNTED_FOODS in tools/fetch_voices.py.
const UNCOUNTED_FOODS = new Set(["bread", "milk", "cheese", "butter", "guolli", "icecream", "coffee", "juice", "chocolate", "cake", "soda", "jam"]);
const TEXT = textInLanguage({
  find: "Etsi:",
  found: "Löysit sen!",
  thisIs: "Tämä on",
  thisIsPerson: "Hän on",
  plural: "Monta:",
  done: "Hienoa! Löysit kaikki.",
  again: "Pelaa uudestaan",
  start: "Liiku nuolinäppäimillä tai napauta. Kaksi näppäintä yhdessä liikkuu polkujen suuntaan. Shift pohjassa juokset, välilyönti hyppää, E ottaa tai katsoo sen, mikä on lähellä, C kyykistää.",
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
      home: "Etsi se tai hän, jonka nimi lukee ylhäällä. Mene lähelle ja paina E, niin näet, oliko se oikea.",
      forest: "Etsi eläin, jonka nimi lukee ylhäällä. Mene sen luo ja paina E, niin näet, oliko se oikea. Jotkin eläimet nukkuvat: hiivi luo kyykyssä pitämällä C pohjassa. Jos kävelet tai juokset lähellä, eläin herää ja juoksee karkuun.",
      "city-names": "Etsi se, jonka nimi lukee ylhäällä. Mene sen luo ja paina E, niin näet, oliko se oikea.",
      "city-mixed": "Etsi ajoneuvo, jonka nimi ja väri lukevat ylhäällä, esimerkiksi biila: ruoksat.",
      city: "Etsi ajoneuvo, joka lukee ylhäällä, esimerkiksi rukses biila.",
      "library-books": "Kaikki ovat kirjoja, joten katso väriä. Etsi hyllyistä kirja, jonka väri lukee ylhäällä.",
      "library-mixed": "Etsi tavara, jonka nimi ja väri lukevat ylhäällä, esimerkiksi girji: ruoksat. Kirjat ovat hyllyissä, kynät ja vihot pöydillä.",
      library: "Etsi tavara, joka lukee ylhäällä, esimerkiksi rukses girji. Kirjat ovat hyllyissä, kynät ja vihot pöydillä.",
      store: "Ota kori oven vierestä E-näppäimellä ja hae ostoslistan ruoat koriin missä järjestyksessä haluat. Mene sitten kassalle: laita ostokset hihnalle yksi kerrallaan E:llä, ota kassi ja mene ovelle. Jos kaadut, ostokset putoavat lattialle: kävele niiden yli, niin saat ne takaisin.",
      gearstore: "Ota kori oven vierestä E-näppäimellä ja hae ostoslistan tavarat koriin missä järjestyksessä haluat. Työkalut ja kalastustarvikkeet ovat tauluilla, vaatteet rekeissä ja isot tavarat omassa näyttelytilassaan kaupan oikealla puolella. Mene sitten kassalle: laita ostokset hihnalle yksi kerrallaan E:llä, ota kassi ja mene ovelle.",
      "gearstore-count": "Ota kori oven vierestä ja hae ostoslistan tavarat. Listassa lukee, montako kutakin tarvitaan, ja E ottaa yhden kerrallaan. Kassalla laita ostokset hihnalle, kuuntele hinta saameksi ja näppäile se. Ota sitten kassi ja mene ovelle.",
      "store-count": "Ota kori oven vierestä ja hae ostoslistan ruoat. Listassa lukee, montako kutakin tarvitaan, ja E ottaa yhden kerrallaan. Kassalla laita ostokset hihnalle, kuuntele hinta saameksi ja näppäile se. Ota sitten kassi ja mene ovelle.",
      camp: "",
      classroom: "Etsi oikea numero pulpetilta. Mene pulpetin tuolin luo ja paina E, niin istut ja katsot numeron. Puhelimessa paina Istu tai napauta pulpettia.",
    },
    move: "Liiku nuolilla tai WASD-näppäimillä tai napauta. Puhelimessa käytä painikkeita.",
    run: "Juokse: pidä Shift pohjassa. Juostessa et voi ottaa mitään, ja jos osut johonkin, kaadut tai liu'ut mahallasi!",
    jump: {
      forest: "Hyppää: välilyönti. Jos hyppäät päin puuta, kaadut!",
      camp: "Hyppää: välilyönti. Jos hyppäät päin puuta, kaadut!",
      city: "Hyppää: välilyönti. Jos hyppäät päin ajoneuvoa tai seinää, kaadut!",
      indoors: "Hyppää: välilyönti. Jos hyppäät päin hyllyä tai seinää, kaadut!",
      classroom: "Hyppää: välilyönti. Jos hyppäät päin pulpettia, kaadut!",
    },
    listen: "Kuuntele, mitä hahmo pyytää etsimään, mene sen luo ja paina E. Kuule pyyntö uudelleen painikkeesta tai R-näppäimestä. Sanat näkyvät kierroksen lopussa.",
    crouch: "E: ota tai katso se, mikä on lähellä. C pohjassa: kyykisty ja kävele hitaasti kyykyssä.",
    crouchClassroom: "E tai C: istu tuolille. Kun tuoli ei ole lähellä, C kyykistää, ja kyykyssä voi kävellä hitaasti.",
    ok: "OK",
  },
  useIt: "Ota tai katso",
  helpOn: "Ohjekuplat: päällä",
  helpOff: "Ohjekuplat: pois",
  needBasket: "Ota ensin kori oven vierestä.",
  enough: (word) => `Doarvái ${word.forms[UNCOUNTED_FOODS.has(word.sprite) ? "Sg+Acc" : "Pl+Acc"][0]}`,
  notOnList: "Tämä ei ole ostoslistallani.",
  taken: (word) => (PLURAL_ONLY[word.sprite] ? "Nämä ovat jo korissani." : "Tämä on jo korissani."),
  notOnListFi: (word) => (PLURAL_ONLY[word.sprite] ? `Ei, ${PLURAL_ONLY[word.sprite].fi.toLowerCase().slice(0, -1)}, eivätkä ne ole ostoslistallani.` : `Ei, tämä on ${word.fi}, eikä se ole ostoslistallani.`),
  shoppingList: "Ostoslista",
  pickFallen: "Kerää vielä putonneet ostokset.",
  storePay: "Vie ostokset kassalle.",
  storePrice: "Kuuntele hinta ja maksa E:llä.",
  storePriceTyped: "Kuuntele hinta, näppäile se ja paina E.",
  wrongPrice: "Ei aivan. Kuuntele uudelleen.",
  euro: "€",
  storeBag: "Ota kassi kassan päästä.",
  storeDoor: "Mene ovelle.",
  startClassroom: "Liiku nuolinäppäimillä tai napauta. Shift pohjassa juokset. Paina E tuolin luona, niin istut ja katsot numeron. C kyykistää.",
  emptyDesk: "Tällä pulpetilla ei ole numeroa.",
  run: "Juokse",
  sit: "Istu",
  yourTime: "Aikasi:",
  bestTimes: "Parhaat ajat",
  bestTimesAudio: "Parhaat ajat, vain ääni",
  newRecord: "Uusi ennätys!",
  choosePlace: (name) => (name ? `Hei, ${name}! Minne mennään?` : "Minne mennään?"),
  mainMenu: "Päävalikkoon",
  changePlayer: "Vaihda pelaajaa",
  choosePlayer: "Valitse pelaaja",
  orMakeNew: "tai tee uusi hahmo alla",
  begin: "Aloita",
  noTimesYet: "Ei vielä aikoja",
  playAgain: "Pelaa taas",
  comingLater: "Tulossa myöhemmin",
  modeBoth: "Ääni ja teksti",
  modeAudio: "Vain ääni",
  modeHint: "Sanat kuuluvat vain ääneen, ja ne näkyvät kierroksen lopussa.",
  listen: "Kuuntele",
  hearAgain: "Kuuntele uudelleen",
  notYet: "Ei vielä. Kuuntele, mitä etsimme.",
  heardWords: "Kuulit nämä sanat",
  demoNotice: "Tämä on vain teknologiademo. Ominaisuudet ja pelattavuus voivat vielä muuttua paljon mahdollista lopullista versiota varten. Yhtäkään käännöstä ei ole tarkistettu, ja ne on tehty automaattisesti.",
  best: "Paras:",
  back: "← Takaisin",
  chooseLevel: "valitse taso",
  chooseActivity: "valitse tehtävä",
  activityNotes: { "Opettele numerot": "Perustaso", "Kirjoita numerot": "Keskivaikea", "Kirjoita sanalla": "Vaikea" },
  level: "Taso",
  levels: (count) => `${count} tasoa`,
  take: "Ota",
  entrance: "Sisään", // the sign over the store's way in
});

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
// A word that is only plural, as skárrit, takes the colour's plural: "skárrit leat ruoksadat", "sakset ovat punaiset".
const easyPhrase = (noun, colour) => {
  if (PLURAL_ONLY[noun.sprite]) {
    const sme = colour.forms["Pl+Nom"][0], fi = FINNISH_PLURAL_COLOURS[colour.sprite];
    return {
      spoken: "easy", lemma: `${noun.lemma} leat ${sme}`, fi: `${noun.fi} ovat ${fi}`, aim: sme, aimOf: noun.lemma,
      thisWord: `Dát ${noun.lemma} leat ${sme}.`, thisWordFi: `Nämä ${noun.fi} ovat ${fi}.`,
      forms: { "Pl+Nom": [`${noun.lemma} leat ${sme}`] },
    };
  }
  return {
    spoken: "easy",
    lemma: `${noun.lemma} lea ${colour.forms["Sg+Nom"][0]}`,
    fi: `${noun.fi} on ${colour.fi}`,
    aim: colour.forms["Sg+Nom"][0],
    aimOf: noun.lemma,
    thisWord: `Dát ${noun.lemma} lea ${colour.forms["Sg+Nom"][0]}.`,
    thisWordFi: `Tämä ${noun.fi} on ${colour.fi}.`,
    forms: { "Pl+Nom": [`${noun.forms["Pl+Nom"][0]} leat ${colour.forms["Pl+Nom"][0]}`] },
  };
};
const FINNISH_PLURAL_COLOURS = { red: "punaiset", blue: "siniset", yellow: "keltaiset", green: "vihreät", white: "valkoiset", black: "mustat", grey: "harmaat", brown: "ruskeat", orange: "oranssit" };

// Harder: the colour's attributive form goes before the noun. "rukses biila".
const attributivePhrase = (noun, colour) => ({
  spoken: "hard",
  lemma: `${colour.forms.Attr[0]} ${noun.lemma}`,
  fi: `${PLURAL_ONLY[noun.sprite] ? FINNISH_PLURAL_COLOURS[colour.sprite] : colour.fi} ${noun.fi}`,
  forms: { "Pl+Nom": [`${colour.forms.Attr[0]} ${noun.forms["Pl+Nom"][0]}`] },
  // A word that is only plural takes leat and ovat: "Dát leat rukses skárrit", "Nämä ovat punaiset sakset".
  ...(PLURAL_ONLY[noun.sprite] && {
    thisWord: `Dát leat ${colour.forms.Attr[0]} ${noun.lemma}.`,
    thisWordFi: `Nämä ovat ${FINNISH_PLURAL_COLOURS[colour.sprite]} ${noun.fi}.`,
  }),
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

// A round in the forest has one to three birds on the map, at least one of them to find; the rest are other animals.
const FOREST_BIRDS = new Set(["rievssat", "goahppil", "beahceloddi", "garanas", "njukca", "goaskin", "jievjaskuolfi"]);

function forestWords(findCount, extraCount) {
  const animals = shuffled(wordsOfTheme("animal"));
  const [firstBird, ...birds] = animals.filter((w) => FOREST_BIRDS.has(w.sprite)).slice(0, 1 + Math.floor(Math.random() * 3));
  const others = animals.filter((w) => !FOREST_BIRDS.has(w.sprite)).slice(0, findCount + extraCount - birds.length - 1);
  const words = [firstBird, ...shuffled([...birds, ...others])];
  return { find: words.slice(0, findCount), extra: words.slice(findCount) };
}

// A few of each kind of place in a round, so that things are spread all around the store and don't pile up in the crates.
const STORE_ROOM = { shelf: 4, fridge: 3, freezer: 4, produce: 3, pallet: 1 };
const MEAT_WANTED = 0.5;
function storeWords(findCount, extraCount) {
  // All the food is in the store, each always in its own place: what the list asks for changes, what's on the shelves doesn't.
  const food = shuffled(wordsOfTheme("food").filter((word) => window.MAHTTE_MAPS.store.stock[word.sprite]));
  const meats = food.filter((word) => word.place === "meat");
  const room = {};
  const others = food.filter((word) => {
    if (word.place === "meat") return false;
    room[word.place] = (room[word.place] ?? 0) + 1;
    return room[word.place] <= STORE_ROOM[word.place];
  });
  const wanted = Math.random() < MEAT_WANTED ? [meats[0]] : [];
  const find = shuffled([...wanted, ...others.slice(0, findCount - wanted.length)]);
  return { find, extra: food.filter((word) => !find.includes(word)) };
}

// The general store has no meat counter. A few of each kind of thing, and all the big ones, so that the showroom is never empty.
const GEAR_ROOM = { tools: 5, fishing: 5, clothes: 4, platform: 4 };
function gearWords(findCount, extraCount) {
  const room = {};
  const gear = shuffled(wordsOfTheme("gear")).filter((word) => {
    room[word.place] = (room[word.place] ?? 0) + 1;
    return room[word.place] <= GEAR_ROOM[word.place];
  });
  const find = gear.slice(0, findCount);
  // Everything is in the store, each always in its own place (stock in data/map.js), as in the grocery store.
  return { find, extra: wordsOfTheme("gear").filter((word) => !find.includes(word) && window.MAHTTE_MAPS.gearstore.stock?.[word.sprite]) };
}

const THEMES = [
  { id: "home", title: "Koti", place: "home", sprite: "sofa", words: () => plainWords("home", 8, 99) },
  { id: "forest", title: "Metsä", place: "forest", sprite: "rieban", words: () => forestWords(8, 6) },
  { id: "city-names", title: "Parkkipaikka", level: "helppo", example: "biila", place: "city", sprite: "car", colour: "red", words: () => carParkWords(8, 4) },
  { id: "city-mixed", title: "Parkkipaikka", level: "keskitaso", example: "biila: vielgat", place: "city", sprite: "bus", colour: "yellow", words: () => colouredWords("vehicle", 6, 5, easyPhrase) },
  { id: "city", title: "Parkkipaikka", level: "vaikeampi", example: "vilges biila", place: "city", sprite: "truck", colour: "blue", words: () => colouredWords("vehicle", 6, 5, attributivePhrase) },
  { id: "library-books", title: "Kirjasto", level: "helppo", example: "girji: alit", place: "library", sprite: "book", colour: "blue", words: () => colouredWords("item", 5, 2, easyPhrase, { ...EASY, nouns: ["book"] }) },
  { id: "library-mixed", title: "Kirjasto", level: "keskitaso", example: "peanna: čáhppat", place: "library", sprite: "pen", colour: "red", words: () => colouredWords("item", 6, 5, easyPhrase) },
  { id: "library", title: "Kirjasto", level: "vaikeampi", example: "vilges girji", place: "library", sprite: "notebook", colour: "green", words: () => colouredWords("item", 6, 5, attributivePhrase) },
  { id: "store", title: "Ruokakauppa", level: "helppo", example: "mielki", place: "store", sprite: "apple", ordered: true, words: () => storeWords(5 + Math.floor(Math.random() * 2), 6) },
  { id: "store-count", title: "Ruokakauppa", level: "vaikeampi", example: "3 × mielkki", place: "store", sprite: "milk", ordered: true, counts: true, words: () => storeWords(5 + Math.floor(Math.random() * 2), 6) },
  { id: "gearstore", title: "Rautakauppa", level: "helppo", example: "veažir", place: "gearstore", sprite: "hammer", ordered: true, words: () => gearWords(5 + Math.floor(Math.random() * 2), 6) },
  { id: "gearstore-count", title: "Rautakauppa", level: "vaikeampi", example: "3 × vuokka", place: "gearstore", sprite: "boat", ordered: true, counts: true, words: () => gearWords(5 + Math.floor(Math.random() * 2), 6) },
  { id: "camp", title: "Laavu", place: "camp", sprite: "lavvu", camp: true, words: () => ({ find: [], extra: [] }) },
  { id: "numbers-10", title: "Koulu", section: "Numerot ja luvut", activity: "Opettele numerot", level: "0–10", place: "classroom", number: 7, desks: true, words: () => numberWords(10, 7, 4) },
  { id: "numbers-20", title: "Koulu", section: "Numerot ja luvut", activity: "Opettele numerot", level: "0–20", place: "classroom", number: 15, desks: true, words: () => numberWords(20, 10, 8) },
  { id: "numbers-100", title: "Koulu", section: "Numerot ja luvut", activity: "Opettele numerot", level: "0–100", place: "classroom", number: 64, desks: true, words: () => numberWords(100, 10, 8) },
  ...[[9, 4], [20, 16], [100, 42]].map(([most, number]) => ({ id: `lesson-${most}`, title: "Koulu", section: "Numerot ja luvut", activity: "Kirjoita numerot", level: `0–${most}`, place: "lesson", menuPlace: "classroom", number, lesson: true, most, words: () => ({ find: [], extra: [] }) })),
  ...[[9, 6], [20, 14], [100, 86]].map(([most, number]) => ({ id: `lesson-words-${most}`, title: "Koulu", section: "Numerot ja luvut", activity: "Kirjoita sanalla", level: `0–${most}`, place: "lesson", menuPlace: "classroom", number, lesson: true, inWords: true, most, words: () => ({ find: [], extra: [] }) })),
];
if (LANG === "nb") {
  for (const option of THEMES) {
    option.title = TEXT_NB.titles[option.place] ?? option.title;
    option.level = TEXT_NB.levelNames[option.level] ?? option.level;
  }
}
let theme = null;
let shoppingList = [];
const translation = (word) => (LANG === "nb" ? word.nb : word.fi);
// Words that are only plural, as buvssat: "Dát leat buvssat", and their object form is the plural's. Must match PLURAL_ONLY in tools/fetch_voices.py.
const PLURAL_ONLY = { trousers: { sme: "Dát leat buvssat.", fi: "Nämä ovat housut." }, scissors: { sme: "Dát leat skárrit.", fi: "Nämä ovat sakset." } };
const thisIs = (word) => word.thisWord || PLURAL_ONLY[word.sprite]?.sme || TEXT.thisWord(word.lemma);
const thisIsFi = (word) => word.thisWordFi || PLURAL_ONLY[word.sprite]?.fi || TEXT.thisWordFi(translation(word));

// Character art comes from tools/make_mahtte.py, one sheet per combination.
// Everything facing left is mirrored. Jump and crouch are drawn facing the player.
const CHOICES = [
  { key: "gender", label: "Hahmo", options: [["boy", "Poika"], ["girl", "Tyttö"]] },
  { key: "outfit", label: "Gákti", options: [["ohcejohka", "1"], ["karasjohka", "2"]] }, // numbered on purpose: no place names for players
  { key: "hair", label: "Hiusväri", slider: true, options: [["platinum", "Platina"], ["blond", "Vaalea"], ["red", "Punainen"], ["brown", "Ruskea"], ["dark", "Tumma"], ["black", "Musta"], ["gray", "Harmaa"]] },
  { key: "length", label: "Hiukset", byGender: true },
  // These two are a place along the list, with every shade between: see rampAt.
  { key: "eyes", label: "Silmät", slider: true, options: [["blue", "Sininen"], ["green", "Vihreä"], ["gray", "Harmaa"], ["pink", "Pinkki"], ["lilac", "Liila"], ["brown", "Ruskea"], ["black", "Musta"]] },
];
if (LANG === "nb") {
  const say = (text) => TEXT_NB.choices[text] ?? text;
  for (const choice of CHOICES) {
    choice.label = say(choice.label);
    choice.options = choice.options?.map(([value, text]) => [value, say(text)]);
  }
}
// Each gender's own, numbered, in the same order as HAIR_STYLES in tools/make_mahtte.py.
const numberedStyles = (styles) => styles.map((id, i) => [id, String(i + 1)]);
const STYLES = {
  boy: numberedStyles(["short", "tousled", "parting", "swept", "crop", "fringe", "mid", "lowtail", "curls"]),
  girl: numberedStyles(["short", "tousled", "mid", "long", "braids", "bun", "ponytail", "bob", "curls"]),
};
// What a style a gender no longer has, or one chosen for the other gender, becomes.
const NEAREST_STYLE = { long: "mid", braids: "lowtail", bun: "lowtail", ponytail: "lowtail", bob: "fringe", parting: "short", swept: "short", crop: "short", fringe: "bob", lowtail: "ponytail" };
const styleFor = (gender, style) => (STYLES[gender].some(([id]) => id === style) ? style : NEAREST_STYLE[style] ?? DEFAULT_STYLE[gender]);
// A sheet is drawn with these key colours for hair and irises, dark to light, and they're swapped for the player's choice as it
// loads. HAIR_RAMPS is the same as HAIRS in tools/make_mahtte.py, and the keys as HAIR and IRIS there.
const HAIR_KEYS = [0xfe00a1, 0xfe00a2, 0xfe00a3], EYE_KEYS = [0x00fea1, 0x00fea2, 0x00fea3];
const HAIR_RAMPS = {
  platinum: [0xb8a578, 0xe8dcb4, 0xfbf5dc], blond: [0xa9782c, 0xdcae4e, 0xf6d98a], red: [0x7c2a14, 0xb5481d, 0xe27a3a], brown: [0x2f1b17, 0x55321f, 0x835433],
  dark: [0x1c1210, 0x35231b, 0x54392a], black: [0x0f0d10, 0x1f1b20, 0x3a3338], gray: [0x5c5f62, 0x93979a, 0xcfd2d3],
};
const HAIR_ORDER = ["platinum", "blond", "red", "brown", "dark", "black", "gray"];
const EYE_RAMPS = {
  blue: [0x2450a6, 0x3a78d6, 0x6ea6ee], green: [0x1f7a3e, 0x35a85a, 0x6bd487], gray: [0x5d6873, 0x87929d, 0xb4bdc6], pink: [0xc23c86, 0xee62a8, 0xfa9ccb],
  lilac: [0x6d48b0, 0x9570d8, 0xbfa2ee], brown: [0x4f2d15, 0x7a4a24, 0xa36c3a], black: [0x17131c, 0x2a2430, 0x443b4c],
};
const EYE_ORDER = ["blue", "green", "gray", "pink", "lilac", "brown", "black"];
const hexColour = (colour) => `#${colour.toString(16).padStart(6, "0")}`;
// The colours at a place on a slider, blended between the two nearest.
function rampAt(order, ramps, place) {
  const below = Math.min(order.length - 2, Math.floor(place)), part = place - below;
  const mix = (a, b) => [16, 8, 0].reduce((sum, shift) => sum + (Math.round(((a >> shift) & 255) * (1 - part) + ((b >> shift) & 255) * part) << shift), 0);
  return ramps[order[below]].map((tone, i) => mix(tone, ramps[order[below + 1]][i]));
}
const eyeRamp = (place) => rampAt(EYE_ORDER, EYE_RAMPS, place);
const hairRamp = (place) => rampAt(HAIR_ORDER, HAIR_RAMPS, place);
const DEFAULT_STYLE = { boy: "short", girl: "long" };
const optionsFor = (choice, { gender }) => (choice.byGender ? STYLES[gender] : choice.options);
const NAMES = { boy: "Máhtte", girl: "Biret" };
const VOICES = { boy: "mahtte", girl: "biret" };
const BUBBLE_MIN_MS = 1800;
const NAME_MAX = 15;
const LINE_MAX_MS = 8000; // a line that never finishes must not silence the rest of the game
const ANNOUNCE_MS = 3000;
const ANNOUNCE_PAUSE_MS = 900; // after the last find, before the next word appears
const DEFAULT_LOOK = { gender: "boy", outfit: "ohcejohka", hair: 3, length: "short", eyes: 0 };
const FRAME_W = 24;
const FRAME_H = 40;
const SHEET_DETAIL = 4; // a sheet's pixels to each of the world's
// Where a frame is on its sheet: two of the animation rows side by side, so that the sheet isn't too tall for a browser.
const SHEET_ROWS_ACROSS = 2, SHEET_ROW_WIDTH = 8;
const sheetX = (column, row) => (column + (row % SHEET_ROWS_ACROSS) * SHEET_ROW_WIDTH) * FRAME_W * SHEET_DETAIL;
const sheetY = (row) => Math.floor(row / SHEET_ROWS_ACROSS) * FRAME_H * SHEET_DETAIL;
const IDLE_ROW = { down: 0, up: 1, right: 2, left: 2 };
const ACTIONS = {
  chop: { row: 101, ms: 560 },
  saw: { row: 102, ms: 500 },
  throw: { row: 103, ms: 420 },
  cheer: { row: 6, ms: 540 },
  raiseHand: { row: 6, ms: 900 },
  pick: { row: 6, ms: 320 }, // a quick reach, with the cheer's arms until there is a drawing of it
  belt: { row: 111, ms: 720 }, // down to the basket on the floor and up onto the belt
  pat: { row: 99, ms: 1050 }, // to the right, with the hand low; 100 has it high
};
const CROUCH_ROW = 8;
const CROUCH_WALK_ROWS = 106; // low down and slow, facing down, up, right, lower right and upper right, as with RUN_FACING
const CROUCH_SPEED = 0.45;
const STEP_LOUDNESS = { crouch: 0.5, walk: 0.8, run: 1.1 }; // of the footstep sounds' base volume
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
const LESSON_HAND_ROW = 104, LESSON_SIT_ROW = 105;
// lookAhead: a straight run into something within this many tiles dives in time. pathWidth: how close to the runner's
// centre line it must be. contact: how much of a step being pushed back by anything counts as hitting it, so only
// a shallow brush along something is run past.
const SLIDE = { ms: 340, lookAhead: 1.1, contact: 0.3, headOn: 0.35, freeAhead: 0.8, restMs: 380 };
const RUN = { speed: 1.8, animation: 1.7, cloth: 1.9 };
const JUMP = { ms: 520, height: 14, clears: 6 }; // height is half the character; above clears, low things pass under
const dusty = () => placeName === "forest" || placeName === "camp"; // puffs of dust are for outdoors in the forest, not town or indoors
const DUST = { path: "240, 228, 196", ground: "214, 208, 164" }; // pale, to show on both; none on the bridge, in town or indoors
const LINE_FADE = 0.07; // seconds a line takes to fade when something new is said over it
const SOUND_AHEAD = 0.015; // sounds start this far ahead, as starting "now" can already be slightly too late
const SOFT_START = 0.012; // seconds for a sound to fade in; starting at full level clicks
const KNOCK = { sitAt: 220, wipeAt: 1000, wipeFrameMs: 120, pushMs: 220, pushSpeed: 0.003 };
// Getting up, two strokes with each hand while bent over, then shaking the hem.
const WIPE_ORDER = [0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7];
const sheetCache = new Map();

function sheetFor({ outfit, gender, hair, length, eyes }) {
  const name = `${outfit}-${gender}-${length}`;
  const had = sheetCache.get(name);
  if (had?.complete && (had.eyes !== eyes || had.hair !== hair)) recolourSheet(had, hair, eyes);
  if (!had) {
    // A sheet takes a lot of memory, and only the one being played is needed.
    sheetCache.clear();
    const sheet = document.createElement("canvas");
    sheet.complete = false;
    const image = new Image();
    image.onload = () => {
      sheet.width = image.width;
      sheet.height = image.height;
      sheet.getContext("2d").drawImage(image, 0, 0);
      findKeyColours(sheet);
      recolourSheet(sheet, look.hair, look.eyes);
      sheet.complete = true;
    };
    image.src = `art/mahtte/sprites/${name}.png`;
    sheetCache.set(name, sheet);
  }
  return sheetCache.get(name);
}

// As the bytes lie in memory: red first, with alpha on top.
const inMemory = (colour) => (0xff000000 | ((colour & 0xff) << 16) | (colour & 0xff00) | (colour >> 16)) >>> 0;

// Notes where the hair and the irises are, so that they can change colour at any time.
function findKeyColours(sheet) {
  const g = sheet.getContext("2d");
  const data = new Uint32Array(g.getImageData(0, 0, sheet.width, sheet.height).data.buffer);
  const tones = new Map([...HAIR_KEYS.map((key, i) => [inMemory(key), i]), ...EYE_KEYS.map((key, i) => [inMemory(key), i + HAIR_KEYS.length])]);
  const places = [...HAIR_KEYS, ...EYE_KEYS].map(() => []);
  for (let i = 0; i < data.length; i++) {
    const tone = tones.get(data[i]);
    if (tone !== undefined) places[tone].push(i);
  }
  sheet.keyPlaces = places.map((list) => Int32Array.from(list));
}

function recolourSheet(sheet, hair, eyes) {
  const g = sheet.getContext("2d");
  const pixels = g.getImageData(0, 0, sheet.width, sheet.height);
  const data = new Uint32Array(pixels.data.buffer);
  [...hairRamp(hair), ...eyeRamp(eyes)].forEach((tone, i) => {
    const colour = inMemory(tone);
    for (const at of sheet.keyPlaces[i]) data[at] = colour;
  });
  g.putImageData(pixels, 0, 0);
  sheet.glVersion = (sheet.glVersion ?? 0) + 1; // for the GPU, which keeps its own copy
  sheet.hair = hair;
  sheet.eyes = eyes;
}

// The mouth, a little open while the character is the one speaking. x and y are the world's, for the frame's top left corner.
function paintTalkingMouth(g, row, column, x, y, flip, scale, now) {
  if (!playerTalking) return;
  const mouth = window.MAHTTE_MOUTHS?.[look.gender]?.[row]?.[column];
  if (!mouth) return;
  const open = 0.28 + 0.72 * Math.abs(Math.sin(now / 85));
  const at = flip ? FRAME_W * SHEET_DETAIL - mouth[0] : mouth[0];
  g.fillStyle = "#6e2230";
  g.beginPath();
  g.ellipse(x + (at / SHEET_DETAIL) * scale, y + ((mouth[1] + 1) / SHEET_DETAIL) * scale, Math.max(0.42, mouth[2] / SHEET_DETAIL / 2.3) * scale, 0.52 * open * scale, 0, 0, Math.PI * 2);
  g.fill();
}

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

const promptEl = document.getElementById("prompt");
const noteEl = document.getElementById("note"); // the shopping list, there all round, beside whatever the prompt says
const cardEl = document.getElementById("card");
// How to play, over the picture, until it's closed. It comes back with the next round.
const guideBox = document.getElementById("guide-box");
document.getElementById("guide-close").addEventListener("click", () => {
  guideBox.hidden = true;
  canvas.focus?.();
});
function showGuideBox(html) {
  cardEl.className = "";
  cardEl.innerHTML = "";
  guideBox.lastElementChild.innerHTML = html;
  guideBox.hidden = false;
}
const pictureCache = new Map();
function pictureOf(word) {
  const key = `${word.sprite}/${word.colour || ""}/${word.number ?? ""}/${viewDetail}`;
  // One made ahead that hasn't loaded yet is only for now.
  if (window.MAHTTE_ANIMALS?.[word.sprite] && !bakedAnimal(word.sprite, 0, 0)) return modelPicture(word.sprite, word.colour);
  if (!pictureCache.has(key)) {
    pictureCache.set(key, word.number !== undefined ? numberCard(word.number)
      : VEHICLES[word.sprite] ? vehiclePicture(word.sprite, word.colour)
      : MODELS[word.sprite] ? modelPicture(word.sprite, word.colour)
      : spriteCanvas(SPRITES[word.sprite], word.colour));
  }
  return pictureCache.get(key);
}

// A number on a card, for the top of a desk. The plain picture only holds its size; the fine one is what's seen.
const CARD_DETAIL = 4;
function numberCard(number) {
  const text = String(number);
  const c = document.createElement("canvas");
  c.width = text.length * 7 + 6;
  c.height = SPRITE_SIZE;
  c.fine = document.createElement("canvas");
  c.fine.width = c.width * CARD_DETAIL;
  c.fine.height = c.height * CARD_DETAIL;
  c.fine.detail = CARD_DETAIL;
  const g = c.fine.getContext("2d");
  g.scale(CARD_DETAIL, CARD_DETAIL);
  const top = SPRITE_SIZE - 15, high = 13;
  g.fillStyle = "#4a3a2a";
  g.beginPath();
  g.roundRect(0, top, c.width, high, 1.4);
  g.fill();
  g.fillStyle = "#fbf6e8";
  g.beginPath();
  g.roundRect(0.4, top + 0.4, c.width - 0.8, high - 0.8, 1.1);
  g.fill();
  g.fillStyle = "#c8372d";
  g.font = 'bold 12px Ubuntu, "DejaVu Sans", Verdana, sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, top + high / 2 + 0.6);
  return c;
}

let look = loadLook();
let chosen = look !== null;
look = look || { ...DEFAULT_LOOK };
let walkClock = 0;
let action = null; // { name, start } while an animation plays
let crouching = false;
let objects = [];
// What else stands in a place that isn't asked for, as the kitchen's other chairs at home: in the way as things are, never found.
let decorThings = [];
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
    // Saved before the sliders, or before eyes could be chosen.
    if (saved && typeof saved.eyes !== "number") saved.eyes = Math.max(0, EYE_ORDER.indexOf(saved.eyes));
    if (saved?.gender in STYLES) saved.length = styleFor(saved.gender, saved.length);
    if (saved && typeof saved.hair !== "number") saved.hair = HAIR_ORDER.includes(saved.hair) ? HAIR_ORDER.indexOf(saved.hair) : DEFAULT_LOOK.hair;
    return saved?.gender in STYLES && CHOICES.every((c) => c.slider || optionsFor(c, saved).some(([id]) => id === saved[c.key])) ? saved : null;
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

// ------------------------------------------------------------- players
// Everyone who has played on this device: a name, a look and a portrait, so that a player can be picked again instead of made anew,
// and their best times show with their face. The one playing now is also in mahtte.look and mahtte.name, as before.
const PLAYERS_MOST = 12;
let makingNewPlayer = false; // from "Vaihda pelaajaa": the next name given is someone new
const lookKey = (l) => [l.gender, l.outfit, l.length, Number(l.hair).toFixed(2), Number(l.eyes).toFixed(2)].join("/");

function loadPlayers() {
  try {
    const saved = JSON.parse(localStorage.getItem("mahtte.players"));
    return Array.isArray(saved) ? saved.filter((p) => p && typeof p.name === "string" && p.look) : [];
  } catch {
    return [];
  }
}

function savePlayers(players) {
  try {
    localStorage.setItem("mahtte.players", JSON.stringify(players.slice(0, PLAYERS_MOST)));
  } catch {
    // Private windows may refuse; this visit still knows who's playing.
  }
}

// The portraits, one for each look, as small PNG pictures: a time remembers the look it was made with.
function loadPortraits() {
  try {
    return JSON.parse(localStorage.getItem("mahtte.portraits")) || {};
  } catch {
    return {};
  }
}

function portraitOf(key) {
  return key ? loadPortraits()[key] ?? null : null;
}

// Head and shoulders from the character's own front view, as in a passport photo, at the sheet's own pixels.
function makePortrait() {
  const sheet = sheetFor(look);
  if (!sheet.complete || !sheet.width) return null;
  const w = FRAME_W * SHEET_DETAIL, h = FRAME_H * SHEET_DETAIL;
  const sx = sheetX(0, IDLE_ROW.down), sy = sheetY(IDLE_ROW.down);
  const { data } = sheet.getContext("2d").getImageData(sx, sy, w, h);
  const solid = (x, y) => data[(y * w + x) * 4 + 3] > 40;
  let top = -1, bottom = -1;
  for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (solid(x, y)) { top = y; break; }
  for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (solid(x, y)) { bottom = y; break; }
  if (top < 0) return null;
  const size = Math.round((bottom - top) * 0.48);
  // The middle of the head, from the upper rows only.
  let left = w, right = 0;
  for (let y = top; y < top + size * 0.6; y++) for (let x = 0; x < w; x++) if (solid(x, y)) { left = Math.min(left, x); right = Math.max(right, x); }
  const middle = (left + right) / 2, from = Math.round(top - size * 0.08);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#dde7ec"; // a passport photo's plain pale background
  g.fillRect(0, 0, size, size);
  g.imageSmoothingEnabled = false;
  g.drawImage(sheet, sx + Math.round(middle - size / 2), sy + from, size, size, 0, 0, size, size);
  return c.toDataURL("image/png");
}

// Remembers the player as they are now, with their portrait. A new one goes first; one picked again moves to the front.
function rememberPlayer(name) {
  const key = lookKey(look);
  const portrait = makePortrait();
  if (portrait) {
    const portraits = loadPortraits();
    portraits[key] = portrait;
    // Only the portraits still used by a player or a best time are kept.
    const used = new Set(loadPlayers().map((p) => lookKey(p.look)).concat(key));
    Object.keys(localStorage).filter((k) => k.startsWith("mahtte.times.")).forEach((k) => {
      try { JSON.parse(localStorage.getItem(k)).forEach((t) => t.face && used.add(t.face)); } catch { /* not a list */ }
    });
    for (const k of Object.keys(portraits)) if (!used.has(k)) delete portraits[k];
    try { localStorage.setItem("mahtte.portraits", JSON.stringify(portraits)); } catch { /* full or refused */ }
  }
  let players = loadPlayers();
  let id = null;
  try { id = localStorage.getItem("mahtte.player"); } catch { /* none yet */ }
  const same = makingNewPlayer ? null : players.find((p) => p.id === id) ?? players.find((p) => p.name === name && lookKey(p.look) === key);
  const me_ = same ?? { id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}` };
  Object.assign(me_, { name, look: { ...look } });
  players = [me_, ...players.filter((p) => p.id !== me_.id)];
  savePlayers(players);
  try { localStorage.setItem("mahtte.player", me_.id); } catch { /* this visit only */ }
  makingNewPlayer = false;
}

// A saved player, picked in the chooser: their look and name become the ones playing.
function pickPlayer(player) {
  Object.assign(look, player.look);
  if (look.gender in STYLES) look.length = styleFor(look.gender, look.length);
  chosen = true;
  makingNewPlayer = false;
  saveLook();
  saveName(player.name);
  try { localStorage.setItem("mahtte.player", player.id); } catch { /* this visit only */ }
  savePlayers([player, ...loadPlayers().filter((p) => p.id !== player.id)]);
  greeted = true;
  sayHello(player.name);
}

// A player's own best time in each place and level they've played, as text lines: the title, the level, the time.
function playerBests(player) {
  const lines = [];
  for (const option of THEMES) {
    const mine = loadTimes(option.id).filter((t) => (t.player ? t.player === player.id : t.name === player.name));
    if (mine.length) lines.push([`${option.activity ?? option.title}${option.level ? ` (${option.level})` : ""}`, formatTime(mine[0].ms)]);
  }
  return lines;
}

// A small passport photo, or an empty frame for a time from before they were kept.
function portraitImage(key) {
  const img = document.createElement("img");
  img.className = "portrait";
  img.alt = "";
  const src = portraitOf(key);
  if (src) img.src = src;
  else img.classList.add("none");
  return img;
}

function saveName(name) {
  try {
    localStorage.setItem("mahtte.name", name);
  } catch {
    // Private windows may refuse; the game asks again on the next visit.
  }
}

// Playing by ear is a different game, so it has best times of its own, as different levels do.
const timesKey = (themeId) => `mahtte.times.${themeId}${audioOnly ? ".audio" : ""}`;

// All best times are forgotten once when this changes, as rounds played before no longer compare. Name and character stay.
const TIMES_FROM = "0.1.7";
try {
  if (localStorage.getItem("mahtte.timesFrom") !== TIMES_FROM) {
    Object.keys(localStorage).filter((key) => key.startsWith("mahtte.times.")).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("mahtte.storeTillTimes");
    localStorage.setItem("mahtte.timesFrom", TIMES_FROM);
  }
} catch {
  // Private windows may refuse, and keep nothing for long anyway.
}

function loadTimes(themeId) {
  try {
    const saved = JSON.parse(localStorage.getItem(timesKey(themeId)));
    return Array.isArray(saved) ? saved.filter((t) => Number.isFinite(t?.ms)) : [];
  } catch {
    return [];
  }
}

// Adds a time and returns the best ones, with the new one marked.
function addTime(ms, name, themeId) {
  let player = null;
  try { player = localStorage.getItem("mahtte.player"); } catch { /* none */ }
  const entry = { ms, name, face: lookKey(look), player };
  const times = [...loadTimes(themeId), entry].sort((a, b) => a.ms - b.ms).slice(0, BEST_TIMES);
  try {
    localStorage.setItem(timesKey(themeId), JSON.stringify(times));
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
  rememberPlayer(name ?? ""); // their portrait as they look now, for the times
  const { times, place } = addTime(timer.ms, name, theme.id);
  const mine = ++roundEnding;
  await Promise.all([speech, new Promise((resolve) => setTimeout(resolve, ANNOUNCE_PAUSE_MS))]);
  if (mine === roundEnding) showResults(times, place);
}

function showResults(times, place) {
  closeResults();
  const results = document.createElement("div");
  queueMicrotask(() => {
    // What was heard during the round, now shown with its meaning.
    const list = results.querySelector(".heard");
    for (const word of list ? heardWords : []) {
      const row = document.createElement("li");
      row.innerHTML = `<b lang="se">${escapeText(word.lemma)}</b> = ${escapeText(translation(word))}`;
      list.append(row);
    }
  });
  results.id = "results";
  results.setAttribute("role", "dialog");
  results.innerHTML = `<div class="panel">
      <h2>${TEXT.done}</h2>
      <div class="note">${TEXT.yourTime}</div>
      <div class="time">${formatTime(timer.ms)}</div>
      ${place === 0 ? `<div class="record">${TEXT.newRecord}</div>` : ""}
      <h3>${audioOnly ? TEXT.bestTimesAudio : TEXT.bestTimes}</h3>
      <ol></ol>
      ${audioOnly ? `<h3>${TEXT.heardWords}</h3><ul class="heard"></ul>` : ""}
      <div class="buttons"><button id="again">${TEXT.again}</button><button id="places">${TEXT.mainMenu}</button></div>
    </div>`;
  times.forEach((time, i) => {
    const row = document.createElement("li");
    if (i === place) row.className = "new";
    row.append(portraitImage(time.face), Object.assign(document.createElement("span"), { className: "who-name", textContent: time.name || "" }),
      Object.assign(document.createElement("span"), { className: "best-time", textContent: formatTime(time.ms) }));
    results.querySelector("ol").append(row);
  });
  document.body.append(results);
  results.querySelector("#again").addEventListener("click", () => (theme.lesson ? enterTheme(theme) : newRound()));
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
  if (CLOSED_PLACES.has(chosenTheme.menuPlace ?? chosenTheme.place) || !placeInLanguage(chosenTheme.menuPlace ?? chosenTheme.place)) return; // not open yet, or not in this language
  theme = chosenTheme;
  document.body.classList.remove("menu");
  setAmbience(theme.place);
  stopLoudspeaker();
  try {
    localStorage.setItem("mahtte.last", theme.id);
  } catch {
    // Private windows may refuse; the menu then just offers no shortcut.
  }
  prepareLines(answerLines());
  enterPlace(theme.place);
  setPadForTheme();
  newRound();
  if (theme.camp) setupCamp();
  else camp = null;
  if (theme.lesson) setupLesson();
  else lesson = null;
  showPrompt();
  showGuide();
}

// In the classroom the on-screen pad's crouch button sits at a chair.
function setPadForTheme() {
  document.getElementById("use").textContent = theme?.lesson ? LESSON_TEXT.raise : theme?.desks ? TEXT.sit : TEXT.take;
  document.getElementById("pad").classList.toggle("seated", !!theme?.lesson);
  for (const id of ["camp-pack", "camp-drop"]) document.getElementById(id).hidden = !theme?.camp;
}

// The rules first, and the round waits until the player has read them.
function showGuide() {
  paused = true;
  announcement++;
  document.getElementById("announce")?.remove();
  const guide = TEXT.guide;
  const inClassroom = theme.place === "classroom";
  const lines = [
    ...(audioOnly ? [guide.listen] : []),
    ...(theme.lesson ? [theme.inWords ? LESSON_TEXT.guideWords : audioOnly ? LESSON_TEXT.guideAudio : LESSON_TEXT.guide] : [
      ...(theme.camp ? [CAMP_TEXT.guide, CAMP_TEXT.keys] : audioOnly && !inClassroom ? [] : [guide.goal[inClassroom ? "classroom" : theme.id]]),
      guide.move,
      guide.run,
      guide.jump[theme.place] || guide.jump.indoors,
      inClassroom ? guide.crouchClassroom : guide.crouch,
    ]),
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
    if (theme.camp) {
      if (!campDogName()) campAskDogName();
      return;
    }
    if (theme.lesson) {
      lessonBegin();
      return;
    }
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
  timerEl.hidden = !!theme.camp;
  paused = false;
  me.sittingOn = null;
  loudspeaker.wait = null; // till the basket is taken; one already speaking goes on
  const { find, extra } = theme.words();
  const picked = [...find, ...extra];
  for (let attempt = 0; attempt < PLACING_TRIES; attempt++) {
    const used = new Set();
    const placed = [];
    const place = { forest: theme.place === "forest", store: isShop(theme.place) };
    objects = picked.map((word) => {
      // In the library a book is among the books of its colour, in that colour's sections of the bookcases, and is found there.
      const section = word.place === "bookshelf" && window.MAHTTE_MAPS[theme.place].sections?.[word.colour];
      const tiles = window.MAHTTE_MAPS[theme.place].stock?.[word.sprite] || section;
      if (tiles) {
        const [x, y] = tiles[tiles.length >> 1];
        return { word, x, y, tiles, phase: 0 };
      }
      if (word.place === "home") {
        const [x, y, facing] = SPOTS.home[word.sprite];
        return { word, x, y, facing, phase: Math.random() * 3000 };
      }
      // A large thing needs a larger clear view, so it can only take some of the spots.
      const large = word.big || word.sprite === "viessu";
      const spots = word.place === "land" && large ? OPEN_SPOTS.large : OPEN_SPOTS[word.place];
      // Only a thing standing free could land on the character; the rest are in fixtures.
      const open = shuffled(spots).filter((s) => (word.place !== "land" || clear(s)) && !used.has(`${s}`));
      // In the forest things are spread around the map, as far apart as the spots left allow.
      let spot = open[0];
      if ((place.forest && word.place === "land") || place.store) {
        for (let apart = place.store ? STORE_APART : FOREST_APART; apart > 0; apart--) {
          const found = open.find(([x, y]) => placed.every(([px, py]) => Math.hypot(px - x, py - y) >= apart));
          if (found) {
            spot = found;
            break;
          }
        }
        placed.push(spot);
      }
      used.add(`${spot}`);
      return { word, x: spot[0], y: spot[1], phase: Math.random() * 3000 };
    });
    if (everythingInReach()) break;
  }
  chooseDogBreed();
  chooseSleepers();
  prepareLines(objects.map((o) => wordLine(o.word))); // only this round's, as there are hundreds in all
  buildAnimalsAhead();
  buildStoreAhead();
  targets = shuffled(find);
  heardWords = [];
  cart = newCart();
  if (theme.counts) {
    targets = wantedCounts(targets);
    const id = VOICES[look.gender];
    prepareLines([1, 2, 3, 4].map((count) => `audio/count-${count}-${id}.wav`));
    prepareLines([2, 3, 4, 5].map((count) => `audio/count-and-${count}-${id}.wav`));
    prepareLines([...cart.want].filter(([, wanted]) => wanted > 1).map(([word]) => `audio/enough-${word.sprite}-${id}.wav`));
  }
  if (helpRound && isShop(theme.place)) prepareLines(Object.values(STORE_HINTS).map((hint) => `audio/${hint.line}-${VOICES[look.gender]}.wav`));
  prepareLines(targets.map((word) => askLine(word)));
  shoppingList = theme.ordered ? [...new Set(targets)] : [];
  roundSize = targets.length;
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

// The shopping list on a piece of paper, in handwriting. What's been found is crossed off, and things can be got in any order.
// On the harder level's list things are in their object form after the number, as in a real shopping list: "5 × mielkki".
const listWord = (word) => (!theme?.counts ? word.lemma : word.forms[word.sprite === "egg" || PLURAL_ONLY[word.sprite] ? "Pl+Acc" : "Sg+Acc"][0]);

// On the grocery store's harder level the price is typed in from what the cashier says, so the list doesn't give it away beforehand.
const listShowsPrices = () => !(theme?.counts && placeName === "store");

function paperList() {
  const paper = document.createElement("ul");
  paper.className = "paper-list";
  paper.lang = "se";
  paper.setAttribute("aria-label", TEXT.shoppingList);
  for (const word of shoppingList) {
    const wanted = theme.counts ? cart.want.get(word) : 1;
    const left = targets.filter((other) => other === word).length;
    const row = document.createElement("li");
    row.textContent = `${wanted > 1 ? `${wanted} × ` : ""}${listWord(word)}`;
    if (listShowsPrices()) {
      const price = document.createElement("small");
      price.textContent = `${SHOP_PRICES[word.sprite]} ${TEXT.euro}`;
      row.append(price);
    }
    if (!left) row.className = "bought";
    else if (left < wanted) row.dataset.left = `${wanted - left}/${wanted}`;
    paper.append(row);
  }
  return paper;
}

function escapeText(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function showPrompt() {
  // What's been dropped is back on the list, not crossed off, until it's picked up again.
  noteEl.replaceChildren(...(theme?.ordered && shoppingList.length ? [paperList()] : []));
  if (theme?.camp) {
    promptEl.replaceChildren(campList());
    return;
  }
  if (theme?.lesson) {
    lessonPrompt();
    return;
  }
  const starRow = "★".repeat(stars) + "☆".repeat(roundSize - stars);
  if (!theme) {
    promptEl.innerHTML = `<span>${escapeText(TEXT.choosePlace(loadName()))}</span>`;
  } else if (cart.spilled.length && targets.every((word) => cart.spilled.some((item) => item.word === word))) {
    promptEl.innerHTML = `<span>${TEXT.pickFallen}</span>`;
  } else if (STORE_PROMPTS[cart.stage] && isShop(theme.place)) {
    promptEl.innerHTML = `<span>${TEXT[cart.stage === "price" && theme.counts ? "storePriceTyped" : STORE_PROMPTS[cart.stage]]}</span>`;
  } else if (targets.length && audioOnly) {
    promptEl.innerHTML = `<span>${TEXT.listen}</span>
      <button id="hear-again">🔊 ${TEXT.hearAgain}</button>
      <span class="stars" aria-label="${stars}/${roundSize}">${starRow}</span>`;
    promptEl.querySelector("#hear-again").addEventListener("click", hearAgain);
  } else if (targets.length) {
    const left = theme.counts ? targets.filter((word) => word === targets[0]).length : 1;
    const aim = `${left > 1 ? `${left} × ` : ""}${targets[0].aim || listWord(targets[0])}`;
    if (theme.ordered) {
      promptEl.replaceChildren(); // the list says it all
      return;
    }
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
        row.textContent = `${theme.counts ? `${cart.want.get(word)} × ` : ""}${listWord(word)}${listShowsPrices() ? ` ${SHOP_PRICES[word.sprite]} ${TEXT.euro}` : ""}`;
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
let playerTalking = false; // the line being said is in the character's own voice

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

// Audio only: the words are heard and not shown until the round has ended, to practise understanding spoken Sámi.
let audioOnly = false;
try {
  audioOnly = localStorage.getItem("mahtte.mode") === "audio";
} catch {
  // Private windows may refuse; the game then starts with text.
}

function setAudioOnly(on) {
  audioOnly = on;
  try {
    localStorage.setItem("mahtte.mode", on ? "audio" : "both");
  } catch {
    // It still holds for this visit.
  }
}

// The line that asks for what to find next.
function askLine(word, id = VOICES[look.gender]) {
  if (word.number !== undefined) return `audio/ask-number-${word.number}-${id}.wav`;
  if (word.spoken) return `audio/ask-${word.spoken}-${word.sprite}-${word.colour}-${id}.wav`;
  return `audio/ask-${word.sprite}-${id}.wav`;
}

function hearAgain() {
  if (!paused && cart.stage === "price") sayPrice();
  else if (!paused && targets.length && !rightSpeech) playVoice(...askLines());
}

// What's being looked for, with how many first when there are several to get.
function askLines() {
  const left = theme?.counts ? targets.filter((word) => word === targets[0]).length : 1;
  return [...(left > 1 ? [`audio/count-${left}-${VOICES[look.gender]}.wav`] : []), askLine(targets[0])];
}

// The line that says what a thing is, as fetched by tools/fetch_voices.py.
function wordLine(word, id = VOICES[look.gender]) {
  if (word.number !== undefined) return `audio/number-${word.number}-${id}.wav`;
  if (word.spoken) return `audio/${word.spoken}-${word.sprite}-${word.colour}-${id}.wav`;
  return `audio/word-${word.sprite}-${id}.wav`;
}

async function playNextLine() {
  const line = voiceQueue.shift();
  // A line can come with a speed, which also raises its pitch: that's how classmates get voices of their own.
  const src = line?.src ?? line, rate = line?.rate ?? 1;
  // A classmate or cashier has the same line played at another speed.
  playerTalking = Boolean(src) && !line?.rate && src.endsWith(`-${VOICES[look.gender]}.wav`);
  if (!src) {
    voiceBusy = false;
    duckAmbience(false);
    const done = voiceDone;
    voiceDone = null;
    done?.();
    return;
  }
  voiceBusy = true;
  duckAmbience(true);
  line.onStart?.();
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
    source.playbackRate.value = rate;
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
  voice.preservesPitch = rate === 1;
  voice.playbackRate = rate;
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
  playerTalking = false;
  duckAmbience(false);
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
  if (theme?.ordered && !audioOnly) return; // the list is there to read, in any order
  if (targets.length) playVoice(...askLines());
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
  canvasEl.width = FRAME_W * SHEET_DETAIL;
  canvasEl.height = FRAME_H * SHEET_DETAIL;
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
    rememberPlayer(name);
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
  if (mine !== greeting) return;
  // By now the character's sheet has come for the greeting: who's playing is remembered with their portrait, someone who played
  // before players were kept among them.
  if (!makingNewPlayer) rememberPlayer(name);
  showPlaces();
}

// The menu of places: at the start, after a round, or whenever the player asks.
function showPlaces() {
  closeResults();
  roundEnding++;
  timerEl.hidden = true;
  paused = true;
  theme = null;
  lesson = null;
  me.sittingOn = null; // a desk left behind must not go on looking for its number
  targets = [];
  objects = [];
  preview = null;
  announcement++;
  document.getElementById("announce")?.remove();
  timer.running = false;
  showPrompt();
  document.body.classList.add("menu");
  stopVoice();
  stopLoudspeaker();
  setAmbience(null);
  menuPlaces();
  buildPlacesAhead();
}

// The menu fills the page, so nothing needs scrolling to, and asks one thing at a time: where, and then how hard.
// Pictures carry it for a child who doesn't read yet.
// The start page's picture of each place, showing faintly behind its button in the menu.
const PLACE_MAPS = { home: "koti", forest: "elaimet", city: "parkkipaikka", library: "kirjasto", store: "kauppa", gearstore: "rautakauppa", camp: "laavu", classroom: "luokka", lesson: "oppitunti" };
// Places shown in the menu but not open yet: greyed out, and they can't be started, as their graphics are still being made.
const CLOSED_PLACES = new Set(["camp"]);
// The menu's sections, by how far along the places are. A new place has to be added to one of them to show.
const MENU_SECTIONS = [
  { heading: "Pelattava demo", places: ["classroom", "forest", "store"], look: "ready" },
  { heading: "Keskeneräiset kentät – näitä voi testata, mutta niiden kehitys on vasta alkamassa", places: ["home", "city", "library", "gearstore", "camp"], look: "partly" },
].map((section) => ({ ...section, heading: (LANG === "nb" && TEXT_NB.sections[section.heading]) || section.heading, places: section.places.filter(placeInLanguage) }))
  .filter((section) => section.places.length); // a language without a place hides it

// A finer picture for the menu than the one on a word's card: built again at double detail where it's made of round shapes, and
// otherwise doubled.
const MENU_DETAIL = 2;
const menuPictures = new Map();
function menuPicture(word) {
  const key = `${word.sprite}/${word.colour || ""}/${word.number ?? ""}`;
  if (!menuPictures.has(key)) {
    const round = word.number === undefined && MODELS[word.sprite]?.(0, word.colour)[0].kind;
    if (round) menuPictures.set(key, croppedImage(makeModelImage(word.sprite, 0, word.sprite === "beaiveloddi" ? 1 : 0, 0, word.colour, MENU_DETAIL)));
    else {
      const detail = viewDetail;
      viewDetail = 1;
      menuPictures.set(key, doubledImage(pictureOf(word)));
      viewDetail = detail;
    }
  }
  return menuPictures.get(key);
}

function menuButton({ look: picture, title, small, example, onClick, className, map }) {
  const button = document.createElement("button");
  if (className) button.className = className;
  if (map) {
    const mapEl = document.createElement("img");
    mapEl.className = "place-map";
    mapEl.src = `art/site/${map}.png`;
    mapEl.alt = "";
    button.classList.add("has-map");
    button.append(mapEl);
  }
  if (picture) {
    const image = menuPicture(picture);
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
    const last = THEMES.find((option) => option.id === localStorage.getItem("mahtte.last"));
    return last && !CLOSED_PLACES.has(last.menuPlace ?? last.place) && placeInLanguage(last.menuPlace ?? last.place) ? last : undefined;
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
  avatar.width = FRAME_W * SHEET_DETAIL;
  avatar.height = FRAME_H * SHEET_DETAIL;
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
  if (TEXT.earlyNotice) notice.append(Object.assign(document.createElement("strong"), { className: "early-notice", textContent: TEXT.earlyNotice }));
  const modes = document.createElement("div");
  modes.className = "modes";
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", TEXT.listen);
  const modeHint = document.createElement("p");
  modeHint.className = "mode-hint";
  const showModes = () => {
    modes.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.mode === "audio") === audioOnly)));
    modeHint.textContent = audioOnly ? TEXT.modeHint : "";
  };
  for (const [mode, label] of [["both", TEXT.modeBoth], ["audio", TEXT.modeAudio]]) {
    const button = document.createElement("button");
    button.dataset.mode = mode;
    button.textContent = label;
    button.addEventListener("click", () => {
      setAudioOnly(mode === "audio");
      menuPlaces(); // the best times shown are for this way of playing
      cardEl.querySelector(`.modes [data-mode=${mode}]`).focus();
    });
    modes.append(button);
  }
  showModes();
  const helpSwitch = document.createElement("button");
  helpSwitch.className = "help-switch";
  helpSwitch.addEventListener("click", () => setHelp(!helpRound));
  cardEl.append(notice, who, modes, modeHint, helpSwitch);
  showHelpSwitches();
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
  for (const { heading, places, look: sectionLook } of MENU_SECTIONS) {
    const section = document.createElement("section");
    section.className = `menu-section ${sectionLook}`;
    const title = document.createElement("h3");
    title.textContent = heading;
    const grid = document.createElement("div");
    grid.className = "menu-grid";
    for (const place of places) {
      const levels = THEMES.filter((option) => (option.menuPlace ?? option.place) === place);
      const played = levels.filter(bestOf).length;
      if (CLOSED_PLACES.has(place)) {
        const closed = menuButton({ look: themeLook(levels[0]), title: levels[0].title, small: TEXT.comingLater, map: PLACE_MAPS[place], className: "closed" });
        closed.disabled = true;
        closed.setAttribute("aria-disabled", "true");
        grid.append(closed);
        continue;
      }
      grid.append(menuButton({
        look: themeLook(levels[0]),
        title: levels[0].title,
        small: levels.length > 1 ? `${"●".repeat(played)}${"○".repeat(levels.length - played)} ${TEXT.levels(levels.length)}` : bestText(levels[0]),
        map: PLACE_MAPS[place],
        // A place of one level still opens its own page, with its best times and a button to begin; the camp has no clock and begins at once.
        onClick: () => (levels[0].activity ? menuActivities(levels[0].title, levels) : levels.length > 1 || !levels[0].camp ? menuLevels(levels[0].title, levels) : enterTheme(levels[0])),
      }));
    }
    section.append(title, grid);
    cardEl.append(section);
  }
  cardEl.querySelector("button.continue, .menu-grid button").focus();
}

// The three best times of a level, each with the player's passport photo and name.
const BEST_SHOWN = 3;
function bestList(option) {
  const times = option.camp ? [] : loadTimes(option.id).slice(0, BEST_SHOWN);
  const list = document.createElement("ol");
  list.className = "best-list";
  if (!times.length && !option.camp) {
    const none = document.createElement("li");
    none.className = "none";
    none.textContent = TEXT.noTimesYet;
    list.append(none);
  }
  for (const time of times) {
    const row = document.createElement("li");
    row.append(portraitImage(time.face), Object.assign(document.createElement("span"), { className: "who-name", textContent: time.name || "" }),
      Object.assign(document.createElement("span"), { className: "best-time", textContent: formatTime(time.ms) }));
    list.append(row);
  }
  return list;
}

// A place with different things to do asks which first, and then how hard.
function menuActivities(title, levels) {
  promptEl.innerHTML = `<span>${escapeText(title)}: ${TEXT.chooseActivity}</span>`;
  preview = null;
  cardEl.className = "places";
  cardEl.innerHTML = "";
  const back = document.createElement("button");
  back.id = "menu-back";
  back.textContent = TEXT.back;
  back.addEventListener("click", menuPlaces);
  cardEl.append(back);
  // In sections of their own, so that what's added later stays with its kind.
  for (const heading of new Set(levels.map((option) => option.section))) {
    const section = document.createElement("section");
    section.className = "menu-section group";
    const titleEl = document.createElement("h3");
    titleEl.textContent = heading;
    const grid = document.createElement("div");
    grid.className = "menu-grid levels";
    const inSection = levels.filter((option) => option.section === heading);
    for (const activity of new Set(inSection.map((option) => option.activity))) {
      const own = inSection.filter((option) => option.activity === activity);
      const played = own.filter(bestOf).length;
      grid.append(menuButton({
        look: themeLook(own[0]),
        title: activity,
        small: [TEXT.activityNotes[activity], own.length > 1 ? `${"●".repeat(played)}${"○".repeat(own.length - played)} ${TEXT.levels(own.length)}` : bestText(own[0])].filter(Boolean).join(" · "),
        map: PLACE_MAPS[own[0].place],
        onClick: () => (own.length > 1 ? menuLevels(activity, own, () => menuActivities(title, levels)) : enterTheme(own[0])),
      }));
    }
    section.append(titleEl, grid);
    cardEl.append(section);
  }
  cardEl.querySelector(".menu-grid button").focus();
}

function menuLevels(title, levels, goBack = menuPlaces) {
  promptEl.innerHTML = `<span>${escapeText(title)}${levels.length > 1 ? `: ${TEXT.chooseLevel}` : ""}</span>`;
  preview = null;
  cardEl.className = "places";
  cardEl.innerHTML = "";
  const back = document.createElement("button");
  back.id = "menu-back";
  back.textContent = TEXT.back;
  back.addEventListener("click", () => goBack());
  const grid = document.createElement("div");
  grid.className = "menu-grid levels";
  levels.forEach((option, index) => {
    const button = menuButton({
      look: themeLook(option),
      title: option.level ? `${TEXT.level} ${index + 1}: ${option.level}` : TEXT.begin,
      example: option.example,
      map: PLACE_MAPS[option.place],
      onClick: () => enterTheme(option),
    });
    button.append(bestList(option));
    grid.append(button);
  });
  cardEl.append(back, ...(levels[0].lesson ? [lessonSpeechSwitches()] : []), grid);
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
  makingNewPlayer = true;
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

// A slider running through the colours, with every shade between them. The name is of the nearest one.
function colourSlider({ key, label, options }, order, ramps, changed) {
  const holder = document.createElement("div");
  holder.className = "eye-slider";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = options.length - 1;
  slider.step = 0.02;
  slider.value = look[key];
  slider.setAttribute("aria-label", label);
  slider.style.background = `linear-gradient(to right, ${order.map((id) => hexColour(ramps[id][1])).join(", ")})`;
  const name = document.createElement("span");
  const show = () => {
    look[key] = Number(slider.value);
    const text = options[Math.round(look[key])][1];
    name.textContent = text;
    slider.setAttribute("aria-valuetext", text);
    slider.style.setProperty("--eye", hexColour(rampAt(order, ramps, look[key])[1]));
  };
  slider.addEventListener("input", () => {
    show();
    changed();
  });
  show();
  holder.append(slider, name);
  return holder;
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
  // Someone new, or the first time here: those who have played before can be picked as they are.
  const players = makingNewPlayer || !chosen ? loadPlayers() : [];
  if (players.length) {
    const saved = document.createElement("section");
    saved.className = "saved-players";
    saved.innerHTML = `<h3>${TEXT.choosePlayer}</h3>`;
    const grid = document.createElement("div");
    grid.className = "player-grid";
    for (const player of players) {
      const button = document.createElement("button");
      button.className = "player";
      const name = document.createElement("span");
      name.className = "who-name";
      name.textContent = player.name || NAMES[player.look.gender];
      button.append(portraitImage(lookKey(player.look)), name);
      const bests = playerBests(player);
      if (bests.length) {
        const list = document.createElement("ul");
        list.className = "bests";
        for (const [place, time] of bests) {
          const row = document.createElement("li");
          row.append(Object.assign(document.createElement("span"), { textContent: place }), Object.assign(document.createElement("b"), { textContent: time }));
          list.append(row);
        }
        button.append(list);
      } else button.append(Object.assign(document.createElement("span"), { className: "note", textContent: TEXT.noTimesYet }));
      button.addEventListener("click", () => pickPlayer(player));
      grid.append(button);
    }
    const or = document.createElement("p");
    or.className = "note";
    or.textContent = TEXT.orMakeNew;
    saved.append(grid, or);
    cardEl.append(saved);
  }
  const figure = document.createElement("figure");
  const canvasEl = document.createElement("canvas");
  canvasEl.width = FRAME_W * SHEET_DETAIL;
  canvasEl.height = FRAME_H * SHEET_DETAIL;
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
    if (choice.slider) {
      row.append(colourSlider(choice, key === "eyes" ? EYE_ORDER : HAIR_ORDER, key === "eyes" ? EYE_RAMPS : HAIR_RAMPS, refresh));
      rows.append(row);
      continue;
    }
    const options = document.createElement("div");
    options.className = "options";
    row.append(options);
    for (const [value, text] of optionsFor(choice, look)) {
      const button = document.createElement("button");
      button.textContent = text;
      button.dataset.key = key;
      button.dataset.value = value;
      button.addEventListener("click", () => {
        look[key] = value;
        if (key === "gender") {
          // The list of styles changes with the gender, so the rows are drawn again.
          look.length = styleFor(value, look.length);
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
  showGuideBox(theme?.desks ? TEXT.startClassroom : TEXT.start);
  announce();
}

let rightSpeech = null;
let heardWords = [];


function showCard(word, right, count = 1) {
  preview = null;
  cardEl.className = right ? "right" : "";
  const plural = word.forms?.["Pl+Nom"]?.[0];
  if (audioOnly) {
    cardEl.innerHTML = `<div class="note">${right ? TEXT.found : TEXT.notYet}</div>`;
  } else cardEl.innerHTML = `<div>
      <div class="note">${right ? TEXT.found : FAMILY.has(word.sprite) ? TEXT.thisIsPerson : TEXT.thisIs}</div>
      <div><span class="word" lang="se">${escapeText(count > 1 ? TEXT.enough(word) : word.lemma)}</span>
        <span class="translation">= ${count > 1 ? `${count} × ` : ""}${escapeText(translation(word))}${word.sprite === "beana" && placeName === "forest" ? ` (${(LANG === "nb" ? TEXT_NB.dogBreeds : DOG_BREEDS)[dogBreed]})` : ""}</span></div>
      ${plural && count === 1 ? `<div class="note">${TEXT.plural} <span lang="se">${escapeText(plural)}</span></div>` : ""}
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
  bubble.querySelector(".say").textContent = count > 1 ? `Ja ${window.MAHTTE_NUMBERS[count]}. ${TEXT.enough(word)}.` : `${say} ${person ? TEXT.thisPerson(word.lemma) : thisIs(word)}`;
  bubble.querySelector(".note").textContent = count > 1 ? `${count} × ${translation(word)}.` : `${sayFi} ${person ? TEXT.thisPersonFi(translation(word)) : thisIsFi(word)}`;
  if (!audioOnly) cardEl.append(bubble);
  const id = VOICES[look.gender];
  const lines = count > 1 ? [`audio/count-and-${count}-${id}.wav`, `audio/enough-${word.sprite}-${id}.wav`] : [`audio/${right ? "praise" : "wrong"}-${line}-${id}.wav`, wordLine(word, id)];
  if (!right && targets.length) lines.push(askLine(targets[0], id)); // and again what is being looked for
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

// A wrong pick holds the character still for a moment while it's explained, so that guessing doesn't pay.
const WRONG_HOLD_MS = 3000;
const holdForWrongPick = (now) => {
  if (me.sittingOn) return; // at a desk, reading the number is how it's played
  me.heldUntil = now + WRONG_HOLD_MS;
  me.route = [];
  me.goal = null;
};

function touch(object, now) {
  // The shopping list can be followed in any order.
  const right = theme?.ordered ? targets.includes(object.word) : targets[0] === object.word;
  if (right && isShop(placeName) && !cart.has) {
    cardEl.className = "";
    cardEl.innerHTML = `<div class="note">${TEXT.needBasket}</div>`;
    return;
  }
  // What's in the basket already stays on its shelf, and touching it again says so, with the same pause as a wrong pick.
  if (!right && object.taken) {
    const id = VOICES[look.gender], plural = PLURAL_ONLY[object.word.sprite] ? "-plural" : "";
    cardEl.className = "";
    cardEl.innerHTML = audioOnly ? `<div class="note">${TEXT.taken(object.word)}</div>`
      : `<div><span lang="se">${plural ? "Dat leat" : "Dat lea"} juo mu márssus.</span><div class="note">${TEXT.taken(object.word)}</div></div>`;
    if (!rightSpeech) playVoice(`audio/store-taken${plural}-${id}.wav`);
    holdForWrongPick(now);
    return;
  }
  // In the store only what's on the list can be taken; anything else stays where it is, and is said what it is.
  if (!right && isShop(placeName)) {
    const id = VOICES[look.gender];
    cardEl.className = "";
    cardEl.innerHTML = audioOnly ? `<div class="note">${TEXT.notOnList}</div>`
      : `<div><span lang="se">Ii. ${escapeText(thisIs(object.word)).replace(escapeText(object.word.lemma), `<b>${escapeText(object.word.lemma)}</b>`)} ${PLURAL_ONLY[object.word.sprite] ? "Dat eai leat" : "Dat ii leat"} mu listtus.</span>
        <div class="note">${TEXT.notOnListFi(object.word)}</div></div>`;
    if (!rightSpeech) playVoice(`audio/store-no-${id}.wav`, wordLine(object.word, id), `audio/store-notonlist${PLURAL_ONLY[object.word.sprite] ? "-plural" : ""}-${id}.wav`);
    holdForWrongPick(now);
    return;
  }
  // One at a time when several are wanted: the character counts each one out loud, and the next waits until it has been said.
  // The last of them ends the counting with "enough of it", and then it goes.
  if (right && theme.counts && targets.filter((word) => word === object.word).length > 1) {
    pickOne(object.word);
    startAction("pick", now);
    targets.splice(targets.indexOf(object.word), 1);
    stars++;
    sparkles.push({ x: object.x, y: object.y, born: now });
    playImpact("brush");
    const wanted = cart.want.get(object.word);
    const count = wanted - targets.filter((word) => word === object.word).length;
    cardEl.className = "";
    cardEl.innerHTML = audioOnly ? `<div class="note">${count} / ${wanted}</div>`
      : `<div><div><span class="word" lang="se">${escapeText(window.MAHTTE_NUMBERS[count])}</span>
        <span class="translation">${count} / ${wanted}</span></div>
        <div class="note"><span lang="se">${escapeText(object.word.lemma)}</span> = ${escapeText(translation(object.word))}</div></div>`;
    rightSpeech = (rightSpeech ?? Promise.resolve()).then(() => playVoice(`audio/count-${count}-${VOICES[look.gender]}.wav`)).then(() => {
      rightSpeech = null;
    });
    showPrompt();
    return;
  }
  const speech = showCard(object.word, right, theme?.counts && right ? cart.want.get(object.word) ?? 1 : 1);
  if (!right) {
    holdForWrongPick(now);
    return;
  }
  stars++;
  if (isShop(placeName)) {
    pickOne(object.word);
  }
  heardWords.push(object.word);
  targets.splice(targets.indexOf(object.word), 1);
  // Furniture and family stay where they are, but aren't asked about or spoken for again.
  if (placeName === "forest" && ANIMALS.has(object.word.sprite)) startReaction(object, now);
  else {
    if (object.word.place === "home") object.done = true;
    else if (object.tiles && isShop(placeName)) object.taken = true; // in Ruokakauppa its place on the shelf stays and says it's taken; dropped from the basket, it's on the list again
    else if (object.tiles) object.done = true; // a library's books stay in their bookcase, and aren't asked about again
    else objects = objects.filter((o) => o !== object);
    sparkles.push({ x: object.x, y: object.y, born: now });
    if (!me.sittingOn) startAction("cheer", now);
  }
  // The last of several: that's enough of those.
  if (theme.counts && cart.want.get(object.word) > 1) saying = { say: TEXT.enough(object.word), until: now + ENOUGH_SHOWN_MS };
  showPrompt();
  if (targets.length) announceAfter(speech);
  else if (isShop(placeName)) {
    cart.stage = "pay"; // still to go through the till and out of the door
    showPrompt();
  } else finishRound(loadName() || "", speech);
}

// In the forest the right animal reacts before it goes: most are patted, a cat purrs, a dog pants, a butterfly lands on a
// raised hand, a bird flaps and flies off, and nobody pats a bear.
const REACTIONS = {
  gumpe: { pose: "cheer", ms: 800 },
  geatki: { pose: "cheer", ms: 800 },
  albbas: { pose: "cheer", ms: 800 },
  gahttu: { pose: "pat", sound: "purr", say: "*purrrr*", ms: 1500 },
  beana: { pose: "pat", sound: "pant", ms: 1500 },
  beaiveloddi: { pose: "raiseHand", lands: true, ms: 1300 },
  guovza: { pose: "cheer", ms: 800 },
};
const PATTED = { pose: "pat", ms: 1100 };
const FLIES_OFF = { pose: "cheer", flies: true, ms: 1000 };
const REACTION_FADE = 0.3, FLY_OFF_HIGH = 46, LANDED_HIGH = 24, HAND_AT = 0.45; // how far the raised hand is to the side
let saying = null;

function startReaction(object, now) {
  const reaction = FOREST_BIRDS.has(object.word.sprite) ? FLIES_OFF : REACTIONS[object.word.sprite] ?? PATTED;
  object.done = true;
  object.reaction = { ...reaction, born: now, fromX: object.x, fromY: object.y };
  startAction(reaction.pose, now);
  if (reaction.pose === "pat") stepUpToPat(object, now);
  if (reaction.sound) playImpact(reaction.sound);
  if (reaction.say) saying = { say: reaction.say, until: now + reaction.ms };
}

// In picture pixels from the feet: where the hand of the pat frames is. Standing just in front of the animal keeps the hand
// drawn over it.
const PAT_HAND = { across: 8, low: 12, high: 18, inFront: 2, intoBody: 3, stepMs: 180 };

// The top of the animal's picture at a column a quarter of its width in from the given side.
function patTarget(object, side, now) {
  const pose = animalPose(object, now);
  const image = modelImage(object.word.sprite, pose.facing, pose.frame, pose.head, object.word.colour);
  const detail = image.detail ?? 1, seen = image.getContext ? image : Object.assign(document.createElement("canvas"), { width: image.width, height: image.height });
  if (seen !== image) seen.getContext("2d").drawImage(image, 0, 0);
  const { data } = seen.getContext("2d").getImageData(0, 0, image.width, image.height);
  const solid = (x, y) => data[(y * image.width + x) * 4 + 3] > 40;
  let left = image.width, right = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (solid(x, y)) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  const column = Math.round((left + right) / 2 + side * (right - left) / 4);
  let top = 0;
  while (top < image.height - 1 && !solid(column, top)) top++;
  return { across: column / detail - MODEL_ANCHOR.x, high: top / detail - MODEL_ANCHOR.y + PAT_HAND.intoBody };
}

// Walks up to the animal so that the hand really lands on its back, from whichever side has room: if neither has, the animal comes.
function stepUpToPat(object, now) {
  const spot = (side) => {
    const { across, high } = patTarget(object, side, now);
    const raised = high + PAT_HAND.low < 0; // too tall to reach with the hand low
    const footX = across + side * PAT_HAND.across, footY = Math.max(PAT_HAND.inFront, high + (raised ? PAT_HAND.high : PAT_HAND.low));
    return { side, raised, x: object.x + 0.5 + (footX / HW + footY / HH) / 2, y: object.y + 0.5 + (footY / HH - footX / HW) / 2 };
  };
  const nearSide = isoX(me.x, me.y) >= isoX(object.x + 0.5, object.y + 0.5) ? 1 : -1;
  const near = spot(nearSide), far = spot(-nearSide);
  const free = [near, far].find((place) => !blockedAt(place.x, place.y, object)) ?? null;
  const place = free ?? near;
  me.glide = { fromX: me.x, fromY: me.y, toX: free ? place.x : me.x, toY: free ? place.y : me.y, born: now };
  if (!free) { // what the player would have walked, the animal walks instead
    me.glide.thing = object;
    me.glide.thingFromX = object.x;
    me.glide.thingFromY = object.y;
    me.glide.thingToX = object.x + me.x - place.x;
    me.glide.thingToY = object.y + me.y - place.y;
  }
  action.row = ACTIONS.pat.row + (place.raised ? 1 : 0);
  action.flip = place.side > 0;
  me.facing = place.side > 0 ? "W" : "E";
  me.heldUntil = now + ACTIONS.pat.ms;
}

function updateGlide(now) {
  const glide = me.glide;
  if (!glide) return;
  const along = Math.min(1, (now - glide.born) / PAT_HAND.stepMs);
  me.x = glide.fromX + (glide.toX - glide.fromX) * along;
  me.y = glide.fromY + (glide.toY - glide.fromY) * along;
  if (glide.thing) {
    glide.thing.x = glide.thingFromX + (glide.thingToX - glide.thingFromX) * along;
    glide.thing.y = glide.thingFromY + (glide.thingToY - glide.thingFromY) * along;
  }
  if (along === 1) me.glide = null;
}

function updateReactions(now) {
  for (const o of objects) {
    const r = o.reaction;
    if (!r) continue;
    const along = (now - r.born) / r.ms;
    o.fade = Math.min(1, (1 - along) / REACTION_FADE);
    if (r.lands) {
      const landing = Math.min(1, along * 2);
      o.x = r.fromX + (me.x - 0.5 + HAND_AT - r.fromX) * landing;
      o.y = r.fromY + (me.y - 0.5 - HAND_AT + 0.1 - r.fromY) * landing;
    }
    if (along >= 1) {
      objects = objects.filter((other) => other !== o);
      sparkles.push({ x: o.x, y: o.y, born: now });
    }
  }
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
const objectAt = (x, y) => objects.find((o) => !o.animal?.crossing && Math.round(o.x) === x && (Math.round(o.y) === y || (o.word.place === "bay" && o.y + 1 === y)));
function thingAtPoint(x, y) {
  const homeThings = objects.filter((o) => o.word.place === "home" && awayFrom(o, x, y) < 0.2);
  const area = (o) => HOME_THINGS[o.word.sprite][0] * HOME_THINGS[o.word.sprite][1];
  const onCounter = OPEN_SPOTS.meat?.some(([a, b]) => a === Math.floor(x) && b === Math.floor(y));
  const inStock = objects.find((o) => o.tiles?.some(([a, b]) => a === Math.floor(x) && b === Math.floor(y)));
  return homeThings.sort((p, q) => area(p) - area(q))[0] || inStock || objectAt(Math.floor(x), Math.floor(y)) || (onCounter && objects.find((o) => o.word.place === "meat"));
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
const standsFree = (o) => o.word.place === "land" && !o.animal?.crossing; // a bird on its way over the river is up in the air
const thingReach = (o) => (boxed(o) ? MOVE.radius + 0.12 : standsFree(o) ? solidSize(o) + MOVE.radius + 0.1 : 0.95);

// Width and length of a parked vehicle in tiles, in the two-tile bay that starts at its tile.
const VEHICLES = {
  car: [0.78, 1.46], truck: [0.86, 1.92], bus: [0.86, 1.94], tractor: [0.92, 1.72], moto: [0.3, 1.12], bike: [0.24, 1.0],
  taxi: [0.78, 1.46], ambulance: [0.82, 1.66], firetruck: [0.86, 1.92], van: [0.78, 1.6], snowmobile: [0.46, 1.2], trailer: [0.72, 1.46],
};
// Things at home, in tiles across and along as built, with the rug flat on the floor to be walked over.
const HOME_THINGS = {
  sofa: [2.75, 1.02], tv: [1.4, 0.55], table: [3.2, 1.8], chair: [0.7, 0.7], stove: [1.05, 1], cupboard: [1.55, 0.8], fridge: [1, 0.95],
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

// Fridges, freezers and shelves are only open at the front, and the counter on the shop's side: from anywhere else nothing can be taken. A fruit table is open all round.
const fromBehind = ({ word: { place }, tiles: [[a, b]] }, x, y) => (place === "meat" ? x < a + 1 : (place === "fridge" || place === "freezer" || place === "shelf") && y < b + 1);
const pointToBox = (x, y, box) => Math.hypot(x - Math.max(box.x0, Math.min(box.x1, x)), y - Math.max(box.y0, Math.min(box.y1, y)));
// How far a point is from a thing: from the edge of a parked vehicle, otherwise from the thing's centre.
// What's for sale in the store fills several tiles in a row, and can be taken from any of them.
// At home, the other chairs round the table and the other sofa are that thing too: any of them will do.
const sameKind = (o) => (o.word.place === "home" ? decorThings.filter((d) => d.word.sprite === o.word.sprite) : []);
const awayFrom = (o, x, y) => (boxed(o) ? Math.min(pointToBox(x, y, vehicleBox(o)), ...sameKind(o).map((d) => pointToBox(x, y, vehicleBox(d))))
  : o.tiles ? (fromBehind(o, x, y) ? Infinity : Math.min(...o.tiles.map(([a, b]) => Math.hypot(x - a - 0.5, y - b - 0.5))))
  : Math.hypot(x - o.x - 0.5, y - o.y - 0.5));

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
  if (placeName === "store" && me.y < STORE_GATE.y - 0.3) cart.inside = true;
  for (let pass = 0; pass < 2; pass++) {
    const tx = Math.floor(me.x), ty = Math.floor(me.y);
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const x = tx + a, y = ty + b;
      if (SOLID_TILES.has(tileOr(x, y, "g")) || gateShut(x, y)) pushOutOfTile(x, y);
      const tree = treesNear.get(`${x},${y}`);
      if (tree && Math.hypot(me.x - tree.mx, me.y - tree.my) < (tree.trunk ?? MOVE.trunk) + MOVE.radius) {
        me.hitTree = tree;
        pushOutOfCircle(tree.mx, tree.my, (tree.trunk ?? MOVE.trunk) + MOVE.radius);
      }
    }
    for (const chair of chairs) {
      if (Math.hypot(me.x - chair.x, me.y - chair.y) < SIT_CHAIR_SIZE + MOVE.radius) me.hitTree = { mx: chair.x, my: chair.y };
      pushOutOfCircle(chair.x, chair.y, SIT_CHAIR_SIZE + MOVE.radius);
    }
    for (const o of decorThings) pushOutOfBox(vehicleBox(o));
    for (const o of objects) {
      if (boxed(o) && !FLAT_THINGS.has(o.word.sprite)) pushOutOfBox(vehicleBox(o));
      if (!standsFree(o) || canPassOver(o)) continue;
      if (isLarge(o) && Math.hypot(me.x - o.x - 0.5, me.y - o.y - 0.5) < solidSize(o) + MOVE.radius) me.hitTree = { mx: o.x + 0.5, my: o.y + 0.5 };
      pushOutOfCircle(o.x + 0.5, o.y + 0.5, solidSize(o) + MOVE.radius);
    }
    if (stocker) {
      if (trolleySolid(me.x, me.y, MOVE.radius)) me.hitTree = { mx: stocker.cartX + 0.5, my: stocker.cartY + 0.5 };
      pushOutOfCircle(stocker.cartX + 0.5, stocker.cartY + 0.5, STOCK.solid + MOVE.radius);
    }
    me.x = Math.max(MOVE.radius, Math.min(WIDTH - MOVE.radius, me.x));
    me.y = Math.max(MOVE.radius, Math.min(HEIGHT - MOVE.radius, me.y));
  }
}

// What the E key would act on: what's in reach, the smallest first, so someone on the sofa counts and not the sofa.
function thingInReach() {
  const size = (o) => (o.word.place === "home" ? HOME_THINGS[o.word.sprite][0] * HOME_THINGS[o.word.sprite][1] : 1);
  return objects
    .filter((o) => o.word.place !== "desk" && !o.done && !o.animal?.crossing && awayFrom(o, me.x, me.y) < thingReach(o))
    .sort((p, q) => size(p) - size(q) || awayFrom(p, me.x, me.y) - awayFrom(q, me.x, me.y))[0];
}

// Walking against something does nothing by itself; only what was tapped on is taken on arriving, as tapping meant that.
function touchThings(now) {
  const goal = me.goal;
  if (!goal || goal.done || goal.word.place === "desk") return;
  if (awayFrom(goal, me.x, me.y) >= thingReach(goal)) return;
  if (rightSpeech && (theme?.counts || targets[0] !== goal.word)) return;
  me.goal = null;
  touch(goal, now);
  me.route = [];
}

// The E key: uses what's at hand. Returns whether there was anything.
function activate(now) {
  if (paused || me.jumpedAt !== null || fallingDown() || me.running || me.sittingOn || performance.now() < (me.heldUntil ?? 0)) return false;
  const hint = storeHint();
  if (hint?.act) {
    hint.act(now);
    return true;
  }
  const thing = thingInReach();
  if (!thing) return false;
  if (rightSpeech && (theme?.counts || targets[0] !== thing.word)) return true;
  touch(thing, now);
  return true;
}

// Tapping: the planner uses the same rules as walking, on a grid finer than the tiles, so a
// trunk or thing reaching into the next tile can't trap a route.
function blockedAt(x, y, goal, room = MOVE.radius - 0.02) { // standing right against something still counts as free
  if (x < room || y < room || x > WIDTH - room || y > HEIGHT - room) return true;
  const tx = Math.floor(x), ty = Math.floor(y);
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cx = tx + a, cy = ty + b;
    if (SOLID_TILES.has(tileOr(cx, cy, "g")) || gateShut(cx, cy)) {
      const nx = Math.max(cx, Math.min(cx + 1, x)), ny = Math.max(cy, Math.min(cy + 1, y));
      if (Math.hypot(x - nx, y - ny) < room) return true;
    }
    const tree = treesNear.get(`${cx},${cy}`);
    if (tree && Math.hypot(x - tree.mx, y - tree.my) < (tree.trunk ?? MOVE.trunk) + room) return true;
  }
  if (chairs.some((chair) => Math.hypot(x - chair.x, y - chair.y) < SIT_CHAIR_SIZE + room)) return true;
  if (trolleySolid(x, y, room)) return true;
  if (objects.some((o) => o !== goal && boxed(o) && !FLAT_THINGS.has(o.word.sprite) && pointToBox(x, y, vehicleBox(o)) < room)) return true;
  if (decorThings.some((o) => pointToBox(x, y, vehicleBox(o)) < room)) return true;
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
  decorThings = (SPOTS.decor || []).map(([sprite, x, y, facing]) => ({ word: { sprite, place: "home" }, x, y, facing, decor: true }));
  OPEN_SPOTS = {
    land: SPOTS.land.filter((s) => openSpot(s, 10, 20)),
    water: SPOTS.water.filter((s) => openSpot(s, 10, 20)),
    large: SPOTS.land.filter((s) => openSpot(s, 18, 36)),
    // In a fixture, the rest of its own row is no obstacle; things are drawn in front of it.
    shelf: SPOTS.shelf || [],
    fridge: SPOTS.fridge || [],
    pallet: SPOTS.pallet || [],
    freezer: SPOTS.freezer || [],
    produce: SPOTS.produce || [],
    tools: SPOTS.tools || [],
    fishing: SPOTS.fishing || [],
    clothes: SPOTS.clothes || [],
    platform: SPOTS.platform || [],
    meat: SPOTS.meat || [],
    desk: SPOTS.desk || [],
    bay: SPOTS.bay || [],
    bookshelf: SPOTS.bookshelf || [],
    table: SPOTS.table || [],
    home: SPOTS.home || {},
  };
  Object.assign(me, { x: START.x + 0.5, y: START.y + 0.5, facing: "S", route: [], goal: null, heldUntil: 0, glide: null, jumpedAt: null, knockedAt: null, height: 0, moveX: 0, moveY: 0, moving: false, running: false, slideAt: null, restAt: null, sittingOn: null, sitWhenThere: null });
  puffs.length = 0;
  sparkles = [];
  setChairs();
  setupShoppers();
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
    const away = me.goal && boxed(me.goal) ? pointToBox(x, y, vehicleBox(me.goal)) : me.goal?.tiles ? awayFrom(me.goal, x, y) : Math.hypot(x - goalX, y - goalY);
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
  spillBasket(now);
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
    startAmbience();
  }
  if (sound.state !== "running") sound.resume().catch(() => {});
}

function makeNoise(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

// ---------------------------------------------------- background sounds
// Each place has its own quiet sounds, made here rather than recorded and kept well under the voices.
// They also keep the sound channel open all the time, which should stop lines cutting in as it wakes.
const AMBIENCE_FADE = 1.2;
const AMBIENCE_STOP = 0.25; // seconds to fall silent on leaving a place
const AMBIENCE_NOISE_SECONDS = 41;
const AMBIENCE_SPEAKING = 0.5;
// How loud each place is overall, so that all of them are heard at about the same level.
const AMBIENCE_LEVEL = { forest: 1, city: 1, home: 1, store: 1, gearstore: 1, library: 1, classroom: 1, lesson: 1 };
let ambiencePlace = null;
const AMBIENCE_SAME_AS = { camp: "forest" }; // the camp is in the same woods, and the file need not be there twice
let ambienceRun = null; // what is playing: its output, its endless sounds and its timers

// Long enough, and started at random points, that nothing is heard to repeat.
let longNoise = null;
function ambienceNoise() {
  if (!longNoise) {
    longNoise = sound.createBuffer(1, Math.round(sound.sampleRate * AMBIENCE_NOISE_SECONDS), sound.sampleRate);
    // Deep rather than hissing: each sample wanders from the one before, which leaves little of the static in white noise.
    const samples = longNoise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < samples.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      samples[i] = last * 3.5;
    }
  }
  return longNoise;
}

function endlessNoise(run, { type, frequency, q = 0.7, level, changes = 0 }) {
  const source = sound.createBufferSource();
  source.buffer = ambienceNoise();
  source.loop = true;
  const filter = sound.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = sound.createGain();
  gain.gain.value = level;
  source.connect(filter).connect(gain).connect(run.output);
  source.start(0, Math.random() * AMBIENCE_NOISE_SECONDS);
  run.endless.push(source);
  // Wanders up and down at no fixed pace, as wind does.
  if (changes) {
    nowAndThen(run, 2, 9, (at) => {
      gain.gain.setTargetAtTime(level * (1 - changes + Math.random() * changes * 2), at, 1 + Math.random() * 2);
      filter.frequency.setTargetAtTime(frequency * (0.8 + Math.random() * 0.45), at, 2);
    });
  }
}

function endlessHum(run, frequency, level, type = "sine") {
  const hum = sound.createOscillator();
  hum.type = type;
  hum.frequency.value = frequency;
  const gain = sound.createGain();
  gain.gain.value = level;
  hum.connect(gain).connect(run.output);
  hum.start();
  run.endless.push(hum);
  return gain;
}

// Calls back at random intervals, as long as this place is still the one playing.
function nowAndThen(run, fromSeconds, toSeconds, play) {
  const next = () => {
    const timer = setTimeout(() => {
      run.timers.delete(timer);
      if (run !== ambienceRun) return;
      if (sound.state === "running") play(sound.currentTime + 0.02);
      next();
    }, (fromSeconds + Math.random() * (toSeconds - fromSeconds)) * 1000);
    run.timers.add(timer);
  };
  next();
}

function softBeep(output, at, frequency, level, ms) {
  const tone = sound.createOscillator();
  tone.frequency.value = frequency;
  const gain = sound.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
  gain.gain.setValueAtTime(level, at + ms / 1000 - 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  tone.connect(gain).connect(output);
  tone.start(at);
  tone.stop(at + ms / 1000 + 0.02);
}

// Noise whose pitch moves, faded in and out slowly enough that it has no hard edge.
function softNoise(output, at, { from, to, q = 1, level, attack, release }) {
  const source = sound.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const filter = sound.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + attack + release);
  const gain = sound.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  source.connect(filter).connect(gain).connect(output);
  source.start(at, Math.random() * 0.8);
  source.stop(at + attack + release + 0.05);
}

// A sheet lifted and laid over: a soft rising swish, then a fall with a little flutter.
function pageTurn(output, at) {
  const size = 0.7 + Math.random() * 0.5;
  softNoise(output, at, { from: 1200, to: 3200, q: 0.8, level: 0.006 * size, attack: 0.14, release: 0.16 });
  softNoise(output, at + 0.2, { from: 3000, to: 1400, q: 0.8, level: 0.008 * size, attack: 0.05, release: 0.22 });
  softNoise(output, at + 0.3, { from: 1800, to: 1100, q: 1.5, level: 0.003 * size, attack: 0.03, release: 0.09 });
}

// A pencil on paper: a run of small uneven strokes, high and dry, with short lifts between them.
function pencilWriting(output, at) {
  let when = at;
  const strokes = 4 + Math.floor(Math.random() * 9);
  for (let i = 0; i < strokes; i++) {
    const long = 0.05 + Math.random() * 0.14;
    const pitch = 3000 + Math.random() * 1800;
    softNoise(output, when, { from: pitch, to: pitch * (0.8 + Math.random() * 0.4), q: 3, level: 0.004 + Math.random() * 0.004, attack: 0.012, release: long });
    when += long + 0.02 + Math.random() * (Math.random() < 0.2 ? 0.3 : 0.07);
  }
}

// Water over stones is mostly many small bubbles: tones that rise quickly as they fade.
function bubble(output, at) {
  const low = 380 + Math.random() * Math.random() * 1300;
  const long = 0.03 + Math.random() * 0.07;
  const tone = sound.createOscillator();
  tone.frequency.setValueAtTime(low, at);
  tone.frequency.exponentialRampToValueAtTime(low * (1.25 + Math.random() * 0.5), at + long);
  const gain = sound.createGain();
  const level = 0.0015 + Math.random() * 0.0035;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + long);
  tone.connect(gain).connect(output);
  tone.start(at);
  tone.stop(at + long + 0.02);
}

// A car driving by: an engine and not a hiss, its note falling as it passes, moving from one side to the other.
function carPassing(output, at) {
  const seconds = 3.5 + Math.random() * 3;
  const note = 62 + Math.random() * 34;
  const middle = at + seconds * (0.4 + Math.random() * 0.2);
  const filter = sound.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(240, at);
  filter.frequency.linearRampToValueAtTime(620, middle);
  filter.frequency.linearRampToValueAtTime(220, at + seconds);
  const gain = sound.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.016, middle);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  const from = Math.random() < 0.5 ? -0.8 : 0.8;
  let last = gain;
  filter.connect(gain);
  if (sound.createStereoPanner) {
    const pan = sound.createStereoPanner();
    pan.pan.setValueAtTime(from, at);
    pan.pan.linearRampToValueAtTime(-from, at + seconds);
    gain.connect(pan);
    last = pan;
  }
  last.connect(output);
  for (const detune of [1, 1.012, 2.01]) {
    const engine = sound.createOscillator();
    engine.type = "sawtooth";
    engine.frequency.setValueAtTime(note * detune * 1.05, at);
    engine.frequency.linearRampToValueAtTime(note * detune * 1.03, middle - 0.3);
    engine.frequency.linearRampToValueAtTime(note * detune * 0.95, middle + 0.3);
    engine.connect(filter);
    engine.start(at);
    engine.stop(at + seconds + 0.05);
  }
}

// A car door shut somewhere across the car park, and a car being locked.
function carDoor(output, at) {
  softNoise(output, at, { from: 420, to: 220, q: 1, level: 0.022, attack: 0.012, release: 0.14 });
  softBeep(output, at + 0.01, 92, 0.012, 110);
}

function carLock(output, at) {
  softBeep(output, at, 1320, 0.003, 70);
  softBeep(output, at + 0.13, 1320, 0.003, 70);
}

const AMBIENCE = {
  forest(run) {
    endlessNoise(run, { type: "lowpass", frequency: 650, level: 0.04, changes: 0.7 }); // wind, coming and going
    nowAndThen(run, 0.05, 0.28, (at) => bubble(run.output, at)); // the river
    nowAndThen(run, 1.5, 6, (at) => { // leaves rustling
      const count = 2 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) noiseBurst(sound, run.output, noiseBuffer, at + i * (0.05 + Math.random() * 0.12), { type: "bandpass", frequency: 1800 + Math.random() * 1200, level: 0.003 + Math.random() * 0.004, ms: 60 + Math.random() * 90 });
    });
  },
  city(run) {
    endlessHum(run, 55, 0.0015); // keeps the sound channel open between the cars
    nowAndThen(run, 5, 16, (at) => carPassing(run.output, at));
    nowAndThen(run, 11, 28, (at) => carDoor(run.output, at));
    nowAndThen(run, 25, 60, (at) => carLock(run.output, at));
  },
  home(run) {
    // Small speakers can't play a low hum alone, so the fridge has higher parts too, and it comes and goes.
    const fridge = endlessHum(run, 116, 0.006);
    const upper = endlessHum(run, 233, 0.004);
    let humming = true;
    nowAndThen(run, 15, 40, (at) => {
      humming = !humming;
      fridge.gain.setTargetAtTime(humming ? 0.006 : 0.001, at, 1.5);
      upper.gain.setTargetAtTime(humming ? 0.004 : 0.0005, at, 1.5);
    });
    nowAndThen(run, 6, 18, (at) => { // a cup set down in the kitchen
      const high = 1400 + Math.random() * 500;
      softBeep(run.output, at, high, 0.006, 80);
      softBeep(run.output, at + 0.11 + Math.random() * 0.08, high * 0.86, 0.004, 65);
    });
    nowAndThen(run, 9, 26, (at) => { // steps or a door somewhere else in the home
      const count = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) noiseBurst(sound, run.output, noiseBuffer, at + i * (0.4 + Math.random() * 0.2), { type: "lowpass", frequency: 420, level: 0.05, ms: 70 });
    });
  },
  store(run) {
    endlessHum(run, 240, 0.003); // the lights
    const compressor = endlessHum(run, 124, 0.008, "triangle");
    let running = true;
    nowAndThen(run, 12, 34, (at) => { // the freezers' compressor comes and goes
      running = !running;
      compressor.gain.setTargetAtTime(running ? 0.008 : 0.001, at, 1.2);
    });
    // The tills beep when something is scanned, not here: see tillBeep().
  },
  gearstore(run) {
    AMBIENCE.store(run);
  },
  lesson(run) {
    AMBIENCE.classroom(run);
  },
  library(run) {
    endlessHum(run, 110, 0.002); // keeps the sound channel open between the small noises
    nowAndThen(run, 5, 16, (at) => pageTurn(run.output, at));
  },
  classroom(run) {
    endlessHum(run, 110, 0.002); // keeps the sound channel open between the small noises
    nowAndThen(run, 2, 9, (at) => pencilWriting(run.output, at));
    nowAndThen(run, 10, 30, (at) => pageTurn(run.output, at));
  },
};

// Quieter while someone speaks, so the voices stay clear.
function duckAmbience(speaking) {
  if (ambienceRun) ambienceRun.output.gain.setTargetAtTime(AMBIENCE_LEVEL[ambienceRun.place] * (speaking ? AMBIENCE_SPEAKING : 1), sound.currentTime, 0.12);
}

// Recordings where there are good ones, with how loud each should end up on average, in decibels below full scale.
const AMBIENCE_TRACKS = { forest: 40, city: 40, home: 45, library: 47, classroom: 45, store: 43, gearstore: 43, lesson: 47 };
// Places whose recording has a hiss, and the pitch above which it's softened.
const AMBIENCE_SOFTEN = { city: 5000 };
const AMBIENCE_BLEND = 5; // seconds of a track's end blended into its start, so its loop has no join
const AMBIENCE_SPIKE = 3; // nothing goes further above a track's average than this many times

// Turns down anything sudden, like a dropped basket, starting a moment before it and recovering slowly, so that
// no spike comes through and the turning down itself isn't heard.
function limitSpikes(loop, loudness) {
  const ceiling = loudness * AMBIENCE_SPIKE;
  const channels = Array.from({ length: loop.numberOfChannels }, (_, c) => loop.getChannelData(c));
  const wanted = new Float32Array(loop.length);
  for (let i = 0; i < loop.length; i++) {
    let peak = 0;
    for (const channel of channels) peak = Math.max(peak, Math.abs(channel[i]));
    wanted[i] = peak > ceiling ? ceiling / peak : 1;
  }
  const ahead = Math.round(0.01 * loop.sampleRate);
  const recover = 1 / (0.25 * loop.sampleRate);
  // Backwards, so the turning down starts before the spike; then forwards, so it comes back slowly.
  let gain = 1;
  for (let i = loop.length - 1; i >= 0; i--) {
    gain = Math.min(wanted[i], gain + 1 / ahead);
    wanted[i] = gain;
  }
  gain = 1;
  for (let i = 0; i < loop.length; i++) {
    gain = Math.min(wanted[i], gain + recover);
    for (const channel of channels) channel[i] *= gain;
  }
}

function blendedLoop(buffer) {
  const blend = Math.round(AMBIENCE_BLEND * buffer.sampleRate);
  const skip = Math.round(0.1 * buffer.sampleRate); // a cut MP3 can stumble on its first moment
  const length = buffer.length - skip - blend;
  const loop = sound.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  let total = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const from = buffer.getChannelData(channel), to = loop.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      let sample = from[skip + i];
      if (i < blend) sample = sample * Math.sqrt(i / blend) + from[skip + length + i] * Math.sqrt(1 - i / blend);
      to[i] = sample;
      total += sample * sample;
    }
  }
  const loudness = Math.sqrt(total / (length * buffer.numberOfChannels));
  limitSpikes(loop, loudness);
  return { loop, loudness };
}

async function playTrack(run, place) {
  try {
    const response = await fetch(`audio/ambience/${place}.mp3`);
    if (!response.ok) throw new Error(response.status);
    const decoded = await sound.decodeAudioData(await response.arrayBuffer());
    if (run !== ambienceRun) return;
    const { loop, loudness } = blendedLoop(decoded);
    const source = sound.createBufferSource();
    source.buffer = loop;
    source.loop = true;
    const gain = sound.createGain();
    gain.gain.value = Math.pow(10, -AMBIENCE_TRACKS[place] / 20) / loudness;
    if (AMBIENCE_SOFTEN[place]) {
      const soften = sound.createBiquadFilter();
      soften.type = "lowpass";
      soften.frequency.value = AMBIENCE_SOFTEN[place];
      source.connect(soften).connect(gain).connect(run.output);
    } else {
      source.connect(gain).connect(run.output);
    }
    source.start(0, Math.random() * loop.duration);
    run.endless.push(source);
  } catch {
    // Opened as a file, or the recording is missing: the generated sounds are there instead.
    if (run === ambienceRun) AMBIENCE[place]?.(run);
  }
}

function stopAmbience() {
  const run = ambienceRun;
  ambienceRun = null;
  if (!run) return;
  run.timers.forEach(clearTimeout);
  const at = sound.currentTime;
  run.output.gain.cancelScheduledValues(at);
  run.output.gain.setTargetAtTime(0, at, AMBIENCE_STOP / 3);
  for (const part of run.endless) part.stop(at + AMBIENCE_STOP + 0.1);
}

function startAmbience() {
  if (!sound || ambienceRun?.place === ambiencePlace) return;
  stopAmbience();
  const make = AMBIENCE[ambiencePlace];
  if (!make) return;
  const recorded = ambiencePlace in AMBIENCE_TRACKS;
  const output = sound.createGain();
  output.gain.setValueAtTime(0, sound.currentTime);
  output.gain.linearRampToValueAtTime(AMBIENCE_LEVEL[ambiencePlace], sound.currentTime + AMBIENCE_FADE);
  output.connect(sound.destination);
  ambienceRun = { place: ambiencePlace, output, endless: [], timers: new Set() };
  if (recorded) playTrack(ambienceRun, ambiencePlace);
  else make(ambienceRun);
}

function setAmbience(place) {
  ambiencePlace = AMBIENCE_SAME_AS[place] ?? place;
  startAmbience();
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
  if (kind === "purr") {
    // A low rumble, breathing in and out.
    for (let i = 0; i < 40; i++) {
      const breath = 0.5 + 0.5 * Math.sin((i / 40) * Math.PI * 4);
      lowTone(context, output, at + i * 0.034, { from: 50, to: 42, level: 0.02 + breath * 0.035, ms: 26 });
      noiseBurst(context, output, noise, at + i * 0.034, { type: "lowpass", frequency: 500, level: 0.008 + breath * 0.012, ms: 24 });
    }
    return;
  }
  if (kind === "pant") {
    // Quick happy breaths.
    for (let i = 0; i < 6; i++) {
      noiseBurst(context, output, noise, at + i * 0.22, { type: "bandpass", frequency: i % 2 ? 1500 : 2100, q: 0.9, level: 0.045, ms: 130 });
    }
    return;
  }
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

// The till's beep for each thing scanned, at either till and for anyone's shopping: quiet, as heard from across the store.
const TILL_BEEP = { frequency: 1760, level: 0.012, ms: 95 };
function tillBeep() {
  if (!sound || sound.state !== "running") return;
  softBeep(sound.destination, sound.currentTime + SOUND_AHEAD, TILL_BEEP.frequency, TILL_BEEP.level, TILL_BEEP.ms);
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
const WANDER = { walk: 0.00028, hop: 0.00055, fly: 0.0005, flight: 0.0016, flightHigh: 18, crossHigh: 34, crossAfter: 70000, crossMore: 120000, crossFrom: 8, crossTo: 22, beatMs: 110, landMs: 300, lookEveryMs: 350, flutterMs: 70, wagMs: 90, peckEveryMs: 1500, peckMs: 560, peckRestMs: 3500, peckBeatMs: 140, step: 3.5, home: 6, near: 1.8, restMs: 1300, moreRestMs: 3600, hopMs: 340, stepMs: 170 };

const facingTowards = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2));
// A short flight rises and comes down over its whole length.
const flightHeight = (o, a) => Math.sin((1 - Math.hypot(a.aim[0] - o.x, a.aim[1] - o.y) / a.total) * Math.PI) * (a.crossing ? WANDER.crossHigh : WANDER.flightHigh);
// Comes down where it is, so that a bird stopped in the air doesn't drop.
function endFlight(o, a, now) {
  if (ANIMAL_WAYS[o.word.sprite].flights) {
    a.landFrom = flightHeight(o, a);
    a.landAt = now;
  }
  a.aim = null;
}

// In the forest a mammal now and then sleeps. Someone walking or running nearby wakes it, and it runs off for a while; someone
// creeping by doesn't. Returns whether that's all it does for now.
const SLEEP = { most: 2, fromStartMs: 180000, onResting: 0.00004, leastMs: 25000, moreMs: 45000, wakesWalking: 3.4, wakesRunning: 6, fleeLeastMs: 5000, fleeMoreMs: 5000, flee: 0.0036, hop: 0.0042, fleeFrameMs: 95, spotFrom: 3, spotTo: 11 };
const sleeps = (o) => (o.word.sprite === "beana" ? true : window.MAHTTE_ANIMALS?.[o.word.sprite]?.frames.includes(12));
// Most stay awake: one or two in a round sleep from the start, and if it was one, another may doze off later.
let sleepersThisRound = 0;
function chooseSleepers() {
  if (placeName !== "forest") return;
  const chosen = shuffled(objects.filter(sleeps)).slice(0, 1 + Math.floor(Math.random() * SLEEP.most));
  chosen.forEach((o) => { o.startsAsleep = true; });
  sleepersThisRound = chosen.length;
}

function sleepOrFlee(o, a, way, dt, now) {
  if (!sleeps(o)) return false;
  a.sleepUntil ??= o.startsAsleep ? now + SLEEP.fromStartMs : 0;
  if (now < a.sleepUntil) {
    const away = Math.hypot(me.x - o.x - 0.5, me.y - o.y - 0.5);
    const loud = me.moving && !crouching && me.knockedAt === null;
    if (!loud || away >= (me.running ? SLEEP.wakesRunning : SLEEP.wakesWalking)) return true;
    a.sleepUntil = 0;
    if (o.word.sprite === "beana") return false;
    a.fleeUntil = now + SLEEP.fleeLeastMs + Math.random() * SLEEP.fleeMoreMs;
    a.aim = null;
    if (o === me.goal) { // it's up and gone, so there's no use in walking on to where it was
      me.goal = null;
      me.route = [];
    }
  }
  if (now < (a.fleeUntil ?? 0)) {
    a.clock += dt;
    if (!a.aim) a.aim = fleeSpot(o);
    if (!a.aim) return true;
    const dx = a.aim[0] - o.x, dy = a.aim[1] - o.y, left = Math.hypot(dx, dy);
    const step = (way.hops ? SLEEP.hop : SLEEP.flee) * dt;
    a.facing = facingTowards(dx, dy);
    const nextX = left <= step ? a.aim[0] : o.x + (dx / left) * step, nextY = left <= step ? a.aim[1] : o.y + (dy / left) * step;
    if (left <= step || blockedAt(nextX + 0.5, nextY + 0.5, o, 0.2)) a.aim = null;
    if (!blockedAt(nextX + 0.5, nextY + 0.5, o, 0.2)) {
      o.x = nextX;
      o.y = nextY;
    }
    return true;
  }
  if (a.fleeUntil) { // it has settled where it got to
    a.fleeUntil = 0;
    a.aim = null;
    a.homeX = o.x;
    a.homeY = o.y;
    a.restUntil = now + WANDER.restMs;
    return true;
  }
  if (sleepersThisRound < SLEEP.most && !a.aim && now < a.restUntil && Math.random() < SLEEP.onResting * dt) {
    sleepersThisRound++;
    a.sleepUntil = now + SLEEP.leastMs + Math.random() * SLEEP.moreMs;
  }
  return false;
}

// Somewhere with a clear way there, further from the player than the animal is now.
function fleeSpot(o) {
  const from = Math.hypot(me.x - o.x - 0.5, me.y - o.y - 0.5);
  return shuffled(OPEN_SPOTS.land).find(([x, y]) => {
    const away = Math.hypot(x - o.x, y - o.y);
    return away >= SLEEP.spotFrom && away <= SLEEP.spotTo
      && Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y) > from + 1
      && clearLine(o.x + 0.5, o.y + 0.5, x + 0.5, y + 0.5, o);
  }) || null;
}

function updateAnimals(dt, now) {
  for (const o of objects) {
    if (!ANIMALS.has(o.word.sprite) || o.reaction) continue;
    const a = o.animal ??= { homeX: o.x, homeY: o.y, facing: Math.floor(Math.random() * 4), restUntil: now + Math.random() * WANDER.moreRestMs, aim: null, clock: Math.random() * 1000, hopAt: null };
    const way = ANIMAL_WAYS[o.word.sprite];
    if (placeName === "forest" && sleepOrFlee(o, a, way, dt, now)) continue;
    if ((way.looks || way.greets) && now - (a.lookedAt ?? -Infinity) > WANDER.lookEveryMs) {
      a.head = facingTowards(me.x - o.x - 0.5, me.y - o.y - 0.5);
      a.lookedAt = now;
    }
    const close = Math.hypot(me.x - o.x - 0.5, me.y - o.y - 0.5) < (way.near ?? WANDER.near);
    a.greeting = !!way.greets && close;
    if (a.greeting) a.facing = a.head; // turns to the player and stays to wag its tail
    // Over the river there's nowhere to come down, so a crossing is always finished.
    if ((o === me.goal || close) && !a.crossing) {
      if (a.aim) endFlight(o, a, now);
      a.restUntil = Math.max(a.restUntil, now + 500);
      continue;
    }
    if (!a.aim) {
      if (now < a.restUntil) continue;
      // Bigger birds now and then cross the river. Never the one being looked for, so the player isn't sent back again.
      a.nextCross ??= now + WANDER.crossAfter * Math.random() + WANDER.crossAfter;
      if (way.crosses && now >= a.nextCross && targets[0] !== o.word) {
        a.aim = spotOverTheRiver(o);
        a.crossing = !!a.aim;
        a.nextCross = now + WANDER.crossAfter + Math.random() * WANDER.crossMore;
        if (a.aim) [a.homeX, a.homeY] = a.aim;
      }
      a.aim ??= nextAnimalSpot(o, a);
      if (a.aim) a.total = Math.hypot(a.aim[0] - o.x, a.aim[1] - o.y);
      a.restUntil = now + WANDER.restMs + Math.random() * WANDER.moreRestMs + (way.pecks ? WANDER.peckRestMs : 0); // birds stay to feed
      if (!a.aim) a.hopAt = now; // nowhere to go, so a jump on the spot
      continue;
    }
    const dx = a.aim[0] - o.x, dy = a.aim[1] - o.y;
    const left = Math.hypot(dx, dy);
    const step = (way.flights || a.crossing ? WANDER.flight : way.flies ? WANDER.fly : way.hops ? WANDER.hop : WANDER.walk) * dt;
    a.clock += dt;
    a.facing = facingTowards(dx, dy);
    const nextX = left <= step ? a.aim[0] : o.x + (dx / left) * step, nextY = left <= step ? a.aim[1] : o.y + (dy / left) * step;
    if (!a.crossing && blockedAt(nextX + 0.5, nextY + 0.5, o, 0.2)) {
      endFlight(o, a, now);
    } else {
      o.x = nextX;
      o.y = nextY;
      if (left <= step) {
        a.aim = null;
        a.crossing = false;
        if (!way.flights && Math.random() < 0.5) a.hopAt = now; // and sometimes a jump on arriving
      }
    }
  }
}

// Open ground that can't be walked to in a straight line and isn't too far, which here means across the river.
function spotOverTheRiver(o) {
  return shuffled(OPEN_SPOTS.land).find(([x, y]) => {
    const away = Math.hypot(x - o.x, y - o.y);
    return away >= WANDER.crossFrom && away <= WANDER.crossTo
      && !clearLine(o.x + 0.5, o.y + 0.5, x + 0.5, y + 0.5, o)
      && overWater(o.x + 0.5, o.y + 0.5, x + 0.5, y + 0.5)
      && Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y) > WANDER.near + 2
      && !objects.some((other) => other !== o && Math.hypot(other.x - x, other.y - y) < 4);
  }) || null;
}

function overWater(ax, ay, bx, by) {
  for (let along = 0; along <= 1; along += 0.05) {
    if (tileOr(Math.floor(ax + (bx - ax) * along), Math.floor(ay + (by - ay) * along), "g") === "w") return true;
  }
  return false;
}

function nextAnimalSpot(o, a) {
  const taken = (x, y) => objects.some((other) => other !== o && (Math.hypot(other.x - x, other.y - y) < 4 || (other.animal?.aim && Math.hypot(other.animal.aim[0] - x, other.animal.aim[1] - y) < 4)));
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
// The finer pictures of what's on the shelves, one at a time while the round's first word is being announced.
async function buildStoreAhead() {
  if (!isShop(theme?.place)) return;
  const round = objects;
  for (const o of round) {
    if (round !== objects) return;
    modelImage(o.word.sprite, 0, 0, 0, o.word.colour);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

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

// ---------------------------------------------------- people in the store
// Customers pick things off the shelves, queue at the till, pay and leave with a bag. They are only company for the
// player: nobody bumps into them, nobody can touch them, and what they pick stays on the shelf.
const SHOPPING = { least: 5, most: 7, startWith: 3, walk: 0.0015, stepMs: 170, wants: 5, pickMs: 900, browseMs: 3000, moreBrowseMs: 6000, unloadMs: 350, scanMs: 350, payMs: 1000, bagMs: 400, newAfter: 2500, moreNewAfter: 4500, fadeMs: 400, apart: 1.5, awayFromGoal: 2.5, buildRestMs: 100 };
// Where things are, as tile positions like those of the words in the store.
const ONE_TILL = {
  door: [15, 19], outside: [15, 19.9], doorway: [15, 20], baskets: [12.3, 19.1], takeBasket: [13.3, 19], queue: [[3.2, 15], [2.2, 15], [2.2, 14], [2.2, 13], [2.2, 12], [2.2, 11]], unload: [6.2, 17], pay: [8.5, 17], zone: [5.3, 11, 16.5, 18.05, 18.95, 20], takeBag: [9.9, 17], startBaskets: 14, staffDoor: [1.5, 16], staffAtDoor: [12.3, 18], stockDoor: [3.4, 16],
  cashier: [8.1, 19.1], belt: [7.2, 18], beltTiles: [6], beltFrom: 5.9, beltTo: 7.9, goodsApart: 0.5, beltHolds: 5, beltSpeed: 0.002, register: [8.4, 18], registerReach: 0.6, bag: [9.3, 18], closed: 14, counterTop: 11,
  basketSpot: [5.1, 18], basketReach: 1.4, porterHome: [5.1, 19.2], porterAtBasket: [5.1, 19.1], // the counter's start, without a belt, and its basket worker
};
// The grocery store's two lanes, side by side and going the same way. Everyone goes through towards the door, and shares the baskets.
const storeLane = (x) => ({
  ...ONE_TILL, door: [37, 31], outside: [37, 31.9], doorway: [37, 32], baskets: [40.9, 25.9], takeBasket: [40.3, 25.5], staffDoor: [1.5, 25], stockDoor: [3.4, 25], staffAtDoor: [41.3, 25], // fresh baskets just inside the gate, on its right
  upright: true, faceTill: 1, cashierFacing: 3, // its belt runs along y, towards the door's side of the barrier, with the customer on the left
  queue: [[x - 1, 23.2], [x - 1, 22.2], [x - 1, 21.2], [x - 1, 20.2], [x - 2, 20.2], [x - 3, 20.2]], unload: [x - 1, 24.2], pay: [x - 1, 26.5], takeBag: [x - 1, 27.9], zone: [23.3, 29, x - 1.5, x + 0.05],
  cashier: [x + 1.1, 25.5], belt: [x, 25.2], beltTiles: [24], beltFrom: 23.9, beltTo: 25.9, register: [x, 26.4], bag: [x, 27.3],
  basketSpot: [x, 23.05], porterHome: [x + 1.1, 22.4], porterAtBasket: [x + 1.05, 23.1],
  // Where the lane's basket workers stand about while they wait, on the staff's side of the queue: they move between these now and then.
  porterSpots: [[x + 1.1, 22.4], [x + 2, 21.6], [x + 1.6, 20.8], [x + 2.2, 23.3]],
});
const STORE_LANES = [storeLane(24), storeLane(20)];
// The way into the store, at these tiles of the barrier: once inside there's no going back out through it. Must match tools/make_map.py.
const STORE_GATE = { y: 27, x0: 39, x1: 41 };
const gateShut = (x, y) => placeName === "store" && cart.inside && y === STORE_GATE.y && x >= STORE_GATE.x0 && x < STORE_GATE.x1;
// Where along a lane's belt a thing is, and how far along it the character stands.
const onBelt = (lane, along) => (lane.upright ? [lane.belt[0], along] : [along, lane.belt[1]]);
let LANES = [ONE_TILL], TILL = ONE_TILL, laneNow = 0;
let BASKET_TILES = new Set(); // nobody walks through the stacks
function chooseLanes(place) {
  LANES = place === "store" ? STORE_LANES : [ONE_TILL];
  BASKET_TILES = new Set([LANES[0].baskets].map(([x, y]) => `${Math.round(x)},${Math.round(y)}`));
}
// What's done at a till is done at the lane in hand. Between times that's the player's.
function useLane(lane) {
  laneNow = lane;
  TILL = LANES[lane];
  till = tills[lane];
}
// Each customer has a look for each kind of shop, with that shop's goods in the basket.
const customerLooks = () => Object.keys(PERSON_LOOKS).filter((name) => !["cashier", "stocker", "butcher"].includes(name) && !/^(teacher|classmate|store_cashier|cashier_man|porter)/.test(name) && name.startsWith("gear_") === (placeName === "gearstore"));
const DISPLAY_TILES = new Set("SRZPOU");
let shoppers = [];
const newLaneState = (stacks) => ({ queue: [], current: null, goods: [], bag: null, scanning: false, counterBasket: null, get baskets() { return stacks.fresh; }, set baskets(n) { stacks.fresh = n; } });
let tills = [newLaneState({ used: 0, fresh: 0 })], till = tills[0];
let stocker = null;
let porters = []; // the basket workers by the tills
// How many, and in what looks: in the grocery store four, two to each till, so that an emptied basket is soon taken. The hardware
// store has one till and little room by it, and one worker.
const PORTERS = { store: 4, perTill: 1, looks: ["stocker", "porter_woman", "cashier_man", "porter_young"], idleMs: 4000, moreIdleMs: 6000 };
let wantedShoppers = 0, nextShopperIn = 0;

const betweenMs = (least, more) => least + Math.random() * more;

// Tile by tile, so that everyone walks along the aisles and turns at corners.
function shopperPath(fromX, fromY, toX, toY, roundTrolley = true) {
  const start = [Math.round(fromX), Math.round(fromY)], goal = [Math.round(toX), Math.round(toY)];
  const cameFrom = new Map([[`${start}`, null]]);
  const open = [start];
  while (open.length) {
    const here = open.shift();
    if (`${here}` === `${goal}`) break;
    for (const [dx, dy] of MODEL_FACINGS) {
      const next = [here[0] + dx, here[1] + dy];
      // Over the store's barrier, everyone goes in by the gate and out by a lane.
      if (placeName === "store" && next[1] === STORE_GATE.y && next[1] !== here[1] && (next[1] < here[1]) !== (next[0] >= STORE_GATE.x0 && next[0] < STORE_GATE.x1)) continue;
      if (cameFrom.has(`${next}`) || SOLID_TILES.has(tileOr(next[0], next[1], "X")) || BASKET_TILES.has(`${next}`) || (roundTrolley && `${next}` === trolleyTile())) continue;
      cameFrom.set(`${next}`, here);
      open.push(next);
    }
  }
  // Nothing can stand in the way for good, as the trolley only ever takes one tile of an aisle.
  if (!cameFrom.has(`${goal}`) && roundTrolley) return shopperPath(fromX, fromY, toX, toY, false);
  const path = [[toX, toY]];
  for (let at = cameFrom.get(`${goal}`); at; at = cameFrom.get(`${at}`)) path.unshift(at);
  return path;
}

function walkShopper(s, x, y, thenDo) {
  s.path = shopperPath(s.x, s.y, x, y, s !== stocker); // the worker pushes it, or walks round it
  s.arrived = thenDo;
}

// In front of or behind a shelf, fridge or crate, somewhere nobody is already and away from what the player is after.
function shoppingSpot(s) {
  const goal = objects.find((o) => o.word === targets[0]);
  const free = ([x, y]) => !SOLID_TILES.has(tileOr(x, y, "X"))
    && !(goal && Math.hypot(goal.x - x, goal.y - y) < SHOPPING.awayFromGoal)
    && !shoppers.some((other) => other !== s && Math.hypot(other.x - x, other.y - y) < SHOPPING.apart)
    && !(stocker && Math.hypot(stocker.cartX - x, stocker.cartY - y) < 1.2);
  const near = (x, y) => shuffled([[x, y + 1, 2], [x, y - 1, 0]]).find(free);
  const onShow = shuffled(objects.filter((o) => o.word !== targets[0] && DISPLAY_TILES.has(tileOr(Math.round(o.x), Math.round(o.y), "f"))));
  for (const o of onShow) {
    const spot = near(Math.round(o.x), Math.round(o.y));
    if (spot) return spot;
  }
  const displays = [];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (DISPLAY_TILES.has(MAP[y][x])) displays.push([x, y]);
  for (const [x, y] of shuffled(displays)) {
    const spot = near(x, y);
    if (spot) return spot;
  }
  return [s.x, s.y, s.facing];
}

function goShopping(s) {
  const [x, y, facing] = shoppingSpot(s);
  walkShopper(s, x, y, () => {
    s.facing = facing;
    s.doing = "pick";
    s.wait = SHOPPING.pickMs;
  });
}

// The clock starts at the first move of a round, except in the store, where it starts with taking a basket.
function startClock() {
  if (!timer.running && timer.ms === 0 && targets.length && !isShop(theme?.place) && !theme?.camp) timer.running = true;
}

function newShopper(inside) {
  const present = new Set(shoppers.map((s) => s.look));
  const look = shuffled(customerLooks()).find((name) => !present.has(name));
  const s = {
    look, x: TILL.outside[0], y: TILL.outside[1], facing: 2, path: [], hasBasket: inside, arrived: null, doing: "shop", wait: 0, clock: Math.random() * 1000,
    picked: 0, wants: 1 + Math.floor(Math.random() * SHOPPING.wants), bag: `bag${Math.floor(Math.random() * BAGS.length)}`, alpha: inside ? 1 : 0, leaving: false, speed: SHOPPING.walk * (PERSON_LOOKS[look].pace ?? 1),
  };
  shoppers.push(s);
  if (inside) {
    [s.x, s.y, s.facing] = shoppingSpot(s);
    s.picked = Math.floor(Math.random() * s.wants);
    s.wait = betweenMs(0, SHOPPING.moreBrowseMs);
    s.doing = "browse";
  } else {
    walkShopper(s, TILL.takeBasket[0], TILL.takeBasket[1], () => {
      s.facing = 3;
      s.doing = "takeBasket";
      s.wait = SHOPPING.pickMs;
    });
  }
  buildShopperAhead(s);
}

// One picture at a time with a rest between, whoever it's for, so that drawing them doesn't hold up the game.
// Everyone's pictures are made ahead, so it's only a matter of having them loaded before they're seen.
function buildShopperAhead(s) {
  bakedAnimal(`person_${s.look.replace("gear_", "")}`, 0, 0);
}

// The player's own basket: taken from the stack by the door. A fall drops it and spills what's in it, and the character
// picks the basket up again on getting up. The shopping must be walked over to gather it back, quietly.
const newCart = () => ({ inside: false, lane: 0, cashier: Math.random() < 0.5 ? "biret" : "mahtte", has: false, bag: null, stage: "basket", goods: [], dropped: null, spilled: [], said: new Set(), scanIn: 0, total: 0, typed: "", want: new Map() });

// What each thing costs, in whole euros: prices on s-kaupat.fi on 2026-11-04 (no shop chosen), rounded, at least 1.
// Small packs, so that nothing costs more than 8: coffee 250 g, a small cake.
const SHOP_PRICES = {
  apple: 1, banana: 1, bread: 2, milk: 1, cheese: 4, egg: 2, potato: 1, carrot: 1, butter: 4, sausage: 3, berries: 3, icecream: 2, guolli: 6, coffee: 4, sugar: 1, salt: 1,
  tomato: 1, cucumber: 1, onion: 1, cabbage: 2, lettuce: 2, orange: 1, pear: 1, lemon: 1, strawberry: 4, grapes: 3,
  juice: 1, yoghurt: 1, flour: 1, rice: 2, tea: 3, chocolate: 4, candy: 3, cookie: 2, cake: 5, soda: 2, pizza: 4, mushroom: 2, lingonberry: 2, jam: 1,
  gum: 2, bun: 1, pancake: 2,
  reindeermeat: 2, // a 50 g plate, worked out from 15.89 for 400 g
  crispbread: 3, ryebread: 3, toast: 2, smokedmeat: 4, // guessed, not from s-kaupat.fi: for the user to check
  steak: 5, mince: 4, pork: 3,
  cloudberry: 6, // no price found: an estimate
  // The general store's are play prices and not real ones: a whole list has to stay within what the cashier can say.
  axe: 5, saw: 4, spade: 4, hammer: 3, knife: 4, kuksa: 3, lasso: 3, reindeerbell: 2,
  fishnet: 6, lure: 1, rod: 6, scoopnet: 3, bait: 1, oar: 3, fishingline: 1, reel: 3,
  shirt: 3, trousers: 4, gakti: 12, jacket: 6, hat: 2, sock: 1, rubberboots: 5, backpack: 7,
  boat: 15, snowscooter: 20, pulk: 8, lavvu: 12,
};
const ENOUGH_SHOWN_MS = 2000;
const MOST_OF_ONE = 5, MAX_TOTAL = 99; // the cashier has a spoken line for every total up to this

function pickOne(word) {
  cart.goods.push(word);
  cart.total += SHOP_PRICES[word.sprite];
  // Taken from the shelf again, one of those on the floor isn't needed any more.
  const fallen = cart.spilled.find((item) => item.word === word);
  if (fallen) cart.spilled = cart.spilled.filter((item) => item !== fallen);
}

// Nobody buys three boats either. "platform" is where the big things stand.
const ONLY_ONE = new Set(["meat", "egg", "platform", "gakti"]);
// How many of each, from one to five, without the whole list costing more than can be said.
function wantedCounts(words) {
  const cost = () => words.reduce((sum, word) => sum + cart.want.get(word) * SHOP_PRICES[word.sprite], 0);
  // Only one plate of meat, so nobody waits at the counter for more to be cut, and one carton of eggs, as "moniid" says.
  for (const word of words) cart.want.set(word, ONLY_ONE.has(word.place) || ONLY_ONE.has(word.sprite) ? 1 : 1 + Math.floor(Math.random() * MOST_OF_ONE));
  while (cost() > MAX_TOTAL) {
    const dearest = words.filter((word) => cart.want.get(word) > 1).sort((p, q) => SHOP_PRICES[q.sprite] - SHOP_PRICES[p.sprite])[0];
    cart.want.set(dearest, cart.want.get(dearest) - 1);
  }
  return words.flatMap((word) => Array(cart.want.get(word)).fill(word));
}
const HINT_ABOVE = 34; // pixels from the feet up to the bubble
const CART = { takeWithin: 1.3, pickWithin: 0.45, spillNear: 0.7, spillFar: 1.7, spillMs: 350, spillHigh: 12, blinkMs: 260 };
let cart = newCart();

const fallingDown = () => me.knockedAt !== null || me.slideAt !== null || me.restAt !== null;

function spillBasket(now) {
  if ((!cart.has && !cart.bag) || cart.dropped || (cart.setDown && !cart.bag)) return; // a basket on the floor stays there
  // Only where the character can walk to, and with nothing in the way: what hits a fridge or a shelf falls back on this side of it,
  // and nothing lands behind the butcher's counter.
  const walkable = spreadOverGrid(() => false);
  const fine = (x, y) => walkable.has(gridKey(Math.floor(x * GRID), Math.floor(y * GRID))) && clearLine(me.x, me.y, x, y);
  const lands = () => {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2, far = (CART.spillNear + Math.random() * (CART.spillFar - CART.spillNear)) * (1 - i / 32);
      const x = me.x + Math.cos(angle) * far, y = me.y + Math.sin(angle) * far;
      if (fine(x, y) && !cart.spilled.some((item) => Math.hypot(item.x - x, item.y - y) < 0.5)) return [x, y];
    }
    return [me.x, me.y];
  };
  const [bx, by] = lands();
  cart.dropped = { x: bx, y: by, fromX: me.x, fromY: me.y, born: now };
  for (const word of cart.goods) {
    const [x, y] = lands();
    cart.spilled.push({ word, x, y, fromX: me.x, fromY: me.y, born: now });
    // Back on the list until it's picked up again, from the floor or from the shelf.
    targets.push(word);
    cart.total -= SHOP_PRICES[word.sprite];
    stars = Math.max(0, stars - 1);
  }
  if (cart.goods.length && cart.stage === "pay") cart.stage = "shop";
  cart.goods = [];
  showPrompt();
}

const nearBaskets = () => Math.hypot(me.x - TILL.baskets[0] - 0.5, me.y - TILL.baskets[1] - 0.5) < CART.takeWithin;
// Either side of the counter, all along it.
const inZone = ({ zone, upright }) => (upright ? me.y > zone[0] && me.y < zone[1] && me.x > zone[2] && me.x < zone[3]
  : me.x > zone[0] && me.x < zone[1] && ((me.y > zone[2] && me.y < zone[3]) || (me.y > zone[4] && me.y < zone[5])));
// Whichever lane the player comes to with their shopping is theirs, once their basket is on its counter.
function atBelt() {
  if (inZone(TILL)) return true;
  if (LANES.length < 2 || cart.stage !== "pay" || laneNow !== cart.lane || till.counterBasket?.player || till.goods.some((good) => good.word)) return false;
  const lane = LANES.findIndex(inZone);
  if (lane < 0) return false;
  cart.lane = lane;
  useLane(lane);
  return true;
}
const playerAtTill = () => laneNow === cart.lane && (cart.stage === "bag" || cart.stage === "price" || (cart.stage === "pay" && (atBelt() || till.counterBasket?.player || till.goods.some((good) => good.word))));
const onDoorMat = () => Math.abs(me.x - TILL.door[0] - 0.5) < 1 && me.y > TILL.door[1] + 0.2;

function takeBasket() {
  startAction("pick", performance.now());
  cart.has = true;
  timer.running = true; // a store round starts with taking the basket
  if (placeName === "store" && loudspeaker.wait === null) loudspeaker.wait = loudspeakerWait(); // the loudspeaker's first wait starts now
  till.baskets = Math.max(0, till.baskets - 1);
  cart.stage = targets.length ? "shop" : "pay";
  playImpact("brush");
  showPrompt();
}

// The basket goes on the counter's start, where there's no belt, and each thing is lifted out of it and comes onto the belt as the hand
// reaches there. When it's empty, the lane's basket worker takes it back to the stack by the way in.
const BELT_PUT = { atFrame: 0.62, lifted: 0.3, arc: 4 }; // how far into the action it lands, how far into it the thing shows in the hand, and how high it swings
const nearBasketSpot = () => Math.hypot(me.x - 0.5 - TILL.basketSpot[0], me.y - 0.5 - TILL.basketSpot[1]) < (TILL.basketReach ?? 1.5);
function putBasketDown() {
  startAction("belt", performance.now());
  action.flip = !TILL.upright; // the drawing reaches to the screen's right, where an upright lane's belt is; the general store's is to the left
  cart.setDown = TILL.basketSpot;
  till.counterBasket = { player: true, empty: !cart.goods.length };
  playImpact("brush");
}

// Onto the belt beside the character, from anywhere along it.
function putOnBelt() {
  if (cart.toBelt) return;
  const now = performance.now();
  startAction("belt", now);
  action.flip = !TILL.upright;
  const room = TILL.beltTo - till.goods.length * TILL.goodsApart;
  cart.toBelt = { word: cart.goods.pop(), x: Math.max(TILL.beltFrom, Math.min(room, (TILL.upright ? me.y : me.x) - 0.5)), at: now + ACTIONS.belt.ms * BELT_PUT.atFrame };
}

function landOnBelt(now) {
  if (!cart.toBelt || now < cart.toBelt.at) return;
  till.goods.push({ word: cart.toBelt.word, x: cart.toBelt.x });
  cart.toBelt = null;
  if (!cart.goods.length && till.counterBasket?.player) till.counterBasket.empty = true; // for the basket worker
  cart.scanIn = SHOPPING.scanMs;
  playImpact("brush");
}

// On the grocery store's harder level the cashier says the sum again every so often, until it's typed in right.
const PRICE_AGAIN_MS = 10000;
function sayPrice(remind = false) {
  cart.priceAgainIn = PRICE_AGAIN_MS;
  playVoice({ src: `audio/store-price-${cart.total}-${cashierVoice()}.wav`, rate: cashierRate() }, ...(remind ? [`audio/${STORE_HINTS.pay.line}-${VOICES[look.gender]}.wav`] : []));
}

// The harder level: the price the cashier said goes into a calculator.
function showKeypad(note = "") {
  cardEl.className = "keypad";
  cardEl.innerHTML = `<div class="sum">${escapeText(cart.typed) || "&nbsp;"} ${TEXT.euro}</div>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].map((key) => `<button data-key="${key}">${key}</button>`).join("")}</div>
    <button id="hear-price">🔊 ${TEXT.hearAgain}</button>
    <div class="note">${escapeText(note)}</div>`;
  cardEl.querySelectorAll("[data-key]").forEach((button) => button.addEventListener("click", () => {
    button.blur();
    typeKey(button.dataset.key);
  }));
  cardEl.querySelector("#hear-price").addEventListener("click", () => sayPrice());
}

function typeKey(key) {
  if (key === "OK") return confirmPrice();
  if (key === "⌫") cart.typed = cart.typed.slice(0, -1);
  else if (cart.typed.length < 3) cart.typed += key;
  showKeypad();
}

function confirmPrice() {
  if (!atBelt() || !cart.typed) return;
  if (Number(cart.typed) === cart.total) {
    cardEl.className = "";
    cardEl.innerHTML = "";
    payCashier();
    return;
  }
  cart.typed = "";
  showKeypad(TEXT.wrongPrice);
  sayPrice();
}

// The cashier has said the price: E pays, and the bag comes onto the counter.
function payCashier() {
  till.bag = `bag${Math.floor(Math.random() * BAGS.length)}`;
  cart.stage = "bag";
  playImpact("brush");
  showPrompt();
}

// Taking the bag also moves the empty basket to the stack at the end of the counter.
function takeBag() {
  startAction("pick", performance.now());
  cart.bag = till.bag;
  till.bag = null;
  cart.has = false; // the basket stays on the counter for the basket worker
  cart.setDown = null;
  cart.stage = "door";
  playImpact("brush");
  showPrompt();
}

// Behind the meat counter.
const BUTCHER = { at: [2.2, 5.1], board: [3, 5], cutMs: 420, crankMs: 160 };

// Words in the bubbles. Machine made like the game's other sentences: for the user to check.
const BELT_ITEM_PX = 11; // so that nothing on the belt hangs over its edges
const STORE_PROMPTS = { pay: "storePay", price: "storePrice", bag: "storeBag", door: "storeDoor" };
// The cashier is a woman or a man at random each round, and the voice goes with the look.
const otherCashier = () => (cart.cashier === "mahtte" ? "biret" : "mahtte");
const cashierVoice = () => (cart.lane ? otherCashier() : cart.cashier); // each lane has its own
const cashierRate = () => CASHIER_RATE;
const CASHIER_RATE = 0.92; // a little lower and slower than the voice's own
const STORE_HINTS = {
  basket: { line: "store-basket", sme: "Váldde márssu", fi: "Ota kori", act: takeBasket },
  till: { line: "store-till", sme: "Mana kássii", fi: "Mene kassalle" },
  wait: { line: "store-wait", sme: "Vuordde vuoru", fi: "Odota vuoroasi" },
  basketDown: { line: "store-basketdown", sme: "Bija márssu beavdái", fi: "Laita kori pöydälle", act: putBasketDown },
  basketCloser: { line: "store-basketdown", sme: "Bija márssu beavdái", fi: "Laita kori pöydälle" }, // not yet near enough to the counter's start
  belt: { line: "store-belt", sme: "Bija dan beavdái", fi: "Laita se hihnalle", act: putOnBelt },
  full: { line: "store-full", sme: "Vuordde", fi: "Hihna on täynnä" },
  pay: { line: "store-pay", sme: "Mávsse", fi: "Maksa", act: () => (theme.counts ? confirmPrice() : payCashier()) },
  bag: { line: "store-bag", sme: "Váldde seahka", fi: "Ota kassi", act: takeBag },
  door: { line: "store-door", sme: "Mana uksii", fi: "Mene ovelle" },
};
if (LANG === "nb") for (const [id, hint] of Object.entries(STORE_HINTS)) hint.fi = TEXT_NB.storeHints[id] ?? hint.fi;

// What can be done or should be done next in the store.
function storeHint() {
  if (placeName === "camp" && theme?.camp) return campHint();
  if (!isShop(placeName) || !theme) return null;
  if (cart.stage === "basket") return nearBaskets() ? STORE_HINTS.basket : null;
  if (cart.spilled.length) return null;
  if (cart.stage === "pay") {
    if (!atBelt()) return STORE_HINTS.till;
    if (till.current) return STORE_HINTS.wait;
    if (!cart.setDown) return till.counterBasket ? STORE_HINTS.wait : nearBasketSpot() ? STORE_HINTS.basketDown : STORE_HINTS.basketCloser;
    if (!cart.goods.length) return null;
    return till.goods.length < TILL.beltHolds ? STORE_HINTS.belt : STORE_HINTS.full;
  }
  if (cart.stage === "price") return atBelt() ? STORE_HINTS.pay : STORE_HINTS.till;
  if (cart.stage === "bag") return till.bag && atBelt() ? STORE_HINTS.bag : null;
  return cart.stage === "door" ? STORE_HINTS.door : null;
}

// The cashier's work on the player's shopping, and the bag at the end of it.
function scanForPlayer(dt) {
  if (cart.stage === "price" && theme?.counts && placeName === "store") {
    // Waiting for the sum to be typed in: it's said again ten seconds after the last time, once nothing else is being said.
    cart.priceAgainIn = (cart.priceAgainIn ?? PRICE_AGAIN_MS) - dt;
    if (cart.priceAgainIn <= 0 && !voiceBusy) sayPrice();
    return;
  }
  if (till.current || cart.stage !== "pay") return;
  const first = till.goods[0];
  till.scanning = !!first;
  if (first && first.x >= TILL.beltTo - 0.01) {
    cart.scanIn -= dt;
    if (cart.scanIn <= 0) {
      till.goods.shift();
      tillBeep();
      cart.scanIn = SHOPPING.scanMs;
    }
  }
  if (!till.goods.length && !cart.goods.length && !cart.spilled.length && !cart.toBelt) {
    till.scanning = false;
    cart.stage = "price";
    showPrompt();
    // Then the character's reminder, so that it doesn't cut the cashier off.
    cart.said.add(STORE_HINTS.pay.line);
    sayPrice(helpRound);
    if (theme.counts) showKeypad();
  }
}

// ------------------------------------------------------------- help
// Bubbles over the character (press C), and in the store arrows and spoken reminders. On unless switched off.
let helpRound = true;
try {
  helpRound = localStorage.getItem("mahtte.help") !== "off";
} catch {
  // Private windows may refuse; help just stays on.
}

function setHelp(on) {
  helpRound = on;
  try {
    localStorage.setItem("mahtte.help", on ? "on" : "off");
  } catch {
    // The choice still holds for this visit.
  }
  showHelpSwitches();
}

function showHelpSwitches() {
  for (const button of document.querySelectorAll(".help-switch")) {
    button.textContent = helpRound ? TEXT.helpOn : TEXT.helpOff;
    button.setAttribute("aria-pressed", String(helpRound));
  }
}

// What the E key does just now, at the top of the game, whether the bubbles are on or not. Not when only listening.
let topHintShown = null;
function showTopHint(hint) {
  const el = document.getElementById("top-hint");
  const text = hint && !audioOnly ? `${hint.key || hint.act ? "E|" : "|"}${hint.sme ?? ""}|${hint.fi ?? ""}` : "";
  if (!el || text === topHintShown) return;
  topHintShown = text;
  el.style.visibility = text ? "visible" : "hidden";
  if (!text) return;
  const [key, sme, fi] = text.split("|");
  el.innerHTML = `${key ? `<kbd>${key}</kbd> ` : ""}${sme ? `<span lang="se">${escapeText(sme)}</span> ` : ""}<small>${escapeText(fi)}</small>`;
}

let hintShown = null;
function updateHint() {
  const el = document.getElementById("hint");
  if (!el) return;
  const canUse = theme?.lesson ? (!paused && !lesson?.typing && lesson?.current && !lesson.current.answered ? { key: true, fi: LESSON_TEXT.raise } : null) : theme && !paused && !me.sittingOn
    ? storeHint() ?? (thingInReach() ? { key: true, fi: TEXT.useIt } : theme.desks && chairNearMe() ? { key: true, fi: TEXT.sit } : null)
    : null;
  showTopHint(canUse);
  const said = saying && performance.now() < saying.until ? saying : null;
  const hint = said ?? (helpRound ? canUse : null);
  if (hint !== hintShown) {
    hintShown = hint;
    el.hidden = !hint;
    if (hint) {
      const key = hint.key || hint.act ? "<kbd>E</kbd> " : "";
      const words = hint.sme && !audioOnly ? `<span lang="se">${escapeText(hint.sme)}</span> <small>${escapeText(hint.fi)}</small>` : "";
      el.innerHTML = hint.say ? escapeText(hint.say) : `${key}${words}`;
    }
  }
  if (hint) {
    // In whole pixels of the page, or the sign would shake as the view follows the character.
    el.style.left = `${Math.round(((isoX(me.x, me.y) - cam.x) / VIEW_W) * canvas.clientWidth)}px`;
    el.style.bottom = `${Math.round(((VIEW_H - (isoY(me.x, me.y) - cam.y) + HINT_ABOVE) / VIEW_H) * canvas.clientHeight)}px`;
  }
  // Each said once in a round, and never over a find being said.
  if (hint?.line && !cart.said.has(hint.line) && !rightSpeech) {
    cart.said.add(hint.line);
    playVoice(`audio/${hint.line}-${VOICES[look.gender]}.wav`);
  }
}

const CHARACTER_NAMES = { biret: "Biret", mahtte: "Máhtte" };

function updateCart(now) {
  if (!isShop(placeName)) return;
  if (fallingDown()) return;
  cart.dropped = null;
  if (cart.stage === "door" && onDoorMat()) {
    cart.stage = "out";
    finishRound(loadName() || "");
    return;
  }
  if (me.height > 0 || me.running) return;
  const reached = cart.spilled.find((item) => now - item.born > CART.spillMs && Math.hypot(me.x - item.x, me.y - item.y) < CART.pickWithin);
  if (reached) {
    cart.spilled = cart.spilled.filter((item) => item !== reached);
    pickOne(reached.word);
    playImpact("brush");
    if (targets.includes(reached.word)) {
      targets.splice(targets.indexOf(reached.word), 1);
      stars++;
    }
    if (!targets.length && cart.stage === "shop") cart.stage = "pay";
    showPrompt();
  }
}

// Where the basket hangs beside the character on the screen, and whether the body hides it.
const CARRIED = { S: [8, -8, true], SE: [8, -8, true], E: [4, -8, true], NE: [8, -8, false], N: [-8, -8, false], NW: [-8, -8, false], W: [-4, -8, true], SW: [-8, -8, true] };
const carriedBasket = () => (isShop(placeName) && ((cart.has && !cart.setDown) || cart.bag) && !cart.dropped ? CARRIED[me.facing] : null);

// It swings with each step, further at a run, and comes down when the character crouches.
function basketSwing() {
  const swing = me.moving ? Math.sin((walkClock / STEP_EVERY_MS) * Math.PI) * (me.running ? 2.5 : 1.2) : 0;
  return [Math.round(swing), Math.round(Math.abs(swing) * -0.5) + (crouching ? 4 : 0)];
}

function setupShoppers() {
  cart = newCart();
  shoppers = [];
  chooseLanes(placeName);
  cart.lane = 0;
  const stacks = { fresh: LANES[0].startBaskets };
  tills = LANES.map(() => newLaneState(stacks));
  useLane(0);
  stocker = null;
  const count = !isShop(placeName) ? 0 : placeName === "store" ? PORTERS.store : LANES.length * PORTERS.perTill;
  porters = Array.from({ length: count }, (_, i) => {
    const home = i % LANES.length, lane = LANES[home];
    const spots = lane.porterSpots ?? [lane.porterHome];
    const [x, y] = spots[Math.floor(i / LANES.length) % spots.length];
    const look = PORTERS.looks[i % PORTERS.looks.length];
    return { lane: home, home, look, x, y, facing: lane.upright ? 3 : 2, path: [], arrived: null, clock: 0, wait: 0, then: null, carrying: "none", doing: "wait",
      idle: betweenMs(PORTERS.idleMs, PORTERS.moreIdleMs), alpha: 1, speed: SHOPPING.walk * (PERSON_LOOKS[look].pace ?? 1) };
  });
  wantedShoppers = 0;
  if (!isShop(placeName)) return;
  wantedShoppers = SHOPPING.least + Math.floor(Math.random() * (SHOPPING.most - SHOPPING.least + 1));
  nextShopperIn = betweenMs(SHOPPING.newAfter, SHOPPING.moreNewAfter);
  setupStocker();
  for (let i = 0; i < SHOPPING.startWith; i++) newShopper(true);
}

// How many goods show in the basket, which holds more than can be seen.
const shownGoods = (s) => Math.min(s.picked, 3);

function joinQueue(s) {
  // The shorter line, counting whoever is at the till, the player too.
  const playerThere = (i) => (cart.lane === i && ["pay", "price", "bag"].includes(cart.stage) ? 1 : 0);
  s.lane = tills.map((lane, i) => [lane.queue.length + (lane.current ? 1 : 0) + playerThere(i), i]).sort((a, b) => a[0] - b[0])[0][1];
  useLane(s.lane);
  till.queue.push(s);
  s.doing = "queue";
  s.spot = null;
}

// Everyone moves up when someone goes to the till. Only one is at the till at a time, and none while the player is.
function moveQueue() {
  // While the player is at this lane's belt, the line keeps one place further back, out of their way.
  const back = laneNow === cart.lane && (playerAtTill() || (cart.stage === "pay" && inZone(TILL))) ? 1 : 0;
  till.queue.forEach((s, i) => {
    const spot = TILL.queue[Math.min(i + back, TILL.queue.length - 1)];
    if (s.spot === spot) return;
    s.spot = spot;
    walkShopper(s, spot[0], spot[1], () => {
      s.facing = TILL.upright ? 0 : TILL.faceTill ?? 0; // looking along the line, towards the till
    });
  });
  const next = till.queue[0];
  if (till.current || !next || next.path.length || playerAtTill()) return;
  till.queue.shift();
  till.current = next;
  next.doing = "toTill";
  walkShopper(next, TILL.unload[0], TILL.unload[1], () => {
    next.facing = TILL.faceTill ?? 0;
    next.doing = "putBasket";
    next.wait = SHOPPING.bagMs;
  });
}

function moveGoodsOnBelt(dt) {
  till.goods.forEach((good, i) => {
    good.x = Math.min(TILL.beltTo - i * TILL.goodsApart, good.x + TILL.beltSpeed * dt);
  });
}

function walkAlong(s, dt) {
  let left = s.speed * dt;
  s.clock += dt;
  while (left > 0 && s.path.length) {
    const [gx, gy] = s.path[0];
    const dx = gx - s.x, dy = gy - s.y, away = Math.hypot(dx, dy);
    if (away > 0.01) s.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);
    const step = Math.min(left, away);
    if (away > 0) {
      s.x += (dx / away) * step;
      s.y += (dy / away) * step;
    }
    left -= step;
    if (step === away) s.path.shift();
  }
  if (!s.path.length && s.arrived) {
    const arrived = s.arrived;
    s.arrived = null;
    arrived();
  }
}

function updateShopper(s, dt) {
  if (s.path.length) {
    walkAlong(s, dt);
    return;
  }
  if (s.doing === "queue" || s.doing === "toTill" || s.doing === "leave") return;
  s.wait -= dt;
  if (s.wait > 0) return;
  if (s.doing === "takeBasket") {
    s.hasBasket = true;
    till.baskets = Math.max(0, till.baskets - 1);
    goShopping(s);
  } else if (s.doing === "pick") {
    s.picked++;
    s.doing = "browse";
    s.wait = betweenMs(SHOPPING.browseMs, SHOPPING.moreBrowseMs);
  } else if (s.doing === "browse") {
    if (s.picked >= s.wants) joinQueue(s);
    else goShopping(s);
  } else if (s.doing === "putBasket") {
    // Onto the counter's start, as the player does, once the basket worker has taken the last one away.
    if (till.counterBasket) {
      s.wait = SHOPPING.bagMs;
      return;
    }
    s.hasBasket = false;
    till.counterBasket = { empty: false };
    s.doing = "unload";
    s.wait = SHOPPING.unloadMs;
  } else if (s.doing === "unload") {
    // One by one onto the belt, and off to the card reader when the basket is empty, which the basket worker then takes.
    till.goods.unshift({ kind: PERSON_LOOKS[s.look].goods[s.picked % 3], x: TILL.beltFrom });
    s.picked--;
    s.wait = SHOPPING.unloadMs;
    if (s.picked <= 0) {
      if (till.counterBasket) till.counterBasket.empty = true;
      s.doing = "toPay";
      walkShopper(s, TILL.pay[0], TILL.pay[1], () => {
        s.facing = TILL.faceTill ?? 0;
        s.doing = "scan";
        s.wait = SHOPPING.scanMs;
      });
    }
  } else if (s.doing === "scan") {
    till.scanning = till.goods.length > 0;
    if (till.goods.shift()) tillBeep();
    s.wait = SHOPPING.scanMs;
    if (!till.goods.length) {
      s.doing = "pay";
      s.wait = SHOPPING.payMs;
    }
  } else if (s.doing === "pay") {
    till.scanning = false;
    till.bag = s.bag;
    s.doing = "toBag";
    walkShopper(s, TILL.takeBag[0], TILL.takeBag[1], () => {
      s.facing = TILL.faceTill ?? 0;
      s.doing = "takeBag";
      s.wait = SHOPPING.bagMs;
    });
  } else if (s.doing === "takeBag") {
    till.bag = null;
    till.current = null;
    s.carriesBag = true;
    s.doing = "leave";
    walkShopper(s, TILL.door[0], TILL.door[1], () => {
      s.leaving = true;
    });
    s.path.push(TILL.outside);
  }
}

// A worker fills the shelves from a small trolley, now and then pushing it further along. When the boxes are empty they push the trolley
// through the staff door and come back with a full one.
// The trolley only stands right beside a shelf in an aisle four tiles wide, so there's always a way past it.
const STOCK = { least: 10, most: 20, itemMs: 2600, awayLeast: 10000, awayMore: 10000, reachMs: 700, moveAfter: 18000, moreMoveAfter: 22000, nearest: 3, furthest: 9, glide: 0.002, solid: 0.45, playerClear: 2.5, itemClear: 2 };

// Beside a shelf, fridge or crate: where the worker stands, with the trolley on the next tile.
function stockSpots() {
  const spots = [];
  for (let y = 0; y < HEIGHT - 1; y++) for (let x = 0; x < WIDTH - 1; x++) {
    if (!DISPLAY_TILES.has(MAP[y][x]) || !DISPLAY_TILES.has(MAP[y][x + 1])) continue;
    if (SOLID_TILES.has(MAP[y + 1][x]) || SOLID_TILES.has(MAP[y + 1][x + 1])) continue;
    spots.push({ x, y: y + 1, facing: 2 });
  }
  return spots;
}

function chooseStockSpot(from) {
  const goal = objects.find((o) => o.word === targets[0]);
  const fits = (spot) => (!from || (Math.abs(spot.x - from.x) + Math.abs(spot.y - from.y) >= STOCK.nearest && Math.abs(spot.x - from.x) + Math.abs(spot.y - from.y) <= STOCK.furthest))
    && Math.hypot(spot.x + 1.5 - me.x, spot.y + 0.5 - me.y) > STOCK.playerClear
    && !(goal && Math.hypot(goal.x - spot.x - 1, goal.y - spot.y) < STOCK.itemClear)
    && !shoppers.some((other) => Math.hypot(other.x - spot.x - 1, other.y - spot.y) < 1.2);
  return shuffled(stockSpots()).find(fits) ?? null;
}

const trolleySolid = (x, y, room) => stocker && !stocker.away && Math.hypot(x - stocker.cartX - 0.5, y - stocker.cartY - 0.5) < STOCK.solid + room;
const trolleyTile = () => (stocker && !stocker.away ? `${Math.round(stocker.cartX)},${Math.round(stocker.cartY)}` : "");

function setupStocker() {
  stocker = null;
  const spot = shuffled(stockSpots())[0];
  stocker = {
    x: spot.x, y: spot.y, facing: spot.facing, spot, cartX: spot.x + 1, cartY: spot.y, path: [], arrived: null, clock: 0, wait: 0, then: null,
    carrying: 0, count: 0, doing: "fill", pushing: false, away: false, alpha: 1, stock: stockLoad(), itemIn: STOCK.itemMs, moveIn: STOCK.moveAfter * Math.random() + STOCK.moveAfter, speed: SHOPPING.walk * PERSON_LOOKS.stocker.pace,
  };
}

const stockLoad = () => STOCK.least + Math.floor(Math.random() * (STOCK.most - STOCK.least + 1));
const boxesLeft = (stock) => Math.ceil(stock / (STOCK.most / 3));

// Off through the staff door with the empty trolley, and back with a full one.
function fetchStock(s) {
  s.doing = "refill";
  s.pushing = true;
  walkShopper(s, ...TILL.stockDoor, () => {
    s.facing = 3;
    s.leaving = true;
    s.wait = SHOPPING.fadeMs;
    s.then = () => {
      s.away = true;
      s.pushing = false;
      s.wait = STOCK.awayLeast + Math.random() * STOCK.awayMore;
      s.then = () => {
        s.away = false;
        s.leaving = false;
        s.stock = stockLoad();
        [s.x, s.y] = TILL.stockDoor;
        s.cartX = s.x - 0.9;
        s.cartY = s.y;
        s.facing = 1;
        pushTrolley(s, chooseStockSpot(null) ?? s.spot);
      };
    };
  });
}

function pauseThen(s, facing, thenDo) {
  s.facing = facing;
  s.wait = SHOPPING.pickMs;
  s.then = thenDo;
}

// The basket workers wait by the tills. An emptied basket at a counter's start, the player's or a customer's, the nearest free one takes
// to the stack by the way in, and comes back to wait for the next.
// Whoever of them is free and nearest goes for a basket emptied at either till; the others wait, and now and then move a little.
function sendPorters() {
  LANES.forEach((lane, i) => {
    const basket = tills[i].counterBasket;
    if (!basket?.empty || basket.taker) return;
    const [bx, by] = lane.porterAtBasket;
    const free = porters.filter((p) => (p.doing === "wait" || p.doing === "wander") && p.wait <= 0);
    if (!free.length) return;
    const p = free.reduce((best, q) => (Math.hypot(q.x - bx, q.y - by) < Math.hypot(best.x - bx, best.y - by) ? q : best));
    basket.taker = p;
    p.lane = i;
    p.doing = "go";
  });
}

// A place to stand by the porter's own till that nobody else stands at or is on the way to.
function porterSpot(p) {
  const lane = LANES[p.home], spots = lane.porterSpots ?? [lane.porterHome];
  const taken = (x, y) => porters.some((q) => q !== p && Math.hypot((q.goalX ?? q.x) - x, (q.goalY ?? q.y) - y) < 0.7);
  return shuffled(spots).find(([x, y]) => !taken(x, y) && Math.hypot(p.x - x, p.y - y) > 0.3) ?? [p.x, p.y];
}

function porterBack(p) {
  const [x, y] = porterSpot(p);
  p.goalX = x; p.goalY = y;
  walkShopper(p, x, y, () => {
    p.facing = LANES[p.home].upright ? 3 : 2;
    p.doing = "wait";
    p.goalX = p.goalY = null;
    p.idle = betweenMs(PORTERS.idleMs, PORTERS.moreIdleMs);
  });
}

function updatePorter(p, dt) {
  if (p.wait > 0) {
    p.wait -= dt;
    if (p.wait <= 0 && p.then) {
      const then = p.then;
      p.then = null;
      then();
    }
    return;
  }
  if (p.doing === "go") {
    p.doing = "fetch";
    p.goalX = p.goalY = null;
    walkShopper(p, ...TILL.porterAtBasket, () => takeCounterBasket(p));
  }
  if (p.path.length) {
    walkAlong(p, dt);
    return;
  }
  if (p.doing === "wait" && (p.idle -= dt) <= 0) {
    // Stood long enough: a few steps to another place by the till.
    porterBack(p);
    p.doing = "wander";
  }
}

// At the counter's start: the emptied basket, the player's or a customer's, to the stack by the way in, and then back by the till.
function takeCounterBasket(p) {
  useLane(p.lane);
  pauseThen(p, TILL.upright ? 3 : 2, () => {
    useLane(p.lane);
    if (till.counterBasket?.player) {
      cart.setDown = null;
      cart.has = false;
    }
    till.counterBasket = null;
    p.carrying = "one";
    walkShopper(p, ...TILL.staffAtDoor, () => pauseThen(p, 0, () => {
      till.baskets++; // the stack is shared by both lanes
      p.carrying = "none";
      p.lane = p.home;
      p.doing = "back";
      porterBack(p);
    }));
  });
}

function pushTrolley(s, spot) {
  s.doing = "push";
  s.pushing = true;
  s.spot = spot;
  walkShopper(s, spot.x, spot.y, () => {
    s.pushing = false;
    s.facing = spot.facing;
    s.doing = "fill";
    s.moveIn = STOCK.moveAfter + Math.random() * STOCK.moreMoveAfter;
  });
}

function updateStocker(dt) {
  const s = stocker;
  if (!s) return;
  s.clock += dt;
  s.alpha = Math.max(0, Math.min(1, s.alpha + (dt / SHOPPING.fadeMs) * (s.leaving ? -1 : 1)));
  if (s.away) {
    s.wait -= dt;
    if (s.wait <= 0) {
      const then = s.then;
      s.then = null;
      then();
    }
    return;
  }
  // The trolley rolls to where it's wanted: ahead of someone pushing it, or beside them at the shelf.
  const [forwardX, forwardY] = MODEL_FACINGS[s.facing];
  const wantX = s.pushing ? s.x + forwardX * 0.9 : s.spot.x + 1, wantY = s.pushing ? s.y + forwardY * 0.9 : s.spot.y;
  const rollX = wantX - s.cartX, rollY = wantY - s.cartY, roll = Math.hypot(rollX, rollY);
  const rolling = roll > 0.01 && (s.pushing || s.doing === "fill");
  const stepNext = Math.min(roll, STOCK.glide * dt);
  const nextX = rolling ? s.cartX + (rollX / roll) * stepNext : s.cartX, nextY = rolling ? s.cartY + (rollY / roll) * stepNext : s.cartY;
  // Never onto the player: they wait until there's room.
  if (rolling && Math.hypot(nextX + 0.5 - me.x, nextY + 0.5 - me.y) < STOCK.solid + MOVE.radius + 0.05) return;
  s.cartX = nextX;
  s.cartY = nextY;
  if (s.wait > 0) {
    s.wait -= dt;
    if (s.wait <= 0) {
      const then = s.then;
      s.then = null;
      then();
    }
    return;
  }
  if (s.path.length) {
    walkAlong(s, dt);
    return;
  }
  if (s.doing !== "fill") return;
  // Item by item off the trolley, until the boxes are empty.
  s.itemIn -= dt;
  if (s.itemIn <= 0) {
    s.stock--;
    s.itemIn = STOCK.itemMs;
    if (s.stock <= 0) {
      fetchStock(s);
      return;
    }
  }
  s.moveIn -= dt;
  if (s.moveIn <= 0) {
    const spot = chooseStockSpot(s.spot);
    if (spot) pushTrolley(s, spot);
    else s.moveIn = STOCK.moveAfter;
  }
}

// Announcements over Ruokakauppa's loudspeaker, in Sunná's voice, now and then: the first 45 to 90 seconds after the basket is taken and each
// next one as long after the last, so some rounds hear none and some two, and never the same one twice running. They're made in
// tools/store3d/make_announcements.py. They go over whoever is speaking, as a real one would, and nothing done in the game cuts one off; only
// leaving the store does. Named apart from announce(), which shows what to find.
const LOUDSPEAKER_LINES = ["pa-staff-till", "pa-staff-bottles", "pa-car-lights", "pa-licence"];
const LOUDSPEAKER = { fromS: 45, toS: 90, level: 0.6, fadeS: 0.4 };
const loudspeaker = { wait: null, last: null, playing: null }; // no waiting until the basket is taken
const loudspeakerWait = () => (LOUDSPEAKER.fromS + Math.random() * (LOUDSPEAKER.toS - LOUDSPEAKER.fromS)) * 1000;

async function playLoudspeaker() {
  const choices = LOUDSPEAKER_LINES.filter((name) => name !== loudspeaker.last);
  loudspeaker.last = choices[Math.floor(Math.random() * choices.length)];
  loudspeaker.playing = true; // until it ends, or it couldn't play
  const buffer = sound && await lineBuffer(`audio/${loudspeaker.last}.wav`);
  if (!buffer || placeName !== "store" || loudspeaker.playing !== true) {
    loudspeaker.playing = null;
    return;
  }
  const source = sound.createBufferSource();
  source.buffer = buffer;
  const gain = sound.createGain();
  gain.gain.value = LOUDSPEAKER.level;
  source.connect(gain).connect(sound.destination);
  source.onended = () => {
    if (loudspeaker.playing?.source === source) loudspeaker.playing = null;
  };
  source.start(sound.currentTime + SOUND_AHEAD);
  loudspeaker.playing = { source, gain };
}

function updateLoudspeaker(dt) {
  if (placeName !== "store" || !theme || loudspeaker.wait === null || loudspeaker.playing) return; // only called while the game isn't paused
  loudspeaker.wait -= dt;
  if (loudspeaker.wait <= 0) {
    loudspeaker.wait = loudspeakerWait();
    playLoudspeaker();
  }
}

// Leaving the store, or a new round: quiet until the basket is taken again.
function stopLoudspeaker() {
  loudspeaker.wait = null;
  const playing = loudspeaker.playing;
  loudspeaker.playing = null;
  if (!playing?.source) return;
  const now = sound.currentTime;
  playing.gain.gain.setTargetAtTime(0, now, LOUDSPEAKER.fadeS / 3);
  playing.source.stop(now + LOUDSPEAKER.fadeS);
}

function updateShoppers(dt) {
  if (!isShop(placeName)) return;
  LANES.forEach((_, lane) => {
    useLane(lane);
    moveQueue();
    moveGoodsOnBelt(dt);
  });
  useLane(cart.lane);
  landOnBelt(performance.now());
  scanForPlayer(dt);
  updateStocker(dt);
  sendPorters();
  for (const p of porters) {
    useLane(p.lane);
    updatePorter(p, dt);
  }
  useLane(cart.lane);
  for (const s of shoppers) {
    useLane(s.lane ?? cart.lane);
    updateShopper(s, dt);
    useLane(cart.lane);
    s.alpha = Math.max(0, Math.min(1, s.alpha + (dt / SHOPPING.fadeMs) * (s.leaving ? -1 : 1)));
  }
  shoppers = shoppers.filter((s) => !(s.leaving && s.alpha === 0));
  nextShopperIn -= dt;
  if (shoppers.length < wantedShoppers && nextShopperIn <= 0) {
    newShopper(false);
    nextShopperIn = betweenMs(SHOPPING.newAfter, SHOPPING.moreNewAfter);
  }
}

// What of all this to draw, nearest last. Things on the counter are lifted by its height.
function storeLife(now) {
  if (!isShop(placeName)) return [];
  const flying = (thing, along) => ({
    x: thing.fromX + (thing.x - thing.fromX) * along - 0.5, y: thing.fromY + (thing.y - thing.fromY) * along - 0.5,
    lift: Math.round(Math.sin(along * Math.PI) * CART.spillHigh),
  });
  // Drawn straight after the counter tile under the far end of them, or the next tile would cover them.
  const onCounter = (sprite, [x, y], reach = 0) => ({ sprite, x, y, facing: 0, frame: 0, lift: TILL.counterTop, d: Math.floor(x + 0.5 + reach) + y + 1.05 });
  const turned = (lane, sprite) => (lane.upright ? `${sprite}_up` : sprite);
  const tillAt = (lane) => [
    onCounter(turned(lane, "till_belt"), onBelt(lane, lane.beltTiles[0])), onCounter(turned(lane, "till_belt"), onBelt(lane, lane.beltTiles[0] + 1)),
    onCounter(turned(lane, "till_belt_end"), onBelt(lane, lane.beltTiles[0] + 2)), onCounter(turned(lane, "till_register"), lane.register, lane.upright ? 0 : lane.registerReach),
  ];
  const cashierCalled = (lane) => (lane ? otherCashier() : cart.cashier);
  const things = [
    ...LANES.flatMap(tillAt),
    { sprite: "store_mat", x: TILL.door[0], y: TILL.door[1], facing: 0, frame: 0, order: -2 },
    { sprite: "store_door", x: TILL.doorway[0], y: TILL.doorway[1], facing: 0, frame: 0 },
    { sprite: "staff_door", x: TILL.staffDoor[0], y: TILL.staffDoor[1], facing: 0, frame: 0 },
    ...LANES.map((lane, i) => ({ sprite: `person_${placeName === "store" ? "store_cashier" : "cashier"}${cashierCalled(i) === "mahtte" ? "_man" : ""}`, x: lane.cashier[0], y: lane.cashier[1], facing: lane.cashierFacing ?? 2, frame: tills[i].scanning ? 3 : 0, carrying: 0, shadow: true })),
  ];
  if (placeName !== "store") return shopGoings(things, now, flying, onCounter);
  // The butcher, cutting the big piece.
  const cutting = Math.floor(now / BUTCHER.cutMs) % 2;
  things.push({ sprite: "person_butcher", x: BUTCHER.at[0], y: BUTCHER.at[1], facing: 1, frame: cutting ? 3 : 0, carrying: 0, shadow: true });
  things.push({ sprite: "meat_board", x: BUTCHER.board[0], y: BUTCHER.board[1], facing: 0, frame: 0, lift: TILL.counterTop, d: BUTCHER.board[0] + BUTCHER.board[1] + 1.1 });
  return shopGoings(things, now, flying, onCounter);
}

// What happens in any shop: the baskets, the helper's arrow, spilled shopping, the belt and the customers.
function shopGoings(things, now, flying, onCounter) {
  if (till.baskets) things.push({ sprite: "basket_stack", x: TILL.baskets[0], y: TILL.baskets[1], facing: 0, frame: 0, carrying: Math.min(5, till.baskets), shadow: true });
  if (stocker) {
    const walking = stocker.path.length > 0 && !stocker.wait;
    const filling = stocker.doing === "fill" && Math.floor(stocker.clock / STOCK.reachMs) % 2;
    const frame = walking ? 1 + (Math.floor(stocker.clock / SHOPPING.stepMs) % 2) : filling || stocker.wait > 0 ? 3 : 0;
    if (!stocker.away) {
      things.push({ sprite: "person_stocker", x: stocker.x, y: stocker.y, facing: stocker.facing, frame, carrying: stocker.carrying, alpha: stocker.alpha, shadow: true });
      things.push({ sprite: "stock_trolley", x: stocker.cartX, y: stocker.cartY, facing: 0, frame: 0, carrying: boxesLeft(stocker.stock), alpha: stocker.alpha, shadow: true });
    }
  }
  const atTill = atBelt();
  const pointsAt = helpRound && { basket: TILL.baskets, pay: atTill ? (cart.setDown ? null : TILL.basketSpot) : TILL.belt, price: atTill ? null : TILL.belt, bag: TILL.bag, door: TILL.door }[cart.stage];
  // Either till will do until the basket is on one of their counters.
  const anyTill = cart.stage === "pay" && !cart.setDown && pointsAt === TILL.belt;
  const markHigh = { [TILL.bag]: 22, [TILL.door]: 4, [TILL.baskets]: 7, [TILL.basketSpot]: 18 };
  for (const at of anyTill ? LANES.map((lane) => lane.belt) : pointsAt ? [pointsAt] : []) {
    things.push({ marker: true, x: at[0], y: at[1], lift: (markHigh[at] ?? 20) + Math.round(Math.sin(now / 180) * 2), d: Infinity });
  }
  // Baskets on the counters' starts, being emptied or waiting for the basket worker, and the thing on its way out of the player's.
  tills.forEach((lane, i) => {
    if (lane.counterBasket) things.push({ ...onCounter(lane.counterBasket.player ? "player_basket" : "basket_stack", LANES[i].basketSpot), carrying: 1, shadow: false });
  });
  if (cart.toBelt && cart.setDown) {
    const lands = ACTIONS.belt.ms * BELT_PUT.atFrame, along = 1 - (cart.toBelt.at - now) / lands;
    if (along > BELT_PUT.lifted) {
      const k = Math.min(1, (along - BELT_PUT.lifted) / (1 - BELT_PUT.lifted));
      const [fromX, fromY] = cart.setDown, [toX, toY] = onBelt(TILL, cart.toBelt.x);
      const lift = Math.round(TILL.counterTop + 3 + Math.sin(k * Math.PI) * BELT_PUT.arc);
      things.push({ picture: cart.toBelt.word, scale: 0.45, fits: BELT_ITEM_PX, x: fromX + (toX - fromX) * k, y: fromY + (toY - fromY) * k, lift, d: Infinity });
    }
  }
  if (cart.dropped) {
    const carried = cart.bag ? { sprite: "till_bag", carrying: Number(cart.bag.slice(3)) } : { sprite: "player_basket" };
    things.push({ ...carried, facing: 0, frame: 0, shadow: true, ...flying(cart.dropped, Math.min(1, (now - cart.dropped.born) / CART.spillMs)) });
  }
  for (const item of cart.spilled) {
    things.push({ picture: item.word, alpha: Math.floor(now / CART.blinkMs) % 2 ? 0.4 : 1, ...flying(item, Math.min(1, (now - item.born) / CART.spillMs)) });
  }
  tills.forEach((lane, i) => {
    for (const good of lane.goods) {
      if (good.word) things.push({ ...onCounter(null, onBelt(LANES[i], good.x)), picture: good.word, scale: 0.45, fits: BELT_ITEM_PX });
      else things.push(onCounter(`good_${good.kind}`, onBelt(LANES[i], good.x)));
    }
    if (lane.bag) things.push({ ...onCounter("till_bag", LANES[i].bag), carrying: Number(lane.bag.slice(3)) });
  });
  for (const p of porters) {
    const frame = p.path.length ? 1 + (Math.floor(p.clock / SHOPPING.stepMs) % 2) : p.wait > 0 ? 3 : 0;
    things.push({ sprite: `person_${p.look}`, x: p.x, y: p.y, facing: p.facing, frame, carrying: p.carrying, alpha: p.alpha, shadow: true });
  }
  for (const s of shoppers) {
    const walking = s.path.length > 0;
    const reaching = s.doing === "pick" || s.doing === "takeBasket" || s.doing === "putBasket" || (s.doing === "unload" && s.wait > SHOPPING.unloadMs / 2);
    const frame = walking ? 1 + (Math.floor(s.clock / SHOPPING.stepMs) % 2) : reaching ? 3 : s.doing === "pay" ? 4 : 0;
    things.push({ sprite: `person_${s.look}`, x: s.x, y: s.y, facing: s.facing, frame, carrying: s.carriesBag ? s.bag : s.hasBasket ? shownGoods(s) : "none", alpha: s.alpha, shadow: true });
  }
  return things;
}

// Which picture of an animal to draw now, and how high off the ground.
function animalPose(o, now) {
  const a = o.animal;
  const way = ANIMAL_WAYS[o.word.sprite];
  if (o.reaction) {
    const along = Math.min(1, (now - o.reaction.born) / o.reaction.ms);
    const beat = Math.floor(now / WANDER.beatMs) % 2;
    if (o.reaction.flies) return { facing: a?.facing ?? 0, frame: 3 + beat, lift: Math.round(along * along * FLY_OFF_HIGH) };
    if (o.reaction.lands) return { facing: a?.facing ?? 0, frame: Math.floor(now / WANDER.flutterMs) % 2, lift: Math.round(Math.min(1, along * 2) * LANDED_HIGH) };
    return { facing: a?.facing ?? 0, frame: 0, lift: 0 };
  }
  if (a && now < (a.sleepUntil ?? 0)) return { facing: a.facing, frame: 12, lift: 0, asleep: true };
  if (a && now < (a.fleeUntil ?? 0)) {
    if (way.hops) {
      const hop = (a.clock % WANDER.hopMs) / WANDER.hopMs;
      return { facing: a.facing, frame: hop < 0.7 ? 1 : 0, lift: Math.round(Math.sin((hop / 0.7) * Math.PI) * 5 * (hop < 0.7)) };
    }
    return { facing: a.facing, frame: 10 + (Math.floor(a.clock / SLEEP.fleeFrameMs) % 2), lift: 0 };
  }
  // Now and then one that's standing has its head down, eating or sniffing at the ground.
  if (a && !a.aim && placeName === "forest" && (o.word.sprite === "beana" || window.MAHTTE_ANIMALS?.[o.word.sprite]?.frames.includes(13)) && !a.greeting && (now + o.phase * 4) % 11000 < 4200) return { facing: a.facing, frame: 13, lift: 0 };
  if (a?.crossing && !way.flights) return { facing: a.facing, frame: 3 + (Math.floor(now / WANDER.beatMs) % 2), lift: Math.round(flightHeight(o, a)) };
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
const SIT = { reach: 0.75, walkUpTo: 0.5, downMs: 180, lookMs: 950, upMs: 180, swingMs: 130, seatUp: 3 }; // seatUp: a standing picture's feet are drawn this much below where someone stands, a sitting one's hips go over the seat's middle
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
  startClock();
  playImpact("chair");
}

function sitAtChair(chair, repeat) {
  if (repeat || me.sittingOn || me.slideAt !== null || me.restAt !== null || me.knockedAt !== null) return;
  sitOn(chair, performance.now());
}

// The C key: sits at a chair in the classroom, or else crouches.
function sitOrCrouch(repeat) {
  if (paused || theme?.lesson) return;
  const chair = theme?.desks && chairNearMe();
  if (chair) sitAtChair(chair, repeat);
  else crouching = true;
}

// The E key, or the Ota or Istu button: the default action, on what's at hand. Q is kept for putting things away later.
function useKey(repeat) {
  if (paused || repeat) return;
  if (theme?.lesson) {
    lessonRaise(performance.now());
    return;
  }
  const chair = theme?.desks && chairNearMe();
  if (chair) sitAtChair(chair, repeat);
  else activate(performance.now());
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

// Whether a runner glancing off something has room to slide on past it.
function slidePathFree(mx, my) {
  for (let along = 0.1; along <= SLIDE.freeAhead; along += 0.1) {
    if (blockedAt(me.x + mx * along, me.y + my * along)) return false;
  }
  return true;
}

function startSlide(mx, my, now) {
  spillBasket(now);
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
  updateGlide(now);
  if (now < (me.heldUntil ?? 0)) {
    me.running = false;
    me.moving = false;
    me.moveX = me.moveY = 0;
    tapped = null;
    return;
  }
  if (me.sittingOn) {
    me.running = false;
    me.moving = false;
    me.moveX = me.moveY = 0;
    tapped = null;
    if (!theme?.lesson) moveSitting(now); // at a lesson nobody gets up
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
  const moving = len > 0 && !paused;
  // A tapped route to a thing slows to a walk on arriving, as a runner would only run into it and can't touch it.
  const arriving = !ix && !iy && me.goal && me.route.length && awayFrom(me.goal, me.x, me.y) < thingReach(me.goal) + SLIDE.lookAhead;
  me.running = moving && runKey && !arriving && !crouching;
  if (moving) {
    startClock(); // the first move of the round
    if (action) action = null; // moving ends a cheer or a jump at once
    const beforeX = me.x, beforeY = me.y;
    const step = Math.min(MOVE.speed * (me.running ? RUN.speed : crouching ? CROUCH_SPEED : 1) * dt, 0.2);
    me.hitX = null;
    me.hitTree = null;
    me.x += (mx / len) * step;
    me.y += (my / len) * step;
    const aimX = me.x, aimY = me.y;
    collide();
    // A runner only falls on really touching something: straight into it onto the bottom, or past it onto the tummy
    // if there's room to slide.
    if (me.running && me.jumpedAt === null && Math.hypot(me.x - aimX, me.y - aimY) > step * SLIDE.contact) {
      const movedX = me.x - beforeX, movedY = me.y - beforeY, moved = Math.hypot(movedX, movedY);
      const forward = (movedX * mx + movedY * my) / (len * step);
      if (forward > SLIDE.headOn && slidePathFree(movedX / moved, movedY / moved)) {
        startSlide(movedX / moved, movedY / moved, now);
      } else {
        knockDown({ mx: aimX, my: aimY }, now);
      }
      me.running = false;
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
    walkClock += dt * (me.running ? RUN.animation : crouching ? CROUCH_SPEED : 1);
    const stepNumber = Math.floor(walkClock / STEP_EVERY_MS);
    if (stepNumber !== me.lastStep && me.jumpedAt === null) stepOn(now, 5, me.running ? STEP_LOUDNESS.run : crouching ? STEP_LOUDNESS.crouch : STEP_LOUDNESS.walk);
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
  updateReactions(now);
  if (!paused) updateCart(now);
  updateHint();
  if (!paused && me.jumpedAt === null && !me.running && me.knockedAt === null && me.slideAt === null && me.restAt === null) touchThings(now);
}

// Jumping and crouching; walking and standing are chosen where the character is drawn.
function playerFrame(now) {
  if (action) {
    const { row, ms } = ACTIONS[action.name];
    return [action.row ?? row, Math.min(5, Math.floor(((now - action.start) / ms) * 6))];
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
  const w = FRAME_W * SHEET_DETAIL, h = FRAME_H * SHEET_DETAIL;
  preview.clearRect(0, 0, w, h);
  if (sheet.complete) {
    const column = Math.floor(now / 210) % 8;
    preview.drawImage(sheet, sheetX(column, IDLE_ROW.down), sheetY(IDLE_ROW.down), w, h, 0, 0, w, h);
    paintTalkingMouth(preview, IDLE_ROW.down, column, 0, 0, false, SHEET_DETAIL, now);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(now - last, 50));
  last = now;
  if (action && now - action.start > ACTIONS[action.name].ms) action = null;
  if (!crouching) crouchClock = 0;
  moveCharacter(dt, now);
  if (theme?.camp) updateCamp(paused ? 0 : dt, now);
  if (theme?.lesson) updateLesson(dt, now);
  if (!paused) {
    updateAnimals(dt, now);
    updateShoppers(dt);
    updateLoudspeaker(dt);
  }
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
  if (performance.now() < (me.heldUntil ?? 0) || paused || crouching || me.sittingOn || me.jumpedAt !== null || me.knockedAt !== null) return;
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
  if (theme?.lesson && lesson?.typing) {
    if (event.target.tagName === "INPUT") { // it takes the letters itself
      if (event.key === "Enter") lessonTypeKey("OK");
      if (event.key === "Escape") lessonCloseKeypad();
      return;
    }
    if (theme.inWords ? /^\p{L}$/u.test(event.key) : /^[0-9]$/.test(event.key)) return lessonTypeKey(event.key.toLowerCase());
    if (event.key === "Backspace") return lessonTypeKey("⌫");
    if (event.key === "Enter") return lessonTypeKey("OK");
    if (event.key === "Escape") return lessonCloseKeypad();
    return;
  }
  if (cart.stage === "price" && theme?.counts) {
    if (/^[0-9]$/.test(event.key)) return typeKey(event.key);
    if (event.key === "Backspace") return typeKey("⌫");
    if (event.key === "Enter") return confirmPrice();
  }
  if (event.target.tagName === "BUTTON" && event.key === " ") return;
  if (event.key === " ") {
    event.preventDefault();
    if (!event.repeat) jump();
    return;
  }
  if (event.key.toLowerCase() === "r") {
    if (!event.repeat) hearAgain();
    return;
  }
  if (event.key.toLowerCase() === "e") {
    // In a lesson, the hand going up opens a text field at once, and the E itself mustn't be written into it.
    if (theme?.lesson) event.preventDefault();
    useKey(event.repeat);
    return;
  }
  if (event.key.toLowerCase() === "c") {
    sitOrCrouch(event.repeat);
    return;
  }
  if (theme?.camp && event.key.toLowerCase() === "q") {
    if (!event.repeat) campPutDown();
    return;
  }
  if (theme?.camp && event.key.toLowerCase() === "b") {
    if (!event.repeat) campOpenPack();
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
  if (theme?.lesson) return;
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
// The little sign over the character does what it says when it's clicked, the same as E.
document.getElementById("hint").addEventListener("pointerdown", (event) => {
  if (event.currentTarget.querySelector("kbd")) document.getElementById("use").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
});
document.getElementById("use").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  useKey(false);
});
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

document.getElementById("camp-pack").addEventListener("click", () => campOpenPack());
document.getElementById("camp-drop").addEventListener("click", () => campPutDown());
document.getElementById("change-outfit").addEventListener("click", showChooser);
document.getElementById("help-toggle").addEventListener("click", (event) => {
  setHelp(!helpRound);
  event.currentTarget.blur(); // or space, the jump key, would press it again
});
showHelpSwitches();
document.getElementById("change-place").addEventListener("click", () => {
  if (cardEl.className !== "chooser" && cardEl.className !== "greeting") showPlaces();
});

placeCamera();
showPrompt();
if (chosen) greet();
else showChooser();
requestAnimationFrame(frame);
