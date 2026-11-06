#!/usr/bin/env python3
"""Make the car park in 3D, into art/city/, with tools/rooms3d.py: its asphalt and bays, the pavement, the buildings round it, trees, street
lamps and benches, under an open sky.

The vehicles are the game's own models, as their colours change every round; they park in the bays (two tiles deep, nose in). The
buildings along the back are a small Nordic town's: wooden and rendered fronts in several colours, shops on the ground floor with
awnings, and flats above. Not of any one town; the shop signs are pictures, not words.

Usage: python3 tools/make_city.py [workers]
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402
from make_home import B, R, T  # noqa: E402
from rooms3d import TILE, Room, box, make, tones  # noqa: E402

FRONT_H = 54  # how high the buildings' fronts are
SUN = (-0.78, -0.5, 0.42)  # late afternoon, from behind the buildings on the left
ROOM = Room("city", wall_h=FRONT_H, sun=SUN, walls="B", low="X", back="#23262c", edge=3, proud=4.5, outdoors=True,
            ambient=0.86, sun_tone=(1.3, 1.15, 0.9), shade_tone=(0.92, 0.96, 1.05), lamp_tone=(1.2, 1.05, 0.8), tall=24)
X0, Y0, X1, Y1 = ROOM.x0, ROOM.y0, ROOM.x1, ROOM.y1
# The two ways in for cars, through the low walls: along x at the front and along y on the right, in the world's units.
# Must match the a tiles through the walls in tools/make_map.py.
ENTRANCES = {"front": (17 * TILE, 19 * TILE), "right": (15 * TILE, 17 * TILE)}


# ---------------------------------------------------------------- the buildings
# Along each back side, from one end: how many tiles wide, its colour, the trim's, and the shop's: its awning and what its sign shows.
FRONTS_Y = [(6, "#b8463a", "#f4eee0", "#2f6fa8", "cup"), (5, "#e8c86a", "#f4eee0", "#c8372d", "book"), (7, "#8aa4b4", "#f4eee0", "#3a8a48", "loaf"),
            (6, "#f0ece0", "#5a6a7a", "#d8a02a", "flower"), (6, "#b8463a", "#f4eee0", "#2f5f8a", "scissors")]
FRONTS_X = [(6, "#7a9a6a", "#f4eee0", "#c8372d", "fish"), (6, "#e8d8b0", "#7a4a2a", "#3a6aa8", "shoe"), (5, "#c87a4a", "#f4eee0", "#3a8a48", "cup"),
            (5, "#8aa4b4", "#f4eee0", "#c86a2a", "book")]


def fronts(along_y):
    """Each building: from and to along its wall, in the world's units, and how it looks."""
    start = (ROOM.y0 if along_y else ROOM.x0)
    made, at = [], start
    for width, *look in (FRONTS_X if along_y else FRONTS_Y):
        made.append((at, at + width * TILE, *look))
        at += width * TILE
    return made


BUILDINGS_Y, BUILDINGS_X = fronts(False), fronts(True)  # along the wall at y = Y0, and at x = X0


def building_at(along, buildings):
    i = np.zeros(len(along), int)
    for k, (a, b, *_) in enumerate(buildings):
        i[(along >= a)] = k
    return i


def building_x(p):
    """The fronts along the left, at x = X0, facing +x."""
    wall = box(p, (X0 - 14, Y0 - 14, 0), (X0, Y1, FRONT_H))
    return _front(p, wall, p[:, 1], p[:, 0] - X0, BUILDINGS_X)


def building_y(p):
    wall = box(p, (X0 - 14, Y0 - 14, 0), (X1, Y0, FRONT_H))
    return _front(p, wall, p[:, 0], p[:, 1] - Y0, BUILDINGS_Y)


