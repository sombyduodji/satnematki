#!/usr/bin/env python3
"""Make the two classrooms in 3D, into art/classroom/ and art/lesson/: the floor in pieces, each tile's walls and desks, and the chair.

They're made as the grocery store is, in tools/make_store.py, and lit together: the sun comes in through the windows and falls across the
floor and the desks. The tiles of data/map.js decide what can be walked on; this only decides how it looks.

Usage: python3 tools/make_classrooms.py
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402
from make_store import SHEET_GAP, box, on_whole_pixels, tones, what_shows  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DETAIL = 4
TILE = 16
HW, HH, TOP_PAD, EDGE, MARGIN = 16, 8, 60, 10, 80  # as in src/world.js
CHUNK = 512  # picture pixels on a side, as the forest's
CELL_H = 64  # how high a tile's picture is, in the world's pixels
SUN = np.array([-0.8, -0.5, 0.4])
SUN = SUN / np.linalg.norm(SUN)
ROOM_LIGHT = np.array([-0.5, 0.35, 0.8]) / np.linalg.norm([-0.5, 0.35, 0.8])
WIN_LOW, WIN_HIGH = 13, 34
DESK_TOP, TEACHER_TOP = 10.5, 13  # must match what the game stands on them
# Along the back wall in tiles, and how high: must match boardFrom and boardTo in src/lesson.js.
LESSON_BOARD = (3.4, 11, 10, 30)
CHALK_BOARD = (9.2, 20.8, 11, 34)
PROUD = 2.6  # how far a tile on the back wall may reach out into the room, for what hangs on it
_maps = (ROOT / "data/map.js").read_text(encoding="utf-8")
MAPS = json.loads(_maps[_maps.index("{"):_maps.rindex("}") + 1])

_hand = str(ROOT / "art/fonts/Caveat.ttf")


def _chalkboard():
    """The classroom's board with something on it from the morning: a greeting, the numbers and a sum."""
    picture = Image.new("RGB", (768, 160), "#2c5a48")
    draw = ImageDraw.Draw(picture)
    rng = np.random.default_rng(4)
    # Old chalk wiped off, in sweeps.
    for _ in range(40):
        x, y = int(rng.integers(0, 768)), int(rng.integers(0, 160))
        draw.line((x, y, x + int(rng.integers(40, 180)), y + int(rng.integers(-12, 12))), fill="#356552", width=int(rng.integers(3, 12)))
    chalk = "#e6ece0"
    draw.text((48, 12), "Bures!", font=ImageFont.truetype(_hand, 74), fill=chalk)
    draw.text((318, 18), "1 2 3 4 5 6 7 8 9 10", font=ImageFont.truetype(_hand, 54), fill="#f2e6a0")
    draw.text((318, 86), "2 + 3 = 5", font=ImageFont.truetype(_hand, 54), fill=chalk)
    return np.array(picture)


def _alphabet():
    """The Sámi alphabet on cards along the wall."""
    letters = "A Á B C Č D Đ E F G H I J K L M N Ŋ O P R S Š T Ŧ U V Z Ž".split()
    width = 58
    picture = Image.new("RGB", (width * len(letters), 76), "#f4eeda")
    draw = ImageDraw.Draw(picture)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
    tints = ["#c8372d", "#2f5fa8", "#e0a020", "#3a8a48"]
    for i, letter in enumerate(letters):
        draw.rectangle((i * width, 0, (i + 1) * width - 1, 75), fill="#f8f4e6", outline="#b8ae94", width=2)
        draw.text((i * width + width / 2, 38), letter, font=font, fill=tints[i % 4], anchor="mm")
    return np.array(picture)


def _flag():
    """The Sámi flag."""
    picture = Image.new("RGB", (280, 200), "#dc241f")
    draw = ImageDraw.Draw(picture)
    for x0, x1, tone in ((0, 0.44, "#dc241f"), (0.44, 0.52, "#007229"), (0.52, 0.6, "#ffce00"), (0.6, 1, "#0035ad")):
        draw.rectangle((x0 * 280, 0, x1 * 280, 200), fill=tone)
    cx, cy, r = 0.48 * 280, 100, 62
    draw.arc((cx - r, cy - r, cx + r, cy + r), 90, 270, fill="#0035ad", width=20)
    draw.arc((cx - r, cy - r, cx + r, cy + r), -90, 90, fill="#dc241f", width=20)
    return np.array(picture)


def _cover():
    """A Sámi language book's cover, with the flag's colours on it."""
    picture = Image.new("RGB", (200, 260), "#f4eeda")
    draw = ImageDraw.Draw(picture)
    for i, tone in enumerate(("#dc241f", "#007229", "#ffce00", "#0035ad")):
        draw.rectangle((i * 50, 0, (i + 1) * 50, 96), fill=tone)
    draw.text((100, 158), "Sámegiella", font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30), fill="#20307a", anchor="mm")
    draw.rectangle((16, 200, 184, 206), fill="#bb2a2d")
    return np.array(picture)


CHALK, ALPHABET, FLAG, COVER = _chalkboard(), _alphabet(), _flag(), _cover()


