#!/usr/bin/env python3
"""Make animals ahead in 3D, into art/animals/, so that they're sharp from the start and the game needn't draw them while it runs.

Each is built of soft shapes that melt into one another, with fur or feathers in its surface and painted markings, and lit in flat
bands as the game's other models are. A sheet has a row for each of the four ways of facing and a column for each pose, at the same
frame numbers as MODELS in src/models.js, as src/game.js asks for them, and for mammals a gallop, sleep and head down too (10 to 13).

Usage: python3 tools/make_animals.py [name ...]
"""
import json
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import blob, capsule, colour, noise3, value_noise  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art/animals"
DETAIL = 4
CELL_W, CELL_H = 120, 90  # as the game's other model pictures, in the world's pixels
ANCHOR = (60, 60)
FACINGS = ((0, 1), (1, 0), (0, -1), (-1, 0))  # as MODEL_FACINGS in src/world.js
LIGHT = np.array([-0.35, 0.45, 0.82]) / np.linalg.norm([-0.35, 0.45, 0.82])  # as MODEL_LIGHT there
BANDS = ((0.82, 1.14), (0.45, 1.0), (0.05, 0.84), (-9, 0.68))


def smooth_union(fields, k):
    """Shapes that melt into one another where they meet, for a body with no seams."""
    def field(p):
        d = fields[0](p)
        for other in fields[1:]:
            e = other(p)
            h = np.clip(0.5 + 0.5 * (e - d) / k, 0, 1)
            d = e * (1 - h) + d * h - k * h * (1 - h)
        return d
    return field


def tube(a, b, r0, r1):
    """A rounded cone from a to b."""
    a, b = np.array(a, float), np.array(b, float)
    u = b - a
    uu = max(float(u @ u), 1e-9)
    def field(p):
        along = np.clip(((p - a) @ u) / uu, 0, 1)
        return np.linalg.norm(p - a - np.outer(along, u), axis=1) - (r0 + (r1 - r0) * along)
    return field


def ell(at, radii):
    return lambda p: blob(p, at, radii)


def fur(field, amount, scale, seed):
    """Rough with hair: the surface breaks up a little, more with the coarser coats."""
    return lambda p: field(p) - (noise3(p, scale, seed) - 0.5) * amount - (noise3(p, scale * 2.7, seed + 4) - 0.5) * amount * 0.5


def mix(a, b, amount):
    return a * (1 - amount[..., None]) + b * amount[..., None]


def flat(text):
    c = colour(text)
    return lambda p: np.tile(c, (len(p), 1))


def strands(p, along_y=True):
    """Hairs lying back along the body: lighter and darker streaks."""
    return value_noise(p[:, 0] * 2.6 + p[:, 2] * 2.2, p[:, 1] * 0.75 + 11)


def eyes(x, y, z, r, iris="#1a1410"):
    """A round dark eye on each side with a bright spot, so that it looks alive."""
    parts = []
    for s in (-1, 1):
        eye = ell((s * x, y, z), (r, r, r))
        eye.eye = (s * x, y, z, r)  # asleep, it closes
        spot = ell((s * x - 0.1, y + r * 0.45, z + r * 0.42), (r * 0.34, r * 0.34, r * 0.34))
        spot.spot = True
        parts.append((eye, flat(iris)))
        parts.append((spot, flat("#fbf6e8")))
    return parts


def stride_of(frame, size):  # as the game's other models, a step each way
    return {1: size, 2: -size, 10: size * 1.8, 11: -size * 1.8, 20: size, 22: -size}.get(frame, 0)  # 10 and 11 are a gallop


# The walk has four pictures, 20 to 23: the feet furthest apart, a pair passing with its feet lifted, apart the other way, and the other
# pair passing. What's being drawn just now is kept here, so that all the legs needn't be told.
FRAME = {"now": 0}


def foot_lift(index, size):
    """How high a foot is off the ground. Legs step in diagonal pairs."""
    first_pair = index in (0, 3)
    return size if (FRAME["now"] == 21 and not first_pair) or (FRAME["now"] == 23 and first_pair) else 0


def tail_swing(frame, size):
    """How far a tail is to the side: with each step of a walk (1 and 2), and in a swish while standing (8 and 9, or a dog's 5 and 6)."""
    return size * {1: 0.55, 2: -0.55, 8: 1, 9: -1, 5: 1, 6: -1, 10: 0.22, 11: -0.22, 20: 0.55, 21: 0.15, 22: -0.55, 23: -0.15}.get(frame, 0)


def shaded_fur(text, amount=0.3):
    c = colour(text)
    return lambda p: np.tile(c, (len(p), 1)) * (1 - amount / 2 + strands(p)[..., None] * amount)


def walkers(places, top, knee_z, r_top, r_low, foot, stride, upper, lower, hoof=None):
    """Four legs that step in turn. foot is the shape of its end, as x, y and z sizes."""
    parts = []
    for i, (x, y, swing) in enumerate(((places[0], places[1], stride), (-places[0], places[1], -stride), (places[0], -places[1], -stride), (-places[0], -places[1], stride))):
        at = y + swing
        rise = foot_lift(i, knee_z * 0.32)
        knee = (x, y + swing * 0.5 + rise * 0.6, knee_z + rise * 0.5)
        parts.append((smooth_union([tube((x, y, top), knee, r_top, r_low * 1.15), tube(knee, (x, at, foot[2] + 0.2 + rise), r_low * 1.1, r_low)], r_low), lambda p, a=upper, b=lower, k=knee_z: mix(np.tile(colour(b), (len(p), 1)), np.tile(colour(a), (len(p), 1)), np.clip((p[:, 2] - k + 0.8) / 1.6, 0, 1))))
        parts.append((ell((x, at + foot[1] * 0.3, foot[2] + rise), foot), flat(hoof or lower)))
    return parts


def shifted(parts, forward, down):
    """What's in a head and neck, moved for a peck."""
    if not forward and not down:
        return parts
    off = np.array([0, forward, -down], float)
    return [(lambda p, f=field: f(p - off), lambda p, c=paint: c(p - off)) for field, paint in parts]


def speckled(tones, scale=1.0):
    """Feathers: a pattern of light and dark, tile by tile round the bird."""
    tones = [colour(c) for c in tones]
    def paint(p):
        n = value_noise(p[:, 0] * 2.1 * scale + p[:, 2] * 1.4 * scale, p[:, 1] * 2.1 * scale + p[:, 2] * 0.9 * scale)
        rows = (np.floor(p[:, 2] * 1.6 * scale) % 2)
        return np.array(tones)[np.clip((n * len(tones) * 1.15 + rows * 0.25 - 0.2).astype(int), 0, len(tones) - 1)]
    return paint


AIR = (3, 4, 30, 31, 32, 33)
# Through a wingbeat, 30 to 33, how far the tip is above or below the shoulder, and how much of that the elbow has: the wing comes up
# bent, with its tip trailing, and goes down straight.
WING_BEAT = {3: (0.65, 0.45), 4: (-0.5, 0.45), 30: (0.72, 0.62), 31: (0.12, 0.42), 32: (-0.58, 0.45), 33: (-0.12, 0.05)}


def bird_legs(x, high, tone):
    parts = []
    for s in (-1, 1):
        parts.append((tube((s * x, 0.3, high), (s * x, 0.7, 0.8), 0.46, 0.36), flat(tone)))
        parts.append((ell((s * x, 1.3, 0.42), (0.7, 1.35, 0.4)), flat(tone)))
    return parts


def bird_wings(frame, x, y, z, span, paint, folded):
    """Folded along the sides, or out and beating: 3 is up and 4 is down. Thin from front to back, with a broad feathered end."""
    parts = []
    for s in (-1, 1):
        if frame in AIR:
            rise, part = WING_BEAT[frame]
            tip_z = z + span * rise
            elbow = (s * (x + span * 0.48), y, z + (tip_z - z) * part + (span * 0.14 if frame == 33 else 0))
            tip = (s * (x + span), y - span * 0.1, tip_z)
            wing = smooth_union([tube((s * x * 0.8, y, z), elbow, span * 0.2, span * 0.2), tube(elbow, tip, span * 0.2, span * 0.07)], span * 0.08)
            parts.append((lambda p, w=wing, yw=y, h=span * 0.13: np.maximum(w(p), np.abs(p[:, 1] - yw) - h), paint))
        else:
            parts.append((ell((s * x, y - folded[1] * 0.2, z - 0.4), folded), paint))
    return parts


# ---------------------------------------------------------------- reindeer
REINDEER = dict(leg_low="#3f3226", patch="#7d6a55", ring="#e8decb", hoof="#231b14", coat="#c8b596", back="#8c765c", belly="#efe6d4", rump="#f0ead9", neck="#e4d9c3", tail_low="#f6f1e4", tail_top="#6e5a44", mane="#f0e8d6", head="#6b5742", face="#3b2e22", nose="#d8d0c0", velvet="#4f3a27")


def boazu(frame, c=None):
    """A reindeer, with the look the game's first had, after a photograph by the user: a pale coat with darker markings, a dark head and
    legs, a pale neck with a hanging mane and a white rump. Big round hooves, and antlers with several tines and a brow tine."""
    c = c or REINDEER
    stride = stride_of(frame, 2.1)
    parts = []
    for i, (x, y, swing) in enumerate(((3.1, 5.8, stride), (-3.1, 5.8, -stride), (3.1, -5.8, -stride), (-3.1, -5.8, stride))):
        foot = y + swing
        rise = foot_lift(i, 2.2)
        knee = (x, y + swing * 0.45 + rise * 0.7, 7.2 + rise * 0.5)
        def leg_paint(p):
            high = np.clip((p[:, 2] - 6.5) / 5, 0, 1)
            return mix(np.tile(colour(c["leg_low"]), (len(p), 1)), np.tile(colour(c["patch"]), (len(p), 1)), high)
        parts.append((smooth_union([tube((x, y, 13.5), knee, 1.35, 0.75), tube(knee, (x, foot, 2.4 + rise), 0.72, 0.56)], 0.7), leg_paint))
        parts.append((ell((x, foot, 1.75 + rise), (0.95, 1.05, 0.6)), flat(c["ring"])))  # the pale ring over the hoof
        parts.append((ell((x, foot + 0.35, 0.8 + rise), (1.35, 1.75, 0.8)), flat(c["hoof"])))

    body = fur(smooth_union([ell((0, -1.2, 14.6), (4.5, 8.4, 4.7)), ell((0, 5.2, 15.4), (4.2, 3.8, 4.6)), ell((0, -7, 15.2), (4, 3.6, 4.3)), tube((0, 6.5, 16), (0, 12, 18.3), 3.2, 2.2)], 2), 0.8, 1, 3)
    def coat(p):
        streak = strands(p)
        out = np.tile(colour(c["coat"]), (len(p), 1))
        back = np.clip((p[:, 2] - 16.5) / 3, 0, 1)
        out = mix(out, np.tile(colour(c["back"]), (len(p), 1)), back * 0.75)  # darker along the back and flanks
        patches = (noise3(p, np.array([0.3, 0.16, 0.3]), 8) > 0.6)[..., None]
        out = np.where(patches, colour(c["patch"]), out)
        belly = np.clip((11.5 - p[:, 2]) / 2.5, 0, 1)
        out = mix(out, np.tile(colour(c["belly"]), (len(p), 1)), belly)
        rump = np.clip((-7.2 - p[:, 1]) / 2, 0, 1)
        out = mix(out, np.tile(colour(c["rump"]), (len(p), 1)), rump)
        neck = np.clip((p[:, 1] - 5.6) / 3, 0, 1)
        out = mix(out, np.tile(colour(c["neck"]), (len(p), 1)), neck * 0.9)
        return out * (0.86 + streak[..., None] * 0.3)
    parts.append((body, coat))
    # The tail: short but plain to see, standing out from the white rump, dark above and white beneath.
    swing = tail_swing(frame, 1.7)
    tail = fur(smooth_union([tube((0, -9, 17.2), (swing * 0.6, -11.6, 16.8), 1.15, 1.2), tube((swing * 0.6, -11.6, 16.8), (swing, -12.9, 15.6), 1.2, 0.55)], 0.5), 0.35, 1.8, 6)
    parts.append((tail, lambda p: mix(np.tile(colour(c["tail_low"]), (len(p), 1)), np.tile(colour(c["tail_top"]), (len(p), 1)), np.clip((p[:, 2] - 16.7) / 0.5, 0, 1)) * (0.9 + strands(p)[..., None] * 0.2)))
    # The mane hanging under the neck.
    parts.append((fur(smooth_union([ell((0, 9, 12.6), (2.2, 3, 2.8)), ell((0, 7.4, 10.6), (1.4, 1.7, 2))], 1), 0.8, 1.6, 5), lambda p: np.tile(colour(c["mane"]), (len(p), 1)) * (0.88 + strands(p)[..., None] * 0.26)))

    def head_paint(p):
        out = np.tile(colour(c["head"]), (len(p), 1))
        out = mix(out, np.tile(colour(c["coat"]), (len(p), 1)), np.clip((13.4 - p[:, 1]) / 1.6, 0, 1))
        out = mix(out, np.tile(colour(c["face"]), (len(p), 1)), np.clip((p[:, 1] - 15) / 1.5, 0, 1))
        return out * (0.9 + strands(p)[..., None] * 0.2)
    parts.append((smooth_union([ell((0, 13.7, 17.6), (2.2, 3.2, 2.3)), ell((0, 16.6, 16.5), (1.75, 2.1, 1.6))], 0.9), head_paint))
    parts.append((ell((0, 18.3, 16.6), (1.3, 0.75, 0.9)), flat(c["nose"])))  # the pale, furred nose
    parts += eyes(2.0, 14.3, 18.4, 0.72)
    for s in (-1, 1):
        parts.append((ell((s * 2.8, 12, 19.3), (1.35, 0.55, 0.75)), flat(c["patch"])))
    # Antlers, in velvet: back and up, each with tines.
    velvet = lambda p: np.tile(colour(c["velvet"]), (len(p), 1)) * (0.85 + value_noise(p[:, 0] * 2, p[:, 2] * 2)[..., None] * 0.45)
    def antler(p):
        parts_of = []
        for s in (-1, 1):
            parts_of += [
                tube((s * 1.2, 12.3, 19.5), (s * 4.6, 9.4, 25), 0.62, 0.48),
                tube((s * 4.6, 9.4, 25), (s * 6.6, 10.6, 30), 0.48, 0.36),
                tube((s * 6.6, 10.6, 30), (s * 5, 13, 34.5), 0.36, 0.2),
                tube((s * 1.4, 12.5, 20), (s * 1.9, 17.6, 22.2), 0.45, 0.2),  # the brow tine, reaching forward over the face
                tube((s * 1.9, 16, 21.6), (s * 3.4, 17.6, 23.4), 0.3, 0.14),
                tube((s * 4.9, 9.4, 26.4), (s * 8.4, 7.2, 29.2), 0.34, 0.14),
                tube((s * 6.2, 10.4, 29.2), (s * 9, 11.4, 32.2), 0.3, 0.13),
                tube((s * 6, 11.4, 31.6), (s * 3.4, 12.4, 35), 0.26, 0.12),
            ]
        return np.minimum.reduce([f(p) for f in parts_of])
    parts.append((antler, velvet))
    return parts


# A wild forest reindeer (goddi): the same animal, darker and browner all over, the neck a little paler, the white only on the rump
# and over the hooves. From general knowledge of the Finnish forest reindeer; unchecked.
WILD_REINDEER = dict(REINDEER, leg_low="#2a2019", patch="#4c3b2c", coat="#6a5440", back="#4a3a2b", belly="#cfc3ae", rump="#e8dfcd",
                     neck="#a39279", tail_low="#efe8d8", tail_top="#45372a", mane="#b8aa92", head="#45372a", face="#2a2019", nose="#8e8170",
                     velvet="#3b2b1e")


def goddi(frame):
    return boazu(frame, WILD_REINDEER)


# -------------------------------------------------------------------- fox
def rieban(frame):
    """A red fox: orange-red, white under the chin, on the chest and belly and at the tail's tip, with black stockings and black backs to the ears."""
    stride = stride_of(frame, 1.5)
    parts = []
    for i, (x, y, swing) in enumerate(((1.5, 3.8, stride), (-1.5, 3.8, -stride), (1.5, -3.8, -stride), (-1.5, -3.8, stride))):
        foot = y + swing
        rise = foot_lift(i, 1.1)
        parts.append((smooth_union([tube((x, y, 6.2), (x, y + swing * 0.5 + rise * 0.6, 3 + rise * 0.5), 0.85, 0.52), tube((x, y + swing * 0.5 + rise * 0.6, 3 + rise * 0.5), (x, foot, 0.8 + rise), 0.5, 0.48)], 0.4),
                      lambda p: mix(np.tile(colour("#1f1a1c"), (len(p), 1)), np.tile(colour("#c9651f"), (len(p), 1)), np.clip((p[:, 2] - 3.8) / 1.6, 0, 1))))
        parts.append((ell((x, foot + 0.4, 0.55 + rise), (0.7, 1.05, 0.55)), flat("#1a1618")))

    body = fur(smooth_union([ell((0, -0.6, 6.6), (2.35, 5.8, 2.5)), ell((0, 3.8, 7.1), (2.2, 2.6, 2.6)), tube((0, 4.6, 8), (0, 7, 9.6), 1.9, 1.5)], 1.3), 0.45, 1.4, 5)
    def coat(p):
        out = np.tile(colour("#d9722a"), (len(p), 1))
        out = mix(out, np.tile(colour("#a8501c"), (len(p), 1)), np.clip((p[:, 2] - 7.8) / 1.2, 0, 1) * 0.55)
        white = np.clip((5.2 - p[:, 2] + (p[:, 1] - 3) * 0.55) / 1, 0, 1)
        out = mix(out, np.tile(colour("#fbf6ea"), (len(p), 1)), white)
        return out * (0.86 + strands(p)[..., None] * 0.3)
    parts.append((body, coat))

    # The bushy tail, carried low, with its white tip.
    swing = tail_swing(frame, 3.4)
    tail = fur(smooth_union([tube((0, -6, 6.6), (swing * 0.45, -10, 5.3), 0.9, 2), tube((swing * 0.45, -10, 5.3), (swing, -14.2, 5.2), 2, 0.8)], 1), 0.55, 1.5, 7)
    def tail_paint(p):
        out = np.tile(colour("#d26c26"), (len(p), 1))
        out = mix(out, np.tile(colour("#fbf6ea"), (len(p), 1)), np.clip((-12.6 - p[:, 1] + (noise3(p, 1.5, 3) - 0.5)) / 0.5, 0, 1))
        return out * (0.86 + strands(p)[..., None] * 0.3)
    parts.append((tail, tail_paint))

    def head_paint(p):
        out = np.tile(colour("#e07d2e"), (len(p), 1))
        # White cheeks and chin, running up the sides of the muzzle.
        cheek = np.clip((9.4 - p[:, 2] + (p[:, 1] - 8) * 0.28) / 0.5, 0, 1)
        return mix(out, np.tile(colour("#fbf6ea"), (len(p), 1)), cheek) * (0.9 + strands(p)[..., None] * 0.2)
    parts.append((smooth_union([ell((0, 7.2, 10), (2.4, 2.35, 2.05)), tube((0, 8.6, 9.5), (0, 12.2, 8.9), 1.3, 0.52), ell((s := 0, 7.1, 9.2), (2.7, 1.7, 1.3))], 0.8), head_paint))
    parts.append((ell((0, 12.7, 9), (0.55, 0.45, 0.5)), flat("#141216")))
    parts += eyes(1.25, 9.1, 10.65, 0.5, "#6b3b12")
    parts += [(ell((s * 1.28, 9.5, 10.65), (0.27, 0.27, 0.27)), flat("#141216")) for s in (-1, 1)]
    for s in (-1, 1):
        ear = smooth_union([tube((s * 1.5, 6.7, 11.4), (s * 1.85, 6.5, 15), 1.05, 0.14)], 0.1)
        parts.append((ear, lambda p: np.where((p[:, 1] < 6.4)[..., None], colour("#1f1a1c"), np.where((p[:, 2] > 13.6)[..., None], colour("#2b2224"), colour("#e8843a")))))
    return parts


# ------------------------------------------------------------------- bear
def guovza(frame):
    """A brown bear: heavy, high at the shoulders, its head low and broad with small round ears and a paler muzzle, its coat shaggy and
    darker on the legs."""
    stride = stride_of(frame, 1.9)
    parts = []
    for i, (x, y, swing) in enumerate(((3.5, 6, stride), (-3.5, 6, -stride), (3.8, -5.6, -stride), (-3.8, -5.6, stride))):
        foot = y + swing
        rise = foot_lift(i, 1.5)
        shaggy = fur(smooth_union([tube((x, y, 10), (x, y + swing * 0.6 + rise * 0.6, 3.5 + rise), 2.4, 1.75), ell((x, foot + 0.2, 1.3 + rise), (1.9, 2.5, 1.3))], 0.9), 0.6, 1.3, 9)
        parts.append((shaggy, lambda p: np.tile(colour("#3b2616"), (len(p), 1)) * (0.8 + strands(p)[..., None] * 0.42)))
        for claw in (-1, 0, 1):
            parts.append((ell((x + claw * 0.8, foot + 2.5, 0.55 + rise), (0.3, 0.55, 0.3)), flat("#d8ccb2")))
    body = fur(smooth_union([ell((0, -1.2, 11.2), (6.2, 9.8, 6.6)), ell((0, 5, 13.4), (5.3, 4.6, 5.5)), ell((0, -7, 11), (5.5, 4.4, 5.6))], 2.4), 1.2, 0.9, 11)
    def coat(p):
        out = np.tile(colour("#6b4526"), (len(p), 1))
        out = mix(out, np.tile(colour("#8c6236"), (len(p), 1)), np.clip((p[:, 2] - 13) / 4, 0, 1) * 0.8)  # sun-bleached along the back
        out = mix(out, np.tile(colour("#4a2e19"), (len(p), 1)), np.clip((8 - p[:, 2]) / 3, 0, 1))
        clump = noise3(p, 0.9, 2)
        return out * (0.74 + strands(p)[..., None] * 0.28 + clump[..., None] * 0.28)
    parts.append((body, coat))
    parts.append((ell((tail_swing(frame, 0.7), -11.4, 12.5), (1.1, 1, 1)), flat("#5a3a20")))
    def head_paint(p):
        out = np.tile(colour("#6b4526"), (len(p), 1))
        out = mix(out, np.tile(colour("#a07a4e"), (len(p), 1)), np.clip((p[:, 1] - 12.8) / 1.3, 0, 1))
        return out * (0.82 + strands(p)[..., None] * 0.36)
    head = fur(smooth_union([ell((0, 10.8, 11.8), (4, 3.6, 3.4)), ell((0, 14, 10.8), (2.2, 2.6, 1.9)), tube((0, 6.5, 13), (0, 10, 12.3), 4.4, 3.4)], 1.4), 0.6, 1.3, 13)
    parts.append((head, head_paint))
    parts.append((ell((0, 16.4, 11.2), (1, 0.7, 0.75)), flat("#17120f")))
    parts += eyes(2, 13, 13, 0.6)
    for s in (-1, 1):
        parts.append((ell((s * 3.2, 9.6, 15), (1.25, 0.75, 1.25)), lambda p: np.tile(colour("#4a2e19"), (len(p), 1))))
        parts.append((ell((s * 3.2, 10.1, 14.9), (0.7, 0.4, 0.7)), flat("#2b1a10")))
    return parts


