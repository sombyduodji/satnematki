#!/usr/bin/env python3
"""Make the home in 3D, into art/home/, with tools/rooms3d.py: its floors, walls and windows, and every piece of furniture.

A living room, a kitchen, a bedroom, a hall and a bathroom, with low walls between them and doorways through. The furniture is what the
game asks for, always in its own place (SPOTS.home in data/map.js, its size in HOME_THINGS in src/game.js), and it's made here whole,
each piece a picture of its own that the game draws again over the player behind it. The family are the game's own models and sit,
stand and play on and by it, so the sofa's seat, the stove and the floor are where those models expect them (src/models.js).

Not of any one home or region: an ordinary Nordic home, warm in the afternoon sun. The rug's woven stripes are generic.

Usage: python3 tools/make_home.py [workers]
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402
from make_library import _painting  # noqa: E402
from rooms3d import MAPS, TILE, Room, box, make, texture, tones  # noqa: E402

WALL_H = 36
INNER_H = 14  # the low walls between rooms
SUN = (-0.8, -0.42, 0.38)
# Windows, in tiles along each back wall: one in the living room and one in the bedroom on the left, and on the right one over the
# sofa and one over the kitchen counter. Must match the J and I tiles in tools/make_map.py.
WINDOWS_X = [(7, 9), (14, 16)]
WINDOWS_Y = [(5, 8), (17.8, 19.2)]
ROOM = Room("home", wall_h=WALL_H, sun=SUN, windows_x=WINDOWS_X, windows_y=WINDOWS_Y, win_low=14, win_high=31, transom=25,
            walls="YJI", low="H", lamp_tone=(1.14, 1.04, 0.84), ambient=0.72, sun_tone=(1.4, 1.17, 0.86), lamp_strength=0.15)
# A light in the ceiling of each room, which isn't drawn: it lights the room softly, the windowless bathroom most of all.
CEILING_LAMPS = [(7, 6), (18.5, 6.5), (6, 14), (12.5, 14), (20, 14.5)]
SPOTS = MAPS["home"]["spots"]["home"]

WOOD, WOOD_DARK, ENAMEL, STEEL, PAGES = "#b98a58", "#7a5232", "#f2f2ee", "#b5bcc6", "#eee8d8"


# ------------------------------------------------------------------ shapes, as in src/models.js
class Shape:
    def __init__(self, field, tone, paint=None, glows=False, low=None, high=None):
        self.field, self.tone, self.paint, self.glows, self.low, self.high = field, tone, paint, glows, low, high


def R(x0, x1, y0, y1, z0, z1, r, tone, paint=None, glows=False):
    """A box with rounded edges."""
    r = min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01, (z1 - z0) / 2 - 0.01)
    low, high = np.array((x0 + r, y0 + r, z0 + r)), np.array((x1 - r, y1 - r, z1 - r))
    return Shape(lambda q: box(q, low, high) - r, tone, paint, glows, (x0, y0, z0), (x1, y1, z1))


def B(x, y, z, rx, ry, rz, tone, paint=None, glows=False):
    """A ball, stretched."""
    c, radii = np.array((x, y, z), float), np.array((rx, ry, rz), float)
    return Shape(lambda q: (np.linalg.norm((q - c) / radii, axis=1) - 1) * radii.min(), tone, paint, glows, c - radii, c + radii)


def T(a, b, r0, r1, tone, paint=None, glows=False):
    """A tube from a to b, its radius going from r0 to r1."""
    a, b = np.array(a, float), np.array(b, float)
    ba = b - a
    def field(q):
        pa = q - a
        h = np.clip(pa @ ba / max(ba @ ba, 1e-9), 0, 1)
        return np.linalg.norm(pa - h[:, None] * ba, axis=1) - (r0 + (r1 - r0) * h)
    r = max(r0, r1)
    return Shape(field, tone, paint, glows, np.minimum(a, b) - r, np.maximum(a, b) + r)


def sides(f):
    return [x for s in (-1, 1) for x in f(s)]


# ------------------------------------------------------------------ the furniture
def grain(q, tones_, along=0, scale=0.12, across=1.4):
    a, b = (q[:, 0], q[:, 2]) if along == 0 else (q[:, 1], q[:, 2])
    return tones(tones_, 1 + value_noise(a * scale, b * across + q[:, 1 - along] * 0.3) * (len(tones_) - 1.01))


OAK = ["#a87a4a", "#b98a58", "#c89a64"]
BIRCH = ["#d8b884", "#e4c696", "#eed4a8"]
DARK = ["#6a4628", "#7a5232", "#8a6038"]


def sofa(fabric_tones=("#9a3e32", "#a8483a", "#b5533f"), blanket=True):
    fabric = lambda q: tones(list(fabric_tones), 1 + value_noise(q[:, 0] * 0.6, q[:, 2] * 0.6 + q[:, 1] * 0.4) * 1.9)
    knit = lambda q: np.where(((np.floor(q[:, 0] / 1.4) + np.floor(q[:, 2] / 1.4)) % 2 == 0)[:, None], colour("#e8d8a8"), colour("#d4c08c"))
    return [
        R(-19, 19, -8, 8, 2, 8, 2, fabric_tones[1], fabric),
        R(-19, 19, -8, -3, 3, 17, 2.5, fabric_tones[2], fabric),
        *sides(lambda s: [R(s * 21 - 3.5, s * 21 + 3.5, -8, 8, 2, 12.5, 2.5, fabric_tones[0], fabric)]),
        *[R(x - 8.5, x + 8.5, -3, 8.4, 7, 10, 1.4, fabric_tones[2], fabric) for x in (-9, 9)],
        *[R(x - 7.5, x + 7.5, -4.5, -2.5, 10, 16, 1.2, fabric_tones[2], fabric) for x in (-9, 9)],
        B(-14, -1.2, 12.6, 3, 1.5, 2.9, "#e6b84a"),
        B(15, -1.4, 12.4, 2.8, 1.4, 2.7, "#2f6fa8"),
        *([R(17.8, 24.2, -8.2, 4, 11.8, 13.2, 0.6, "#e8d8a8", knit), R(23.6, 24.6, -8.2, 4, 5, 13, 0.4, "#e8d8a8", knit)] if blanket else []),
        *[T((x, y, 0), (x, y, 2.2), 0.7, 0.55, WOOD_DARK) for x in (-22, 22) for y in (-6.5, 6.5)],
    ]


def tv():
    picture = _painting(False)
    def screen(q):
        out = np.tile(colour("#1c1c24"), (len(q), 1))
        on = (np.abs(q[:, 0]) < 9.8) & (q[:, 2] > 10.2) & (q[:, 2] < 21.8) & (q[:, 1] > 0.9)
        out[on] = texture(picture, (q[on, 0] + 9.8) / 19.6, (21.8 - q[on, 2]) / 11.6) * 1.05
        return out
    bench = lambda q: grain(q, OAK)
    return [
        R(-12, 12, -4.5, 4.5, 1.5, 7.5, 0.6, WOOD, bench),
        *[R(x - 5.4, x + 5.4, 4.4, 4.8, 2.2, 6.8, 0.15, "#c89a64") for x in (-6, 6)],
        *[B(x, 4.9, 4.5, 0.5, 0.3, 0.5, "#e6d3b0") for x in (-1.5, 1.5)],
        *[T((x, y, 0), (x, y, 1.6), 0.6, 0.5, WOOD_DARK) for x in (-10.5, 10.5) for y in (-3, 3)],
        T((0, 0, 7.5), (0, 0, 9), 1.4, 1.4, "#2c2c36"),
        R(-11, 11, -1.2, 1.2, 9, 23, 0.7, "#2c2c36"),
        R(-10, 10, 1.05, 1.3, 10, 22, 0.1, "#88c8e8", screen, glows=True),
        R(4, 7.5, -2, 2, 7.5, 8.4, 0.3, "#3a3a48"),  # the remote
    ]


def table():
    """The kitchen table, with room for the whole family: a cloth down its middle, a place laid for each of six, a bowl of apples,
    a jug of milk, and over it a lamp hanging from the ceiling, which isn't drawn."""
    cloth = lambda q: np.where(((np.floor((q[:, 0] + 60) / 2.2) % 2 == 0))[:, None], colour("#f4f1e8"), colour("#c84a3a"))
    places = [(x, y) for x in (-13, 13) for y in (-8.5, 8.5)] + [(-21.5, 0), (21.5, 0)]
    shapes = [
        *[T((s * 23, e * 11.5, 0.5), (s * 23, e * 11.5, 9), 1, 0.9, WOOD_DARK) for s in (-1, 1) for e in (-1, 1)],
        R(-24, 24, -13, 13, 7.6, 9, 0.4, "#9a6a3a"),
        R(-25.6, 25.6, -14.4, 14.4, 9, 11, 0.6, WOOD, lambda q: grain(q, BIRCH)),
        R(-22, 22, -4.5, 4.5, 11, 11.25, 0.1, "#c84a3a", cloth),
        B(0, 0, 12.4, 4.6, 4.6, 1.6, "#f4f1e8"),
        B(-1.6, -0.8, 13.8, 1.7, 1.7, 1.6, "#d6443a"), B(1.6, 0.8, 13.8, 1.6, 1.6, 1.5, "#e0b030"), B(0.2, 1.8, 14.6, 1.6, 1.6, 1.5, "#d6443a"),
        T((-8, 0, 11.2), (-8, 0, 16.5), 1.8, 1.5, "#f4f1e8"), T((-8, 0, 15.8), (-8, 0, 16.6), 1.55, 1.55, "#2f6fc2"),
        T((8, -1, 11.2), (8, -1, 14), 1.4, 1.4, "#e8b830"),
    ]
    for x, y in places:
        shapes.append(B(x, y, 11.2, 3.2, 3.2, 0.35, "#f4f1e8"))
        # A fork beside each plate, on the side towards the table's middle.
        if abs(x) < 20:
            shapes.append(T((x + 4, y - 1.4, 11.1), (x + 4, y + 1.4, 11.1), 0.25, 0.25, STEEL))
        else:
            shapes.append(T((x - 1.4, y + 4, 11.1), (x + 1.4, y + 4, 11.1), 0.25, 0.25, STEEL))
    # The lamp over it, its cord going up out of sight, and its light.
    shapes += [T((0, 0, 30), (0, 0, 44), 0.25, 0.25, "#3a3a48"),
               T((0, 0, 30.5), (0, 0, 26.5), 1.6, 6.4, "#c8642c", lambda q: tones(["#b85a24", "#c8642c"], 1 + (np.sin(np.arctan2(q[:, 1], q[:, 0]) * 8) > 0))),
               B(0, 0, 26.6, 2.4, 2.4, 1.2, "#fff0c0", glows=True)]
    return shapes


