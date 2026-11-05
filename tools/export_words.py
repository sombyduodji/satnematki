#!/usr/bin/env python3
"""Export the game's word lists from Sátni FST's satni.db, opened read-only.

Writes, deterministically (same database gives the same bytes):
  data/words.json              all words that pass the filters, for later levels
  data/starter-words.js        the reviewed words the game shows
  data/review/filtered.tsv     everything the filters removed, for human review

Usage: taskset -c 0-15 python3 tools/export_words.py [--db PATH]
"""
import argparse
import csv
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = Path.home() / "Git/satni-fst/satni.db"
MIN_FREQ = 100
MAX_TRANSLATIONS = 3

FORMS = {
    "N": ["Sg+Nom", "Sg+Acc", "Sg+Gen", "Sg+Ill", "Sg+Loc", "Sg+Com", "Pl+Nom", "Pl+Acc", "Ess"],
    "V": ["Inf", "Ind+Prs+Sg1", "Ind+Prs+Sg3", "Ind+Prt+Sg3", "Ind+Prs+ConNeg"],
    "A": ["Attr", "Sg+Nom", "Pl+Nom", "Sg+Gen", "Comp+Sg+Nom"],
}

# A match anywhere in a word's translations removes the whole word. The game is
# for children, so this is stricter than the app's dictionary needs to be.
BLOCK = {
    "vulgar": (
        r"\b(vittu\w*|paska\w*|perse|pylly|takapuoli|kusi|kuse\w*|huora\w*|huoruus|haureus|portto|lutka)\b",
        r"\b(hore|fitte|faen|drit\w*|skit|rumpe)\b",
    ),
    "sexual": (
        r"\b(pillu|kyrpä|nussi\w*|naida|seksu\w*|sukupuoli\w+|raisk\w*|prostitu\w*|penis|vagina|kives\w*|rinta)\b",
        r"\b(kuk|pikk|knull\w*|voldt\w*|seksu\w*|bryst|kvinnebryst|overgrep)\b",
    ),
    "offensive": (
        r"\b(neekeri\w*|ryssä\w*|hullu\w*|idiootti\w*|seota)\b",
        r"\b(neger\w*)\b",
    ),
    "violence": (
        r"\b(tappa\w*|tapetu\w*|\w*murha\w*|surma\w*|(maailman)?sota\w*|sotia|pahoinpi\w*|ase|pyssy|kivääri\w*)\b",
        r"\b(drep\w*|drap\w*|mord|selvmord|myrde\w*|\w*krig\w*|våpen|gevær|mishandl\w*)\b",
    ),
    "death": (
        r"\b(kuolema|kuoleva|ruumis\w*)\b",
        r"\b(dødsfall|lik|likkiste)\b",
    ),
    "substances": (
        r"\b(viina\w*|alkoholi\w*|huume\w*|tupakka\w*|juoppo\w*|juopumus|humala)\b",
        r"\b(brennevin|alkohol\w*|narkotika\w*|tobakk\w*|drukkenskap)\b",
    ),
}
BLOCK = {k: tuple(re.compile(p, re.I) for p in v) for k, v in BLOCK.items()}

# Dated, offensive or stray translations: only that translation goes. The word stays if
# another one is left (sápmelaš N keeps saamelainen), and goes if none is.
DROP_FI = re.compile(r"\b(lappalai\w*|mustalai\w*|akka|ämmä)\b", re.I)
# Also rare senses of otherwise fine words: goddi = villrein, not "morder"; čibbi = kne.
DROP_NB = re.compile(r"\b(lapp\w*|sigøyner\w*|tater\w*|morder|avliver|penis)\b", re.I)

# A translation shown in place of a dated one the dictionary has as its only choice, by hand. Must be checked by the user.
SHOWN_INSTEAD = {("gákti", "N"): {"saamenpuku": "lapinpuku"}}

# Words the translation patterns can't catch.
BLOCK_LEMMAS = {
    "dagadit": "sexual",
}


def split_translations(text):
    """Split on commas outside parentheses."""
    parts, depth, cur = [], 0, ""
    for ch in text or "":
        depth += (ch == "(") - (ch == ")")
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def blocked_by(fi_text, nb_text):
    for category, (fi_re, nb_re) in BLOCK.items():
        match = fi_re.search(fi_text) or nb_re.search(nb_text)
        if match:
            return category, match.group(0)
    return None


