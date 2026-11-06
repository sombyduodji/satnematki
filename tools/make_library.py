#!/usr/bin/env python3
"""Make the library in 3D, into art/library/, with tools/rooms3d.py: the floor in pieces, each tile's walls and furniture, and where they are.

Rows of bookcases with two shelves of books, sections of them for each of the game's colours (from tools/make_map.py): a book to
find is one of its colour's, and is found at that colour's sections, with nothing more drawn for it. Long reading tables with chairs
and reading lamps, where the game lays pens, pencils and notebooks on top (TABLE_TOP). Bookcases along the back wall, the library's name
over them, tall windows along the other, a parquet floor with a rug under the tables, the librarian's counter, two big plants and a globe.

The sign says GIRJERÁJUS, made like the dictionary's compounds of girjerájus (fylkkagirjerájus, fágagirjerájus): for the user to check.
The globe's land is made up, not a map.

Usage: python3 tools/make_library.py [workers]
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402
from rooms3d import MAPS, ROOT, TILE, Room, box, cylinder, ellipsoid, make, solid, texture, tones  # noqa: E402

_grid = np.random.default_rng(11).random(4096)


def hashed(*values):
    """A steady random number from 0 to 1 for whole numbers."""
    key = np.zeros(np.broadcast(*values).shape, np.int64)
    for i, v in enumerate(values):
        key = key * 73856093 + (np.asarray(v).astype(np.int64) + 1000) * (19349663 + i * 83492791)
    return _grid[np.abs(key) % 4096]


WALL_H = 48
BOOK_GAP_Z = 14.8  # the top of the bookcases' middle board
TABLE_TOP = 10  # must match RAISED.table in src/world.js
CASE_H = 32
CASE_FRONT = 14.5  # the bookcases' front, and their back, across a tile
CASE_BACK = 1.5
SPINE = 1.7  # how far apart books stand, along the shelf
SPINES = [colour(c) for c in ("#a8372d", "#2f5fa8", "#d8a02a", "#3a7a48", "#6e4a86", "#e8e0c8", "#30506a", "#c8642c", "#5a8ab8", "#8a2a3a", "#4a6a3a", "#2a2a36")]
SUN = (-0.8, -0.42, 0.36)  # a low afternoon sun, for a warm, quiet room
# The game's colours, each its middle, dark and light tone, read from src/sprites.js so that a book to find matches its shelves.
RAMPS = {name: np.array([colour(a), colour(b), colour(c)]) for name, a, b, c in
         re.findall(r'(\w+): \{ 1: "(#\w{6})", 2: "(#\w{6})", 3: "(#\w{6})" \}', (ROOT / "src/sprites.js").read_text(encoding="utf-8"))}
# Which colour each bookcase section is, from tools/make_map.py.
SECTION_OF = {(x, y): name for name, tiles in MAPS["library"]["sections"].items() for x, y in tiles}

ROOM = Room("library", wall_h=WALL_H, sun=SUN, windows_x=[(3, 6), (9, 12), (15, 18)], win_low=13, win_high=40, transom=31,
            lamp_tone=(1.16, 1.04, 0.82), ambient=0.7, sun_tone=(1.42, 1.17, 0.84))
CASE_RUNS = ROOM.runs("K")
TABLE_RUNS = ROOM.runs("D")
# The reading lamps, every third tile of a table, and the bulb under each shade: they light the table round them, and the GPU lights
# whoever stands near. The counter has a lamp of its own.
READING_LAMPS = [((tx + 0.5) * TILE, ty * TILE + 5.4) for tx0, tx1, ty in TABLE_RUNS for tx in range(tx0, tx1) if (tx - tx0) % 3 == 1]
COUNTER = ROOM.runs_y("k")[0]  # (y0, y1, x) in tiles
CORNERS = ROOM.tiles("n")


def bounded(p, low, high, detail, margin=1.2):
    """A detailed shape inside a box: worked out only near the box, as the box is no further than it."""
    d = box(p, low, high)
    near = d < margin
    if near.any():
        d[near] = detail(p[near])
    return d


# ------------------------------------------------------------------ books
def book_cells(x, x0, seed, zb, low, high, keep):
    """The book at each cell along a shelf: its middle, half its width, its top and how far back its spine is."""
    j = np.floor((x - x0) / SPINE)
    cx = x0 + (j + 0.5) * SPINE
    top = zb + low + hashed(j, seed) * (high - low)
    inset = hashed(j, seed + 7) * 0.7
    there = keep(cx) & (hashed(j, seed + 13) < 0.94)
    return j, cx, top, inset, there


def books_field(p, x0, x1, back, front, zb, seed, low, high, keep):
    best = np.full(len(p), 1e3)
    x = p[:, 0]
    for k in (-1, 0, 1):
        j, cx, top, inset, there = book_cells(x + k * SPINE, x0, seed, zb, low, high, keep)
        there &= (cx > x0 + 0.6) & (cx < x1 - 0.6)
        d = _book_box(p, cx, back, front - inset, zb, top)
        best = np.minimum(best, np.where(there, d, 1e3))
    return best


def _book_box(p, cx, back, front, zb, top):
    """box() with a different book at each point."""
    half = SPINE / 2 - 0.07
    q = np.stack([np.abs(p[:, 0] - cx) - half, np.abs(p[:, 1] - (back + front) / 2) - (front - back) / 2, np.abs(p[:, 2] - (zb + top) / 2) - (top - zb) / 2], 1)
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0)


def books_paint(p, x0, zb, seed, low, high, ramps=None):
    """Each book's colours. With ramps, a function giving the three tones of the colour at each point, all its books are in those."""
    x, z = p[:, 0], p[:, 2]
    j, _, top, _, _ = book_cells(x, x0, seed, zb, low, high, lambda c: np.ones(len(c), bool))
    if ramps is None:
        pick = (hashed(j, seed + 3) * len(SPINES)).astype(int) % len(SPINES)
        out = np.array(SPINES)[pick] * (0.9 + hashed(j, seed + 5)[..., None] * 0.16)
    else:
        h = hashed(j, seed + 3)
        tone = np.select([h < 0.55, h < 0.8], [0, 1], 2)
        out = ramps(x)[np.arange(len(p)), tone] * (0.92 + hashed(j, seed + 5)[..., None] * 0.12)
    rel = z - zb
    out[np.abs(z - (top - 1.8)) < 0.28] = colour("#e8c060")  # a gold band near the top
    out[(rel > 0.9) & (rel < 1.4)] = out[(rel > 0.9) & (rel < 1.4)] * 0.72
    title = (z > zb + (top - zb) * 0.38) & (z < zb + (top - zb) * 0.62) & (np.abs(((x - x0) % SPINE) - SPINE / 2) < 0.4)
    out[title] = np.minimum(out[title] * 1.35 + 30, 255)
    out[z > top - 0.12] = colour("#efe6cc")  # the pages, on top
    return out


