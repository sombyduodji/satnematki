# Sátnemátki

*Sátnemátki* means "word journey" in Northern Sámi. Version 0.2.6, a technology demo.

A Northern Sámi word game for children. The player creates a character, Máhtte or Biret, chooses a place, and
walks around it in an isometric view with a camera that follows: furniture and family at home, animals in the forest, coloured books on the shelves and
writing things on the tables in the library, coloured vehicles in the car park, a shopping list to buy in the store and in a general store, and numbers on
the desks of a classroom. The game names a Sámi word, and the player finds the thing it means. Touching anything shows its word and its
Finnish translation, so no prior knowledge is needed, and there is no way to lose.

## Play

Open `index.html` for the start page or `peli.html` for the game. They need no server, build step or network.

Move with the arrow keys or WASD, by tapping the world, or with the on-screen pad on touch screens. Keys follow
the screen: W goes straight up, and two keys together, such as W+A, go along the paths and across the bridges.
Only trunks, things and water block the way; the character slides past them and walks behind the branches.
Space jumps, about half the character's height: over things in the way, but not over the house or the river. Jumping into a tree,
a shelf, a vehicle or a wall knocks the character down, harmlessly. C crouches, or sits at a chair in the classroom. Shift runs, on every map: a runner can't pick
anything up, and running into something ends on the bottom if it's head-on, or in a slide on the tummy past it if there's room. Each map opens with a window of instructions, closed with OK.
The animals, store and library things are small 3D models in `src/models.js`. They wander slowly and hop, some birds take short flights, the bigger ones now and then cross the river, the owl's head turns towards the player, birds peck the ground, the dog turns to the player and wags its tail, and they hold still once the player is close or heading for them.

Every place is drawn at double detail, on a finer canvas: food, fittings, people and animals are modelled finer, and floors, trees, shelves and the player are enlarged with Scale2x. Two cashiers in the store's uniform sit at two checkouts, and a barrier across the store means the way out is through one of them: the way in is by a gate near the door. A butcher behind the meat counter cuts a big piece of meat, with plates of four kinds of meat on the counter. A worker fills the shelves from a small trolley, which can't be walked through and never closes an aisle, and carries used baskets back to the door. In the store, five to seven customers of different ages and looks pick things off the shelves into baskets (nothing leaves the shelf), queue at the till, pay the cashier, leave the empty basket at the end of the counter and go with a bag in the Sámi flag's colours, one of six kinds. The player needs a basket too, from the stack just inside the gate, and what they find goes into it. A fall drops the basket and spills the shopping: the character takes the basket back on getting up, and the blinking shopping is gathered by walking over it, without a word. With everything found, the player goes to the till, puts the shopping on the belt one thing at a time, pays, takes the bag and walks to the door, where the clock stops. Things cost whole euros, after real prices. On the harder level the list asks for up to five of each, C takes one at a time, and the price the cashier says must be typed into a calculator.

A wrong pick holds the character still for three seconds while it's explained. E is the key for using things on every map (Q is kept for putting things away later): walking against something does nothing by itself, though what is tapped on is taken on arriving. Help bubbles show when E can be used, and in the store arrows point the way. They're on by default, with a switch in the menu and under the game. What E does just now also shows as text above the game, except when playing by sound only. They are only company: the player walks through them and can't touch them.

A clock starts at the first move of a round and stops at the last word; in the store it runs from taking the basket until the door. Play then stops, and a window shows the
time, the ten best times for that place (kept in the browser, with the name the player gave), and the choice to
play again or go to the main menu. The main menu fills the page: pick a place, then what to do there if it has several things, such as Opettele numerot in the classroom, then its level if it has several, or replay the last one. It also changes the player, which asks for the character and name again.

Luokka has three things to do. Opettele numerot is the one above. In Kirjoita numerot, with levels for 0–9, 0–20 and 0–100, the character sits at one of six desks in a small sunny classroom and can't get up, among five classmates with names of their own. The teacher, in a shirt of one of three colours chosen at random, picks up one of the pens from the tray, in the colours of the Sámi flag, and writes a number in Sámi on the white board and asks what it is, in a voice of her own. E raises a hand and opens a keypad, like the shop's, for the number in digits. Then the character says it and the teacher answers. If nobody answers for 20 seconds, a classmate does, in a character's voice played higher. Kirjoita sanalla, the hard one, has levels for 0–9, 0–20 and 0–100 and goes the other way: the board shows digits and the keypad becomes a Sámi keyboard for writing the word, with the classmates waiting all the while. In both, what's said shows in a speech bubble in Sámi and Finnish, and each language has a switch where the level is chosen. All of it is in `src/lesson.js`.

The general store, Rautakauppa, is played the same way, without the butcher. It's L-shaped: tools and fishing gear hang on pegboards and clothes on rails in the hall, and a wide opening leads to a showroom where big things stand on low platforms. Its prices are play prices. It has one till and a background sound of its own, from a large hardware store.

Laavu is a slow evening with no clock or list to race. The chores come one after another: take the axe, fell the birch, saw it, carry the short logs to the block, split them with the axe, carry the billets to the ring of stones, gather branches and light the fire. Then the backpack (B, or E beside it) holds what's needed for cooking and for making a drink. When the sausage and bread are eaten, a drink is made and the dog is fed, the fire goes out, and E beside the sleeping bag by the lávvu's door goes to bed. E uses things and Q puts down what's in the hands. The dog has a name of its own, kept in the browser, which can be changed from the backpack. All of it is in `src/camp.js`.