def load_starter():
    with open(ROOT / "tools/starter_words.tsv", encoding="utf-8") as f:
        rows = [line.rstrip("\n").split("\t") for line in f if not line.startswith("#") and line.strip()]
    return [dict(zip(("lemma", "pos", "fi", "nb", "sprite", "place", "theme"), r)) for r in rows]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = ap.parse_args()

    # immutable=1 too: nothing here may touch the database or leave -wal/-shm files.
    db = sqlite3.connect(f"file:{args.db}?mode=ro&immutable=1", uri=True)
    db.row_factory = sqlite3.Row
    vulgar_ids = {
        r[0] for r in db.execute("SELECT DISTINCT word_id FROM meanings WHERE labels LIKE '%vulg%'")
    }
    rows = db.execute(
        """SELECT * FROM dictionary
           WHERE pos IN ('N','V','A') AND COALESCE(subtype,'') <> 'Prop'
             AND COALESCE(finnish_translation,'') <> ''
           ORDER BY COALESCE(freq, 0) DESC, sme_lemma, pos, id""",
    ).fetchall()
    # A word picked by hand may be rarer than the limit; it still has to pass every filter.
    picked = {(s["lemma"], s["pos"]) for s in load_starter()}
    rows = [r for r in rows if (r["sme_lemma"], r["pos"]) in picked or ((r["freq"] or 0) >= MIN_FREQ and r["nob_translation"])]

    words, removed = [], []
    for row in rows:
        fi_text, nb_text = row["finnish_translation"], row["nob_translation"]
        base = [row["sme_lemma"], row["pos"], row["freq"]]
        hit = blocked_by(fi_text, nb_text)
        if row["id"] in vulgar_ids:
            hit = ("vulgar", "label: vulg.")
        elif row["sme_lemma"] in BLOCK_LEMMAS:
            hit = (BLOCK_LEMMAS[row["sme_lemma"]], "lemma list")
        if hit:
            removed.append(base + ["word removed", hit[0], hit[1], fi_text, nb_text])
            continue

        fi_all = split_translations(fi_text)
        nb_all = split_translations(nb_text)
        fi = [t for t in fi_all if not DROP_FI.search(t)]
        nb = [t for t in nb_all if not DROP_NB.search(t)]
        dropped = [t for t in fi_all + nb_all if t not in fi + nb]
        if not fi or (not nb and nb_all):
            removed.append(base + ["word removed", "unsuitable translation", "; ".join(dropped), fi_text, nb_text])
            continue
        if dropped:
            removed.append(base + ["translation dropped", "unsuitable translation", "; ".join(dropped), fi_text, nb_text])

        forms = {}
        tags = FORMS[row["pos"]]
        for tag, surface, grade in db.execute(
            f"SELECT tag, surface, grade FROM paradigms WHERE word_id = ? AND tag IN ({','.join('?' * len(tags))}) ORDER BY rowid",
            (row["id"], *tags),
        ):
            forms.setdefault(tag, [surface, grade or ""])  # first variant only

        word = {
            "lemma": row["sme_lemma"],
            "pos": row["pos"],
            "fi": fi[:MAX_TRANSLATIONS],
            "nb": nb[:MAX_TRANSLATIONS],
            "freq": row["freq"],
            "forms": {t: forms[t] for t in tags if t in forms},
        }
        if row["subtype"]:
            word["subtype"] = row["subtype"]
        if row["gradation"]:
            word["gradation"] = {
                "pair": row["gradation"],
                "gd": row["gd_cluster"],
                "hd": row["hd_cluster"],
                "group": row["gradation_group"],
                "row": row["gradation_row"],
            }
        words.append(word)
        word["_all_fi"], word["_all_nb"] = fi, nb  # for the starter check, not exported

    index = {(w["lemma"], w["pos"]): w for w in words}
    starter, problems = [], []
    for s in load_starter():
        key = (s["lemma"], s["pos"])
        word = index.get(key)
        if not word:
            problems.append(f"{key}: filtered out or not in the database")
            continue
        if SHOWN_INSTEAD.get(key, {}).get(s["fi"], s["fi"]) not in word["_all_fi"]:
            problems.append(f"{key}: fi {s['fi']!r} not in {word['_all_fi']}")
        if s["nb"] and s["nb"] not in word["_all_nb"]:
            problems.append(f"{key}: nb {s['nb']!r} not in {word['_all_nb']}")
        # An abbreviation has no plural in the dictionary, and the card simply leaves it out.
        if s["pos"] == "N" and "Pl+Nom" not in word["forms"] and not s["lemma"].isupper():
            problems.append(f"{key}: no Pl+Nom form, the word card shows it")
        starter.append({
            "lemma": s["lemma"], "pos": s["pos"], "fi": s["fi"], "nb": s["nb"],
            "sprite": s["sprite"], "place": s["place"], "theme": s["theme"],
            "gradation": word.get("gradation"), "forms": word["forms"],
        })
    if problems:
        sys.exit("Starter word problems:\n  " + "\n  ".join(problems))

    for w in words:
        del w["_all_fi"], w["_all_nb"]

    digest = hashlib.sha256()
    with open(args.db, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    meta = {
        "source": "Sátni FST satni.db; see CREDITS.md",
        "db_sha256": digest.hexdigest(),
        "filter": f"pos N/V/A, not Prop, freq >= {MIN_FREQ}, Finnish and Norwegian present, content filters",
        "count": len(words),
    }

    dumps = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    with open(ROOT / "data/words.json", "w", encoding="utf-8") as f:
        f.write('{"meta":' + dumps(meta) + ',\n"words":[\n')
        f.write(",\n".join(dumps(w) for w in words))
        f.write("\n]}\n")
    with open(ROOT / "data/starter-words.js", "w", encoding="utf-8") as f:
        f.write("// Generated by tools/export_words.py. Do not edit; see tools/starter_words.tsv.\n")
        f.write("window.MAHTTE_WORDS = [\n")
        f.write(",\n".join(dumps(w) for w in starter))
        f.write("\n];\n")
    (ROOT / "data/review").mkdir(exist_ok=True)
    with open(ROOT / "data/review/filtered.tsv", "w", encoding="utf-8", newline="") as f:
        out = csv.writer(f, delimiter="\t", lineterminator="\n")
        out.writerow(["lemma", "pos", "freq", "action", "category", "matched", "fi", "nb"])
        out.writerows(removed)

    gone = sum(1 for r in removed if r[3] == "word removed")
    print(f"candidates {len(rows)}, kept {len(words)}, removed {gone}, "
          f"translations dropped on {len(removed) - gone} words, starter {len(starter)}")


if __name__ == "__main__":
    main()