# --------------------------------------------------------------- ptarmigan
def rievssat(frame):
    """A willow ptarmigan in summer: mottled red-brown above with white wings and belly, feathered white feet, and a red comb over the eye.
    Frame 0 stands, 3 and 4 beat the wings, and 5 pecks."""
    peck = frame == 5
    parts = []
    for s in (-1, 1):
        parts.append((tube((s * 1, 0.3, 2.8), (s * 1.1, 0.7, 0.7), 0.62, 0.55), flat("#f4f0e4")))
        parts.append((ell((s * 1.1, 1.3, 0.45), (0.65, 1.15, 0.42)), flat("#efe9da")))
    body = fur(smooth_union([ell((0, -0.4, 4.6), (2.9, 4, 2.9)), ell((0, 2, 5.5), (2.3, 2.3, 2.3))], 1.2), 0.25, 2.2, 3)
    def feathers(p):
        out = np.tile(colour("#8f4f26"), (len(p), 1))
        scale = value_noise(p[:, 0] * 2.4, p[:, 1] * 2.4 + p[:, 2] * 1.3)
        out = np.where((scale > 0.62)[..., None], colour("#4a2a16"), out)
        out = np.where((scale < 0.3)[..., None], colour("#c07a3c"), out)
        return mix(out, np.tile(colour("#f6f2e6"), (len(p), 1)), np.clip((3.6 - p[:, 2]) / 0.8, 0, 1))
    parts.append((body, feathers))
    parts.append((tube((0, -4, 5), (0, -6.2, 5.6), 1.15, 0.5), flat("#2a2020")))  # the dark tail
    # The wings: folded against the sides, or out and beating.
    white = lambda p: np.tile(colour("#f6f2e6"), (len(p), 1)) * (0.9 + value_noise(p[:, 0] * 2, p[:, 1] * 2)[..., None] * 0.18)
    for s in (-1, 1):
        if frame in AIR:
            rise, part = WING_BEAT[frame]
            tip_z = 5.8 + 6.2 * rise
            elbow_z = 5.8 + (tip_z - 5.8) * part + (0.9 if frame == 33 else 0)
            wing = smooth_union([tube((s * 2.2, 0.5, 5.8), (s * 5.6, 0.2, elbow_z), 1.5, 1.25), tube((s * 5.6, 0.2, elbow_z), (s * 9, -0.6, tip_z), 1.25, 0.5)], 0.6)
            flat_wing = lambda p, w=wing: np.maximum(w(p), np.abs(p[:, 1] - 0) - 2.2)
            parts.append((flat_wing, white))
        else:
            parts.append((ell((s * 2.75, -0.8, 4.9), (0.75, 3, 1.6)), white))
    head_at = (0, 4.3, 4.1) if peck else (0, 3.6, 7.9)
    def head_paint(p):
        return feathers(p + np.array([0, 0, 10]))
    parts.append((smooth_union([ell(head_at, (1.55, 1.7, 1.5)), tube((0, 2.2, 6.4), head_at, 1.6, 1.3)], 0.7), head_paint))
    hx, hy, hz = head_at
    parts.append((tube((0, hy + 1.3, hz - 0.1), (0, hy + 2.4, hz - 0.5), 0.46, 0.14), flat("#1c1a1a")))
    parts += eyes(1.15, hy + 0.5, hz + 0.3, 0.38)
    for s in (-1, 1):
        parts.append((ell((s * 1.05, hy + 0.3, hz + 0.95), (0.42, 0.85, 0.3)), flat("#d4301f")))  # the comb
    return parts


# ------------------------------------------------- the other forest animals
# Their colours are those the game's earlier models had in src/models.js. Their likeness is from general knowledge, unchecked.
def beana(frame):
    """A dog, tan with a paler chest and muzzle and dark hanging ears. Its tail stands up and wags."""
    stride = stride_of(frame, 1.6)
    parts = walkers((1.7, 4), 5.8, 3, 1.05, 0.72, (0.85, 1.25, 0.6), stride, "#a87c4e", "#8f6a42")
    def coat(p):
        out = np.tile(colour("#b88a5a"), (len(p), 1))
        out = mix(out, np.tile(colour("#8f6a42"), (len(p), 1)), np.clip((p[:, 2] - 8) / 1.5, 0, 1) * 0.6)
        out = mix(out, np.tile(colour("#e0c49c"), (len(p), 1)), np.clip((6 - p[:, 2] + (p[:, 1] - 3) * 0.4) / 1, 0, 1))
        return out * (0.86 + strands(p)[..., None] * 0.3)
    parts.append((fur(smooth_union([ell((0, -0.5, 6.8), (2.8, 6.2, 2.9)), ell((0, 4, 7.2), (2.5, 2.6, 2.9)), tube((0, 5, 8), (0, 7.2, 9.8), 2.2, 1.9)], 1.4), 0.4, 1.4, 3), coat))
    swing = tail_swing(frame, 3.2)
    parts.append((fur(smooth_union([tube((0, -6, 8), (swing * 0.5, -8.6, 11), 0.95, 0.85), tube((swing * 0.5, -8.6, 11), (swing, -8.8, 13.6), 0.85, 0.4)], 0.5), 0.3, 1.8, 5), shaded_fur("#8f6a42")))
    def head_paint(p):
        return mix(np.tile(colour("#b88a5a"), (len(p), 1)), np.tile(colour("#e0c49c"), (len(p), 1)), np.clip((p[:, 1] - 9.4) / 1, 0, 1)) * (0.9 + strands(p)[..., None] * 0.2)
    parts.append((smooth_union([ell((0, 7.6, 10.2), (2.6, 2.8, 2.4)), tube((0, 9.4, 9.6), (0, 12.2, 9.1), 1.45, 1.05)], 0.8), head_paint))
    parts.append((ell((0, 13, 9.4), (0.75, 0.5, 0.62)), flat("#17141a")))
    parts += eyes(1.55, 9.2, 10.85, 0.56, "#3b2412")
    for s in (-1, 1):
        parts.append((tube((s * 2, 7, 12), (s * 2.9, 6.7, 9.2), 1, 0.75), shaded_fur("#7a5a38")))
    return parts


def njoammil(frame):
    """A mountain hare, grey-white: long hind feet, a white scut, and long ears with dark tips."""
    reach = 1.5 if frame == 1 else 0
    parts = []
    for s in (-1, 1):
        parts.append((smooth_union([ell((s * 2.6, -3, 2.8 + (0.6 if frame == 1 else 0)), (1.5, 3, 2.4)), ell((s * 2.5, -1.4 - reach, 0.6), (1, 3.2, 0.6))], 0.8), shaded_fur("#c9c5b8")))
        parts.append((tube((s * 1.4, 3, 4), (s * 1.4, 3.9 + reach, 0.8), 0.75, 0.6), shaded_fur("#d8d4c8")))
    parts.append((fur(smooth_union([ell((0, -0.5, 5.8), (3.2, 5.2, 3.6)), ell((0, 3, 7), (2.4, 2.6, 2.8))], 1.4), 0.55, 1.4, 3), lambda p: mix(np.tile(colour("#c4bfae"), (len(p), 1)), np.tile(colour("#f4f1e8"), (len(p), 1)), np.clip((5 - p[:, 2]) / 2, 0, 1)) * (0.84 + strands(p)[..., None] * 0.32)))
    parts.append((fur(ell((0, -6, 6.5), (1.6, 1.4, 1.6)), 0.5, 1.8, 7), flat("#fbf8ee")))
    parts.append((fur(smooth_union([ell((0, 5, 9.6), (2.3, 2.8, 2.3)), ell((0, 6.8, 9.1), (1.3, 1.5, 1.2))], 0.8), 0.25, 1.8, 5), shaded_fur("#d6d1c3")))
    parts.append((ell((0, 8, 9.2), (0.6, 0.42, 0.5)), flat("#d98a94")))
    parts += eyes(1.7, 6.1, 10.3, 0.62, "#2a1a10")
    for s in (-1, 1):
        ear = tube((s * 1, 4, 11.5), (s * 1.5, 2.6, 18), 0.95, 0.65)
        parts.append((ear, lambda p: np.where((p[:, 2] > 16.8)[..., None], colour("#22222c"), np.where((p[:, 1] > 3.6)[..., None], colour("#e8b8c0"), colour("#c9c5b8")))))
    return parts


def oarri(frame):
    """A red squirrel: rusty red, a white front, tufted ears, and a great bushy tail standing clear of the back in an S."""
    rise = 1 if frame == 1 else 0
    parts = []
    for s in (-1, 1):
        parts.append((ell((s * 1.6, 0.8, 0.8), (1.1, 2.2, 0.8)), shaded_fur("#6e3218")))
        parts.append((tube((s * 1.3, 2.4, 8 + rise), (s * 0.8, 3.8, 6.4 + rise), 0.56, 0.44), shaded_fur("#6e3218")))
    def coat(p):
        out = np.tile(colour("#a84d24"), (len(p), 1))
        return mix(out, np.tile(colour("#f6eedc"), (len(p), 1)), np.clip((p[:, 1] - 1.6 - np.abs(p[:, 0]) * 0.3) / 0.5, 0, 1)) * (0.86 + strands(p)[..., None] * 0.3)
    parts.append((fur(smooth_union([ell((0, -1, 3.8), (2.6, 3, 3.4)), ell((0, 1, 7.4 + rise), (2, 2.1, 3.4))], 1.2), 0.3, 1.8, 3), coat))
    parts.append((smooth_union([ell((0, 2.2, 11.4 + rise), (2.1, 2.4, 2)), tube((0, 3.8, 11 + rise), (0, 5.2, 10.6 + rise), 1, 0.6)], 0.7), shaded_fur("#b85a2a")))
    parts.append((ell((0, 5.7, 10.7 + rise), (0.42, 0.3, 0.36)), flat("#22222c")))
    parts += eyes(1.45, 3.4, 12 + rise, 0.56)
    for s in (-1, 1):
        parts.append((tube((s * 1.2, 1.6, 13 + rise), (s * 1.5, 1.2, 15.9 + rise), 0.72, 0.15), shaded_fur("#6e3218")))
    swing = tail_swing(frame, 2)
    tail = fur(smooth_union([tube((0, -3, 2), (swing * 0.4, -7, 4), 1, 2.7), tube((swing * 0.4, -7, 4), (swing, -7.6, 10), 2.7, 2.5), tube((swing, -7.6, 10), (swing * 0.8, -5, 13.5), 2.5, 1)], 1), 0.9, 1.4, 5)
    parts.append((tail, shaded_fur("#d9783a", 0.4)))
    return parts


def cuoppu(frame):
    """A frog: bright above with dark spots, pale below, and big bulging eyes."""
    back = 2.5 if frame == 1 else 0
    skin = lambda p: np.where((value_noise(p[:, 0] * 1.1, p[:, 1] * 1.1) > 0.68)[..., None], colour("#23632c"), mix(np.tile(colour("#44a64e"), (len(p), 1)), np.tile(colour("#dcecb4"), (len(p), 1)), np.clip((2.7 - p[:, 2]) / 0.7, 0, 1)))
    parts = []
    for s in (-1, 1):
        parts.append((smooth_union([ell((s * 4.6, -2 - back, 2.1), (2, 3.6, 1.7)), ell((s * 5.5, 1 - back * 2, 0.6), (1.5, 2.6, 0.55))], 0.7), skin))
        parts.append((tube((s * 3, 3.5, 2.5), (s * 4, 5.6, 0.7), 0.8, 0.65), skin))
        parts.append((ell((s * 4.2, 6.2, 0.45), (1.2, 1, 0.4)), skin))
    parts.append((smooth_union([ell((0, -0.5, 3.6), (4.6, 5, 3.1)), ell((0, 3.5, 4.5), (3.5, 3, 2.5))], 1.4), skin))
    for s in (-1, 1):
        parts.append((ell((s * 2.1, 3.3, 7), (1.5, 1.5, 1.35)), flat("#62b85f")))
        parts.append((ell((s * 2.3, 4.1, 7.25), (0.92, 0.86, 0.85)), flat("#e6c64a")))
        parts.append((ell((s * 2.42, 4.62, 7.35), (0.5, 0.42, 0.34)), flat("#141216")))
    parts.append((tube((-2.2, 6.1, 3.7), (2.2, 6.1, 3.7), 0.12, 0.12), flat("#23632c")))
    return parts


def sahpan(frame):
    """A mouse, grey with a paler belly: big round pink ears and a long thin pink tail."""
    parts = walkers((1.1, 2), 1.5, 0.8, 0.5, 0.36, (0.5, 0.7, 0.3), stride_of(frame, 0.9), "#7a7a84", "#d9a0a8")
    parts.append((fur(smooth_union([ell((0, -0.5, 2.9), (2.4, 4.2, 2.6)), tube((0, 2.5, 3.5), (0, 6.3, 2.6), 2, 0.75)], 1.2), 0.25, 2.2, 3), lambda p: mix(np.tile(colour("#92929b"), (len(p), 1)), np.tile(colour("#d8d6d2"), (len(p), 1)), np.clip((1.9 - p[:, 2]) / 0.7, 0, 1)) * (0.86 + strands(p)[..., None] * 0.3)))
    parts.append((ell((0, 7, 2.6), (0.5, 0.38, 0.42)), flat("#d9798a")))
    parts += eyes(1.3, 4.3, 3.7, 0.5, "#141216")
    for s in (-1, 1):
        parts.append((ell((s * 1.7, 2.6, 5.9), (1.5, 0.45, 1.5)), flat("#a9a0a4")))
        parts.append((ell((s * 1.7, 2.95, 5.85), (1.05, 0.25, 1.05)), flat("#e4aab2")))
    swing = tail_swing(frame, 2.4)
    parts.append((smooth_union([tube((0, -4.5, 2.2), (swing * 0.6 + 1, -8, 1.2), 0.42, 0.3), tube((swing * 0.6 + 1, -8, 1.2), (swing - 0.5, -11, 1.8), 0.3, 0.2)], 0.2), flat("#d9a0a8")))
    return parts


def gahttu(frame):
    """A grey tabby cat, with dark stripes, green eyes, and a long tail held up."""
    parts = walkers((1.6, 3.3), 5.5, 2.8, 0.9, 0.62, (0.72, 1, 0.5), stride_of(frame, 1.4), "#7c7c85", "#6e6e78", "#efece4")
    def tabby(p):
        stripe = np.abs(((p[:, 1] + 0.4 * value_noise(p[:, 0] * 0.8, p[:, 2] * 0.8) + 40) % 2.6) - 1.3) < 0.42
        out = np.where(stripe[..., None], colour("#55555f"), colour("#92929a"))
        out = mix(out, np.tile(colour("#e4e2dc"), (len(p), 1)), np.clip((5 - p[:, 2]) / 0.8, 0, 1))
        return out * (0.88 + strands(p)[..., None] * 0.24)
    parts.append((fur(smooth_union([ell((0, 0, 6.5), (2.45, 5.7, 2.6)), ell((0, 4.4, 7.4), (2, 2.2, 2.3))], 1.2), 0.3, 1.6, 3), tabby))
    swing = tail_swing(frame, 2.8)
    tail = smooth_union([tube((0, -5.5, 7.5), (swing * 0.4, -8, 12), 0.75, 0.66), tube((swing * 0.4, -8, 12), (swing, -7, 15.6), 0.66, 0.5)], 0.4)
    parts.append((tail, lambda p: np.where((np.abs(((p[:, 2] + 40) % 2.2) - 1.1) < 0.36)[..., None], colour("#4f4f59"), colour("#8d8d95"))))
    parts.append((smooth_union([ell((0, 6, 10), (2.6, 2.4, 2.35)), ell((0, 7.5, 9.3), (1.4, 1.2, 1))], 0.7), tabby))
    parts.append((ell((0, 8.55, 9.5), (0.42, 0.28, 0.32)), flat("#d98a94")))
    parts += eyes(1.5, 7.35, 10.55, 0.62, "#3f9a3c")
    parts += [(ell((s * 1.55, 7.86, 10.55), (0.2, 0.16, 0.42)), flat("#141216")) for s in (-1, 1)]
    for s in (-1, 1):
        parts.append((tube((s * 1.6, 5.6, 11.6), (s * 2, 5.4, 14.3), 1, 0.15), lambda p: np.where((p[:, 1] > 5.7)[..., None], colour("#e8b8c0"), colour("#6e6e78"))))
    return parts


def savza(frame):
    """A sheep: curly white wool, and a dark face and legs."""
    parts = walkers((2.3, 3.5), 4.6, 2.3, 0.82, 0.62, (0.72, 0.95, 0.5), stride_of(frame, 1.3), "#3a3a48", "#2b2b3a")
    wool = fur(smooth_union([ell((0, 0, 7.6), (4.7, 6.5, 4.7))] + [ell(at, (2.3, 2.3, 2.1)) for at in ((2.6, 3, 10), (-2.6, 3, 10), (2.6, -3, 10), (-2.6, -3, 10), (0, 0, 11.7), (3.9, 0, 7.5), (-3.9, 0, 7.5))], 1.1), 1.4, 1.2, 3)
    parts.append((wool, lambda p: np.tile(colour("#f2efe4"), (len(p), 1)) * (0.8 + noise3(p, 2.4, 5)[..., None] * 0.4)))
    parts.append((ell((tail_swing(frame, 1.1), -6.6, 8.6), (1.2, 1.2, 1.5)), flat("#f6f3e8")))
    parts.append((smooth_union([ell((0, 6.5, 9), (2.1, 2.8, 2.4)), ell((0, 8.4, 8.2), (1.35, 1.3, 1.2))], 0.8), shaded_fur("#3a3a48")))
    parts.append((fur(ell((0, 5.6, 11.4), (1.9, 1.7, 1.25)), 0.8, 1.6, 7), flat("#fbf8ee")))
    parts += eyes(1.65, 7.7, 9.7, 0.52, "#c9a032")
    parts += [(ell((s * 2.8, 5.9, 10), (1.4, 0.6, 0.62)), flat("#3a3a48")) for s in (-1, 1)]
    return parts


def gussa(frame):
    """A cow: white with brown patches, a pink muzzle and udder, short horns and a long tail with a dark tuft."""
    parts = walkers((3.2, 6.6), 8, 4, 1.45, 0.92, (1.1, 1.35, 0.8), stride_of(frame, 2), "#e4dfd2", "#d9d4c8", "#3a2f26")
    parts.append((ell((0, -4, 5.9), (2, 2.3, 1.6)), flat("#eda7a7")))
    def hide(p):
        patch = np.sin(p[:, 0] * 0.6 + p[:, 1] * 0.5) + np.sin(p[:, 1] * 0.7 - p[:, 2] * 0.6) + (noise3(p, 0.5, 3) - 0.5) * 1.1 > 0.6
        return np.where(patch[..., None], colour("#5f4030"), colour("#eeeae0")) * (0.9 + strands(p)[..., None] * 0.2)
    parts.append((smooth_union([ell((0, -0.5, 11), (4.9, 9.2, 5)), ell((0, 6, 11.6), (4.1, 4, 4.7)), ell((0, -7, 11.7), (4.3, 3.2, 4.4)), tube((0, 7, 12.5), (0, 10, 14.1), 3, 2.6)], 1.8), hide))
    swing = tail_swing(frame, 3.2)
    parts.append((tube((0, -9.2, 14), (swing, -10.3, 6.2), 0.46, 0.34), flat("#5f4030")))
    parts.append((fur(ell((swing * 1.03, -10.4, 5.2), (0.95, 0.95, 1.6)), 0.5, 2, 3), flat("#3f2a1f")))
    def face(p):
        out = np.where((p[:, 1] < 11)[..., None] & (np.abs(p[:, 0]) > 1.6)[..., None], colour("#5f4030"), colour("#eeeae0"))
        return mix(out, np.tile(colour("#eda7a7"), (len(p), 1)), np.clip((p[:, 1] - 12.4) / 0.6, 0, 1))
    parts.append((smooth_union([ell((0, 10, 14.2), (2.8, 3.8, 2.8)), tube((0, 12.5, 13.2), (0, 14.2, 12.7), 2, 1.8)], 0.9), face))
    parts += [(ell((s * 0.8, 15.75, 13), (0.4, 0.22, 0.42)), flat("#3a2226")) for s in (-1, 1)]
    parts += eyes(2.25, 11.5, 15, 0.56)
    for s in (-1, 1):
        parts.append((ell((s * 3.4, 8.5, 15.6), (1.45, 0.6, 0.75)), flat("#5f4030")))
        parts.append((tube((s * 1.6, 9, 16.5), (s * 2.7, 9, 19.2), 0.5, 0.18), flat("#d9c9a4")))
    return parts


def spiidni(frame):
    """A pig: pink, with a broad snout, flopping ears and a curly tail."""
    parts = walkers((2.1, 3.5), 3.8, 1.9, 0.95, 0.72, (0.8, 0.9, 0.5), stride_of(frame, 1.2), "#e0999b", "#c97f84", "#6e4a4a")
    skin = lambda p: np.tile(colour("#eda7a7"), (len(p), 1)) * (0.94 + value_noise(p[:, 0] * 1.5, p[:, 1] * 1.5)[..., None] * 0.12)
    parts.append((smooth_union([ell((0, -0.2, 6.6), (4, 6.8, 3.9)), ell((0, 5, 7.2), (3.2, 3, 3.2))], 1.6), skin))
    swing = tail_swing(frame, 1.2)
    parts.append((smooth_union([tube((0, -6.6, 8), (1 + swing, -8, 9.4), 0.45, 0.4), tube((1 + swing, -8, 9.4), (swing - 0.4, -8.6, 10.3), 0.4, 0.34), tube((swing - 0.4, -8.6, 10.3), (0.6 + swing, -8.2, 11), 0.34, 0.25)], 0.2), flat("#c97f84")))
    parts.append((smooth_union([ell((0, 6.5, 7.3), (3, 2.8, 2.8)), tube((0, 8, 6.8), (0, 10.3, 6.8), 1.8, 1.7)], 0.8), skin))
    parts.append((ell((0, 11.5, 6.8), (1.7, 0.5, 1.4)), flat("#d9798a")))
    parts += [(ell((s * 0.6, 11.95, 6.8), (0.36, 0.2, 0.42)), flat("#8e4a55")) for s in (-1, 1)]
    parts += eyes(1.85, 8.3, 8.3, 0.5)
    parts += [(tube((s * 2, 5.5, 9.4), (s * 3.1, 7, 10.8), 1.15, 0.3), flat("#c97f84")) for s in (-1, 1)]
    return parts