def _front(p, wall, along, out_of, buildings):
    near = out_of > -3
    d = wall.copy()
    if near.any():
        q = p[near]
        parts = []
        z = q[:, 2]
        for a, b, *_ in buildings:
            w = b - a
            door_a = a + w * 0.68
            al, oo = along[near], out_of[near]
            recess = np.maximum.reduce([np.maximum(a + 4 - al, al - (door_a - 2)), np.maximum(2.5 - z, z - 15), -oo - 1.2])
            door = np.maximum.reduce([np.maximum(door_a - al, al - (door_a + 9)), np.maximum(-1 - z, z - 16), -oo - 1.6])
            cuts = [recess, door]
            for low, high in ((27, 37), (41, 50)):
                n = max(2, int(w / 22))
                for k in range(n):
                    c = a + (k + 0.5) * w / n
                    cuts.append(np.maximum.reduce([np.abs(al - c) - 4.2, np.maximum(low - z, z - high), -oo - 0.8]))
            for cut in cuts:
                d[near] = np.maximum(d[near], -cut)
            awning_out = np.clip((19 - z) / 4, 0, 1) * 4.2
            parts.append(np.maximum.reduce([np.maximum(a + 2 - al, al - (door_a - 0.5)), np.maximum(15.5 - z, z - 19), np.maximum(-oo, oo - awning_out - 0.4)]))
            parts.append(np.maximum.reduce([np.maximum(a + 3 - al, al - (door_a - 1.5)), np.maximum(19.5 - z, z - 23.5), np.maximum(-oo, oo - 0.7)]))
            for low, high in ((27, 37), (41, 50)):
                n = max(2, int(w / 22))
                for k in range(n):
                    c = a + (k + 0.5) * w / n
                    parts.append(np.maximum.reduce([np.abs(al - c) - 5, np.maximum(low - 1.4 - z, z - low), np.maximum(-oo, oo - 1.2)]))
            parts.append(np.maximum.reduce([np.maximum(a - al, al - b), np.maximum(FRONT_H - 2.6 - z, z - FRONT_H), np.maximum(-oo, oo - 1.4)]))
            parts.append(np.maximum(np.hypot(al - (b - 1.2), oo - 0.9) - 0.7, z - FRONT_H + 2))
        d[near] = np.minimum(d[near], np.minimum.reduce(parts))
    return d


SIGNS = {}


def _sign(kind, tone):
    """A sign's picture, 64 by 24: the shop's colour with a white picture of what it sells."""
    from PIL import Image, ImageDraw
    image = Image.new("RGB", (64, 24), tone)
    g = ImageDraw.Draw(image)
    white = "#f8f4ea"
    if kind == "cup":
        g.rounded_rectangle((24, 7, 36, 19), 3, fill=white); g.arc((33, 9, 41, 16), -90, 90, fill=white, width=2)
        for x in (27, 31):
            g.line((x, 2, x + 1, 5), fill=white, width=1)
    elif kind == "book":
        g.rectangle((20, 6, 31, 19), fill=white); g.rectangle((33, 6, 44, 19), fill=white); g.line((32, 6, 32, 19), fill=tone, width=2)
    elif kind == "loaf":
        g.ellipse((18, 7, 46, 20), fill=white)
        for x in (25, 32, 39):
            g.line((x, 9, x - 3, 17), fill=tone, width=2)
    elif kind == "flower":
        for dx, dy in ((0, -5), (5, 0), (0, 5), (-5, 0)):
            g.ellipse((32 + dx - 4, 12 + dy - 4, 32 + dx + 4, 12 + dy + 4), fill=white)
        g.ellipse((29, 9, 35, 15), fill="#f2c630")
    elif kind == "scissors":
        g.ellipse((20, 4, 28, 12), outline=white, width=2); g.ellipse((20, 13, 28, 21), outline=white, width=2)
        g.line((27, 10, 44, 16), fill=white, width=2); g.line((27, 15, 44, 9), fill=white, width=2)
    elif kind == "fish":
        g.ellipse((20, 7, 40, 18), fill=white); g.polygon([(39, 12), (46, 6), (46, 19)], fill=white); g.ellipse((24, 10, 27, 13), fill=tone)
    elif kind == "shoe":
        g.polygon([(20, 8), (28, 8), (30, 13), (44, 15), (44, 19), (20, 19)], fill=white)
    return np.array(image)


