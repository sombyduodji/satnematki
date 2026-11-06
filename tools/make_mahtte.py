#!/usr/bin/env python3
"""Make the player characters: a 3D model of each, rendered into every sprite sheet.

The characters are shapes in 3D, looked at pixel by pixel and lit in three flat bands of hand-picked colours, which keeps
the pixel-art look. Colours, clothing and hair live here, so a correction is made once. The design follows Store norske
leksikon's article on the Karasjok kofta; see art/mahtte/README.md for what each part is and what still needs checking.

A sheet holds one gákti, gender and hairstyle. Hair and irises are drawn in key colours, which the game swaps for the
player's choice as it loads the sheet, so that there needn't be a sheet for every colour. It also writes where the mouth
is in each frame, for the game to open it while the character talks.

Usage: python3 tools/make_mahtte.py          everything, in parallel
       python3 tools/make_mahtte.py preview  only the pictures in art/mahtte/base/
"""
import json
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from itertools import product
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art/mahtte"

# Each ramp runs dark, mid, light.
BLUE = ("#17316a", "#2450a6", "#3a78d6")
RED = ("#7d1a24", "#bb2a2d", "#e44c3b")
YEL = ("#b57a14", "#ecb92e", "#ffe27a")
SKIN = ("#d08a62", "#e6a378", "#f9cda6")
LEATHER = ("#2d2227", "#4c3a36", "#6d5548")
FUR = ("#6b4629", "#a5784a", "#d3ad7c")
WHITE = ("#b9ae98", "#ece3cf", "#fbf6e8")
SILK = ("#c9c4b4", "#f4f0e4", "#ffffff")  # the boy's silk scarf; its colour varies, and white is the user's choice
# The girl's shawl: silk, with fringes in shades of its colours. The colours and flowers are a choice, not a rule.
SHAWL = ("#8e2348", "#c23a5e", "#e8637f")
SHAWL_FLOWER = ("#c9962e", "#f2d15c", "#ffe68a")
SHAWL_FRINGE = ("#b5722a", "#e8a84e", "#ffd27a")
SILVER = ("#8d95a3", "#d8dde6", "#eef1f5")
STOCKING = ("#101f47", "#17316a", "#2450a6")
PUPIL = ("#1d1420",) * 3
SCLERA = ("#fbf6e8",) * 3
BLUSH = ("#ee9078",) * 3
MOUTH = ("#a2483e",) * 3
OUTLINE = (27, 20, 32, 255)
# The colours the game swaps. Must match HAIR_KEYS and EYE_KEYS in src/game.js.
HAIR = ("#fe00a1", "#fe00a2", "#fe00a3")
STRAND = (HAIR[0], HAIR[0], HAIR[1])  # the darker lines that make it read as hair
IRIS = ("#00fea1", "#00fea2", "#00fea3")
RAMPS = [BLUE, RED, YEL, SKIN, LEATHER, FUR, WHITE, SILK, SILVER, STOCKING, PUPIL, SCLERA, BLUSH, MOUTH, HAIR, STRAND, IRIS, SHAWL, SHAWL_FLOWER, SHAWL_FRINGE, BLUE, RED, BLUE, LEATHER, RED, BLUE, BLUE, BLUE, FUR, YEL, RED, RED, YEL, ("#b5621f", "#e8902e", "#f8b860"), ("#2f6f2a", "#4f9a3e", "#7cc060")]
M = {name: i for i, name in enumerate(["blue", "red", "yel", "skin", "leather", "fur", "white", "silk", "silver", "stocking", "pupil", "sclera", "blush", "mouth", "hair", "strand", "iris", "shawl", "flower", "fringe", "top", "trim", "legs", "shoe", "hat", "apron", "long", "skirt", "beard", "badge", "basket", "slot", "band", "orange", "green"])}
COLOURS = np.array([[tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in ramp] for ramp in RAMPS], dtype=np.uint8)

# What the game shows for each hair colour in the pictures made here, and what the chooser in src/game.js swaps in.
HAIRS = {
    "blond": ("#a9782c", "#dcae4e", "#f6d98a"),
    "brown": ("#2f1b17", "#55321f", "#835433"),
    "red": ("#7c2a14", "#b5481d", "#e27a3a"),
}  # for the pictures made here; the game has its own slider through more colours, in HAIR_RAMPS
GENDERS = ("boy", "girl")
# Each gender has its own nine. The game's chooser numbers them, in this same order, in STYLES.
HAIR_STYLES = {
    "boy": ("short", "tousled", "parting", "swept", "crop", "fringe", "mid", "lowtail", "curls"),
    "girl": ("short", "tousled", "mid", "long", "braids", "bun", "ponytail", "bob", "curls"),
}
# The two gákti the player can choose, shown only as 1 and 2 with no place names, as the user decided. Both are the same
# documented kofta and differ in the belt. The names are internal; the leather belt is NOT a known Utsjoki feature.
OUTFITS = {"ohcejohka": {"belt": "leather"}, "karasjohka": {"belt": "woven"}}

look = {"outfit": "ohcejohka", "gender": "boy", "length": "short"}

FW, FH = 24, 40  # a frame in the world's pixels; tall enough for a full jump
DETAIL = 4  # the sheet's pixels to each of those
GROUND = 39  # the row the feet stand on, from the top
SWAYS = (-2, -1, 1, 2)  # how far the hem and hair ends move; 0 is the plain idle and walk rows
RUN_SWAYS = (-3, -2, -1, 0, 1, 2, 3)  # running throws them further than walking
# Looked at from a little above, less than the world's own angle, so that faces can be seen.
CAMERA_UP = np.radians(17)
LIGHT = np.array([-0.5, 0.62, 0.6]) / np.linalg.norm([-0.5, 0.62, 0.6])
# How far each view is turned. Side on is short of a true profile, as there both eyes would be lost.
YAW = {"down": 0, "se": 36, "right": 68, "ne": 130, "up": 180}


def is_girl():
    return look["gender"] == "girl"


# ------------------------------------------------------------------- shapes
# A shape has a distance function over points (n×3) in its group's space, and a paint function giving each point a material.
class Shape:
    def __init__(self, distance, paint, group="body"):
        self.distance, self.paint, self.group = distance, paint, group


def plain(material):
    return lambda p: np.full(len(p), M[material])


# The classrooms' chair, as in tools/make_classrooms.py: its seat's top and half its width. Sitting on it, the hips are over its middle and the back
# against its back, and what would sink into the seat lies on it instead: the gákti lies on it, and behind hangs down past its edge.
SEAT_TOP, SEAT_HALF = 6.8, 4.8


def on_seat(shape):
    def distance(p):
        d = shape.distance(p)
        over = (np.abs(p[:, 0]) < SEAT_HALF) & (np.abs(p[:, 1]) < SEAT_HALF)
        return np.where(over, np.maximum(d, SEAT_TOP - p[:, 2]), d)
    return Shape(distance, shape.paint, shape.group)


def ball(at, radii, paint, group="body", cut=None):
    at, radii = np.array(at, float), np.array(radii, float)
    def distance(p):
        q = p - at
        k0 = np.linalg.norm(q / radii, axis=1)
        k1 = np.linalg.norm(q / (radii * radii), axis=1)
        d = np.where(k1 > 1e-6, k0 * (k0 - 1) / np.maximum(k1, 1e-6), -radii.min())
        return np.maximum(d, cut(p)) if cut else d
    return Shape(distance, paint if callable(paint) else plain(paint), group)


def tube(a, b, r0, r1, paint, group="body", wide=1.0, floor=None):
    """A rounded cone from a to b. wide stretches its section along x, for the flat of a body. floor cuts it off flat there."""
    a, b = np.array(a, float), np.array(b, float)
    scale = np.array([1 / wide, 1, 1])
    a2, b2 = a * scale, b * scale
    u = b2 - a2
    uu = max(float(u @ u), 1e-9)
    def distance(p):
        q = p * scale - a2
        along = np.clip((q @ u) / uu, 0, 1)
        d = (np.linalg.norm(q - np.outer(along, u), axis=1) - (r0 + (r1 - r0) * along)) * min(1, wide)
        return d if floor is None else np.maximum(d, floor - p[:, 2])
    return Shape(distance, paint if callable(paint) else plain(paint), group)


def turn_x(p, angle, about):
    """Tips points about the x axis through a point: positive leans the top forward, towards +y."""
    c, s = np.cos(angle), np.sin(angle)
    q = p - about
    return np.stack([q[:, 0], c * q[:, 1] - s * q[:, 2], s * q[:, 1] + c * q[:, 2]], axis=1) + about


def around(p):
    """How far round a point is from the front, in radians."""
    return np.arctan2(p[:, 0], p[:, 1])


# ------------------------------------------------------------------- the head
HEAD_RX, HEAD_RY, HEAD_RZ = 5.5, 5.1, 5.0


def face_paint(centre, blink):
    """Painted on the head, so it turns with it. Big enough that the colour of the eyes shows."""
    cx, cy, cz = centre
    glasses = look.get("glasses")
    def paint(p):
        x, y, z = p[:, 0] - cx, p[:, 1] - cy, p[:, 2] - cz
        out = np.full(len(p), M["skin"])
        front = y > 0.6
        for side in (-1, 1):
            ex, ez = x - side * 2.35, z + 0.35
            if blink:
                out[front & (np.abs(ex) < 1.35) & (np.abs(ez + 0.3) < 0.28)] = M["pupil"]
                continue
            eye = front & ((ex / 1.42) ** 2 + (ez / 1.75) ** 2 < 1)
            out[eye] = M["sclera"]
            out[eye & ((ex / 1.22) ** 2 + ((ez + 0.12) / 1.62) ** 2 < 1)] = M["iris"]
            out[eye & ((ex / 0.58) ** 2 + ((ez + 0.12) / 0.8) ** 2 < 1)] = M["pupil"]
            out[eye & (((ex + 0.4) / 0.36) ** 2 + ((ez - 0.5) / 0.42) ** 2 < 1)] = M["sclera"]
            out[eye & (ez > 1.05)] = M["pupil"]  # the lashes along the top
            cheek = front & (((x - side * 3.55) / 0.85) ** 2 + ((z + 2.1) / 0.45) ** 2 < 1)
            out[cheek] = M["blush"]
            if glasses:
                ring = (ex / 1.85) ** 2 + (ez / 2.15) ** 2
                out[front & (ring > 0.82) & (ring < 1.12)] = M["leather"]
        out[front & (np.abs(x) < 0.95) & (np.abs(z + 2.95 + x * x * 0.1) < 0.2)] = M["mouth"]
        return out
    return paint


