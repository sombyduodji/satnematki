#!/usr/bin/env python3
"""Make the general store, Rautakauppa, in 3D, into art/gearstore/, with tools/rooms3d.py.

It's L-shaped: a hall with pegboards for tools and fishing gear, clothes rails and the till, and through a wide opening a showroom with
big things on low platforms under its windows. The things for sale are the game's own models and hang where these are made for them:
on a pegboard in front of its board (IN_FRONT and RAISED in src/world.js), from a rail by their hangers (RAIL_Z), or on a platform's
top. Every thing has its own place, stocked on several tiles (stock in tools/make_map.py). Nothing else on the fixtures looks like what can be bought, so it isn't mistaken for it.

Usage: python3 tools/make_gearstore.py [workers]
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402
from make_home import B, R, T  # noqa: E402
from rooms3d import TILE, Room, TileBoxes, box, low_walls_of, make, tones  # noqa: E402

WALL_H = 44
SUN = (-0.8, -0.45, 0.4)
RAIL_Z = 30.8  # where the hangers of the clothes in src/models.js meet, on RAISED.clothes in src/world.js
BOARD_TOP = 30
BASE_TOP = 3  # the pegboards' and platforms' tops: RAISED in src/world.js
ROOM = Room("gearstore", wall_h=WALL_H, sun=SUN, windows_x=[(4, 7), (10, 13), (15, 18)], windows_y=[(32, 34), (37, 39), (42, 44)],
            win_low=14, win_high=36, transom=28, walls="Wo", low="X", ambient=0.74, lamp_tone=(1.1, 1.03, 0.9), lamp_strength=0.16,
            sun_tone=(1.36, 1.16, 0.88))
ROWS = ROOM.map
LETTER = np.array([list(r) for r in ROWS])


def letter_at(x, y):
    return LETTER[np.clip((y // TILE).astype(int), 0, ROOM.height - 1), np.clip((x // TILE).astype(int), 0, ROOM.width - 1)]


# ------------------------------------------------------------------ fixtures
def pegboard_parts(run):
    tx0, tx1, ty = run
    X0, X1, cy = tx0 * TILE + 0.4, tx1 * TILE - 0.4, (ty + 0.5) * TILE

    def body(p):
        d = [box(p, (X0, cy - 5, 0), (X1, cy + 5, BASE_TOP)),  # a low base, with boxes on it
             box(p, (X0, cy - 0.8, BASE_TOP), (X1, cy + 0.8, BOARD_TOP)),  # the board
             box(p, (X0 - 0.6, cy - 1.4, BOARD_TOP), (X1 + 0.6, cy + 1.4, BOARD_TOP + 1.4)),  # its top
             box(p, (X0 - 0.6, cy - 1.2, BASE_TOP), (X0 + 0.8, cy + 1.2, BOARD_TOP)), box(p, (X1 - 0.8, cy - 1.2, BASE_TOP), (X1 + 0.6, cy + 1.2, BOARD_TOP))]
        return np.minimum.reduce(d)

    def paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = tones(["#b88a58", "#c49a64", "#cfa670"], 1 + value_noise(x * 0.3, z * 0.3) * 1.9)
        board = (np.abs(y - cy) > 0.7) & (z > BASE_TOP) & (z < BOARD_TOP)
        holes = board & (((x + 300) % 2) < 0.55) & ((z % 2) < 0.55)
        out[holes] = colour("#5a3e24")
        frame = (z >= BOARD_TOP) | (x < X0 + 0.8) | (x > X1 - 0.8)
        out[frame] = colour("#3a6a9a")  # the shop's blue
        base = z <= BASE_TOP
        out[base] = tones(["#5a6670", "#66727c"], 1 + value_noise(x * 0.2, y))[base]
        out[base & (np.abs(z - BASE_TOP + 0.5) < 0.25)] = colour("#e8b830")  # a strip for the price tags
        return out

    def hooks(p):
        """A peg in each tile, where a thing hangs, and its price tag below."""
        d = [np.full(len(p), 1e3)]
        for tx in range(tx0, tx1):
            c = (tx + 0.5) * TILE
            for side in (-1, 1):
                d.append(T((c, cy + side * 0.8, 21.5), (c, cy + side * 3.2, 22.6), 0.3, 0.3, "#8c9198").field(p))
                d.append(box(p, (c - 1.4, cy + side * 0.8 - 0.1 * (side < 0), 4), (c + 1.4, cy + side * 0.8 + 0.1 * (side > 0) + 0.15, 6)))
        return np.minimum.reduce(d)

    def hook_paint(p):
        out = np.tile(colour("#8c9198"), (len(p), 1))
        out[p[:, 2] < 6.2] = colour("#f8f4ea")
        return out

    return [(body, paint, False, "O"), (hooks, hook_paint, False, "O")], [((X0, cy - 5, 0), (X1, cy + 5, BASE_TOP)), ((X0, cy - 0.8, 0), (X1, cy + 0.8, BOARD_TOP))]


def rail_parts(run):
    tx0, tx1, ty = run
    X0, X1, cy = tx0 * TILE + 1, tx1 * TILE - 1, (ty + 0.5) * TILE

    def body(p):
        d = [T((X0, cy, RAIL_Z), (X1, cy, RAIL_Z), 0.55, 0.55, "#c9ced4").field(p)]
        for x in (X0, X1) + tuple(b * TILE for b in range(tx0 + 3, tx1 - 1, 3)):
            d.append(T((x, cy, 0.5), (x, cy, RAIL_Z), 0.5, 0.5, "#c9ced4").field(p))
            d.append(R(x - 1.6, x + 1.6, cy - 6, cy + 6, 0, 1, 0.4, "#5a616a").field(p))
        # A low shelf for boots and shoes, and a sign along the top.
        d.append(box(p, (X0, cy - 5, 3.2), (X1, cy + 5, 4)))
        return np.minimum.reduce(d)

    def paint(p):
        z = p[:, 2]
        out = np.tile(colour("#c9ced4"), (len(p), 1))
        out[z < 1.05] = colour("#5a616a")
        shelf = (z > 3.15) & (z < 4.05)
        out[shelf] = tones(["#8a6a48", "#9a7a58"], 1 + value_noise(p[shelf, 0] * 0.2, p[shelf, 1]))
        return out

    def hangers(p):
        """Empty hangers here and there along the rail, between the places things hang."""
        d = [np.full(len(p), 1e3)]
        for tx in range(tx0, tx1):
            for dx in (-5.6, 5.6):
                c = (tx + 0.5) * TILE + dx
                d.append(T((c, cy, RAIL_Z - 0.3), (c, cy, RAIL_Z - 2), 0.22, 0.22, "#8c9198").field(p))
                d.append(T((c - 4, cy, RAIL_Z - 3.6), (c, cy, RAIL_Z - 2), 0.3, 0.3, "#d8b884").field(p))
                d.append(T((c + 4, cy, RAIL_Z - 3.6), (c, cy, RAIL_Z - 2), 0.3, 0.3, "#d8b884").field(p))
        return np.minimum.reduce(d)

    def hanger_paint(p):
        out = np.tile(colour("#d8b884"), (len(p), 1))
        out[p[:, 2] > RAIL_Z - 2.1] = colour("#8c9198")
        return out

    return [(body, paint, False, "U"), (hangers, hanger_paint, False, "U")], [((X0, cy - 0.6, RAIL_Z - 0.6), (X1, cy + 0.6, RAIL_Z + 0.6)), ((X0, cy - 5, 3.2), (X1, cy + 5, 4))]


def platform_parts(run):
    tx0, tx1, ty = run
    X0, X1, Y0, Y1 = tx0 * TILE + 0.8, tx1 * TILE - 0.8, ty * TILE + 0.8, (ty + 1) * TILE - 0.8

    def body(p):
        return np.minimum(R(X0, X1, Y0, Y1, 0, BASE_TOP - 0.6, 0.5, "#7a5232").field(p), R(X0 + 0.6, X1 - 0.6, Y0 + 0.6, Y1 - 0.6, BASE_TOP - 0.7, BASE_TOP, 0.3, "#3a6a9a").field(p))

    def paint(p):
        z = p[:, 2]
        out = tones(["#8a6038", "#9a6c40", "#a87a4a"], 1 + value_noise(p[:, 0] * 0.15, z * 1.4 + p[:, 1] * 0.2) * 1.9)
        top = z > BASE_TOP - 0.75
        out[top] = tones(["#34608c", "#3a6a9a"], 1 + value_noise(p[top, 0] * 1.4, p[top, 1] * 1.4))
        return out

    def sign(p):
        """A small stand at the front corner with the price on it."""
        sx, sy = X1 - 2, Y1 + 0.4
        return np.minimum(T((sx, sy, 0), (sx, sy, 7), 0.3, 0.3, "#3a3e44").field(p), box(p, (sx - 2.6, sy - 0.3, 7), (sx + 2.6, sy + 0.3, 10.5)))

    def sign_paint(p):
        out = np.tile(colour("#3a3e44"), (len(p), 1))
        face = p[:, 2] > 7
        out[face] = colour("#f8f4ea")
        out[face & (np.abs(p[:, 2] - 8.8) < 0.6) & (np.abs(p[:, 0] - X1 + 2) < 1.8)] = colour("#c8372d")
        return out

    return [(body, paint, False, "N"), (sign, sign_paint, False, "N")], [((X0, Y0, 0), (X1, Y1, BASE_TOP))]


COUNTER_H = 11


def till_parts(run):
    tx0, tx1, ty = run
    X0, X1, Y0, Y1 = tx0 * TILE + 0.5, tx1 * TILE - 0.5, ty * TILE + 2, (ty + 1) * TILE - 2

    def body(p):
        d = [R(X0, X1, Y0, Y1, 0, COUNTER_H - 1, 0.5, "#e8e4d8").field(p),
             R(X0 - 0.5, X1 + 0.5, Y0 - 0.5, Y1 + 0.5, COUNTER_H - 1, COUNTER_H, 0.3, "#3a3e44").field(p),
             R(X0 + 2, X0 + 30, Y0 + 2, Y1 - 2, COUNTER_H, COUNTER_H + 0.6, 0.2, "#2a2a30").field(p)]  # the belt
        rx = X1 - 10
        d += [R(rx - 4, rx + 4, Y0 + 1, Y0 + 7, COUNTER_H, COUNTER_H + 3, 0.5, "#3a3e44").field(p),  # the till
              R(rx - 3.5, rx + 3.5, Y0 + 2, Y0 + 2.6, COUNTER_H + 3, COUNTER_H + 9, 0.3, "#3a3e44").field(p),
              T((rx + 7, Y0 + 4, COUNTER_H), (rx + 7, Y0 + 4, COUNTER_H + 5), 0.4, 0.4, "#3a3e44").field(p),
              R(rx + 5.5, rx + 8.5, Y0 + 3.4, Y0 + 4.6, COUNTER_H + 5, COUNTER_H + 9, 0.3, "#3a3e44").field(p)]  # the card reader
        return np.minimum.reduce(d)

    def paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = np.tile(colour("#e8e4d8"), (len(p), 1))
        out[(z > 4) & (z < 4.8)] = colour("#3a6a9a")
        out[z > COUNTER_H - 1.05] = colour("#3a3e44")
        belt = (z > COUNTER_H + 0.05) & (x < X0 + 30.1)
        out[belt & (((x * 1.3) % 1) < 0.15)] = colour("#3a3a42")
        out[belt & ~(((x * 1.3) % 1) < 0.15)] = colour("#2a2a30")
        rx = X1 - 10
        screen = (np.abs(x - rx) < 3) & (y > Y0 + 2.5) & (z > COUNTER_H + 3.6) & (z < COUNTER_H + 8.4)
        out[screen] = colour("#7fb8d8")
        reader = (np.abs(x - rx - 7) < 1.3) & (z > COUNTER_H + 5.6) & (y > Y0 + 4.5)
        out[reader] = colour("#9ad0a0")
        return out

    return [(body, paint, False, "C")], [((X0, Y0, 0), (X1, Y1, COUNTER_H))]


# ------------------------------------------------------------------ the walls
def wall_shelves(p):
    """Along the hall's back wall, shallow shelves of paint tins and boxes, under a sign."""
    y0 = ROOM.y0
    d = [box(p, (ROOM.x0 + 4, y0, 0), (27.6 * TILE, y0 + 2.4, 1.2))]
    for z in (10, 19, 28):
        d.append(box(p, (ROOM.x0 + 4, y0, z - 0.8), (27.6 * TILE, y0 + 2.6, z)))
    d += [box(p, (x - 0.4, y0, 0), (x + 0.4, y0 + 2.6, 28)) for x in np.arange(ROOM.x0 + 4, 27.7 * TILE, 3 * TILE)]
    # Tins on the lowest shelves, boxes on the top one.
    for z in (1.2, 10):
        d.append(np.maximum(np.hypot(((p[:, 0] + 300) % 4.2) - 2.1, p[:, 1] - y0 - 1.3) - 1.4, np.maximum(z - p[:, 2], p[:, 2] - z - 5.5)) + 3 * (p[:, 0] < ROOM.x0 + 4) + 3 * (p[:, 0] > 27.5 * TILE))
    d.append(box(p, (ROOM.x0 + 4.5, y0, 19), (27.5 * TILE, y0 + 2.2, 25.5)))
    return np.minimum.reduce(d)