def chair():
    return [
        *[T((s * 4, e * 4, 0.5), (s * 4, e * 4, 7), 0.6, 0.6, WOOD_DARK) for s in (-1, 1) for e in (-1, 1)],
        R(-5, 5, -5, 5, 7, 8.5, 0.5, WOOD, lambda q: grain(q, BIRCH)),
        R(-4.2, 4.2, -4.2, 4.2, 8.5, 9.4, 0.4, "#c84a3a"),
        *sides(lambda s: [T((s * 4, -4.5, 8), (s * 4, -4.5, 17.5), 0.6, 0.6, WOOD_DARK)]),
        R(-5, 5, -5.2, -3.8, 12.5, 17.5, 0.5, WOOD, lambda q: grain(q, BIRCH)),
        R(-5, 5, -5.2, -3.8, 10, 11, 0.3, WOOD),
    ]


def stove():
    def front(q):
        out = np.tile(colour(ENAMEL), (len(q), 1))
        glass = (q[:, 1] > 7.4) & (np.abs(q[:, 0]) < 5.6) & (q[:, 2] > 3.2) & (q[:, 2] < 9.6)
        out[glass] = colour("#2c2c36")
        out[glass & (q[:, 2] > 8.4) & (q[:, 0] > 2)] = colour("#5a5a68")
        return out
    return [
        R(-8, 8, -7.5, 7.5, 0, 15, 0.8, ENAMEL, front),
        R(-5.5, 5.5, 7.6, 8.6, 10.5, 11.2, 0.2, STEEL),
        R(-8, 8, -7.5, 7.5, 15, 15.6, 0.2, "#2c2c36"),
        *[T((x, y, 15.4), (x, y, 15.8), 2.6, 2.6, "#45454f") for x in (-4, 4) for y in (-3.4, 3.4)],
        *[B(x, 8, 13, 0.75, 0.5, 0.75, "#55555f") for x in (-4.5, -1.5, 1.5, 4.5)],
        R(-8, 8, -8.6, -7.2, 15, 19, 0.4, ENAMEL),
        # A red pot on the back left, and a kettle on the front right.
        T((-4, -3.4, 15.8), (-4, -3.4, 20.5), 3.5, 3.5, "#c8372d"),
        B(-4, -3.4, 20.6, 3.3, 3.3, 0.7, "#a82a24"),
        T((-0.4, -3.4, 19.5), (2.4, -3.4, 19.5), 0.5, 0.5, "#3a3a48"),
        B(4, 3.4, 18, 2.8, 2.8, 2.4, STEEL), T((4, 3.4, 20.2), (4, 3.4, 21.2), 0.9, 0.6, "#2c2c36"),
        T((6.4, 3.4, 18.4), (8, 3.4, 20), 0.5, 0.35, STEEL),
    ]


