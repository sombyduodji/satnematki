#!/usr/bin/env python3
"""Fetch the spoken lines that ship with the game (audio/). The game itself uses no network.

One request at a time with a long pause, as this is Divvun's and Giellatekno's service; see CREDITS.md.
It backs off when the service has trouble and stops if the trouble goes on. Lines that already exist are skipped, so
running it again carries on where it stopped; delete a file to fetch it again. Texts must match src/game.js.

Usage: python3 tools/fetch_voices.py [--list] [--limit N] [--pause SECONDS]
"""
import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "audio"
TTS_URL = "https://api-giellalt.uit.no/tts/se/{voice}"
CHARACTERS = {"mahtte": "Máhtte", "biret": "Biret"}
LINES = {
    "question": "Mii du namma lea? Mu namma lea {name}.",
    "bures": "Bures!",
    "store-basket": "Váldde márssu.",
    "store-till": "Mana kássii.",
    "store-wait": "Vuordde vuoru.",
    "store-belt": "Bija dan beavdái.",
    "store-bag": "Váldde seahka.",
    "store-door": "Mana uksii.",
    "store-pay": "Mávsse.",
    "store-no": "Ii.",
    "store-notonlist": "Dat ii leat mu listtus.",
    "store-notonlist-plural": "Dat eai leat mu listtus.",
    "store-full": "Vuordde.",
    # The lávvu camp. Drafts, machine made like the game's other sentences: for the user to check. Must match CHORES in src/camp.js.
    "is-it-so": "Leago nu?",  # after a number's own line: "Dát lea vihtta. Leago nu?"
    "camp-axe": "Váldde ákšu.",
    "camp-fell": "Čuohpa muora.",
    "camp-saw": "Váldde sahá.",
    "camp-cut": "Sahá muora.",
    "camp-branches": "Čohkke ovssiid.",
    "camp-light": "Cahkket dola.",
    "camp-roast": "Base márffi.",
    "camp-water": "Viečča čázi.",
    "camp-boil": "Vuošša čázi.",
    "camp-sleep": "Mana nohkkat.",
    "camp-nottired": "In leat vel váiban. Mus leat vel barggut.",
    "camp-goodnight": "Buorre idja!",
    "camp-play": "Háliidatgo stoahkat?",
    "camp-gooddog": "Buorre beana!",
    "camp-fetch": "Viečča!",
}
# What the cashier says at the till: whole euros, up to MAX_TOTAL in src/game.js.
PRICES = range(3, 100)
PRICE = "Dat máksá {number} euro."
# Answers, in the same order as TEXT.right and TEXT.wrong in src/game.js. Found: praise, then the word.
PRAISE = [
    "Riekta!", "Nu lea!", "Buorre!", "Hui buorre!", "Čeahppi!", "Gávdnet dan!", "Dat lei riekta!",
    "Hui bures!", "Hui čeahppi!", "Nu fal!", "Don máhtát dan!", "Juo, nu lea!", "Dat lea riekta!",
]
WRONG = [
    "Ii lean, geahččaleadnu ođđasit!",
    "Ii dat lean.",
    "Geahččaleadnu ođđasit!",
    "Ii vel!",
    "Ii lean dat. Geahččaleadnu vel!",
    "Ii lean riekta.",
    "Geahččal vel!",
    "Geahččal ođđasit!",
    "Oza vel!",
    "Ale vuollán!",
    "Dat lei juoga eará.",
]
THIS_IS = "Dát lea {word}."
THIS_ARE = "Dát leat {word}."  # a word that is only plural, with buvssat
THIS_PERSON = "Son lea {word}."
# Asking for what to find. The object form is the accusative; family are "my mother", with iežan.
ASK = "Veahket mu gávdnat {what}!"
ASK_RELATIVE = "Veahket mu gávdnat {noun} mii lea {colour}!"
# The numbers whose object form differs from the base form, from Sátni FST's generator. The rest stay the same.
NUMBER_OBJECT = {"okta": "ovtta", "čuohti": "čuođi"}
FAMILY = ("eadni", "áhčči", "oabbá", "viellja")  # the same as in src/game.js
THIS_ONE_IS = "Dát {noun} lea {colour}."