def front_paint(p, along, out_of, buildings, glow=False):
    z = p[:, 2]
    which = building_at(along, buildings)
    out = np.zeros((len(p), 3))
    for k, (a, b, wall_tone, trim, awning, sign) in enumerate(buildings):
        on = which == k
        if not on.any():
            continue
        al, oo, zz = along[on], out_of[on], z[on]
        w = b - a
        door_a = a + w * 0.68
        wood = k % 2 == 0
        base = np.tile(colour(wall_tone), (on.sum(), 1))
        if wood:  # wooden boards, across
            base = base * (0.92 + 0.08 * ((zz % 3.2) > 0.4))[:, None] * (0.96 + value_noise(al * 0.05, zz * 0.3)[:, None] * 0.06)
        else:
            base = base * (0.95 + value_noise(al * 0.3, zz * 0.3)[:, None] * 0.08)
        c = base
        c[zz < 2.5] = colour("#6a6a66")  # the plinth
        # Shop window glass and the door.
        glass = (al > a + 4) & (al < door_a - 2) & (zz > 2.5) & (zz < 15) & (oo < -0.9)
        c[glass] = colour("#3c5868") * (1 + 0.5 * (np.abs(((al[glass] - zz[glass] * 0.6) % 14) - 2) < 1.2))[:, None]
        goods = glass & (zz < 7.5) & (zz > 3)
        c[goods] = np.array([colour(t) for t in ("#d8a02a", "#c8372d", "#f4eee0", "#3a8a48")])[(np.floor(al[goods] / 3.4) % 4).astype(int)] * 0.85
        door = (al > door_a) & (al < door_a + 9) & (zz < 16) & (oo < -1.5)
        c[door] = colour(trim) * 0.8
        c[door & (zz > 6) & (zz < 14) & (np.abs(al - door_a - 4.5) < 2.8)] = colour("#3c5868")
        # The awning, striped, and the sign.
        awn = (zz > 15.4) & (zz < 19.05) & (oo > 0.05) & (al > a + 2) & (al < door_a - 0.5)
        c[awn] = np.where((((al[awn] - a) % 4) < 2)[:, None], colour(awning), colour("#f4eee0"))
        sign_on = (zz > 19.5) & (zz < 23.5) & (oo > 0.5) & (al > a + 3) & (al < door_a - 1.5)
        if sign_on.any():
            key = (sign, awning)
            if key not in SIGNS:
                SIGNS[key] = _sign(sign, awning)
            pic = SIGNS[key]
            u = np.clip((al[sign_on] - a - 3) / (door_a - 1.5 - a - 3), 0, 0.999)
            v = np.clip((23.5 - zz[sign_on]) / 4, 0, 0.999)
            # The picture in the middle, the rest the shop's colour.
            span = (door_a - 1.5 - a - 3) / 16
            uu = np.clip(0.5 + (u - 0.5) * span / 2.7, 0, 0.999)
            c[sign_on] = pic[(v * 24).astype(int), (uu * 64).astype(int)]
        # Windows above: glass, some with the warm light of someone home, and white frames and sills.
        for low, high in ((27, 37), (41, 50)):
            n = max(2, int(w / 22))
            for kk in range(n):
                cc = a + (kk + 0.5) * w / n
                inside = (np.abs(al - cc) < 4.2) & (zz > low) & (zz < high)
                frame = inside & ((np.abs(al - cc) > 3.5) | (zz < low + 0.7) | (zz > high - 0.7) | (np.abs(al - cc) < 0.35) | (np.abs(zz - (low + high) / 2 + 1) < 0.35))
                pane = inside & ~frame & (oo < -0.6)
                lit = (k * 7 + kk * 3 + low) % 5 == 0
                c[pane] = colour("#f2d088") if lit else colour("#5a7890") * (1 + 0.4 * (np.abs(((al[pane] - zz[pane] * 0.7) % 12) - 2) < 1))[:, None]
                c[inside & (oo > -0.65) & ~pane] = colour(trim)
                c[frame] = colour(trim)
                sill = (np.abs(al - cc) < 5) & (zz > low - 1.45) & (zz <= low + 0.05) & (oo > -0.1)
                c[sill] = colour(trim) * 0.92
        c[zz > FRONT_H - 2.65] = colour(trim) * 0.95
        c[(np.hypot(al - (b - 1.2), oo - 0.9) < 0.8) & (zz < FRONT_H - 2)] = colour("#5a5a60")
        out[on] = c
    return out