def value_at(p):
    """A fine, even grain over a head of closely cut hair."""
    n = np.sin(p[:, 0] * 12.9898 + p[:, 1] * 78.233 + p[:, 2] * 37.719) * 43758.5453
    return n - np.floor(n)


def hair_paint(p, cx, cy):
    """Fine dark lines running round from the crown."""
    angle = np.arctan2(p[:, 0] - cx, p[:, 1] - cy)
    return np.where(np.abs(((angle + 7) % 0.55) - 0.27) < 0.045, M["strand"], M["hair"])


def hair_shapes(centre, sway, world_x, lift=0):
    """sway bends what hangs, along the screen's x, the ends moving furthest; lift raises it in a fall."""
    cx, cy, cz = centre
    length = look["length"]
    shapes = []
    if length == "bald":  # what's left, above the ears and round the back
        fringe = lambda p: np.maximum(p[:, 2] - cz - 0.6, np.maximum(p[:, 1] - cy - 1.4, cz - 2.6 - p[:, 2]))
        return [ball(centre, (HEAD_RX + 0.3, HEAD_RY + 0.3, HEAD_RZ + 0.3), lambda p: hair_paint(p, cx, cy), "head", cut=fringe)]
    bend = lambda reach: np.array(world_x) * sway * 0.55 * reach * reach
    # What's left of a shell round the head once the face has been taken out of it.
    face_hole = lambda p: 4.6 - np.linalg.norm((p - np.array([cx, cy + 4.1, cz - 1.9])) / np.array([1.32, 1, 1.02]), axis=1)
    if length == "crop":  # cut very close, following the head, with a clean hairline
        close_hole = lambda p: 4.75 - np.linalg.norm((p - np.array([cx, cy + 4.1, cz - 1.5])) / np.array([1.3, 1, 1.02]), axis=1)
        shapes.append(ball(centre, (HEAD_RX + 0.14, HEAD_RY + 0.14, HEAD_RZ + 0.14), lambda p: np.where(value_at(p * 3.2) > 0.42, M["hair"], M["strand"]), "head", cut=close_hole))
    elif length == "fringe":  # all one length round the head, down to the ears, with a straight fringe across the brow
        def bowl_cut(p):
            front = np.maximum(p[:, 1] - cy - 2.2, 0) * 2
            return (cz - 2.2 + front * 0.9 + np.where(p[:, 1] > cy + 2.2, 2.2, 0)) - p[:, 2]
        shapes.append(ball(centre, (HEAD_RX + 0.75, HEAD_RY + 0.75, HEAD_RZ + 0.5), lambda p: hair_paint(p, cx, cy), "head", cut=bowl_cut))
    elif length == "swept":  # brushed back off the face, with height at the front
        shapes.append(ball(centre, (HEAD_RX + 0.42, HEAD_RY + 0.42, HEAD_RZ + 0.42), lambda p: np.where(np.abs(((p[:, 0] + 40) % 1.5) - 0.75) < 0.16, M["strand"], M["hair"]), "head", cut=face_hole))
        shapes.append(ball((cx, cy + 1.2, cz + 3.6), (4.4, 3.6, 2.2), lambda p: np.where(np.abs(((p[:, 0] + 40) % 1.5) - 0.75) < 0.16, M["strand"], M["hair"]), "head"))
    else:
        shapes.append(ball(centre, (HEAD_RX + 0.42, HEAD_RY + 0.42, HEAD_RZ + 0.42), lambda p: hair_paint(p, cx, cy), "head", cut=face_hole))
    if length == "parting":  # parted on one side, and combed across the brow to the other
        for x, z, wide in ((-2.6, 3.4, 2), (-0.2, 3, 2.3), (2.3, 2.6, 2.2), (4, 1.5, 1.3)):
            shapes.append(ball((cx + x, cy + 3.7 - abs(x) * 0.26, cz + z), (wide, 1.15, 1.25), "hair", "head"))
        shapes.append(tube((cx - 3.7, cy + 3.2, cz + 3.1), (cx - 3.3, cy - 2.5, cz + 4.5), 0.2, 0.15, "strand", "head"))
    elif length not in ("crop", "fringe", "swept"):
        # The fringe, in a few locks.
        for x, drop in ((-3.5, 1.6), (-1.3, 1.0), (1.2, 1.3), (3.4, 1.7)):
            shapes.append(ball((cx + x, cy + 3.9 - abs(x) * 0.28, cz + 2.9 - drop * 0.55), (1.7, 1.1, drop), "hair", "head"))
    if length == "tousled":
        for x, y, rise in ((-3.6, -0.4, 2.3), (-1.2, 1, 2.8), (1.4, -0.6, 3), (3.6, 0.6, 2.3)):
            tip = np.array([cx + x * 1.1 + np.sign(sway) * 0.6, cy + y, cz + HEAD_RZ + rise - 0.2])
            shapes.append(tube((cx + x * 0.8, cy + y, cz + HEAD_RZ - 1), tip, 1.4, 0.25, "hair", "head"))
    elif length in ("short", "parting", "swept", "fringe") and sway:
        shapes.append(tube((cx + 3 * np.sign(sway), cy - 2.5, cz + 0.5), (cx + 4.8 * np.sign(sway), cy - 3, cz - 1.8), 1.2, 0.4, "hair", "head"))
    if length == "bun":  # gathered in a round knot high at the back, with a fine line round it
        knot = (cx, cy - 3.2, cz + 4)
        shapes.append(ball(knot, (2.5, 2.5, 2.3), lambda p: hair_paint(p, knot[0], knot[1]), "head"))
    if length == "ponytail":  # tied high at the back with a red band, and swinging freely
        tie = np.array((cx, cy - 4.9, cz + 2))
        shapes.append(ball(tie, (1.25, 1.1, 1.1), "red", "head"))
        middle = tie + np.array((0, -1.6, -3.4)) + bend(0.45) * 1.4
        end = tie + np.array((0, -1.4, -9.6 + lift)) + bend(1) * 1.6
        shapes.append(tube(tie, middle, 1.2, 1.75, lambda p: hair_paint(p, cx, cy), "head"))
        shapes.append(tube(middle, end, 1.75, 0.45, lambda p: hair_paint(p, cx, cy), "head"))
    if length == "lowtail":  # tied low at the nape, and hanging down the back
        tie = np.array((cx, cy - 4.5, cz - 2.4))
        shapes.append(ball(tie, (1.05, 0.95, 0.9), "leather", "head"))
        end = tie + np.array((0, -0.9, -6.4 + lift)) + bend(1) * 1.3
        shapes.append(tube(tie, end, 1.15, 0.55, lambda p: hair_paint(p, cx, cy), "head"))
    if length == "bob":  # a full, rounded cut ending at the chin, all one length
        shapes.append(tube((cx, cy - 1.4, cz), (cx + bend(1)[0], cy - 2.2 + bend(1)[1], cz - 4.2 + lift * 0.4), 5.5, 5, lambda p: hair_paint(p, cx, cy), "head", wide=1.1))
        for side in (-1, 1):
            shapes.append(ball((cx + side * 5.4 + bend(0.8)[0], cy + 0.8 + bend(0.8)[1], cz - 3.2 + lift * 0.4), (1.6, 2.2, 2.6), lambda p: hair_paint(p, cx, cy), "head"))
    if length == "curls":  # springy curls standing out all round
        rng = np.random.default_rng(5)
        for _ in range(30):
            angle = rng.uniform(1.0, 5.3)  # round the back and sides, leaving the face clear
            high = rng.uniform(-0.65, 1)
            r = np.sqrt(max(0.05, 1 - high * high))
            at = (cx + np.sin(angle) * r * (HEAD_RX + 0.5), cy + np.cos(angle) * r * (HEAD_RY + 0.5), cz + high * (HEAD_RZ + 0.8))
            size = rng.uniform(1.5, 2.2)
            shapes.append(ball(tuple(np.array(at) + bend(max(0, -high)) * 0.6), (size, size, size), lambda p: hair_paint(p, cx, cy), "head"))
    if length in ("mid", "long"):
        # Down the back, and a lock in front of each shoulder.
        drop = 8 if length == "mid" else 13
        end = cz - drop + lift * 0.8
        shapes.append(tube((cx, cy - 1.7, cz - 0.5), (cx + bend(1)[0], cy - 3.4 + bend(1)[1], end), 4.9, 2.7, lambda p: hair_paint(p, cx, cy), "head", wide=1.08))
        for side in (-1, 1):
            shapes.append(tube((cx + side * 5, cy + 0.3, cz - 0.8), (cx + side * 5 + bend(1)[0], cy + 0.2 + bend(1)[1], cz - drop * 0.82 + lift * 0.8), 1.5, 0.75, "hair", "head"))
    if length == "braids":
        for side in (-1, 1):
            top = np.array((cx + side * 5, cy - 1.2, cz - 1.8))
            for i in range(9):
                t = i / 8
                at = top + np.array((side * 0.35, 0.6 * t, -11.5 * t + lift * t)) + bend(t)
                shapes.append(ball(at, (1.5 - 0.3 * t, 1.5 - 0.3 * t, 1.05), "red" if i == 8 else "hair", "head"))
            shapes.append(ball(at + (0, 0, -1.4), (0.8, 0.8, 0.9), "hair", "head"))
    return shapes


