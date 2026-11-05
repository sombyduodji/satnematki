#!/usr/bin/env python3
"""Generate the places of the game (data/map.js). The same seed always gives the same maps.

Test maps for now. The forest has a river with two bridges, two paths each way and forest at the edges.
Tiles: g grass, t tree, w water, b bridge, p path; a asphalt, q parking bay, s pavement; F wooden floor, f tiled floor;
and the solid B building, W wall, X low wall, K bookshelf, S store shelf, R fridge, Z freezer, P produce crate,
C till, M meat counter, D desk, O pegboard, U clothes rail, N low platform; A ground with something big on it; and in the classroom L floor, E pupil's desk, T teacher's desk, V blackboard wall, G window wall.
Spots are where things can be placed. The game drops any that something would hide; see openSpot in src/game.js.

Usage: python3 tools/make_map.py
"""
import json
import math
import random
from collections import deque
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data/map.js"
W, H = 44, 32
rng = random.Random(7)
m = [["g"] * W for _ in range(H)]
river = [15 + 3.5 * math.sin(x / 6.5) + 1.5 * math.sin(x / 2.9 + 1) for x in range(W)]
for x in range(W):
    top = int(river[x])
    for y in range(top, top + 3):
        m[y][x] = "w"
    # Keep the river joined where it steps up or down between columns.
    if x:
        a, b = sorted((int(river[x - 1]), top))
        for y in range(a, b + 3):
            m[y][x] = "w"
for bx in (12, 30):
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
for bx in (12, 30):
    path(bx, 4, bx, H - 5)
path(4, 8, W - 5, 8)
path(4, 25, W - 5, 25)
clusters = [(rng.randrange(W), rng.randrange(H), rng.uniform(2.5, 5)) for _ in range(9)]
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
                chance = max(chance, 0.55)
        if rng.random() < chance:
            m[y][x] = "t"