def building_x_paint(p):
    return front_paint(p, p[:, 1], p[:, 0] - X0, BUILDINGS_X)


def building_y_paint(p):
    return front_paint(p, p[:, 0], p[:, 1] - Y0, BUILDINGS_Y)


def lit_windows(p):
    """The windows with a light on, which glow a little: the same as front_paint's choice."""
    d = [np.full(len(p), 1e3)]
    for buildings, along_axis, wall in ((BUILDINGS_X, 1, X0), (BUILDINGS_Y, 0, Y0)):
        along, out_of = p[:, along_axis], p[:, 1 - along_axis] - wall
        for k, (a, b, *_) in enumerate(buildings):
            w = b - a
            for low, high in ((27, 37), (41, 50)):
                n = max(2, int(w / 22))
                for kk in range(n):
                    if (k * 7 + kk * 3 + low) % 5 == 0:
                        cc = a + (kk + 0.5) * w / n
                        d.append(np.maximum.reduce([np.abs(along - cc) - 3.4, np.maximum(low + 0.8 - p[:, 2], p[:, 2] - high + 0.8), np.abs(out_of + 0.85) - 0.05]))
    return np.minimum.reduce(d)


# ------------------------------------------------------------- trees, lamps and benches
def birch(q, seed):
    rng = np.random.default_rng(seed)
    d = [T((0, 0, 0), (0.6, 0.3, 26), 1.5, 0.9, "#eeeae0"), T((0.6, 0.3, 20), (5, 2, 30), 0.6, 0.4, "#eeeae0"), T((0.4, 0.2, 22), (-4, -2, 31), 0.6, 0.4, "#eeeae0")]
    for i in range(11):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(1, 6.5)
        d.append(B(np.cos(a) * r, np.sin(a) * r, rng.uniform(27, 42), rng.uniform(4, 6), rng.uniform(4, 6), rng.uniform(3.5, 5), "#7cb85a" if i % 3 else "#5a9a48"))
    return d


def bark(q):
    out = np.tile(colour("#eeeae0"), (len(q), 1))
    mark = value_noise(np.arctan2(q[:, 1], q[:, 0]) * 3, q[:, 2] * 1.4) > 0.72
    out[mark] = colour("#2a2a2a")
    return out


def lamp_post(q):
    return [T((0, 0, 0), (0, 0, 1.2), 2.2, 1.8, "#3a3e44"), T((0, 0, 1), (0, 0, 38), 0.8, 0.6, "#3a3e44"),
            T((0, 0, 37.5), (4.5, 4.5, 39), 0.5, 0.5, "#3a3e44"), R(3, 7.5, 3, 7.5, 36.4, 38.6, 1, "#3a3e44"),
            R(3.6, 6.9, 3.6, 6.9, 36, 36.6, 0.3, "#fff0c0", glows=True)]


def bench(q, along_x):
    a, b = ((-7, 7), (-3, 3)) if along_x else ((-3, 3), (-7, 7))
    seat = R(a[0], a[1], b[0], b[1], 5, 6.2, 0.4, "#a87a4a")
    back = R(a[0], a[1], b[0], b[0] + 1, 6, 12, 0.4, "#a87a4a") if along_x else R(a[0], a[0] + 1, b[0], b[1], 6, 12, 0.4, "#a87a4a")
    legs = [R(x - 0.5, x + 0.5, y - 0.5, y + 0.5, 0, 5, 0.2, "#3a3e44") for x in (a[0] + 1, a[1] - 1) for y in (b[0] + 1, b[1] - 1)]
    return [seat, back, *legs]


def corner_things():
    """What stands on each n and t tile, by where it is."""
    made = {}
    for y, row in enumerate(ROOM.map):
        for x, letter in enumerate(row):
            if letter == "t":
                made[(x, y)] = ("tree", birch(None, x * 31 + y))
            elif letter == "n":
                on_top = y == 3
                kind = "lamp" if (x if on_top else y) % 6 == 3 else "bench"
                made[(x, y)] = (kind, lamp_post(None) if kind == "lamp" else bench(None, on_top))
    return made