# ---------------------------------------------------------------- the clothes
def torso_paint(belt, collar):
    girl = is_girl()
    def paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = np.full(len(p), M["blue"])
        front, back = y > 0.2, y < -0.2
        # Red chest cloth, split at the neck opening, edged in blue, with a narrow yellow and a red strip below it.
        chest = front & (np.abs(x) < 3.5) & (z > belt + 4.6) & (z < collar + 0.5)
        out[chest] = M["red"]
        out[front & (np.abs(x) < 3.5) & (z > belt + 3.85) & (z <= belt + 4.6)] = M["yel"]
        out[front & (np.abs(x) < 3.5) & (z > belt + 3) & (z <= belt + 3.85)] = M["red"]
        slit = np.abs(x) - (z - (belt + 4.8)) * 0.42
        out[chest & (slit < 0.4) & (slit > -0.15)] = M["blue"]
        if not girl:
            out[chest & (slit <= -0.15)] = M["silk"]  # the čeabetliidni, inside the opening
        else:
            out[chest & (slit <= -0.15)] = M["red"]
        # Hárdodilli, red and yellow across the back, and dearis, red down its seams to the belt.
        out[back & (z > collar - 3.1) & (z < collar - 2.2)] = M["red"]
        out[back & (z > collar - 3.9) & (z <= collar - 3.1)] = M["yel"]
        out[back & (np.abs(np.abs(x) - 2.5) < 0.42) & (z <= collar - 3.9)] = M["red"]
        return out
    return paint


def dress_paint(belt, collar):
    """Everyday clothes, for the classmates who aren't in a gákti: each kind with its own bands and seams."""
    kind = look["dress"]
    def paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = np.full(len(p), M["top"])
        if kind == "person":
            # Grown-ups and others about the place: a band across the chest, bands at the neck, an apron and a badge, each as they have.
            if look.get("stripe"):
                out[(z > belt + look["torso"] * 0.48) & (z < belt + look["torso"] * 0.48 + 1.1)] = M["trim"]
            for i, band in enumerate(look.get("bands", ())):
                out[(z < collar - 0.4 - i * 0.55) & (z > collar - 0.9 - i * 0.55)] = M[band]
            if look.get("apron"):
                out[(y > 0.3) & (np.abs(x) < 3.1 * look["w"]) & (z < collar - 1.7)] = M["apron"]
                out[(y <= 0.3) & (np.abs(np.abs(x) - 2) < 0.4) & (z > belt)] = M["apron"]
                out[(y < -0.3) & (np.abs(z - belt - 1) < 0.35)] = M["apron"]
            if look.get("badge"):
                out[(y > 0.3) & (np.abs(x - 1.8) < 0.8) & (np.abs(z - (collar - 3)) < 0.55)] = M["badge"]
            return out
        if kind == "knit":  # a round yoke of pattern at the shoulders, and a ribbed hem
            high = collar - z
            out[(high > 1) & (high < 1.7)] = M["trim"]
            out[(high > 2.5) & (high < 3.2)] = M["trim"]
            spots = (high >= 1.7) & (high <= 2.5) & (np.abs(((np.arctan2(x, y) + 7) % 0.5) - 0.25) < 0.1)
            out[spots] = M["trim"]
            out[(z < belt + 0.7) & (np.abs(((x + 40) % 0.8) - 0.4) < 0.12)] = M["trim"]
        elif kind == "anorak":  # a band across the chest and back, and a pocket
            at = belt + 4.6
            out[(z > at) & (z < at + 1.1)] = M["trim"]
            out[(y > 0.2) & (np.abs(x) < 2.4) & (z > belt + 0.6) & (z < belt + 2.6)] = M["trim"]
        elif kind == "parka":  # seams round the padding, and a zip
            out[np.abs(((z - belt + 40) % 2.6) - 1.3) < 0.13] = M["trim"]
            out[(y > 0.2) & (np.abs(x) < 0.26)] = M["trim"]
        else:  # a fleece: shoulders of another colour, and a zip at the neck
            out[z > collar - 3.2] = M["trim"]
            out[(y > 0.2) & (np.abs(x) < 0.24) & (z > collar - 5)] = M["hat"]
        return out
    return paint


def hat(centre):
    """A knitted hat with a turned-up edge and a bobble."""
    cx, cy, cz = centre
    def paint(p):
        z = p[:, 2] - cz
        out = np.full(len(p), M["hat"])
        out[np.abs(((np.arctan2(p[:, 0] - cx, p[:, 1] - cy) + 7) % 0.36) - 0.18) < 0.05] = M["trim"]
        out[z < 1.9] = M["hat"]
        out[(z < 1.9) & (np.abs(((p[:, 0] + p[:, 1] + 40) % 1) - 0.5) < 0.16)] = M["trim"]
        return out
    return [ball((cx, cy, cz + 0.9), (HEAD_RX + 0.75, HEAD_RY + 0.75, HEAD_RZ + 0.4), paint, "head", cut=lambda p: (cz + 0.5) - p[:, 2]),
            ball((cx, cy - 0.3, cz + HEAD_RZ + 2), (1.6, 1.6, 1.5), "trim", "head")]


def block(low, high, r, paint, carried=False, hollow=None):
    """A rounded box, cut hollow from its top if asked."""
    low, high = np.array(low, float), np.array(high, float)
    def distance(p):
        q = np.abs(p - (low + high) / 2) - (high - low) / 2 + r
        d = np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - r
        if hollow:
            inner = np.array((hollow, hollow, 0.6))
            q2 = np.abs(p - (low + high) / 2 - np.array((0, 0, 1.6))) - ((high - low) / 2 - inner + np.array((0, 0, 1.6)))
            d = np.maximum(d, -(np.linalg.norm(np.maximum(q2, 0), axis=1) + np.minimum(q2.max(axis=1), 0)))
        return d
    return Shape(distance, paint if callable(paint) else plain(paint))


GOOD_SHAPES = {
    "apple": lambda at, s: [ball(at + (0, 0, 1.1 * s), (1.15 * s,) * 3, "red")], "orange": lambda at, s: [ball(at + (0, 0, 1.05 * s), (1.1 * s,) * 3, "orange")],
    "milk": lambda at, s: [block(at + (-s, -s, 0), at + (s, s, 3.6 * s), 0.2, lambda p, z=at[2]: np.where(p[:, 2] < z + 1.6 * s, M["blue"], M["white"]))],
    "bread": lambda at, s: [tube(at + (-1.5 * s, 0, s), at + (1.5 * s, 0.4, 1.2 * s), s, 0.9 * s, "fur")], "cheese": lambda at, s: [block(at + (-1.2 * s, -0.9 * s, 0), at + (1.2 * s, 0.9 * s, 1.5 * s), 0.2, "yel")],
    "greens": lambda at, s: [ball(at + (0, 0, 0.9 * s), (1.35 * s, 1.35 * s, s), "green")], "parcel": lambda at, s: [block(at + (-1.3 * s, -s, 0), at + (1.3 * s, s, 1.8 * s), 0.2, "fur")],
    "mitten": lambda at, s: [ball(at + (0, 0, s), (1.2 * s, 0.9 * s, 1.4 * s), "blue")], "rope": lambda at, s: [ball(at + (0, 0, s), (1.15 * s,) * 3, "white")],
}


def basket_shapes(centre, s, tone="basket"):
    """A shopping basket, its middle at centre, with its rim at the height given."""
    c = np.array(centre, float)
    rim = c[2]
    def paint(p):
        out = np.full(len(p), M[tone])
        out[(np.abs(((p[:, 0] + p[:, 1] + 40) % 1.5) - 0.75) < 0.26) & (p[:, 2] < rim - 0.8) & (p[:, 2] > rim - 3.6 * s)] = M["slot"] if tone == "basket" else M["leather"]
        out[p[:, 2] > rim - 0.6] = M["white"]
        return out
    return [block(c + (-3.2 * s, -2.3 * s, -4 * s), c + (3.2 * s, 2.3 * s, 0), 0.5, paint, hollow=0.5)]


