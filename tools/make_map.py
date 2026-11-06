#!/usr/bin/env python3
"""Generate the places of the game (data/map.js). The same seed always gives the same maps.

Test maps for now. The forest has a river with two bridges, two paths each way and forest at the edges, its species in areas of their own.
Tiles: g grass, t tree, w water, b bridge, p path; a asphalt, q parking bay, s pavement; F wooden floor, f tiled floor;
and the solid B building, W wall, X low wall, K bookshelf, S store shelf, R fridge, Z freezer, P produce crate,
C till, M meat counter, D desk, k the library's counter, n something standing in a corner, O pegboard, U clothes rail, N low platform; A ground with something big on it; and in the classroom L floor, E pupil's desk, T teacher's desk, V blackboard wall, G window wall.
Spots are where things can be placed. The game drops any that something would hide; see openSpot in src/game.js.

Usage: python3 tools/make_map.py
"""
import json
import math
import random
from collections import deque
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data/map.js"
W, H = 62, 45  # about twice the ground of the first forest
rng = random.Random(7)
m = [["g"] * W for _ in range(H)]
river = [21 + 5 * math.sin(x / 9.2) + 2 * math.sin(x / 4.1 + 1) for x in range(W)]
for x in range(W):
    top = int(river[x])
    for y in range(top, top + 4):
        m[y][x] = "w"
    # Keep the river joined where it steps up or down between columns.
    if x:
        a, b = sorted((int(river[x - 1]), top))
        for y in range(a, b + 4):
            m[y][x] = "w"
for bx in (17, 43):
    for y in range(H):
        if m[y][bx] == "w":
            m[y][bx] = "b"
def path(x0, y0, x1, y1):
    x, y = x0, y0
    while (x, y) != (x1, y1):
        if m[y][x] == "g":
            m[y][x] = "p"
        if x != x1 and (y == y1 or rng.random() < 0.8):
            x += (x1 > x) - (x1 < x)
        else:
            y += (y1 > y) - (y1 < y)
    if m[y][x] == "g":
        m[y][x] = "p"
for bx in (17, 43):
    path(bx, 5, bx, H - 6)
path(5, 11, W - 6, 11)
path(5, 38, W - 6, 38)
# The old wilderness church, scenery that can't be walked into, inside its fence. Must match FOREST_CHURCH in src/world.js and CHURCH in tools/make_forest.py.
CHURCH = (46, 27, 58, 37)  # the churchyard: from x and y, up to but not including x and y
GATE_X = 55  # the open gate in its near side, on the path
# Only the near part of the yard can be walked in, in the corner between the arms and by the gable; the rest is the building and what
# stands behind it, and neither can the ground just outside the fence, except at the gate.
for y in range(CHURCH[1] - 1, CHURCH[3] + 1):
    for x in range(CHURCH[0] - 1, CHURCH[2] + 1):
        ring = x in (CHURCH[0] - 1, CHURCH[2]) or y in (CHURCH[1] - 1, CHURCH[3])
        open_yard = x >= 56 or (x >= 54 and y >= 33)
        boulders = x == 54 and y in (34, 35)
        if (ring and not (x == GATE_X and y == CHURCH[3])) or (not ring and (not open_yard or boulders)):
            m[y][x] = "A"
clusters = [(rng.randrange(W), rng.randrange(H), rng.uniform(3, 6.5)) for _ in range(15)]
# Birch groves along the river, close together as birches grow, clear of the bridges.
clusters += [(x, int(river[x]) + (7 if i % 2 else -4), 3.2) for i, x in enumerate((6, 26, 33, 52, 58))]
for y in range(H):
    for x in range(W):
        if m[y][x] != "g":
            continue
        edge = min(x, y, W - 1 - x, H - 1 - y)
        chance = 0.04
        if edge < 3:
            chance = 0.85 - edge * 0.15
        for cx, cy, r in clusters:
            if math.hypot(x - cx, y - cy) < r:
                chance = max(chance, 0.62)
        if rng.random() < chance:
            m[y][x] = "t"