def load_words():
    text = (OUT.parent / "data/starter-words.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("["):text.rindex("]") + 1])


# Foods bought as a mass stay singular in a shopping list's object form (mielkki, vuoja); the rest are plural (moniid, tomáhtaid).
# Must match UNCOUNTED_FOODS in src/game.js.
UNCOUNTED_FOODS = {"bread", "milk", "cheese", "butter", "guolli", "icecream", "coffee", "juice", "chocolate", "cake", "soda", "jam"}


# Words that are only plural. Must match PLURAL_ONLY in src/game.js.
PLURAL_ONLY = {"trousers"}


def accusative(word):
    forms = word["forms"].get("Pl+Acc" if word["sprite"] in PLURAL_ONLY else "Sg+Acc")
    return forms[0] if forms else word["lemma"]


# The classroom's teacher speaks with a voice of her own, one that no player character has.
TEACHER = "sunna"
TEACHER_LINES = {
    "teacher-hello": "Bures, mánát!",
    "teacher-it-is": "Dát lea",  # before a number on its own, as in "Buorre! Dát lea vihtta."
    "teacher-wrong": "Ii dat lean.",
    "teacher-end": "Giitu, mánát!",
    "teacher-which-digit": "Mii nummir dát lea?",  # for writing numbers: 0 to 9, Finnish numero
    "teacher-which-number": "Mii lohku dát lea?",  # and from 10 up, Finnish luku
}


# Everyone the teacher can praise by name: the two characters and the classmates' names in src/lesson.js.
TEACHER_PRAISES_NAMES = ["Máhtte", "Biret",
    "Máret", "Elle", "Ánne", "Inga", "Márjá", "Sárá", "Rávdná", "Risten", "Áile", "Gáddjá",
    "Niillas", "Issát", "Heaika", "Ánte", "Jovnna", "Áilu", "Mihkkal", "Ásllat", "Nillá", "Juhán"]


def name_file(name):
    """The name in a file name, as lessonNameFile in src/lesson.js makes it: no accents, lower case."""
    return "".join(c for c in unicodedata.normalize("NFD", name) if not unicodedata.combining(c)).lower()


def teacher_lines():
    """The teacher's lines, as (file name, text): what she says, and every number on its own."""
    numbers = json.loads(re.search(r"=\s*(\[.*\])", (OUT.parent / "data/numbers.js").read_text(encoding="utf-8"), re.S).group(1))
    return [*TEACHER_LINES.items(), *((f"teacher-good-{name_file(name)}", f"Buorre, {name}!") for name in TEACHER_PRAISES_NAMES), *((f"teacher-praise-{i}", text) for i, text in enumerate(line for line in PRAISE if line != "Gávdnet dan!")), *((f"teacher-number-{n}", f"{word[0].upper()}{word[1:]}.") for n, word in enumerate(numbers))]


def wanted_lines():
    """Every line of the game, as (file name without the voice, text with {name} for the character)."""
    lines = [(line, text) for line, text in LINES.items()]
    lines += [(f"praise-{i}", text) for i, text in enumerate(PRAISE)]
    lines += [(f"wrong-{i}", text) for i, text in enumerate(WRONG)]
    words = load_words()
    colours = [w for w in words if w["theme"] == "colour"]
    for word in words:
        if word["theme"] in ("river", "animal", "food", "vehicle", "lot", "home", "gear"):
            said = THIS_PERSON if word["sprite"] in FAMILY else THIS_ARE if word["sprite"] in PLURAL_ONLY else THIS_IS
            lines.append((f"word-{word['sprite']}", said.format(word=word["lemma"])))
            if word["theme"] != "river":  # no level asks for these any more
                what = accusative(word)
                lines.append((f"ask-{word['sprite']}", ASK.format(what=f"iežan {what}" if word["sprite"] in FAMILY else what)))
        if word["theme"] == "camp":  # named when met, and never asked for
            lines.append((f"word-{word['sprite']}", THIS_IS.format(word=word["lemma"])))
        if word["theme"] in ("item", "vehicle"):
            for colour in colours:
                # Harder level: "Dát lea rukses biila." Easy level: "Dát biila lea ruoksat."
                attributive = f"{colour['forms']['Attr'][0]} {word['lemma']}"
                lines.append((f"hard-{word['sprite']}-{colour['sprite']}", THIS_IS.format(word=attributive)))
                base = colour["forms"]["Sg+Nom"][0]
                lines.append((f"easy-{word['sprite']}-{colour['sprite']}", THIS_ONE_IS.format(noun=word["lemma"], colour=base)))
                lines.append((f"ask-hard-{word['sprite']}-{colour['sprite']}", ASK.format(what=f"{colour['forms']['Attr'][0]} {accusative(word)}")))
                lines.append((f"ask-easy-{word['sprite']}-{colour['sprite']}", ASK_RELATIVE.format(noun=accusative(word), colour=base)))
    numbers = (OUT.parent / "data/numbers.js").read_text(encoding="utf-8")
    numbers = json.loads(numbers[numbers.index("["):numbers.rindex("]") + 1])
    lines += [(f"number-{n}", THIS_IS.format(word=word)) for n, word in enumerate(numbers)]
    lines += [(f"ask-number-{n}", ASK.format(what=NUMBER_OBJECT.get(word, word))) for n, word in enumerate(numbers)]
    lines += [(f"store-price-{n}", PRICE.format(number=numbers[n])) for n in PRICES]
    lines += [(f"count-{n}", f"{numbers[n].capitalize()}.") for n in range(1, 6)]
    # Picking several of a food is counted out, which needs no number with the noun: "Okta. Guokte. Ja golbma. Doarvái mielkki."
    lines += [(f"count-and-{n}", f"Ja {numbers[n]}.") for n in range(2, 6)]
    lines += [(f"enough-{word['sprite']}", f"Doarvái {accusative(word) if word['sprite'] in UNCOUNTED_FOODS else word['forms']['Pl+Acc'][0]}.") for word in words if (word["theme"] == "food" and word["place"] != "meat" and word["sprite"] != "egg") or (word["theme"] == "gear" and word["place"] != "platform" and word["sprite"] != "gakti")]
    return list(dict(lines).items())


def fetch(path, voice, text):
    request = urllib.request.Request(
        TTS_URL.format(voice=voice),
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        audio = response.read()
    if not audio.startswith(b"RIFF") or len(audio) < 5000:
        raise RuntimeError(f"not audio: {len(audio)} bytes")
    partial = path.with_suffix(".part")
    partial.write_bytes(audio)
    partial.replace(path)  # a stopped run never leaves half a line behind
    return len(audio)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="show what is missing and fetch nothing")
    parser.add_argument("--limit", type=int, help="fetch at most this many")
    parser.add_argument("--pause", type=float, default=15, help="seconds between requests")
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    jobs = []
    # Line by line in every voice, so that all the voices advance together.
    for line, text in wanted_lines():
        for voice, name in CHARACTERS.items():
            path = OUT / f"{line}-{voice}.wav"
            if not path.exists():
                jobs.append((path, voice, text.replace("{name}", name)))
    for line, text in teacher_lines():
        path = OUT / f"{line}.wav"
        if not path.exists():
            jobs.append((path, TEACHER, text))
    # Whole places first: home, then other plain names, before the many colour phrases and numbers.
    home = {word["sprite"] for word in load_words() if word["theme"] == "home"}
    def order(job):
        name = job[0].name
        if re.match(r"ask-(easy|hard|number)-", name):
            return 2
        return 0 if name.startswith("ask-") and name[4:].rsplit("-", 1)[0] in home else 1
    jobs.sort(key=order)
    print(f"{len(jobs)} lines missing", flush=True)
    if args.list:
        for path, voice, text in jobs:
            print(f"{path.name}\t{text}")
        return
    wait, done = 0, 0
    for path, voice, text in jobs[:args.limit]:
        troubles = 0
        while True:
            started = time.time()
            try:
                size = fetch(path, voice, text)
                break
            except (urllib.error.URLError, TimeoutError, RuntimeError, OSError) as error:
                troubles += 1
                wait = 60 * 2 ** (troubles - 1)
                print(f"{path.name}: {error}; waiting {wait} s", flush=True)
                if troubles >= 5:
                    sys.exit(f"Stopped: the service keeps having trouble. {done} fetched this run; run again later.")
                time.sleep(wait)
        done += 1
        print(f"{done}/{len(jobs)} {path.name} {size} bytes in {time.time() - started:.1f} s: {text}", flush=True)
        time.sleep(args.pause)


if __name__ == "__main__":
    main()