# ---------------------------------------------------------------- bookcases
def case_parts(run):
    tx0, tx1, ty = run
    X0, X1 = tx0 * TILE + 0.3, tx1 * TILE - 0.3
    Y0, Y1 = ty * TILE + CASE_BACK, ty * TILE + CASE_FRONT
    mid = ty * TILE + 8
    shelves = [(2.2, 13.8), (BOOK_GAP_Z, 30)]

    def body_detail(p):
        outer = box(p, (X0, Y0, 0), (X1, Y1, 30.6))
        cuts = [box(p, (X0 + 1.2, mid + 0.4, a), (X1 - 1.2, Y1 + 1, b)) for a, b in shelves]
        cuts.append(box(p, (X0 + 1.2, Y1 - 0.9, -1), (X1 - 1.2, Y1 + 1, 1.5)))  # under the bottom board, set back
        d = np.maximum(outer, -np.minimum.reduce(cuts))
        walls = [box(p, (b * TILE - 0.4, mid, 0), (b * TILE + 0.4, Y1 - 0.15, 30.6)) for b in range(tx0 + 1, tx1)]
        cornice = box(p, (X0 - 0.4, Y0 - 0.4, 30.6), (X1 + 0.4, Y1 + 0.5, CASE_H))
        return np.minimum.reduce([d, cornice] + walls)

    def body(p):
        return bounded(p, (X0 - 0.5, Y0 - 0.5, 0), (X1 + 0.5, Y1 + 0.6, CASE_H), body_detail)

    def body_paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = tones(["#8e5c32", "#a06a3c", "#b07a48"], 1 + value_noise(x * 0.12, z * 1.6 + y * 0.3) * 1.6)
        inside = (y < Y1 - 0.3) & (y > mid + 0.2) & (x > X0 + 1.1) & (x < X1 - 1.1) & (z > 2.25) & (z < 30.55)
        out[inside] = out[inside] * 0.58  # the back of the shelves, in shade
        edge = (y > Y1 - 0.25) & (((z > 13.8) & (z < BOOK_GAP_Z)) | ((z > 1.5) & (z < 2.2)))
        out[edge] = np.minimum(out[edge] * 1.12, 255)
        out[z > CASE_H - 0.15] = tones(["#a06a3c", "#b07a48"], 1 + value_noise(x * 0.1, y * 1.3))[z > CASE_H - 0.15]
        # Along the top, each section's colour, and at the end a label in the last one's.
        band = (y > Y1 + 0.3) & (z > 30.9) & (z < 31.7)
        out[band] = ramps(x[band])[:, 0]
        plate = (x > X1 - 0.05) & (np.abs(y - (Y0 + Y1) / 2) < 3.4) & (np.abs(z - 23) < 2.6)
        out[plate] = RAMPS[SECTION_OF[(tx1 - 1, ty)]][0]
        out[plate & ((np.abs(z - 23) > 2.1) | (np.abs(y - (Y0 + Y1) / 2) > 2.9))] = colour("#f4f1e8")
        return out

    def keep_upper(cx):
        lx = (cx - tx0 * TILE) % TILE
        return (lx > 0.9) & (lx < TILE - 0.9)

    def keep_lower(cx):
        lx = (cx - tx0 * TILE) % TILE
        return (lx > 0.9) & (lx < TILE - 0.9)

    seed = tx0 * 31 + ty * 7
    section = lambda x: np.clip(np.floor(x / TILE).astype(int), tx0, tx1 - 1)
    ramps = lambda x: np.array([RAMPS[SECTION_OF[(tx, ty)]] for tx in range(tx0, tx1)])[section(x) - tx0]
    low_args = (X0 + 1.2, X1 - 1.2, mid + 0.4, Y1 - 0.4, 2.2, seed, 7.5, 11.2, keep_lower)
    high_args = (X0 + 1.2, X1 - 1.2, mid + 0.4, Y1 - 0.4, BOOK_GAP_Z, seed + 101, 8.4, 12.2, keep_upper)

    def books(p):
        return bounded(p, (X0 + 1, mid, 2), (X1 - 1, Y1, 30), lambda q: np.minimum(books_field(q, *low_args), books_field(q, *high_args)))

    def books_colours(p):
        out = books_paint(p, X0 + 1.2, 2.2, seed, 7.5, 11.2, ramps)
        upper = p[:, 2] > BOOK_GAP_Z - 0.05
        out[upper] = books_paint(p[upper], X0 + 1.2, BOOK_GAP_Z, seed + 101, 8.4, 12.2, ramps)
        return out

    # On top, now and then: a plant in a pot, or a few books lying down between bookends.
    tops = []
    for tx in range(tx0, tx1):
        cx, cy = (tx + 0.5) * TILE, (ty + 0.5) * TILE
        kind = (tx * 7 + ty * 3) % 5
        if tx == tx0 or kind == 1:
            tops.append(("plant", cx - 2, cy))
        elif kind == 3:
            tops.append(("pile", cx, cy))

    def top_things(p):
        d = [np.full(len(p), 1e3)]
        for kind, cx, cy in tops:
            if kind == "plant":
                d.append(cylinder(p, cx, cy, 2.4, CASE_H, CASE_H + 3.6))
                d.append(ellipsoid(p, (cx, cy, CASE_H + 6.2), (3.8, 3.4, 3.2)))
                d.append(ellipsoid(p, (cx + 2.2, cy + 1.2, CASE_H + 4.6), (2.4, 2.2, 1.8)))
            else:
                for i, h in enumerate((1.4, 1.2, 1.6)):
                    z = CASE_H + sum((1.4, 1.2, 1.6)[:i])
                    d.append(box(p, (cx - 4.5 + i * 0.4, cy - 3 + i * 0.3, z), (cx + 3.5 + i * 0.4, cy + 3 - i * 0.2, z + h)))
        return np.minimum.reduce(d)

    def tops_paint(p):
        out = np.tile(colour("#3a7a48"), (len(p), 1))
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        leaf = value_noise(x * 1.3, z * 1.3 + y)
        out[:] = tones(["#2e6a3a", "#3e8248", "#5a9a52"], 1 + leaf * 1.8)
        pot = z < CASE_H + 3.65
        out[pot] = colour("#c8643c")
        out[pot & (z > CASE_H + 3)] = colour("#a84e2e")
        for kind, cx, cy in tops:
            if kind == "pile":
                near = (np.abs(x - cx) < 5.5) & (np.abs(y - cy) < 4)
                layer = np.clip(((z - CASE_H) / 1.4).astype(int), 0, 2)
                pile = near & (z < CASE_H + 4.3)
                out[pile] = np.array([colour("#2f5fa8"), colour("#a8372d"), colour("#d8a02a")])[layer[pile]]
                out[pile & (np.abs(y - cy) < 2.6) & (x > cx + 3.2)] = colour("#efe6cc")
        return out

    occluder = ((X0, Y0, 0), (X1, Y1, CASE_H))
    return [(body, body_paint, False, "K"), (books, books_colours, False, "K"), (top_things, tops_paint, False, "K")], [occluder]