START = (21, 8)
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
        if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and m[n[1]][n[0]] not in "tw":
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
)
water = [(x, y) for y in range(H) for x in range(W) if m[y][x] == "w" and near((x, y), 18) and
         any((x + a, y + b) in seen for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
water.sort()
forest = {"rows": ["".join(r) for r in m], "start": {"x": START[0], "y": START[1]}, "spots": {"land": land, "water": water}}


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

# Grocery store: long shelves and tills by the door.
store = blank(30, 22, "f")
walls(store, "W")
# Grocery store: fridges and freezers at the back, shelves and produce crates in the middle, tills by the door.
shelves(store, "R", (4,), ((5, 13),))
shelves(store, "Z", (4,), ((16, 24),))
shelves(store, "S", (9,), ((5, 13),))
shelves(store, "P", (9,), ((16, 24),))
shelves(store, "S", (14,), ((5, 13),))
shelves(store, "Z", (14,), ((16, 24),))
shelves(store, "C", (18,), ((6, 9), (20, 23)))
# The meat counter by the left wall: M, with the butcher in a pocket of floor behind it that nobody else can get into.
shelves(store, "M", (5, 6, 7, 8), ((3, 3),))
shelves(store, "M", (4, 9), ((2, 3),))


def fixture_spots(grid, tile):
    """Every tile of a fixture: the things stand in it, reached from the aisle."""
    return sorted((x, y) for y, row in enumerate(grid) for x, t in enumerate(row) if t == tile)


library_place = rooms(library, (14, 19), [])
library_place["spots"].update(bookshelf=fixture_spots(library, "K"), table=fixture_spots(library, "D"))
store_place = rooms(store, (15, 18), [])
store_place["spots"].update(meat=[spot for spot in fixture_spots(store, "M") if spot[0] == 3 and 6 <= spot[1] <= 8], shelf=fixture_spots(store, "S"), fridge=fixture_spots(store, "R"), freezer=fixture_spots(store, "Z"), produce=fixture_spots(store, "P"))

# General store: an L, with one till, and the door and that till in the same spots as the grocery store's. The hall has tools and fishing gear on
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
shelves(gearstore, "C", (18,), ((6, 9),))
gearstore_place = rooms(gearstore, (15, 18), [])
gearstore_place["spots"].update(
    tools=[(x, 4) for x in range(5, 14)], fishing=[(x, y) for y in (4, 9) for x in range(16, 25)],
    clothes=fixture_spots(gearstore, "U"), platform=[(x, y) for y in (5, 9) for x in (33, 37, 41)],
)

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
# The small classroom: four desks, windows on the left with the sun coming in, and warm walls. The white board is drawn by the game.
lesson = blank(14, 14, "F")
walls(lesson, "Y")
for y in range(14):
    for x in range(14):
        if lesson[y][x] == "X":
            lesson[y][x] = "H"
for y in (3, 4, 7, 8):
    lesson[y][1] = "J"
shelves(lesson, "T", (4,), ((6, 9),))
for y in (6, 9):
    for x in (5, 9):
        lesson[y][x] = "E"
lesson_place = rooms(lesson, (9, 7), [])
classroom_place = rooms(classroom, (14, 22), [])
classroom_place["spots"]["desk"] = sorted((x, y) for y, row in enumerate(classroom) for x, t in enumerate(row) if t == "E")

city_place = rooms(city, (18, 9), [])
city_place["spots"]["bay"] = city_spots
# What stands free stays on the lanes between the rows of bays.
city_place["spots"]["land"] = sorted((x, y) for y in (9, 10, 15, 16, 21, 22) for x in range(6, 30) if city[y][x] == "a" and x % 3 == 0)

# Home: a living room and a kitchen at the back, a bedroom, a hall and a bathroom in front, with low walls between
# them so that all of it can be seen, like a doll's house.
home = blank(30, 24, "F")
walls(home, "Y")
for y in range(len(home)):
    for x in range(len(home[0])):
        if home[y][x] == "X":
            home[y][x] = "H"
        elif 17 <= x <= 27 and 2 <= y <= 12:
            home[y][x] = "f"
        elif 2 <= x <= 11 and 14 <= y <= 21:
            home[y][x] = "c"
        elif 19 <= x <= 27 and 14 <= y <= 21:
            home[y][x] = "j"
for x in range(2, 28):
    if x not in (7, 8, 14, 15):
        home[13][x] = "H"
for y in range(2, 13):
    if y not in (7, 8, 9):
        home[y][16] = "H"
for y in range(14, 22):
    if y not in (17, 18):
        home[y][12] = "H"
        home[y][18] = "H"
for y in (5, 6, 10, 11, 16, 17, 20):
    home[y][1] = "J"
for x in (5, 6, 12, 13, 20, 21, 25, 26):
    home[1][x] = "I"
home_place = rooms(home, (15, 18), [])
# Each thing has its own place: x, y and which way it faces (0 towards lower left, 1 towards lower right).
home_place["spots"]["home"] = {
    "sofa": (9, 3, 0), "rug": (8, 7, 0), "tv": (3, 6, 1), "lamp": (5, 3, 0), "bookcase": (13, 3, 0), "flower": (14, 11, 0),
    "stove": (19, 3, 0), "cupboard": (22, 3, 0), "fridge": (24, 3, 0), "freezer": (26, 3, 0), "table": (22, 8, 0), "chair": (22, 9.4, 2),
    "bed": (6, 17, 0), "wardrobe": (9, 15, 0), "mirror": (16, 15, 0),
    "toilet": (20, 15, 0), "sink": (22, 15, 0), "washer": (24, 15, 0), "bathtub": (26, 17, 0), "shower": (20, 20, 0),
    "eadni": (8.4, 3.25, 0), "viellja": (9.6, 3.25, 0), "oabbá": (9, 19, 0), "áhčči": (20.4, 3.6, 3),
}

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