# Birches round the church, except where they would stand between the viewer and it.
away_from_church = lambda x, y: max(CHURCH[0] - x, x - CHURCH[2] + 1, CHURCH[1] - y, y - CHURCH[3] + 1)
for y in range(H):
    for x in range(W):
        if m[y][x] == "g" and 2 <= away_from_church(x, y) <= 4 and y < CHURCH[3] and rng.random() < 0.5:
            m[y][x] = "t"
# Nothing grows on or right beside a path, and nothing in front of the church's near corner, which it couldn't be sorted against.
for y in range(H):
    for x in range(W):
        beside_path = any(0 <= x + a < W and 0 <= y + b < H and m[y + b][x + a] in "pb" for a in (-1, 0, 1) for b in (-1, 0, 1))
        # The trees are also kept out of the churchyard, and from the view of the church from the path.
        if m[y][x] == "t" and (beside_path or (CHURCH[0] <= x < CHURCH[2] and CHURCH[1] <= y < CHURCH[3]) or (y >= CHURCH[3] and 38 <= x <= 52 and x + y < 85) or (x >= 42 and CHURCH[3] < y <= H - 4)):
            m[y][x] = "g"
START = (30, 11)
for y in range(H):
    for x in range(W):
        if m[y][x] == "t" and math.hypot(x - START[0], y - START[1]) < 3:
            m[y][x] = "g"
seen = {START}
q = deque([START])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and m[n[1]][n[0]] not in "twA":
            seen.add(n); q.append(n)
near = lambda t, r: math.hypot(t[0] - START[0], t[1] - START[1]) < r


def count_near(t, tile, reach):
    return sum(
        1 for dy in range(-reach, reach + 1) for dx in range(-reach, reach + 1)
        if 0 <= t[0] + dx < W and 0 <= t[1] + dy < H and m[t[1] + dy][t[0] + dx] == tile
    )