def cupboard():
    doors = lambda q: grain(q, BIRCH)
    def jars(q):
        return np.where((q[:, 2] > 16.6)[:, None], colour("#c8372d"), colour("#f4f1e8"))
    return [
        R(-12, 12, -6, 5.6, 0.8, 13, 0.6, "#e4c696", doors),
        R(-12, 12, -6, 4.4, 0, 0.8, 0.2, "#5a4a3a"),
        *[R(x - 5.4, x + 5.4, 5.5, 5.9, 1.8, 12.2, 0.2, "#eed4a8", doors) for x in (-6, 6)],
        *[T((x, 6.2, 11), (x, 6.2, 8), 0.35, 0.35, STEEL) for x in (-1.2, 1.2)],
        R(-12.6, 12.6, -6.6, 6.6, 13, 14.2, 0.4, "#6a4e3a", lambda q: tones(["#5a4232", "#6a4e3a", "#7a5a44"], 1 + value_noise(q[:, 0] * 0.5, q[:, 1] * 0.5) * 2)),
        # A bread box, jars, and a pot of herbs by the window.
        R(-10.5, -3.5, -5, 0, 14.2, 18.5, 1.4, "#c8372d"),
        R(-10.5, -3.5, -5.2, 0.2, 16.2, 16.8, 0.2, "#f4f1e8"),
        *[T((x, -3, 14.2), (x, -3, 17.4), 1.3, 1.3, "#f4f1e8", jars) for x in (1.5, 4.5)],
        T((8.5, -2, 14.2), (8.5, -2, 17), 2, 2.4, "#c0683c"),
        *[B(8.5 + dx, -2 + dy, 18.6 + dz, 1.6, 1.6, 1.4, "#4fa653") for dx, dy, dz in ((0, 0, 0.6), (1.2, 0.6, -0.2), (-1.1, -0.6, -0.1), (0.3, -1.2, 0.2))],
    ]


def fridge():
    def doors(q):
        out = np.tile(colour(ENAMEL), (len(q), 1))
        front = q[:, 1] > 6.9
        # A child's drawing held up by magnets: the sun over a lávvu-less hill, made up.
        on = front & (np.abs(q[:, 0] - 0.5) < 4) & (np.abs(q[:, 2] - 13) < 3.2)
        out[on] = colour("#fbfaf2")
        out[on & (q[:, 2] < 11.4)] = colour("#6fc774")
        out[on & (np.hypot(q[:, 0] - 2.2, q[:, 2] - 14.6) < 1.1)] = colour("#f2c630")
        return out
    return [
        R(-7.5, 7.5, -7, 7, 0, 29, 1.5, ENAMEL, doors),
        R(-7.3, 7.3, 6.9, 7.2, 19, 19.5, 0.05, "#a4aab0"),
        T((-5.2, 7.7, 21), (-5.2, 7.7, 26), 0.5, 0.5, "#8d95a3"),
        T((-5.2, 7.7, 8), (-5.2, 7.7, 17), 0.5, 0.5, "#8d95a3"),
        B(3, 7.3, 24, 1, 0.35, 1, "#d6443a"), B(-1, 7.3, 22.4, 0.9, 0.35, 0.9, "#2f6fc2"),
        B(4.6, 7.3, 15.8, 0.6, 0.3, 0.6, "#e8b830"), B(-3.4, 7.3, 15.8, 0.6, 0.3, 0.6, "#3a9a48"),
    ]


def freezer():
    frost = lambda q: np.where(((np.abs(((q[:, 0] + q[:, 1] + 40) % 6) - 3) < 0.4) | (np.abs(((q[:, 0] - q[:, 1] + 40) % 6) - 3) < 0.4))[:, None], colour("#f4fbff"), colour("#cfe2ea"))
    return [
        R(-11, 11, -7, 7, 0, 12, 1.2, "#e8eef0"),
        R(-11.5, 11.5, -7.5, 7.5, 12, 14, 0.8, "#c7deea", frost),
        R(-3, 3, 7.4, 8.4, 10, 12.5, 0.3, "#8d95a3"),
        R(-11, 11, -7, 7, 0, 1, 0.3, "#9aa4aa"),
    ]


def toilet():
    return [
        R(-5, 5, -9, -4, 0.5, 16, 1, ENAMEL),
        T((0, -2, 0.5), (0, 1, 5), 3, 3.8, ENAMEL),
        B(0, 1.5, 7.5, 5.2, 6.5, 2, ENAMEL),
        B(0, 1.5, 9.3, 4.6, 5.8, 0.7, "#e4e8ea"),
        B(0, -7, 16.5, 1.2, 1.2, 0.5, "#b5bcc6"),
        T((6.5, -8.5, 6), (6.5, -8.5, 14), 2, 2, "#fbfaf2"),  # a roll of paper on the wall beside it
    ]


def bathtub():
    """A tub with room inside, the water well below its rim, bubbles and a duck on it, and a towel folded over the rim at the foot."""
    water = lambda q: np.where((np.abs(np.sin(q[:, 0] * 0.8 + q[:, 1] * 0.3)) > 0.92)[:, None], colour("#bfe6f8"), colour("#7fc4e8"))
    outer = R(-10.5, 10.5, -20, 20, 0.5, 12, 3, ENAMEL)
    inner = R(-8.6, 8.6, -18.1, 18.1, 3, 16, 2.6, ENAMEL)
    tub = Shape(lambda q: np.maximum(outer.field(q), -inner.field(q)), ENAMEL, None, False, outer.low, outer.high)
    level = 8.6
    towel = lambda q: np.where((((q[:, 1] + 40) % 3) < 0.6)[:, None], colour("#f4f1e8"), colour("#5a90c0"))
    return [
        tub,
        R(-8.4, 8.4, -17.9, 17.9, 3.2, level, 2.4, "#7fc4e8", water),
        B(-3, -4, level, 2.2, 2.2, 0.7, "#ffffff"), B(3, 6, level, 2.6, 2.6, 0.7, "#ffffff"), B(-1, 8.5, level, 1.6, 1.6, 0.5, "#ffffff"),
        T((0, -19, 12), (0, -19, 17), 0.7, 0.7, STEEL), T((0, -19, 17), (0, -15.5, 16), 0.7, 0.5, STEEL),
        B(4, 11, level + 1.2, 1.8, 1.8, 1.5, "#f2c14e"), B(4, 12.5, level + 3.2, 1.1, 1.1, 1.1, "#f2c14e"), B(4, 13.5, level + 3.1, 0.6, 0.8, 0.3, "#e07a2a"),
        # The towel over the rim at the foot: on the rim, and hanging a little way down outside.
        R(-6, 6, 18.4, 20.6, 11.6, 12.6, 0.5, "#5a90c0", towel),
        R(-6, 6, 20.2, 20.9, 6.5, 12.4, 0.4, "#5a90c0", towel),
    ]