# ------------------------------------------------------------------ tables
def table_parts(run):
    tx0, tx1, ty = run
    X0, X1 = tx0 * TILE + 0.5, tx1 * TILE - 0.5
    Y0, Y1 = ty * TILE + 1.5, ty * TILE + 14.5
    legs_x = [X0 + 1.6] + [b * TILE for b in range(tx0 + 4, tx1 - 1, 4)] + [X1 - 1.6]
    chairs = [(tx + 0.5) * TILE for tx in range(tx0, tx1)]
    lamps = [x for x, y in READING_LAMPS if y // TILE == ty and tx0 * TILE < x < tx1 * TILE]
    back = ty * TILE

    def table_detail(p):
        d = [box(p, (X0, Y0, TABLE_TOP - 1.2), (X1, Y1, TABLE_TOP)), box(p, (X0 + 1, Y0 + 1, TABLE_TOP - 2.6), (X1 - 1, Y1 - 1, TABLE_TOP - 1.2))]
        for lx in legs_x:
            for ly in (Y0 + 1.6, Y1 - 1.6):
                d.append(box(p, (lx - 0.8, ly - 0.8, 0), (lx + 0.8, ly + 0.8, TABLE_TOP - 1.2)))
        return np.minimum.reduce(d)

    def chair_detail(p):
        d = []
        for cx in chairs:
            d += [box(p, (cx - 4, back + 0.8, 5.4), (cx + 4, back + 7.4, 6.6)),  # the seat, part under the table
                  box(p, (cx - 4, back + 0.2, 8.4), (cx + 4, back + 1.0, 15)),  # the back, above the table
                  box(p, (cx - 4, back + 0.2, 0), (cx - 3, back + 1.2, 15)), box(p, (cx + 3, back + 0.2, 0), (cx + 4, back + 1.2, 15)),
                  box(p, (cx - 4, back + 6.4, 0), (cx - 3, back + 7.4, 5.4)), box(p, (cx + 3, back + 6.4, 0), (cx + 4, back + 7.4, 5.4))]
        return np.minimum.reduce(d)

    def lamp_detail(p):
        d = [np.full(len(p), 1e3)]
        for cx in lamps:
            ly = back + 4.2
            d.append(cylinder(p, cx, ly, 2.2, TABLE_TOP, TABLE_TOP + 0.7))
            d.append(cylinder(p, cx, ly, 0.45, TABLE_TOP, TABLE_TOP + 6.4))
            # The shade, half a tube lying along the table, open underneath.
            q = p - np.array((cx, ly + 1.2, TABLE_TOP + 6.2))
            tube = np.maximum(np.abs(np.hypot(q[:, 1], q[:, 2]) - 2.3) - 0.3, np.abs(q[:, 0]) - 4.4)
            d.append(np.maximum(tube, -q[:, 2] - 0.2))
        return np.minimum.reduce(d)

    def glow_detail(p):
        d = [np.full(len(p), 1e3)]
        for cx in lamps:
            d.append(box(p, (cx - 4.1, back + 4.2 + 1.2 - 1.9, TABLE_TOP + 5.6), (cx + 4.1, back + 4.2 + 1.2 + 1.9, TABLE_TOP + 6.1)))
        return np.minimum.reduce(d)

    low, high = (X0 - 0.5, back, 0), (X1 + 0.5, Y1 + 0.5, TABLE_TOP + 9)
    table = lambda p: bounded(p, (X0, Y0, 0), (X1, Y1, TABLE_TOP), table_detail)
    chair = lambda p: bounded(p, (X0 - 0.5, back, 0), (X1 + 0.5, back + 7.5, 15), chair_detail)
    lamp = lambda p: bounded(p, (X0, back, TABLE_TOP), (X1, back + 9, TABLE_TOP + 9), lamp_detail)
    glow = lambda p: bounded(p, (X0, back, TABLE_TOP), (X1, back + 9, TABLE_TOP + 9), glow_detail)

    def table_paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = tones(["#b88850", "#c89a60", "#d8ac70"], 1 + value_noise(x * 0.08, y * 0.9) * 1.6)
        out[(z < TABLE_TOP - 0.25) & (z > TABLE_TOP - 1.25)] = colour("#9a6a3a")
        out[z < TABLE_TOP - 1.2] = colour("#7a5030")
        out[((x - X0) % TILE < 0.15) & (z > TABLE_TOP - 0.1)] = out[((x - X0) % TILE < 0.15) & (z > TABLE_TOP - 0.1)] * 0.9
        return out

    def chair_paint(p):
        x, z = p[:, 0], p[:, 2]
        out = tones(["#9a3a2e", "#b04434", "#c25a44"], 1 + value_noise(x * 0.4, z * 0.4) * 1.2)  # red upholstered seat and back
        frame = (z < 5.4) | ((z < 8.4) & (p[:, 1] < back + 1.3)) | (np.abs(((x - X0) % TILE) - 8) > 3.05)
        out[frame] = tones(["#6a4428", "#7a5030"], 1 + value_noise(x, z))[frame]
        return out

    def lamp_paint(p):
        z = p[:, 2]
        out = np.tile(colour("#c8a050"), (len(p), 1))  # brass
        shade = z > TABLE_TOP + 5.6
        out[shade] = tones(["#1f5a38", "#2a7046", "#3a8a58"], 1 + value_noise(p[:, 0] * 0.8, z * 2) * 1.4)[shade]
        return out

    parts = [(table, table_paint, False, "D"), (chair, chair_paint, False, "D"), (lamp, lamp_paint, False, "D"), (glow, solid("#fff0c0"), True, "D")]
    occluders = [((X0, Y0, TABLE_TOP - 2.6), (X1, Y1, TABLE_TOP))] + [((lx - 0.8, ly - 0.8, 0), (lx + 0.8, ly + 0.8, TABLE_TOP)) for lx in legs_x[::2] for ly in (Y0 + 1.6, Y1 - 1.6)]
    occluders += [((X0, back + 0.2, 8.4), (X1, back + 1, 15))]
    return parts, occluders


# ------------------------------------------------------------- the counter
COUNTER_TOP = 12.6


def counter_parts():
    ty0, ty1, tx = COUNTER
    X0, X1 = tx * TILE + 1, (tx + 1) * TILE - 1
    Y0, Y1 = ty0 * TILE + 0.5, ty1 * TILE - 0.5
    monitor_y = (ty0 + 1.2) * TILE

    def body_detail(p):
        d = np.maximum(box(p, (X0, Y0, 0), (X1, Y1, COUNTER_TOP - 1)), -box(p, (X1 - 4, Y0 + 2, 2), (X1 + 1, Y1 - 2, COUNTER_TOP - 2.5)))
        d = np.minimum.reduce([d, box(p, (X0 - 0.6, Y0 - 0.6, COUNTER_TOP - 1), (X1 + 0.6, Y1 + 0.6, COUNTER_TOP)),
                               box(p, (X0 - 0.6, Y0 - 0.6, COUNTER_TOP), (X0 + 1.4, Y1 + 0.6, COUNTER_TOP + 4.6)),  # a higher ledge on the visitors' side
                               box(p, (X1 - 4, (ty0 + 2) * TILE - 0.5, 2), (X1 - 0.3, (ty0 + 2) * TILE + 0.5, COUNTER_TOP - 2.5))])
        return d

    def things_detail(p):
        d = [box(p, (X0 + 4, monitor_y - 6, COUNTER_TOP), (X0 + 6, monitor_y + 6, COUNTER_TOP + 9)),  # the screen
             box(p, (X0 + 4.4, monitor_y - 1.5, COUNTER_TOP), (X0 + 7, monitor_y + 1.5, COUNTER_TOP + 1)),
             box(p, (X0 + 8, monitor_y - 5, COUNTER_TOP), (X0 + 11.5, monitor_y + 5, COUNTER_TOP + 0.7))]  # the keyboard
        # Books handed back, waiting to go on the shelves.
        by = (ty0 + 2.7) * TILE
        for i, h in enumerate((1.6, 1.2, 1.8, 1.3)):
            z = COUNTER_TOP + sum((1.6, 1.2, 1.8, 1.3)[:i])
            d.append(box(p, (X0 + 3 + i * 0.3, by - 4 + i * 0.4, z), (X0 + 11 + i * 0.2, by + 4 - i * 0.3, z + h)))
        # A stamp, and a little bell.
        sy = (ty0 + 3.5) * TILE
        d.append(cylinder(p, X0 + 7, sy, 1.3, COUNTER_TOP, COUNTER_TOP + 1))
        d.append(cylinder(p, X0 + 7, sy, 0.5, COUNTER_TOP + 1, COUNTER_TOP + 3.4))
        d.append(ellipsoid(p, (X0 + 7, sy, COUNTER_TOP + 3.8), (1, 1, 0.8)))
        bell = np.maximum(ellipsoid(p, (X0 + 7, sy + 5, COUNTER_TOP), (1.8, 1.8, 1.8)), COUNTER_TOP - p[:, 2])
        d.append(bell)
        # A potted plant at the far end.
        py = Y0 + 4
        d.append(cylinder(p, X0 + 7, py, 2.2, COUNTER_TOP, COUNTER_TOP + 3.4))
        d.append(ellipsoid(p, (X0 + 7, py, COUNTER_TOP + 6), (3.4, 3.2, 3)))
        return np.minimum.reduce(d)

    def inside_detail(p):
        """Books and boxes on the shelves under the counter, on the librarian's side."""
        d = [np.full(len(p), 1e3)]
        for i, (a, b) in enumerate(((Y0 + 2.4, Y0 + 12), (Y0 + 13, Y0 + 22), (ty0 * TILE + 33, ty0 * TILE + 42), (ty0 * TILE + 43, ty0 * TILE + 52), (ty0 * TILE + 53, Y1 - 2.4))):
            d.append(box(p, (X1 - 3.6, a, 2), (X1 - 0.8, b, 2 + 4 + (i % 3) * 1.6)))
        return np.minimum.reduce(d)

    body = lambda p: bounded(p, (X0 - 0.6, Y0 - 0.6, 0), (X1 + 0.6, Y1 + 0.6, COUNTER_TOP + 4.6), body_detail)
    things = lambda p: bounded(p, (X0, Y0, COUNTER_TOP), (X1, Y1, COUNTER_TOP + 10), things_detail)
    inside = lambda p: bounded(p, (X1 - 4, Y0, 2), (X1, Y1, 10), inside_detail)

    def body_paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = tones(["#8e5c32", "#a06a3c", "#b07a48"], 1 + value_noise(y * 0.1, z * 1.4) * 1.6)
        out[(z > COUNTER_TOP - 1.05) & (z < COUNTER_TOP + 0.05) & (x > X0 + 1.35)] = colour("#d8c8a8")  # a pale top
        panel = (x > X1 + 0.5) & (z > 1.5) & (z < COUNTER_TOP - 1.5) & (((y - Y0) % 16) > 1)
        out[panel & ((y - Y0) % 16 < 1.6)] = out[panel & ((y - Y0) % 16 < 1.6)] * 0.8
        out[(z > COUNTER_TOP + 3.9)] = colour("#c8a070")
        return out

    def things_paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = np.tile(colour("#30343a"), (len(p), 1))
        screen = (x > X0 + 5.9) & (np.abs(y - monitor_y) < 5.4) & (z > COUNTER_TOP + 1.4) & (z < COUNTER_TOP + 8.4)
        out[screen] = colour("#9ccfe8")
        out[screen & (((z * 1.7) % 1.4) < 0.3) & (np.abs(y - monitor_y + 1) < 3)] = colour("#e8f4fa")
        keys = (x > X0 + 7.9) & (z < COUNTER_TOP + 0.75) & (np.abs(y - monitor_y) < 5.1)
        out[keys] = colour("#d8dadc")
        out[keys & ((((x * 1.4) % 1) < 0.2) | (((y * 1.4) % 1) < 0.2))] = colour("#8a8e94")
        by = (ty0 + 2.7) * TILE
        pile = (np.abs(y - by) < 4.6) & (z < COUNTER_TOP + 6) & (x > X0 + 2.9)
        layer = np.clip(((z - COUNTER_TOP) / 1.5).astype(int), 0, 3)
        out[pile] = np.array([colour("#3a7a48"), colour("#d8a02a"), colour("#a8372d"), colour("#2f5fa8")])[layer[pile]]
        out[pile & (x > X0 + 10.6)] = colour("#efe6cc")
        sy = (ty0 + 3.5) * TILE
        out[(np.abs(y - sy) < 1.5) & (z > COUNTER_TOP + 0.95)] = colour("#7a4a2a")
        out[(np.abs(y - sy) < 1.5) & (z < COUNTER_TOP + 1)] = colour("#2a2a36")
        out[np.hypot(x - X0 - 7, y - sy - 5) < 2] = colour("#d8dce0")
        py = Y0 + 4
        plant = np.hypot(x - X0 - 7, y - py) < 4
        out[plant] = tones(["#2e6a3a", "#3e8248", "#5a9a52"], 1 + value_noise(x * 1.3, z * 1.3) * 1.8)[plant]
        out[plant & (z < COUNTER_TOP + 3.45)] = colour("#e8e4dc")
        return out

    def inside_paint(p):
        y, z = p[:, 1], p[:, 2]
        j = np.floor((y - Y0) / 1.3)
        return np.array(SPINES)[(hashed(j, 5) * len(SPINES)).astype(int) % len(SPINES)] * np.where(z > 7.6, 0.85, 1)[..., None]

    parts = [(body, body_paint, False, "k"), (things, things_paint, False, "k"), (inside, inside_paint, False, "k")]
    return parts, [((X0, Y0, 0), (X1, Y1, COUNTER_TOP)), ((X0 - 0.6, Y0, COUNTER_TOP), (X0 + 1.4, Y1, COUNTER_TOP + 4.6))]


# ---------------------------------------------------------- in the corners
def plant_field(p, cx, cy):
    d = [cylinder(p, cx, cy, 4.6, 0, 9), cylinder(p, cx, cy, 5.1, 8, 9.4)]
    d.append(cylinder(p, cx + 0.5, cy, 0.7, 9, 22))
    for i in range(9):
        a = i * 2.4
        r = 2.5 + (i % 3) * 1.5
        d.append(ellipsoid(p, (cx + np.cos(a) * r, cy + np.sin(a) * r, 16 + i * 2.1), (3.6, 3.2, 2.2)))
    return np.minimum.reduce(d)


def globe_field(p, cx, cy):
    d = [cylinder(p, cx, cy, 3.6, 0, 1.2), cylinder(p, cx, cy, 0.6, 1.2, 10), ellipsoid(p, (cx, cy, 16), (5, 5, 5))]
    ring = np.maximum(np.abs(np.hypot(p[:, 0] - cx, p[:, 2] - 16) - 5.8) - 0.35, np.abs(p[:, 1] - cy) - 0.35)
    d.append(ring)
    return np.minimum.reduce(d)


def corner_parts():
    things = [((x + 0.5) * TILE, (y + 0.5) * TILE, "globe" if y > ROOM.height / 2 else "plant") for x, y in CORNERS]

    def field(p):
        return np.minimum.reduce([bounded(p, (cx - 8, cy - 8, 0), (cx + 8, cy + 8, 36), (lambda q, cx=cx, cy=cy, kind=kind: (globe_field if kind == "globe" else plant_field)(q, cx, cy))) for cx, cy, kind in things])

    def paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = tones(["#2e6a3a", "#3e8248", "#5a9a52", "#6aa85a"], 1 + value_noise(x * 0.9, z * 0.9 + y * 0.5) * 2.6)
        for cx, cy, kind in things:
            near = np.hypot(x - cx, y - cy) < 9
            if kind == "plant":
                pot = near & (z < 9.45)
                out[pot] = tones(["#a84e2e", "#c8643c"], 1 + value_noise(z * 2, x))[pot]
                out[pot & (z > 8.05)] = colour("#d87850")
                out[near & (z > 8.9) & (z < 9.3) & (np.hypot(x - cx, y - cy) < 4.4)] = colour("#4a3424")  # the soil
                stem = near & (np.hypot(x - cx - 0.5, y - cy) < 0.9) & (z > 9) & (z < 15)
                out[stem] = colour("#6a5038")
            else:
                ball = near & (np.linalg.norm(p - np.array((cx, cy, 16)), axis=1) < 5.2)
                land = value_noise(np.arctan2(y[ball] - cy, x[ball] - cx) * 2.2 + 7, z[ball] * 0.55) > 0.56
                out[ball] = colour("#3a78b8")
                idx = np.nonzero(ball)[0][land]
                out[idx] = np.array([colour("#6aa85a"), colour("#c8b078")])[(value_noise(x[idx] * 0.7, z[idx] * 0.7) > 0.6).astype(int)]
                metal = near & ~ball & (z > 1.2)
                out[metal] = colour("#c8a050")
                out[near & (z <= 1.2)] = colour("#5a3a22")
        return out

    occluders = [((cx - 4.6, cy - 4.6, 0), (cx + 4.6, cy + 4.6, 30 if kind == "plant" else 21)) for cx, cy, kind in things]
    return [(field, paint, False, "n")], occluders


# ---------------------------------------------------------------- the walls
def _sign():
    picture = Image.new("RGB", (640, 96), "#5a3a22")
    draw = ImageDraw.Draw(picture)
    draw.rectangle((4, 4, 635, 91), outline="#c8a050", width=4)
    draw.text((320, 50), "GIRJERÁJUS", font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 62), fill="#f4e8c8", anchor="mm")
    return np.array(picture)