# Open ground all over the map, where a thing is easy to see, and not in the way at a bridge.
land = sorted(
    t for t in seen
    if m[t[1]][t[0]] == "g" and count_near(t, "t", 2) <= 2 and count_near(t, "b", 2) == 0
    and not (CHURCH[0] <= t[0] < CHURCH[2] and CHURCH[1] <= t[1] <= CHURCH[3])
)
water = [(x, y) for y in range(H) for x in range(W) if m[y][x] == "w" and near((x, y), 26) and
         any((x + a, y + b) in seen for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
water.sort()


def tree_kind(x, y):
    """Each species has its own part of the forest, as they would, after a list of northern Finland's trees from the user: Norway spruce
    where it's moist and sheltered, Scots pine on the dry ground, birch along the river. Juniper grows under the pines and a rowan here
    and there among the birches. The other species on that list are left out, so as not to make it too mixed."""
    if away_from_church(x, y) <= 4:
        return "B"
    wander = 3.5 * math.sin(x / 7.3 + y / 11) + 2.5 * math.sin(y / 5.1 - x / 13)
    river_y = river[x] + 2
    if abs(y - river_y) + wander * 0.4 < 6.5:
        return "R" if rng.random() < 0.1 else "B"
    # Spruce in the north-west and south-east, and pine in the others.
    moist = (x + wander - W / 2) * (y + wander - H / 2) < 0
    if moist:
        return "S"
    return "J" if rng.random() < 0.18 else "P"


kinds = [[tree_kind(x, y) if m[y][x] == "t" else "." for x in range(W)] for y in range(H)]
forest = {"rows": ["".join(r) for r in m], "trees": ["".join(r) for r in kinds], "start": {"x": START[0], "y": START[1]}, "spots": {"land": land, "water": water}}


def blank(width, height, fill):
    return [[fill] * width for _ in range(height)]


def walls(grid, tile, thick=2):
    """Full height at the back. On the viewer's side the wall is low (X), so it doesn't hide the room."""
    height, width = len(grid), len(grid[0])
    for y in range(height):
        for x in range(width):
            if min(x, y) < thick:
                grid[y][x] = tile
            if min(width - 1 - x, height - 1 - y) < thick:
                grid[y][x] = "X"


def rooms(grid, start, spots):
    return {"rows": ["".join(r) for r in grid], "start": {"x": start[0], "y": start[1]}, "spots": {"land": sorted(spots), "water": []}}


def shelves(grid, tile, rows, runs):
    for y in rows:
        for x0, x1 in runs:
            for x in range(x0, x1 + 1):
                grid[y][x] = tile


def beside_shelves(grid, shelf):
    """Floor just in front of a shelf, every other tile, so that things stand in view and leave room."""
    spots = []
    for y in range(1, len(grid) - 1):
        for x in range(1, len(grid[0]) - 1):
            if grid[y][x] in "fF" and grid[y - 1][x] == shelf and x % 2 == 0:
                spots.append((x, y))
    return spots


# Library: rows of bookshelves, reading desks and a wooden floor.
library = blank(28, 22, "F")
walls(library, "W")
shelves(library, "K", (4, 9), ((5, 12), (15, 22)))
shelves(library, "D", (14, 18), ((5, 12), (15, 22)))
# The librarian's counter by the right-hand wall, k, with room behind it, and n for what stands in the corners: two big plants at the
# back and a globe at the front. Must match tools/make_library.py.
shelves(library, "k", (12, 13, 14, 15), ((24, 24),))
for x, y in ((2, 2), (25, 2), (2, 19)):
    library[y][x] = "n"

# Grocery store: long shelves and tills by the door.
store = blank(46, 34, "f")
walls(store, "W")
# Grocery store: long fridges and freezers at the back, aisles of shelves, produce near the door, and two checkout lanes side by side,
# with everyone going the same way through them towards the door. Must match STORE_LANES in src/game.js.
# Two aisles cross the rows, at x 13-14 and 31-32, so that nothing goes on endlessly. Each kind of produce and fridge food has two places side by side, so
# those rows have even lengths either side of the aisle.
shelves(store, "R", (4,), ((5, 12), (15, 22)))
shelves(store, "Z", (4,), ((25, 30), (33, 42)))
shelves(store, "S", (9,), ((6, 12), (15, 21), (25, 30), (33, 42)))
shelves(store, "S", (14,), ((6, 12), (15, 21)))
shelves(store, "Z", (14,), ((25, 30), (33, 42)))
shelves(store, "S", (19,), ((6, 12), (15, 21)))
shelves(store, "P", (19,), ((25, 30), (33, 42)))
# Two checkouts running across the store, each with the customers' lane on its left, and a barrier from wall to wall: the way out is
# through a lane, and the way in is by the gate near the door. Each counter starts with a stretch without a belt, where the basket goes.
# Must match STORE_LANES and STORE_GATE in src/game.js.
for x in (20, 24):
    for y in range(23, 28):
        store[y][x] = "C"
for x in range(2, 44):
    if store[27][x] == "f" and x not in (19, 23, 39, 40):
        store[27][x] = "v"
# Eggs in their cardboard boxes, stacked on a pallet on the floor.
shelves(store, "e", (24, 25), ((30, 31),))
# A second row of crates, so that each kind has two with room for its sign.
shelves(store, "P", (22,), ((27, 30), (33, 42)))
# The meat counter by the left wall: M, with the butcher in a pocket of floor behind it that nobody else can get into.
shelves(store, "M", (5, 6, 7, 8, 9, 10, 11, 12, 13), ((3, 3),))
shelves(store, "M", (4, 14), ((2, 3),))
# The butcher's way in and out: a swing gate at the counter's end, Q, with a way to it round the end of the counter.
store[14][2] = "Q"


def fixture_spots(grid, tile):
    """Every tile of a fixture: the things stand in it, reached from the aisle."""
    return sorted((x, y) for y, row in enumerate(grid) for x, t in enumerate(row) if t == tile)


library_place = rooms(library, (14, 19), [])
library_place["spots"].update(bookshelf=fixture_spots(library, "K"), table=fixture_spots(library, "D"))
# Each colour has bookcase sections of its own, side by side, filled with books of that colour: a book to find stands in a gap of its
# colour's sections. Along each run of bookcases from the left, the runs in the order of the map. Must match the colours of the words.
LIBRARY_SECTIONS = [[("red", 4), ("blue", 4)], [("yellow", 4), ("green", 4)], [("white", 3), ("black", 3), ("grey", 2)], [("brown", 4), ("orange", 4)]]
_case_runs = [(y, x0, x1) for y in (4, 9) for x0, x1 in ((5, 12), (15, 22))]
library_place["sections"] = {}
for (y, x0, x1), colours in zip(_case_runs, LIBRARY_SECTIONS):
    x = x0
    for name, count in colours:
        library_place["sections"][name] = [[x + i, y] for i in range(count)]
        x += count
    assert x == x1 + 1, (y, x0, x1)
store_place = rooms(store, (37, 30), [])
# Every food has its own place in the store, always the same, and all the places are taken: what has a whole aisle to fill simply goes on for
# several tiles. Must be what tools/make_store.py draws, and it's read from this.
# What goes together on the shelves, each group having a stretch of its own: which row, from where to where, and what's on it, along it in this order.
SHELF_GROUPS = [
    (9, 0, 22, ["bread", "ryebread", "toast", "crispbread"]),
    (9, 23, 99, ["bun", "candy", "chocolate", "soda"]),
    (14, 0, 99, ["cookie", "jam"]),
    (19, 0, 14, ["coffee"]),
    (19, 14, 99, ["tea"]),
]


def stock_of(grid):
    foods = {}
    for line in (Path(__file__).resolve().parent / "starter_words.tsv").read_text(encoding="utf-8").splitlines():
        cols = line.split("\t")
        if not line.startswith("#") and len(cols) >= 7 and cols[6] == "food" and cols[5] in ("shelf", "fridge", "freezer", "produce", "meat", "pallet"):
            foods.setdefault(cols[5], []).append(cols[4])
    stock = {}
    def share(tiles, kinds):
        for i, sprite in enumerate(kinds):
            stock[sprite] = tiles[i * len(tiles) // len(kinds):(i + 1) * len(tiles) // len(kinds)]
    shelves_at = fixture_spots(grid, "S")
    for row, x0, x1, kinds in SHELF_GROUPS:
        share(sorted((x, y) for x, y in shelves_at if y == row and x0 <= x < x1), kinds)
    # Each food in one unit, never half in one and half in the next, so that its sign has two places side by side to stand on.
    def units_of(tile):
        units = []
        for x, y in sorted(fixture_spots(grid, tile), key=lambda spot: (spot[1], spot[0])):
            if units and units[-1][-1] == (x - 1, y):
                units[-1].append((x, y))
            else:
                units.append([(x, y)])
        return units
    for place, tile in (("fridge", "R"), ("produce", "P")):
        units, kinds = units_of(tile), sorted(foods[place])
        pairs = [len(unit) // 2 for unit in units]
        for i, unit in enumerate(units):
            many = max(1, min(pairs[i], round(pairs[i] * len(kinds) / sum(pairs[i:]))))
            share(unit, kinds[:many])
            kinds = kinds[many:]
        assert not kinds, f"{place}: no room for {kinds}"
    # The freezers by hand: ice cream has the big one at the back, fish the one beside it, and the berries share theirs.
    freezers = units_of("Z")
    for unit, kinds in zip(freezers, (["guolli"], ["icecream"], ["pizza"], ["lingonberry", "cloudberry"])):
        share(unit, kinds)
    assert len(freezers) == 4 and sorted(foods["freezer"]) == sorted(["guolli", "icecream", "pizza", "lingonberry", "cloudberry"])
    for sprite, spots in zip(sorted(foods["meat"]), (((3, 6), (3, 7)), ((3, 8), (3, 9)), ((3, 10), (3, 11)), ((3, 12), (3, 13)))):
        stock[sprite] = list(spots)
    stock[foods["pallet"][0]] = fixture_spots(grid, "e")
    return {sprite: [list(spot) for spot in tiles] for sprite, tiles in stock.items()}


store_place["stock"] = stock_of(store)
store_place["spots"].update(meat=[spot for spot in fixture_spots(store, "M") if spot[0] == 3 and 6 <= spot[1] <= 13], shelf=fixture_spots(store, "S"), pallet=fixture_spots(store, "e")[:1], fridge=fixture_spots(store, "R"), freezer=fixture_spots(store, "Z"), produce=fixture_spots(store, "P"))

# General store: an L, with one till. The hall has tools and fishing gear on
# pegboards and clothes on rails. A wide opening leads from its far side to a wood-floored showroom with windows, where the big
# things stand well apart on low platforms. Beyond the L's walls is nothing (_).
SHOWROOM_END = 46
gearstore = blank(48, 22, "_")
for y in range(22):
    for x in range(30):
        back = min(x, y) < 2
        gearstore[y][x] = "W" if back and x < 28 and y < 20 or y < 2 else "X" if x >= 28 or y >= 20 else "f"
for y in range(4, 10):
    gearstore[y][28] = gearstore[y][29] = "f"
for y in range(14):
    for x in range(30, 48):
        back = y < 2 and x < SHOWROOM_END
        gearstore[y][x] = "W" if back else "X" if y >= 12 or x >= SHOWROOM_END else "F"
for x in (32, 33, 37, 38, 42, 43):
    gearstore[1][x] = "o"
shelves(gearstore, "O", (4,), ((5, 13), (16, 24)))
shelves(gearstore, "U", (9, 14), ((5, 13),))
shelves(gearstore, "O", (9,), ((16, 24),))
shelves(gearstore, "U", (14,), ((16, 24),))
shelves(gearstore, "N", (5, 9), ((32, 34), (36, 38), (40, 42)))
shelves(gearstore, "C", (18,), ((5, 9),))  # the first tile without a belt, for the basket
gearstore_place = rooms(gearstore, (15, 18), [])
gearstore_place["spots"].update(
    tools=[(x, 4) for x in range(5, 14)], fishing=[(x, y) for y in (4, 9) for x in range(16, 25)],
    clothes=fixture_spots(gearstore, "U"), platform=[(x, y) for y in (5, 9) for x in (33, 37, 41)],
)
# As in the grocery store, every thing for sale has its own place, always the same and always stocked, taking up tiles of its fixture
# side by side: what the list asks for changes, what's on the pegboards, rails and platforms doesn't. Along each fixture from the left,
# what's there and on how many tiles. The jackets and shirts have a second place on the third rail, the boats and pulks a second platform.
# Must be the gear words' sprites in tools/starter_words.tsv.
GEAR_FIXTURES = [
    ((5, 4), [("spade", 2), ("saw", 1), ("axe", 1), ("hammer", 1), ("knife", 1), ("kuksa", 1), ("lasso", 1), ("reindeerbell", 1)]),
    ((16, 4), [("rod", 3), ("oar", 2), ("fishnet", 2), ("scoopnet", 2)]),
    ((16, 9), [("reel", 3), ("fishingline", 2), ("lure", 2), ("bait", 2)]),
    ((5, 9), [("jacket", 3), ("shirt", 3), ("trousers", 3)]),
    ((5, 14), [("gakti", 3), ("hat", 3), ("sock", 3)]),
    ((16, 14), [("rubberboots", 3), ("backpack", 4), ("shirt", 2)]),
]
gearstore_place["stock"] = {}
for (x0, y), things in GEAR_FIXTURES:
    x = x0
    for sprite, n in things:
        gearstore_place["stock"].setdefault(sprite, []).extend([x + i, y] for i in range(n))
        x += n
    assert x == x0 + 9, (x0, y)
for sprite, tile in zip(["boat", "snowscooter", "pulk", "lavvu", "boat", "pulk"], [(33, 5), (37, 5), (41, 5), (33, 9), (37, 9), (41, 9)]):
    gearstore_place["stock"].setdefault(sprite, []).append(list(tile))

# Car park: rows of marked bays, with buildings around and a pavement along them.
city = blank(36, 28, "a")
walls(city, "B", 3)
for y in range(3, 25):
    for x in range(3, 33):
        if min(x - 3, y - 3, 32 - x, 24 - y) == 0:
            city[y][x] = "s"
for bays in (6, 7, 12, 13, 18, 19):
    for x in range(6, 30):
        if x not in (17, 18):  # a way through the middle
            city[bays][x] = "q"
for x, y in ((3, 3), (32, 3), (3, 24), (32, 24)):
    city[y][x] = "t"
# Two ways in for cars, through the pavement and the low walls at the front and on the right, the roads going on out of the map.
# Must match ENTRANCES in tools/make_city.py.
for y in range(24, 28):
    for x in (17, 18):
        city[y][x] = "a"
for x in range(32, 36):
    for y in (15, 16):
        city[y][x] = "a"
# Street lamps and benches on the pavement at the back, n. Must match tools/make_city.py.
for x in (9, 15, 21, 27):
    city[3][x] = "n"
for y in (9, 15, 21):
    city[y][3] = "n"
for x in (12, 24):
    city[3][x] = "n"
for y in (12, 18):
    city[y][3] = "n"
# A bay is two tiles deep, from the first row of each pair. Vehicles park nose-in with a space beside them.
city_spots = [(x, y) for y in (6, 12, 18) for x in range(6, 30) if city[y][x] == "q" and x % 2 == 0]

# Classroom: desks in rows with wide aisles, a teacher's desk, a blackboard and windows.
classroom = blank(30, 26, "L")
walls(classroom, "W")
for x in range(9, 21):
    classroom[1][x] = "V"
for y in range(4, 24, 4):
    classroom[y][1] = "G"
shelves(classroom, "T", (4,), ((12, 17),))
for y in (8, 12, 16, 20):
    for x in (6, 10, 14, 18, 22):
        classroom[y][x] = "E"
# The small classroom: six desks, windows on the left with the sun coming in, and warm walls. The white board is drawn by the game.
lesson = blank(16, 14, "F")
walls(lesson, "Y")
for y in range(14):
    for x in range(16):
        if lesson[y][x] == "X":
            lesson[y][x] = "H"
for y in (3, 4, 7, 8):
    lesson[y][1] = "J"
shelves(lesson, "T", (4,), ((6, 9),))
for y in (6, 9):
    for x in (4, 8, 12):
        lesson[y][x] = "E"
lesson_place = rooms(lesson, (8, 7), [])
classroom_place = rooms(classroom, (14, 22), [])
classroom_place["spots"]["desk"] = sorted((x, y) for y, row in enumerate(classroom) for x, t in enumerate(row) if t == "E")

city_place = rooms(city, (18, 9), [])
city_place["spots"]["bay"] = city_spots
# What stands free stays on the lanes between the rows of bays.
city_place["spots"]["land"] = sorted((x, y) for y in (9, 10, 15, 16, 21, 22) for x in range(6, 30) if city[y][x] == "a" and x % 3 == 0)

# Home: a living room and a kitchen at the back, a bedroom, a hall and a bathroom in front, with low walls between
# them so that all of it can be seen, like a doll's house. What stands in it stands against its walls, as at home,
# but for the kitchen table with room for the whole family round it.
home = blank(26, 20, "F")
walls(home, "Y")
for y in range(len(home)):
    for x in range(len(home[0])):
        if home[y][x] == "X":
            home[y][x] = "H"
        elif 14 <= x <= 23 and 2 <= y <= 9:
            home[y][x] = "f"
        elif 2 <= x <= 9 and 11 <= y <= 17:
            home[y][x] = "c"
        elif 16 <= x <= 23 and 11 <= y <= 17:
            home[y][x] = "j"
for x in range(2, 24):
    if x not in (11, 12):  # from the hall into the living room
        home[10][x] = "H"
for y in range(2, 10):
    if y not in (7, 8):  # from the living room into the kitchen
        home[y][13] = "H"
for y in range(11, 18):
    if y not in (13, 14):  # from the hall into the bedroom and the bathroom
        home[y][10] = "H"
        home[y][15] = "H"
# The windows: must match WINDOWS_X and WINDOWS_Y in tools/make_home.py.
for y in (7, 8, 14, 15):
    home[y][1] = "J"
for x in (5, 6, 7, 18):
    home[1][x] = "I"
# Things standing in corners, n, as in the library: two plants, a toy box, a coat stand and a laundry basket. Must match tools/make_home.py.
for x, y in ((12, 2), (23, 9), (2, 17), (14, 11), (19, 17)):
    home[y][x] = "n"
home_place = rooms(home, (12, 16), [])
# Each thing has its own place: x, y and which way it faces (0 towards lower left, 1 towards lower right), its box as big as
# HOME_THINGS in src/game.js says, round x + 0.5, y + 0.5.
home_place["spots"]["home"] = {
    "sofa": (6, 2, 0), "rug": (6, 5, 0), "tv": (2, 5, 1), "lamp": (4, 2, 0), "bookcase": (9, 2, 0), "flower": (2, 8.4, 0),
    "stove": (16, 2, 0), "cupboard": (18, 2, 0), "fridge": (20, 2, 0), "freezer": (22, 2, 0), "table": (18, 6, 0), "chair": (17.2, 7.25, 2),
    "bed": (2.95, 12.6, 1), "wardrobe": (6, 11, 0), "mirror": (8, 11.05, 0),
    "toilet": (17, 11.05, 0), "sink": (19, 11.1, 0), "washer": (16.05, 16, 1), "bathtub": (21.7, 11.18, 1), "shower": (22.92, 16.92, 0),
    "eadni": (5.4, 2.25, 0), "viellja": (6.6, 2.25, 0), "oabbá": (6, 15, 0), "áhčči": (16, 3.1, 2),
}
# What else stands at home that isn't asked for: the rest of the chairs round the kitchen table, and an empty sofa facing the
# television. Each blocks the way as the things asked for do, and is made with them by tools/make_home.py: its kind, x, y and facing.
home_place["spots"]["decor"] = [
    ["chair", 18.8, 7.25, 2], ["chair", 17.2, 4.75, 0], ["chair", 18.8, 4.75, 0], ["chair", 16.05, 6, 1], ["chair", 20.25, 6, 3],
    ["sofa", 12, 4.5, 3],
]

# Lávvu camp: a clearing with a small river behind the lávvu and the forest around it. A marks ground that can't be walked on,
# where something big stands that the game draws itself.
camp_rng = random.Random(11)
camp = blank(30, 32, "g")
CAMP_X = 30
LAVVU_AT, FIRE_AT, TREE_AT, BLOCK_AT = (10.5, 11.5), (15, 16.5), (22, 13), (15, 12)
for y in range(len(camp)):
    for x in range(CAMP_X):
        if min(x, y, 31 - y) < 3 or x >= CAMP_X - 3:
            camp[y][x] = "t"
        elif y < 7 and y >= int(4 + 1.2 * math.sin(x / 3.4)) and y < int(4 + 1.2 * math.sin(x / 3.4)) + 3:
            camp[y][x] = "w"
        elif y >= 3 and y < 4 and camp_rng.random() < 0.7:
            camp[y][x] = "t"
keep_clear = [(LAVVU_AT, 6), (FIRE_AT, 6), (TREE_AT, 4), (BLOCK_AT, 4), ((15, 21), 6)]
for _ in range(34):
    x, y = camp_rng.randrange(3, CAMP_X - 3), camp_rng.randrange(8, 29)
    if all(math.hypot(x - a, y - b) > r for (a, b), r in keep_clear):
        camp[y][x] = "t"
for y in range(8, 16):
    for x in range(6, 16):
        if math.hypot(x + 0.5 - LAVVU_AT[0], y + 0.5 - LAVVU_AT[1]) < 2.75:
            camp[y][x] = "A"
for x, y in ((14, 16), (15, 16), (14, 17), (15, 17), (TREE_AT[0], TREE_AT[1]), (BLOCK_AT[0], BLOCK_AT[1])):
    camp[y][x] = "A"
camp_place = rooms(camp, (14, 15), [])

data = {
    "home": home_place,
    "forest": forest,
    "library": library_place,
    "store": store_place,
    "gearstore": gearstore_place,
    "camp": camp_place,
    "classroom": classroom_place,
    "lesson": lesson_place,
    "city": city_place,
}
OUT.write_text("// Generated by tools/make_map.py.\nwindow.MAHTTE_MAPS = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
for name, place in data.items():
    rows = place["rows"]
    print(f"{name}: {len(rows[0])}x{len(rows)} tiles, " + ", ".join(f"{len(v)} {k}" for k, v in place["spots"].items() if v))