def goahppil(frame):
    """A capercaillie hen: mottled brown, a rusty breast, and a barred rounded tail."""
    feathers = speckled(["#4f3d2a", "#7a5c3e", "#9c7650", "#b78f62"])
    parts = [] if frame in AIR else bird_legs(1.5, 4, "#6b5338")
    parts.append((smooth_union([ell((0, -0.5, 8.5), (5, 7.5, 5.2)), ell((0, 4.5, 8.5), (3.5, 2.8, 3.6))], 1.6), lambda p: mix(feathers(p), np.tile(colour("#c47a3a"), (len(p), 1)) * (0.85 + value_noise(p[:, 0] * 2, p[:, 2] * 2)[..., None] * 0.3), np.clip((p[:, 1] - 3.8) / 1, 0, 1))))
    parts.append((tube((0, -6.5, 8.5), (0, -10.5, 7), 1.2, 2.3), lambda p: np.where((np.abs(((p[:, 1] + 40) % 1.7) - 0.85) < 0.32)[..., None], colour("#2f2418"), colour("#7a5c3e"))))
    parts += bird_wings(frame, 4.6, -1, 9.5, 12, speckled(["#4f3d2a", "#6b5338", "#8a6a48"]), (0.9, 5.5, 3.2))
    down = (2, 8) if frame == 5 else (0, 0)
    head = [(smooth_union([tube((0, 5, 11), (0, 6.5, 15), 2, 1.5), ell((0, 7, 16), (2, 2.4, 1.9))], 0.8), feathers),
            (tube((0, 8.8, 16), (0, 10.3, 15.5), 0.7, 0.28), flat("#d9c9a4")), *eyes(1.5, 8, 16.6, 0.42)]
    return parts + shifted(head, *down)


def garanas(frame):
    """A raven: all black with a blue sheen, a heavy beak and a wedge of a tail."""
    sheen = lambda p: np.tile(colour("#2a2a35"), (len(p), 1)) * (0.8 + value_noise(p[:, 0] * 1.8 + p[:, 2], p[:, 1] * 1.8)[..., None] * 0.5) + np.array([0, 2, 10]) * np.clip((p[:, 2] - 9) / 3, 0, 1)[..., None]
    parts = [] if frame in AIR else bird_legs(1.3, 4, "#20202a")
    parts.append((fur(smooth_union([ell((0, -0.5, 8), (3.7, 7, 4.3)), ell((0, 4.8, 8.6), (2.5, 2.3, 2.9))], 1.3), 0.2, 2.4, 3), sheen))
    parts.append((tube((0, -6.5, 8), (0, -12, 6.8), 2, 0.6), sheen))
    parts += bird_wings(frame, 3.5, -1.5, 9.2, 13, sheen, (0.8, 5.6, 2.8))
    down = (1.5, 7) if frame == 5 else (0, 0)
    head = [(fur(ell((0, 6.5, 12), (2.6, 3.2, 2.6)), 0.25, 2.2, 5), sheen), (tube((0, 9, 12.2), (0, 13, 11.2), 1.2, 0.34), flat("#15151b")), *eyes(1.9, 8, 12.8, 0.42, "#6e7277")]
    return parts + shifted(head, *down)


def njukca(frame):
    """A whooper swan: white and long-necked, its beak yellow with a black tip, and dark feet."""
    white = lambda p: np.tile(colour("#f5f2e9"), (len(p), 1)) * (0.92 + value_noise(p[:, 0] * 2, p[:, 1] * 2)[..., None] * 0.12)
    parts = [] if frame in AIR else bird_legs(1.8, 4, "#2b2b3a")
    parts.append((fur(smooth_union([ell((0, -2, 8), (5, 8.5, 5)), tube((0, -9.5, 9), (0, -12, 10.5), 2, 0.8)], 1.4), 0.2, 2, 3), white))
    parts += bird_wings(frame, 4.6, -3, 9.6, 12, white, (0.9, 6, 3))
    parts.append((smooth_union([tube((0, 4.6, 10), (0, 6.5, 15), 2.2, 1.45), tube((0, 6.5, 15), (0, 6, 21), 1.45, 1.25), ell((0, 7, 22.2), (1.9, 2.5, 1.7))], 0.8), white))
    parts.append((tube((0, 9, 22), (0, 11.3, 21.2), 0.92, 0.6), flat("#f2c14e")))
    parts.append((tube((0, 11.2, 21.2), (0, 12.7, 20.8), 0.62, 0.28), flat("#1e1e24")))
    parts += eyes(1.5, 8.2, 22.6, 0.36)
    return parts


def goaskin(frame):
    """A golden eagle: big and dark brown with a paler head, feathered legs, and a hooked yellow beak with a dark tip."""
    brown = speckled(["#3f2918", "#553a22", "#6b4a2c", "#7a5433"])
    parts = []
    if frame not in AIR:
        for s in (-1, 1):
            parts.append((fur(tube((s * 2.2, 0.5, 6), (s * 2.2, 1, 1.6), 1.6, 1), 0.3, 2, 3), brown))
            parts.append((ell((s * 2.2, 2, 0.8), (1.3, 1.8, 0.8)), flat("#e6b93a")))
            parts += [(tube((s * 2.2 + c, 3, 0.8), (s * 2.2 + c, 3.9, 0.15), 0.26, 0.1), flat("#1e1a18")) for c in (-0.7, 0, 0.7)]
    parts.append((fur(ell((0, 0, 11), (5.2, 7, 7)), 0.3, 1.8, 5), brown))
    parts.append((tube((0, -6, 8), (0, -11, 4.5), 2.4, 1.6), brown))
    parts += bird_wings(frame, 5, -0.5, 13, 19, speckled(["#2f1f12", "#4f341f", "#6b4a2c"]), (1, 6, 5))
    down = (1.5, 8) if frame == 5 else (0, 0)
    head = [(fur(ell((0, 4.5, 18.5), (3.2, 3.4, 3.2)), 0.3, 2, 7), lambda p: np.tile(colour("#c49a62"), (len(p), 1)) * (0.8 + value_noise(p[:, 0] * 2.4, p[:, 2] * 2.4)[..., None] * 0.4)),
            (tube((0, 7.4, 18.8), (0, 9.6, 18.4), 1.2, 0.8), flat("#e6b93a")),
            (tube((0, 9.6, 18.4), (0, 10, 16.8), 0.7, 0.26), flat("#2a1e16")),
            *eyes(2.1, 6.5, 19.7, 0.5, "#6b3b12")]
    return parts + shifted(head, *down)


def jievjaskuolfi(frame):
    """A snowy owl: egg-shaped, the head running into the body, white with fine dark bars, no ear tufts and narrow yellow eyes."""
    def barred(p):
        bar = (np.abs(((p[:, 2] + 40) % 2.2) - 1.1) < 0.3) & (np.sin(p[:, 0] * 2.1 + p[:, 2] + np.floor(p[:, 2] / 2.2) * 1.7) > -0.1)
        return np.where(bar[..., None], colour("#5e5e68"), colour("#f7f4ea"))
    parts = []
    if frame not in AIR:
        parts += [(fur(ell((s * 1.7, 1.6, 0.9), (1.6, 2, 0.9)), 0.3, 2.4, 3), flat("#f7f4ea")) for s in (-1, 1)]
    parts.append((fur(smooth_union([ell((0, 0, 8), (5.4, 4.8, 7.4)), ell((0, 0, 15.3), (4.8, 4.4, 3.8))], 1.8), 0.22, 2.2, 5), lambda p: np.where((p[:, 2] > 13)[..., None], colour("#fbf8ee"), barred(p))))
    parts.append((tube((0, -3.5, 4), (0, -6, 1.8), 1.8, 1.1), barred))
    parts += bird_wings(frame, 5, -0.3, 9, 11, barred, (1, 3.8, 5))
    for s in (-1, 1):
        parts.append((ell((s * 2, 3.95, 16), (1.5, 0.55, 0.78)), flat("#f2c14e")))
        parts.append((ell((s * 2, 4.42, 16), (0.7, 0.22, 0.65)), flat("#17141a")))
    parts.append((tube((0, 4.2, 15), (0, 4.95, 13.9), 0.55, 0.18), flat("#2f2f3a")))
    return parts


def beahceloddi(frame):
    """A capercaillie cock in display, after a photograph the user gave: dark, with a great fan of a tail raised behind him, a shining green
    breast, a white spot at the shoulder, a brown wing, a red brow, a pale beak and a shaggy beard."""
    parts = [] if frame in AIR else bird_legs(1.8, 5, "#6b5338")
    for angle in (-68, -50, -33, -17, 0, 17, 33, 50, 68):
        a = np.radians(angle)
        parts.append((tube((0, -5, 10), (np.sin(a) * 11, -9 + abs(np.sin(a)) * 2, 10 + np.cos(a) * 12), 0.9, 1.5), lambda p: np.where((np.hypot(p[:, 0], p[:, 2] - 10) > 9.5)[..., None], colour("#4d4d5c"), np.where((np.abs(((np.hypot(p[:, 0], p[:, 2] - 10) + 9) % 2.2) - 1.1) < 0.2)[..., None], colour("#5e5e68"), colour("#2b2b36")))))
    def body(p):
        out = np.where((p[:, 2] < 5.5)[..., None], colour("#23232c"), colour("#2f2f3a")) * (0.85 + value_noise(p[:, 0] * 2, p[:, 1] * 2)[..., None] * 0.35)
        breast = (p[:, 1] > 2.5) & (p[:, 2] > 8) & (p[:, 2] < 12.5)
        out[breast] = (np.tile(colour("#2f8a6a"), (len(p), 1)) * (0.75 + value_noise(p[:, 0] * 3, p[:, 2] * 3)[..., None] * 0.6))[breast]
        return out
    parts.append((fur(ell((0, 0, 9), (5, 6.5, 5.2)), 0.25, 2, 3), body))
    parts += bird_wings(frame, 4.5, -1.5, 10, 14, speckled(["#553a22", "#7a5433", "#94693f"]), (1, 4, 3.2))
    parts += [(ell((s * 5, 2, 11.4), (0.62, 0.9, 0.9)), flat("#f4f1e8")) for s in (-1, 1)]
    down = (3, 11) if frame == 5 else (0, 0)
    head = [(smooth_union([tube((0, 3, 12), (0, 4.5, 19), 2.4, 1.7), ell((0, 5, 20.5), (2.1, 2.7, 2))], 0.8), lambda p: np.tile(colour("#33333f"), (len(p), 1)) * (0.85 + value_noise(p[:, 0] * 2.5, p[:, 2] * 2.5)[..., None] * 0.35)),
            *[(ell((s * 1.6, 5.2, 22), (0.8, 1.1, 0.5)), flat("#d13a30")) for s in (-1, 1)],
            (tube((0, 7, 20.8), (0, 9, 21.6), 1, 0.5), flat("#e6dfc8")),
            (fur(tube((0, 5.6, 19), (0, 6, 16.5), 1.1, 0.4), 0.5, 2.4, 5), flat("#20202a")),
            *eyes(1.6, 6.4, 20.6, 0.42)]
    return parts + shifted(head, *down)


def beaiveloddi(frame):
    """A butterfly, orange and yellow with dark edges, its wings folding upwards from a thin body: frame 0 lies lowest and 2 is raised."""
    tilt = np.radians((14, 34, 60, 80, 60, 34)[frame - 40])  # opening and closing, the body rising and falling a little against them
    bob = (0, 0.2, 0.5, 0.7, 0.5, 0.2)[frame - 40]
    def wing_space(p, s):
        x = p[:, 0] * s
        return np.stack([x * np.cos(tilt) + (p[:, 2] - 0.6 - bob) * np.sin(tilt), p[:, 1], -x * np.sin(tilt) + (p[:, 2] - 0.6 - bob) * np.cos(tilt)], axis=1)
    def wing_field(p):
        ds = []
        for s in (-1, 1):
            q = wing_space(p, s)
            fore = ((q[:, 0] - 3.3) / 3.5) ** 2 + ((q[:, 1] - 1.5) / 2.9) ** 2 - 1
            hind = ((q[:, 0] - 2.4) / 2.6) ** 2 + ((q[:, 1] + 2) / 2.4) ** 2 - 1
            ds.append(np.maximum(np.minimum(fore, hind) * 1.4, np.abs(q[:, 2]) - 0.08))
        return np.minimum(*ds)
    def wing_paint(p):
        s = np.where(p[:, 0] >= 0, 1, -1)
        out = np.zeros((len(p), 3))
        for side in (-1, 1):
            chosen = s == side
            if not chosen.any():
                continue
            q = wing_space(p[chosen], side)
            fore = ((q[:, 0] - 3.3) / 3.5) ** 2 + ((q[:, 1] - 1.5) / 2.9) ** 2
            hind = ((q[:, 0] - 2.4) / 2.6) ** 2 + ((q[:, 1] + 2) / 2.4) ** 2
            ring = np.minimum(fore, hind)
            c = np.tile(colour("#ee8f2e"), (len(q), 1))
            c[q[:, 1] > 1.2] = colour("#f2c14e")
            c[ring > 0.68] = colour("#3a2214")
            spots = np.abs(((np.arctan2(q[:, 1] - 0.2, q[:, 0] - 2) + 7) % 0.5) - 0.25) < 0.09
            c[(ring > 0.76) & (ring < 0.92) & spots] = colour("#ffe680")
            c[((q[:, 0] - 3.6) ** 2 + (q[:, 1] - 1.6) ** 2) < 0.5] = colour("#2a1a10")
            out[chosen] = c
        return out
    return [(wing_field, wing_paint),
            (tube((0, -2.5, 0.6 + bob), (0, 2.5, 0.6 + bob), 0.35, 0.3), flat("#2b2b3a")),
            (ell((0, 2.8, 0.7 + bob), (0.5, 0.5, 0.5)), flat("#2b2b3a")),
            *[(tube((s * 0.2, 3, 0.9 + bob), (s * 1.3, 5.2, 1.6 + bob), 0.08, 0.08), flat("#2b2b3a")) for s in (-1, 1)]]


# ------------------------------------------------------------- dogs and their kin
def tone(text):
    return lambda p: np.tile(colour(text), (len(p), 1))


def canine(frame, b):
    """A dog-like body, with what differs between breeds in b: leg is how high the body stands; wide and deep are the body's size; ears are
    prick, flop, round or tuft; tail is curl, plume, otter, bob or brush; coat and face colour a point; shag is how rough the fur is."""
    stride = stride_of(frame, 1.6)
    leg, wide, deep = b.get("leg", 5.8), b.get("wide", 1), b.get("deep", 1)
    z = leg - 5.8  # everything above the legs moves up or down with them
    parts = walkers((1.7 * wide, 4), leg, leg * 0.5, 1.05 * wide, 0.72 * wide, (0.85 * wide, 1.25, 0.6), stride, b["leg_top"], b["leg_low"], b.get("foot"))
    shag = b.get("shag", 0.4)
    body = fur(smooth_union([ell((0, -0.5, 6.8 + z), (2.8 * wide, 6.2, 2.9 * deep)), ell((0, 4, 7.2 + z), (2.5 * wide, 2.6, 2.9 * deep)), tube((0, 5, 8 + z), (0, 7.2, 9.8 + z), 2.2 * wide, 1.9 * wide)], 1.4), shag, 1.4, 3)
    parts.append((body, lambda p: b["coat"](p - np.array([0, 0, z])) * (0.86 + strands(p)[..., None] * 0.3)))
    swing = tail_swing(frame, 3.2)
    tail_paint = lambda p: b.get("tail_coat", b["coat"])(p - np.array([0, 0, z])) * (0.86 + strands(p)[..., None] * 0.3)
    kind = b["tail"]
    at = lambda x, y, h: (x, y, h + z)
    if kind == "curl":  # up and over the back
        tail = fur(smooth_union([tube(at(0, -6, 8), at(swing * 0.3, -8.2, 10.8), 1, 1.35), tube(at(swing * 0.3, -8.2, 10.8), at(swing * 0.6, -6.8, 13), 1.35, 1.2), tube(at(swing * 0.6, -6.8, 13), at(swing, -4.2, 11.2), 1.2, 0.5)], 0.6), shag + 0.15, 1.8, 5)
    elif kind == "plume":  # low and bushy, with a slight curve
        tail = fur(smooth_union([tube(at(0, -6, 7.6), at(swing * 0.5, -8.8, 5.6), 0.9, 1.5), tube(at(swing * 0.5, -8.8, 5.6), at(swing, -10.8, 4.6), 1.5, 0.6)], 0.6), shag + 0.2, 1.7, 5)
    elif kind == "otter":  # thick at the root, carried level, with little hair
        tail = tube(at(0, -6, 7.8), at(swing, -11.4, 8), 0.95, 0.42)
    elif kind == "bob":  # short, with a black end
        tail = tube(at(0, -6, 8), at(swing * 0.4, -8.2, 7.6), 0.72, 0.62)
    else:  # brush, short and bushy
        tail = fur(tube(at(0, -6, 7.4), at(swing * 0.6, -9, 6.2), 1.2, 1.25), shag + 0.2, 1.7, 5)
    parts.append((tail, tail_paint))
    muzzle = b.get("muzzle", 1)
    head = smooth_union([ell((0, 7.6, 10.2 + z), (2.6 * wide, 2.8, 2.4)), tube((0, 9.4, 9.6 + z), (0, 9.4 + 2.8 * b.get("long", 1), 9.1 + z), 1.45 * muzzle, 1.05 * muzzle)], 0.8)
    parts.append((head, lambda p: b["face"](p - np.array([0, 0, z])) * (0.9 + strands(p)[..., None] * 0.2)))
    if b.get("ruff"):  # a long ruff of hair framing a lynx's face
        parts += [(fur(ell((s * 2.7, 7.4, 9.1 + z), (1.1, 1.3, 1.5)), 0.6, 2, 7), tone(b["ruff"])) for s in (-1, 1)]
    end = 9.4 + 2.8 * b.get("long", 1)
    parts.append((ell((0, end + 0.8, 9.4 + z), (0.75 * muzzle, 0.5, 0.62 * muzzle)), flat(b.get("nose", "#17141a"))))
    parts += eyes(1.55 * wide, 9.2, 10.85 + z, 0.56, b.get("iris", "#3b2412"))
    ear_tone = b.get("ear", "#3b2c20")
    for s in (-1, 1):
        if b["ears"] == "prick":
            parts.append((tube((s * 1.7, 6.7, 11.6 + z), (s * 2.1, 6.5, 14.8 + z), 1.15, 0.14), tone(ear_tone)))
        elif b["ears"] == "flop":
            parts.append((tube((s * 2, 7, 12 + z), (s * 2.9, 6.9, 9.3 + z), 1.05, 0.8), tone(ear_tone)))
        elif b["ears"] == "round":
            parts.append((ell((s * 2.2 * wide, 6.4, 12.1 + z), (0.95, 0.5, 0.95)), tone(ear_tone)))
        else:  # tuft: pointed, with a black tuft standing on the tip
            parts.append((tube((s * 1.7, 6.7, 11.6 + z), (s * 2, 6.5, 14.3 + z), 1.1, 0.2), tone(ear_tone)))
            parts.append((tube((s * 2, 6.5, 14.2 + z), (s * 2.1, 6.5, 16.2 + z), 0.22, 0.07), flat("#141216")))
    return parts


def blend(base, other, amount_of):
    return lambda p: mix(tone(base)(p), tone(other)(p), np.clip(amount_of(p), 0, 1))