THINGS = corner_things()


def thing_parts(glows):
    def field(p):
        d = [np.full(len(p), 1e3)]
        for (tx, ty), (kind, shapes) in THINGS.items():
            c = np.array(((tx + 0.5) * TILE, (ty + 0.5) * TILE, 0))
            near = box(p, c - (9, 9, 0), c + (9, 9, 48))
            chosen = [s for s in shapes if s.glows == glows]
            if not chosen:
                continue
            q = p - c
            here = near < 2
            dd = near.copy()
            if here.any():
                dd[here] = np.minimum.reduce([s.field(q[here]) for s in chosen])
            d.append(dd)
        return np.minimum.reduce(d)

    def paint(p):
        out = np.zeros((len(p), 3))
        for (tx, ty), (kind, shapes) in THINGS.items():
            c = np.array(((tx + 0.5) * TILE, (ty + 0.5) * TILE, 0))
            on = (np.abs(p[:, 0] - c[0]) < 10) & (np.abs(p[:, 1] - c[1]) < 10)
            chosen = [s for s in shapes if s.glows == glows]
            if not on.any() or not chosen:
                continue
            q = p[on] - c
            which = np.argmin([s.field(q) for s in chosen], axis=0)
            cols = np.zeros((on.sum(), 3))
            for i, s in enumerate(chosen):
                m = which == i
                if m.any():
                    cols[m] = s.paint(q[m]) if s.paint else colour(s.tone)
            if kind == "tree":
                trunk = np.hypot(q[:, 0], q[:, 1]) < 2 + (q[:, 2] > 20) * 4
                low = trunk & (q[:, 2] < 27)
                cols[low] = bark(q[low])
                leaves = ~low
                cols[leaves] = cols[leaves] * (0.86 + value_noise(q[leaves, 0] * 0.7, q[leaves, 2] * 0.7)[:, None] * 0.26)
            out[on] = cols
        return out
    return field, paint