class Room:
    """One room's sizes and what stands where."""

    def __init__(self, name, wall_h, windows, walls, low, wall_tone, skirting, floor, board):
        self.board = board
        self.name, self.wall_h, self.windows, self.walls_at, self.low_at = name, wall_h, windows, walls, low
        self.wall_tone, self.skirting, self.floor = wall_tone, skirting, floor
        self.map = MAPS[name]["rows"]
        self.height, self.width = len(self.map), len(self.map[0])
        self.world_w, self.world_h = (self.width + self.height) * HW + MARGIN * 2, (self.width + self.height) * HH + TOP_PAD + EDGE + 60
        self.ox = self.height * HW + MARGIN
        self.x0, self.y0, self.x1, self.y1 = 2 * TILE, 2 * TILE, (self.width - 2) * TILE, (self.height - 2) * TILE
        self.out = ROOT / "art" / name
        self.desks = [(x, y) for y, row in enumerate(self.map) for x, t in enumerate(row) if t == "E"]
        teacher = [(x, y) for y, row in enumerate(self.map) for x, t in enumerate(row) if t == "T"]
        xs = [x for x, _ in teacher]
        self.teacher = (min(xs) * TILE, teacher[0][1] * TILE, (max(xs) + 1) * TILE, (teacher[0][1] + 1) * TILE)
        # What casts shade and shadow: the board, the desks and the chairs in front of them.
        tx0, ty0, tx1, ty1 = self.teacher
        a, b, low_z, high_z = board
        self.occluders = [((tx0 + 0.5, ty0 + 1, 0), (tx1 - 0.5, ty1 - 1, TEACHER_TOP)), ((a * TILE, self.y0, low_z), (b * TILE, self.y0 + 1.2, high_z)), ((a * TILE, self.y0, low_z - 1.5), (b * TILE, self.y0 + 2.4, low_z))]
        for x, y in self.desks:
            self.occluders.append(((x * TILE + 0.8, y * TILE + 0.8, DESK_TOP - 1.6), ((x + 1) * TILE - 0.8, (y + 1) * TILE - 0.8, DESK_TOP)))
            self.occluders += [((x * TILE + a, y * TILE + b, 0), (x * TILE + a + 1.2, y * TILE + b + 1.2, DESK_TOP)) for a in (1.4, 13.4) for b in (1.4, 13.4)]
            cx, cy = (x + 0.5) * TILE, (y + 1.42) * TILE
            self.occluders.append(((cx - 4.8, cy - 4.8, 5.2), (cx + 4.8, cy + 4.8, 6.6)))
            self.occluders.append(((cx - 4.8, cy + 3.8, 3), (cx + 4.8, cy + 4.8, 18)))


# ------------------------------------------------------------------ the walls
def window_hole(room, p):
    return np.minimum.reduce([box(p, (20, a * TILE + 2, WIN_LOW), (room.x0 + 2, b * TILE - 2, WIN_HIGH)) for a, b in room.windows])


def wall_x(room, p):
    return np.maximum(box(p, (room.x0 - 5, room.y0 - 5, 0), (room.x0, room.y1, room.wall_h)), -window_hole(room, p))


def wall_y(room, p):
    return box(p, (room.x0 - 5, room.y0 - 5, 0), (room.x1, room.y0, room.wall_h))


def low_wall_y(room, p):
    return box(p, (room.x0 - 5, room.y1, 0), (room.x1 + 5, room.y1 + 5, 8))


def low_wall_x(room, p):
    return box(p, (room.x1, room.y0 - 5, 0), (room.x1 + 5, room.y1 + 5, 8))


def board_body(room, p):
    """A board that stands out from the wall: its frame, its face set in a little, its tray, and on the tray what's used at it."""
    a, b, low, high = room.board
    x0, x1, y = a * TILE, b * TILE, room.y0
    frame = np.maximum(box(p, (x0, y, low), (x1, y + 1.2, high)), -box(p, (x0 + 0.9, y + 0.3, low + 0.9), (x1 - 0.9, y + 3, high - 0.9)))
    tray = np.maximum(box(p, (x0 + 0.6, y, low - 1.5), (x1 - 0.6, y + 2.4, low - 0.1)), -box(p, (x0 + 1, y + 0.7, low - 0.8), (x1 - 1, y + 2, low + 1)))
    d = [frame, tray]
    if room.name == "lesson":
        d += [box(p, (x0 + 8, y + 0.8, low - 0.8), (x0 + 21, y + 2, low + 0.6))]  # the eraser; the game lays the pens beside it
    else:
        d += [box(p, (x0 + 20, y + 0.8, low - 0.8), (x0 + 24, y + 1.8, low - 0.2)), box(p, (x0 + 60, y + 0.8, low - 0.8), (x0 + 70, y + 2, low + 0.4))]
    return np.minimum.reduce(d)


def board_face(room, p):
    a, b, low, high = room.board
    return box(p, (a * TILE + 0.9, room.y0, low + 0.9), (b * TILE - 0.9, room.y0 + 0.7, high - 0.9))


def whiteboard_face(room, p):
    """A glossy white face, the same all over, so that the writing reads: warmer towards the windows, with a long soft gleam across it."""
    a, b, low, _ = room.board
    x0, x1 = a * TILE, b * TILE
    x, z = p[:, 0], p[:, 2]
    along = (x - x0) / (x1 - x0)
    white = np.tile(colour("#f8faf9"), (len(p), 1)) * (1 - 0.05 * along[..., None])
    white = white + np.array([2, -3, -14]) * np.exp(-along * 4)[..., None]
    gleam = np.exp(-(((x - x0 - 36 - (z - low) * 1.3) / 6) ** 2)) + 0.6 * np.exp(-(((x - x0 - 50 - (z - low) * 1.3) / 2.6) ** 2))
    return np.minimum(white + gleam[..., None] * np.array([3, 6, 8]) - (1 - gleam[..., None]) * 2, 255)


def chalkboard_face(room, p):
    a, b, low, high = room.board
    u, v = (p[:, 0] - a * TILE) / ((b - a) * TILE), (high - p[:, 2]) / (high - low)
    return CHALK[np.clip((v * 159.99).astype(int), 0, 159), np.clip((u * 767.99).astype(int), 0, 767)] * 0.94


def whiteboard_paint(room, p):
    a, b, low, high = room.board
    x0, x1, y0 = a * TILE, b * TILE, room.y0
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    # Brushed aluminium, with its lighter top edge.
    out = np.tile(colour("#c4cbd2"), (len(p), 1)) * (0.94 + value_noise(x * 0.9, z * 4)[..., None] * 0.1)
    out[z > high - 0.4] = colour("#e8ecef")
    # The tray, darker in its trough, and a felt eraser with its grey handle.
    tray = z < low - 0.05
    out[tray] = colour("#a4adb5")
    out[tray & (y > y0 + 2.2)] = colour("#c8ced3")
    eraser = (x > x0 + 7.9) & (x < x0 + 21.1) & (y > y0 + 0.75) & (y < y0 + 2.05) & (z > low - 0.85)
    out[eraser] = colour("#40464e")
    out[eraser & (z < low - 0.2)] = colour("#d8d4c8")
    return out