belly = lambda p: (6 - p[:, 2] + (p[:, 1] - 3) * 0.4)
saddle = lambda p: (p[:, 2] - 8.4) / 1.2
muzzle_of = lambda p: (p[:, 1] - 9.4) / 0.8
brows = lambda p: (0.5 - np.hypot((np.abs(p[:, 0]) - 1.3) / 1.1, (p[:, 2] - 11.6) / 0.7)) * 3
# After the breeds' descriptions: see CREDITS.md. Each has its own size in BREEDS.
DOGS = {
    # Thick and long-haired, here in black with tan marks and pale glasses round the eyes, as many are; any colour is allowed.
    "lapinkoira": dict(ears="prick", tail="curl", shag=0.85, leg_top="#2a2522", leg_low="#c79a63", ear="#201c1a",
                       coat=blend("#2a2522", "#d6ad78", belly), face=lambda p: mix(tone("#2a2522")(p), tone("#d6ad78")(p), np.clip(np.maximum(muzzle_of(p), brows(p)), 0, 1))),
    # Shorter-coated, here black with tan marks and a tail carried lower.
    "lapinporokoira": dict(ears="prick", tail="plume", shag=0.3, leg_top="#1e1c1c", leg_low="#b4814e", ear="#141212", tail_coat=tone("#1e1c1c"),
                           coat=blend("#1e1c1c", "#b4814e", belly), face=lambda p: mix(tone("#1e1c1c")(p), tone("#b4814e")(p), np.clip(np.maximum(muzzle_of(p), brows(p)), 0, 1))),
    # Red-gold, fox-like, with a narrow muzzle.
    "pystykorva": dict(ears="prick", tail="curl", shag=0.45, muzzle=0.78, leg_top="#c8742a", leg_low="#dc9a55", ear="#a85c1e",
                       coat=blend("#c8742a", "#e8b479", belly), face=blend("#c8742a", "#e8b479", muzzle_of)),
    # White with yellow or red patches, and a wedge of a head.
    "pohjanpystykorva": dict(ears="prick", tail="curl", shag=0.25, muzzle=0.8, leg_top="#f2eee2", leg_low="#f2eee2", ear="#b8662a",
                             coat=lambda p: np.where((noise3(p, 0.32, 21) > 0.56)[..., None], colour("#c47a35"), colour("#f4f0e4")),
                             face=lambda p: np.where(((np.abs(p[:, 0]) > 0.75) & (p[:, 1] < 10))[..., None], colour("#b8662a"), colour("#f6f2e8"))),
    # Silver grey with black-tipped guard hairs, dark on the muzzle and ears, and a tail rolled tight.
    "hirvikoira": dict(ears="prick", tail="curl", shag=0.55, leg_top="#a9abab", leg_low="#c4c6c4", ear="#1f2022",
                       coat=lambda p: mix(blend("#8d8f90", "#c9cac8", belly)(p), tone("#3e4042")(p), np.clip(saddle(p), 0, 1) * 0.8) * (0.8 + noise3(p, 2.6, 4)[..., None] * 0.4),
                       face=blend("#8d8f90", "#1f2022", muzzle_of)),
    # Black, with white on the chest, belly, legs, blaze and tail tip.
    "karhukoira": dict(ears="prick", tail="curl", shag=0.4, leg_top="#1b1a1c", leg_low="#f2efe6", ear="#101012",
                       coat=blend("#1b1a1c", "#f2efe6", belly), tail_coat=lambda p: mix(tone("#1b1a1c")(p), tone("#f2efe6")(p), np.clip((-4.6 - p[:, 1]) * 0 + (p[:, 1] + 5) * 0.8, 0, 1)),
                       face=lambda p: mix(tone("#1b1a1c")(p), tone("#f2efe6")(p), np.clip(np.maximum(muzzle_of(p) * 0.8, (0.55 - np.abs(p[:, 0])) * 3), 0, 1))),
    # Grey above and white below, with a white mask and blue eyes.
    "husky": dict(ears="prick", tail="plume", shag=0.55, iris="#5a9fd8", leg_top="#d8d8d4", leg_low="#f4f2ec", ear="#3c4044",
                  coat=blend("#5f6468", "#f4f2ec", lambda p: (7.3 - p[:, 2] + (p[:, 1] - 3) * 0.5)), tail_coat=blend("#5f6468", "#f4f2ec", lambda p: (5.4 - p[:, 2]) * 1.5),
                  face=lambda p: mix(tone("#f4f2ec")(p), tone("#4c5054")(p), np.clip((p[:, 2] - 11.4) * 1.6 - np.maximum(0, 0.7 - np.abs(p[:, 0])) * 0, 0, 1))),
    # Yellow and short-coated, broad-headed, with dropped ears and a thick level tail.
    "labradori": dict(ears="flop", tail="otter", shag=0.12, muzzle=1.18, leg_top="#d9b36c", leg_low="#d9b36c", ear="#b88d4c", nose="#2e2420",
                      coat=blend("#d9b36c", "#ecd4a0", belly), face=blend("#d9b36c", "#ecd4a0", muzzle_of)),
}
BREEDS = {"lapinkoira": 1, "lapinporokoira": 1.02, "pystykorva": 0.88, "pohjanpystykorva": 0.84, "hirvikoira": 1.02, "karhukoira": 1.08, "husky": 1.06, "labradori": 1.12}
WILD = {
    # Grey with a paler face and legs, long-legged, and its bushy tail hanging.
    "gumpe": (1.34, dict(ears="prick", tail="plume", leg=6.6, shag=0.6, iris="#b88a2a", leg_top="#a59c8c", leg_low="#c4bcae", ear="#55504a",
                         coat=lambda p: mix(blend("#847c70", "#d8d2c4", belly)(p), tone("#3f3b37")(p), np.clip(saddle(p), 0, 1) * 0.75) * (0.8 + noise3(p, 2.6, 4)[..., None] * 0.4),
                         face=lambda p: mix(tone("#7c7468")(p), tone("#ddd7ca")(p), np.clip(np.maximum(muzzle_of(p) * 0.7, (p[:, 1] - 8) * 0.5 * (p[:, 2] < 10)), 0, 1)))),
    # Long and low with short strong legs, big paws, a broad round head, dark with a pale stripe from the shoulder along the side and across the rump.
    "geatki": (1.12, dict(ears="round", tail="brush", leg=4, wide=1.22, deep=1.05, long=0.62, shag=0.8, leg_top="#2a1e18", leg_low="#1e1612", ear="#2a1e18",
                          coat=lambda p: mix(tone("#33241b")(p), tone("#b89a6c")(p), np.clip(1 - np.abs(p[:, 2] - 8.1 - p[:, 1] * 0.02) / 0.8, 0, 1) * (p[:, 1] < 3.5)),
                          face=lambda p: mix(tone("#33241b")(p), tone("#8f8474")(p), np.clip((1 - np.abs(p[:, 2] - 11)) * 0.8 * (p[:, 1] > 7.6), 0, 1)))),
    # Long-legged and sturdy, reddish brown with black spots, white beneath, with black ear tufts, a ruff round the face and a short tail with a black end.
    "albbas": (1.22, dict(ears="tuft", tail="bob", leg=6.8, long=0.55, shag=0.3, iris="#b88a2a", muzzle=1.05, nose="#a0605a", leg_top="#b5895a", leg_low="#c8a070", ear="#8c6a44", ruff="#d8d2c4", foot="#c8a070",
                          coat=lambda p: np.where((value_noise(p[:, 0] * 0.9 + p[:, 2] * 0.8, p[:, 1] * 0.9) > 0.68)[..., None], colour("#2a2018"), blend("#b5895a", "#f2ece0", lambda q: (6.6 - q[:, 2]) * 1.3)(p)),
                          tail_coat=lambda p: np.where((p[:, 1] < -7.3)[..., None], colour("#141216"), colour("#b5895a")),
                          face=blend("#b5895a", "#f2ece0", lambda p: (p[:, 1] - 9.2) * 1.2))),
}


def canine_maker(b):
    return lambda frame: canine(frame, b)



# ------------------------------------------------------- more forest animals
# Added 2026-11-12. Each is built from the nearest animal already here: the moose from the reindeer, the marten, stoat and otter
# from the wolverine's long low build, the vole and lemming from the mouse, the hooded crow from the raven and the goose from the
# swan. Their looks are from general knowledge of the Nordic species; unchecked.
def palm(at, radii, tilt, side):
    """A moose's antler palm: a flat plate, tilted up towards its outer edge."""
    a = np.radians(tilt) * side
    c, s_ = np.cos(a), np.sin(a)
    at = np.array(at, float)
    def field(p):
        q = p - at
        q = np.stack([q[:, 0] * c + q[:, 2] * s_, q[:, 1], -q[:, 0] * s_ + q[:, 2] * c], axis=1)
        return blob(q, (0, 0, 0), radii)
    return field


def ealga(frame):
    """A moose bull: a dark brown body high on long legs that are pale below the knee, a hump over the shoulders, a long heavy head
    with an overhanging muzzle, a bell of skin under the throat, long ears, and broad palmed antlers."""
    stride = stride_of(frame, 2.3)
    parts = []
    for i, (x, y, swing) in enumerate(((3, 6.2, stride), (-3, 6.2, -stride), (3, -6, -stride), (-3, -6, stride))):
        foot = y + swing
        rise = foot_lift(i, 2.4)
        knee = (x, y + swing * 0.45 + rise * 0.7, 8 + rise * 0.5)
        def leg_paint(p):
            return mix(np.tile(colour("#b9ad98"), (len(p), 1)), np.tile(colour("#33251a"), (len(p), 1)), np.clip((p[:, 2] - 8.5) / 2.5, 0, 1))
        parts.append((smooth_union([tube((x, y, 15), knee, 1.5, 0.8), tube(knee, (x, foot, 1.6 + rise), 0.76, 0.6)], 0.7), leg_paint))
        parts.append((ell((x, foot + 0.3, 0.75 + rise), (0.95, 1.35, 0.75)), flat("#1c1511")))
    body = fur(smooth_union([ell((0, -1.4, 16.4), (4.3, 8.4, 4.4)), ell((0, 4.8, 18.2), (4.1, 4.2, 5.4)), ell((0, -7.2, 16.4), (3.8, 3.3, 4.1)),
                             tube((0, 6.6, 19), (0, 10.4, 19.6), 3.2, 2.5)], 2), 0.7, 1, 3)
    def coat(p):
        out = np.tile(colour("#3f2d1f"), (len(p), 1))
        out = mix(out, np.tile(colour("#5a4430"), (len(p), 1)), np.clip((p[:, 2] - 19) / 4, 0, 1) * 0.7)  # greyer brown over the hump and back
        out = mix(out, np.tile(colour("#2a1e15"), (len(p), 1)), np.clip((13.5 - p[:, 2]) / 2, 0, 1))
        return out * (0.84 + strands(p)[..., None] * 0.32)
    parts.append((body, coat))
    swing = tail_swing(frame, 0.8)
    parts.append((fur(tube((0, -10.4, 18), (swing, -11.4, 16.6), 0.9, 0.6), 0.3, 1.8, 6), shaded_fur("#33251a")))
    parts.append((fur(smooth_union([tube((0, 12.2, 16.8), (0, 12.6, 13.2), 0.95, 0.5), ell((0, 12.6, 13), (0.6, 0.7, 0.8))], 0.5), 0.5, 1.8, 5), shaded_fur("#2f2218")))  # the bell
    def head_paint(p):
        out = np.tile(colour("#3a2a1d"), (len(p), 1))
        out = mix(out, np.tile(colour("#5b4936"), (len(p), 1)), np.clip((p[:, 1] - 15.5) / 2, 0, 1))  # the greyer muzzle
        return out * (0.88 + strands(p)[..., None] * 0.24)
    parts.append((smooth_union([ell((0, 12.4, 19.8), (2.3, 2.7, 2.4)), tube((0, 13.6, 19.3), (0, 17.6, 17.4), 2, 1.8), ell((0, 18.2, 17.1), (2, 2.1, 2.1))], 1), head_paint))
    parts += [(ell((s * 0.9, 19.9, 17.2), (0.5, 0.35, 0.65)), flat("#1a1310")) for s in (-1, 1)]  # nostrils
    parts += eyes(2.05, 13.6, 20.7, 0.55)
    for s in (-1, 1):
        parts.append((tube((s * 1.8, 11.6, 21.6), (s * 4.2, 10.9, 22.6), 0.95, 0.45), shaded_fur("#3a2a1d")))
    bone = lambda p: np.tile(colour("#c7ae84"), (len(p), 1)) * (0.82 + value_noise(p[:, 0] * 1.6, p[:, 1] * 1.6 + p[:, 2])[..., None] * 0.3)
    def antlers(p):
        bits = []
        for s in (-1, 1):
            bits += [tube((s * 1.4, 11.9, 21.8), (s * 4.4, 11.5, 23.4), 0.62, 0.5), palm((s * 7.4, 11.2, 24.6), (3.8, 2.6, 0.5), 22, s),
                     tube((s * 4.6, 12.2, 23.4), (s * 5.6, 15, 24.6), 0.42, 0.18)]  # a brow point
            for k in range(5):  # points along the palm's outer edge
                base = (s * (5.6 + k * 1.15), 9.2 + k * 0.5, 25.2 + k * 0.45)
                bits.append(tube(base, (s * (6.2 + k * 1.35), 8.6 + k * 0.6, 27.6 + k * 0.4), 0.42, 0.14))
        return np.minimum.reduce([f(p) for f in bits])
    parts.append((antlers, bone))
    return parts


def mustelid(frame, m):
    """A long, low body on short legs, with a small head, little round ears and a tail of its own kind: a marten's, a stoat's or an
    otter's, from what's in m."""
    L, r, leg = m["long"], m["thick"], m["leg"]
    z = leg + r  # the body's middle
    parts = walkers((r * 0.7, L * 0.72), z - r * 0.3, leg * 0.55, r * 0.42, r * 0.3, (r * 0.36, r * 0.55, r * 0.26), stride_of(frame, L * 0.22), m["legs"], m["feet"])
    body = fur(smooth_union([ell((0, -0.3, z), (r, L, r * 0.92)), ell((0, -L * 0.62, z + r * 0.12), (r * 1.06, r * 1.3, r)),
                             tube((0, L * 0.55, z + r * 0.1), (0, L + r * 0.75, z + r * 0.55), r * 0.86, r * 0.72)], r * 0.6), m["shag"], 1.6, 3)
    def coat(p):
        out = np.tile(colour(m["coat"]), (len(p), 1))
        out = mix(out, np.tile(colour(m["back"]), (len(p), 1)), np.clip((p[:, 2] - z - r * 0.4) / (r * 0.5), 0, 1) * 0.6)
        if m.get("under"):  # a sharp line between the back and a pale belly
            out = np.where((p[:, 2] < z - r * 0.3 + np.clip(p[:, 1] - L * 0.4, 0, 9) * 0.5)[..., None], colour(m["under"]), out)
        if m.get("bib"):  # a yellow patch on the throat
            bib = (p[:, 1] > L * 0.45) & (p[:, 2] < z + r * 0.35 + (p[:, 1] - L * 0.45) * 0.35) & (np.abs(p[:, 0]) < r * 0.8)
            out = np.where(bib[..., None], colour(m["bib"]), out)
        return out * (0.86 + strands(p)[..., None] * 0.28)
    parts.append((body, coat))
    hy, hz = L + r * 1.55, z + r * 0.9
    head = smooth_union([ell((0, hy, hz), (r * 0.98, r * 1.05, r * 0.82 * m.get("flat", 1))),
                         tube((0, hy + r * 0.4, hz - r * 0.12), (0, hy + r * 0.4 + m["snout"], hz - r * 0.3), r * 0.55 * m.get("broad", 1), r * 0.36 * m.get("broad", 1))], r * 0.4)
    def head_paint(p):
        out = np.tile(colour(m["coat"]), (len(p), 1))
        if m.get("face"):  # a paler chin and lips
            out = mix(out, np.tile(colour(m["face"]), (len(p), 1)), np.clip((hz - r * 0.35 - p[:, 2]) / (r * 0.25), 0, 1))
        return out * (0.9 + strands(p)[..., None] * 0.2)
    parts.append((head, head_paint))
    tip = hy + r * 0.4 + m["snout"]
    parts.append((ell((0, tip + r * 0.28, hz - r * 0.25), (r * 0.3 * m.get("broad", 1), r * 0.2, r * 0.24)), flat("#141012")))
    parts += eyes(r * 0.58, hy + r * 0.62, hz + r * 0.3, r * 0.24, "#141012")
    for s in (-1, 1):
        parts.append((ell((s * r * 0.72, hy - r * 0.35, hz + r * 0.72 * m.get("flat", 1)), (r * 0.36, r * 0.18, r * 0.32)), flat(m["ear"])))
        if m.get("ear_rim"):
            parts.append((ell((s * r * 0.74, hy - r * 0.3, hz + r * 0.95 * m.get("flat", 1)), (r * 0.3, r * 0.14, r * 0.1)), flat(m["ear_rim"])))
    swing = tail_swing(frame, m["tail_long"] * 0.4)
    root, end = (0, -L - r * 0.2, z + r * 0.1), (swing, -L - r * 0.2 - m["tail_long"], z + m["tail_rise"])
    mid = ((root[0] + end[0]) / 2, (root[1] + end[1]) / 2, (root[2] + end[2]) / 2 + m["tail_long"] * 0.08)
    kind = m["tail"]
    if kind == "bushy":  # a marten's: long and full
        tail = fur(smooth_union([tube(root, mid, r * 0.5, r * 0.75), tube(mid, end, r * 0.75, r * 0.38)], r * 0.3), m["shag"] + 0.25, 1.5, 7)
        parts.append((tail, shaded_fur(m["tail_coat"])))
    elif kind == "tip":  # a stoat's: thin, with a black end
        tail = fur(tube(root, end, r * 0.36, r * 0.42), 0.18, 2, 7)
        length = m["tail_long"]
        parts.append((tail, lambda p: np.where((p[:, 1] < root[1] - length * 0.58)[..., None], colour("#16110e"), colour(m["coat"])) * (0.9 + strands(p)[..., None] * 0.2)))
    else:  # an otter's: thick at the root and tapering, carried low
        tail = smooth_union([tube(root, mid, r * 0.78, r * 0.5), tube(mid, end, r * 0.5, r * 0.16)], r * 0.3)
        parts.append((tail, shaded_fur(m["tail_coat"], 0.2)))
    if m.get("whiskers"):
        for s in (-1, 1):
            for k in (-1, 0, 1):
                parts.append((tube((s * r * 0.35, tip - r * 0.1, hz - r * 0.3), (s * r * 1.35, tip - r * 0.2, hz - r * 0.3 + k * r * 0.22), 0.07, 0.04), flat("#e8e2d4")))
    return parts


MUSTELIDS = {
    # A pine marten: dark chocolate brown, darker on the legs, with a yellow-orange throat bib, pale-rimmed ears and a long full tail.
    "neahti": dict(long=5.4, thick=1.9, leg=2.7, shag=0.4, coat="#5c3a22", back="#4a2e1a", legs="#33200f", feet="#2a1a0d", bib="#e8a943",
                   ear="#4a2e1a", ear_rim="#dcc49a", snout=1.5, tail="bushy", tail_long=7.6, tail_rise=-1.2, tail_coat="#3f2715"),
    # A stoat in its summer coat: warm brown above and creamy white below, the line between them sharp, and a black tip to the tail.
    "buoidda": dict(long=4.6, thick=1.35, leg=1.8, shag=0.2, coat="#8d5a2c", back="#7a4b23", legs="#8d5a2c", feet="#efe5cf", under="#f5eedc",
                    face="#f5eedc", ear="#7a4b23", ear_rim="#efe5cf", snout=1.0, tail="tip", tail_long=4.6, tail_rise=0.6),
    # An otter: long, sleek and dark brown, paler grey-brown on the throat and lips, a broad flat head with tiny ears and whiskers,
    # short legs and a thick tail that tapers to a point.
    "ceavrris": dict(long=6.6, thick=2.3, leg=2, shag=0.15, coat="#4b3424", back="#3e2a1c", legs="#3a281b", feet="#2e2016", face="#a3907a",
                     ear="#3e2a1c", snout=1.1, broad=1.35, flat=0.82, whiskers=True, tail="otter", tail_long=8.5, tail_rise=-1.8, tail_coat="#45301f"),
}


def madjit(frame):
    """A beaver: a round heavy brown body on short legs, a blunt head with small ears and orange front teeth, big dark hind feet,
    and a flat scaly paddle of a tail."""
    parts = walkers((2.2, 2.7), 2.6, 1.2, 0.85, 0.62, (0.85, 1.25, 0.42), stride_of(frame, 0.9), "#4f3420", "#2f2a26")
    body = fur(smooth_union([ell((0, -0.8, 4.6), (3.4, 5.2, 3.7)), ell((0, 3.1, 4.4), (2.6, 2.5, 2.7))], 1.5), 0.32, 1.6, 3)
    def coat(p):
        out = np.tile(colour("#6e4729"), (len(p), 1))
        out = mix(out, np.tile(colour("#55361e"), (len(p), 1)), np.clip((p[:, 2] - 6.5) / 1.6, 0, 1) * 0.7)
        out = mix(out, np.tile(colour("#8a6240"), (len(p), 1)), np.clip((2.4 - p[:, 2]) / 1.2, 0, 1) * 0.6)
        return out * (0.85 + strands(p)[..., None] * 0.3)
    parts.append((body, coat))
    parts.append((smooth_union([ell((0, 5.6, 5.4), (2.15, 2, 1.95)), ell((0, 7.2, 4.9), (1.45, 1.35, 1.25))], 0.8),
                  lambda p: mix(np.tile(colour("#6e4729"), (len(p), 1)), np.tile(colour("#87603d"), (len(p), 1)), np.clip((p[:, 1] - 6.4) / 1, 0, 1)) * (0.9 + strands(p)[..., None] * 0.2)))
    parts.append((ell((0, 8.45, 5.15), (0.62, 0.36, 0.42)), flat("#1c1614")))
    parts.append((rounded((-0.5, 8.05, 3.55), (0.5, 8.35, 4.35), 0.12), flat("#e0832a")))  # the orange front teeth
    parts += eyes(1.35, 6.5, 6.05, 0.4, "#141012")
    parts += [(ell((s * 1.75, 5, 6.9), (0.5, 0.32, 0.48)), flat("#4f3420")) for s in (-1, 1)]
    for s in (-1, 1):  # the big webbed hind feet
        parts.append((ell((s * 2.4, -1.4, 0.35), (1.15, 1.9, 0.36)), flat("#2b2622")))
    swing = tail_swing(frame, 1.3)
    def scales(p):
        cross = (np.abs(((p[:, 0] + p[:, 1]) * 1.6 + 40) % 1 - 0.5) < 0.1) | (np.abs(((p[:, 0] - p[:, 1]) * 1.6 + 40) % 1 - 0.5) < 0.1)
        return np.where(cross[..., None], colour("#4a4440"), colour("#2d2927"))
    parts.append((smooth_union([tube((0, -5.2, 3), (swing * 0.3, -6.6, 1.3), 1.2, 0.9), palm((swing * 0.6, -9, 0.95), (2.1, 3.1, 0.45), 0, 1)], 0.6), scales))
    return parts


def rodent(frame, k):
    """A vole or a lemming, after the mouse: round, with a blunt face, small ears in the fur and a short tail."""
    stride = stride_of(frame, 0.8)
    parts = walkers((1.15, 1.9), 1.4, 0.7, 0.52, 0.36, (0.52, 0.66, 0.3), stride, k["legs"], k["feet"])
    body = fur(smooth_union([ell((0, -0.3, 3 * k["size"]), (2.6 * k["size"], 3.8 * k["size"], 2.7 * k["size"])),
                             ell((0, 3.2, 3.2 * k["size"]), (2 * k["size"], 2.1, 2 * k["size"])),
                             ell((0, 4.9, 2.85 * k["size"]), (1.05, 0.95, 0.9))], 1.1), 0.32, 2.2, 3)
    parts.append((body, k["coat"]))
    parts.append((ell((0, 5.75, 2.95 * k["size"]), (0.42, 0.28, 0.32)), flat(k["nose"])))
    parts += eyes(1.25, 4.15, 3.9 * k["size"], 0.42, "#141012")
    parts += [(ell((s * 1.6, 2.6, 4.9 * k["size"]), (0.8, 0.35, 0.65)), flat(k["ear"])) for s in (-1, 1)]
    swing = tail_swing(frame, 1.2)
    parts.append((tube((0, -3.6, 2.3), (swing, -3.6 - k["tail"], 1.5), 0.4, 0.28), flat(k["tail_tone"])))
    return parts


def vole_coat(p):
    """A bank vole's: chestnut along the back, grey-brown on the flanks, pale grey beneath."""
    out = np.tile(colour("#7c6f63"), (len(p), 1))
    out = mix(out, np.tile(colour("#94603a"), (len(p), 1)), np.clip((p[:, 2] - 3.6) / 1.2, 0, 1))
    out = mix(out, np.tile(colour("#cdc4b6"), (len(p), 1)), np.clip((1.9 - p[:, 2]) / 0.6, 0, 1))
    return out * (0.86 + strands(p)[..., None] * 0.3)