def _painting(night):
    """A landscape of fells, by day with a lake, or under the northern lights. Made up, not of any one place."""
    w, h = 240, 180
    x, y = np.meshgrid(np.arange(w) / w, np.arange(h) / h)
    if night:
        sky = np.array([24, 34, 70]) * (1 - y[..., None]) + np.array([40, 70, 110]) * y[..., None]
        aurora = np.exp(-((y - 0.25 - 0.08 * np.sin(x * 9)) / 0.06) ** 2)[..., None] * np.array([80, 200, 120])
        image = sky + aurora
    else:
        image = np.array([150, 200, 235]) * (1 - y[..., None]) + np.array([230, 240, 245]) * y[..., None]
    far = 0.52 - 0.12 * np.exp(-((x - 0.35) / 0.18) ** 2) - 0.06 * np.exp(-((x - 0.8) / 0.12) ** 2)
    near = 0.7 - 0.1 * np.exp(-((x - 0.6) / 0.25) ** 2)
    image[(y > far) & (y <= near)] = [70, 80, 110] if night else [130, 150, 170]
    image[y > near] = [40, 60, 60] if night else [80, 120, 70]
    if not night:
        image[(y > 0.8) & (y < 0.92)] = [110, 160, 200]
    return np.clip(image, 0, 255)