def chalkboard_paint(room, p):
    a, b, low, high = room.board
    x0, x1, y0 = a * TILE, b * TILE, room.y0
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    out = tones(["#6f4526", "#7a4c28", "#8a5c34"], 1 + value_noise(x * 0.3, z * 2) * 1.6)
    out[(z > low - 0.85) & (z < low - 0.1) & (x > x0 + 19.9) & (x < x0 + 24.1) & (y > y0 + 0.7)] = colour("#f4f1e8")
    eraser = (z > low - 0.85) & (x > x0 + 59.9) & (x < x0 + 70.1) & (y > y0 + 0.7) & (y < y0 + 2.1)
    out[eraser] = colour("#8a6a48")
    return out


def backdrop(room, p):
    return box(p, (19, 0, 0), (21, room.height * TILE, WIN_HIGH + 0.5))


def bars(room, p):
    d = []
    for a, b in room.windows:
        mid = (a + b) * TILE / 2
        d += [box(p, (room.x0 - 4, mid - 0.7, WIN_LOW), (room.x0 - 2, mid + 0.7, WIN_HIGH)), box(p, (room.x0 - 4, a * TILE, 24), (room.x0 - 2, b * TILE, 25.2))]
    return np.minimum.reduce(d)


def base_wall(room, p, along):
    z = p[:, 2]
    grain = value_noise(along * 0.08, z * 0.08)
    out = np.tile(colour(room.wall_tone), (len(p), 1)) * (0.97 + grain[..., None] * 0.05)
    out[z < 2.2] = colour(room.skirting)
    out[z > room.wall_h - 1.6] = colour("#fbf7e8")
    return out


def classroom_wall_x(room, p):
    out = base_wall(room, p, p[:, 1])
    y, z = p[:, 1], p[:, 2]
    out[window_hole(room, p) < 1.5] = colour("#f6f2e6")
    # Under each window a radiator, its ribs catching the light.
    for a, b in room.windows:
        on = (y > a * TILE + 3) & (y < b * TILE - 3) & (z > 3.2) & (z < 10.5)
        out[on] = colour("#eceae2")
        out[on & (((y + 300) % 2.2) < 0.7)] = colour("#b8b6ac")
    return out


def classroom_wall_y(room, p):
    out = base_wall(room, p, p[:, 0])
    x, z = p[:, 0], p[:, 2]
    front = p[:, 1] > room.y0 - 0.6
    # The alphabet above it, along the wall.
    a0, a1 = 3 * TILE, 27 * TILE
    strip = front & (x > a0) & (x < a1) & (z > 37) & (z < 42.6)
    u, v = (x - a0) / (a1 - a0), (42.6 - z) / 5.6
    out[strip] = ALPHABET[(v[strip] * 75.99).astype(int), (u[strip] * (ALPHABET.shape[1] - 0.01)).astype(int)]
    # To the left, a bookcase set into the wall.
    case = front & (x > 3 * TILE) & (x < 8.4 * TILE) & (z > 2.2) & (z < 33)
    out[case] = colour("#8a6038")
    row = np.floor((z - 3) / 7.4)
    within = (z - 3) - row * 7.4
    book = case & (within > 0.9) & (within < 6.6) & (((x + 300) % TILE) > 1) & (((x + 300) % TILE) < TILE - 0.6)
    spines = np.array([colour(c) for c in ("#a8372d", "#2f5fa8", "#e0a020", "#3a7a48", "#7a4a8a", "#e8e0c8", "#30506a")])
    pick = np.clip((value_noise(np.floor(x / 2.3) * 3.1, row * 2.3) * 6.99).astype(int), 0, 6)
    tall = value_noise(np.floor(x / 2.3) * 5.7, row * 1.3) * 1.8
    out[book & (within < 6.6 - tall)] = spines[pick][book & (within < 6.6 - tall)]
    out[book & (within >= 6.6 - tall)] = colour("#4f3219")
    out[case & (((x + 300) % 2.3) < 0.26) & (within > 0.9) & (within < 6.6 - tall)] = out[case & (((x + 300) % 2.3) < 0.26) & (within > 0.9) & (within < 6.6 - tall)] * 0.72
    # To the right, a notice board with drawings pinned up, and a clock.
    pin = front & (x > 21.8 * TILE) & (x < 26.6 * TILE) & (z > 14) & (z < 32)
    out[pin] = tones(["#b08a58", "#c49a64"], 1 + value_noise(x * 1.4, z * 1.4))[pin]
    cards = np.array([colour(c) for c in ("#f8f6ee", "#fce6a0", "#d8ecf8", "#f8d8e0", "#dcecc8")])
    for i, (cx, cz) in enumerate(((22.5, 26), (23.6, 27), (24.7, 25.6), (25.8, 26.6), (22.9, 19), (24.1, 18.4), (25.4, 19.2))):
        sheet = front & (np.abs(x - cx * TILE) < 6.4) & (np.abs(z - cz) < 3.9)
        out[sheet] = cards[i % 5]
        out[sheet & (np.hypot(x - cx * TILE + (i % 3 - 1) * 1.5, z - cz - 0.4) < 2.2)] = cards[(i + 2) % 5] * 0.72
        out[sheet & (np.abs(z - cz + 2.2 + (x - cx * TILE) * 0.06) < 0.5)] = colour("#3a8a48") if i % 2 else colour("#2f5fa8")

    return out