def lemming_coat(p):
    """A Norway lemming's: black head and shoulders with a dark stripe down the middle of the back, the rest tawny yellow-brown, a
    buff band from the eye back over the cheek, and a pale belly."""
    out = np.tile(colour("#c4883f"), (len(p), 1))
    edge = 2.3 - np.clip(p[:, 2] - 3, 0, 3) * 0.35 + (value_noise(p[:, 0] * 1.4 + 7, p[:, 2] * 1.4) - 0.5) * 0.8  # reaching back a little over the shoulders
    black = (p[:, 1] > edge) & (p[:, 2] > 1.9)
    stripe = (np.abs(p[:, 0]) < 0.6 - np.clip(-p[:, 1], 0, 4) * 0.1) & (p[:, 2] > 4.6)
    out = np.where((black | stripe)[..., None], colour("#1d1714"), out)
    cheek = np.hypot((np.abs(p[:, 0]) - 1.7) / 0.6, (p[:, 2] - 3.6 + (p[:, 1] - 3.2) * 0.25) / 0.42) < 1  # from below the eye back towards the ear
    out = np.where((cheek & (p[:, 1] > 1.8) & (p[:, 1] < 4.4))[..., None], colour("#d9a95e"), out)
    out = mix(out, np.tile(colour("#e6d6b2"), (len(p), 1)), np.clip((1.9 - p[:, 2]) / 0.6, 0, 1))
    return out * (0.88 + strands(p)[..., None] * 0.26)


RODENTS = {
    "buovnnjat": dict(size=1, coat=vole_coat, legs="#6a5c50", feet="#b9a99a", nose="#5a3d38", ear="#7a6050", tail=3.2, tail_tone="#6a5c50"),
    "goddesahpan": dict(size=1.1, coat=lemming_coat, legs="#2a211b", feet="#b49c78", nose="#2a1d18", ear="#2a211b", tail=1.4, tail_tone="#b07a38"),
}


def garja(frame):
    """A hooded crow: ash grey on the body, with black head, throat, wings and tail, a black beak, and smaller than the raven."""
    def grey_and_black(p):
        out = np.tile(colour("#a2a2a8"), (len(p), 1)) * (0.88 + value_noise(p[:, 0] * 2 + p[:, 2], p[:, 1] * 2)[..., None] * 0.2)
        bib = (p[:, 1] > 3.2 + (8.2 - p[:, 2]) * 0.9) & (np.abs(p[:, 0]) < 2.2)  # the black throat and upper breast
        return np.where(bib[..., None], colour("#1d1d24"), out)
    black = lambda p: np.tile(colour("#212129"), (len(p), 1)) * (0.8 + value_noise(p[:, 0] * 1.8 + p[:, 2], p[:, 1] * 1.8)[..., None] * 0.45)
    parts = [] if frame in AIR else bird_legs(1.2, 3.8, "#1a1a20")
    parts.append((fur(smooth_union([ell((0, -0.5, 7.4), (3.3, 6, 3.8)), ell((0, 4.2, 8), (2.3, 2.1, 2.6))], 1.2), 0.18, 2.4, 3), grey_and_black))
    parts.append((tube((0, -5.6, 7.6), (0, -10, 6.6), 1.5, 0.95), black))
    parts += bird_wings(frame, 3.3, -1.6, 8.2, 11.5, black, (0.6, 4.6, 2))
    down = (1.5, 6.5) if frame == 5 else (0, 0)
    head = [(fur(ell((0, 5.8, 11), (2.3, 2.7, 2.3)), 0.2, 2.2, 5), black), (tube((0, 8, 11.2), (0, 10.8, 10.4), 0.95, 0.26), flat("#15151b")),
            *eyes(1.7, 7.1, 11.7, 0.38, "#3a3a42")]
    return parts + shifted(head, *down)


def cuonja(frame):
    """A taiga bean goose, the goose of the north's forests and bogs: grey-brown, the back's feathers edged pale in bars, a darker
    head and neck, white under the tail, orange legs, and a black beak with an orange band near its tip."""
    def barred(p):
        n = value_noise(p[:, 0] * 1.2, p[:, 2] * 1.2)
        edge = np.abs(((p[:, 1] + n * 0.7 + 40) % 1.7) - 0.85) < 0.2
        out = np.where(edge[..., None], colour("#b9aa90"), colour("#6f604f"))
        out = mix(out, np.tile(colour("#c9bca4"), (len(p), 1)), np.clip((6.2 - p[:, 2]) / 1.4, 0, 1))  # paler beneath
        return np.where(((p[:, 1] < -5.6) & (p[:, 2] < 7.6))[..., None], colour("#f2eee4"), out)
    dark = lambda p: np.tile(colour("#4f4235"), (len(p), 1)) * (0.88 + value_noise(p[:, 0] * 2, p[:, 2] * 2)[..., None] * 0.22)
    parts = [] if frame in AIR else bird_legs(1.8, 4, "#e5862c")
    parts.append((fur(smooth_union([ell((0, -1.4, 7.6), (4.4, 7.2, 4.3)), tube((0, -8, 8.4), (0, -10.4, 9), 1.8, 0.7)], 1.4), 0.18, 2, 3), barred))
    parts += bird_wings(frame, 4, -2, 9.4, 12, barred, (0.9, 5.6, 2.8))
    down = (2, 9) if frame == 5 else (0, 0)
    head = [(smooth_union([tube((0, 4.2, 9.6), (0, 5.6, 13.6), 1.9, 1.3), tube((0, 5.6, 13.6), (0, 5.9, 16.4), 1.3, 1.15), ell((0, 6.7, 17.1), (1.6, 2.2, 1.5))], 0.8), dark),
            (tube((0, 8.4, 16.9), (0, 10.7, 16.1), 0.78, 0.42), lambda p: np.where(((p[:, 1] > 9.3) & (p[:, 1] < 10.2))[..., None], colour("#e98a2c"), colour("#1b1a1c"))),
            *eyes(1.3, 7.6, 17.6, 0.34)]
    return parts + shifted(head, *down)


# ---------------------------------------------------------------------- foods
# Each at the size and in the colours the game's earlier models had in src/models.js, with more shape and surface. Seen from one side only.
def rounded(low, high, r):
    low, high = np.array(low, float), np.array(high, float)
    def field(p):
        q = np.abs(p - (low + high) / 2) - (high - low) / 2 + r
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - r
    return field


def tint(text, amount=0.2, scale=1.0, seed=0):
    """A colour that varies a little over its surface."""
    return lambda p: np.tile(colour(text), (len(p), 1)) * (1 - amount / 2 + noise3(p, scale, seed)[..., None] * amount)


def fruit(colour_text, radii, z, dimple=None, stalk=None, leaf=None, seed=1, specks=None):
    at = (0, 0, z)
    parts = []
    def paint(p):
        out = tint(colour_text, 0.2, 0.5, seed)(p)
        # A shine towards the light.
        shine = ((p[:, 0] + radii[0] * 0.35) / (radii[0] * 0.28)) ** 2 + ((p[:, 2] - z - radii[2] * 0.45) / (radii[2] * 0.26)) ** 2 < 1
        out[shine] = np.minimum(out[shine] * 1.3 + 22, 255)
        if specks:
            out[noise3(p, 2.6, seed + 3) > 0.62] = colour(specks)
        return out
    parts.append((ell(at, radii), paint))
    if dimple:
        parts.append((ell((0, 0, z + radii[2] * 0.93), (radii[0] * 0.28, radii[1] * 0.28, 0.45)), flat(dimple)))
    if stalk:
        parts.append((tube((0, 0, z + radii[2] * 0.85), (0.8, -0.6, z + radii[2] + 2.8), 0.55, 0.4), flat("#5c3a1e")))
    if leaf:
        parts.append((ell((3.2, -1.4, z + radii[2] + 1.6), (3, 1.3, 0.55)), lambda q: np.where((np.abs(q[:, 1] + 1.4) < 0.16)[..., None], colour("#2f6f32"), colour(leaf))))
    return parts


def plate(on, wide=8.2):
    """On a white plate, with a slight rim, as on the meat counter."""
    rim = lambda p: np.where((np.hypot(p[:, 0], p[:, 1]) > wide - 1)[..., None], colour("#dfe4e6"), colour("#f6f4ee"))
    return [(ell((0, 0, 0.5), (wide, wide, 0.55)), rim)] + on


def f_apple(frame):
    return fruit("#d6443a", (6.5, 6.5, 6), 6, "#8e1f22", True, "#3e8e41", specks=None)


def f_banana(frame):
    parts = []
    for y, tone in ((-2.2, "#e0b53a"), (0, "#f2c94a"), (2.2, "#f7d24e")):
        arc = smooth_union([tube((-8, y, 7.4), (-4, y, 3.2), 0.9, 2), tube((-4, y, 3.2), (4, y, 3.2), 2, 2), tube((4, y, 3.2), (8, y, 7.4), 2, 0.9)], 0.9)
        parts.append((arc, lambda p, c=tone: np.where((np.abs(((np.arctan2(p[:, 2] - 3.2, p[:, 1]) + 7) % 1.57) - 0.78) < 0.08)[..., None], colour("#b58c2a"), colour(c))))
        parts.append((ell((8.3, y, 7.8), (0.7, 0.6, 0.7)), flat("#3f3020")))
    parts.append((tube((-8.5, -2.4, 7.6), (-8.5, 2.4, 7.6), 1.1, 1.1), flat("#7a6a2c")))
    return parts


def f_bread(frame):
    crust = smooth_union([rounded((-5, -8, 0), (5, 8, 6), 1.4), tube((0, -6.5, 5.6), (0, 6.5, 5.6), 5, 5)], 1)
    def paint(p):
        out = tint("#c98a48", 0.26, 0.9, 2)(p)
        out[p[:, 2] < 3] = tint("#a86c32", 0.2, 0.9, 3)(p)[p[:, 2] < 3]
        out[(p[:, 2] > 8) & (np.abs(((p[:, 1] + 12) % 4) - 2) < 0.42)] = colour("#7e4e22")
        out[(p[:, 2] > 9.4) & (noise3(p, 3, 8) > 0.6)] = colour("#f0dcb0")
        end = p[:, 1] > 8.4
        out[end] = tint("#f0dcb0", 0.2, 2.4, 5)(p)[end]
        return out
    return [(crust, paint)]


def f_milk(frame):
    carton = lambda p: np.minimum(rounded((-3, -3, 0), (3, 3, 11), 0.25)(p), np.maximum(rounded((-3, -3, 10.5), (3, 3, 15), 0.2)(p), (np.abs(p[:, 0]) * 1.05 + p[:, 2] - 15)))
    def paint(p):
        out = np.tile(colour("#2f6fc2"), (len(p), 1))
        out[p[:, 2] > 11] = colour("#f4f1e8")
        out[p[:, 2] > 13.8] = colour("#dcdcd4")
        band = (p[:, 2] > 3.5) & (p[:, 2] < 7.5)
        out[band] = colour("#f4f1e8")
        drop = ((p[:, 0] / 1.2) ** 2 + ((p[:, 2] - 5.5) / 1.5) ** 2) < 1
        out[band & drop & (p[:, 1] > 2.9)] = colour("#2f6fc2")
        return out
    return [(carton, paint)]


def f_cheese(frame):
    base = rounded((-7, -6.5, 0), (7, 6.5, 8), 0.5)
    holes = [((-2, 3.4 + 2, 4), 1.7), ((1.5, 3.6, 2.5), 1.2), ((-3.5, 5.6, 6.2), 1), ((-4.5, 0, 8), 1.6), ((0.5, 0.5, 8), 1.1), ((2.4, 3, 8), 0.8)]
    def field(p):
        d = np.maximum.reduce([base(p), p @ np.array([0.55, 0.83, 0]) - 2.6 - 3, p @ np.array([0.55, -0.83, 0]) - 2.6 - 3])
        for at, r in holes:
            d = np.maximum(d, r - np.linalg.norm(p - np.array(at, float), axis=1))
        return d
    return [(field, tint("#f2c94e", 0.14, 0.6, 3))]


def f_egg(frame):
    parts = [(rounded((-11, -7, 0), (11, 7, 4), 0.7), lambda p: np.where(((np.abs(((p[:, 0] + 33) % 7.33) - 3.67) < 0.5) & (p[:, 2] < 3.3))[..., None], colour("#8f7d64"), colour("#a8957a"))),
             (rounded((-11.5, -8.5, 3), (11.5, -7, 11), 0.5), lambda p: np.where(((np.abs(p[:, 0]) < 7) & (np.abs(p[:, 2] - 7) < 2.2))[..., None], colour("#3e74c9"), colour("#b9a88a")))]
    for x in (-7.3, 0, 7.3):
        for y in (-3.2, 3.2):
            parts.append((ell((x, y, 5.8), (2.9, 2.9, 3.4)), tint("#f6eedd", 0.1, 1, x)))
    return parts


def pot_and_soil(low, wide, high):
    """A terracotta pot with a rim, with earth in it."""
    def paint(p):
        out = tint("#b86a42", 0.14, 0.8, 4)(p)
        out[p[:, 2] > low + high * 0.78] = tint("#c97a50", 0.12, 0.8, 5)(p)[p[:, 2] > low + high * 0.78]
        return out
    return [(tube((0, 0, low), (0, 0, low + high), wide * 0.74, wide), paint), (ell((0, 0, low + high + 0.1), (wide * 0.86, wide * 0.86, 0.6)), tint("#3e2a1a", 0.3, 2, 6))]


def f_lesson_plant(frame):
    """A big leafy plant in a pot, its leaves overlapping in several greens."""
    parts = pot_and_soil(0.5, 5.2, 8) + [(tube((0, 0, 8), (0.4, 0, 15), 0.5, 0.4), flat("#55703a"))]
    leaves = []
    for i in range(34):
        turn = i * 2.4
        rise = i / 33
        reach = 7.4 * np.sqrt(np.sin(rise * np.pi * 0.86) + 0.1)
        x, y, z = np.cos(turn) * reach, np.sin(turn) * reach, 12 + rise * 14
        along, up = turn, 0.55 - rise * 1.1
        leaves.append((x, y, z, along, up, i))
    def leaf(l):
        x, y, z, along, up, i = l
        ca, sa = np.cos(along), np.sin(along)
        def field(p):
            q = p - np.array((x, y, z))
            a, b = q[:, 0] * ca + q[:, 1] * sa, -q[:, 0] * sa + q[:, 1] * ca
            c = q[:, 2] - a * up
            return (np.sqrt((a / 3.9) ** 2 + (b / 2.1) ** 2 + (c / 0.65) ** 2) - 1) * 0.65
        return field
    tones = ("#3f8a48", "#57a556", "#2f7a3e", "#6ab564")
    for l in leaves:
        tone = tones[l[5] % 4]
        parts.append((leaf(l), lambda p, c=tone: tint(c, 0.18, 0.9, 3)(p)))
    return parts


def f_flower(frame):
    """A pink flower in a small pot."""
    parts = pot_and_soil(0.5, 3.8, 5.6) + [(tube((0, 0, 6), (0.5, 0, 14), 0.42, 0.34), flat("#3e8e41")), (ell((3, 0.5, 10), (3, 1.3, 0.6)), tint("#3e8e41", 0.16, 1, 1)), (ell((-2.5, 0, 12), (2.6, 1.2, 0.6)), tint("#4fa653", 0.16, 1, 2))]
    for i in range(6):
        angle = i * 1.047
        parts.append((ell((0.5 + np.cos(angle) * 2.3, 0, 15.5 + np.sin(angle) * 2.3), (1.7, 0.7, 1.7)), lambda p, s=i: np.where((noise3(p, 2.2, s) > 0.6)[..., None], colour("#f07aa2"), colour("#e8588a"))))
    parts.append((ell((0.5, 0.5, 15.5), (1.1, 0.7, 1.1)), flat("#f2c14e")))
    return parts


def f_crispbread(frame):
    """Näkkileipä: a packet of thin round-cornered rye slices, standing, with the top ones showing their pitted crust."""
    def slice_paint(p):
        out = tint("#b98a54", 0.22, 1.2, 3)(p)
        pits = (np.abs(((p[:, 0] + 40) % 1.5) - 0.75) < 0.26) & (np.abs(((p[:, 2] + 40) % 1.5) - 0.75) < 0.26)
        out[pits] = out[pits] * 0.68
        return out
    def pack_paint(p):
        out = tint("#e8d9b0", 0.08, 0.6, 2)(p)
        out[(p[:, 2] > 3.2) & (p[:, 2] < 6.4)] = colour("#7a4a22")
        return out
    parts = [(rounded((-6, -1.4, 0), (6, 1.4, 9), 0.5), pack_paint)]
    parts += [(rounded((-5.4, y, 7), (5.4, y + 0.55, 14 - abs(y) * 0.5), 0.2), slice_paint) for y in (-1.1, -0.2, 0.7)]
    return parts


def f_ryebread(frame):
    """Ruisleipä: a dark round loaf, flat and with a hole in the middle, floury on top."""
    loaf = smooth_union([ell((0, 0, 3.2), (7.4, 7.4, 3.2))], 0.5)
    hole = lambda p: 1.8 - np.hypot(p[:, 0], p[:, 1])
    def paint(p):
        out = tint("#4a2f1c", 0.2, 1.1, 5)(p)
        top = p[:, 2] > 4.6
        out[top] = (tint("#5e3c24", 0.16, 1.2, 6)(p) * 0.8 + colour("#cdbb9c") * 0.2)[top]
        flour = (noise3(p, 2.2, 7) > 0.64) & top
        out[flour] = colour("#c9b89a")
        return out
    return [(lambda p: np.maximum(loaf(p), hole(p)), paint)]


def f_toast(frame):
    """Paahtoleipä: a sliced square white loaf in its clear bag, the slices showing along it, with a pale crust."""
    body = rounded((-3.8, -7.4, 0.2), (3.8, 7.4, 9), 1.6)
    top = ell((0, 0, 8.6), (4.1, 7.4, 2.1))
    def paint(p):
        out = tint("#efe2c0", 0.06, 0.9, 2)(p)
        crust = (p[:, 2] > 9) | (np.abs(p[:, 0]) > 3.5) | (p[:, 2] < 0.8)
        out[crust] = tint("#c98f4a", 0.14, 1.1, 3)(p)[crust]
        out[(np.abs(((p[:, 1] + 40) % 1.8) - 0.9) < 0.1) & ~crust] = colour("#d4c29a")
        # The bag's label across it, and its tie at the end.
        out[(np.abs(p[:, 1]) < 2.2) & (p[:, 2] > 2.4) & (p[:, 2] < 6.8)] = colour("#2f6fc2")
        return out
    return [(smooth_union([body, top], 0.8), paint), (rounded((-1.4, 7.2, 3.6), (1.4, 8.4, 6.4), 0.3), flat("#d8c9a8"))]


def f_potato(frame):
    body = fur(smooth_union([ell((1, 0, 3.8), (6.4, 5, 3.8)), ell((-2.5, 1, 4.4), (4, 3.5, 3.2))], 1.4), 0.5, 0.6, 3)
    return [(body, lambda p: np.where((noise3(p, 1.5, 9) > 0.68)[..., None], colour("#6e5230"), tint("#b08b55", 0.2, 1.8, 2)(p)))]


def f_carrot(frame):
    def paint(p):
        out = tint("#ee8a2e", 0.14, 0.8, 2)(p)
        out[np.abs(((p[:, 0] + 40) % 2.6) - 1.3) < 0.12] = colour("#c96a22")
        return out
    parts = [(tube((-5, 0, 3.4), (8, 0, 1.2), 3.3, 0.4), paint)]
    for y, z in ((-2.5, 5.5), (0.5, 4), (3, 3), (-1, 6.4)):
        parts.append((tube((-7, 0, 3.4), (-11.5, y, z), 0.8, 0.35), flat("#3e8e41" if y < 0 else "#4fa653")))
    return parts


def f_butter(frame):
    def paint(p):
        out = np.tile(colour("#d8dbe0"), (len(p), 1))
        out[(p[:, 0] > 1.5)] = colour("#f8e48a")
        band = (p[:, 0] <= 1.5) & (np.abs(p[:, 0] + 2) < 2.4)
        out[band] = colour("#2f6fc2")
        return out
    return [(rounded((-6, -3.5, 0), (6, 3.5, 5.3), 0.5), paint)]


def f_sausage(frame):
    links = smooth_union([tube((-8, -2, 2.8), (-3.5, 1, 2.8), 2.7, 2.8), tube((-3.5, 1, 2.8), (3.5, 1, 2.8), 2.8, 2.8), tube((3.5, 1, 2.8), (8, -2, 2.8), 2.8, 2.7)], 1)
    return [(links, lambda p: np.where((noise3(p, 1.9, 4) > 0.64)[..., None], colour("#8e3a2a"), tint("#b5533f", 0.2, 0.7, 1)(p))),
            (tube((-9.8, -3.2, 2.8), (-11, -4, 2.8), 0.45, 0.6), flat("#efe6d4")), (tube((9.8, -3.2, 2.8), (11, -4, 2.8), 0.45, 0.6), flat("#efe6d4"))]


def berry(at, r, tone):
    return (ell(at, (r, r, r)), lambda p: np.where((noise3(p, 3.4, at[0]) > 0.66)[..., None], colour("#6e1420"), tint(tone, 0.2, 1, at[1])(p)))


def f_berries(frame):
    parts = [berry((x, y, z), 3.2, c) for x, y, z, c in ((-3.5, 0.5, 3.2, "#b0263a"), (3, -1.5, 3.2, "#c92f42"), (0, 3.5, 3.2, "#d13a48"), (-0.5, -3.5, 3.2, "#b0263a"), (0, 0, 8, "#d8434f"))]
    return parts + [(tube((0, 0, 11), (0.5, 0, 13), 0.4, 0.4), flat("#5c3a1e")), (ell((2.8, -0.8, 12.6), (2.8, 1.2, 0.6)), flat("#3e8e41"))]


def f_icecream(frame):
    waffle = lambda p: np.where((np.abs(((p[:, 0] + p[:, 1] + p[:, 2] * 2 + 40) % 3) - 1.5) < 0.42)[..., None] | (np.abs(((p[:, 0] - p[:, 1] + p[:, 2] * 2 + 40) % 3) - 1.5) < 0.42)[..., None], colour("#b98040"), colour("#e4b474"))
    return [(tube((0, 0, 1), (0, 0, 10), 0.7, 3.8), waffle), (fur(ell((0, 0, 12.5), (4.7, 4.7, 4.1)), 0.35, 0.8, 3), flat("#f3b8c4")), (fur(ell((0.5, 0.5, 16.2), (2.6, 2.6, 2.2)), 0.25, 0.9, 5), flat("#fbe3e8"))]