SIGN, DAY, NIGHT = _sign(), _painting(False), _painting(True)
WALL_CASES = [(2.4 * TILE, 11.6 * TILE), (16.4 * TILE, 25.6 * TILE)]
WALL_CASE_H = 40
WALL_SHELVES = [(2.2, 11.8), (12.6, 21.8), (22.6, 31.4), (32.2, 39.2)]
SIGN_AT = (12.2 * TILE, 15.8 * TILE, 33, 41)  # from x, to x, from z, to z
BOARD_AT = (12.4 * TILE, 15.6 * TILE, 12, 30)


def wall_case_body(p):
    y0 = ROOM.y0
    d = []
    for a, b in WALL_CASES:
        outer = box(p, (a, y0, 0), (b, y0 + 2.4, WALL_CASE_H))
        cuts = [box(p, (a + 1, y0 + 0.3, lo), (b - 1, y0 + 3, hi)) for lo, hi in WALL_SHELVES]
        d.append(np.maximum(outer, -np.minimum.reduce(cuts)))
        d += [box(p, (x - 0.4, y0, 0), (x + 0.4, y0 + 2.3, WALL_CASE_H)) for x in np.arange(a + 2 * TILE, b - 4, 2 * TILE)]
        d.append(box(p, (a - 0.4, y0, WALL_CASE_H), (b + 0.4, y0 + 2.8, WALL_CASE_H + 1.4)))
    sx0, sx1, sz0, sz1 = SIGN_AT
    d.append(box(p, (sx0, y0, sz0), (sx1, y0 + 0.9, sz1)))
    bx0, bx1, bz0, bz1 = BOARD_AT
    d.append(box(p, (bx0, y0, bz0), (bx1, y0 + 0.6, bz1)))
    return np.minimum.reduce(d)


