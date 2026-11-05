# Credits and licences

Sátnemátki's words come from the Sámi language technology community, above all
[GiellaLT](https://giellalt.github.io/), [Divvun](https://divvun.no/) and
[Giellatekno](https://giellatekno.uit.no/) at UiT The Arctic University of Norway. They reach this
game through the database of [Sátni FST](https://github.com/sombyduodji/satni-fst), the same author's dictionary app.

## Dictionaries: GiellaLT, CC BY 4.0

| Dictionary | Used for | Source |
|---|---|---|
| North Sámi → Finnish | Finnish translations | [giellalt/dict-sme-fin](https://github.com/giellalt/dict-sme-fin) |
| North Sámi → Norwegian | Norwegian translations | [giellalt/dict-sme-nob](https://github.com/giellalt/dict-sme-nob) |

© GiellaLT / Divvun / Giellatekno and their contributors, licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

### Changes made to the dictionary data

CC BY 4.0 requires saying what was changed. Sátni FST merges the dictionaries, adds generated
inflection and gradation and applies hand-made corrections; its `CREDITS.md` describes this. From that
database, [`tools/export_words.py`](tools/export_words.py):

- keeps nouns, verbs and adjectives that are not proper nouns, with frequency 100 or more and both a
  Finnish and a Norwegian translation, or picked by hand even if rarer or with no Norwegian;
- removes vulgar, sexual, violent and other words unsuited to children, and dated or offensive
  translations such as *lappalainen* (the export also lists everything removed, for review);
- keeps at most three translations per language and a few chosen inflected forms;
- for the words the game shows, uses one translation picked by hand
  ([`tools/starter_words.tsv`](tools/starter_words.tsv)).

## Morphology: GiellaLT lang-sme, GPL-3.0

The inflected forms and gradation data were generated with the North Sámi analyser and generator from
[giellalt/lang-sme](https://github.com/giellalt/lang-sme), licensed under the
[GNU General Public License v3.0](LICENSE). Authors: Linda Wiechetek, Katri Hiovain-Asikainen,
Inga Lill Sigga Mikkelsen, Sjur N. Moshagen, Flammie A Pirinen, Trond Trosterud, Børre Gaup and the
lang-sme contributors. Divvun confirmed on 2026-11-03, about Sátni FST, that tables generated from
lang-sme are fine to ship.

## Consonant gradation table: Oahpa

The gradation groups and series in the word list follow the
[consonant gradation table of Oahpa](https://oahpa.no/sme/gramm/tabell_stadieveksling.html)
(Giellatekno, UiT).

## Pronunciation

The characters speak with the speech synthesis of Divvun and Giellatekno (UiT The Arctic University of
Norway), voices **Máhtte and Biret**, from `api-giellalt.uit.no`. The question, the greeting, the right and wrong
answers, the names of things and the numbers are generated once and included in [`audio/`](audio/) by
[`tools/fetch_voices.py`](tools/fetch_voices.py). The game itself makes no requests.

Divvun's permission to keep generated samples covers Sátni FST. It has not yet been confirmed for this game,
which is for now a technology demo.

## Background sounds

The background sounds of these places are cut from recordings on [Freesound](https://freesound.org/), all marked
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) by their authors. CC0 needs no credit, but they earned it.
Shortened by [`tools/make_ambience.py`](tools/make_ambience.py), from Freesound's preview files.

| Place | Recording | Author |
|---|---|---|
| Forest | [forest with stream](https://freesound.org/people/bruno.auzet/sounds/632006/) | bruno.auzet |
| Car park | [Carpark ambience](https://freesound.org/people/richwise/sounds/407585/) | richwise |
| Home | [empty home kitchen room tone](https://freesound.org/people/pryanic/sounds/780515/) | pryanic |
| Library | [Quiet library ambience](https://freesound.org/people/xkeril/sounds/620683/) | xkeril |
| Classroom | [classroom_ambiance](https://freesound.org/people/joedeshon/sounds/258094/) | joedeshon |
| Store | [Grocery store ambience](https://freesound.org/people/thaighaudio/sounds/350488/) | thaighaudio |
| General store | [Home Depot ambience](https://freesound.org/people/kyles/sounds/452506/) | kyles |

If a recording can't load, the game makes its own sounds instead.

## Gákti reference

The characters' clothing is based on the article
[Karasjok-kofta](https://snl.no/Karasjok-kofta) in Store norske leksikon. Only facts from it are used; no
text or images are copied. See [art/mahtte/README.md](art/mahtte/README.md).

## Handwriting font

The shopping list is written in [Caveat](https://github.com/googlefonts/caveat) by The Caveat Project Authors (`art/fonts/`),
under the [SIL Open Font License 1.1](art/fonts/OFL.txt). It has all of Northern Sámi's letters.

## Game

© 2026 Juha Somby, satni@somby.fi. The code and pixel art are licensed under the
[GNU General Public License v3.0](LICENSE). The game uses no third-party code.