def f_guolli(frame):
    def scales(p):
        out = np.tile(colour("#8fa9ba"), (len(p), 1))
        out[np.abs(((p[:, 0] * 1.4 + np.sin(p[:, 2] * 1.6) + 40) % 1.6) - 0.8) < 0.16] = colour("#6f8ca0")
        out[p[:, 2] > 5.8] = colour("#5f7f96")
        out[p[:, 2] < 2.6] = colour("#e3ebee")
        return out
    return [(ell((0, 0, 4), (8, 2.8, 3.8)), scales), (tube((-7, 0, 4), (-11.5, 0, 7.5), 1.1, 0.9), flat("#5f7f96")), (tube((-7, 0, 4), (-11.5, 0, 0.8), 1.1, 0.9), flat("#5f7f96")),
            (tube((-2, 0, 7.4), (2, 0, 7.4), 0.5, 0.9), flat("#5f7f96")), (ell((5.3, 2.2, 5), (1, 0.7, 1)), flat("#fbf6e8")), (ell((5.6, 2.7, 5), (0.5, 0.35, 0.5)), flat("#22222c"))]


def f_coffee(frame):
    cup = lambda p: np.maximum(rounded((-4.6, -4.6, 0), (4.6, 4.6, 8.5), 2)(p), 3.9 - np.hypot(p[:, 0], p[:, 1]) - np.maximum(8 - p[:, 2], 0) * 9)
    handle = smooth_union([tube((4.6, 0, 6.5), (7.4, 0, 5.2), 0.8, 0.8), tube((7.4, 0, 5.2), (4.6, 0, 2.6), 0.8, 0.8)], 0.3)
    return [(cup, lambda p: np.where((np.abs(p[:, 2] - 4) < 0.6)[..., None], colour("#3e74c9"), colour("#f4f1e8"))), (handle, flat("#f4f1e8")), (ell((0, 0, 7.8), (3.9, 3.9, 0.5)), flat("#3e2614")),
            (tube((-1, 0, 10), (-1.6, 0, 13), 0.3, 0.14), flat("#d8dde0")), (tube((1.4, 0, 10), (2, 0, 13.5), 0.3, 0.14), flat("#d8dde0"))]


def f_tea(frame):
    """A box of tea bags, warm yellow, lighter in the middle, with a red banner across it and a green tea leaf in a corner."""
    def paint(p):
        glow = np.clip(1 - np.hypot(p[:, 0] * 0.7, (p[:, 2] - 5.5) * 0.9) / 6, 0, 1)
        out = colour("#f0a417") * (1 - glow[..., None]) + colour("#ffd84a") * glow[..., None]
        side = np.abs(p[:, 1]) > 2.2
        # A straight red banner with a pale name on it that can't be read at this size.
        banner = side & (np.abs(p[:, 2] - 6.2) < 1.2) & (np.abs(p[:, 0]) < 3.4)
        out[banner] = colour("#c8202e")
        out[banner & (np.abs(p[:, 2] - 6.2) < 0.4) & (np.abs(p[:, 0]) < 2.3)] = colour("#fbf3e4")
        along = (p[:, 0] - 2.6) * 0.8 + (p[:, 2] - 1.9) * 0.6
        across = -(p[:, 0] - 2.6) * 0.6 + (p[:, 2] - 1.9) * 0.8
        leaf = side & (np.abs(across) < 0.8 * np.clip(1 - np.abs(along) / 1.9, 0, 1))
        out[leaf] = colour("#3e8e41")
        out[side & (np.abs(p[:, 2] - 3.2) < 0.35) & (np.abs(p[:, 0] + 0.8) < 2.4)] = colour("#7a3a10")
        return out
    return [(rounded((-4.8, -2.6, 0), (4.8, 2.6, 9), 0.45), paint)]


def calyx(z, r, tone="#3e8e41"):
    a = np.linspace(0, 6.28, 6)[:-1]
    return [(tube((0, 0, z), (np.cos(x) * r, np.sin(x) * r, z - 0.2), 0.62, 0.22), flat(tone)) for x in a] + [(tube((0, 0, z), (0.5, 0, z + 1.8), 0.5, 0.4), flat(tone))]


def f_tomato(frame):
    return fruit("#d6382e", (6.5, 6.5, 5.4), 5.4) + calyx(10.6, 3)


def f_cucumber(frame):
    return [(tube((-10, 0, 3), (10, 0, 3), 2.8, 2.6), lambda p: np.where((((p[:, 0] + 40) % 4 < 1) | (noise3(p, 1.8, 3) > 0.66))[..., None], colour("#5aa652"), colour("#3e8a3e"))), (ell((-10.4, 0, 3), (1.4, 1.6, 1.6)), flat("#2f6f32"))]


def f_onion(frame):
    layers = lambda p: np.where((np.abs(((np.arctan2(p[:, 0], p[:, 1]) + 7) % 0.7) - 0.35) < 0.07)[..., None], colour("#a8702a"), tint("#c98d3a", 0.14, 0.7, 1)(p))
    return [(smooth_union([ell((0, 0, 5.2), (6, 6, 5.2)), tube((0, 0, 9.5), (0.3, 0, 13.5), 1.3, 0.3)], 0.9), layers), (ell((0, 0, 0.8), (1.6, 1.6, 0.7)), flat("#8a6a48"))]


def f_cabbage(frame):
    def leaves(p):
        out = tint("#8fc26a", 0.2, 0.6, 2)(p)
        out[np.abs(np.sin(np.arctan2(p[:, 0], p[:, 1]) * 5 + p[:, 2] * 0.9)) < 0.12] = colour("#d8ecb4")
        return out
    parts = [(fur(ell((0, 0, 6.6), (7.2, 7.2, 6.4)), 0.6, 0.5, 2), leaves)]
    for x, y, z in ((-5, 3, 4), (5, -3, 5), (3, 5, 8)):
        parts.append((fur(ell((x, y, z), (3.6, 3.6, 2.6)), 0.4, 0.7, x), tint("#6fa84f", 0.2, 0.8, 4)))
    return parts


def f_orange(frame):
    return fruit("#ee8a2e", (6.2, 6.2, 6), 6, "#3e6a2e", specks="#d9761f")


def f_pear(frame):
    return [(smooth_union([ell((0, 0, 4.8), (5.4, 5.4, 4.8)), tube((0, 0, 7), (0, 0, 12), 4, 2.2)], 1.6), lambda p: np.where((noise3(p, 2.8, 4) > 0.66)[..., None], colour("#8e9440"), mix(tint("#c2c94e", 0.14, 0.7, 2)(p), np.tile(colour("#d9a24e"), (len(p), 1)), np.clip((p[:, 1] + p[:, 0] - 2) / 5, 0, 0.6)))),
            (tube((0, 0, 13.4), (0.8, -0.3, 15.8), 0.5, 0.4), flat("#5c3a1e"))]


def f_lemon(frame):
    return [(smooth_union([ell((0, 0, 4.6), (7, 4.6, 4.4)), ell((7.2, 0, 4.6), (1.3, 1.4, 1.3)), ell((-7.2, 0, 4.6), (1.3, 1.4, 1.3))], 0.9), lambda p: np.where((noise3(p, 3, 2) > 0.67)[..., None], colour("#d6b42a"), tint("#f2d23a", 0.1, 0.8, 1)(p)))]


def f_strawberry(frame):
    """A few loose strawberries in a heap, big enough to know in a crate: red, with pale seeds and a green top each."""
    seeds = lambda p: np.where(((np.round(p[:, 0] * 2.4) + 2 * np.round(p[:, 1] * 2.4) + 3 * np.round(p[:, 2] * 2.4)) % 6 == 0)[..., None], colour("#f0d48a"), colour("#d9283a"))
    parts = []
    for x, y, z in ((-3.4, -1.6, 2.8), (3.2, -1.8, 2.8), (0, 2.6, 2.8), (-0.2, -0.4, 6.4)):
        # Wider at the top than at the tip, as a strawberry is.
        parts.append((smooth_union([ell((x, y, z), (2.7, 2.7, 1.9)), ell((x, y, z - 2.3), (1.6, 1.6, 1.4)), ell((x, y, z - 3.6), (0.7, 0.7, 0.7))], 1), seeds))
        parts.append((ell((x, y, z + 2), (1.3, 1.3, 0.45)), flat("#3e8e41")))
    return parts


def f_grapes(frame):
    parts = []
    for i, (x, y, z) in enumerate(((0, 0, 3), (-2.3, 0.5, 5.4), (2.3, -0.5, 5.4), (0, 2.3, 5.6), (0, -2.3, 5.4), (-4, 1, 8), (4, -1, 8), (-1.5, 2.8, 8.2), (1.5, -2.8, 8.2), (-2, -1.5, 10.6), (2, 1.5, 10.6), (0, 0, 11.4))):
        parts.append((ell((x, y, z), (2, 2, 2.1)), lambda p, X=x, Z=z: np.where((((p[:, 0] - X + 0.7) / 0.6) ** 2 + ((p[:, 2] - Z - 0.9) / 0.6) ** 2 < 1)[..., None], colour("#b58ad8"), colour("#6e3f9a" if i % 2 else "#7e4aaa"))))
    return parts + [(tube((0, 0, 12.6), (0.6, -0.4, 15), 0.5, 0.4), flat("#5c3a1e")), (ell((3, -1, 14), (3, 1.4, 0.7)), flat("#3e8e41"))]


def f_juice(frame):
    def paint(p):
        out = np.tile(colour("#f2a23a"), (len(p), 1))
        out[p[:, 2] > 10] = colour("#dfeef2")
        fruit_on = ((p[:, 0] + 0.6) ** 2 + (p[:, 2] - 5.6) ** 2) < 5
        out[fruit_on] = colour("#ee7a1e")
        out[fruit_on & (np.abs(np.sin(np.arctan2(p[:, 0] + 0.6, p[:, 2] - 5.6) * 4)) < 0.14)] = colour("#fbe0a8")
        return out
    return [(rounded((-3.8, -3.8, 0), (3.8, 3.8, 12), 1.1), paint), (tube((1.4, 0, 9), (3.4, 0.4, 16.5), 0.45, 0.45), lambda p: np.where((((p[:, 2] + 40) % 1.6) < 0.8)[..., None], colour("#d13a30"), colour("#f6f2e6")))]


def f_reindeermeat(frame):
    pieces = [(fur(ell((x, y, 2), (2, 1.5, 1)), 0.2, 2, x), lambda p: np.where((noise3(p, 2.6, 4) > 0.64)[..., None], colour("#5e2018"), colour("#8a3226"))) for x, y in ((-2.8, -1.8), (0.4, -2.2), (3, -1.2), (-2.2, 1.8), (1, 1.8), (3.4, 1.8))]
    return plate(pieces)


def f_smokedmeat(frame):
    """Savuliha: dark smoked slices with a paler middle, overlapping on the plate."""
    def slice_paint(x, y):
        def paint(p):
            d = np.hypot((p[:, 0] - x) / 2.8, (p[:, 1] - y) / 2.1)
            out = tint("#7a3a24", 0.2, 1.8, 4)(p)
            out[d > 0.72] = colour("#2c1a12")
            return out
        return paint
    return plate([(ell((x, y, 1.5 + i * 0.28), (2.9, 2.2, 0.75)), slice_paint(x, y)) for i, (x, y) in enumerate(((-3, -1.6), (-0.8, -0.6), (1.4, -1.4), (3.2, 0.6), (0.6, 1.8), (-2.4, 1.6)))])


def f_steak(frame):
    def paint(p):
        d = np.hypot(p[:, 0] / 6.2, p[:, 1] / 5.2)
        out = np.where((d > 0.74)[..., None], colour("#f6e8c8"), tint("#a02e26", 0.2, 1, 2)(p))
        out[(d <= 0.74) & (noise3(p, np.array([2.6, 0.9, 1]), 3) > 0.64)] = colour("#d8887a")
        return out
    return plate([(ell((0, 0, 2.3), (6.2, 5.2, 1.6)), paint)])


def f_mince(frame):
    return plate([(fur(ell((0, 0, 3), (5.2, 4.8, 2.8)), 0.8, 1.6, 2), lambda p: np.where((noise3(p, 3, 6) > 0.5)[..., None], colour("#d98a7e"), colour("#b5544a")))], 6.8)


def f_pork(frame):
    def paint(p):
        return np.where((np.hypot((p[:, 0] + 1) / 5, p[:, 1] / 4) > 0.8)[..., None], colour("#f6eedd"), tint("#e27f7a", 0.14, 1, 3)(p))
    return plate([(ell((-1, 0, 2.2), (5, 4, 1.3)), paint), (tube((3.4, -0.4, 2.4), (6.6, -0.8, 2.4), 0.9, 0.8), flat("#f4f1e8")), (ell((6.8, -0.8, 2.4), (1.2, 1.2, 1)), flat("#f4f1e8"))])


def f_chocolate(frame):
    def paint(p):
        out = np.tile(colour("#5a3a22"), (len(p), 1))
        lines = (np.abs(((p[:, 0] + 14) % 3.5) - 1.75) < 0.25) | (np.abs(((p[:, 1] + 8) % 2.67) - 1.33) < 0.22)
        out[lines] = colour("#3f2616")
        foil = p[:, 0] < 0
        out[foil] = colour("#2f5fa8")
        out[foil & (np.abs(p[:, 0] + 3.5) < 0.6)] = colour("#f2c14e")
        return out
    return [(rounded((-7, -4, 0), (7, 4, 2), 0.28), paint)]


def f_candy(frame):
    parts = []
    for x, y, z, c in ((-3.2, 2, 2.2, "#d8588a"), (3.4, 1.4, 2.2, "#f2c14e"), (0, -3, 2.2, "#3e8a4e"), (0.2, 0.8, 6, "#d13a30")):
        parts.append((ell((x, y, z), (2.6, 2.2, 2.2)), lambda p, X=x, C=c: np.where((np.abs(((p[:, 0] - X + p[:, 2] * 0.8 + 40) % 1.6) - 0.8) < 0.22)[..., None], colour("#f4f1e8"), colour(C))))
        for s in (-1, 1):
            parts.append((tube((x + s * 2.4, y, z), (x + s * 4.2, y, z), 0.5, 1.2), flat("#f4f1e8")))
    return parts


def f_cookie(frame):
    parts = []
    for i in range(3):
        y = -3 + i * 3
        parts.append((tube((0, y, 2.4), (0, y + 0.5, 3), 5, 5), lambda p: np.where((noise3(p, 1.9, 7) > 0.65)[..., None], colour("#3e2614"), tint("#c98d4a", 0.2, 1.3, 3)(p))))
    return parts


def f_cake(frame):
    def paint(p):
        out = tint("#f6eedd", 0.06, 0.8, 1)(p)
        out[(p[:, 2] > 3.2) & (p[:, 2] < 4.2)] = colour("#d8588a")
        return out
    parts = [(rounded((-6.5, -6.5, 0), (6.5, 6.5, 0.6), 0.2), flat("#e6dfc8")), (rounded((-5, -5, 0.6), (5, 5, 7), 1.8), paint)]
    for x, y in ((-2.4, -2.4), (2.4, -2.4), (-2.4, 2.4), (2.4, 2.4)):
        parts.append((ell((x, y, 7.6), (1.2, 1.2, 1.1)), flat("#d9283a")))
    return parts


def f_soda(frame):
    def glass(p):
        out = np.tile(colour("#3e2214"), (len(p), 1))
        band = (p[:, 2] > 3.4) & (p[:, 2] < 7.4)
        out[band] = colour("#d13a30")
        out[band & (np.abs(np.sin(p[:, 0] * 1.2 + p[:, 2] * 1.3)) < 0.14)] = colour("#f4f1e8")
        out[(p[:, 2] < 12) & (p[:, 0] < -1.8)] = colour("#6e4228")
        return out
    body = smooth_union([tube((0, 0, 1.6), (0, 0, 9), 3, 3), tube((0, 0, 9), (0, 0, 14), 3, 1.1)], 0.9)
    return [(body, glass), (tube((0, 0, 14), (0, 0, 15.2), 1.2, 1.2), flat("#d13a30"))]


def f_pizza(frame):
    parts = [(ell((0, 0, 1.3), (9, 9, 1.3)), tint("#d9a862", 0.2, 1, 2)), (ell((0, 0, 2.1), (7.6, 7.6, 0.9)), lambda p: np.where((noise3(p, 1.4, 3) > 0.52)[..., None], colour("#f2d27a"), colour("#d9472e")))]
    parts += [(ell((x, y, 2.9), (1.5, 1.5, 0.42)), flat("#8e1f1a")) for x, y in ((-3, -2), (3, -3), (0, 3), (4, 2.5), (-4.5, 2))]
    parts += [(ell((x, y, 2.9), (0.8, 0.5, 0.3)), flat("#3e8e41")) for x, y in ((1.6, -0.6), (-1.6, 3.6), (-1.4, -4.6), (4.4, -0.8))]
    return parts


def f_mushroom(frame):
    def cap(p):
        out = tint("#e6dcc4", 0.14, 0.8, 2)(p)
        out[p[:, 2] < 6.2] = colour("#b39a78")
        gills = (p[:, 2] < 6.2) & (np.abs(((np.arctan2(p[:, 0], p[:, 1]) + 7) % 0.4) - 0.2) < 0.06)
        out[gills] = colour("#8a7458")
        return out
    return [(tube((0, 0, 0.5), (0, 0, 6), 2.2, 2.6), tint("#efe6d4", 0.1, 1, 1)), (ell((0, 0, 7), (6.5, 6.5, 4)), cap)]


def f_lingonberry(frame):
    parts = [(ell((x, y, z), (2.4, 2.4, 2.3)), tint("#c92f42", 0.14, 1, x)) for x, y, z in ((-3, 2, 2.4), (3, 2, 2.4), (0, -2.6, 2.4), (-3, -2.4, 2.4), (3, -2.2, 2.4), (0, 2.6, 2.4), (-1.4, 0, 5.8), (1.8, 0.5, 5.8), (0, 0, 9))]
    return parts + [(ell((1.5, -1.5, 11), (2.8, 1.2, 0.5)), flat("#2f6f32")), (ell((-2, 1.5, 10.4), (2.4, 1, 0.5)), flat("#3e8e41"))]


def f_cloudberry(frame):
    a = np.linspace(0, 6.28, 6)[:-1]
    parts = [(tube((0, 0, 0.8), (np.cos(x) * 7.5, np.sin(x) * 7.5, 0.5), 1.1, 0.5), flat("#3e8e41")) for x in a]
    parts += [(ell((x, y, z), (r, r, r)), lambda p: np.where((noise3(p, 2.6, 5) > 0.62)[..., None], colour("#f6c67a"), colour("#e89a2e"))) for x, y, z, r in ((0, 0, 4.6, 3.6), (-3.4, 1.4, 5.4, 2.5), (3.4, 1.4, 5.4, 2.5), (-2, -3, 5.4, 2.5), (2.2, -3, 5.4, 2.5), (0, 3.4, 5.8, 2.5), (-1.8, 0.8, 8.4, 2.2), (1.8, 0.2, 8.6, 2.2))]
    return parts


def f_jam(frame):
    def paint(p):
        out = np.tile(colour("#b0263a"), (len(p), 1))
        band = (p[:, 2] > 3) & (p[:, 2] < 7)
        out[band] = colour("#f4f1e8")
        out[band & (((p[:, 0] / 1.3) ** 2 + ((p[:, 2] - 5) / 1.2) ** 2) < 1)] = colour("#d9283a")
        return out
    return [(rounded((-4.2, -4.2, 0), (4.2, 4.2, 10), 1.5), paint), (rounded((-3.8, -3.8, 10), (3.8, 3.8, 12), 0.35), lambda p: np.where((np.abs(((np.arctan2(p[:, 0], p[:, 1]) + 7) % 0.5) - 0.25) < 0.06)[..., None], colour("#c9962e"), colour("#f2c14e")))]


def f_bun(frame):
    def paint(p):
        out = tint("#d9a862", 0.18, 0.7, 2)(p)
        swirl = (p[:, 2] > 4.4) & (((np.arctan2(p[:, 1], p[:, 0]) + np.hypot(p[:, 0], p[:, 1]) * 1.5 + 12.56) % 3.14) < 0.9)
        out[swirl] = colour("#a86c32")
        out[(p[:, 2] > 6) & (noise3(p, 3.6, 7) > 0.62)] = colour("#fbf6e8")
        return out
    return [(ell((0, 0, 3.8), (7.4, 7.4, 3.8)), paint)]


def f_pancake(frame):
    parts = [(ell((0.4 * (i % 2), -0.3 * (i % 2), 0.9 + i * 1.4), (8 - i * 0.5, 8 - i * 0.5, 0.95)), tint("#e8c47a" if i % 2 == 0 else "#ddb368", 0.2, 1.1, i)) for i in range(3)]
    return parts + [(ell((0, 0, 4.9), (2.6, 2.6, 0.7)), flat("#d9283a"))]


FOOD_MODELS = {name[2:]: make for name, make in list(globals().items()) if name.startswith("f_")}


# ---------------------------------------------------------------- the shops' things
# Each at the size and place of its model in src/models.js. Those with several kinds are named with the kind after a dash: see modelImage in
# src/world.js. Only ever seen from one side.
def hollowed(outer, inner):
    return lambda p: np.maximum(outer(p), -inner(p))


def shop_basket(low, tone, rim_at, wide=4.2, deep=3):
    """A plastic basket with slots round its sides and a pale rim."""
    x0, x1, y0, y1 = -wide, wide, -deep, deep
    outer = rounded((x0, y0, low), (x1, y1, rim_at), 0.5)
    inner = rounded((x0 + 0.5, y0 + 0.5, low + 0.6), (x1 - 0.5, y1 - 0.5, rim_at + 2), 0.4)
    def paint(p):
        out = tint(tone, 0.12, 0.8, 4)(p)
        out[p[:, 2] > rim_at - 0.8] = colour("#f4f1e8")
        slot = (np.abs(((p[:, 0] + p[:, 1] + 40) % 1.5) - 0.75) < 0.26) & (p[:, 2] > low + 0.7) & (p[:, 2] < rim_at - 1.1)
        out[slot] = out[slot] * 0.5
        return out
    return [(hollowed(outer, inner), paint)]