def shower():
    curtain = lambda q: np.where((np.abs(((q[:, 1] + 40) % 5) - 2.5) < 1)[:, None], colour("#e6a93a"), colour("#f2c94e"))
    glass = lambda q: np.tile(colour("#cfe6ef"), (len(q), 1)) + (np.abs(((q[:, 0] + q[:, 2] * 0.6) % 9) - 1) < 0.5)[:, None] * 20
    return [
        R(-9, 9, -9, 9, 0, 1.6, 0.6, ENAMEL),
        R(-6, 6, -6, 6, 1.4, 1.65, 0.2, "#9aa8b0"),
        R(-9, 9, -9, -8.2, 1, 30, 0.2, "#c0dcea", glass),
        R(-9, -8.2, -9, 9, 1, 30, 0.2, "#aed0e0", glass),
        T((-6, -6, 2), (-6, -6, 28), 0.5, 0.5, STEEL), T((-6, -6, 28), (-2, -2, 28), 0.5, 0.5, STEEL),
        B(-1.4, -1.4, 27, 2.4, 2.4, 0.7, STEEL),
        R(6, 7, -9, 8, 3, 30, 0.2, "#f2c14e", curtain),
        T((6.5, -9, 30), (6.5, 9, 30), 0.4, 0.4, STEEL),
        B(-6.5, 3, 14, 1.4, 0.9, 2.2, "#e8588a"),  # shampoo on a shelf
        R(-8.2, -5, 1, 6, 12, 12.6, 0.2, STEEL),
    ]


def sink():
    return [
        T((0, -2, 0.5), (0, -2, 10), 1.8, 2.4, ENAMEL),
        B(0, 0, 12, 7, 6, 2.8, ENAMEL),
        B(0, 0, 14, 5.4, 4.4, 0.9, "#a8d0e0"),
        T((0, -5, 13.5), (0, -5, 17), 0.6, 0.6, STEEL), T((0, -5, 17), (0, -2.5, 16), 0.6, 0.45, STEEL),
        B(4.5, -5, 14.8, 1.2, 0.9, 0.7, "#f2c14e"),
        T((-4.5, -4.8, 14.6), (-4.5, -4.8, 17.5), 0.8, 0.8, "#3a9a48"),  # a toothbrush cup
    ]


def washer():
    return [
        R(-8, 8, -7, 7, 0, 18, 1, ENAMEL),
        B(0, 7, 8.5, 5, 0.7, 5, "#a4aab0"), B(0, 7.4, 8.5, 3.8, 0.7, 3.8, "#5a90b0"),
        B(-1, 7.9, 9.5, 1.3, 0.3, 1.1, "#c6e4f2"),
        R(-6.5, -1, 6.8, 7.3, 15, 17, 0.1, "#b5bcc6"), B(5, 7.2, 16, 1.1, 0.35, 1.1, "#8d95a3"),
        R(-6, 6, -5, 5, 18, 21, 1.2, "#5a90c0", lambda q: np.where((((q[:, 2] - 18) % 1) < 0.25)[:, None], colour("#f4f1e8"), colour("#5a90c0"))),  # folded towels
    ]


def mirror():
    glass = lambda q: np.where((np.abs(q[:, 0] + q[:, 2] / 3 - 5) < 1)[:, None], colour("#f0fbff"), colour("#a8d4e8"))
    return [
        R(-5, 5, -1.2, 1.2, 0.6, 27, 1.2, WOOD, lambda q: grain(q, OAK)),
        R(-3.7, 3.7, 1, 1.5, 2.5, 25.5, 0.2, "#bfe0ee", glass),
        *sides(lambda s: [T((s * 3.5, 0, 0.5), (s * 4.5, 3, 0.4), 0.6, 0.6, WOOD_DARK)]),
    ]


def bookcase():
    def books(q):
        x, z = q[:, 0], q[:, 2]
        row = np.floor((z - 1) / 7.7)
        height = (z - 1) - row * 7.7
        n = np.floor((x + 40 + row * 3) / 2.2).astype(int)
        palette = np.array([colour(c) for c in ("#d13a30", "#2f6fc2", "#f2c14e", "#3a9a48", "#eeeee6", "#6a3a8a", "#e08a2e")])
        out = palette[(n * 5 + row.astype(int)) % 7] * (0.9 + (n % 3)[:, None] * 0.06)
        out[height < 0.9] = colour("#6a4628")
        out[height > 6.6 - (n * 37 % 3) * 0.7] = colour("#3a2414")
        return out
    return [
        R(-14, 14, -5, 5, 0, 25, 0.5, WOOD_DARK, lambda q: grain(q, DARK)),
        R(-13, 13, 4.6, 5.2, 1, 24, 0.1, "#46291a", books),
        # A vase and a photo on top.
        T((-8, 0, 25), (-8, 0, 29.5), 1.6, 1.1, "#3a78b8"), *[B(-8 + dx, dy, 30.5 + dz, 1.1, 1.1, 1.1, "#e8588a") for dx, dy, dz in ((0, 0, 0.8), (1, 0.4, 0), (-0.9, -0.3, 0.2))],
        R(4, 9, 0.6, 1.4, 25, 30, 0.3, "#c8a050", lambda q: np.where((np.abs(q[:, 0] - 6.5) < 1.9)[:, None] & (np.abs(q[:, 2] - 27.5) < 1.9)[:, None], colour("#9ccfe8"), colour("#c8a050"))),
    ]


def lamp():
    return [
        B(0, 0, 1, 4, 4, 1, WOOD_DARK),
        T((0, 0, 1), (0, 0, 22), 0.6, 0.6, "#c8a050"),
        T((0, 0, 28.5), (0, 0, 21.5), 3, 5.6, "#f2d48a", lambda q: tones(["#e8c47a", "#f2d48a"], 1 + (np.sin(np.arctan2(q[:, 1], q[:, 0]) * 9) > 0))),
        B(0, 0, 22.4, 2.4, 2.4, 1.3, "#fff5cc", glows=True),
    ]


def rug():
    stripes = ["#a8483a", "#e6c15a", "#a8483a", "#3f6c9a", "#f0e6cf", "#3f6c9a", "#a8483a", "#e6c15a", "#a8483a"]
    def woven(q):
        out = np.array([colour(c) for c in stripes])[np.clip(((q[:, 1] + 17) / 3.78).astype(int), 0, 8)]
        return out * (0.92 + value_noise(q[:, 0] * 1.8, q[:, 1] * 0.5)[:, None] * 0.12)
    fringe = lambda q: np.tile(colour("#f0e6cf"), (len(q), 1))
    return [R(-23, 23, -17, 17, 0, 0.9, 0.3, "#a8483a", woven), *sides(lambda s: [R(s * 23 - 1.6, s * 23 + 1.6, -16, 16, 0, 0.4, 0.15, "#f0e6cf", fringe)])]


def flower():
    return [
        T((0, 0, 0.5), (0, 0, 6), 2.8, 3.8, "#c0683c"),
        B(0, 0, 6.3, 3.5, 3.5, 0.5, "#3e2a1a"),
        T((0, 0, 6), (0.5, 0, 14), 0.45, 0.4, "#3e8e41"),
        B(3, 0.5, 10, 3, 1.2, 0.6, "#3e8e41"), B(-2.5, 0, 12, 2.6, 1.2, 0.6, "#4fa653"),
        *[B(0.5 + np.cos(i * 1.257) * 2.4, 0, 15.5 + np.sin(i * 1.257) * 2.4, 1.7, 0.8, 1.7, "#e8588a") for i in range(5)],
        B(0.5, 0.6, 15.5, 1.2, 0.7, 1.2, "#f2c14e"),
    ]