def lesson_wall_x(room, p):
    out = base_wall(room, p, p[:, 1])
    y, z = p[:, 1], p[:, 2]
    out[((y + 300) % 8 < 0.3) & (z > 2.2)] = np.array(colour("#e2c694"))
    out[window_hole(room, p) < 1.5] = colour("#f6f2e6")
    # The Sámi flag on the wall between the windows, in a thin frame.
    u, v = (y - 5.2 * TILE) / (1.6 * TILE), (29 - z) / 16
    on = (u > 0) & (u < 1) & (v > 0) & (v < 1)
    out[(u > -0.04) & (u < 1.04) & (v > -0.03) & (v < 1.03)] = colour("#5e4630")
    out[on] = FLAG[(v[on] * 199.99).astype(int), (u[on] * 279.99).astype(int)]
    for a, b in room.windows:
        on = (y > a * TILE + 2) & (y < b * TILE - 2) & (z > 3.2) & (z < 9.8)
        out[on] = colour("#eceae2")
        out[on & (((y + 300) % 2.2) < 0.7)] = colour("#b8b6ac")
    return out


def lesson_wall_y(room, p):
    out = base_wall(room, p, p[:, 0])
    x, z = p[:, 0], p[:, 2]
    front = p[:, 1] > room.y0 - 0.6
    out[((x + 300) % 8 < 0.3) & (z > 2.2) & front] = colour("#e2c694")
    # The Sámi alphabet above the board.
    a0, a1 = 3.4 * TILE, 11 * TILE
    strip = front & (x > a0) & (x < a1) & (z > 31.4) & (z < 35.2)
    u, v = (x - a0) / (a1 - a0), (35.2 - z) / 3.8
    out[strip] = ALPHABET[(v[strip] * 75.99).astype(int), (u[strip] * (ALPHABET.shape[1] - 0.01)).astype(int)]
    # A small shelf of books beyond the board, and a clock above it.
    shelf = front & (x > 11.5 * TILE) & (x < 13.7 * TILE) & (z > 8) & (z < 24)
    out[shelf] = colour("#8a6038")
    row = np.floor((z - 8) / 5.2)
    within = (z - 8) - row * 5.2
    book = shelf & (within > 0.7) & (within < 4.6)
    spines = np.array([colour(c) for c in ("#a8372d", "#2f5fa8", "#e0a020", "#3a7a48", "#7a4a8a", "#e8e0c8")])
    pick = np.clip((value_noise(np.floor(x / 2.1) * 3.7, row * 2.9) * 5.99).astype(int), 0, 5)
    out[book] = spines[pick][book]
    out[book & (((x + 300) % 2.1) < 0.24)] = out[book & (((x + 300) % 2.1) < 0.24)] * 0.7
    d = np.hypot(x - 12.6 * TILE, z - 29.5)
    out[front & (d < 3.6)] = colour("#3b2a1a")
    out[front & (d < 3.0)] = colour("#fbf7e8")
    angle = np.arctan2(x - 12.6 * TILE, z - 29.5)
    out[front & (d < 2.5) & (np.abs(angle - 0.55) < 0.14)] = colour("#1a1a1a")
    out[front & (d < 1.8) & (np.abs(angle + 1.4) < 0.2)] = colour("#1a1a1a")
    return out


def low_paint(room, p):
    out = tones(["#a89f88", "#c8bfa8"], np.ones(len(p)))
    out[p[:, 2] > 7.2] = colour("#f4eeda")
    return out


def outdoors(room, p):
    """Birches and a pale sky beyond the window."""
    along, z = p[:, 1], p[:, 2]
    out = np.tile(colour("#dff2fb"), (len(p), 1))
    leaves = value_noise(along * 0.28, z * 0.5) > 0.44 + (z - 20) * 0.03
    out[leaves] = np.array([colour("#a4d68a"), colour("#c8e8a8")])[(value_noise(along * 0.9, z * 0.9) > 0.5).astype(int)][leaves]
    out[(np.abs(((along + 300) % 23) - 11) < 0.7) & (z < 30)] = colour("#f4f1e8")
    out[z < 16] = colour("#8dc06a")
    return out


# ------------------------------------------------------------------ the desks
def desk_body(room, p):
    """A wooden top with a shelf under it for books, on four thin steel legs."""
    tile_x, tile_y = np.floor(p[:, 0] / TILE) * TILE, np.floor(p[:, 1] / TILE) * TILE
    q = np.stack([p[:, 0] - tile_x, p[:, 1] - tile_y, p[:, 2]], axis=1)
    d = [box(q, (0.8, 0.8, DESK_TOP - 1.6), (15.2, 15.2, DESK_TOP)), box(q, (1.8, 1.8, DESK_TOP - 5.6), (14.2, 11.4, DESK_TOP - 4.6))]
    if room.name == "lesson":  # an exercise book and a pencil
        d += [box(q, (3.6, 4.6, DESK_TOP), (12.4, 11.6, DESK_TOP + 0.4)), box(q, (4, 12.6, DESK_TOP), (11, 13.2, DESK_TOP + 0.5))]
    d += [box(q, (a, b, 0), (a + 1.2, b + 1.2, DESK_TOP - 1.4)) for a in (1.4, 13.4) for b in (1.4, 13.4)]
    return np.minimum.reduce(d)


def desk_paint(room, p):
    x, y, z = p[:, 0] % TILE, p[:, 1] % TILE, p[:, 2]
    out = np.tile(colour("#6a7078"), (len(p), 1))  # steel
    wood = z > DESK_TOP - 1.7
    grain = value_noise(p[:, 0] * 0.9, p[:, 1] * 0.12)
    out[wood] = tones(["#c8a06a", "#dcb880", "#e8c896"], 1 + grain * 1.6)[wood]
    edge = wood & (z < DESK_TOP - 0.3)
    out[edge] = colour("#a87c48")
    under = (z > DESK_TOP - 5.8) & (z < DESK_TOP - 4.4)
    out[under] = colour("#8a6a48")
    if room.name == "lesson":
        book = z > DESK_TOP + 0.06
        out[book] = colour("#fbf6e8")
        out[book & (y < 12) & (np.abs(x - 8) < 0.25)] = colour("#b8ae98")
        out[book & (y < 12) & (x < 8) & (((y + 40) % 1.2) < 0.2)] = colour("#9fb6cc")
        out[book & (y < 12) & (x > 8) & (((y + 40) % 1.2) < 0.2)] = colour("#9fb6cc")
        out[book & (y < 12) & (x < 3.9)] = colour("#bb2a2d")
        out[book & (y >= 12)] = colour("#ecb92e")
        out[book & (y >= 12) & (x < 5)] = colour("#3a3a44")
    return out