def wall_case_paint(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    out = tones(["#8e5c32", "#a06a3c", "#b07a48"], 1 + value_noise(x * 0.12, z * 1.6) * 1.6)
    deep = y < ROOM.y0 + 0.35
    out[deep] = out[deep] * 0.6
    sx0, sx1, sz0, sz1 = SIGN_AT
    sign = (x > sx0) & (x < sx1) & (z > sz0) & (z < sz1) & (y > ROOM.y0 + 0.85)
    out[sign] = texture(SIGN, (x[sign] - sx0) / (sx1 - sx0), (sz1 - z[sign]) / (sz1 - sz0))
    bx0, bx1, bz0, bz1 = BOARD_AT
    board = (x > bx0) & (x < bx1) & (z > bz0) & (z < bz1) & (y > ROOM.y0 + 0.55) & (z < sz0 - 0.5)
    out[board] = tones(["#b08a58", "#c49a64"], 1 + value_noise(x * 1.4, z * 1.4))[board]
    cards = np.array([colour(c) for c in ("#f8f6ee", "#fce6a0", "#d8ecf8", "#f8d8e0", "#dcecc8")])
    for i, (cx, cz) in enumerate(((12.9, 25.5), (13.8, 26.4), (14.8, 25.2), (13.2, 17.5), (14.4, 18.2), (15.2, 16.4))):
        sheet = board & (np.abs(x - cx * TILE) < 6.2) & (np.abs(z - cz) < 3.6)
        out[sheet] = cards[i % 5]
        out[sheet & (np.hypot(x - cx * TILE + (i % 3 - 1) * 1.5, z - cz - 0.4) < 2)] = cards[(i + 2) % 5] * 0.72
        out[sheet & (np.abs(z - cz + 2 + (x - cx * TILE) * 0.06) < 0.45)] = colour("#3a8a48") if i % 2 else colour("#2f5fa8")
    return out


def wall_books(p):
    y0 = ROOM.y0
    d = [np.full(len(p), 1e3)]
    for k, (a, b) in enumerate(WALL_CASES):
        for s, (lo, hi) in enumerate(WALL_SHELVES):
            keep = lambda cx, a=a: ((cx - a) % (2 * TILE) > 1.2) & ((cx - a) % (2 * TILE) < 2 * TILE - 1.2)
            d.append(bounded(p, (a + 1, y0, lo), (b - 1, y0 + 2.2, hi), lambda q, a=a, b=b, lo=lo, s=s, k=k, keep=keep: books_field(q, a + 1, b - 1, y0 + 0.3, y0 + 2.2, lo, 500 + k * 40 + s, 5.6, 8.6, keep)))
    return np.minimum.reduce(d)


def wall_books_paint(p):
    out = np.zeros((len(p), 3))
    z = p[:, 2]
    for k, (a, b) in enumerate(WALL_CASES):
        for s, (lo, hi) in enumerate(WALL_SHELVES):
            on = (p[:, 0] > a) & (p[:, 0] < b) & (z > lo - 0.05) & (z < hi)
            if on.any():
                out[on] = books_paint(p[on], a + 1, lo, 500 + k * 40 + s, 5.6, 8.6)
    return out


def library_wall_x(p):
    """The window wall: oak panelling below, plaster above, and between the windows two paintings and a clock."""
    y, z = p[:, 1], p[:, 2]
    out = np.tile(colour("#efe3c8"), (len(p), 1)) * (0.97 + value_noise(y * 0.08, z * 0.08)[..., None] * 0.05)
    panel = z < 12
    out[panel] = tones(["#8e5c32", "#a06a3c"], 1 + value_noise(y * 0.1, z * 1.2))[panel]
    out[panel & (((y + 300) % 12) < 0.4)] = out[panel & (((y + 300) % 12) < 0.4)] * 0.75
    out[(z > 11.4) & (z < 12.6)] = colour("#c8a070")
    out[z < 1.8] = colour("#5a3a22")
    out[z > WALL_H - 1.6] = colour("#fbf7e8")
    out[ROOM.window_hole_x(p) < 1.5] = colour("#f6f2e6")
    for (a, b), image in (((6.4, 8.6), DAY), ((12.4, 14.6), NIGHT)):
        u, v = (y - a * TILE) / ((b - a) * TILE), (30 - z) / 13
        frame = (u > -0.05) & (u < 1.05) & (v > -0.07) & (v < 1.07)
        out[frame] = colour("#c8a050")
        on = (u > 0) & (u < 1) & (v > 0) & (v < 1)
        out[on] = texture(image, u[on], v[on])
    d = np.hypot(y - 13.5 * TILE, z - 37)
    out[d < 3.6] = colour("#3b2a1a")
    out[d < 3.0] = colour("#fbf7e8")
    angle = np.arctan2(y - 13.5 * TILE, z - 37)
    out[(d < 2.5) & (np.abs(angle - 0.55) < 0.14)] = colour("#1a1a1a")
    out[(d < 1.8) & (np.abs(angle + 1.4) < 0.2)] = colour("#1a1a1a")
    return out


def library_wall_y(p):
    x, z = p[:, 0], p[:, 2]
    out = np.tile(colour("#efe3c8"), (len(p), 1)) * (0.97 + value_noise(x * 0.08, z * 0.08)[..., None] * 0.05)
    out[z < 1.8] = colour("#5a3a22")
    out[z > WALL_H - 1.6] = colour("#fbf7e8")
    return out


# ------------------------------------------------------------------ the floor
def floor_paint(p):
    """Oak parquet in a chevron, and a warm red rug under the reading tables, its border in the Sámi flag's colours."""
    x, y = p[:, 0], p[:, 1]
    strip = np.floor(x / 8)
    lx = x - strip * 8
    way = np.where(strip % 2 == 0, 1, -1)
    along = y + way * lx
    board = np.floor(along / 3.2)
    tone = hashed(board.astype(int), strip.astype(int))
    grain = value_noise((along - way * lx * 2) * 0.3, lx * 1.6)
    out = np.tile(colour("#b98a58"), (len(p), 1)) * (0.82 + tone[..., None] * 0.2 + grain[..., None] * 0.08)
    seam = ((along % 3.2) < 0.22) | (lx < 0.22)
    out[seam] = out[seam] * 0.74
    # The rug.
    rx0, ry0, rx1, ry1 = 4.3 * TILE, 12.7 * TILE, 23.7 * TILE, 19.7 * TILE
    inner = np.minimum.reduce([x - rx0, y - ry0, rx1 - x, ry1 - y])
    rug = inner > 0
    fibre = 0.92 + value_noise(x * 2.4, y * 2.4)[..., None] * 0.12
    field = np.tile(colour("#7a2c26"), (len(p), 1))
    diamond = (np.abs(((x - rx0) % 24) - 12) + np.abs(((y - ry0) % 16) - 8)) % 8 < 0.9
    field[diamond] = colour("#b8863a")
    field[(np.abs(((x - rx0) % 24) - 12) + np.abs(((y - ry0) % 16) - 8)) < 2.2] = colour("#2a4a80")
    for low, high, tone_ in ((0, 3, "#2a4a80"), (3, 3.8, "#e8b830"), (3.8, 4.6, "#2a7a48"), (4.6, 7.4, "#2a4a80")):
        band = (inner >= low) & (inner < high)
        field[band] = colour(tone_)
    out[rug] = (field * fibre)[rug]
    fringe = (inner > -1.4) & (inner <= 0) & ((x < rx0 + 0.1) | (x > rx1 - 0.1)) & (((y * 1.5) % 1) < 0.5)
    out[fringe] = colour("#efe6cc")
    return out


# --------------------------------------------------------------- all of it
def assemble():
    ROOM.pools = [(x, y, TABLE_TOP + 5.7) for x, y in READING_LAMPS]
    ROOM.lamps = READING_LAMPS + [((COUNTER[2] + 0.5) * TILE, (COUNTER[0] + 1.2) * TILE)]
    ROOM.floor = floor_paint
    ROOM.wall_paint_x, ROOM.wall_paint_y = library_wall_x, library_wall_y
    for maker in [lambda run=run: case_parts(run) for run in CASE_RUNS] + [lambda run=run: table_parts(run) for run in TABLE_RUNS] + [counter_parts, corner_parts]:
        parts, occluders = maker()
        for field, paint, glows, letters in parts:
            ROOM.add(field, paint, letters, glows)
        ROOM.occluders += occluders
    ROOM.add(wall_case_body, wall_case_paint, ROOM.walls_at)
    ROOM.add(wall_books, wall_books_paint, ROOM.walls_at)
    ROOM.occluders += [((a, ROOM.y0, 0), (b, ROOM.y0 + 2.4, WALL_CASE_H)) for a, b in WALL_CASES]


assemble()

if __name__ == "__main__":
    make(["library"], int(sys.argv[1]) if sys.argv[1:] else 6)