The forest is made ahead by `tools/make_forest.py` into `art/forest/`: the ground in pieces that load as they come near, and the trees. Which species grows where is decided in `tools/make_map.py`: Norway spruce, Scots pine with juniper under it, and birch with some rowan along the river. Only the river, some grass, the trees' slow lean and a few specks of light move, so that it stays calm to look at.

The grocery store and the two classrooms are made the same way, by `tools/make_store.py` and `tools/make_classrooms.py` into `art/store/`, `art/classroom/` and `art/lesson/`: the floor in pieces, one sheet with each tile's walls and fixtures, and for the classrooms the chair. All of it goes into the floor's pictures, and a tile is drawn again only over someone behind it. In these two, on a big enough screen, the window shows more of the world rather than a bigger picture of it, with buttons for 1×, 2×, 3× and 4× zoom, and the game window is never larger than 1920×1080. In the grocery store every food always has its own place, from `stock_of` in `tools/make_map.py`, and a sign with its Finnish name. The food, the animals, the shops' things and the people are made by `tools/make_animals.py` into `art/animals/`. After changing the map, run the store's or the classrooms' script again.

## Art

```bash
python3 tools/make_mahtte.py
```

This draws the base models and every sprite sheet. See [art/mahtte/README.md](art/mahtte/README.md).

## Drawing on the GPU (a test)

The game can draw with WebGL 2 instead of the 2D canvas, in every place, with the same pictures, words and sounds. It needs
the game served, as a browser won't hand pictures from files to WebGL: `python3 tools/serve.py`, then
<http://127.0.0.1:8000/peli.html>. It draws with the GPU unless told otherwise: Grafiikka, among the links under the game,
switches between the GPU and the basic 2D canvas (after asking, as the round starts again), and the browser keeps the choice;
`?gl` and `?gl=0` on the address do the same. Opened as a file, or
where WebGL is done by the CPU, the game uses the 2D canvas (`?gl=force` tries the GPU anyway). Suorituskyky, on at first and kept as
it's left, shows a line with the frames a second and how long a frame takes, and the effects, from 0 (none) to 3. `kauppa-gl.html` goes straight into the
grocery store, and `?canvas` on it draws the same with the 2D canvas, for comparing.

The code is in `src/gl/`. `gl2d.js` takes the drawing calls the game already makes and gathers them into a few batched
draws: every picture goes once into a texture atlas, trimmed to what shows, and a place's whole picture of the world into a
texture of its own. The camp's dark, firelight and glow are drawn by the GPU itself. `post.js` adds light where a place has
its light baked: the grocery store, the forest and both classrooms. People and animals are lit by where they stand and cast
shadows from the sun (and in the store the lamps), with light shafts through the windows or between the trees, a glow round
what's bright and a slight colour mood. Elsewhere the effects are greyed out for now. In every place the zoom is eased, and a
slow device turns the effects down by itself. The light comes from each place's own geometry and sun, baked by

```bash
python3 tools/make_light.py
```

into `art/<place>/light.png` and `light.js`. Run it again after `tools/make_store.py`, `tools/make_classrooms.py` or
`tools/make_forest.py` changes a place.

## Sound

Footsteps are made in the browser (`footstepSound` in `src/game.js`), differently on forest ground, the path and
the bridge, so they need no files or credit.

## Numbers

```bash
python3 tools/make_numbers.py
```

This writes `data/numbers.js`, the numbers 0 to 100, checked against `satni.db` read-only.

## Map

```bash
python3 tools/make_map.py
```

This writes `data/map.js`, with all the places. They are generated test maps for now, not designed ones.

## Speech

```bash
python3 tools/fetch_voices.py
```

This fetches the spoken lines into `audio/` once: the question, the greeting, varied answers, every thing's name
in plain and coloured forms, and the numbers up to 100. The name the player types
stays on their device and is not spoken.

## Word data

```bash
taskset -c 0-15 python3 tools/export_words.py
```

This reads Sátni FST's `satni.db` read-only (`--db PATH` to point elsewhere) and writes:

| File | Contents |
|---|---|
| `data/starter-words.js` | the words the game shows, from `tools/starter_words.tsv` |
| `data/words.json` | every word that passes the filters; not used by the game or kept in this repository |
| `data/review/filtered.tsv` | what the filters removed and why; not used by the game or kept in this repository |

The same database always gives the same files. Only words listed by hand in `tools/starter_words.tsv`
reach players. The automatic filters are a safety net and don't make a word suitable for children
on their own, so any other word needs review before it goes into the game. None of the words or translations have been checked yet.

## To check

- **The gákti**: see [art/mahtte/README.md](art/mahtte/README.md).
- **The kota sprite and the landscape** are rough guesses.
- **The general store's cultural models**: the gákti, the pulk (`geres`), the lávvu, the kuksa, the knife and the lasso in `src/models.js` are generic and have no source. `saamenpuku` isn't in the dictionary; it's set by hand in `tools/export_words.py`. The Sámi sentences for `buvssat` are drafts.
- **Laavu**: the open fire follows a photograph used only as a reference, which isn't in the project. The lávvu, the pulk, the twig floor and the skin to sleep on are generic and have no source. The dog follows the breed's descriptions. The camp's Sámi sentences in `tools/fetch_voices.py` are drafts.
- **The classroom's teacher and classmates**: the teacher's shirts and risku in `src/models.js` are generic and have no source, and the classmates' everyday clothes and the blue shawl in `tools/make_mahtte.py` are a guess. So are the book's title "Sámegiella", the guksi on the teacher's desk and the backpacks with gákti bands in the small classroom. The teacher's sentences and "Leago nu?" in `tools/fetch_voices.py` are drafts.
- **Starter words and translations** in `tools/starter_words.tsv`.

Credits and licences: [CREDITS.md](CREDITS.md).