def desk_things(room):
    """What's on the teacher's desk, each with its colours. In the small classroom, Sámi books, a flag on a stand, and a guksi."""
    tx0, ty0, tx1, ty1 = room.teacher
    top = TEACHER_TOP
    def pile(x, y, tones):
        made = []
        for i, tone in enumerate(tones):
            def paint(p, tone=tone, z=top + i * 0.95):
                out = np.tile(colour(tone), (len(p), 1))
                out[((p[:, 2] - z) < 0.16)] = colour("#f4f1e8")
                out[(p[:, 1] > y + 7.6 - 0.02) & (np.abs(p[:, 2] - z - 0.55) < 0.14)] = colour("#ecb92e")
                return out
            made.append((lambda p, i=i: box(p, (x + i * 0.3, y, top + i * 0.95), (x + 9 + i * 0.3, y + 7.6, top + (i + 1) * 0.95)), paint))
        return made
    things = pile(tx0 + 4, ty0 + 4, ("#bb2a2d", "#2450a6", "#007229"))
    px, py = tx1 - 6, ty0 + 8
    things.append((lambda p: np.maximum(np.hypot(p[:, 0] - px, p[:, 1] - py) - 1.6, np.maximum(top - p[:, 2], p[:, 2] - top - 3)), lambda p: np.tile(colour("#d8a040"), (len(p), 1))))
    if room.name != "lesson":
        return things
    # A book lying on the desk, its cover up, the top of the cover towards the back.
    bx, by, bw, bd, bh = tx0 + 21, ty0 + 2, 10, 13, 1.2
    def cover(p):
        out = np.tile(colour("#f4f1e8"), (len(p), 1))  # the pages' edges
        out[p[:, 2] < top + 0.2] = colour("#20307a")  # the back cover
        up = p[:, 2] > top + bh - 0.12
        u, v = np.clip((p[:, 0] - bx) / bw, 0, 0.999), np.clip((p[:, 1] - by) / bd, 0, 0.999)
        out[up] = COVER[(v[up] * 260).astype(int), (u[up] * 200).astype(int)]
        return out
    things.append((lambda p: box(p, (bx, by, top), (bx + bw, by + bd, top + bh)), cover))
    things += pile(tx0 + 36, ty0 + 5, ("#ecb92e", "#2450a6"))
    # The flag on a little stand.
    fx, fy = tx1 - 16, ty0 + 7
    def cloth(p):
        out = np.tile(colour("#dc241f"), (len(p), 1))
        u, v = np.clip((p[:, 0] - fx - 0.4) / 8, 0, 0.999), np.clip((top + 15 - p[:, 2]) / 5.8, 0, 0.999)
        out[:] = FLAG[(v * 200).astype(int), (u * 280).astype(int)]
        return out
    things.append((lambda p: box(p, (fx - 2, fy - 2, top), (fx + 2, fy + 2, top + 0.5)), lambda p: np.tile(colour("#5e4630"), (len(p), 1))))
    things.append((lambda p: box(p, (fx - 0.35, fy - 0.35, top), (fx + 0.35, fy + 0.35, top + 15.6)), lambda p: np.tile(colour("#c8ced3"), (len(p), 1))))
    things.append((lambda p: box(p, (fx + 0.35, fy - 0.2, top + 9.2), (fx + 8.4, fy + 0.2, top + 15)), cloth))
    # A guksi, the wooden cup, with its handle.
    gx, gy = tx0 + 15.5, ty0 + 12
    def cup(p):
        q = p - np.array((gx, gy, top + 2.2))
        outer = np.linalg.norm(q / np.array((2.4, 2, 2.2)), axis=1) - 1
        return np.maximum(np.maximum(outer, q[:, 2] - 1), -(np.linalg.norm(q / np.array((1.9, 1.5, 1.8)), axis=1) - 1))
    wood = lambda p: tones(["#7a4a22", "#a06a34", "#c08a4c"], 1 + value_noise(p[:, 0] * 1.8, p[:, 2] * 2.8) * 1.6)
    things.append((cup, wood))
    things.append((lambda p: box(p, (gx + 1.9, gy - 0.6, top + 2.4), (gx + 3.6, gy + 0.6, top + 3.2)), wood))
    return things


def teacher_body(room, p):
    tx0, ty0, tx1, ty1 = room.teacher
    d = [box(p, (tx0 + 0.5, ty0 + 1, TEACHER_TOP - 1.4), (tx1 - 0.5, ty1 - 1, TEACHER_TOP)), box(p, (tx0 + 1.4, ty0 + 1.6, 0), (tx1 - 1.4, ty1 - 1.6, TEACHER_TOP - 1.4))]
    d += [field(p) for field, _ in desk_things(room)]
    return np.minimum.reduce(d)


def teacher_paint(room, p):
    tx0, ty0, tx1, ty1 = room.teacher
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    out = tones(["#7a4c28", "#8a5c34", "#9a6c40"], 1 + value_noise(x * 0.5, z * 0.8) * 1.6)
    front = y > ty1 - 1.8
    # Drawers on the front, each with a handle.
    out[front & (((x - tx0 + 300) % (2 * TILE)) < 0.5) & (z < TEACHER_TOP - 1.4)] = colour("#4f3219")
    out[front & (np.abs(z - 7.6) < 0.25)] = colour("#4f3219")
    handles = front & (np.abs(((x - tx0 + 300) % (2 * TILE)) - TILE) < 2.4) & ((np.abs(z - 9.8) < 0.5) | (np.abs(z - 4) < 0.5))
    out[handles] = colour("#c8c0a8")
    top = (z > TEACHER_TOP - 1.42) & (z <= TEACHER_TOP + 0.08)
    out[top] = tones(["#a9743f", "#b98a58", "#c89a64"], 1 + value_noise(x * 0.8, y * 0.14) * 1.6)[top]
    things = desk_things(room)
    nearest = np.argmin([field(p) for field, _ in things], axis=0)
    away = np.min([field(p) for field, _ in things], axis=0)
    for i, (_, paint) in enumerate(things):
        chosen = (nearest == i) & (away < 0.08)
        if chosen.any():
            out[chosen] = paint(p[chosen])
    return out