def bed():
    quilt = lambda q: np.where((np.abs(((q[:, 0] + q[:, 1] + 60) % 8) - 4) < 1)[:, None], colour("#7fb0d0"), colour("#5a8fb5")) * (0.94 + value_noise(q[:, 0] * 0.4, q[:, 1] * 0.4)[:, None] * 0.1)
    return [
        R(-13, 13, -21, 21, 1.5, 6, 1, WOOD, lambda q: grain(q, BIRCH, along=1)),
        *[T((x, y, 0), (x, y, 1.8), 0.9, 0.8, WOOD_DARK) for x in (-12, 12) for y in (-20, 20)],
        R(-13.5, 13.5, -22.5, -20.5, 0.5, 17, 1, WOOD_DARK, lambda q: grain(q, DARK)),
        R(-13.5, 13.5, 20.5, 22, 0.5, 9, 0.8, WOOD_DARK, lambda q: grain(q, DARK)),
        R(-12, 12, -20, 20, 5, 9, 1.8, "#f4f1e8"),
        R(-12.7, 12.7, -7, 20.5, 5.5, 10, 2, "#5a8fb5", quilt),
        R(-12.8, 12.8, -8.2, -6.4, 6, 10.4, 0.8, "#f4f1e8"),
        B(-5.5, -15, 10, 5, 3.5, 1.8, "#ffffff"), B(5.5, -15, 10, 5, 3.5, 1.8, "#fff4d8"),
        B(6, 8, 11.4, 2.4, 2.8, 2.2, "#b0703a"), B(6, 8, 14.2, 1.7, 1.6, 1.6, "#b0703a"),  # a teddy bear
        *[B(6 + dx, 8.6, 15.4, 0.6, 0.4, 0.6, "#8a5028") for dx in (-1.3, 1.3)],
    ]


def wardrobe():
    return [
        R(-13, 13, -6.5, 6.5, 1.2, 31, 0.8, "#8e6a4a", lambda q: grain(q, ["#7e5a3a", "#8e6a4a", "#9e7a5a"])),
        R(-14, 14, -7, 7, 31, 32.5, 0.4, "#6b4e36"),
        *[R(x - 5.8, x + 5.8, 6.3, 6.8, 2.5, 29.5, 0.1, "#a67e5a", lambda q: grain(q, ["#9a7250", "#a67e5a", "#b08a64"])) for x in (-6.5, 6.5)],
        *[T((x, 7.1, 13), (x, 7.1, 17), 0.45, 0.45, "#e6d3b0") for x in (-1.2, 1.2)],
        *[T((x, y, 0), (x, y, 1.4), 0.8, 0.7, WOOD_DARK) for x in (-12, 12) for y in (-5.5, 5.5)],
        R(-9, 2, -4.5, 4.5, 32.5, 38, 0.8, "#c8a070"),  # a box on top
        R(-9.2, 2.2, -4.7, 4.7, 37.2, 38.4, 0.4, "#b08a5a"),
    ]


FURNITURE = {"sofa": sofa, "tv": tv, "table": table, "chair": chair, "stove": stove, "cupboard": cupboard, "fridge": fridge, "freezer": freezer,
             "toilet": toilet, "bathtub": bathtub, "shower": shower, "sink": sink, "washer": washer, "mirror": mirror, "bookcase": bookcase,
             "lamp": lamp, "rug": rug, "flower": flower, "bed": bed, "wardrobe": wardrobe}
FACINGS = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # MODEL_FACINGS in src/world.js


def place(key, spot=None, shapes=None):
    """A piece, turned and moved to its spot: its parts, and the box it's in."""
    x, y, facing = spot or SPOTS[key]
    cx, cy = (x + 0.5) * TILE, (y + 0.5) * TILE
    fx, fy = FACINGS[facing]
    shapes = shapes or FURNITURE[key]()
    to_local = lambda p: np.stack([(p[:, 0] - cx) * fy - (p[:, 1] - cy) * fx, (p[:, 0] - cx) * fx + (p[:, 1] - cy) * fy, p[:, 2]], 1)
    def part(chosen):
        if not chosen:
            return None
        def field(p):
            q = to_local(p)
            return np.minimum.reduce([s.field(q) for s in chosen])
        def paint(p):
            q = to_local(p)
            which = np.argmin([s.field(q) for s in chosen], axis=0)
            out = np.zeros((len(p), 3))
            for i, s in enumerate(chosen):
                on = which == i
                if on.any():
                    out[on] = s.paint(q[on]) if s.paint else colour(s.tone)
            return out
        return field, paint
    parts = []
    for glows in (False, True):
        made = part([s for s in shapes if s.glows == glows])
        if made:
            parts.append((*made, glows))
    lows, highs = np.array([s.low for s in shapes]), np.array([s.high for s in shapes])
    corners = np.array([[a, b] for a in (lows[:, 0].min(), highs[:, 0].max()) for b in (lows[:, 1].min(), highs[:, 1].max())])
    world = np.stack([cx + corners[:, 0] * fy + corners[:, 1] * fx, cy + corners[:, 1] * fy - corners[:, 0] * fx], 1)
    low = (world[:, 0].min() - 1, world[:, 1].min() - 1, 0)
    high = (world[:, 0].max() + 1, world[:, 1].max() + 1, highs[:, 2].max() + 1)
    return parts, low, high


