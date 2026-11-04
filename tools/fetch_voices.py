#!/usr/bin/env python3
"""Fetch the spoken lines that ship with the game (audio/). The game itself uses no network.

One request at a time with a long pause, as this is Divvun's and Giellatekno's service; see CREDITS.md.
It backs off when the service has trouble and stops if the trouble goes on. Lines that already exist are skipped, so
running it again carries on where it stopped; delete a file to fetch it again. Texts must match src/game.js.

Usage: python3 tools/fetch_voices.py [--list] [--limit N] [--pause SECONDS]
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "audio"
TTS_URL = "https://api-giellalt.uit.no/tts/se/{voice}"
CHARACTERS = {"mahtte": "Máhtte", "biret": "Biret"}
LINES = {
    "question": "Mii du namma lea? Mu namma lea {name}.",
    "bures": "Bures!",
}
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
THIS_PERSON = "Son lea {word}."
FAMILY = ("eadni", "áhčči", "oabbá", "viellja")  # the same as in src/game.js
THIS_ONE_IS = "Dát {noun} lea {colour}."


def load_words():
    text = (OUT.parent / "data/starter-words.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("["):text.rindex("]") + 1])


def wanted_lines():
    """Every line of the game, as (file name without the voice, text with {name} for the character)."""
    lines = [(line, text) for line, text in LINES.items()]
    lines += [(f"praise-{i}", text) for i, text in enumerate(PRAISE)]
    lines += [(f"wrong-{i}", text) for i, text in enumerate(WRONG)]
    words = load_words()
    colours = [w for w in words if w["theme"] == "colour"]
    for word in words:
        if word["theme"] in ("river", "animal", "food", "vehicle", "lot", "home"):
            said = THIS_PERSON if word["sprite"] in FAMILY else THIS_IS
            lines.append((f"word-{word['sprite']}", said.format(word=word["lemma"])))
        if word["theme"] in ("item", "vehicle"):
            for colour in colours:
                # Harder level: "Dát lea rukses biila." Easy level: "Dát biila lea ruoksat."
                attributive = f"{colour['forms']['Attr'][0]} {word['lemma']}"
                lines.append((f"hard-{word['sprite']}-{colour['sprite']}", THIS_IS.format(word=attributive)))
                base = colour["forms"]["Sg+Nom"][0]
                lines.append((f"easy-{word['sprite']}-{colour['sprite']}", THIS_ONE_IS.format(noun=word["lemma"], colour=base)))
    numbers = (OUT.parent / "data/numbers.js").read_text(encoding="utf-8")
    numbers = json.loads(numbers[numbers.index("["):numbers.rindex("]") + 1])
    lines += [(f"number-{n}", THIS_IS.format(word=word)) for n, word in enumerate(numbers)]
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
    for voice, name in CHARACTERS.items():
        for line, text in wanted_lines():
            path = OUT / f"{line}-{voice}.wav"
            if not path.exists():
                jobs.append((path, voice, text.replace("{name}", name)))
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