CLASSROOM = Room("classroom", 44, [(4, 8), (10, 14), (16, 20)], "WGV", "X", "#f0ecd8", "#6f4a2a", "lino", CHALK_BOARD)
LESSON = Room("lesson", 36, [(3, 5), (7, 9)], "YJ", "H", "#ecd3a4", "#9a6a44", "boards", LESSON_BOARD)
ROOMS = {"classroom": CLASSROOM, "lesson": LESSON}
WALL_PAINT = {"classroom": (classroom_wall_x, classroom_wall_y), "lesson": (lesson_wall_x, lesson_wall_y)}
BOARD_PAINT = {"classroom": chalkboard_paint, "lesson": whiteboard_paint}
BOARD_FACE = {"classroom": chalkboard_face, "lesson": whiteboard_face}


def parts_of(room):
    """Each: its shape, its colours, whether it glows by itself, and which tiles show it."""
    paint_x, paint_y = WALL_PAINT[room.name]
    return [
        (wall_x, paint_x, False, room.walls_at), (wall_y, paint_y, False, room.walls_at), (board_body, BOARD_PAINT[room.name], False, room.walls_at), (board_face, BOARD_FACE[room.name], True, room.walls_at),
        (bars, lambda r, p: np.tile(colour("#f6f2e6"), (len(p), 1)), False, room.walls_at), (backdrop, outdoors, True, room.walls_at),
        (low_wall_y, low_paint, False, room.low_at), (low_wall_x, low_paint, False, room.low_at),
        (desk_body, desk_paint, False, "E"), (teacher_body, teacher_paint, False, "T"),
    ]


def occluders(room, p):
    return np.minimum.reduce([box(p, low, high) for low, high in room.occluders])


def through_a_window(room, p):
    """Back along the sun's rays, whether a point reaches a pane."""
    t = np.maximum(p[:, 0] - room.x0, 0) / -SUN[0]
    y, z = p[:, 1] + SUN[1] * t, p[:, 2] + SUN[2] * t
    reached = np.zeros(len(p), bool)
    for a, b in room.windows:
        mid = (a + b) * TILE / 2
        reached |= (y > a * TILE + 3) & (y < b * TILE - 3) & (z > WIN_LOW + 1) & (z < WIN_HIGH - 1) & (np.abs(y - mid) > 0.8) & (np.abs(z - 24.6) > 0.8)
    return reached


def lit(room, p, normal, rgb):
    """The colour of these surfaces in the room's light, with what shades them, and the sun where it gets in."""
    facing = normal @ ROOM_LIGHT
    shade = np.select([facing > 0.75, facing > 0.3, facing > -0.1], [1.05, 0.95, 0.82], 0.7)
    from_windows = 0.24 * np.exp(-np.maximum(p[:, 0] - room.x0, 0) / 110)
    light = shade * (0.8 + from_windows)
    def closeness(reach):
        return np.clip(np.minimum(occluders(room, p + normal * reach), np.minimum(p[:, 0] - room.x0, p[:, 1] - room.y0) + reach) / reach, 0, 1)
    light = light * (0.5 + 0.28 * closeness(2.2) + 0.22 * closeness(7))
    out = rgb * light[..., None]
    idx = np.nonzero(through_a_window(room, p) & (normal @ SUN > 0.05))[0]
    if len(idx):
        q = p[idx] + normal[idx] * 0.4
        travel = np.zeros(len(idx))
        blocked = np.zeros(len(idx), bool)
        for _ in range(22):
            d = occluders(room, q + SUN * travel[..., None])
            blocked |= d < 0.06
            travel += np.maximum(d, 0.6)
        sunny = idx[~blocked]
        soft = 0.72 + 0.28 * through_a_window(room, p[sunny] + np.array([1.1, -0.7, 0]))
        warm = np.minimum(rgb[sunny] * np.array([1.26, 1.2, 1.02]) * np.maximum(light[sunny], 0.82)[..., None] + 16, 255)
        out[sunny] = out[sunny] * (1 - soft[..., None]) + warm * soft[..., None]
    return out


# ------------------------------------------------------------------ the floor
def floor_paint(room, p):
    x, y = p[:, 0], p[:, 1]
    if room.floor == "lino":
        # Sheet linoleum, pale and mottled, with a darker border round the room.
        mottle = value_noise(x * 0.05, y * 0.05)
        out = np.tile(colour("#cdcbb2"), (len(p), 1)) * (0.93 + mottle[..., None] * 0.1)
        speck = value_noise(x * 3.2, y * 3.2)
        out[speck > 0.74] = out[speck > 0.74] * 0.93
        out[speck < 0.22] = np.minimum(out[speck < 0.22] * 1.04, 255)
        away = np.minimum.reduce([x - room.x0, y - room.y0, room.x1 - x, room.y1 - y])
        out[away < 5] = out[away < 5] * 0.82
        out[np.abs(away - 5) < 0.3] = out[np.abs(away - 5) < 0.3] * 0.86
        return out
    # Warm boards, each its own tone, running along the room.
    board = np.floor(y / 6.4)
    length = np.floor((x + board * 19) / 46)
    tone = value_noise(board * 3.3, length * 2.7)
    grain = value_noise(x * 0.18, y * 2.4)
    out = np.tile(colour("#b98a58"), (len(p), 1)) * (0.84 + tone[..., None] * 0.22 + grain[..., None] * 0.1)
    out[(y % 6.4) < 0.3] = out[(y % 6.4) < 0.3] * 0.72
    out[(((x + board * 19) % 46) < 0.3)] = out[(((x + board * 19) % 46) < 0.3)] * 0.72
    return out