# ------------------------------------------------------------------ the rooms
def letter_at(x, y):
    tx, ty = np.clip((x // TILE).astype(int), 0, ROOM.width - 1), np.clip((y // TILE).astype(int), 0, ROOM.height - 1)
    rows = np.array([list(r) for r in ROOM.map])
    return rows[ty, tx]


def room_of(x, y):
    """Which room a point is in: living, kitchen, bedroom, hall or bath."""
    living = (y < 10.5 * TILE) & (x < 13.5 * TILE)
    kitchen = (y < 10.5 * TILE) & (x >= 13.5 * TILE)
    bedroom = (y >= 10.5 * TILE) & (x < 10.5 * TILE)
    bath = (y >= 10.5 * TILE) & (x >= 15.5 * TILE)
    return np.select([living, kitchen, bedroom, bath], ["living", "kitchen", "bedroom", "bath"], "hall")


WALL_TONES = {"living": "#eedcb8", "kitchen": "#f2e8c0", "bedroom": "#d4dcc4", "hall": "#e8d8bc", "bath": "#e4eeee"}


def wall_tone(p, x, y, along, z):
    """A room's wall at these points: its colour with a pattern, tiles in the bathroom and the kitchen, and a skirting board."""
    which = room_of(x, y)
    out = np.array([colour(WALL_TONES[w]) for w in which]) * (0.97 + value_noise(along * 0.08, z * 0.08)[:, None] * 0.05)
    living = which == "living"
    out[living & (((along + 300) % 6) < 1.2)] = out[living & (((along + 300) % 6) < 1.2)] * 0.95  # striped wallpaper
    bedroom = which == "bedroom"
    dots = bedroom & (np.hypot(((along + 300) % 5) - 2.5, (z % 5) - 2.5) < 0.5)
    out[dots] = out[dots] * 0.9
    tiled = (which == "bath") | ((which == "kitchen") & (z > 13) & (z < 22))
    grout = tiled & ((((along + 300) % 4) < 0.25) | ((z % 4) < 0.25))
    out[tiled] = np.where(which[tiled, None] == "bath", colour("#e8f2f4"), colour("#f4f0e4"))
    out[grout] = colour("#b8c4c8")
    out[(z < 2) & ~(which == "bath")] = colour("#8a6038")
    out[(z < 2) & (which == "bath")] = colour("#9ab0b8")
    return out


def home_wall_x(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    out = wall_tone(p, x + 6, y, y, z)
    out[z > WALL_H - 1.6] = colour("#fbf7e8")
    out[ROOM.window_hole_x(p) < 1.5] = colour("#f6f2e6")
    # A landscape over the television, and a picture in the bedroom.
    for (a, b, low, high), image in (((4.7, 6.3, 22, 31), _painting(False)), ((12.4, 13.8, 20, 28), _painting(True))):
        u, v = (y - a * TILE) / ((b - a) * TILE), (high - z) / (high - low)
        frame = (u > -0.05) & (u < 1.05) & (v > -0.07) & (v < 1.07)
        out[frame] = colour("#c8a050")
        on = (u > 0) & (u < 1) & (v > 0) & (v < 1)
        out[on] = texture(image, u[on], v[on])
    return out


def home_wall_y(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    out = wall_tone(p, x, y + 6, x, z)
    out[z > WALL_H - 1.6] = colour("#fbf7e8")
    out[ROOM.window_hole_y(p) < 1.5] = colour("#f6f2e6")
    # A clock in the kitchen.
    d = np.hypot(x - 14.8 * TILE, z - 28)
    out[d < 3.6] = colour("#3b2a1a")
    out[d < 3.0] = colour("#fbf7e8")
    angle = np.arctan2(x - 14.8 * TILE, z - 28)
    out[(d < 2.5) & (np.abs(angle - 0.55) < 0.14)] = colour("#1a1a1a")
    out[(d < 1.8) & (np.abs(angle + 1.4) < 0.2)] = colour("#1a1a1a")
    return out


# The low walls between the rooms: each straight run of H inside the house, a wall down the middle of its tiles, with a wooden cap.
def inner_runs():
    """Each straight run of H inside the house, two tiles long or more: ("x", from, to, row) along x, ("y", from, to, column) along y."""
    found = []
    for x0, x1, y in ROOM.runs("H"):
        x0, x1 = max(x0, 2), min(x1, ROOM.width - 2)
        if 2 <= y < ROOM.height - 2 and x1 - x0 >= 2:
            found.append(("x", x0, x1, y))
    for y0, y1, x in ROOM.runs_y("H"):
        y0, y1 = max(y0, 2), min(y1, ROOM.height - 2)
        if 2 <= x < ROOM.width - 2 and y1 - y0 >= 2:
            found.append(("y", y0, y1, x))
    return found


INNER = inner_runs()


def inner_boxes():
    boxes = []
    for way, a, b, at in INNER:
        if way == "x":
            boxes.append(((a * TILE, at * TILE + 5, 0), (b * TILE, at * TILE + 11, INNER_H)))
        else:
            boxes.append(((at * TILE + 5, a * TILE, 0), (at * TILE + 11, b * TILE, INNER_H)))
    return boxes


INNER_BOXES = inner_boxes()


def inner_walls(p):
    return np.minimum.reduce([box(p, low, high) for low, high in INNER_BOXES] + [box(p, (low[0] - 0.6, low[1] - 0.6, INNER_H), (high[0] + 0.6, high[1] + 0.6, INNER_H + 1.2)) for low, high in INNER_BOXES])


def inner_paint(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    # Each face takes the room it faces: look a little way out from the wall.
    out = np.zeros((len(p), 3))
    for low, high in INNER_BOXES:
        on = (x > low[0] - 0.7) & (x < high[0] + 0.7) & (y > low[1] - 0.7) & (y < high[1] + 0.7)
        if not on.any():
            continue
        mx, my = (low[0] + high[0]) / 2, (low[1] + high[1]) / 2
        wide = high[0] - low[0] > high[1] - low[1]
        out_x = np.where(wide, x[on], np.where(x[on] > mx, x[on] + 6, x[on] - 6))
        out_y = np.where(wide, np.where(y[on] > my, y[on] + 6, y[on] - 6), y[on])
        out[on] = wall_tone(p[on], out_x, out_y, x[on] if wide else y[on], z[on])
    cap = z > INNER_H - 0.05
    out[cap] = tones(["#8a6038", "#9a6c40"], 1 + value_noise(x[cap] * 0.1, y[cap] * 0.1))
    return out


def curtains(p):
    d = [np.full(len(p), 1e3)]
    for a, b in WINDOWS_X:
        for edge in (a * TILE - 2.5, b * TILE + 2.5):
            d.append(box(p, (ROOM.x0, edge - 2.5, ROOM.win_low - 3), (ROOM.x0 + 1.6, edge + 2.5, ROOM.win_high + 1.5)))
        d.append(box(p, (ROOM.x0, a * TILE - 6, ROOM.win_high + 1.5), (ROOM.x0 + 1.2, b * TILE + 6, ROOM.win_high + 2.3)))
    for a, b in WINDOWS_Y:
        for edge in (a * TILE - 2.5, b * TILE + 2.5):
            d.append(box(p, (edge - 2.5, ROOM.y0, ROOM.win_low - 3), (edge + 2.5, ROOM.y0 + 1.6, ROOM.win_high + 1.5)))
        d.append(box(p, (a * TILE - 6, ROOM.y0, ROOM.win_high + 1.5), (b * TILE + 6, ROOM.y0 + 1.2, ROOM.win_high + 2.3)))
    return np.minimum.reduce(d)


CURTAIN_TONES = {"living": "#c8642c", "kitchen": "#e8c84a", "bedroom": "#5a8ab8", "hall": "#a84838", "bath": "#e4eeee"}


def curtain_paint(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    which = room_of(x + 6, y + 6)
    out = np.array([colour(CURTAIN_TONES[w]) for w in which])
    along = np.where(x < ROOM.x0 + 2, y, x)
    out = out * (0.86 + 0.16 * (np.sin(along * 1.6) > 0))[:, None]
    out[z > ROOM.win_high + 1.45] = colour("#c8a050")
    return out


def radiators(p):
    d = [box(p, (ROOM.x0, a * TILE + 3, 3), (ROOM.x0 + 2, b * TILE - 3, 11)) for a, b in WINDOWS_X]
    return np.minimum.reduce(d)


def radiator_paint(p):
    out = np.tile(colour("#eceae2"), (len(p), 1))
    out[((p[:, 1] + 300) % 2.2) < 0.7] = colour("#b8b6ac")
    return out


def kitchen_wall_things(p):
    """Over the stove a hood with a light under it, and a shelf with plates and jars over the freezer."""
    y0 = ROOM.y0
    sx = (SPOTS["stove"][0] + 0.5) * TILE
    fx = (SPOTS["freezer"][0] + 0.5) * TILE
    d = [box(p, (sx - 8.5, y0, 24), (sx + 8.5, y0 + 9, 26)), box(p, (sx - 4, y0, 26), (sx + 4, y0 + 4, WALL_H - 1.6)),
         box(p, (fx - 11, y0, 22), (fx + 11, y0 + 4.5, 23))]
    d += [box(p, (fx - 10 + i * 4.2, y0 + 0.6, 23), (fx - 10 + i * 4.2 + 0.7, y0 + 3.6, 27.5)) for i in range(3)]  # plates standing
    d += [np.maximum(np.hypot(p[:, 0] - (fx + 2 + i * 3.4), p[:, 1] - y0 - 2.2) - 1.3, np.maximum(23 - p[:, 2], p[:, 2] - 26.4)) for i in range(3)]
    return np.minimum.reduce(d)


def kitchen_wall_paint(p):
    x, z = p[:, 0], p[:, 2]
    fx = (SPOTS["freezer"][0] + 0.5) * TILE
    out = np.tile(colour("#dfe2e4"), (len(p), 1))
    shelf = (x > fx - 11.5) & (x < fx + 11.5)
    out[shelf] = tones(["#a87a4a", "#b98a58"], 1 + value_noise(x[shelf] * 0.1, z[shelf]))
    plates = shelf & (z > 23.05) & (x < fx - 0.5)
    out[plates] = np.array([colour("#f4f1e8"), colour("#5a8ab8"), colour("#f4f1e8")])[np.clip(((x[plates] - fx + 10) / 4.2).astype(int), 0, 2)]
    jars = shelf & (z > 23.05) & (x > fx + 0.5)
    out[jars] = np.array([colour("#e8b830"), colour("#c8372d"), colour("#8a6038")])[np.clip(((x[jars] - fx - 0.6) / 3.4).astype(int), 0, 2)]
    return out


def hood_light(p):
    sx = (SPOTS["stove"][0] + 0.5) * TILE
    return box(p, (sx - 6, ROOM.y0 + 2, 23.7), (sx + 6, ROOM.y0 + 7, 24.05))


def sconces(p):
    """A wall lamp in the bedroom, between its windows, glowing."""
    return np.maximum(np.hypot(p[:, 1] - 11.5 * TILE, p[:, 2] - 24) - 2.2, np.maximum(ROOM.x0 - 0.5 - p[:, 0], p[:, 0] - ROOM.x0 - 2.6))


def sconce_paint(p):
    out = np.tile(colour("#fff0c0"), (len(p), 1))
    out[p[:, 0] < ROOM.x0 + 0.6] = colour("#c8a050")
    return out


# ------------------------------------------------------------------ the floor
def floor_paint(p):
    x, y = p[:, 0], p[:, 1]
    letter = letter_at(x, y)
    # Under a low wall, the floor of the room on each side.
    on_wall = letter == "H"
    for low, high in INNER_BOXES:
        on = on_wall & (x >= low[0] - 6) & (x <= high[0] + 6) & (y >= low[1] - 6) & (y <= high[1] + 6)
        wide = high[0] - low[0] > high[1] - low[1]
        mx, my = (low[0] + high[0]) / 2, (low[1] + high[1]) / 2
        if on.any():
            letter[on] = letter_at(np.where(wide, x[on], np.where(x[on] > mx, x[on] + 8, x[on] - 8)), np.where(wide, np.where(y[on] > my, y[on] + 8, y[on] - 8), y[on]))
    out = np.zeros((len(p), 3))
    # Under something in a corner, the room's own floor.
    corner = letter == "n"
    if corner.any():
        letter[corner] = np.array([{"living": "F", "hall": "F", "kitchen": "f", "bedroom": "c", "bath": "j"}[w] for w in room_of(x[corner], y[corner])])
    wood = (letter == "F") | (letter == "H") | np.isin(letter, ["Y", "J", "I"])
    if wood.any():
        q = p[wood]
        board = np.floor(q[:, 1] / 5.3)
        length = np.floor((q[:, 0] + board * 23) / 52)
        tone = value_noise(board * 3.3, length * 2.7)
        out[wood] = colour("#b98a58") * (0.82 + tone[:, None] * 0.22 + value_noise(q[:, 0] * 0.18, q[:, 1] * 2.4)[:, None] * 0.1)
        seam = ((q[:, 1] % 5.3) < 0.3) | (((q[:, 0] + board * 23) % 52) < 0.3)
        out[np.nonzero(wood)[0][seam]] *= 0.74
    tiles = letter == "f"
    if tiles.any():
        q = p[tiles]
        check = (np.floor(q[:, 0] / 8) + np.floor(q[:, 1] / 8)) % 2
        out[tiles] = np.where(check[:, None] == 0, colour("#ece4cc"), colour("#a8b890")) * (0.95 + value_noise(q[:, 0] * 0.3, q[:, 1] * 0.3)[:, None] * 0.07)
        grout = ((q[:, 0] % 8) < 0.3) | ((q[:, 1] % 8) < 0.3)
        out[np.nonzero(tiles)[0][grout]] = colour("#8a8a7a")
    carpet = letter == "c"
    if carpet.any():
        q = p[carpet]
        out[carpet] = colour("#c8a49a") * (0.9 + value_noise(q[:, 0] * 1.7, q[:, 1] * 1.7)[:, None] * 0.12 + value_noise(q[:, 0] * 0.1, q[:, 1] * 0.1)[:, None] * 0.05)
    bath = letter == "j"
    if bath.any():
        q = p[bath]
        i, j = np.floor(q[:, 0] / 3.2), np.floor(q[:, 1] / 3.2)
        out[bath] = np.where((((i + j) % 6 == 0) & ((i - j) % 6 == 0))[:, None], colour("#7fb0d0"), colour("#eef4f4")) * (0.97 + value_noise(i * 0.7, j * 0.7)[:, None] * 0.05)
        grout = ((q[:, 0] % 3.2) < 0.25) | ((q[:, 1] % 3.2) < 0.25)
        out[np.nonzero(bath)[0][grout]] = colour("#a8b8bc")
    # A doormat in the hall, inside the front door.
    mat = (np.abs(x - 12.5 * TILE) < 14) & (np.abs(y - 17.4 * TILE) < 7)
    out[mat] = colour("#6a5a44") * (0.85 + value_noise(x[mat] * 2, y[mat] * 2)[:, None] * 0.2)
    out[mat & ((np.abs(x - 12.5 * TILE) > 12) | (np.abs(y - 17.4 * TILE) > 5))] = colour("#4a3e30")
    return out


# ---------------------------------------------------------- in the corners
def tall_plant(q):
    d = [T((0, 0, 0), (0, 0, 9), 4.6, 5.2, "#c0683c"), T((0, 0, 8.5), (0, 0, 9.5), 5.4, 5.4, "#a84e2e"), B(0, 0, 9.4, 4.8, 4.8, 0.5, "#3e2a1a"),
         T((0, 0, 9), (0.5, 0.3, 24), 0.7, 0.5, "#6a5038")]
    d += [B(np.cos(i * 2.4) * (2.5 + i % 3 * 1.4), np.sin(i * 2.4) * (2.5 + i % 3 * 1.4), 15 + i * 2, 3.6, 3.2, 2.2, "#3e8248" if i % 2 else "#5a9a52") for i in range(9)]
    return d


def toy_box(q):
    return [R(-6, 6, -4.5, 4.5, 0, 8, 0.8, "#2f6fc2"), R(-6.3, 6.3, -4.8, 4.8, 8, 9, 0.4, "#e8b830"),
            B(-2.5, 0, 10.6, 2, 2, 2, "#d6443a"), R(1, 5, -2, 2, 9, 12, 0.5, "#3a9a48"), B(3, 0, 13.4, 1.4, 1.4, 1.4, "#f2c630"),
            T((-5, 3, 9.5), (-1, 3.5, 12), 0.6, 0.6, "#b0703a")]


def coat_stand(q):
    d = [T((0, 0, 0), (0, 0, 1.2), 4, 3.5, WOOD_DARK), T((0, 0, 1), (0, 0, 32), 0.7, 0.6, WOOD_DARK)]
    d += [T((0, 0, 29), (np.cos(a) * 3, np.sin(a) * 3, 31), 0.4, 0.4, WOOD_DARK) for a in (0.4, 2.2, 4.0)]
    d += [R(0.5, 5.5, -2.5, 2.5, 12, 29, 1.6, "#c8372d"), R(-5, -0.5, -1, 3.5, 14, 29.5, 1.6, "#2f5fa8"),
          B(0, -2, 32.4, 3.2, 3.2, 1.6, "#e8b830"), B(0, -2, 31.4, 4.2, 4.2, 0.4, "#e8b830")]  # a red coat, a blue one, a yellow hat
    d += [R(-6, -1, 2.5, 7, 0, 3, 1, "#3a3a48"), R(1, 6, 3, 7.5, 0, 3, 1, "#8a5028")]  # boots
    return d


def laundry(q):
    weave = lambda q: np.where((((q[:, 2] % 1.6) < 0.8) ^ ((np.arctan2(q[:, 1], q[:, 0]) * 6 % 1) < 0.5))[:, None], colour("#d8b884"), colour("#c09a64"))
    return [T((0, 0, 0), (0, 0, 10), 5.6, 6.4, "#d8b884", weave), B(-1.5, 0, 10.4, 4.4, 4.4, 1.6, "#f4f1e8"), B(2.5, 1.5, 10.8, 2.6, 2.6, 1.4, "#e8588a"),
            B(1, -2.5, 10.7, 2.6, 2.6, 1.4, "#7fb0d0")]


CORNER_THINGS = {(12, 2): tall_plant, (23, 9): tall_plant, (2, 17): toy_box, (14, 11): coat_stand, (19, 17): laundry}


def corner_parts():
    made = []
    for (tx, ty), maker in CORNER_THINGS.items():
        cx, cy = (tx + 0.5) * TILE, (ty + 0.5) * TILE
        shapes = maker(None)
        def field(p, shapes=shapes, cx=cx, cy=cy):
            q = p - np.array((cx, cy, 0))
            return np.minimum.reduce([s.field(q) for s in shapes])
        def paint(p, shapes=shapes, cx=cx, cy=cy):
            q = p - np.array((cx, cy, 0))
            which = np.argmin([s.field(q) for s in shapes], axis=0)
            out = np.zeros((len(p), 3))
            for i, s in enumerate(shapes):
                on = which == i
                if on.any():
                    out[on] = s.paint(q[on]) if s.paint else colour(s.tone)
            return out
        top = max(s.high[2] for s in shapes)
        made.append((field, paint, (cx - 6, cy - 6, 0), (cx + 6, cy + 6, top)))
    def field(p):
        return np.minimum.reduce([np.where(box(p, low, high) < 2, f(p), box(p, low, high)) for f, _, low, high in made])
    def paint(p):
        out = np.zeros((len(p), 3))
        for f, colours, low, high in made:
            on = (p[:, 0] > low[0] - 3) & (p[:, 0] < high[0] + 3) & (p[:, 1] > low[1] - 3) & (p[:, 1] < high[1] + 3)
            if on.any():
                out[on] = colours(p[on])
        return out
    return field, paint, [(low, high) for _, _, low, high in made]


# --------------------------------------------------------------- all of it
def assemble():
    ROOM.floor = floor_paint
    ROOM.wall_paint_x, ROOM.wall_paint_y = home_wall_x, home_wall_y
    walls = ROOM.walls_at
    ROOM.add(curtains, curtain_paint, walls)
    ROOM.add(radiators, radiator_paint, walls)
    ROOM.add(kitchen_wall_things, kitchen_wall_paint, walls)
    ROOM.add(hood_light, lambda p: np.tile(colour("#fff0c0"), (len(p), 1)), walls, glows=True)
    ROOM.add(sconces, sconce_paint, walls, glows=True)
    ROOM.add(inner_walls, inner_paint, "H")
    field, paint, boxes = corner_parts()
    ROOM.add(field, paint, "n")
    ROOM.occluders += boxes
    ROOM.occluders += [(low, high) for low, high in INNER_BOXES]
    for key in FURNITURE:
        parts, low, high = place(key)
        x, y, _ = SPOTS[key]
        ROOM.add_piece(key, parts, low, high, x + y + 1)
        if key != "rug":
            ROOM.occluders.append((low, (high[0], high[1], high[2] - 1)))
    # The rest of the kitchen's chairs and the empty sofa, made as the furniture is: the game knows them as decor-0, decor-1 and so on.
    for i, (kind, x, y, facing) in enumerate(MAPS["home"]["spots"]["decor"]):
        shapes = sofa(("#3e6a52", "#4a7a5e", "#5a8a6a"), blanket=False) if kind == "sofa" else FURNITURE[kind]()
        parts, low, high = place(kind, (x, y, facing), shapes)
        ROOM.add_piece(f"decor-{i}", parts, low, high, x + y + 1)
        ROOM.occluders.append((low, (high[0], high[1], high[2] - 1)))
    lamp_x, lamp_y, _ = SPOTS["lamp"]
    stove_x, _, _ = SPOTS["stove"]
    table_x, table_y, _ = SPOTS["table"]
    ROOM.pools = [((lamp_x + 0.5) * TILE, (lamp_y + 0.5) * TILE, 22.4), ((stove_x + 0.5) * TILE, ROOM.y0 + 4.5, 23.5), (ROOM.x0 + 3, 11.5 * TILE, 24),
                  ((table_x + 0.5) * TILE, (table_y + 0.5) * TILE, 26, 34)]  # the lamp over the kitchen table lights the table and round it
    ROOM.lamps = [pool[:2] for pool in ROOM.pools] + [(x * TILE, y * TILE) for x, y in CEILING_LAMPS]


assemble()

if __name__ == "__main__":
    make(["home"], int(sys.argv[1]) if sys.argv[1:] else 6)