def basket_stack(count):
    tones = ["#c84a3a", "#3e74c9", "#3e8a4e", "#d18f2e", "#c84a3a"][:count]
    parts = []
    for i, tone in enumerate(tones):
        parts += shop_basket(i * 1.4, tone, i * 1.4 + 3.6)
    top = (count - 1) * 1.4 + 3.6
    for s in (-1, 1):
        parts.append((tube((s * 3.2, 0, top), (0, 0, top + 3.4), 0.25, 0.25), flat("#2c2c36")))
    return parts


def player_basket():
    return shop_basket(0, "#c84a3a", 4) + [(tube((s * 2.4, 0, 4), (0, 0, 7), 0.25, 0.25), flat("#2c2c36")) for s in (-1, 1)]


SAMI = ("#d13a30", "#3e8a4e", "#f2c14e", "#2f5fa8")


def bag_tone(pattern, across, up):
    out = np.zeros((len(across), 3))
    table = np.array([colour(c) for c in SAMI])
    if pattern == "flag":
        centre = across + 0.3
        pick = np.select([centre < -0.7, centre < 0, centre < 0.7], [0, 1, 2], 3)
        out = table[pick].astype(float)
        ring = np.abs(np.hypot(centre, up) - 2.1) < 0.45
        out[ring] = table[np.where(centre < 0, 3, 0)][ring]
    elif pattern == "upright":
        out = table[np.clip(np.floor((across + 3.6) / 1.8).astype(int), 0, 3)].astype(float)
    else:
        out = table[np.clip(np.floor((3.25 - up) / 1.625).astype(int), 0, 3)].astype(float)
    return out