def carried_shapes(hand):
    """What someone has in the hand, each marked so that it alone is taken from the picture."""
    kind, goods, k = look["carry"]
    s = float(np.clip(k + 0.05, 0.7, 1))
    hx, hz = hand[0], hand[2]
    shapes = []
    if kind == "basket":
        cx = hx + 1.6 * s
        c = np.array((cx, 0.5, hz - 1.3))
        shapes += basket_shapes(c, s)
        shapes += [tube((cx + side * 2.4 * s, 0.5, hz - 1.3), hand, 0.25, 0.25, "leather") for side in (-1, 1)]
        for i, good in enumerate(goods):
            shapes += GOOD_SHAPES[good](c + np.array(((i - (len(goods) - 1) / 2) * 1.6 * s, (0.7 if i % 2 else -0.7) * s, -1.2 * s)), s)
    elif kind == "stack":
        at = np.array((0, 5.5, look["belt"] + 2.4))
        for i, tone in enumerate(("red", "blue", "green", "yel")):
            shapes += basket_shapes(at + (0, 0, i * 1.4), 1.1, tone)
    else:
        which = int(kind[3:])
        pattern = ("flag", "upright", "level")[which // 2]
        cx = hx + 2.2 * s
        wide, high = 3.6 * 1.3 * s, 6.5 * 1.3 * s
        top = max(hz - 1.8, high + 0.6)
        def paint(p):
            across, up = (p[:, 0] - cx) / (1.3 * s), (p[:, 2] - top) / (1.3 * s) + 3.25
            order = np.array([M["red"], M["green"], M["yel"], M["blue"]])
            if pattern == "upright":
                return order[np.clip(np.floor((across + 3.6) / 1.8).astype(int), 0, 3)]
            if pattern == "level":
                return order[np.clip(np.floor((3.25 - up) / 1.625).astype(int), 0, 3)]
            centre = across + 0.3
            out = order[np.select([centre < -0.7, centre < 0, centre < 0.7], [0, 1, 2], 3)]
            ring = np.abs(np.hypot(centre, up) - 2.1) < 0.45
            out[ring] = np.where(centre < 0, M["blue"], M["red"])[ring]
            return out
        if which % 2 == 0:
            shapes.append(block((cx - wide, -1.3 * s + 0.5, top - high), (cx + wide, 1.3 * s + 0.5, top), 0.4, paint))
            shapes += [tube((cx + side * 2.6 * s, 0.5, top), (hx, 0.4, hz), 0.35, 0.3, "white") for side in (-1, 1)]
        else:
            shapes.append(ball((cx, 0.5, top - high / 2), (wide, 2 * s + 0.4, high / 2 + 0.4), paint))
            shapes.append(ball((cx, 0.5, top + 0.4), (1.7 * s, 1.5 * s, 1.2 * s), "green"))
            shapes += [tube((cx + side * 3 * s, 0.5, top - 1), (hx, 0.4, hz), 0.5, 0.3, "red") for side in (-1, 1)]
    for shape in shapes:
        shape.carried = True
    return shapes


def belt_paint(belt):
    leather = OUTFITS[look["outfit"]]["belt"] == "leather"
    def paint(p):
        angle, z = around(p), p[:, 2] - belt
        out = np.full(len(p), M["leather" if leather else "white"])
        stud = (np.abs(((angle + 7) % 0.62) - 0.31) < 0.14) & (np.abs(z) < 0.32)
        if leather:
            out[stud] = M["silver"]  # buttons
        else:
            out[stud] = M["red"]  # the woven pattern
            out[z > 0.42] = M["red"]
            out[z < -0.42] = M["blue"]
        return out
    return paint


def skirt_paint(belt, hem):
    """Boy: a red double seam at the hem. Girl: a yellow strip, the red holbeláđđi with its gathers, and a lower edge."""
    girl = is_girl()
    def paint(p):
        angle, z = around(p), p[:, 2]
        out = np.full(len(p), M["blue"])
        if girl:
            out[z < hem + 2.9] = M["red"]
            out[(z >= hem + 2.9) & (z < hem + 3.45)] = M["yel"]
            out[z < hem + 0.55] = M["blue"]
        else:
            out[(z < hem + 0.5) | ((z > hem + 0.95) & (z < hem + 1.4))] = M["red"]
        return out
    return paint


def shawl(collar):
    """The liidni: a big silk shawl over the shoulders, coming down to a point behind and to a brooch in front, with a deep fringe all along
    its edge. It's held at the chest by a round silver brooch, with a small disc hanging from it."""
    shoulders = ball((0, 0, collar - 1.7), (6.3, 4.45, 3.5), "shawl")
    drape = tube((0, 0, collar - 1), (0, 0, collar - 9), 3.95, 4.3, "shawl", wide=1.5)
    def edge_height(p):
        """How high the shawl's lower edge is here."""
        x = np.abs(p[:, 0])
        return np.where(p[:, 1] >= 0, collar - 6.6 + x * 0.5, collar - 8.6 + x * 0.78)
    def field(p):
        d = np.minimum(shoulders.distance(p), drape.distance(p))
        neck = 2.55 - np.hypot(p[:, 0], p[:, 1])
        below = edge_height(p) - p[:, 2]
        # In front it opens from the neck down to the brooch.
        opening = np.where(p[:, 1] > 0, 0.1 + np.maximum(p[:, 2] - (collar - 5.4), 0) * 0.44 - np.abs(p[:, 0]), -99)
        return np.maximum.reduce([d, neck, below, opening])
    def paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = np.full(len(p), M["shawl"])
        # Flowers scattered over the silk, turning with the cloth.
        angle = np.arctan2(x, y)
        cell_a, cell_z = (angle + 7) % 0.72 - 0.36, (z + 40) % 2.6 - 1.3
        out[(cell_a * 4.6) ** 2 + cell_z ** 2 < 0.42] = M["flower"]
        out[(cell_a * 4.6) ** 2 + cell_z ** 2 < 0.08] = M["sclera"]
        # A plain band along the edge, then the fringe, in fine strands.
        up = z - edge_height(p)
        out[up < 1.65] = M["shawl"]
        fringe = up < 1.2
        out[fringe] = M["fringe"]
        out[fringe & (np.abs(((x * 2.2 + y * 1.1 + 40) % 1) - 0.5) < 0.2)] = M["shawl"]
        return out
    brooch = ball((0, 3.75, collar - 5.3), (1.25, 0.42, 1.25), lambda p: np.where(np.hypot(p[:, 0], p[:, 2] - (collar - 5.3)) < 0.55, M["red"], M["silver"]))
    disc = ball((0, 3.8, collar - 7), (0.5, 0.22, 0.5), "silver")
    return [Shape(field, paint), brooch, disc]


def sleeve_paint(a, b):
    """Blue, with a red edge at the hand."""
    a, b = np.array(a, float), np.array(b, float)
    u = b - a
    dressed = bool(look.get("dress"))
    def paint(p):
        along = ((p - a) @ u) / max(float(u @ u), 1e-9)
        if dressed:
            return np.where(along > 0.86, M["trim"], M["top"])
        return np.where(along > 0.82, M["red"], M["blue"])
    return paint


def arm(shoulder, hand):
    elbow = (np.array(shoulder, float) + np.array(hand, float)) / 2
    return [tube(shoulder, hand, 1.45, 1.2, sleeve_paint(shoulder, hand)), ball(tuple(hand), (1.25, 1.25, 1.25), "skin")]


def leg(x, hip_z, ankle_y, foot_z, far=False, knee_y=None):
    """A leg and its shoe, the summer nebbsko with its woven band and upturned toe."""
    colour = "legs" if look.get("dress") else "stocking" if is_girl() else "leather"
    ankle = (x, ankle_y, foot_z + 2.1)
    knee = (x, (ankle_y * 0.6 + 0.8 if knee_y is None else knee_y), (hip_z + foot_z + 2.1) / 2)
    return leg_from((x, 0, hip_z), knee, ankle, colour, foot_z, ankle_y)


def leg_from(hip, knee, ankle, colour, foot_z, foot_y):
    x = hip[0]
    if look.get("dress"):
        # Trousers and winter shoes.
        return [tube(hip, knee, 1.95, 1.65, colour), tube(knee, ankle, 1.65, 1.5, colour), ball((x, foot_y + 0.75, foot_z + 1.05), (1.75, 2.6, 1.15), "shoe")]
    def band(p):
        z = p[:, 2] - ankle[2]
        out = np.full(len(p), M[colour])
        out[z < 0.85] = M["white"]
        out[(z < 0.85) & (z > 0.5)] = M["red"]
        out[z < 0.1] = M["blue"]
        return out
    return [
        tube(hip, knee, 1.95, 1.65, colour),
        tube(knee, ankle, 1.65, 1.55, band),
        ball((x, foot_y + 0.75, foot_z + 1.05), (1.75, 2.55, 1.15), "fur"),
        tube((x, foot_y + 2.3, foot_z + 1.1), (x, foot_y + 3.5, foot_z + 2.1), 0.8, 0.3, "fur"),
    ]


# ------------------------------------------------------------------ one frame
def model(facing, *, up=0, left=(0, 0), right=(0, 0), swing=0, blink=False, hop=0, sway=0, arms_up=False, flare=0, lift=0, squat=0,
          sitting=False, pat=0, bend=0, reach=0, reach_x=6, seated=False, kick=0, hand_up=0, chair=None, ahead=False):
    """All of it, facing +y. left and right are (lift, shift) for the feet. up raises the upper body and squat lowers it. pat: a hand
    brushing the gákti, negative on the left, positive on the right, 2 being further along its stroke. bend: the head dips, looking
    down. reach: an arm held out to the front, how low the hand has come in its stroke, negative being above the shoulder; reach_x
    is how far out. seated: on a chair seen from behind, kick swinging the shins and hand_up raising an arm. chair: on a chair seen
    from the side, swinging the lower legs by this much. ahead: both arms reaching past the head, for a slide on the tummy."""
    yaw = np.radians(YAW[facing])
    # The screen's x, in the model's space: cloth and hair trail along it.
    world_x = (np.cos(yaw), np.sin(yaw), 0)
    w = look.get("w", 1)
    belt = look.get("belt", 9.4) + up + hop - squat
    if seated or chair is not None:
        belt = 9.2
    collar = belt + look.get("torso", 8.6)
    neck = (0, 0, collar)
    head_size = look.get("head", 1)
    centre = (0, 0.3, collar + look.get("neck", 4.1) * head_size)
    slim = look.get("slim", 1)
    HEAD_AT["centre"], HEAD_AT["size"] = np.array(centre), head_size
    head_pitch = np.radians(bend * 12)
    girl = is_girl()
    colour = "stocking" if girl else "leather"
    dress = look.get("dress")
    if dress:
        colour = "legs"
    shapes = []

    if seated or chair is not None:
        swings = (kick, -kick) if seated else (-chair, chair)
        for x, shift in zip((-2.2, 2.2), swings):
            knee = (x, 6.4, belt - 1.2)
            ankle_y = 7 + shift * 1.1
            shapes += leg_from((x, 0, belt - 1), knee, (x, ankle_y, 3.4), colour, 1.2, ankle_y)
    elif sitting:
        for x in (-2.6, 2.6):
            shapes += leg_from((x, 0, belt - 1), (x, 4.5, 2.4), (x, 7.5, 2.1), colour, 0, 7.5)
    else:
        for x, (rise, shift), near in ((-2.2 * w, left, True), (2.2 * w, right, False)):
            # Seen from the front, a foot that's up is also coming forward.
            forward = shift * 1.25 if facing not in ("down", "up") else rise * 1.1
            shapes += leg(x, belt - 1, forward, hop + rise)

    # The body.
    body_paint = dress_paint(belt, collar) if dress else torso_paint(belt, collar)
    shapes.append(tube((0, 0, belt), (0, 0, collar - 0.9), 3.9 * slim, 3.35 * slim, body_paint, wide=1.42 * w))
    shapes.append(ball((0, 0, collar - (1 if slim == 1 else 1.7)), (5.3 * w, 3.6 * slim, 2.2 if slim == 1 else 1.8), body_paint))
    if dress:
        if dress == "person":
            shapes.append(tube(neck, (0, 0, centre[2] - 2), 1.7, 1.6, "skin"))
            shapes.append(tube((0, 0, collar), (0, 0, collar + 0.5), 2.5, 2.2, "top"))
        else:
            shapes.append(tube(neck, (0, 0, collar + 1.2), 1.9, 1.8, "skin"))
            shapes.append(tube((0, 0, collar - 0.5), (0, 0, collar + 0.5), 3, 2.8, "trim"))
        # The jacket comes down over the seat, and a hood lies on the back of some.
        shapes.append(tube((0, 0, belt - 0.2), (0, 0, belt - 2.2), 3.95 * slim, (4.3 if slim == 1 else 3.7) * slim, body_paint, wide=1.35 * w))
        if look.get("skirt") or look.get("long"):
            hem = 1.2 if look.get("long") else max(belt * 0.42, 2)
            def lower(p, hem=hem, kind="long" if look.get("long") else "skirt"):
                out = np.full(len(p), M[kind])
                for i, band in enumerate(look.get("bands", ())):
                    out[(p[:, 2] > hem + 0.9 + i * 0.6) & (p[:, 2] < hem + 1.5 + i * 0.6)] = M[band]
                return out
            shapes.append(tube((0, 0, belt - 2.4), (0, 0, hem), 3.1, 4.7, lower, wide=1.28 * w, floor=hem))
        if dress in ("anorak", "parka"):
            shapes.append(ball((0, -3.5, collar + 0.1), (3.6, 2, 2.1), "top"))
            if dress == "parka":
                shapes.append(tube((-3.3, -2.4, collar + 1.2), (3.3, -2.4, collar + 1.2), 0.95, 0.95, "fur"))
    elif girl:
        shapes.append(tube(neck, (0, 0, collar + 1.2), 1.9, 1.8, "skin"))
        opening = lambda p: np.where(p[:, 1] > 0, M["red"], M["blue"])
        shapes.append(tube((0, 0, collar - 0.4), (0, 0, collar + 0.1), 3.05, 2.9, opening, wide=1.2))
    else:
        # The high čeabe, with its yellow and red strips.
        def collar_paint(p):
            z = p[:, 2] - collar
            out = np.full(len(p), M["red"])
            out[(z > -0.25) & (z < 0.2)] = M["yel"]
            out[(p[:, 1] > 0) & (np.abs(p[:, 0]) < 0.42)] = M["blue"]
            return out
        shapes.append(tube((0, 0, collar - 0.5), (0, 0, collar + 1.5), 2.95, 2.75, collar_paint))
    if not dress:
        shapes.append(tube((0, 0, belt - 0.05), (0, 0, belt + 0.05), 3.95, 3.95, belt_paint(belt), wide=1.42))

    # The gákti below the belt, which moves on its own.
    if dress:
        pass
    elif seated or chair is not None:
        hem_z = belt - (6.8 if girl else 3.6)
        shapes.append(tube((0, 0, belt - 0.2), (0, 0, belt - 2.4), 3.95, 4.6, "blue", wide=1.35))
        lap_to = 7.6 if girl else 5.3
        shapes.append(tube((0, 0.5, belt - 0.7), (0, lap_to, belt - 1.1), 3.7, 3.2, skirt_paint(belt, belt - 1e3), wide=1.4))
        # Hanging behind, and past the knee for the girl, with its trim.
        shapes.append(tube((0, -1.2, belt - 0.5), (0, -1.5, hem_z), 3.7, 4, skirt_paint(belt, hem_z), wide=1.3, floor=hem_z))
        if girl:
            shapes.append(tube((0, lap_to - 0.2, belt - 1.4), (0, lap_to + 0.2, 3), 3, 3, skirt_paint(belt, 3), wide=1.4, floor=3))
        else:
            shapes.append(tube((0, lap_to, belt - 1.2), (0, lap_to + 0.3, belt - 1.8), 2.9, 2.9, "red", wide=1.4))
    else:
        depth = (7.2 if girl else 4.6) - lift
        hem_z = max(0.25, belt - depth)
        open_out = 4.5 + flare * 0.8 + (0.6 if girl else 0)
        shift = np.array(world_x) * sway * 0.8
        shapes.append(tube((0, 0, belt - 0.2), (shift[0], shift[1], hem_z), 3.95, open_out, skirt_paint(belt, hem_z), wide=1.28, floor=hem_z))

    if dress:
        pass
    elif girl:
        shapes += shawl(collar)
    else:
        # The silk scarf under the neck, inside the kofta, soft where it shows in the opening.
        shapes.append(ball((0, 3.05, collar - 1.9), (1.45, 0.75, 1.9), "silk"))
        shapes.append(ball((0, 2.75, collar - 0.2), (1.9, 0.9, 0.85), "silk"))

    # The arms.
    shoulder = collar - 1.6
    hands = []
    for side, swung in ((-1, swing), (1, -swing)):
        at = (side * 5.2 * w, 0, shoulder)
        if ahead:
            hand = (side * 3.2, 1.8, shoulder + 7)
        elif arms_up:
            hand = (side * 6.2, 0.6, centre[2] + 5.5)
        elif hand_up and side == -1:
            # Out to the side, where it isn't lost behind the head.
            hand = (-9.2, 0.4, shoulder + (2 if hand_up == 1 else 10.5 + hand_up * 0.4))
        elif seated:
            hand = (side * 4.4, 3.4, belt + 0.6)
        elif chair is not None:
            hand = (side * 4, 4.6, belt + 0.2)
        elif pat and (pat < 0) == (side < 0):
            hand = (side * (4.8 - abs(pat) * 1.5), 3.6, belt - abs(pat) * 1.1)
        elif reach and side == -1:
            hand = (-3, reach_x + 1, shoulder - reach)  # the near arm
        else:
            hand = (side * 6.4 * w, swung * 1.35, shoulder - 7.2 * look.get("torso", 8.6) / 8.6 + abs(swung) * 0.25)
        shapes += arm(at, hand)
        if dress and look.get("stick") and side == -1 and not reach:
            shapes.append(tube(hand, (hand[0] - 0.4, hand[1] + 2.4, 0.3), 0.3, 0.3, "leather"))
        if dress and look.get("knife") and reach and side == -1:
            shapes.append(tube(hand, (hand[0], hand[1] + 3.6, hand[2]), 0.28, 0.14, "silver"))
        if dress and look.get("pen") and reach and side == -1:  # a marker, held to the board
            shapes.append(tube((hand[0] + 0.2, hand[1] - 0.2, hand[2] - 1.2), (hand[0] + 0.4, hand[1] + 2.8, hand[2] + 1.6), 0.5, 0.42, "pupil"))
        if look.get("carry") and side == 1:
            shapes += carried_shapes(hand)

    # The head, last so that it's nearest where parts meet.
    shapes.append(ball(centre, (HEAD_RX, HEAD_RY, HEAD_RZ), face_paint(centre, blink), "head"))
    shapes.append(ball((centre[0], centre[1] + HEAD_RY - 0.05, centre[2] - 1.6), (0.5, 0.38, 0.42), "skin", "head"))
    shapes += hair_shapes(centre, sway, world_x, lift if look["length"] in ("mid", "long", "braids", "ponytail", "lowtail", "bob", "curls") else 0)
    if look.get("hat"):
        shapes += hat(centre)
    if look.get("cap"):
        cx, cy, cz = centre
        shapes.append(ball((cx, cy, cz + 1.1), (HEAD_RX + 0.6, HEAD_RY + 0.6, HEAD_RZ + 0.2), "hat", "head", cut=lambda p: (cz + 0.9) - p[:, 2]))
        shapes.append(ball((cx, cy + 4.6, cz + 1.1), (4.4, 3.2, 0.42), "hat", "head"))
    if look.get("beard"):
        cx, cy, cz = centre
        shapes.append(ball((cx, cy + 0.8, cz - 2.2), (HEAD_RX * 0.9, HEAD_RY * 0.92, 3.6), lambda p: np.where(value_at(p * 3) > 0.7, M["strand"], M["beard"]), "head", cut=lambda p: np.maximum(p[:, 2] - (cz - 1.7) - np.maximum(0, 1 - (p[:, 1] - cy)) * 3, cy - 0.6 - p[:, 1])))
    if look.get("risku"):
        shapes.append(ball((0, 3.75, collar - 2.6), (1.5, 0.45, 1.5), lambda p: np.where(np.hypot(p[:, 0], p[:, 2] - (collar - 2.6)) < 0.7, M["sclera"], M["silver"])))
        shapes += [ball((x, 3.8, collar - 4.3 + abs(x) * 0.4), (0.5, 0.22, 0.5), "silver") for x in (-1.05, 0, 1.05)]
    if seated:
        shapes = [on_seat(shape) for shape in shapes]
    return shapes, yaw, neck, head_pitch


def body_points(p, yaw, root):
    """World points into the model's space."""
    c, s = np.cos(yaw), np.sin(yaw)
    q = np.stack([p[:, 0] * c - p[:, 1] * s, p[:, 0] * s + p[:, 1] * c, p[:, 2]], axis=1)
    if root:
        q = turn_x(q - np.array(root["shift"]), root["pitch"], np.array(root["about"]))
    return q


HEAD_AT = {"centre": np.zeros(3), "size": 1}  # a grown-up's head is smaller to the body than a child's


def render(facing, root=None, head_back=0, **pose):
    """The frame as RGBA, and where its mouth is."""
    shapes, yaw, neck, head_pitch = model(facing, **pose)
    head_pitch -= head_back
    head_size = HEAD_AT["size"]
    w, h = FW * DETAIL, FH * DETAIL
    u = (np.arange(w) + 0.5) / DETAIL - FW / 2
    v = GROUND - (np.arange(h) + 0.5) / DETAIL
    uu, vv = np.meshgrid(u, v)
    up, along = np.sin(CAMERA_UP), np.cos(CAMERA_UP)
    start = np.stack([uu.ravel(), -up * vv.ravel(), along * vv.ravel()], axis=1)
    way = np.array([0, along, up])  # towards the camera

    def spaces(p):
        body = body_points(p, yaw, root)
        head = turn_x(body, head_pitch, np.array(neck)) if head_pitch else body
        if head_size != 1:
            head = HEAD_AT["centre"] + (head - HEAD_AT["centre"]) / head_size
        return {"body": body, "head": head}

    def away(shape, space):
        return shape.distance(space[shape.group]) * (head_size if shape.group == "head" else 1)

    def nearest(p):
        space = spaces(p)
        return np.min([away(shape, space) for shape in shapes], axis=0)

    t = np.full(len(start), 22.0)
    hit = np.zeros(len(start), bool)
    live = np.arange(len(start))
    for _ in range(46):
        if not len(live):
            break
        d = nearest(start[live] + way * t[live, None])
        arrived = d < 0.02
        hit[live[arrived]] = True
        t[live] -= d * 0.9
        live = live[~arrived & (t[live] > -22) & (d < 40)]
    image = np.zeros((h, w, 4), np.uint8)
    at = np.nonzero(hit)[0]
    mouth = None
    if len(at):
        p = start[at] + way * t[at, None]
        space = spaces(p)
        distances = np.array([away(shape, space) for shape in shapes])
        which = np.argmin(distances, axis=0)
        material = np.zeros(len(p), int)
        for i, shape in enumerate(shapes):
            chosen = which == i
            if chosen.any():
                material[chosen] = shape.paint(space[shape.group][chosen])
        e = 0.06
        normal = np.stack([nearest(p + np.eye(3)[i] * e) - nearest(p - np.eye(3)[i] * e) for i in range(3)], axis=1)
        normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
        lit = normal @ LIGHT
        band = np.where(lit > 0.62, 2, np.where(lit > 0.06, 1, 0))
        rgb = COLOURS[material, band]
        # Lines where one part stands well in front of another, as the sprites' sleeves had, in that part's dark.
        depth = np.full(h * w, -np.inf)
        depth[at] = t[at]
        part = np.full(h * w, -1)
        part[at] = which
        depth, part = depth.reshape(h, w), part.reshape(h, w)
        behind = np.zeros((h, w), bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            near_depth = np.nan_to_num(np.roll(depth, (dy, dx), (0, 1)), neginf=-1e6)
            behind |= (part >= 0) & (np.roll(part, (dy, dx), (0, 1)) >= 0) & (near_depth - np.nan_to_num(depth, neginf=-1e6) > 0.9)
        ys, xs = at // w, at % w
        image[ys, xs, :3] = rgb
        image[ys, xs, 3] = 255
        edge = behind[ys, xs] & (material != M["iris"])
        image[ys[edge], xs[edge], :3] = COLOURS[material[edge], 0]
        mouthed = material == M["mouth"]
        if mouthed.sum() >= 2:
            mouth = [int(xs[mouthed].mean()), int(ys[mouthed].mean()), int(xs[mouthed].max() - xs[mouthed].min() + 1)]
        if look.get("carry"):
            # Only what's carried, wherever the body doesn't hide it.
            carried = np.array([getattr(shape, "carried", False) for shape in shapes])[which]
            image[ys[~carried], xs[~carried]] = 0
    return add_outline(image), mouth


def add_outline(image):
    """A dark line round the silhouette, half a world pixel wide, as in Terraria and Core Keeper."""
    solid = image[:, :, 3] > 0
    around_it = solid.copy()
    for _ in range(2):
        grown = around_it.copy()
        grown[1:] |= around_it[:-1]
        grown[:-1] |= around_it[1:]
        grown[:, 1:] |= around_it[:, :-1]
        grown[:, :-1] |= around_it[:, 1:]
        around_it = grown
    edge = around_it & ~solid
    image[edge] = OUTLINE
    return image


# ----------------------------------------------------------------- the rows
def F(facing, **pose):
    return (facing, tuple(sorted(pose.items())))


WALK_SIDE = [((0, 3), (0, -3), 2, 0), ((0, 2), (1, -2), 2, 1), ((0, 1), (2, -1), 1, 1), ((0, 0), (1, 0), 0, 0),
             ((0, -3), (0, 3), -2, 0), ((1, -2), (0, 2), -2, 1), ((2, -1), (0, 1), -1, 1), ((1, 0), (0, 0), 0, 0)]
WALK_FRONT = [((0, 0), (2, 0), 2, 0), ((0, 0), (2, 0), 2, 1), ((0, 0), (1, 0), 1, 1), ((0, 0), (0, 0), 0, 0),
              ((2, 0), (0, 0), -2, 0), ((2, 0), (0, 0), -2, 1), ((1, 0), (0, 0), -1, 1), ((0, 0), (0, 0), 0, 0)]
WALK_DIAGONAL = [((0, 2), (0, -2), 2, 0), ((0, 1), (1, -1), 2, 1), ((0, 0), (2, 0), 1, 1), ((0, -1), (1, 1), 0, 0),
                 ((0, -2), (0, 2), -2, 0), ((1, -1), (0, 1), -2, 1), ((2, 0), (0, 0), -1, 1), ((1, 1), (0, -1), 0, 0)]
UPS = (0, 0, 0, 1, 1, 1, 0, 0)


def walk(facing, sway=0):
    # Cloth and hair don't follow each step. The game picks the row for their sway, so they can trail behind the walk and swing
    # more slowly than the legs.
    steps = WALK_SIDE if facing == "right" else WALK_DIAGONAL if facing in ("se", "ne") else WALK_FRONT
    return [F(facing, left=l, right=r, swing=s, up=u, sway=sway) for l, r, s, u in steps]


def idle(facing, sway=0, **cloth):
    return [F(facing, up=u, blink=i == 7, sway=sway, **cloth) for i, u in enumerate(UPS)]


def cheer():
    return [F("down", squat=1, flare=1), F("down", hop=2, arms_up=True, lift=-1), F("down", hop=4, arms_up=True, lift=-1),
            F("down", hop=5, arms_up=True, blink=True, flare=1), F("down", hop=3, arms_up=True, lift=1, flare=2),
            F("down", hop=1, arms_up=True, lift=1, flare=2)]


def jump():
    return [F("down", squat=2, flare=1), F("down", hop=3, lift=-1), F("down", hop=6, lift=-1),
            F("down", hop=7, flare=1), F("down", hop=4, lift=1, flare=2), F("down", squat=1, flare=2)]


def crouch():
    return [F("down", squat=1), F("down", squat=2, flare=1), F("down", squat=3, flare=2),
            F("down", squat=3, flare=2), F("down", squat=3, flare=2, blink=True), F("down", squat=3, flare=2)]


def fall():
    return [F("down", swing=2, arms_up=True, sway=1), F("down", squat=2, arms_up=True, lift=1, flare=2),
            F("down", squat=5.5, sitting=True, flare=3, blink=True), F("down", squat=5.5, sitting=True, flare=3, blink=True),
            F("down", squat=5.5, sitting=True, flare=2), F("down", squat=2, flare=1)]


def run_rows():
    """Eight frames for each way of facing and each sway. Long strides with both feet off the ground between them, arms pumping,
    and the hem blown back and open."""
    side = [((0, 4), (3, -4), 3, 0), ((1, 2), (4, -2), 3, 1), ((3, 0), (3, 0), 1, 2), ((4, -2), (1, 2), -1, 1),
            ((3, -4), (0, 4), -3, 0), ((4, -2), (1, 2), -3, 1), ((3, 0), (3, 0), -1, 2), ((1, 2), (4, -2), 1, 1)]
    front = [((0, 0), (4, 0), 3, 0), ((1, 0), (4, 0), 3, 1), ((3, 0), (3, 0), 1, 2), ((4, 0), (1, 0), -1, 1),
             ((4, 0), (0, 0), -3, 0), ((4, 0), (1, 0), -3, 1), ((3, 0), (3, 0), -1, 2), ((1, 0), (4, 0), 1, 1)]
    diagonal = [((0, 2), (3, -2), 3, 0), ((1, 1), (4, -1), 3, 1), ((3, 0), (3, 0), 1, 2), ((4, -1), (1, 1), -1, 1),
                ((3, -2), (0, 2), -3, 0), ((4, -1), (1, 1), -3, 1), ((3, 0), (3, 0), -1, 2), ((1, 1), (4, -1), 1, 1)]
    rows = []
    for facing, steps in (("down", front), ("up", front), ("right", side), ("se", diagonal), ("ne", diagonal)):
        for sway in RUN_SWAYS:
            rows.append([F(facing, left=l, right=r, swing=s, up=u, sway=sway, flare=1, lift=-1) for l, r, s, u in steps])
    return rows


def slide_frame(stage):
    """A slide on the tummy, head first to the right. Stage 0 dives; 1 to 3 slide, with the cloth flapping; 4 lies still; 5 pushes up."""
    if stage == 0:
        return F("right", squat=2, flare=1, lift=-1, sway=-3)
    if stage == 5:
        return F("right", squat=4, flare=2, sway=-1)
    return ("right", (("blink", stage == 4), ("flat", stage % 2 if stage < 4 else 0)))


def jump_rows():
    """Rising, at the top, coming down, for each way of facing. The feet tuck up and the hem and hair lag."""
    phases = (dict(left=(2, 0), right=(1, 0), lift=-1), dict(left=(3, 0), right=(3, 0), flare=1), dict(left=(1, 0), right=(2, 0), lift=1, flare=2))
    return [[F(facing, **phase) for phase in phases] for facing in ("down", "up", "right", "se", "ne")]


def crouch_walk(facing):
    """Low down and slow: short steps, the arms hardly moving, and the hem open just off the floor."""
    steps = WALK_SIDE if facing == "right" else WALK_DIAGONAL if facing in ("se", "ne") else WALK_FRONT
    return [F(facing, left=(min(l[0], 1), l[1] * 0.6), right=(min(r[0], 1), r[1] * 0.6), swing=s * 0.5, squat=3 - u * 0.5, flare=2) for l, r, s, u in steps]


def wipe():
    """Getting up after sitting down hard, brushing the gákti, then shaking the hem straight."""
    bent = dict(squat=2, bend=2, flare=1)
    return [F("down", squat=3, bend=1, flare=2), F("down", squat=2, bend=2, flare=1),
            F("down", pat=-1, sway=1, **bent), F("down", pat=-2, sway=2, **bent),
            F("down", pat=1, sway=-1, **bent), F("down", pat=2, sway=-2, **bent),
            F("down", sway=2, flare=1), F("down", sway=-2, flare=1)]


def pat_rows():
    """Patting an animal to the right: the hand strokes down and lifts again, low for a small animal and high for a tall one."""
    return [[F("right", reach=stroke) for stroke in strokes] for strokes in ((1, 2, 3, 2, 1, 2), (-6, -5, -4, -5, -6, -5))]


def work_rows():
    """Working to the right, each six frames: an axe raised and swung down, a saw pushed and pulled, and a stick thrown. The game draws the tool."""
    chop = [F("right", reach=r, reach_x=x, up=u, squat=s, flare=f) for r, x, u, s, f in
            ((-8, 2, 1, 0, 0), (-10, 1, 1, 0, 0), (-9, 3, 0, 0, 0), (-4, 7, 0, 1, 1), (2, 8, 0, 2, 2), (3, 7, 0, 2, 1))]
    saw = [F("right", reach=3, reach_x=x, squat=2, flare=1) for x in (3, 5, 8, 9, 7, 4)]
    throw = [F("right", reach=r, reach_x=x, up=u, flare=f) for r, x, u, f in
             ((-6, -2, 0, 0), (-9, 0, 1, 0), (-10, 3, 1, 1), (-7, 8, 0, 1), (-3, 9, 0, 1), (1, 7, 0, 0))]
    return [chop, saw, throw]


def all_rows():
    """In the order the game expects: see art/mahtte/README.md and the row constants in src/game.js."""
    rows = [idle("down"), idle("up"), idle("right"), walk("down"), walk("up"), walk("right"), cheer(), jump(), crouch(), fall()]
    rows += [pose(facing, sway) for pose in (idle, walk) for facing in ("down", "up", "right") for sway in SWAYS]
    rows += [idle(facing, flare=1, lift=1) for facing in ("down", "up")]
    rows += [(idle if pose == "idle" else walk)(facing, sway) for pose in ("idle", "walk") for facing in ("se", "ne") for sway in (-2, -1, 0, 1, 2)]
    rows += jump_rows() + [wipe()]
    rows += run_rows() + [[slide_frame(stage) for stage in range(6)]]
    rows += [[F("right", squat=3, flare=1)] + [F("right", chair=swing) for swing in (0, 1, 2, 1, 0, -1)]]
    rows += pat_rows() + work_rows()
    # At a lesson, from behind: a hand going up, and then sitting, with the legs swinging after the first picture.
    rows += [[F("ne", seated=True, hand_up=hand) for hand in (1, 2, 3)]]
    rows += [[F("ne", seated=True, kick=kick) for kick in (0, 1, 1, 0, 0, -1, -1)]]
    rows += [crouch_walk(facing) for facing in ("down", "up", "right", "se", "ne")]
    return rows


def render_frame(spec):
    facing, pose = spec
    pose = dict(pose)
    if "flat" in pose:
        flap = pose.pop("flat")
        # Flat on the floor, the head held up to see where it's going.
        root = {"pitch": np.radians(84), "about": np.array((0, 0, 3.6)), "shift": (0, -6.5, 0)}
        return render(facing, root=root, head_back=np.radians(68), squat=3, flare=flap, lift=2 + flap, ahead=True, **pose)
    return render(facing, **pose)


# ------------------------------------------------------------------ the sheets
SHEET_COLUMNS = 2  # rows of frames side by side, so that a sheet isn't too tall for a browser. Must match spriteAt in src/game.js.


def with_colours(image, hair="brown", eyes="#3a78d6"):
    """A picture for looking at, with the key colours swapped."""
    out = image.copy()
    keys = [(HAIR[i], HAIRS[hair][i]) for i in range(3)] + [(IRIS[0], eyes), (IRIS[1], eyes), (IRIS[2], eyes)]
    for key, colour in keys:
        k = np.array([int(key[j:j + 2], 16) for j in (1, 3, 5)])
        c = np.array([int(colour[j:j + 2], 16) for j in (1, 3, 5)])
        out[(out[:, :, :3] == k).all(axis=2), :3] = c
    return out


def make_sheet(combo):
    """Draws one sheet, and returns the mouths for its frames."""
    name, gender, length = combo
    look.update(outfit=name, gender=gender, length=length)
    rows = all_rows()
    w, h = FW * DETAIL, FH * DETAIL
    per_row = 8
    sheet = np.zeros((h * ((len(rows) + 1) // SHEET_COLUMNS), w * per_row * SHEET_COLUMNS, 4), np.uint8)
    done = {}
    mouths = []
    for r, row in enumerate(rows):
        marks = []
        for c, spec in enumerate(row):
            if spec not in done:
                done[spec] = render_frame(spec)
            image, mouth = done[spec]
            x = (c + (r % SHEET_COLUMNS) * per_row) * w
            y = (r // SHEET_COLUMNS) * h
            sheet[y:y + h, x:x + w] = image
            marks.append(mouth or 0)
        mouths.append(marks)
    Image.fromarray(sheet, "RGBA").save(OUT / f"sprites/{name}-{gender}-{length}.png", optimize=True)
    return gender, mouths


# ------------------------------------------------------------- the classmates
# Made like the player's characters, in the poses of a lesson: a hand going up, and sitting with the legs swinging. Each must be in LESSON_VOICES in
# src/lesson.js. Generic everyday clothes, and hair and skin chosen to tell them apart, for the user to check. The gákti are the two the player has.
ramp = lambda *tones: tuple(tones)
CLASSMATES = {
    "classmate_gakti": dict(gender="girl", outfit="karasjohka", length="braids", hair=ramp("#2f1b17", "#55321f", "#835433"), eyes="#3a78d6", skin=ramp("#c9825a", "#dc9a70", "#f0c29a")),
    "classmate_gakti_two": dict(gender="girl", outfit="ohcejohka", length="ponytail", hair=ramp("#16110f", "#2e2620", "#4a3d33"), eyes="#6b4a2c", skin=ramp("#d08a62", "#e6a378", "#f9cda6"), shawl=ramp("#1f4f7a", "#2f78a8", "#5aa4cc")),
    "classmate_wool": dict(gender="girl", outfit="karasjohka", length="bob", dress="knit", hair=ramp("#a9782c", "#dcae4e", "#f6d98a"), eyes="#5a8a6a", skin=ramp("#d8966e", "#ecb088", "#fcd6b4"),
                           top=ramp("#a89f8e", "#d9d2c2", "#f2ecdd"), trim=ramp("#1f4a8a", "#2f5fa8", "#4f80c8"), legs=ramp("#232a35", "#39424f", "#525d6c"), shoe=ramp("#2d2227", "#4c3a36", "#6d5548")),
    "classmate_anorak": dict(gender="boy", outfit="karasjohka", length="short", dress="anorak", hat=True, hair=ramp("#2f1b17", "#55321f", "#835433"), eyes="#6b4a2c", skin=ramp("#c9825a", "#dc9a70", "#f0c29a"),
                             top=ramp("#28503f", "#3f6f5a", "#5a9078"), trim=ramp("#b8a680", "#e8d4ae", "#f8ecd0"), legs=ramp("#2a303c", "#3f4656", "#596172"), shoe=ramp("#1c1c24", "#2c2c36", "#4a4a56"), hat_tone=ramp("#8e2620", "#c8372d", "#e4604c")),
    "classmate_parka": dict(gender="boy", outfit="karasjohka", length="short", dress="parka", hat=True, hair=ramp("#7c2a14", "#b5481d", "#e27a3a"), eyes="#3a78d6", skin=ramp("#d8966e", "#ecb088", "#fcd6b4"),
                            top=ramp("#83382a", "#b5533f", "#d67a62"), trim=ramp("#b57a14", "#f2c14e", "#ffe27a"), legs=ramp("#1c222d", "#2c3340", "#454e5e"), shoe=ramp("#2d2227", "#4c3a36", "#6d5548"), hat_tone=ramp("#1f4074", "#2f5fa8", "#4f80c8")),
    "classmate_fleece": dict(gender="boy", outfit="karasjohka", length="curls", dress="fleece", hair=ramp("#4e3016", "#8a5a2c", "#b8854c"), eyes="#5a8a6a", skin=ramp("#b87650", "#cf8e66", "#e6b08a"),
                             top=ramp("#552a4a", "#7a3f6a", "#9c5f8c"), trim=ramp("#3a2034", "#54304c", "#74486a"), legs=ramp("#1e2532", "#30384a", "#4a5468"), shoe=ramp("#1c1c24", "#2c2c36", "#4a4a56"), hat_tone=ramp("#b8a680", "#e8d4ae", "#f8ecd0")),
}
SEATED_COLUMNS = 7


def set_ramp(material, tones):
    COLOURS[M[material]] = [[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in tones]


def make_classmate(name):
    """One classmate's sheet: the hand going up on the first row, sitting on the second."""
    who = CLASSMATES[name]
    look.clear()
    look.update(outfit=who["outfit"], gender=who["gender"], length=who["length"], dress=who.get("dress"), hat=who.get("hat", False))
    set_ramp("hair", who["hair"])
    set_ramp("strand", (who["hair"][0], who["hair"][0], who["hair"][1]))
    set_ramp("iris", (who["eyes"],) * 3)
    set_ramp("skin", who["skin"])
    set_ramp("shawl", who.get("shawl", SHAWL))
    for material, key in (("top", "top"), ("trim", "trim"), ("legs", "legs"), ("shoe", "shoe"), ("hat", "hat_tone")):
        if key in who:
            set_ramp(material, who[key])
    rows = [[F("ne", seated=True, hand_up=hand) for hand in (1, 2, 3)], [F("ne", seated=True, kick=kick) for kick in (0, 1, 1, 0, 0, -1, -1)]]
    w, h = FW * DETAIL, FH * DETAIL
    sheet = np.zeros((h * len(rows), w * SEATED_COLUMNS, 4), np.uint8)
    for r, row in enumerate(rows):
        for c, spec in enumerate(row):
            sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = render_frame(spec)[0]
    (ROOT / "art/classmates").mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, "RGBA").save(ROOT / f"art/classmates/{name}.png", optimize=True)
    return name


# --------------------------------------------------------------- everyone else
# The store's people and the teachers, from the looks in src/models.js, made into art/animals/ for the game's model pictures: four directions, standing, reaching
# and walking. Grown-ups get longer bodies and smaller heads than the children. Generic, for the user to check.
PERSON_FRAMES = (0, 3, 4, 20, 21, 22, 23)
WRITING_FRAMES = (14, 15)  # a teacher's hand moving along the board with a pen, besides frame 3
CELL = (120, 90)  # as in tools/make_animals.py
FOOT = (60, 60)
PERSON_SKINS = (("#c9825a", "#dc9a70", "#f0c29a"), ("#b87650", "#cf8e66", "#e6b08a"), ("#d8966e", "#ecb088", "#fcd6b4"), ("#c08058", "#d89a78", "#eeb896"))
PERSON_EYES = ("#6b4a2c", "#3a78d6", "#5a8a6a", "#4a4a58")
BAND_OF = {"#c8372d": "red", "#f2c14e": "yel", "#2f5fa8": "blue", "#f4efe2": "white"}


def person_looks():
    text = (ROOT / "src/models.js").read_text(encoding="utf-8")
    start = text.index("const PERSON_LOOKS = {") + len("const PERSON_LOOKS = ")
    code = "console.log(JSON.stringify(" + text[start:text.index("\n};", start) + 2] + "))"
    looks = json.loads(subprocess.run(["node", "-e", code], capture_output=True, text=True, check=True).stdout)
    goods = text[text.index("const GEAR_GOODS = {") + len("const GEAR_GOODS = "):]
    gear = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(" + goods[:goods.index("};") + 1] + "))"], capture_output=True, text=True, check=True).stdout)
    for name, b in list(looks.items()):
        if b.get("goods"):
            looks[f"gear_{name}"] = {**b, "goods": [gear[good] for good in b["goods"]]}
    return looks


def shades(text):
    c = np.array([int(text[i:i + 2], 16) for i in (1, 3, 5)], float)
    return tuple("#%02x%02x%02x" % tuple(np.clip(c * k + add, 0, 255).astype(int)) for k, add in ((0.68, 0), (1, 0), (1.16, 14)))


def dress_person(name, b, carry=None):
    k = b["k"]
    height = 27 + (k - 0.6) * 22
    head = max(0.7, 1 - (height - 27) / 13 * 0.28)
    neck = 4.1 + (1 - head) * 15  # the more grown, the more neck shows
    rest = height - (neck + 5.2) * head
    wear = b.get("hair")
    look.clear()
    look.update(outfit="karasjohka", gender="boy", length={"cap": "short", "beanie": "short"}.get(wear, wear or "short"), dress="person", belt=rest * 0.55, torso=rest * 0.45, head=head, neck=neck, slim=0.84 + head * 0.16 - (0 if head < 1 else 0), w=b["w"], carry=carry,
                hat=wear == "beanie", cap=wear == "cap", beard=b.get("beard"), glasses=b.get("glasses"), skirt=b.get("skirt"), long=b.get("long"), stripe=b.get("stripe"), apron=b.get("apron"), badge=b.get("badge"),
                bands=[BAND_OF[band] for band in b.get("bands", [])], risku=b.get("risku"), stick=b.get("stick"), knife=b.get("knife"))
    by = sum(map(ord, name.replace("gear_", "")))
    set_ramp("skin", PERSON_SKINS[by % 4])
    set_ramp("iris", (PERSON_EYES[by % 4],) * 3)
    hair = shades(b.get("hairColour", "#5a4a3a"))
    set_ramp("hair", hair)
    set_ramp("strand", (hair[0], hair[0], hair[1]))
    set_ramp("hat", hair)
    set_ramp("top", shades(b["top"]))
    set_ramp("legs", shades(b["legs"]))
    set_ramp("shoe", LEATHER)
    set_ramp("trim", shades(b.get("stripe", b["top"])))
    for material, key in (("apron", "apron"), ("long", "long"), ("skirt", "skirt"), ("beard", "beard"), ("badge", "badge"), ("basket", "basket")):
        if b.get(key):
            set_ramp(material, shades(b[key]))
    if b.get("basket"):
        c = shades(b["basket"])
        set_ramp("slot", (c[0], c[0], c[0]))
    global FW, FH, GROUND
    FW, FH, GROUND = 36, 50, 47
    return k


def in_cell(frame):
    """A frame put into the game's model picture, with the feet where a model's feet are."""
    cell = np.zeros((CELL[1] * DETAIL, CELL[0] * DETAIL, 4), np.uint8)
    h, w = frame.shape[:2]
    left, top = FOOT[0] * DETAIL - w // 2, FOOT[1] * DETAIL - GROUND * DETAIL
    cell[top:top + h, left:left + w] = frame
    return cell


def save_rows(name, frames, views):
    """Rows for facing +y, +x, -y and -x, the first and last being the other two mirrored."""
    se, ne = views["se"], views["ne"]
    rows = [[np.flip(i, axis=1) for i in se], se, ne, [np.flip(i, axis=1) for i in ne]]
    solid = np.any([image[:, :, 3] > 0 for row in rows for image in row], axis=0)
    ys, xs = np.nonzero(solid.any(axis=1))[0], np.nonzero(solid.any(axis=0))[0]
    if not len(ys):
        return name, None
    x0, x1, y0, y1 = int(xs[0]), int(xs[-1]) + 1, int(ys[0]), int(ys[-1]) + 1
    w, h = x1 - x0, y1 - y0
    sheet = np.zeros((h * 4, w * len(frames), 4), np.uint8)
    for r, row in enumerate(rows):
        for c, image in enumerate(row):
            sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = image[y0:y1, x0:x1]
    Image.fromarray(sheet, "RGBA").save(ROOT / f"art/animals/{name}.png", optimize=True)
    return name, {"frames": list(frames), "rows": 4, "x": x0, "y": y0, "w": w, "h": h}


def make_person(name):
    b = person_looks()[name]
    dress_person(name, b)
    teacher = name.startswith("teacher")
    look["pen"] = teacher
    views = {}
    for view in ("se", "ne"):
        steps = walk(view)
        specs = [F(view), F(view, reach=-3, reach_x=6), F(view, reach=3, reach_x=5)] + [steps[i] for i in (0, 2, 4, 6)]
        if teacher:
            specs += [F(view, reach=-3.8, reach_x=7.5), F(view, reach=-2, reach_x=4.5)]
        views[view] = [in_cell(render_frame(spec)[0]) for spec in specs]
    return save_rows(f"person_{name}", PERSON_FRAMES + (WRITING_FRAMES if teacher else ()), views)


def make_carried(spec):
    name, kind = spec
    b = person_looks()[name]
    goods = () if not isinstance(kind, int) else tuple(b["goods"][:kind])
    carry = ("basket" if isinstance(kind, int) else kind, goods, b["k"])
    dress_person(name, b, carry)
    return save_rows(f"carried_{name}-{kind}", (0,), {view: [in_cell(render_frame(F(view))[0])] for view in ("se", "ne")})


def make_people():
    looks = person_looks()
    people = [name for name in looks if not name.startswith("gear_")]
    carried = [(name, kind) for name, b in looks.items() if b.get("goods") for kind in (0, 1, 2, 3, "stack", *[f"bag{i}" for i in range(6)])] + [("stocker", "stack")]
    with ProcessPoolExecutor(max_workers=8) as pool:
        made = dict(pool.map(make_person, people))
        made.update(pool.map(make_carried, carried))
    path = ROOT / "art/animals/animals.js"
    text = path.read_text(encoding="utf-8")
    sizes = {name: size for name, size in json.loads(text[text.index("{"):text.rindex("}") + 1]).items() if not name.startswith(("person_", "carried_"))}
    sizes.update({name: size for name, size in made.items() if size})
    path.write_text(text[:text.index("{")] + json.dumps(sizes, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(len(people), "people and", len(carried), "things they carry written")


def contact(images, columns=None, scale=2, background=(45, 67, 80, 255)):
    columns = columns or len(images)
    h, w = images[0].shape[:2]
    lines = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", ((w + 8) * columns + 8, (h + 8) * lines + 8), background)
    for i, image in enumerate(images):
        picture = Image.fromarray(image, "RGBA")
        sheet.alpha_composite(picture, (8 + (w + 8) * (i % columns), 8 + (h + 8) * (i // columns)))
    return sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)


def make_previews():
    """The pictures for people to look at."""
    (OUT / "base").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "base").glob("*.png"):
        old.unlink()
    for name, gender in product(OUTFITS, GENDERS):
        look.update(outfit=name, gender=gender, length="long" if gender == "girl" else "short")
        views = [with_colours(render_frame(F(facing))[0]) for facing in YAW]
        contact(views).save(OUT / f"base/{name}-{gender}-views.png")
    options = []
    for gender, hair in product(GENDERS, HAIRS):
        for length in HAIR_STYLES[gender]:
            look.update(outfit="ohcejohka", gender=gender, length=length)
            options.append(with_colours(render_frame(F("down"))[0], hair))
    contact(options, columns=9).save(OUT / "base/hair-options.png")
    for gender in GENDERS:
        look.update(outfit="ohcejohka", gender=gender, length="long" if gender == "girl" else "short")
        first = [spec for row in all_rows()[:10] for spec in row[:8]]
        contact([with_colours(render_frame(spec)[0]) for spec in first], columns=8, scale=1).save(OUT / f"base/animations-{gender}.png")


def write_mouths(mouths):
    (OUT / "mouths.js").write_text(f"// Generated by tools/make_mahtte.py: where the mouth is in each frame, by gender, row and column, as x, y and width.\nwindow.MAHTTE_MOUTHS = {json.dumps(mouths, separators=(',', ':'))};\n", encoding="utf-8")


def mouths_of(gender):
    look.update(outfit="ohcejohka", gender=gender, length="short" if gender == "boy" else "mid")
    return gender, [[render_frame(spec)[1] or 0 for spec in row] for row in all_rows()]


def main():
    if sys.argv[1:] == ["people"]:
        return make_people()
    if sys.argv[1:] == ["classmates"]:
        with ProcessPoolExecutor(max_workers=6) as pool:
            print(len(list(pool.map(make_classmate, CLASSMATES))), "classmates written")
        return
    if sys.argv[1:] == ["mouths"]:
        with ProcessPoolExecutor(max_workers=2) as pool:
            write_mouths(dict(pool.map(mouths_of, GENDERS)))
        return
    make_previews()
    if sys.argv[1:] == ["preview"]:
        return
    (OUT / "sprites").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "sprites").glob("*.png"):
        old.unlink()  # all generated here; a style that was dropped must not linger
    combos = [(name, gender, length) for name, gender in product(OUTFITS, GENDERS) for length in HAIR_STYLES[gender]]
    mouths = {}
    with ProcessPoolExecutor(max_workers=int(sys.argv[1]) if sys.argv[1:] else 8) as pool:
        for gender, marks in pool.map(make_sheet, combos):
            mouths.setdefault(gender, marks)
    write_mouths(mouths)
    print(len(combos), "sprite sheets written")
    # In a pool of their own, as each changes the colours of the process it's in.
    with ProcessPoolExecutor(max_workers=6) as pool:
        print(len(list(pool.map(make_classmate, CLASSMATES))), "classmates written")


if __name__ == "__main__":
    main()