def make_chunk(spec):
    name, column, row = spec
    room = ROOMS[name]
    left, top = column * CHUNK / DETAIL, row * CHUNK / DETAIL
    u = (np.arange(CHUNK) + 0.5) / DETAIL + left - room.ox
    v = (np.arange(CHUNK) + 0.5) / DETAIL + top - TOP_PAD
    uu, vv = np.meshgrid(u, v)
    p = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    image = np.tile(colour("#191614"), (CHUNK * CHUNK, 1))
    inside = (p[:, 0] > room.x0 - 6) & (p[:, 1] > room.y0 - 6) & (p[:, 0] < room.x1 + 6) & (p[:, 1] < room.y1 + 6)
    if inside.any():
        q = p[inside]
        out = lit(room, q + np.array([0, 0, 0.01]), np.tile(np.array([0, 0, 1.0]), (len(q), 1)), floor_paint(room, q))
        # The polished floor mirrors the windows, faintly.
        t = np.maximum(q[:, 0] - room.x0, 0)
        for a, b in room.windows:
            shine = (q[:, 1] - t > a * TILE + 2) & (q[:, 1] - t < b * TILE - 2) & (t > WIN_LOW) & (t < WIN_HIGH)
            out[shine] = out[shine] * 0.93 + colour("#eaf4fa") * 0.07
        image[inside] = out
    return (column, row), np.clip(image, 0, 255).astype(np.uint8).reshape(CHUNK, CHUNK, 3)


# -------------------------------------------------------------- each picture
WIDER = 4  # world's pixels of room round a tile's picture, for what stands out from the wall
def march(parts, room, base, far):
    """Where each ray lands on these shapes, in shaded colour, as a picture. parts are (shape, colour, glows)."""
    nearest = lambda p: np.minimum.reduce([part[0](p) for part in parts])
    t = np.full(len(base), far)
    hit = np.zeros(len(base), bool)
    live = np.arange(len(base))
    for _ in range(80):
        if not len(live):
            break
        d = nearest(base[live] + t[live, None])
        arrived = d < 0.03
        hit[live[arrived]] = True
        t[live] -= np.maximum(d, 0.03) / np.sqrt(3) * 0.9
        live = live[~arrived & (t[live] > -0.5)]
    at = np.nonzero(hit)[0]
    if not len(at):
        return None, None, None
    p = base[at] + t[at, None]
    which = np.argmin([part[0](p) for part in parts], axis=0)
    e = 0.05
    normal = np.stack([nearest(p + np.eye(3)[i] * e) - nearest(p - np.eye(3)[i] * e) for i in range(3)], axis=1)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    rgb = np.zeros((len(p), 3))
    for i, part in enumerate(parts):
        chosen = which == i
        if chosen.any():
            colours = part[1](p[chosen])
            rgb[chosen] = colours if part[2] else lit(room, p[chosen], normal[chosen], colours)
    return at, t, rgb


def picture_from(at, t, rgb, w, h):
    out = np.zeros((h, w, 4), np.uint8)
    depth = np.full(w * h, -1e6)
    depth[at] = t[at]
    depth = depth.reshape(h, w)
    edge = np.zeros((h, w), bool)
    for dy, dx in ((1, 0), (0, 1), (-1, 0), (0, -1)):
        edge |= (np.roll(depth, (dy, dx), (0, 1)) - depth > 2.2) & (depth > -1e5) & (np.roll(depth, (dy, dx), (0, 1)) > -1e5)
    ys, xs = at // w, at % w
    darker = edge[ys, xs]
    rgb[darker] = rgb[darker] * 0.55
    out[ys, xs, :3] = np.clip(rgb, 0, 255)
    out[ys, xs, 3] = 255
    return out