TINS = [colour(c) for c in ("#c8372d", "#2f6fa8", "#f4eee0", "#3a8a48", "#e8b830", "#5a5a60")]


def wall_shelf_paint(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    out = tones(["#7a8088", "#868c94"], 1 + value_noise(x * 0.2, z * 0.2))
    tin = ((z > 1.2) & (z < 6.8)) | ((z > 10) & (z < 15.6))
    k = (np.floor((x + 300) / 4.2) + np.floor(z / 9) * 3).astype(int)
    out[tin] = np.array(TINS)[k[tin] % len(TINS)]
    out[tin & ((z % 9) > 4.2) & ((z % 9) < 5.4)] = colour("#f4eee0")  # labels
    boxes = (z > 19) & (z < 25.5)
    kb = np.floor((x + 300) / 7.3).astype(int)
    out[boxes] = np.array([colour("#c8a070"), colour("#b08a5a"), colour("#d8b884")])[kb[boxes] % 3]
    out[boxes & (np.abs(z - 22.3) < 0.8) & (((x + 300) % 7.3) > 2) & (((x + 300) % 7.3) < 5.3)] = colour("#f4eee0")
    return out


def store_wall_x(p):
    y, z = p[:, 1], p[:, 2]
    out = np.tile(colour("#ece6d6"), (len(p), 1)) * (0.97 + value_noise(y * 0.08, z * 0.08)[:, None] * 0.05)
    low = z < 12
    out[low] = colour("#3a6a9a") * (0.95 + value_noise(y[low] * 0.1, z[low])[:, None] * 0.05)  # the shop's blue below
    out[(z > 11.5) & (z < 12.3)] = colour("#f4eee0")
    out[z < 1.8] = colour("#2a3a4a")
    out[z > WALL_H - 1.6] = colour("#fbf7e8")
    out[ROOM.window_hole_x(p) < 1.5] = colour("#f6f2e6")
    return out


def store_wall_y(p):
    x, z = p[:, 0], p[:, 2]
    out = np.tile(colour("#ece6d6"), (len(p), 1)) * (0.97 + value_noise(x * 0.08, z * 0.08)[:, None] * 0.05)
    low = z < 12
    out[low] = colour("#3a6a9a") * (0.95 + value_noise(x[low] * 0.1, z[low])[:, None] * 0.05)
    out[(z > 11.5) & (z < 12.3)] = colour("#f4eee0")
    out[z < 1.8] = colour("#2a3a4a")
    out[z > WALL_H - 1.6] = colour("#fbf7e8")
    out[ROOM.window_hole_y(p) < 1.5] = colour("#f6f2e6")
    # Over the hall's shelves, a long blue sign with a hammer and a fish on it: pictures, not words.
    sign = (x > ROOM.x0 + 6) & (x < 27 * TILE) & (z > 31) & (z < 39)
    out[sign] = colour("#3a6a9a")
    for cx, kind in ((9 * TILE, "hammer"), (15 * TILE, "fish"), (21 * TILE, "hammer")):
        u, v = x - cx, z - 35
        if kind == "hammer":
            shape = ((np.abs(u) < 0.8) & (np.abs(v + 0.5) < 3)) | ((np.abs(v - 2.4) < 1) & (u > -3) & (u < 2.4))
        else:
            shape = ((u / 4.4) ** 2 + (v / 2) ** 2 < 1) | ((u > 3.6) & (u < 6.4) & (np.abs(v) < (u - 3.6) * 0.9))
        out[sign & shape] = colour("#f4eee0")
    return out


# ------------------------------------------------------------------ the floor
def floor_paint(p):
    x, y = p[:, 0], p[:, 1]
    letter = letter_at(x, y)
    hall = x < 29 * TILE
    # The hall: speckled vinyl tiles, as in the grocery store, and in the showroom warm boards.
    tile_tone = value_noise(np.floor(x / TILE) * 3.1, np.floor(y / TILE) * 5.7)
    out = np.tile(colour("#d6d8d2"), (len(p), 1)) * (0.9 + tile_tone[:, None] * 0.07 + value_noise(x * 0.06, y * 0.06)[:, None] * 0.1)
    speck = value_noise(x * 3.2, y * 3.2)
    out[speck > 0.74] = out[speck > 0.74] * 0.88
    grout = ((x % TILE) < 0.28) | ((y % TILE) < 0.28)
    out[grout] = out[grout] * 0.88
    show = ~hall | (letter == "F")
    if show.any():
        q = p[show]
        board = np.floor(q[:, 0] / 6.4)
        length = np.floor((q[:, 1] + board * 19) / 46)
        tone = value_noise(board * 3.3, length * 2.7)
        out[show] = colour("#b98a58") * (0.84 + tone[:, None] * 0.2 + value_noise(q[:, 1] * 0.18, q[:, 0] * 2.4)[:, None] * 0.1)
        seam = ((q[:, 0] % 6.4) < 0.3) | (((q[:, 1] + board * 19) % 46) < 0.3)
        out[np.nonzero(show)[0][seam]] *= 0.74
    # A mat inside the door, and a blue line round the showroom's platforms.
    mat = (np.abs(x - 15.5 * TILE) < 20) & (y > 18.6 * TILE) & (y < 19.9 * TILE)
    out[mat] = colour("#3a4a5a") * (0.85 + value_noise(x[mat] * 2, y[mat] * 2)[:, None] * 0.2)
    return out


# --------------------------------------------------------------- all of it
def assemble():
    ROOM.floor = floor_paint
    # No floor beyond the store, or under a low wall's tiles that have no floor beside them.
    def no_floor(p):
        x, y = p[:, 0], p[:, 1]
        letter = letter_at(x, y)
        # On a low wall's tile, floor only as far as the wall, a few units from the floor beside it.
        near = np.zeros(len(p), bool)
        for dx, dy in ((6, 0), (-6, 0), (0, 6), (0, -6), (6, 6), (-6, 6), (6, -6), (-6, -6)):
            near |= np.isin(letter_at(x + dx, y + dy), ["f", "F", "O", "U", "N", "C"])
        return (letter == "_") | ((letter == "X") & ~near)
    ROOM.no_floor = no_floor
    ROOM.wall_paint_x, ROOM.wall_paint_y = store_wall_x, store_wall_y
    # Between the hall and the showroom, at the back, the end of a wall, as high as the walls; the rest low walls.
    STUB = ((28 * TILE, ROOM.y0, 0), (30 * TILE, 4 * TILE, WALL_H))
    lows = TileBoxes([b for b in low_walls_of(ROOM, "X", height=8, thick=5) if not (b[0][0] >= STUB[0][0] - 0.1 and b[1][0] <= STUB[1][0] + 0.1 and b[1][1] <= STUB[1][1] + 0.1)] + [STUB])
    paint_stub = lambda p: np.where((p[:, 2] < 12)[:, None], colour("#3a6a9a"), colour("#ece6d6"))
    paint_low = lambda p: np.where((p[:, 2] > 12)[:, None], paint_stub(p), np.where(((p[:, 2] > 7.2) & (p[:, 2] < 8.05))[:, None], colour("#f4eeda"), colour("#3a6a9a")))
    base = ROOM.wall_parts
    ROOM.wall_parts = lambda: [part for part in base() if part[0] not in (ROOM.low_wall_x, ROOM.low_wall_y)] + [(lows, paint_low, False, "X")]
    ROOM.occluders += lows.boxes
    ROOM.add(wall_shelves, wall_shelf_paint, "W")
    for maker, letter in ((pegboard_parts, "O"), (rail_parts, "U"), (platform_parts, "N"), (till_parts, "C")):
        for run in ROOM.runs(letter):
            parts, occluders = maker(run)
            for field, paint, glows, letters in parts:
                ROOM.add(field, paint, letters, glows)
            ROOM.occluders += occluders
    ROOM.lamps = [(x * TILE, y * TILE) for x in (9, 20) for y in (6.5, 11.5, 16.5)] + [(x * TILE, 7.5 * TILE) for x in (33.5, 37.5, 41.5)]


assemble()

if __name__ == "__main__":
    make(["gearstore"], int(sys.argv[1]) if sys.argv[1:] else 6)