def till_bag(which):
    """A tote or a carrier bag in the Sámi flag's colours, as in src/models.js, with what's in it showing."""
    pattern = ("flag", "upright", "level")[which // 2]
    tote = which % 2 == 0
    k, z = 1.3, 9
    def paint(p):
        out = bag_tone(pattern, p[:, 0] / k, (p[:, 2] - z) / k + 3.25)
        return out * (0.92 + noise3(p, 1.4, 3)[..., None] * 0.14)
    if tote:
        return [(ell((0.2, 0, z), (3.4, 1.1, 1.4)), tint("#c9925a", 0.2, 1, 2)),
                (rounded((-3.6 * k, -1.3 * k, z - 6.5 * k), (3.6 * k, 1.3 * k, z), 0.4), paint)] + \
               [(tube((s * 2 * k, 0, z), (0, 0, z + 3 * k), 0.35, 0.3), flat("#f0e8d6")) for s in (-1, 1)]
    body = smooth_union([ell((0, 0, z - 3.6 * k), (3.7 * k, 1.9 * k, 3.5 * k))], 0.5)
    return [(ell((0, 0, z - 0.6), (1.7, 1.5, 1.4)), tint("#4f9a3e", 0.26, 1.6, 2)), (body, paint)] + \
           [(tube((s * 2.6 * k, 0, z - 1.8 * k), (s * 0.5, 0, z + 2.6 * k), 0.55, 0.3), lambda p, c=SAMI[0]: bag_tone(pattern, p[:, 0] / k, (z - 1.8 * k - z) / k + 3.25 + 0 * p[:, 2])) for s in (-1, 1)]


def till_belt(length_to=8):
    """Black rubber, finely ribbed, running between two steel rails."""
    def paint(p):
        out = tint("#26262c", 0.14, 1.2, 1)(p)
        out[((p[:, 0] + 40) % 1.3) < 0.2] = colour("#16161a")
        out[np.abs(p[:, 1]) > 4.4] = colour("#a4adb5")
        return out
    return [(rounded((-8, -5, -0.2), (length_to, 5, 0.55), 0.08), paint)]


def till_register():
    """A till: a body with its keys, two screens on a stalk, and a card reader with a scanner window."""
    def body_paint(p):
        out = tint("#d6d3ca", 0.08, 0.7, 2)(p)
        return out
    def top_paint(p):
        out = np.tile(colour("#3e3e48"), (len(p), 1))
        key = (((p[:, 0] + 40) % 1) < 0.72) & (((p[:, 1] + 40) % 1) < 0.72) & (p[:, 2] > 3.5)
        out[key] = colour("#b8bcc4")
        out[key & ((p[:, 0] > 2) & (p[:, 1] > 0.6))] = colour("#d13a30")
        return out
    def screen(tone):
        def paint(p):
            out = np.tile(colour("#2c2c34"), (len(p), 1))
            on = (np.abs(p[:, 0]) < 2.5) & (p[:, 2] > 7.7) & (p[:, 2] < 10.3)
            out[on] = colour(tone)
            lines = on & (((p[:, 2] + 40) % 0.8) < 0.14)
            out[lines] = out[lines] * 0.76
            return out
        return paint
    def reader(p):
        out = np.tile(colour("#55555f"), (len(p), 1))
        out[np.hypot(p[:, 0] - 6.6, p[:, 1]) < 1.1] = colour("#d13a30")
        return out
    return [(rounded((-4, -3, 0), (4, 3, 3), 0.5), body_paint), (rounded((-3, -2.2, 3), (3, 2.2, 3.6), 0.2), top_paint),
            (tube((0, -1.8, 3.5), (0, -1.8, 7), 0.6, 0.5), flat("#8e8e96")),
            (rounded((-3, -2.3, 7), (3, -1.2, 11), 0.3), screen("#7fd6a0")), (rounded((-3, -0.8, 7), (3, 0.4, 11), 0.3), screen("#bfe6f2")),
            (rounded((4.6, -2.4, 0), (8.6, 2.4, 1.3), 0.3), reader)]


def store_mat():
    def paint(p):
        out = tint("#4a5560", 0.14, 1.4, 1)(p)
        out[((p[:, 0] + 40) % 1.6) < 0.5] = colour("#3a444e")
        out[(np.abs(p[:, 0]) > 11.6) | (np.abs(p[:, 1]) > 5.8)] = colour("#2f3840")
        return out
    return [(rounded((-13, -7, 0), (13, 7, 0.5), 0.2), paint)]


def store_door():
    """Two sliding glass doors in a steel frame, with the green sign over them."""
    steel = lambda p: tint("#5a6670", 0.08, 0.5, 1)(p)
    parts = [(rounded((s * 17 - 1.2, -1.2, 0), (s * 17 + 1.2, 1.2, 32), 0.3), steel) for s in (-1, 1)]
    parts.append((rounded((-18.2, -1.2, 32), (18.2, 1.2, 35), 0.4), steel))
    parts.append((rounded((-4, 1.3, 32.6), (4, 1.8, 34.6), 0.2), tint("#3e9a5e", 0.08, 0.5, 2)))
    for s in (-1, 1):
        def pane(p, s=s):
            x, z = p[:, 0], p[:, 2]
            out = np.tile(colour("#bfe0ec"), (len(p), 1)) * (0.96 + 0.08 * (z / 32))[..., None]
            streak = np.exp(-((((x - s * 12) - (z - 16) * 0.3) / 0.9) ** 2)) * 0.5 + np.exp(-((((x - s * 12 + 2.2) - (z - 16) * 0.3) / 0.35) ** 2)) * 0.4
            out = out * (1 - streak[..., None]) + np.array(colour("#f0f8fb")) * streak[..., None]
            out[(np.abs(x - s * 12) > 3.2) | (z < 1.5) | (z > 30.5)] = colour("#7c8a94")
            out[(np.abs(x - s * 9) < 0.3) & (z > 10) & (z < 20)] = colour("#d8dcde")
            return out
        parts.append((rounded((s * 12 - 3.8, -0.5, 0.5), (s * 12 + 3.8, 0.5, 31.5), 0.1), pane))
    return parts


def staff_door():
    def wood(p):
        out = tint("#8e6a4a", 0.14, 0.5, 3)(p)
        grain = np.abs(((p[:, 1] + 40) % 3.2) - 1.6) < 0.14
        out[grain] = out[grain] * 0.84
        return out
    def notice(p):
        out = np.tile(colour("#f4f1e8"), (len(p), 1))
        out[np.hypot(p[:, 1], p[:, 2] - 22) < 2.2] = colour("#d13a30")
        return out
    return [(rounded((-0.6, -11, 0), (0.6, 11, 30), 0.2), flat("#5a6670")), (rounded((-0.9, -9.5, 0.5), (0.9, 9.5, 28.5), 0.2), wood),
            (rounded((0.8, -4, 19), (1.2, 4, 25), 0.1), notice), (ell((1.2, -6.5, 13), (0.6, 0.9, 0.9)), flat("#e6c15a"))]


def cardboard(low, high, tone):
    def paint(p):
        out = tint(tone, 0.14, 0.5, 5)(p)
        out[np.abs(p[:, 1] - (low[1] + high[1]) / 2) < 0.45] = colour("#e0cda8")
        return out
    return (rounded(low, high, 0.25), paint)


def stock_trolley(boxes):
    steel = flat("#8e8e96")
    parts = [(ell((x, y, 1), (0.9, 0.9, 0.9)), flat("#2c2c36")) for x in (-5, 5) for y in (-3.5, 3.5)]
    parts.append((rounded((-6.5, -4.5, 2), (6.5, 4.5, 3.2), 0.2), steel))
    if boxes > 0:
        parts.append(cardboard((-5.5, -3.8, 3.2), (0, 3.8, 8.5), "#b9956a"))
    if boxes > 1:
        parts.append(cardboard((0.5, -3.2, 3.2), (5.5, 3.2, 7), "#c9a57a"))
    if boxes > 2:
        parts.append(cardboard((-3.5, -3, 8.5), (3, 3, 11.5), "#a8835a"))
    rail = flat("#5a6670")
    parts += [(tube((6.5, -4.5, 3.2), (7.5, -4.5, 13), 0.35, 0.35), rail), (tube((6.5, 4.5, 3.2), (7.5, 4.5, 13), 0.35, 0.35), rail), (tube((7.5, -4.5, 13), (7.5, 4.5, 13), 0.35, 0.35), rail)]
    return parts


def meat_board():
    def board(p):
        out = tint("#b98249", 0.18, 0.5, 6)(p)
        grain = np.abs(((p[:, 1] + 40) % 1.8) - 0.9) < 0.1
        out[grain] = out[grain] * 0.84
        return out
    def joint(p):
        out = tint("#a83a32", 0.16, 1.2, 4)(p)
        out[np.abs(((p[:, 0] + 30) % 3.4) - 1.7) < 0.3] = colour("#f0d8cc")
        marble = noise3(p, 1.8, 7) > 0.66
        out[marble] = out[marble] * 0.86 + colour("#f0d8cc") * 0.14
        return out
    return [(rounded((-7, -5.5, 0), (7, 5.5, 1.2), 0.2), board), (ell((-0.5, 0, 4.6), (5.6, 4, 3.6)), joint),
            (rounded((3, -3, 1.2), (3.8, 3, 4.6), 0.1), tint("#b84a40", 0.12, 1, 2)), (rounded((4.6, -3, 1.2), (5.4, 3, 3.6), 0.1), tint("#b84a40", 0.12, 1, 3))]


def meat_grinder(frame):
    cx, cz = ((0, 3.4), (3.4, 0), (0, -3.4), (-3.4, 0))[frame % 4]
    steel = lambda c: (lambda p: tint(c, 0.06, 0.6, 2)(p))
    mince = lambda p: np.where((noise3(p, 2.4, 3) > 0.52)[..., None], colour("#d07a6e"), colour("#b5544a"))
    return [(rounded((-7, -5.5, 0), (7, 5.5, 1), 0.3), steel("#c9ccd2")), (tube((-2.5, 0, 1), (-2.5, 0, 6.5), 2, 2.4), steel("#8e96a0")),
            (tube((-5, 0, 7.5), (2.4, 0, 7.5), 2.4, 2.1), steel("#a8b0ba")), (tube((-2.5, 0, 9), (-2.5, 0, 12.5), 2, 3.4), steel("#c9ccd2")),
            (ell((-2.5, 0, 12.4), (2.6, 2.6, 0.6)), mince), (tube((-5.5, 0, 7.5), (-6.5, 0, 7.5), 0.5, 0.5), flat("#6a7078")),
            (tube((-6.5, 0, 7.5), (-6.5, cx, 7.5 + cz), 0.4, 0.4), flat("#6a7078")), (ell((-6.5, cx, 7.5 + cz), (0.8, 0.8, 0.8)), flat("#2c2c36")),
            (rounded((3, -3, 1), (7, 3, 2), 0.3), flat("#f4f1e8")), (ell((5, 0, 2.8), (1.9, 2.4, 1.3)), mince)] + \
           [(tube((3.4, -0.8 + i * 1.6, 7), (4.4, -0.8 + i * 1.6, 3.6), 0.3, 0.3), mince) for i in (0, 1)]


# Food small enough for a basket or the till's belt.
GOODS = {
    "apple": lambda: [(ell((0, 0, 1.7), (1.25, 1.25, 1.2)), tint("#d13a30", 0.16, 1, 1))],
    "orange": lambda: [(ell((0, 0, 1.65), (1.16, 1.16, 1.16)), tint("#e8902e", 0.14, 3, 2))],
    "milk": lambda: [(rounded((-1.1, -1.1, 0.5), (1.1, 1.1, 4.5), 0.2), lambda p: np.where((p[:, 2] < 2.3)[..., None], colour("#3e74c9"), colour("#f4f1e8")))],
    "bread": lambda: [(tube((-1.65, 0, 1.4), (1.65, 0.5, 1.8), 1.1, 1), tint("#c9925a", 0.22, 1.2, 3))],
    "cheese": lambda: [(rounded((-1.3, -1, 0.5), (1.3, 1, 2.2), 0.2), tint("#f2c14e", 0.12, 1.2, 4))],
    "greens": lambda: [(ell((0, 0, 1.4), (1.45, 1.45, 1.1)), tint("#4f9a3e", 0.3, 2.2, 5))],
    "parcel": lambda: [(rounded((-1.45, -1.1, 0.5), (1.45, 1.1, 2.5), 0.2), lambda p: np.where((np.abs(p[:, 0]) < 0.2)[..., None], colour("#e0cda8"), colour("#b98a56")))],
    "mitten": lambda: [(ell((0, 0, 1.6), (1.3, 1, 1.55)), tint("#2f5fa8", 0.2, 2.4, 6))],
    "rope": lambda: [(tube((-1.2, 0, 1.4), (1.2, 0, 1.4), 1.2, 1.2), lambda p: np.where((((p[:, 0] + p[:, 2] + 40) % 0.8) < 0.26)[..., None], colour("#bda87a"), colour("#d8c79a")))],
}
# Ten backpacks for the classmates, with a picture on the front: Sámi ones in the flag's colours and in a gákti's bands, and some with the kinds of things
# films and shows for children are about. All drawn here, with no real film's characters in them.
PACK_W, PACK_H = 128, 176


def _pack_picture(which):
    picture = Image.new("RGB", (PACK_W, PACK_H), "#333333")
    d = ImageDraw.Draw(picture)
    w, h = PACK_W, PACK_H
    star = lambda x, y, r, c: d.polygon([(x + (r if i % 2 == 0 else r * 0.4) * np.cos(i * np.pi / 5 - np.pi / 2), y + (r if i % 2 == 0 else r * 0.4) * np.sin(i * np.pi / 5 - np.pi / 2)) for i in range(10)], fill=c)
    if which == 0:  # the Sámi flag
        for x0, x1, c in ((0, 0.44, "#dc241f"), (0.44, 0.54, "#007229"), (0.54, 0.64, "#ffce00"), (0.64, 1, "#0035ad")):
            d.rectangle((x0 * w, 0, x1 * w, h), fill=c)
        cx, cy, r = 0.5 * w, 0.42 * h, 34
        d.arc((cx - r, cy - r, cx + r, cy + r), 90, 270, fill="#0035ad", width=11)
        d.arc((cx - r, cy - r, cx + r, cy + r), -90, 90, fill="#dc241f", width=11)
    elif which == 1:  # a gákti's blue with its bands
        d.rectangle((0, 0, w, h), fill="#2450a6")
        for y, c, t in ((0.16, "#bb2a2d", 16), (0.25, "#ecb92e", 7), (0.72, "#ecb92e", 7), (0.76, "#bb2a2d", 18), (0.88, "#fbf6e8", 6)):
            d.rectangle((0, y * h, w, y * h + t), fill=c)
        for x in range(8, w, 26):
            d.polygon([(x, 0.34 * h), (x + 11, 0.44 * h), (x, 0.54 * h), (x - 11, 0.44 * h)], fill="#ecb92e" if (x // 26) % 2 else "#bb2a2d")
    elif which == 2:  # the flag's stripes, going down
        for i, c in enumerate(("#dc241f", "#007229", "#ffce00", "#0035ad")):
            d.rectangle((i * w / 4, 0, (i + 1) * w / 4, h), fill=c)
    elif which == 3:  # a reindeer under the midnight sun
        d.rectangle((0, 0, w, h), fill="#f0a64a")
        d.ellipse((30, 22, 98, 90), fill="#ffe27a")
        d.rectangle((0, 130, w, h), fill="#3a5a4a")
        ink = "#2a1c18"
        d.ellipse((30, 92, 92, 124), fill=ink)
        for x in (38, 48, 74, 84):
            d.rectangle((x, 118, x + 6, 148), fill=ink)
        d.polygon([(84, 100), (92, 62), (106, 62), (100, 106)], fill=ink)
        d.ellipse((90, 52, 116, 72), fill=ink)
        for dx, top in ((0, 20), (10, 28), (-8, 30)):
            d.line((98, 56, 98 + dx, top), fill=ink, width=4)
        d.line((98, 38, 112, 30), fill=ink, width=3)
    elif which == 4:  # the northern lights
        d.rectangle((0, 0, w, h), fill="#0c1a3a")
        for i, c in enumerate(("#39d98a", "#5ae8b0", "#8a6ae0")):
            points = [(x, 46 + i * 26 + 16 * np.sin(x * 0.07 + i)) for x in range(0, w + 8, 8)]
            d.line(points, fill=c, width=16 - i * 3)
        for x, y in ((18, 16), (64, 22), (110, 12), (92, 40), (30, 34)):
            star(x, y, 4, "#fbf6e8")
        d.polygon([(0, h), (0, 138), (40, 118), (84, 142), (128, 126), (128, h)], fill="#17263f")
    elif which == 5:  # space: a rocket
        d.rectangle((0, 0, w, h), fill="#141433")
        for x, y in ((16, 20), (106, 30), (24, 112), (112, 124), (60, 14), (98, 150)):
            star(x, y, 5, "#ffe27a")
        d.ellipse((-20, 132, 44, 196), fill="#c9722e")
        d.polygon([(64, 18), (88, 64), (88, 118), (40, 118), (40, 64)], fill="#eceff2")
        d.polygon([(64, 18), (82, 54), (46, 54)], fill="#d13a30")
        d.polygon([(40, 92), (22, 130), (40, 118)], fill="#d13a30")
        d.polygon([(88, 92), (106, 130), (88, 118)], fill="#d13a30")
        d.ellipse((52, 66, 76, 90), fill="#4fb4e8", outline="#30506a", width=4)
        d.polygon([(48, 118), (80, 118), (64, 156)], fill="#f2a12e")
    elif which == 6:  # a friendly dinosaur
        d.rectangle((0, 0, w, h), fill="#9fd8e8")
        d.rectangle((0, 136, w, h), fill="#7cb84e")
        ink = "#3f9a4a"
        d.ellipse((26, 78, 100, 128), fill=ink)
        d.polygon([(84, 92), (94, 42), (112, 42), (106, 104)], fill=ink)
        d.ellipse((88, 28, 122, 54), fill=ink)
        d.polygon([(30, 100), (2, 126), (36, 120)], fill=ink)
        for x in (40, 54, 72, 86):
            d.rectangle((x, 120, x + 9, 146), fill=ink)
        for x, y in ((40, 76), (56, 72), (72, 74), (88, 70), (96, 56)):
            d.polygon([(x - 7, y + 6), (x, y - 8), (x + 7, y + 6)], fill="#f2c14e")
        d.ellipse((106, 34, 113, 41), fill="#1d1420")
    elif which == 7:  # a robot
        d.rectangle((0, 0, w, h), fill="#2f8a8e")
        d.rectangle((34, 44, 94, 90), fill="#d8dde6", outline="#30404a", width=4)
        d.ellipse((44, 54, 58, 68), fill="#ffce00", outline="#30404a", width=3)
        d.ellipse((70, 54, 84, 68), fill="#ffce00", outline="#30404a", width=3)
        d.rectangle((48, 76, 80, 82), fill="#30404a")
        d.line((64, 44, 64, 24), fill="#30404a", width=4)
        d.ellipse((58, 14, 70, 26), fill="#d13a30")
        d.rectangle((26, 96, 102, 150), fill="#b8bfc9", outline="#30404a", width=4)
        d.rectangle((44, 108, 84, 134), fill="#30404a")
        for i, c in enumerate(("#d13a30", "#ffce00", "#39d98a")):
            d.ellipse((50 + i * 11, 116, 58 + i * 11, 124), fill=c)
    elif which == 8:  # a rainbow and stars
        d.rectangle((0, 0, w, h), fill="#fbd7e8")
        for i, c in enumerate(("#e4483b", "#f2a12e", "#f7d84a", "#4fb45a", "#4f80c8", "#8a5ac0")):
            r = 62 - i * 9
            d.arc((64 - r, 92 - r, 64 + r, 92 + r), 180, 360, fill=c, width=9)
        star(26, 126, 13, "#e85a9a")
        star(66, 134, 16, "#ffffff")
        star(104, 122, 12, "#8a5ac0")
    else:  # a racing car
        d.rectangle((0, 0, w, h), fill="#20242c")
        d.rectangle((52, 0, 76, h), fill="#3a404a")
        for y in range(4, h, 28):
            d.rectangle((62, y, 66, y + 14), fill="#f7d84a")
        d.rounded_rectangle((26, 60, 102, 96), 10, fill="#d13a30")
        d.polygon([(42, 60), (52, 40), (80, 40), (88, 60)], fill="#bfe6f2", outline="#20242c")
        d.ellipse((34, 86, 56, 108), fill="#101014", outline="#c8ced3", width=4)
        d.ellipse((74, 86, 96, 108), fill="#101014", outline="#c8ced3", width=4)
        d.ellipse((54, 64, 76, 84), fill="#fbf6e8")
        d.text((65, 74), "7", fill="#20242c", font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16), anchor="mm")
    return np.array(picture)


PACK_TONES = (("#a81f1a", "#20307a"), ("#1c3f86", "#a82428"), ("#20307a", "#d8a81e"), ("#7a4a22", "#3a5a4a"), ("#0c1a3a", "#39a878"), ("#1c1c44", "#b0352a"), ("#3f7a4a", "#d8a830"), ("#20686c", "#30404a"), ("#c85a8e", "#6a4aa0"), ("#262a32", "#c02f28"))


def backpack(which):
    """A school backpack standing on the floor: a soft body, a padded front pocket with its picture, a side pocket with a bottle, a handle, straps and zips."""
    main, trim = PACK_TONES[which]
    art = _pack_picture(which)
    body = smooth_union([rounded((-4.8, -2.6, 0.2), (4.8, 2.6, 11), 1.6), ell((0, 0, 11.4), (4.5, 2.5, 2.2))], 0.8)
    def body_paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = tint(main, 0.1, 0.9, which)(p)
        # The picture goes on the front of the body above the pocket as well as on the pocket, and the zip goes over the top.
        front = (y > 1.2) & (np.abs(x) < 4.1) & (z > 0.8) & (z < 12.2)
        u = np.clip(((x + 4.1) / 8.2 * PACK_W).astype(int), 0, PACK_W - 1)
        v = np.clip(((12.2 - z) / 11.4 * PACK_H).astype(int), 0, PACK_H - 1)
        out[front] = art[v[front], u[front]]
        zip_line = (np.abs(np.hypot(x / 4.4, (z - 7.6) / 5.2) - 1) < 0.05) & (y > 0.2)
        out[zip_line] = colour(trim)
        seam = (np.abs(y) < 0.18) & (z > 6)
        out[seam] = colour(trim)
        return out * (0.95 + noise3(p, 3, 7)[..., None] * 0.08)
    def pocket_paint(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        out = np.full((len(p), 3), 0.0)
        u = np.clip(((x + 4.1) / 8.2 * PACK_W).astype(int), 0, PACK_W - 1)
        v = np.clip(((12.2 - z) / 11.4 * PACK_H).astype(int), 0, PACK_H - 1)
        out[:] = art[v, u]
        out[(np.abs(z - 5.9) < 0.22) | (np.abs(np.abs(x) - 3.25) < 0.14)] = colour(trim)
        return out
    parts = [(body, body_paint), (rounded((-3.5, 2, 0.9), (3.5, 3.5, 6.2), 0.8), pocket_paint), (rounded((-4.9, -2, 0.1), (4.9, 2, 1), 0.3), flat(trim))]
    # A side pocket with a bottle in it.
    parts += [(rounded((4.4, -1.5, 0.6), (5.7, 1.5, 4.2), 0.4), tint(trim, 0.1, 1, 2)), (tube((5.1, 0, 3.6), (5.1, 0, 7), 0.75, 0.65), flat("#bfe0ec")), (tube((5.1, 0, 7), (5.1, 0, 7.8), 0.45, 0.45), flat("#d13a30"))]
    # The handle at the top, and the straps down the back.
    parts.append((tube((-1.8, -0.8, 13.2), (0, -0.8, 14.8), 0.32, 0.32), flat(trim)))
    parts.append((tube((1.8, -0.8, 13.2), (0, -0.8, 14.8), 0.32, 0.32), flat(trim)))
    parts += [(tube((s * 2.4, -2.8, 11.4), (s * 2.8, -3.4, 1.4), 0.6, 0.55), flat(trim)) for s in (-1, 1)]
    parts += [(rounded((s * 1.1 - 0.5, 3.3, 5.4), (s * 1.1 + 0.5, 3.8, 6.3), 0.1), flat("#c8ced3")) for s in (-1, 1)]
    return parts


SHOP_THINGS = {"till_register": till_register, "till_belt": till_belt, "till_belt_end": lambda: till_belt(-1), "store_mat": store_mat, "store_door": store_door, "staff_door": staff_door, "player_basket": player_basket, "meat_board": meat_board}
SHOP_THINGS.update({f"basket_stack-{n}": (lambda n=n: basket_stack(n)) for n in range(1, 6)})
SHOP_THINGS.update({f"till_bag-{n}": (lambda n=n: till_bag(n)) for n in range(6)})
SHOP_THINGS.update({f"stock_trolley-{n}": (lambda n=n: stock_trolley(n)) for n in range(4)})
SHOP_THINGS.update({f"good_{name}": make for name, make in GOODS.items()})


def along_y(make):
    """The same thing, turned to go along y instead of x, for a checkout that runs the other way."""
    swap = lambda p: p[:, [1, 0, 2]]
    return lambda: [((lambda p, f=field: f(swap(p))), (lambda p, c=paint: c(swap(p)))) for field, paint in make()]


SHOP_THINGS.update({"till_belt_up": along_y(till_belt), "till_belt_end_up": along_y(lambda: till_belt(-1)), "till_register_up": along_y(till_register)})
SHOP_THINGS.update({f"backpack-{n}": (lambda n=n: backpack(n)) for n in range(10)})


# --------------------------------------------------------------------- people
# Everyone in a shop or a classroom, from PERSON_LOOKS in src/models.js. Frames: 0 stands, 3 reaches, 4 pays by card, 5 to 8 sit (6 with a hand up,
# 7 and 8 swinging their legs), and 20 to 23 walk. What's carried is drawn over this by the game.
# ------------------------------------------------------- how mammals rest and run
# Their bodies are the same models, with the parts moved. A fox, cat or dog sleeps curled, its nose by its tail; a reindeer, cow or sheep lies
# with its legs under it and its head turned back along its side; a bear lies low with its head on the ground. drop lowers the body to the
# ground, neck is where the head turns, and turn is how far round. See CREDITS.md.
POSES = {
    "boazu": dict(drop=9, head_y=9.6, neck=(0, 8, 17), turn=118, head_down=2.5, tail_y=-8.9, root=(0, -9.5, 16.6), tail_turn=0, graze=62),
    "rieban": dict(drop=3.7, head_y=5.6, neck=(0, 4.5, 8), turn=150, head_down=2.3, tail_y=-6.5, root=(0, -5.5, 6.2), tail_turn=-150, graze=58),
    "guovza": dict(drop=4.3, head_y=8.5, neck=(0, 7, 13), turn=0, head_down=4.5, tail_y=-11, root=(0, -11, 12), tail_turn=0, graze=50),
    "beana": dict(drop=3.6, head_y=5.8, neck=(0, 5, 9), turn=150, head_down=2.6, tail_y=-6, root=(0, -6, 7.6), tail_turn=-120, graze=55),
    "gahttu": dict(drop=3.6, head_y=4.4, neck=(0, 4, 8.6), turn=150, head_down=2.4, tail_y=-5.6, root=(0, -5.4, 6.8), tail_turn=-120, graze=52),
    "njoammil": dict(drop=1.5, head_y=3.6, neck=(0, 3.4, 8), turn=0, head_down=1.6, tail_y=-5.4, root=(0, -5.6, 6), tail_turn=0, graze=48),
    "oarri": dict(drop=0, head_y=99, neck=(0, 1.4, 10), turn=0, head_down=0, tail_y=-3, root=(0, -3, 2), tail_turn=0, graze=0, head_z=9.4),
    "sahpan": dict(drop=1, head_y=3.4, neck=(0, 2.5, 3.4), turn=130, head_down=0.7, tail_y=-4.6, root=(0, -4.5, 2.2), tail_turn=-90, graze=38),
    "savza": dict(drop=2.8, head_y=4.3, neck=(0, 4.2, 8.8), turn=118, head_down=2.3, tail_y=-6, root=(0, -6, 8.4), tail_turn=0, graze=60),
    "gussa": dict(drop=5.7, head_y=7, neck=(0, 6.5, 14), turn=118, head_down=3.4, tail_y=-8.9, root=(0, -9, 13.8), tail_turn=-55, graze=64),
    "spiidni": dict(drop=2.4, head_y=4.4, neck=(0, 4, 7.2), turn=0, head_down=2.4, tail_y=-6.2, root=(0, -6.5, 8), tail_turn=0, graze=50),
}


def centre_of(field):
    """Roughly the middle of a part, however small: found coarsely, then looked at closely."""
    grid = np.mgrid[-30:30:1, -30:30:1, 0:42:1].reshape(3, -1).T
    values = field(grid)
    near = grid[np.argmin(values)]
    fine = np.mgrid[-4:4:0.16, -4:4:0.16, -4:4:0.16].reshape(3, -1).T + near
    inside = fine[field(fine) < 0]
    return inside.mean(axis=0) if len(inside) else near


def turned_z(p, about, degrees):
    a = np.radians(degrees)
    c, s = np.cos(a), np.sin(a)
    q = p - about
    return np.stack([q[:, 0] * c - q[:, 1] * s, q[:, 0] * s + q[:, 1] * c, q[:, 2]], axis=1) + about


def turned_x(p, about, degrees):
    a = np.radians(degrees)
    c, s = np.cos(a), np.sin(a)
    q = p - about
    return np.stack([q[:, 0], q[:, 1] * c - q[:, 2] * s, q[:, 1] * s + q[:, 2] * c], axis=1) + about


def moved(field, paint, to_model, floor=False):
    """A part moved by a function from where a point is now to where it was on the standing model."""
    new_field = (lambda p: np.maximum(field(to_model(p)), -p[:, 2])) if floor else (lambda p: field(to_model(p)))
    return new_field, (lambda p: paint(to_model(p)))


def is_head(pose, at):
    return at[1] > pose["head_y"] or at[2] > pose.get("head_z", 99)


def asleep(name, make):
    pose = POSES[name]
    neck, root = np.array(pose["neck"], float), np.array(pose["root"], float)
    lift = np.array([0, 0, pose["drop"]], float)
    head_lift = np.array([0, 0, pose["drop"] + pose["head_down"]], float)
    parts = []
    closing = []
    for field, paint in make(0):
        if getattr(field, "spot", False):
            continue
        at = centre_of(field)
        if is_head(pose, at):
            to_model = lambda p: turned_z(p + head_lift, neck, -pose["turn"])
        elif at[1] < pose["tail_y"] and at[2] > pose["root"][2] * 0.4:
            to_model = lambda p: turned_z(p + lift, root, -pose["tail_turn"])
        else:
            to_model = lambda p: p + lift
        if hasattr(field, "eye"):
            x, y, z, r = field.eye
            lid = ell((x, y, z), (r * 1.05, r * 1.05, r * 0.2))
            closing.append(moved(lid, flat("#1a1410"), to_model))
            continue
        parts.append(moved(field, paint, to_model, floor=True))
    if name == "oarri":  # curled up, with the great tail over it like a blanket
        parts.append((fur(ell((0, -0.4, 6.8), (3.1, 3.4, 4.3)), 0.8, 1.4, 5), shaded_fur("#d9783a", 0.4)))
        parts = [part for part in parts if centre_of(part[0])[1] > -1.2 or centre_of(part[0])[2] < 5] + parts[-1:]
    return parts + closing


def grazing(name, make):
    """The head down to eat or to sniff at the ground."""
    pose = POSES[name]
    neck = np.array(pose["neck"], float)
    parts = []
    for field, paint in make(0):
        if is_head(pose, centre_of(field)) and pose["graze"]:
            parts.append(moved(field, paint, lambda p: turned_x(p, neck, pose["graze"])))
        else:
            parts.append((field, paint))
    return parts


def galloping(name, make, frame):
    """Long strides, the body rising and falling, and the tail lifted out behind."""
    pose = POSES[name]
    root = np.array(pose["root"], float)
    lift = np.array([0, 0, 0.9 if frame == 10 else 0.2], float)
    parts = []
    for field, paint in make(frame):
        centre = centre_of(field)
        if centre[1] < pose["tail_y"] and centre[2] > root[2] * 0.4:
            parts.append(moved(field, paint, lambda p: turned_x(p - lift, root, 38)))
        else:
            parts.append(moved(field, paint, lambda p: p - lift))
    return parts


POSES.update({f"beana-{breed}": POSES["beana"] for breed in DOGS})
POSES["gumpe"] = POSES["beana"]
POSES["geatki"] = dict(POSES["beana"], drop=1.8)
POSES["albbas"] = dict(POSES["beana"], drop=4.6, tail_turn=0)
POSES["goddi"] = POSES["boazu"]
POSES["ealga"] = dict(drop=10.4, head_y=10.6, neck=(0, 9.6, 19.2), turn=118, head_down=3, tail_y=-9.8, root=(0, -10.2, 17.6), tail_turn=0, graze=58)
POSES["madjit"] = dict(drop=1.4, head_y=4.6, neck=(0, 4.2, 5), turn=0, head_down=1.4, tail_y=-5.4, root=(0, -5.2, 2.8), tail_turn=0, graze=30)
for _name, _m in MUSTELIDS.items():
    _L, _r, _leg = _m["long"], _m["thick"], _m["leg"]
    POSES[_name] = dict(drop=_leg - 0.1, head_y=_L + _r * 0.5, neck=(0, _L + _r * 0.4, _leg + _r * 1.4), turn=150, head_down=_r * 0.8,
                        tail_y=-_L - _r * 0.4, root=(0, -_L, _leg + _r), tail_turn=-150, graze=50)
for _name, _k in RODENTS.items():
    POSES[_name] = dict(POSES["sahpan"], head_y=2.4, neck=(0, 2, 3.2), tail_y=-3.7, root=(0, -3.6, 2.2), graze=34)


def walking(name, make, frame):
    """The body rises a little as a pair of legs passes, and the head nods with the steps."""
    pose = POSES[name]
    neck = np.array(pose["neck"], float)
    lift = np.array([0, 0, 0.3 if frame in (21, 23) else 0], float)
    nod = {20: -3, 21: 2, 22: -3, 23: 2}[frame]
    parts = []
    for field, paint in make(frame):
        centre = centre_of(field)
        if centre[2] < pose["drop"] * 0.55 + 0.5:  # a foot stays on the ground
            parts.append((field, paint))
        elif is_head(pose, centre):
            parts.append(moved(field, paint, lambda p: turned_x(p - lift, neck, nod)))
        else:
            parts.append(moved(field, paint, lambda p: p - lift))
    return parts


def mammal(name, make):
    def made(frame):
        FRAME["now"] = frame
        if frame in (20, 21, 22, 23):
            return walking(name, make, frame)
        if frame == 12:
            return asleep(name, make)
        if frame == 13:
            return grazing(name, make)
        if frame in (10, 11) and name not in ("njoammil", "oarri"):
            return galloping(name, make, frame)
        return make(frame)
    return made


def larger(make, size):
    """The same model at another size, for one that would be too small to read in the world."""
    def made(frame):
        return [(lambda p, f=field: f(p / size) * size, lambda p, c=paint: c(p / size)) for field, paint in make(frame)]
    return made


WALKS = (0, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23)  # standing, a tail swished each way, a gallop, asleep, head down, and four of a walk
FLIES = (0, 5, 30, 31, 32, 33)  # standing, pecking, and four of a wingbeat
ANIMALS = {
    "boazu": (mammal("boazu", boazu), WALKS), "rieban": (mammal("rieban", rieban), WALKS), "guovza": (mammal("guovza", guovza), (0, 10, 11, 12, 13, 20, 21, 22, 23)), "rievssat": (larger(rievssat, 1.4), FLIES),
    "beana": (mammal("beana", beana), (0, 5, 6, 10, 11, 12, 13, 20, 21, 22, 23)), "njoammil": (mammal("njoammil", njoammil), (0, 1, 12, 13)), "oarri": (mammal("oarri", oarri), (0, 1, 8, 9, 12)), "cuoppu": (cuoppu, (0, 1)),
    "sahpan": (mammal("sahpan", sahpan), WALKS), "gahttu": (mammal("gahttu", gahttu), WALKS), "savza": (mammal("savza", savza), WALKS), "gussa": (mammal("gussa", gussa), WALKS), "spiidni": (mammal("spiidni", spiidni), WALKS),
    "goahppil": (goahppil, FLIES), "garanas": (garanas, FLIES), "njukca": (njukca, FLIES), "goaskin": (goaskin, FLIES),
    "jievjaskuolfi": (jievjaskuolfi, FLIES), "beahceloddi": (beahceloddi, FLIES), "beaiveloddi": (beaiveloddi, (40, 41, 42, 43, 44, 45)),
}
DOG_FRAMES = (0, 5, 6, 10, 11, 12, 13, 20, 21, 22, 23)
for breed, b in DOGS.items():
    ANIMALS[f"beana-{breed}"] = (larger(mammal(f"beana-{breed}", canine_maker(b)), BREEDS[breed]), DOG_FRAMES)
for name, (size, b) in WILD.items():
    ANIMALS[name] = (larger(mammal(name, canine_maker(b)), size), WALKS)
ANIMALS["goddi"] = (larger(mammal("goddi", goddi), 1.05), WALKS)
ANIMALS["ealga"] = (larger(mammal("ealga", ealga), 1.3), WALKS)
ANIMALS["madjit"] = (larger(mammal("madjit", madjit), 1.1), (0, 8, 9, 12, 13, 20, 21, 22, 23))
# The smallest are drawn a little bigger than life, as the ptarmigan is, so that they can be told apart in the world.
SHOWN_BIGGER = {"buoidda": 1.2, "buovnnjat": 1.35, "goddesahpan": 1.45}
for name, m in MUSTELIDS.items():
    ANIMALS[name] = (larger(mammal(name, lambda frame, m=m: mustelid(frame, m)), SHOWN_BIGGER.get(name, 1)), WALKS)
for name, k in RODENTS.items():
    ANIMALS[name] = (larger(mammal(name, lambda frame, k=k: rodent(frame, k)), SHOWN_BIGGER[name]), WALKS)
ANIMALS["garja"] = (garja, FLIES)
ANIMALS["cuonja"] = (cuonja, FLIES)
for name, make in FOOD_MODELS.items():
    ANIMALS[name] = (make, (0,))
for name, make in SHOP_THINGS.items():
    ANIMALS[name] = ((lambda frame, make=make: make()), (0,))
ANIMALS["meat_grinder"] = (meat_grinder, (0, 1, 2, 3))
# Only ever seen from one side.
ONE_SIDED = set(FOOD_MODELS) | set(SHOP_THINGS) | {"meat_grinder"}


# -------------------------------------------------------------- the pictures
def render(parts, facing):
    """One picture, looking along the world's angle, the model turned to face this way."""
    fx, fy = facing
    w, h = CELL_W * DETAIL, CELL_H * DETAIL
    u = (np.arange(w) + 0.5) / DETAIL - ANCHOR[0]
    v = (np.arange(h) + 0.5) / DETAIL - ANCHOR[1]
    uu, vv = np.meshgrid(u, v)
    base = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    def built(p):
        return np.stack([p[:, 0] * fy - p[:, 1] * fx, p[:, 1] * fy + p[:, 0] * fx, p[:, 2]], axis=1)
    nearest = lambda p: np.minimum.reduce([field(built(p)) for field, _ in parts])
    t = np.full(len(base), 62.0)
    hit = np.zeros(len(base), bool)
    live = np.arange(len(base))
    root3 = np.sqrt(3)
    for _ in range(90):
        if not len(live):
            break
        d = nearest(base[live] + t[live, None])
        arrived = d < 0.02
        hit[live[arrived]] = True
        t[live] -= np.maximum(d, 0.02) / root3 * 0.85
        live = live[~arrived & (t[live] > -62)]
    out = np.zeros((h, w, 4), np.uint8)
    at = np.nonzero(hit)[0]
    if not len(at):
        return out
    p = base[at] + t[at, None]
    e = 0.05
    normal = np.stack([nearest(p + np.eye(3)[i] * e) - nearest(p - np.eye(3)[i] * e) for i in range(3)], axis=1)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    lit = normal @ LIGHT
    q = built(p)
    which = np.argmin([field(q) for field, _ in parts], axis=0)
    rgb = np.zeros((len(p), 3))
    for i, (_, paint) in enumerate(parts):
        chosen = which == i
        if chosen.any():
            rgb[chosen] = paint(q[chosen])
    shade = np.select([lit > BANDS[0][0], lit > BANDS[1][0], lit > BANDS[2][0]], [BANDS[0][1], BANDS[1][1], BANDS[2][1]], BANDS[3][1])
    ys, xs = at // w, at % w
    out[ys, xs, :3] = np.clip(rgb * shade[..., None], 0, 255)
    out[ys, xs, 3] = 255
    solid = out[:, :, 3] > 0
    grown = solid.copy()
    for _ in range(2):
        g = grown.copy()
        g[1:] |= grown[:-1]; g[:-1] |= grown[1:]; g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]
        grown = g
    out[grown & ~solid] = (20, 16, 18, 255)
    return out


def make_picture(spec):
    name, row, column = spec
    make, frames = ANIMALS[name]
    return name, row, column, render(make(frames[column]), FACINGS[row])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Given names, only those are made, and the rest of animals.js stays as it is.
    names = sys.argv[1:] or list(ANIMALS)
    rows_of = lambda name: 1 if name in ONE_SIDED else 4
    specs = [(name, row, column) for name in names for row in range(rows_of(name)) for column in range(len(ANIMALS[name][1]))]
    pictures = {}
    with ProcessPoolExecutor(max_workers=6) as pool:
        for name, row, column, picture in pool.map(make_picture, specs):
            pictures[name, row, column] = picture
    # Each sheet holds only the part of the picture that its animal ever fills, as a whole one would take a lot of memory.
    sizes = {}
    for name in names:
        frames = ANIMALS[name][1]
        rows = rows_of(name)
        solid = np.any([pictures[name, r, c][:, :, 3] > 0 for r in range(rows) for c in range(len(frames))], axis=0)
        ys, xs = np.nonzero(solid.any(axis=1))[0], np.nonzero(solid.any(axis=0))[0]
        x0, x1, y0, y1 = int(xs[0]), int(xs[-1]) + 1, int(ys[0]), int(ys[-1]) + 1
        w, h = x1 - x0, y1 - y0
        sheet = np.zeros((h * rows, w * len(frames), 4), np.uint8)
        for r in range(rows):
            for c in range(len(frames)):
                sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = pictures[name, r, c][y0:y1, x0:x1]
        Image.fromarray(sheet, "RGBA").save(OUT / f"{name}.png", optimize=True)
        sizes[name] = {"frames": list(frames), "rows": rows, "x": x0, "y": y0, "w": w, "h": h}
    # People are made by tools/make_mahtte.py, into the same list.
    _old = (OUT / "animals.js").read_text(encoding="utf-8")
    sizes = {**json.loads(_old[_old.index("{"):_old.rindex("}") + 1]), **sizes}
    (OUT / "animals.js").write_text("// Generated by tools/make_animals.py: what each animal's sheet holds.\nwindow.MAHTTE_ANIMALS = " + json.dumps(sizes, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(len(specs), "pictures written")


if __name__ == "__main__":
    main()