def render_tile(spec):
    name, tx, ty = spec
    room = ROOMS[name]
    letter = room.map[ty][tx]
    w, h = (32 + 2 * WIDER) * DETAIL, (CELL_H + WIDER) * DETAIL
    u = (np.arange(w) + 0.5) / DETAIL - 16 - WIDER + (tx - ty) * HW
    v = (np.arange(h) + 0.5) / DETAIL - CELL_H + (tx + ty) * HH + 16
    uu, vv = np.meshgrid(u, v)
    base = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    x0, y0 = tx * TILE, ty * TILE
    def clipped(field):
        return lambda p: np.maximum(field(room, p), np.maximum(np.maximum(x0 - p[:, 0], p[:, 0] - x0 - TILE), np.maximum(y0 - p[:, 1], p[:, 1] - y0 - TILE - (PROUD if ty == 1 else 0))))
    parts = [(clipped(part[0]), (lambda paint: lambda p: paint(room, p))(part[1]), part[2]) for part in parts_of(room) if letter in part[3]]
    if not parts:
        return spec, None
    at, t, rgb = march(parts, room, base, 70.0)
    if at is None:
        return spec, None
    out = picture_from(at, t, rgb, w, h)
    # Where a tile has only been cut off from the next one there's nothing to see: that one's picture has what's really there.
    whole = [part[0] for part in parts_of(room) if letter in part[3]]
    cut = np.abs(np.min([field(room, base[at] + t[at, None]) for field in whole], axis=0)) > 0.12
    out[(at // w)[cut], (at % w)[cut]] = 0
    if not out[:, :, 3].any():
        return spec, None
    rows, columns = np.nonzero(out[:, :, 3].any(axis=1))[0], np.nonzero(out[:, :, 3].any(axis=0))[0]
    picture, x1, y1 = on_whole_pixels(out, rows, columns)
    return spec, (picture, x1 - WIDER * DETAIL, y1)


# -------------------------------------------------------------- the chair
CHAIR_W, CHAIR_H = 28, 36
CHAIR_FOOT = 22  # how far down the picture the chair's middle stands on the floor
S = 4.8


def chair_seat(room, p):
    legs = [box(p, (a, b, 0), (a + 0.9, b + 0.9, 5.4)) for a in (-S + 0.2, S - 1.1) for b in (-S + 0.2, S - 1.1)]
    return np.minimum.reduce(legs + [box(p, (-S, -S, 5.4), (S, S, 6.8))])


def chair_back(room, p):
    return np.minimum.reduce([box(p, (-S, S - 0.9, 11), (S, S, 18)), box(p, (-S + 0.5, S - 0.8, 3), (-S + 1.5, S - 0.1, 11)), box(p, (S - 1.5, S - 0.8, 3), (S - 0.5, S - 0.1, 11))])


def chair_paint(room, p):
    x, z = p[:, 0], p[:, 2]
    out = tones(["#c8a06a", "#dcb880", "#ecd2a0"], 1 + value_noise(x * 0.7, z * 0.2 + p[:, 1] * 0.7) * 1.6)
    out[z < 5.4] = colour("#5e6668")
    out[(z < 11) & (z > 5.4) & (p[:, 1] > 2)] = colour("#5e6668")
    return out


def render_chair(part):
    w, h = CHAIR_W * DETAIL, CHAIR_H * DETAIL
    u = (np.arange(w) + 0.5) / DETAIL - CHAIR_W / 2
    v = (np.arange(h) + 0.5) / DETAIL - CHAIR_FOOT
    uu, vv = np.meshgrid(u, v)
    base = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    room = Room("lesson", 34, [(1, 2)], "", "", "#ffffff", "#ffffff", "boards", LESSON_BOARD)
    room.occluders = [((900, 900, 0), (901, 901, 1))]
    room.x0 = room.y0 = -200
    field = {"seat": chair_seat, "back": chair_back}[part]
    at, t, rgb = march([(lambda p: field(room, p), lambda p: chair_paint(room, p), False)], room, base, 60.0)
    return part, picture_from(at, t, rgb, w, h)


def make_room(pool, room):
    room.out.mkdir(parents=True, exist_ok=True)
    chunks = [(room.name, c, r) for r in range(int(np.ceil(room.world_h * DETAIL / CHUNK))) for c in range(int(np.ceil(room.world_w * DETAIL / CHUNK)))]
    letters = room.walls_at + room.low_at + "ET"
    tiles = [(room.name, x, y) for y in range(room.height) for x in range(room.width) if room.map[y][x] in letters]
    floor = dict(pool.map(make_chunk, chunks))
    pictures = [item for item in pool.map(render_tile, tiles) if item[1] is not None]
    # It all goes into the floor's pictures, drawn just once. A tile is only drawn again over someone behind it. The back walls never need to be.
    columns, rows = max(c for c, _ in floor) + 1, max(r for _, r in floor) + 1
    world = np.zeros((rows * CHUNK, columns * CHUNK, 3), np.uint8)
    for (column, row), image in floor.items():
        world[row * CHUNK:(row + 1) * CHUNK, column * CHUNK:(column + 1) * CHUNK] = image
    back = lambda item: item[0][1] < 2 or item[0][2] < 2
    pictures = sorted(pictures, key=lambda item: item[0][1] + item[0][2])
    where = lambda spec, ox, oy: (((spec[1] - spec[2]) * HW + room.ox - 16) * DETAIL + ox, ((spec[1] + spec[2]) * HH + TOP_PAD + 16 - CELL_H) * DETAIL + oy)
    for spec, (picture, ox, oy) in pictures:
        left, top = where(spec, ox, oy)
        ph, pw = picture.shape[:2]
        solid = picture[..., 3:] / 255
        world[top:top + ph, left:left + pw] = world[top:top + ph, left:left + pw] * (1 - solid) + picture[..., :3] * solid
    for column, row in floor:
        Image.fromarray(world[row * CHUNK:(row + 1) * CHUNK, column * CHUNK:(column + 1) * CHUNK], "RGB").save(room.out / f"ground-{column}-{row}.webp", quality=84, method=6)
    pictures = what_shows(pictures, world.shape[:2], where)
    pictures = [item for item in pictures if not back(item)]
    # All into one sheet, row after row, and where each one is.
    sheet_w = 2048
    pictures.sort(key=lambda item: -item[1][0].shape[0])
    x = y = row_h = 0
    places = {}
    for (_, tx, ty), (picture, ox, oy) in pictures:
        ph, pw = picture.shape[:2]
        if x + pw > sheet_w:
            x, y, row_h = 0, y + row_h, 0
        places[f"{tx},{ty}"] = [x, y, pw, ph, ox, oy]
        x, row_h = x + pw + SHEET_GAP, max(row_h, ph + SHEET_GAP)
    sheet = np.zeros((y + row_h, sheet_w, 4), np.uint8)
    for (_, tx, ty), (picture, _, _) in pictures:
        sx, sy, pw, ph, _, _ = places[f"{tx},{ty}"]
        sheet[sy:sy + ph, sx:sx + pw] = picture
    Image.fromarray(sheet, "RGBA").save(room.out / "fixtures.webp", quality=90, alpha_quality=100, method=6)
    print(room.name, len(chunks), "pieces of floor and", len(pictures), "tiles, sheet", sheet.shape)
    return places


def main():
    workers = int(sys.argv[1]) if sys.argv[1:] else 6
    made = {}
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for room in ROOMS.values():
            made[room.name] = make_room(pool, room)
        for part, picture in pool.map(render_chair, ("seat", "back")):
            Image.fromarray(picture, "RGBA").save(ROOT / "art/classroom" / f"chair-{part}.png", optimize=True)
    (ROOT / "art/classroom/fixtures.js").write_text(f"// Generated by tools/make_classrooms.py: where each tile's picture is on its room's sheet, and where it goes in its {CELL_H * DETAIL}-high cell.\nwindow.MAHTTE_CLASSROOMS = {json.dumps(made, separators=(',', ':'))};\n", encoding="utf-8")


if __name__ == "__main__":
    main()