# ------------------------------------------------------------------ the ground
def ground(p):
    x, y = p[:, 0], p[:, 1]
    tx, ty = np.clip((x // TILE).astype(int), 0, ROOM.width - 1), np.clip((y // TILE).astype(int), 0, ROOM.height - 1)
    rows = np.array([list(r) for r in ROOM.map])
    letter = rows[ty, tx]
    lx, ly = x - tx * TILE, y - ty * TILE
    # Asphalt, a little worn, with patches, cracks and oil.
    grain = value_noise(x * 1.9, y * 1.9)
    out = colour("#6c7076") * (0.92 + grain[:, None] * 0.1 + value_noise(x * 0.04, y * 0.04)[:, None] * 0.05)
    speck = value_noise(x * 4.1, y * 4.1)
    out[speck > 0.86] = out[speck > 0.86] * 1.08
    patch = value_noise(x * 0.02 + 9, y * 0.02) > 0.74
    out[patch] = out[patch] * 0.95
    # Now and then a faint stain where a car stands.
    spot = np.hypot(((x + 8) % 32) - 16, (ly - 9) * 1.3)
    oil = (letter == "q") & (spot < 2.6 + value_noise(x * 0.8, y * 0.8) * 2) & (value_noise(np.floor(x / 32) * 2.3, ty * 1.7) > 0.62)
    out[oil] = out[oil] * (0.86 + spot[oil, None] * 0.03)
    # The bays' lines, between the bays and across each end; arrows on the lanes; and a way through the middle.
    def at(dx, dy):
        return rows[np.clip(ty + dy, 0, ROOM.height - 1), np.clip(tx + dx, 0, ROOM.width - 1)]
    bay = letter == "q"
    line = bay & ((((tx % 2) == 0) & (lx < 1.1)) | ((at(1, 0) != "q") & (lx > 14.9)) | ((at(0, -1) != "q") & (ly < 1.1)))
    out[line] = colour("#e8e8df") * (0.92 + grain[line, None] * 0.1)
    lane = (letter == "a") & np.isin(ty, (9, 15, 21)) & (np.abs(((x + 40) % 96) - 48) < 7) & (np.abs(ly - 16) < 1.4) | \
           (letter == "a") & np.isin(ty, (9, 15, 21)) & (np.abs(((x + 40) % 96) - 54 - np.abs(ly - 16) * 1.4) < 1) & (np.abs(ly - 16) < 3.5)
    out[lane] = colour("#d8d8cc")
    zebra = (letter == "a") & np.isin(tx, (17, 18)) & (((y // 6) % 2) == 0) & np.isin(ty, (6, 7, 12, 13, 18, 19))
    out[zebra] = colour("#e8e8df") * 0.95
    # The pavement: paving stones, with a kerb along the car park.
    pave = np.isin(letter, ["s", "n", "t", "B", "X"])
    if pave.any():
        q = p[pave]
        row = np.floor(q[:, 1] / 5)
        stone = (np.floor((q[:, 0] + row * 4) / 8) * 7 + row * 3)
        out[pave] = colour("#b4b0a4") * (0.92 + value_noise(stone * 0.37, row * 0.71)[:, None] * 0.1)
        joint = ((q[:, 1] % 5) < 0.35) | (((q[:, 0] + row * 4) % 8) < 0.35)
        out[np.nonzero(pave)[0][joint]] = colour("#8b8c88")
    inner = (x > X0 + TILE) & (y > Y0 + TILE) & (x < X1 - TILE) & (y < Y1 - TILE)
    kerb = pave & ~inner & (np.minimum.reduce([np.abs(x - X0 - TILE), np.abs(y - Y0 - TILE), np.abs(x - X1 + TILE), np.abs(y - Y1 + TILE)]) < 1.2)
    out[kerb] = colour("#d8d6cc")
    # Grass beyond the low walls at the front, and the roads in going on through it.
    fa, fb = ENTRANCES["front"]
    ra, rb = ENTRANCES["right"]
    road_front = (y >= Y1 - TILE) & (x >= fa) & (x < fb)
    road_right = (x >= X1 - TILE) & (y >= ra) & (y < rb)
    grass = ((x >= X1 + 4) | (y >= Y1 + 4)) & ~road_front & ~road_right
    out[grass] = tones(["#4a8a45", "#55984a", "#60a44f"], 1 + value_noise(x[grass] * 0.6, y[grass] * 0.6) * 1.9)
    verge = ~grass & ((x >= X1 + 4) | (y >= Y1 + 4)) & ((np.abs(x - fa) < 1) | (np.abs(x - fb) < 1) | (np.abs(y - ra) < 1) | (np.abs(y - rb) < 1))
    out[verge] = colour("#d8d6cc")
    dash = (road_front & (y >= Y1) & (np.abs(x - (fa + fb) / 2) < 0.6) & ((y % 8) < 4)) | (road_right & (x >= X1) & (np.abs(y - (ra + rb) / 2) < 0.6) & ((x % 8) < 4))
    out[dash] = colour("#e8e0a0")
    # A white line where the road meets the car park: give way.
    stop = (road_front & (np.abs(y - (Y1 - TILE + 1.5)) < 0.7) & (x < (fa + fb) / 2)) | (road_right & (np.abs(x - (X1 - TILE + 1.5)) < 0.7) & (y < (ra + rb) / 2))
    out[stop] = colour("#e8e8df")
    return out


def low_wall(p):
    """At the front, a low stone wall with a hedge on it."""
    fa, fb = ENTRANCES["front"]
    ra, rb = ENTRANCES["right"]
    gaps = np.minimum(box(p, (fa, Y1 - 2, -1), (fb, Y1 + 8, 20)), box(p, (X1 - 2, ra, -1), (X1 + 8, rb, 20)))
    wall = np.minimum(box(p, (X0 - 5, Y1, 0), (X1 + 5, Y1 + 5, 6)), box(p, (X1, Y0 - 5, 0), (X1 + 5, Y1 + 5, 6)))
    hedge = np.minimum(box(p, (X0 - 4, Y1 + 0.5, 6), (X1 + 4, Y1 + 4.5, 10)) - 0.8 * value_noise(p[:, 0] * 0.6, p[:, 2] * 0.6),
                       box(p, (X1 + 0.5, Y0 - 4, 6), (X1 + 4.5, Y1 + 4, 10)) - 0.8 * value_noise(p[:, 1] * 0.6, p[:, 2] * 0.6))
    # Stone pillars at each side of the ways in, a little higher than the wall.
    pillars = np.minimum.reduce([box(p, (a - 3, Y1 - 0.5, 0), (a + 3, Y1 + 5.5, 11)) for a in (fa - 3, fb + 3)]
                                + [box(p, (X1 - 0.5, a - 3, 0), (X1 + 5.5, a + 3, 11)) for a in (ra - 3, rb + 3)])
    return np.minimum(np.maximum(np.minimum(wall, hedge), -gaps), pillars)


def low_wall_paint(p):
    z = p[:, 2]
    out = tones(["#8a8478", "#9a9488", "#aaa496"], 1 + value_noise(p[:, 0] * 0.4 + p[:, 1] * 0.4, z * 0.8) * 1.9)
    fa, fb = ENTRANCES["front"]
    ra, rb = ENTRANCES["right"]
    pillar = ((np.minimum(np.abs(p[:, 0] - (fa - 3)), np.abs(p[:, 0] - (fb + 3))) < 3.05) & (p[:, 1] > Y1 - 1)) | \
             ((np.minimum(np.abs(p[:, 1] - (ra - 3)), np.abs(p[:, 1] - (rb + 3))) < 3.05) & (p[:, 0] > X1 - 1))
    leaves = (z > 5.9) & ~pillar
    out[pillar & (z > 10.4)] = colour("#c8c2b4")
    out[leaves] = tones(["#2e6a3a", "#3e8248", "#4e9250"], 1 + value_noise(p[leaves, 0] * 1.1 + p[leaves, 1], z[leaves] * 1.1) * 1.9)
    return out


# --------------------------------------------------------------- all of it
def assemble():
    ROOM.floor = ground
    ROOM.floor_at = lambda p: (p[:, 0] > X0 - 6) & (p[:, 1] > Y0 - 6) & (p[:, 0] < (ROOM.width) * TILE) & (p[:, 1] < (ROOM.height) * TILE)
    ROOM.wall_parts = lambda: [(building_x, building_x_paint, False, "B"), (building_y, building_y_paint, False, "B"),
                               (lit_windows, lambda p: np.tile(colour("#ffe2a0"), (len(p), 1)), True, "B"),
                               (low_wall, low_wall_paint, False, "X")]
    field, paint = thing_parts(False)
    ROOM.add(field, paint, "nt")
    field, paint = thing_parts(True)
    ROOM.add(field, paint, "n", glows=True)
    ROOM.occluders += [((0, 0, 0), (X0, ROOM.height * TILE, FRONT_H)), ((0, 0, 0), (ROOM.width * TILE, Y0, FRONT_H))]
    for (tx, ty), (kind, _) in THINGS.items():
        c = ((tx + 0.5) * TILE, (ty + 0.5) * TILE)
        if kind == "tree":
            ROOM.occluders += [((c[0] - 1.5, c[1] - 1.5, 0), (c[0] + 1.5, c[1] + 1.5, 26)), ((c[0] - 6, c[1] - 6, 26), (c[0] + 6, c[1] + 6, 42))]
        elif kind == "lamp":
            ROOM.occluders.append(((c[0] - 0.8, c[1] - 0.8, 0), (c[0] + 0.8, c[1] + 0.8, 38)))
            ROOM.pools.append((c[0] + 5.2, c[1] + 5.2, 36))
        else:
            ROOM.occluders.append(((c[0] - 6, c[1] - 6, 0), (c[0] + 6, c[1] + 6, 6)))
    ROOM.lamps = [(x, y) for x, y, _ in ROOM.pools]


assemble()

if __name__ == "__main__":
    make(["city"], int(sys.argv[1]) if sys.argv[1:] else 6)
