#!/usr/bin/env python3
"""Make the grocery store in 3D, into art/store/: the floor in pieces, and each tile's walls and fixtures, so that people can walk behind them.

Everything is lit together, so the sun through the windows falls across the floor and whatever stands in its way, and shelves shade each
other. Where the tiles of data/map.js decide what can be walked on, this only decides how it looks. The look follows a mock-up the user chose.

Usage: python3 tools/make_store.py
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art/store"
DETAIL = 4
TILE = 16
HW, HH, TOP_PAD, EDGE, MARGIN = 16, 8, 60, 10, 80  # as in src/world.js
CHUNK = 512  # picture pixels on a side, as the forest's
CELL_H = 64  # how high a tile's picture is, in the world's pixels
WALL_H = 44

_text = (ROOT / "data/map.js").read_text(encoding="utf-8")
MAP = json.loads(_text[_text.index("{"):_text.rindex("}") + 1])["store"]["rows"]
HEIGHT, WIDTH = len(MAP), len(MAP[0])
WORLD_W, WORLD_H = (WIDTH + HEIGHT) * HW + MARGIN * 2, (WIDTH + HEIGHT) * HH + TOP_PAD + EDGE + 60
OX = HEIGHT * HW + MARGIN
ROOM_X0, ROOM_Y0 = 2 * TILE, 2 * TILE
ROOM_X1, ROOM_Y1 = (WIDTH - 2) * TILE, (HEIGHT - 2) * TILE
DOOR_X = (36 * TILE, 39 * TILE)
SUN = np.array([-0.8, -0.52, 0.5])
SUN = SUN / np.linalg.norm(SUN)
ROOM_LIGHT = np.array([-0.5, 0.35, 0.8]) / np.linalg.norm([-0.5, 0.35, 0.8])
WIN_LOW, WIN_HIGH = 15, 39
# Along each back wall, as pairs of tile positions. Where the meat counter and the tall fridges stand, there are none.
WINDOWS_X = [(11, 14), (16, 19), (21, 24)]  # in the wall at the back left, along y
WINDOWS_Y = [(25, 29), (31, 35), (37, 41)]  # in the wall at the back right, along x


def box(p, low, high):
    low, high = np.asarray(low, float), np.asarray(high, float)
    q = np.abs(p - (low + high) / 2) - (high - low) / 2
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0)


def tones(names, level):
    return np.array([colour(c) for c in names])[np.clip(level.astype(int), 0, len(names) - 1)]


# ------------------------------------------------------------------ the walls
def window_hole_x(p):
    return np.minimum.reduce([box(p, (20, a * TILE + 2, WIN_LOW), (ROOM_X0 + 2, b * TILE - 2, WIN_HIGH)) for a, b in WINDOWS_X])


def window_hole_y(p):
    return np.minimum.reduce([box(p, (a * TILE + 2, 20, WIN_LOW), (b * TILE - 2, ROOM_Y0 + 2, WIN_HIGH)) for a, b in WINDOWS_Y])


def wall_x(p):
    return np.maximum(box(p, (ROOM_X0 - 5, ROOM_Y0 - 5, 0), (ROOM_X0, ROOM_Y1, WALL_H)), -window_hole_x(p))


def wall_y(p):
    return np.maximum(box(p, (ROOM_X0 - 5, ROOM_Y0 - 5, 0), (ROOM_X1, ROOM_Y0, WALL_H)), -window_hole_y(p))


def low_wall_y(p):
    near = box(p, (ROOM_X0 - 5, ROOM_Y1, 0), (ROOM_X1 + 5, ROOM_Y1 + 5, 8))
    return np.maximum(near, -box(p, (DOOR_X[0], ROOM_Y1 - 2, -2), (DOOR_X[1], ROOM_Y1 + 8, 20)))


def low_wall_x(p):
    return box(p, (ROOM_X1, ROOM_Y0 - 5, 0), (ROOM_X1 + 5, ROOM_Y1 + 5, 8))


def low_paint(p):
    out = tones(["#a89f88", "#c8bfa8"], np.ones(len(p)))
    out[p[:, 2] > 7.2] = colour("#f4eeda")
    return out


_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38)
_sign = Image.new("RGB", (320, 56), "#3f6b4f")
_draw = ImageDraw.Draw(_sign)
_draw.rectangle((0, 0, 319, 55), outline="#d8c070", width=4)
_draw.text((160, 28), "GÁVPI", font=_font, fill="#f4e8b8", anchor="mm")
SIGN = np.array(_sign)


def wall_paint(p, along):
    z = p[:, 2]
    grain = value_noise(along * 0.08, z * 0.08)
    out = np.tile(colour("#efe6cf"), (len(p), 1)) * (0.97 + grain[..., None] * 0.05)
    low = z < 13
    boards = tones(["#6f4a2a", "#8a6038", "#a37546"], value_noise(np.floor(along / 4) * 3.3, z * 0.05) * 3)
    out[low] = boards[low]
    out[low & (((along + 300) % 4) < 0.45)] = colour("#4f3219")
    out[(z >= 12.4) & (z < 14)] = colour("#c8a06a")
    out[z < 1.5] = colour("#4f3219")
    out[z > WALL_H - 2.2] = colour("#fbf7e8")
    return out


def wall_x_paint(p):
    out = wall_paint(p, p[:, 1])
    y, z = p[:, 1], p[:, 2]
    # Behind the butcher: white tiles up the wall, a steel rail of knives, a cleaver, a steel for sharpening, and hooks.
    tiled = (y > 4 * TILE) & (y < 14 * TILE) & (z >= 14) & (z < 37)
    out[tiled] = colour("#f2f2ec")
    out[tiled & ((((y + 300) % 4) < 0.25) | (((z + 40) % 4) < 0.25))] = colour("#c8ccc6")
    out[(y > 4 * TILE) & (y < 14 * TILE) & (np.abs(z - 37) < 0.5)] = colour("#7a2f3a")
    rail = (y > 5 * TILE) & (y < 9 * TILE) & (np.abs(z - 31) < 0.45)
    for i, (wide, long) in enumerate(((0.6, 7), (0.8, 8), (0.6, 6), (2, 6), (0.7, 7), (0.6, 5), (0.4, 8))):
        at = 5.3 * TILE + i * 7.6
        out[(np.abs(y - at) < wide) & (z < 30.6) & (z > 30.6 - long)] = colour("#c4cace")
        out[(np.abs(y - at) < 0.55) & (z >= 30.6) & (z < 33.4)] = colour("#23232a")
    out[rail] = colour("#7c8a94")
    for i in range(5):
        at = 9.5 * TILE + i * 6
        d = np.hypot(y - at, z - 31.6)
        out[(d < 1.3) & (d > 0.7) & (z < 31.6)] = colour("#7c8a94")
        out[(np.abs(y - at) < 0.3) & (z > 31.6) & (z < 34)] = colour("#7c8a94")
    out[window_hole_x(p) < 1.7] = colour("#f6f2e6")
    return out


def wall_y_paint(p):
    out = wall_paint(p, p[:, 0])
    x, z = p[:, 0], p[:, 2]
    front = p[:, 1] > ROOM_Y0 - 0.6
    # The sign over the tall fridges, a clock, and a notice board.
    u, v = (x - 9 * TILE) / (10 * TILE), (43 - z) / 12.6
    on = front & (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    out[on] = SIGN[(v[on] * 55.99).astype(int), (u[on] * 319.99).astype(int)]
    d = np.hypot(x - 22.5 * TILE, z - 34)
    out[front & (d < 5.6)] = colour("#3b2a1a")
    out[front & (d < 4.9)] = colour("#fbf7e8")
    angle = np.arctan2(x - 22.5 * TILE, z - 34)
    out[front & (d < 4.2) & (np.abs(angle - 0.55) < 0.12)] = colour("#1a1a1a")
    out[front & (d < 3) & (np.abs(angle + 1.4) < 0.18)] = colour("#1a1a1a")
    return out


def outdoors(p, along):
    z = p[:, 2]
    out = np.tile(colour("#dff2fb"), (len(p), 1))
    leaves = value_noise(along * 0.28, z * 0.5) > 0.42 + (z - 22) * 0.03
    out[leaves] = np.array([colour("#a4d68a"), colour("#c8e8a8")])[(value_noise(along * 0.9, z * 0.9) > 0.5).astype(int)][leaves]
    out[(np.abs(((along + 300) % 23) - 11) < 0.7) & (z < 34)] = colour("#f4f1e8")
    out[z < 19] = colour("#8dc06a")
    return out


def backdrop_x(p):
    return box(p, (19, 0, 0), (21, HEIGHT * TILE, WIN_HIGH + 3))


def backdrop_y(p):
    return box(p, (0, 19, 0), (WIDTH * TILE, 21, WIN_HIGH + 3))


def bars_x(p):
    d = []
    for a, b in WINDOWS_X:
        mid = (a + b) * TILE / 2
        d += [box(p, (ROOM_X0 - 4, mid - 0.8, WIN_LOW), (ROOM_X0 - 2, mid + 0.8, WIN_HIGH)), box(p, (ROOM_X0 - 4, a * TILE, 26), (ROOM_X0 - 2, b * TILE, 27.4))]
    return np.minimum.reduce(d)


def bars_y(p):
    d = []
    for a, b in WINDOWS_Y:
        mid = (a + b) * TILE / 2
        d += [box(p, (mid - 0.8, ROOM_Y0 - 4, WIN_LOW), (mid + 0.8, ROOM_Y0 - 2, WIN_HIGH)), box(p, (a * TILE, ROOM_Y0 - 4, 26), (b * TILE, ROOM_Y0 - 2, 27.4))]
    return np.minimum.reduce(d)


white = lambda p: np.tile(colour("#f6f2e6"), (len(p), 1))


# --------------------------------------------------------------- the fixtures
def runs_of(tile):
    """Each fixture's tiles along its rows, as boxes in tile positions."""
    found = []
    for y, row in enumerate(MAP):
        x = 0
        while x < WIDTH:
            if row[x] == tile:
                start = x
                while x < WIDTH and row[x] == tile:
                    x += 1
                found.append((start, x, y))
            else:
                x += 1
    return found


FOODS = ["#d13a30", "#f2c630", "#3a9a48", "#2f6fc2", "#e08a2e", "#eeeee6", "#7a4a2a", "#c95a8a", "#5a8fc2"]
SHELF_RUNS = runs_of("S")
SHELF_H = 20
ROWS_AT = (1.6, 7.8, 14)  # the shelf boards' heights


def shelf_boxes():
    return [((a * TILE, y * TILE + 2, 0), (b * TILE, (y + 1) * TILE - 2, SHELF_H)) for a, b, y in SHELF_RUNS]


def shelf_body(p):
    """A middle wall, with boards standing out on both sides and a top."""
    d = []
    for a, b, y in SHELF_RUNS:
        x0, x1, y0, y1 = a * TILE, b * TILE, y * TILE + 2, (y + 1) * TILE - 2
        d.append(box(p, (x0, y0 + 4, 0), (x1, y1 - 4, SHELF_H)))
        d.append(box(p, (x0, y0, SHELF_H - 1.2), (x1, y1, SHELF_H)))
        d.append(box(p, (x0, y0 - 0.5, 0), (x1, y1 + 0.5, 1.2)))
        for z in ROWS_AT[1:]:
            d.append(box(p, (x0, y0, z - 0.7), (x1, y1, z)))
        for end in (x0, x1 - 1):
            d.append(box(p, (end, y0, 0), (end + 1, y1, SHELF_H)))
    return np.minimum.reduce(d)


def shelf_body_paint(p):
    """Pale painted steel, with a white price strip along the front of each board and a coloured band across the top."""
    z = p[:, 2]
    out = tones(["#b8bcbc", "#d4d7d4", "#e6e8e4"], 1 + value_noise(p[:, 0] * 0.2, z * 0.2) * 1.2)
    edge = np.abs(np.abs(((p[:, 1] + 300) % TILE) - TILE / 2) - 6) < 0.6
    strip = edge & (z < SHELF_H - 0.6)
    out[strip] = colour("#f8f6ee")
    # Prices on the strip.
    tag = strip & (((p[:, 0] + 300) % 6.5) < 1.3)
    out[tag] = colour("#f2d15c")
    out[z > SHELF_H - 1.2] = colour("#3f6b4f")
    out[z < 1.2] = colour("#5e6668")
    return out


# What each stretch of shelf holds: tall packets, cans, bottles or soft bags, in the colours such things come in.
GOODS = [
    ("box", ["#e8c23a", "#d13a30", "#2f6fc2", "#e08a2e", "#3a9a48"]),  # cereals and biscuits
    ("can", ["#c8ccd0", "#d13a30", "#3a78d6", "#2f8a4e", "#e8c23a"]),
    ("bottle", ["#7a3a1e", "#2f8a4e", "#c8a23a", "#a8d0e0", "#8e1f22"]),
    ("bag", ["#f0e8d0", "#d8b878", "#c96a3a", "#eeeee6", "#7fa8c8"]),
    ("box", ["#8a4a9a", "#f4f1e8", "#e8604c", "#3a5a8a", "#c8a23a"]),
    ("can", ["#f2c630", "#e08a2e", "#a0382e", "#5a8a3a", "#eeeee6"]),
]


def goods_cell(p):
    x = p[:, 0]
    row = np.clip(np.floor((p[:, 2] - ROWS_AT[0]) / 6.2), 0, 2)
    run = np.floor(x / 12 + row * 0.37)
    kind = np.floor(value_noise(np.floor(x / 48) * 7.1, row * 3.3 + 2) * len(GOODS)).astype(int) % len(GOODS)
    wide = np.array([3.6, 2.9, 2.5, 4.2, 3.6, 2.9])[kind]
    high = np.array([4.9, 3.2, 4.9, 3.6, 4.9, 3.2])[kind] - value_noise(run * 5.1, row * 2.2) * 0.8
    return run, row, kind, wide, high


def shelf_goods(p):
    """Rows of real shapes standing on the boards, two deep, so that they catch the light and each other's shade."""
    in_box = np.minimum.reduce([box(p, low, (high[0] - 1, high[1], high[2] - 1.3)) for low, high in shelf_boxes()])
    run, row, kind, wide, high = goods_cell(p)
    z = p[:, 2]
    base = ROWS_AT[0] + row * 6.2
    up = np.clip((z - base) / high, 0, 1)
    qx = ((p[:, 0] + 300) % wide) - wide / 2
    half = wide / 2 - 0.3
    bottle = np.isin(kind, (2,))
    bag = np.isin(kind, (3,))
    # A bottle narrows to its neck, and a bag sags at the shoulders.
    half = np.where(bottle & (up > 0.58), np.maximum(half * (1 - (up - 0.58) * 2), 0.32), half)
    half = np.where(bag, half * (1 - (up > 0.72) * (up - 0.72) * 1.2), half)
    centre_y = np.floor(p[:, 1] / TILE) * TILE + TILE / 2
    qy = np.abs(np.abs(p[:, 1] - centre_y) - 4.7)
    qz = np.abs(z - base - high / 2)
    q = np.stack([np.maximum(np.abs(qx) - half, 0), np.maximum(qy - 1.4, 0), np.maximum(qz - high / 2, 0)], axis=1)
    return np.maximum(np.linalg.norm(q, axis=1) - 0.1, in_box)


def shelf_goods_paint(p):
    run, row, kind, wide, high = goods_cell(p)
    z = p[:, 2]
    base = ROWS_AT[0] + row * 6.2
    up = np.clip((z - base) / high, 0, 1)
    pick = (value_noise(run * 3.7, row * 5.3) * 4.99).astype(int)
    table = np.array([[colour(c) for c in tones_] for _, tones_ in GOODS])
    out = table[kind, np.clip(pick, 0, 4)].astype(float)
    qx = ((p[:, 0] + 300) % wide) - wide / 2
    across = np.abs(qx) / (wide / 2)
    # Labels: a pale panel and a mark on most, and a cap on a bottle, and the round of a can darkening to its edges.
    panel = (np.abs(up - 0.45) < 0.2)
    is_box, is_can, is_bottle, is_bag = np.isin(kind, (0, 4)), np.isin(kind, (1, 5)), kind == 2, kind == 3
    out[panel & is_box] = colour("#f6f2e6")
    out[panel & is_box & (across < 0.42)] = table[kind, (pick + 2) % 5][panel & is_box & (across < 0.42)]
    out[is_can & (up > 0.9)] = colour("#d8dcde")
    out[is_can & (np.abs(up - 0.5) < 0.24)] = colour("#f6f2e6")
    out[is_bottle & (up > 0.88)] = colour("#d13a30")
    out[is_bottle & (np.abs(up - 0.34) < 0.17)] = colour("#f6f2e6")
    out[is_bag & (up > 0.84)] = out[is_bag & (up > 0.84)] * 0.8
    out[is_bag & (np.abs(up - 0.45) < 0.14) & (across < 0.6)] = colour("#d13a30")
    return out * (1 - np.where(is_can | is_bottle, 0.28, 0.08)[..., None] * (across ** 2)[..., None])


FRIDGES = runs_of("R")
FRIDGE_H = 30


FREEZERS = runs_of("Z")
# A cabinet is made in two layers with the food drawn between them: what's inside, and the frame and the glass in front. Must match
# STORE_SHOW in src/world.js.
FRIDGE_FRONT = 15  # how far a fridge reaches, from the back of its tile
GLASS_AT = FRIDGE_FRONT - 1.4
FRIDGE_FLOOR, FRIDGE_SHELF = 3.0, 8.0
FRIDGE_END = 1.2  # how thick the panel at each end of a row is


def into_row(p):
    """How far a point is from the back of its row of cabinets, going on past the front."""
    rows = np.array(sorted({row for _, _, row in FRIDGES + FREEZERS}))
    return p[:, 1] - rows[np.argmin(np.abs(p[:, 1][..., None] - (rows + 0.5) * TILE), axis=1)] * TILE


def fridge_cell(p):
    door = np.floor(p[:, 0] / TILE).astype(int) % 4
    row = np.clip(np.floor((p[:, 2] - FRIDGE_FLOOR) / FRIDGE_SHELF), 0, 2)
    return door, row, np.floor(p[:, 0] / 3.3)


def fridge_goods(p):
    """Goods in rows going back into the cabinet: cartons, blocks, bottles and pots."""
    door, row, cell = fridge_cell(p)
    y = into_row(p)
    tall = np.array([6.4, 3.0, 5.8, 3.4])[door] - value_noise(cell * 3.1, row * 2.3) * 0.7
    z = p[:, 2] - (FRIDGE_FLOOR + row * FRIDGE_SHELF)
    qx = np.abs(((p[:, 0] + 300) % 3.3) - 1.65) - 1.25
    qy = np.abs(((y + 300) % 3.4) - 1.7) - 1.3
    qz = np.abs(z - tall / 2) - tall / 2
    q = np.stack([np.maximum(qx, 0), np.maximum(qy, 0), np.maximum(qz, 0)], axis=1)
    return np.maximum(np.linalg.norm(q, axis=1) - 0.14, np.maximum(4.6 - y, y - 13))


def fridge_inside(p):
    y = into_row(p)
    door = np.minimum(p[:, 0] % TILE, TILE - p[:, 0] % TILE)  # how far from the partition between doors
    # Solid but for the hollow of the cabinet.
    shell = np.minimum.reduce([y - 2, p[:, 2] - FRIDGE_FLOOR, FRIDGE_H - 1.6 - p[:, 2]])
    within = np.maximum(np.maximum(-y, y - FRIDGE_FRONT), np.maximum(-p[:, 2], p[:, 2] - FRIDGE_H))
    cabinet = np.maximum(shell, within)
    side = np.maximum(door - 0.5, within)
    shelves = [box(np.stack([p[:, 0], y, p[:, 2]], axis=1), (-1000, 2, FRIDGE_FLOOR + r * FRIDGE_SHELF - 0.35), (2000, GLASS_AT - 0.4, FRIDGE_FLOOR + r * FRIDGE_SHELF)) for r in (1, 2)]
    return np.minimum.reduce([cabinet, side, fridge_goods(p)] + shelves)


def fridge_inside_paint(p):
    x, z = p[:, 0], p[:, 2]
    y = into_row(p)
    out = np.tile(colour("#dbe9ee"), (len(p), 1))
    door, row, cell = fridge_cell(p)
    within = z - (FRIDGE_FLOOR + row * FRIDGE_SHELF)
    goods = fridge_goods(p) < 0.1
    table = np.array([[colour(c) for c in ("#f6f4ec", "#f6f4ec", "#2f6fc2", "#f6f4ec")],
                      [colour(c) for c in ("#f2d765", "#f2c94e", "#f4e8a8", "#e8b83a")],
                      [colour(c) for c in ("#ee8a2e", "#f2c630", "#d13a30", "#7fb83a")],
                      [colour(c) for c in ("#f4f1e8", "#e8a0b8", "#a8c8e8", "#d8e8a8")]])
    pick = np.clip((value_noise(cell * 1.9, row * 5.3 + np.floor(y / 3.4)) * 3.99).astype(int), 0, 3)
    fill = table[door, pick].astype(float)
    fill[(door == 0) & (within > 1.8) & (within < 3.6)] = colour("#2f6fc2")
    fill[(door == 2) & (within > 2.8) & (within < 4)] = colour("#f6f4ec")
    out[goods] = fill[goods]
    out[(within < 0.05) & ~goods] = colour("#b6ced8")
    # Lit by strips at the top of each shelf, and fading into the depth.
    depth = np.clip((y - 2) / (GLASS_AT - 2), 0, 1)
    return out * ((0.66 + 0.42 * depth) * (0.92 + 0.26 * np.clip(within / FRIDGE_SHELF, 0, 1)))[..., None]


def fridge_front(p):
    y = into_row(p)
    door = np.minimum(p[:, 0] % TILE, TILE - p[:, 0] % TILE)
    q = np.stack([p[:, 0], y, p[:, 2]], axis=1)
    d = [box(q, (-1000, GLASS_AT, 0), (2000, FRIDGE_FRONT, FRIDGE_FLOOR - 0.2)), box(q, (-1000, GLASS_AT, FRIDGE_H - 3.2), (2000, FRIDGE_FRONT, FRIDGE_H)), box(q, (-1000, 0, FRIDGE_H - 1.6), (2000, FRIDGE_FRONT, FRIDGE_H))]
    d.append(np.maximum(door - 0.55, np.maximum(np.maximum(GLASS_AT - y, y - FRIDGE_FRONT), np.maximum(-p[:, 2], p[:, 2] - FRIDGE_H))))
    handle = p[:, 0] % TILE
    d.append(box(np.stack([handle, y, p[:, 2]], axis=1), (13, FRIDGE_FRONT, 12), (13.7, FRIDGE_FRONT + 0.6, 21)))
    # A solid panel closing each end of a row, inside its last tile, so the food doesn't show through the end.
    for a, b, row in FRIDGES:
        d.append(box(p, (a * TILE, row * TILE, 0), (a * TILE + FRIDGE_END, row * TILE + FRIDGE_FRONT, FRIDGE_H)))
        d.append(box(p, (b * TILE - FRIDGE_END, row * TILE, 0), (b * TILE, row * TILE + FRIDGE_FRONT, FRIDGE_H)))
    return np.minimum.reduce(d)


def fridge_front_paint(p):
    x, z = p[:, 0], p[:, 2]
    y = into_row(p)
    out = np.tile(colour("#39424a"), (len(p), 1))
    out[z > FRIDGE_H - 1.7] = colour("#dfe3e4")
    out[y > FRIDGE_FRONT + 0.05] = colour("#c8ced3")
    out[(z > FRIDGE_H - 3.1) & (z < FRIDGE_H - 1.7) & (y > GLASS_AT)] = colour("#3f6b4f")
    # The ends' outer sides, pale like the top, with the dark frame round their front edge.
    for a, b, row in FRIDGES:
        at_end = (np.abs(p[:, 1] - row * TILE - FRIDGE_FRONT / 2) < FRIDGE_FRONT / 2) & ((x < a * TILE + 0.05) | (x > b * TILE - 0.05))
        out[at_end & (y < FRIDGE_FRONT - 0.8) & (z < FRIDGE_H - 1.7)] = colour("#c8ced3")
    return out


def fridge_glass(base, x0, y0):
    """How thick the glass of a door looks, at each ray: long reflections, and mist along the bottom and at the sides."""
    q = base + (y0 + GLASS_AT + 0.1 - base[:, 1])[..., None]
    x, z = q[:, 0], q[:, 2]
    on = (x > x0) & (x < x0 + TILE) & (z > FRIDGE_FLOOR - 0.2) & (z < FRIDGE_H - 3.2)
    door = x - x0
    streak = np.exp(-(((door - 4 - (z - 3) * 0.26) / 0.8) ** 2)) * 0.2 + np.exp(-(((door - 7.2 - (z - 3) * 0.26) / 0.3) ** 2)) * 0.14
    mist = np.exp(-np.maximum(z - FRIDGE_FLOOR, 0) / 2.6) * 0.34 + np.exp(-np.minimum(door, TILE - door) / 1) * 0.12
    mist = mist * (0.72 + 0.56 * value_noise(x * 0.7, z * 0.7))
    return on, np.clip(0.05 + streak + mist, 0, 0.7), (226, 243, 250)


FREEZER_H = 11


TUB_WALL, TUB_FLOOR = 1.3, 2.5


def freezer_packets(p):
    """A bed of frozen packets, heaped unevenly."""
    y = into_row(p)
    cx, cy = np.floor(p[:, 0] / 5.2), np.floor(y / 4.3)
    rise = value_noise(cx * 3.1, cy * 2.7 + np.floor(p[:, 1] / TILE)) * 2.2
    qx = np.abs(((p[:, 0] + 300) % 5.2) - 2.6) - 2.3
    qy = np.abs(((y + 300) % 4.3) - 2.15) - 1.85
    qz = np.abs(p[:, 2] - TUB_FLOOR - rise / 2 - 0.3) - (rise / 2 + 0.3)
    q = np.stack([np.maximum(qx, 0), np.maximum(qy, 0), np.maximum(qz, 0)], axis=1)
    return np.maximum(np.linalg.norm(q, axis=1) - 0.15, np.maximum(1 + TUB_WALL + 0.6 - y, y - TILE + 2))


def freezer_inside(p):
    y = into_row(p)
    q = np.stack([p[:, 0], y, p[:, 2]], axis=1)
    d = [box(q, (-1000, 1, 0), (2000, TILE - 1, TUB_FLOOR)), box(q, (-1000, 1, 0), (2000, 1 + TUB_WALL, FREEZER_H)), freezer_packets(p)]
    for a, b, row in FREEZERS:
        d.append(box(p, (a * TILE, row * TILE + 1, 0), (a * TILE + TUB_WALL, row * TILE + TILE - 1, FREEZER_H)))
    return np.minimum.reduce(d)


def freezer_inside_paint(p):
    x, z = p[:, 0], p[:, 2]
    y = into_row(p)
    out = np.tile(colour("#e6f1f6"), (len(p), 1)) * (0.92 + value_noise(x * 2.4, (y + z) * 2.4)[..., None] * 0.12)
    packet = freezer_packets(p) < 0.1
    cx, cy = np.floor(x / 5.2), np.floor(y / 4.3)
    table = np.array([colour(c) for c in ("#3a78d6", "#e8604c", "#f2c630", "#7fc27f", "#f4f1e8", "#b890d8", "#9fd0ea", "#c8372d")])
    fill = table[np.clip((value_noise(cx * 3.1, cy * 5.7) * 7.99).astype(int), 0, 7)]
    frost = (0.3 + 0.3 * np.clip(1 - y / TILE, 0, 1) + 0.25 * value_noise(x * 2.2, y * 2.2))[..., None]
    out[packet] = (fill * (1 - frost) + colour("#e6f4fa") * frost)[packet]
    return out * (0.82 + 0.26 * np.clip(z / FREEZER_H, 0, 1))[..., None]


def freezer_front(p):
    y = into_row(p)
    q = np.stack([p[:, 0], y, p[:, 2]], axis=1)
    near = box(q, (-1000, TILE - 1 - TUB_WALL, 0), (2000, TILE - 1, FREEZER_H))
    rim = box(q, (-1000, 0.8, FREEZER_H - 0.5), (2000, TILE - 0.8, FREEZER_H))
    hole = box(q, (-1000, 1 + TUB_WALL, FREEZER_H - 3), (2000, TILE - 1 - TUB_WALL, FREEZER_H + 3))
    d = [near, rim]
    for a, b, row in FREEZERS:
        d.append(box(p, (b * TILE - TUB_WALL, row * TILE + 1, 0), (b * TILE, row * TILE + TILE - 1, FREEZER_H)))
    # A rail between the sliding lids, at every second tile.
    rail = box(np.stack([np.abs((p[:, 0] + TILE) % (2 * TILE) - TILE), y, p[:, 2]], axis=1), (-0.4, 1, FREEZER_H - 0.3), (0.4, TILE - 1, FREEZER_H + 0.4))
    return np.minimum(np.maximum(np.minimum.reduce(d), -hole), rail)


def freezer_front_paint(p):
    z = p[:, 2]
    out = np.tile(colour("#e8ecec"), (len(p), 1))
    out[(z > 3.2) & (z < 6)] = colour("#3a8fd0")
    out[z < 1.2] = colour("#6d7780")
    out[z > FREEZER_H - 0.6] = colour("#c8ced3")
    return out


def freezer_glass(base, x0, y0):
    """The lid: reflections of the lamps, and frost creeping in from its edges."""
    q = base + (FREEZER_H - 0.25 - base[:, 2])[..., None]
    x, y = q[:, 0], q[:, 1] - y0
    on = (x > x0) & (x < x0 + TILE) & (y > 1 + TUB_WALL) & (y < TILE - 1 - TUB_WALL)
    rail = np.abs((x + TILE) % (2 * TILE) - TILE)
    edge = np.minimum.reduce([y - 1 - TUB_WALL, TILE - 1 - TUB_WALL - y, rail])
    frost = np.exp(-np.maximum(edge, 0) / 1.1) * (0.3 + 0.5 * value_noise(x * 1.5, y * 1.5))
    band = np.exp(-((((x + y * 0.55) % 64 - 26) / 3) ** 2)) * 0.18 + np.exp(-((((x + y * 0.55) % 64 - 58) / 1.5) ** 2)) * 0.14
    return on, np.clip(0.05 + frost + band, 0, 0.8), (232, 245, 251)


GLASS = {"r": fridge_glass, "z": freezer_glass}


CRATES = runs_of("P")
CRATE_H = 7.5


def crate_body(p):
    d = []
    for a, b, y in CRATES:
        d.append(box(p, (a * TILE, y * TILE + 1, 0), (b * TILE, (y + 1) * TILE - 1, CRATE_H)))
    return np.minimum.reduce(d)


def crate_paint(p):
    """Rough wooden slats, darker between them, with a small card for the price on each second crate."""
    out = tones(["#7a5430", "#a37546", "#c29a64"], 1 + (((p[:, 2] + 40) % 2.6) > 0.5) * (0.8 + value_noise(p[:, 0] * 0.5, p[:, 2]) * 0.9))
    out[((p[:, 0] + 300) % 16) < 0.7] = colour("#5e3e20")
    front = (p[:, 1] % TILE) > 14.6
    card = front & (np.abs(((p[:, 0] + 300) % 32) - 16) < 2.6) & (np.abs(p[:, 2] - 5) < 1.4)
    out[card] = colour("#f8f6ee")
    out[card & (np.abs(p[:, 2] - 5) < 0.4)] = colour("#d13a30")
    return out


def pallet_body(p):
    """A wooden pallet with cardboard boxes stacked on it in layers, each box a little out of line."""
    d = [box(p, (30 * TILE + 1, 24 * TILE + 1, 0), (32 * TILE - 1, 26 * TILE - 1, 1.2)), box(p, (30 * TILE + 1, 24 * TILE + 1, 1.8), (32 * TILE - 1, 26 * TILE - 1, 2.6))]
    for layer in range(3):
        for i in range(2):
            for j in range(2):
                nudge = ((i * 3 + j * 5 + layer * 2) % 3 - 1) * 0.5
                x, y = 30 * TILE + 1.6 + i * 14.6 + nudge, 24 * TILE + 1.6 + j * 14.6 - nudge
                d.append(box(p, (x, y, 2.6 + layer * 4.2), (x + 14, y + 14, 6.6 + layer * 4.2)))
    return np.minimum.reduce(d)


def pallet_paint(p):
    z = p[:, 2]
    out = tones(["#b08a58", "#c9a06e", "#dcb684"], 1 + value_noise(p[:, 0] * 0.3, z * 0.6) * 1.4)
    out[z < 2.6] = tones(["#7a5430", "#a37546"], np.ones(len(p)))[z < 2.6]
    # Tape across each box, and a printed egg on its side.
    u = (p[:, 0] + p[:, 1] + 400) % 14.6
    box_z = (z - 2.6) % 4.2
    cardboard = z >= 2.6
    out[cardboard & (box_z < 0.28)] = colour("#7e6038")
    out[cardboard & (z > 14.8) & (np.abs(u - 7.3) < 0.9)] = colour("#e0c080")
    egg = cardboard & (((u - 7.3) / 1.4) ** 2 + ((box_z - 2.1) / 1.5) ** 2 < 1) & (z <= 14.8)
    out[egg] = colour("#f6eedd")
    return out


PALLETS = [((30 * TILE + 1, 24 * TILE + 1, 0), (32 * TILE - 1, 26 * TILE - 1, 15.2))]
COUNTERS = runs_of("C")
COUNTER_H = 11


COUNTER_ROWS = sorted({x for _, y_row in enumerate(MAP) for x, tile in enumerate(y_row) if tile == "C"})


def counter_body(p):
    """Each checkout is one counter, down its column."""
    d = []
    for x in COUNTER_ROWS:
        ys = [y for y, row in enumerate(MAP) if row[x] == "C"]
        d.append(box(p, (x * TILE + 1, min(ys) * TILE, 0), ((x + 1) * TILE - 1, (max(ys) + 1) * TILE, COUNTER_H)))
    return np.minimum.reduce(d)


def counter_paint(p):
    out = tones(["#58626c", "#747f8a", "#9aa5b0"], np.ones(len(p)) + value_noise(p[:, 0] * 0.2, p[:, 2] * 0.2))
    out[p[:, 2] > COUNTER_H - 0.9] = colour("#c8ced3")
    out[(p[:, 2] > 8) & (p[:, 2] < 9.2)] = colour("#3f6b4f")
    out[p[:, 2] < 1] = colour("#3a4148")
    return out


MEATS = runs_of("M")
MEAT_H = 11


GATE = (2 * TILE, 14 * TILE)


def gate_body(p):
    """A swing gate into the butcher's place: a post at the wall, and a low steel door with bars."""
    x, y = GATE
    d = [box(p, (x + 1, y + 7, 0), (x + 2.6, y + 9, 14)), box(p, (x + 14, y + 7, 0), (x + 15.6, y + 9, 14))]
    d += [box(p, (x + 2.6, y + 7.5, z), (x + 14, y + 8.5, z + 1)) for z in (3, 7, 11.4)]
    d += [box(p, (a, y + 7.6, 3), (a + 0.8, y + 8.4, 11.6)) for a in (x + 5, x + 8, x + 11)]
    return np.minimum.reduce(d)


def gate_paint(p):
    out = np.tile(colour("#aeb6bd"), (len(p), 1))
    out[p[:, 2] > 13] = colour("#d8dde0")
    x = GATE[0]
    out[(p[:, 0] < x + 2.7) | (p[:, 0] > x + 13.9)] = colour("#5e6668")
    return out


BARRIER_Y = 27 * TILE
BARRIER_H = 10


def barrier_body(p):
    """A steel barrier: posts at each tile's edge and two rails along it, so that the store can be seen through it."""
    q = np.abs((p[:, 0] + TILE / 2) % TILE - TILE / 2)  # how far from the nearest post
    y = np.abs(p[:, 1] - BARRIER_Y - 8)
    post = np.maximum.reduce([q - 0.8, y - 0.8, -p[:, 2], p[:, 2] - BARRIER_H])
    rails = [np.maximum(y - 0.5, np.abs(p[:, 2] - z) - 0.5) for z in (5, BARRIER_H - 0.5)]
    return np.minimum.reduce([post] + rails)


def barrier_paint(p):
    out = np.tile(colour("#aeb6bd"), (len(p), 1))
    out[p[:, 2] > BARRIER_H - 1] = colour("#3f6b4f")
    out[p[:, 2] < 1] = colour("#5e6668")
    return out


def butcher_things():
    """What the butcher works with, each with its colours: scales, a block of knives, a roll of paper, and a steel."""
    top = MEAT_H
    x3, x2, y4, y12 = 3 * TILE, 2 * TILE, 4 * TILE, 14 * TILE
    flat_tone = lambda text: (lambda p: np.tile(colour(text), (len(p), 1)))
    def scale_paint(p):
        out = np.tile(colour("#e6e8e4"), (len(p), 1))
        out[p[:, 2] > top + 3] = colour("#c8ced3")
        window = (p[:, 1] > y4 + 12.2) & (p[:, 2] > top + 0.6) & (p[:, 2] < top + 2.2) & (np.abs(p[:, 0] - x3 - 8) < 2.6)
        out[window] = colour("#7fd6a0")
        return out
    def block_paint(p):
        out = tones(["#6a4426", "#8a5c34", "#a37546"], 1 + value_noise(p[:, 0] * 2, p[:, 2] * 0.6) * 1.6)
        out[p[:, 2] > top + 6.6] = colour("#23232a")
        return out
    things = [
        (lambda p: box(p, (x3 + 3.5, y4 + 5, top), (x3 + 12.5, y4 + 12, top + 3)), scale_paint),
        (lambda p: box(p, (x3 + 4.5, y4 + 5.5, top + 3), (x3 + 11.5, y4 + 11.5, top + 3.6)), flat_tone("#d8dde0")),
        (lambda p: box(p, (x2 + 4, y4 + 6, top), (x2 + 10, y4 + 12, top + 6.6)), block_paint),
    ]
    things += [(lambda p, a=a, b=b: box(p, (x2 + a, y4 + b, top + 6.6), (x2 + a + 1, y4 + b + 1, top + 9.2)), block_paint) for a in (4.8, 6.6, 8.4) for b in (7, 9.6)]
    def roll(p):
        return np.maximum(np.hypot(p[:, 1] - (y12 + 8), p[:, 2] - (top + 2.4)) - 2.4, np.abs(p[:, 0] - x3 - 8) - 6)
    def roll_paint(p):
        out = tones(["#d8c9a8", "#ece0c4"], np.ones(len(p)))
        out[np.abs(np.abs(p[:, 0] - x3 - 8) - 6) < 0.3] = colour("#9a8a6a")
        return out
    things.append((roll, roll_paint))
    return things


def butcher_body(p):
    return np.minimum.reduce([field(p) for field, _ in butcher_things()])


def butcher_paint(p):
    things = butcher_things()
    nearest = np.argmin([field(p) for field, _ in things], axis=0)
    out = np.zeros((len(p), 3))
    for i, (_, paint) in enumerate(things):
        chosen = nearest == i
        if chosen.any():
            out[chosen] = paint(p[chosen])
    return out


def meat_body(p):
    # All one counter: the long side goes down the column, or each tile would have a wall of its own to show when it's drawn again.
    d = [box(p, (3 * TILE, 4 * TILE, 0), (4 * TILE, 15 * TILE, MEAT_H))]
    for a, b, y in MEATS:
        d.append(box(p, (a * TILE, y * TILE, 0), (b * TILE, (y + 1) * TILE, MEAT_H)))
    return np.minimum.reduce(d)


def meat_paint(p):
    """A counter with a lit glass front over the cuts laid out on ice, and steel below."""
    z = p[:, 2]
    out = np.tile(colour("#dfe6e8"), (len(p), 1))
    glass = (z > 3.5) & (z < 10)
    cell = np.floor((p[:, 0] + p[:, 1]) / 3.4)
    table = np.array([colour(c) for c in ("#b84a40", "#d97a70", "#a83a32", "#e8a090", "#f0e4d4")])
    out[glass] = (table[np.clip((value_noise(cell * 3.3, np.floor(z / 2.2)) * 4.99).astype(int), 0, 4)] * 0.78 + colour("#e4f6ff") * 0.22)[glass]
    out[(z > 1.6) & (z < 3)] = colour("#c8372d")
    out[z < 1] = colour("#6d7780")
    out[z > MEAT_H - 0.8] = colour("#f4f6f7")
    return out


# Each part: how far away, what colour, whether it gives its own light, and the tile letters it's part of.
PARTS = [
    (shelf_body, shelf_body_paint, False, "S"), (shelf_goods, shelf_goods_paint, False, "S"), (fridge_inside, fridge_inside_paint, "inside", "R"), (fridge_front, fridge_front_paint, False, "r"), (freezer_inside, freezer_inside_paint, "inside", "Z"), (freezer_front, freezer_front_paint, False, "z"),
    (crate_body, crate_paint, False, "P"), (counter_body, counter_paint, False, "C"), (meat_body, meat_paint, False, "M"),
    (wall_x, wall_x_paint, False, "W"), (wall_y, wall_y_paint, False, "W"), (bars_x, white, False, "W"), (bars_y, white, False, "W"),
    (backdrop_x, lambda p: outdoors(p, p[:, 1]), True, "W"), (backdrop_y, lambda p: outdoors(p, p[:, 0]), True, "W"),
    (low_wall_y, low_paint, False, "X"), (low_wall_x, low_paint, False, "X"), (pallet_body, pallet_paint, False, "e"),
    (butcher_body, butcher_paint, False, "M"), (gate_body, gate_paint, False, "Q"), (barrier_body, barrier_paint, False, "v"),
]
OCCLUDERS = PALLETS + shelf_boxes() + [((a * TILE, y * TILE, 0), (b * TILE, (y + 1) * TILE - 1, FRIDGE_H)) for a, b, y in FRIDGES] + \
    [((a * TILE, y * TILE + 1, 0), (b * TILE, (y + 1) * TILE - 1, FREEZER_H)) for a, b, y in FREEZERS] + \
    [((a * TILE, y * TILE + 1, 0), (b * TILE, (y + 1) * TILE - 1, CRATE_H + 2)) for a, b, y in CRATES] + \
    [((a * TILE, y * TILE + 1, 0), (b * TILE, (y + 1) * TILE - 1, COUNTER_H)) for a, b, y in COUNTERS] + \
    [((a * TILE, y * TILE, 0), (b * TILE, (y + 1) * TILE, MEAT_H)) for a, b, y in MEATS]


def occluders(p):
    return np.minimum.reduce([box(p, low, high) for low, high in OCCLUDERS])


def through_a_window(p):
    """Back along the sun's rays, whether a point reaches a pane in either window wall."""
    lit = np.zeros(len(p), bool)
    # The wall at the back left.
    t = np.maximum(p[:, 0] - ROOM_X0, 0) / -SUN[0]
    y, z = p[:, 1] + SUN[1] * t, p[:, 2] + SUN[2] * t
    for a, b in WINDOWS_X:
        mid = (a + b) * TILE / 2
        lit |= (y > a * TILE + 3) & (y < b * TILE - 3) & (z > WIN_LOW + 1) & (z < WIN_HIGH - 1) & (np.abs(y - mid) > 1) & (np.abs(z - 26.7) > 1)
    # The wall at the back right.
    t = np.maximum(p[:, 1] - ROOM_Y0, 0) / -SUN[1]
    x, z = p[:, 0] + SUN[0] * t, p[:, 2] + SUN[2] * t
    for a, b in WINDOWS_Y:
        mid = (a + b) * TILE / 2
        lit |= (x > a * TILE + 3) & (x < b * TILE - 3) & (z > WIN_LOW + 1) & (z < WIN_HIGH - 1) & (np.abs(x - mid) > 1) & (np.abs(z - 26.7) > 1)
    return lit


LAMPS = [(x * TILE, y * TILE) for x in (13.5, 32.5) for y in (6.5, 11.5, 16.5, 21.5, 27)]


def lit(p, normal, rgb):
    """The colour of these surfaces in the room's light, the lamps, what shades them, and the sun where it gets in."""
    facing = normal @ ROOM_LIGHT
    shade = np.select([facing > 0.75, facing > 0.3, facing > -0.1], [1.05, 0.95, 0.82], 0.7)
    lamps = np.minimum(sum(np.exp(-(((p[:, 0] - x) ** 2 + (p[:, 1] - y) ** 2) / 2400)) for x, y in LAMPS), 1)
    from_windows = np.maximum(0.2 * np.exp(-np.maximum(p[:, 0] - ROOM_X0, 0) / 70) * (p[:, 1] > 10 * TILE), 0.14 * np.exp(-np.maximum(p[:, 1] - ROOM_Y0, 0) / 70) * (p[:, 0] > 24 * TILE))
    light = shade * (0.72 + from_windows + 0.17 * lamps)
    # Darker close to whatever stands near: two reaches, for a soft shadow on the floor as well as a dark line where things meet.
    def closeness(reach):
        return np.clip(np.minimum(occluders(p + normal * reach), np.minimum(p[:, 0] - ROOM_X0, p[:, 1] - ROOM_Y0) + reach) / reach, 0, 1)
    light = light * (0.5 + 0.28 * closeness(2.2) + 0.22 * closeness(7))
    out = rgb * light[..., None]
    candidate = through_a_window(p) & (normal @ SUN > 0.05)
    idx = np.nonzero(candidate)[0]
    if len(idx):
        q = p[idx] + normal[idx] * 0.4
        travel = np.zeros(len(idx))
        blocked = np.zeros(len(idx), bool)
        for _ in range(22):
            d = occluders(q + SUN * travel[..., None])
            blocked |= d < 0.06
            travel += np.maximum(d, 0.6)
        sunny = idx[~blocked]
        # Softer at its edges, where a little way off is out of the sun.
        off = p[sunny] + np.array([1.1, -0.7, 0])
        soft = 0.72 + 0.28 * through_a_window(off)
        warm = rgb[sunny] * np.array([1.36, 1.2, 0.92]) * np.maximum(light[sunny], 0.82)[..., None] * 1.03
        out[sunny] = out[sunny] * (1 - soft[..., None]) + warm * soft[..., None]
    return out


# ------------------------------------------------------------------ the floor
def floor_paint(p):
    x, y = p[:, 0], p[:, 1]
    """Speckled vinyl tiles, each a little different, worn paler down the aisles, as in an old shop."""
    tile_tone = value_noise(np.floor(x / TILE) * 3.1, np.floor(y / TILE) * 5.7)
    wear = value_noise(x * 0.06, y * 0.06) * 0.6 + value_noise(x * 0.4, y * 0.4) * 0.15
    out = np.tile(colour("#d9d6c8"), (len(p), 1)) * (0.9 + tile_tone[..., None] * 0.07 + wear[..., None] * 0.14)
    speck = value_noise(x * 3.2, y * 3.2)
    out[speck > 0.72] = out[speck > 0.72] * 0.86
    out[speck < 0.24] = np.minimum(out[speck < 0.24] * 1.06, 255)
    grout = ((x % TILE) < 0.28) | ((y % TILE) < 0.28)
    out[grout] = out[grout] * 0.88
    return out


def make_chunk(spec):
    column, row = spec
    left, top = column * CHUNK / DETAIL, row * CHUNK / DETAIL
    u = (np.arange(CHUNK) + 0.5) / DETAIL + left - OX
    v = (np.arange(CHUNK) + 0.5) / DETAIL + top - TOP_PAD
    uu, vv = np.meshgrid(u, v)
    p = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    image = np.tile(colour("#191614"), (CHUNK * CHUNK, 1))
    inside = (p[:, 0] > ROOM_X0 - 6) & (p[:, 1] > ROOM_Y0 - 6) & (p[:, 0] < ROOM_X1 + 6) & (p[:, 1] < ROOM_Y1 + 6)
    # A strip of floor out through the door, to the mat.
    inside |= (p[:, 0] > DOOR_X[0]) & (p[:, 0] < DOOR_X[1]) & (p[:, 1] >= ROOM_Y1) & (p[:, 1] < ROOM_Y1 + 12)
    if inside.any():
        q = p[inside]
        normal = np.tile(np.array([0, 0, 1.0]), (len(q), 1))
        out = lit(q + np.array([0, 0, 0.01]), normal, floor_paint(q))
        # The polished floor mirrors the windows, faintly.
        t = np.maximum(q[:, 0] - ROOM_X0, 0)
        for a, b in WINDOWS_X:
            shine = (q[:, 1] - t > a * TILE + 2) & (q[:, 1] - t < b * TILE - 2) & (t > WIN_LOW) & (t < WIN_HIGH)
            out[shine] = out[shine] * 0.84 + colour("#eaf4fa") * 0.16
        t = np.maximum(q[:, 1] - ROOM_Y0, 0)
        for a, b in WINDOWS_Y:
            shine = (q[:, 0] - t > a * TILE + 2) & (q[:, 0] - t < b * TILE - 2) & (t > WIN_LOW) & (t < WIN_HIGH)
            out[shine] = out[shine] * 0.86 + colour("#eaf4fa") * 0.14
        image[inside] = out
    return spec, np.clip(image, 0, 255).astype(np.uint8).reshape(CHUNK, CHUNK, 3)


# -------------------------------------------------------------- each tile's picture
SHEET_GAP = DETAIL * 2  # so that shrinking doesn't bring in a little of the next picture


def what_shows(ordered, shape, where):
    """Each tile's picture with only the pixels left showing when all are drawn in order, so that drawing one again over someone changes nothing else."""
    owner = np.full(shape, -1, np.int32)
    for i, (spec, (picture, ox, oy)) in enumerate(ordered):
        left, top = where(spec, ox, oy)
        ph, pw = picture.shape[:2]
        owner[top:top + ph, left:left + pw][picture[..., 3] > 0] = i
    kept = []
    for i, (spec, (picture, ox, oy)) in enumerate(ordered):
        left, top = where(spec, ox, oy)
        ph, pw = picture.shape[:2]
        shown = picture.copy()
        shown[owner[top:top + ph, left:left + pw] != i] = 0
        rows, columns = np.nonzero(shown[:, :, 3].any(axis=1))[0], np.nonzero(shown[:, :, 3].any(axis=0))[0]
        if len(rows):
            cut, x0, y0 = on_whole_pixels(shown, rows, columns)
            kept.append((spec, (cut, ox + x0, oy + y0)))
    return kept


def on_whole_pixels(out, rows, columns):
    """A tile's picture cut to what's in it, on the world's whole pixels: the game shrinks the sheet once to fit the screen and then copies from it exactly."""
    x0, y0 = int(columns[0]) // DETAIL * DETAIL, int(rows[0]) // DETAIL * DETAIL
    x1, y1 = (int(columns[-1]) // DETAIL + 1) * DETAIL, (int(rows[-1]) // DETAIL + 1) * DETAIL
    return out[y0:y1, x0:x1], x0, y0


def render_tile(spec):
    tx, ty, in_front = spec
    letter = MAP[ty][tx].lower() if in_front else MAP[ty][tx]
    parts = [part for part in PARTS if letter in part[3]]
    w, h = 32 * DETAIL, CELL_H * DETAIL
    cu = (tx - ty) * HW
    bottom = (tx + ty) * HH + 16
    u = (np.arange(w) + 0.5) / DETAIL - 16 + cu
    v = (np.arange(h) + 0.5) / DETAIL - CELL_H + bottom
    uu, vv = np.meshgrid(u, v)
    base = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    x0, y0 = tx * TILE, ty * TILE
    def clipped(field):
        return lambda p: np.maximum(field(p), np.maximum(np.maximum(x0 - p[:, 0], p[:, 0] - x0 - TILE), np.maximum(y0 - p[:, 1], p[:, 1] - y0 - TILE)))
    fields = [clipped(part[0]) for part in parts]
    nearest = lambda p: np.minimum.reduce([f(p) for f in fields])
    glass = GLASS[letter](base, x0, y0) if letter in GLASS else None
    t = np.full(len(base), 70.0)
    hit = np.zeros(len(base), bool)
    live = np.arange(len(base))
    for _ in range(70):
        if not len(live):
            break
        d = nearest(base[live] + t[live, None])
        arrived = d < 0.03
        hit[live[arrived]] = True
        t[live] -= np.maximum(d, 0.03) / np.sqrt(3) * 0.9
        live = live[~arrived & (t[live] > -0.5)]
    out = np.zeros((h, w, 4), np.uint8)
    if glass is not None:
        on, thickness, tone = glass
        out[..., :3] = tone
        out[..., 3] = np.where(on, thickness * 255, 0).reshape(h, w)
    at = np.nonzero(hit)[0]
    if not len(at):
        if glass is None:
            return spec, None
        rows, columns = np.nonzero(out[:, :, 3].any(axis=1))[0], np.nonzero(out[:, :, 3].any(axis=0))[0]
        return spec, on_whole_pixels(out, rows, columns)
    p = base[at] + t[at, None]
    which = np.argmin([f(p) for f in fields], axis=0)
    e = 0.05
    normal = np.stack([nearest(p + np.eye(3)[i] * e) - nearest(p - np.eye(3)[i] * e) for i in range(3)], axis=1)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    rgb = np.zeros((len(p), 3))
    for i, part in enumerate(parts):
        chosen = which == i
        if not chosen.any():
            continue
        colours = part[1](p[chosen])
        if part[2] == "inside":
            # Lit from within, and darker in the corners and between things.
            facing = normal[chosen] @ ROOM_LIGHT
            near = np.clip(part[0](p[chosen] + normal[chosen] * 2.2) / 2.2, 0, 1)
            rgb[chosen] = colours * ((0.8 + 0.26 * np.clip(facing, -0.4, 1)) * (0.62 + 0.38 * near))[..., None]
        else:
            rgb[chosen] = colours if part[2] else lit(p[chosen], normal[chosen], colours)
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
    # Where a tile has only been cut off from the next one there's nothing to see: that one's picture has what's really there.
    cut = np.abs(np.min([part[0](p) for part in parts], axis=0)) > 0.12
    out[ys[cut], xs[cut]] = 0
    rows, columns = np.nonzero(out[:, :, 3].any(axis=1))[0], np.nonzero(out[:, :, 3].any(axis=0))[0]
    return spec, on_whole_pixels(out, rows, columns)


# ------------------------------------------------- what's for sale, always in its place
_data = json.loads(_text[_text.index("{"):_text.rindex("}") + 1])["store"]
STOCK = _data["stock"]
_foods = (ROOT / "art/animals/animals.js").read_text(encoding="utf-8")
FOOD_SHEETS = json.loads(_foods[_foods.index("{"):_foods.rindex("}") + 1])
ANCHOR = (60, 60)  # in a food's picture, where it stands, as in tools/make_animals.py
rows_of = lambda highs, deeps, alongs: [(x, y, z) for z in highs for y in deeps for x in alongs]
# How food stands in each kind of fixture: how big, what it has to fit into, and each copy's place in the tile, along it, in from the back and how high.
SHOW = {
    "R": dict(size=0.5, tallest=6.6, widest=4.6, copies=rows_of((19, 11, 3), (10.8, 12.6), (3.4, 8, 12.6)), cold=0.08),
    "Z": dict(size=0.46, tallest=5.5, widest=7, copies=[(3.5, 5.2, 4.2), (10, 5.8, 3.8), (6.4, 9.2, 3.4), (12.2, 9.8, 3.2)], cold=0.2, frost=True),
    "S": dict(size=0.56, tallest=5.2, widest=5, copies=rows_of((14, 7.8, 1.6), (13.8,), (2.8, 8, 13.2))),
    "P": dict(size=0.56, tallest=7, widest=7.5, copies=[(3, 4.6, 7.2), (9, 4.2, 7.2), (13, 5.6, 7.2), (5.6, 9.2, 7), (11.2, 9.8, 7)]),
    "M": dict(size=0.72, tallest=10, widest=12, copies=[(8, 8, MEAT_H)]),
    "e": dict(size=0.56, tallest=8, widest=13, copies=[(8, 8, 15.2)]),
}
# Its sign: an empty board that the game writes the word on, in the player's language (SIGNS in src/world.js). Standing on the fixture, on posts, or as a banner hanging from its edge: where it is in the tile (along, in from the back, how high its
# top is), how tall, how long its posts are, how long it is, and on which of a food's tiles. Every board of a kind is as long as the longest word needs.
SIGNS = {
    "R": dict(front=13.4, top=FRIDGE_H + 8, high=7, posts=0.6, longest=30, every=2),
    "S": dict(front=8, top=SHELF_H + 9.5, high=6.5, posts=3, longest=28, every=4),
    "Z": dict(front=1.6, top=FREEZER_H + 9, high=6.5, posts=2.5, longest=28, every=3),
    "P": dict(front=3, top=CRATE_H + 11, high=6.5, posts=5, longest=30, every=2),
    "e": dict(front=15, top=15.4, high=9, posts=0, longest=26, every=4, banner=True),
    "M": dict(front=16, top=MEAT_H - 0.2, high=7, posts=0, longest=30, every=2, banner=True, across=True),
}
# Where each board is, for the game to write on: filled in as the signs are placed, written out with the tiles.
SIGN_SPOTS = []


def board_length(spec):
    """How long a board is in the picture's pixels: as long as its kind allows, whatever word goes on it."""
    wide = round(spec.get("wide", spec["longest"]) * DETAIL)
    return wide + -wide % DETAIL


def sign_picture(spec):
    """An empty sign as a picture, slanted to go along the fixture, and how long it is in the world."""
    high = round(spec["high"] * DETAIL)
    wide = board_length(spec)
    posts = round(spec["posts"] * DETAIL)
    board = Image.new("RGBA", (wide, high + posts), (0, 0, 0, 0))
    d = ImageDraw.Draw(board)
    if spec.get("banner"):
        # Cloth hanging from the edge, with a rail along the top and a stitched hem.
        d.rectangle((0, 0, wide - 1, high - 1), fill="#f4eeda")
        d.rectangle((0, 0, wide - 1, 3), fill="#3f6b4f")
        d.rectangle((0, high - 3, wide - 1, high - 1), fill="#bb2a2d")
    else:
        for x in ((3, wide - 4) if spec.get("wide") else (wide // 5, wide - wide // 5)):  # a sign over a way through stands on its edges
            d.rectangle((x - 2, high - 2, x + 1, high + posts), fill="#39424a")
        d.rounded_rectangle((0, 0, wide - 1, high - 1), 5, fill="#2f5a44", outline="#d8c070", width=2)
    across = spec.get("across")
    total = high + posts + wide // 2
    shear = (1, 0, 0, 0.5, 1, -wide / 2) if across else (1, 0, 0, -0.5, 1, 0)
    return board.transform((wide, total), Image.AFFINE, shear, Image.BICUBIC), wide / DETAIL


def sign_item(sprite, spots, index, letter):
    """A sign for one of a food's tiles, ready to go among the tiles' pictures."""
    tx, ty = spots[index]
    between = len(spots) == 2 or letter == "e"  # across both of its places, from the nearer one so that it isn't covered by the next
    if letter == "R" and not between and [tx + 1, ty] in spots:
        # A fridge's sign sits low on its top and is longer than a door: over the middle one, it goes with the next door, or that one covers its end.
        return placed_sign(sprite, tx + 1, ty, dict(SIGNS[letter]), along=8 - TILE)
    return placed_sign(sprite, tx, ty, dict(SIGNS[letter]), between)


def placed_sign(word, tx, ty, spec, between=False, along=8):
    slanted, length = sign_picture(spec)
    if spec.get("across"):
        y_left = length / 2
        left, top = (spec["front"] - y_left + 16) * DETAIL, ((spec["front"] + y_left) / 2 - spec["top"] + 48) * DETAIL - slanted.width // 2
    else:
        along = 0 if between else along
        start = along - length / 2
        left, top = (start - spec["front"] + 16) * DETAIL, ((start + spec["front"]) / 2 - spec["top"] + 48) * DETAIL
    # The board's own top left corner in the world's pixels, before it's slanted: the game writes on it from there.
    SIGN_SPOTS.append(dict(
        word=word, tile=[tx, ty],
        x=round((((tx - ty) * HW + OX - 16) * DETAIL + left) / DETAIL, 2),
        y=round((((tx + ty) * HH + TOP_PAD + 16 - CELL_H) * DETAIL + top) / DETAIL, 2),
        wide=slanted.width / DETAIL, high=round(spec["high"] * DETAIL) / DETAIL,
        **({"banner": True} if spec.get("banner") else {}), **({"across": True} if spec.get("across") else {}),
    ))
    x0, y0 = int(left // DETAIL * DETAIL), int(top // DETAIL * DETAIL)
    full = np.zeros((slanted.height + DETAIL * 2, slanted.width + DETAIL * 2, 4), np.uint8)
    full[round(top - y0):round(top - y0) + slanted.height, round(left - x0):round(left - x0) + slanted.width] = np.array(slanted)
    if not spec.get("across"):
        return [((tx, ty, "s"), cut_sign(full, x0, y0))]
    # A banner across the front hangs half on the tile behind, and that half goes with that tile: else someone standing in front of it is drawn under it.
    split = (16 + spec["front"]) * DETAIL - x0
    near, far = full.copy(), full.copy()
    near[:, split:] = 0
    far[:, :split] = 0
    return [((tx, ty, "s"), cut_sign(near, x0, y0)), ((tx, ty - 1, "s"), cut_sign(far, x0 - HW * DETAIL, y0 + HH * DETAIL))]


def cut_sign(full, x0, y0):
    rows, columns = np.nonzero(full[:, :, 3].any(axis=1))[0], np.nonzero(full[:, :, 3].any(axis=0))[0]
    picture, cx, cy = on_whole_pixels(full, rows, columns)
    return picture, x0 + cx, y0 + cy


def food_picture(sprite):
    made = FOOD_SHEETS[sprite]
    return Image.open(ROOT / f"art/animals/{sprite}.png").convert("RGBA").crop((0, 0, made["w"], made["h"])), made


def food_copy(sprite, letter):
    """A copy in the light of where it stands: dimmer at its foot, in the cold a little paler and bluer, and with frost in a freezer."""
    show = SHOW[letter]
    picture, made = food_picture(sprite)
    scale = min(show["size"], show["tallest"] / (made["h"] / DETAIL), show["widest"] / (made["w"] / DETAIL))
    copy = picture.resize((max(1, round(made["w"] * scale)), max(1, round(made["h"] * scale))), Image.LANCZOS)
    a = np.array(copy).astype(float)
    level = (np.arange(a.shape[0]) / max(a.shape[0] - 1, 1))[:, None, None]
    a[..., :3] = a[..., :3] * (1.06 - level * 0.32)
    if show.get("cold"):
        a[..., :3] = a[..., :3] * (1 - show["cold"]) + np.array((206, 230, 248)) * show["cold"]
    if show.get("frost"):
        rng = np.random.default_rng(sum(map(ord, sprite)))
        frost = rng.random(a.shape[:2]) > 0.88
        a[frost, :3] = a[frost, :3] * 0.66 + np.array((238, 247, 252)) * 0.34
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"), scale, made


def put_food(cell, sprite, letter):
    """Rows of a food with its shadows, into a tile's picture."""
    copy, scale, made = food_copy(sprite, letter)
    deepest = max(y for _, y, _ in SHOW[letter]["copies"])
    wide = made["w"] / DETAIL * scale
    far = Image.fromarray((np.array(copy).astype(float) * np.array((0.88, 0.88, 0.88, 1))).astype(np.uint8), "RGBA")
    for x, y, z in SHOW[letter]["copies"]:
        foot_x, foot_y = (x - y + 16) * DETAIL, ((x + y) / 2 - z + 48) * DETAIL
        reach = wide * 0.6 * DETAIL
        shade = Image.new("RGBA", cell.size, (0, 0, 0, 0))
        ImageDraw.Draw(shade).ellipse((foot_x - reach, foot_y - reach * 0.32, foot_x + reach, foot_y + reach * 0.32), fill=(10, 16, 26, 105))
        cell.alpha_composite(shade)
        left = round(foot_x + (made["x"] / DETAIL - ANCHOR[0]) * scale * DETAIL)
        top = round(foot_y + (made["y"] / DETAIL - ANCHOR[1]) * scale * DETAIL)
        if left >= 0 and top >= 0:
            cell.alpha_composite(far if y < deepest else copy, (left, top))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    workers = int(sys.argv[1]) if sys.argv[1:] else 6
    chunks = [(c, r) for r in range(int(np.ceil(WORLD_H * DETAIL / CHUNK))) for c in range(int(np.ceil(WORLD_W * DETAIL / CHUNK)))]
    tiles = [(x, y, False) for y in range(HEIGHT) for x in range(WIDTH) if MAP[y][x] in "SRZPCMWXeQv"]
    tiles += [(x, y, True) for x, y, _ in tiles if MAP[y][x] in "RZ"]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        floor = dict(pool.map(make_chunk, chunks))
        pictures = [item for item in pool.map(render_tile, tiles) if item[1] is not None]
    # What's for sale goes into its tiles, with each cabinet's glass over it.
    made = {spec: item for spec, item in pictures}
    cells = {}
    w, h = 32 * DETAIL, CELL_H * DETAIL
    def cell_of(spec):
        picture, ox, oy = made[spec]
        full = np.zeros((h, w, 4), np.uint8)
        full[oy:oy + picture.shape[0], ox:ox + picture.shape[1]] = picture
        return Image.fromarray(full, "RGBA")
    for spec in made:
        if not spec[2]:
            cells[spec[0], spec[1]] = cell_of(spec)
    for sprite, spots in STOCK.items():
        for i, (tx, ty) in enumerate(spots):
            letter = MAP[ty][tx]
            put_food(cells[tx, ty], sprite, letter)
    for (tx, ty), cell in cells.items():
        if (tx, ty, True) in made:
            cell.alpha_composite(cell_of((tx, ty, True)))
    pictures = []
    for (tx, ty), cell in cells.items():
        full = np.array(cell)
        rows, columns = np.nonzero(full[:, :, 3].any(axis=1))[0], np.nonzero(full[:, :, 3].any(axis=0))[0]
        pictures.append(((tx, ty, False), on_whole_pixels(full, rows, columns)))
    # And above each food, its sign.
    for sprite, spots in STOCK.items():
        letter = MAP[spots[0][1]][spots[0][0]]
        every = SIGNS[letter]["every"]
        places = [3] if letter == "e" else [1] if len(spots) == 2 else list(range(every // 2, len(spots), every))
        pictures += [piece for i in places for piece in sign_item(sprite, spots, i, letter)]
    # And the signs for the way in and out. The tiles they go on must match tools/make_map.py.
    # Over the gate, on two posts standing either side of it, high enough to walk under.
    pictures += placed_sign("entrance", 41, 27, dict(front=8, high=7, posts=38, longest=30, top=45, wide=32), along=-16)
    # It all goes into the floor's pictures, drawn just once. A tile is only drawn again over someone behind it. The back walls never need to be.
    columns, rows = max(c for c, _ in floor) + 1, max(r for _, r in floor) + 1
    world = np.zeros((rows * CHUNK, columns * CHUNK, 3), np.uint8)
    for (column, row), image in floor.items():
        world[row * CHUNK:(row + 1) * CHUNK, column * CHUNK:(column + 1) * CHUNK] = image
    back = lambda item: item[0][0] < 2 or item[0][1] < 2
    pictures = sorted(pictures, key=lambda item: (item[0][0] + item[0][1], item[0][2] == "s"))
    where = lambda spec, ox, oy: (((spec[0] - spec[1]) * HW + OX - 16) * DETAIL + ox, ((spec[0] + spec[1]) * HH + TOP_PAD + 16 - CELL_H) * DETAIL + oy)
    for spec, (picture, ox, oy) in pictures:
        left, top = where(spec, ox, oy)
        ph, pw = picture.shape[:2]
        solid = picture[..., 3:] / 255
        world[top:top + ph, left:left + pw] = world[top:top + ph, left:left + pw] * (1 - solid) + picture[..., :3] * solid
    for column, row in floor:
        Image.fromarray(world[row * CHUNK:(row + 1) * CHUNK, column * CHUNK:(column + 1) * CHUNK], "RGB").save(OUT / f"ground-{column}-{row}.webp", quality=84, method=6)
    pictures = what_shows(pictures, world.shape[:2], where)
    pictures = [item for item in pictures if not back(item)]
    # All into one sheet, row after row, and where each one is.
    sheet_w = 3200
    pictures.sort(key=lambda item: -item[1][0].shape[0])
    x = y = row_h = 0
    places = {}
    name_of = lambda tx, ty, kind: f"{tx},{ty}{kind or ''}"  # a sign's name ends in s
    for (tx, ty, in_front), (picture, ox, oy) in pictures:
        ph, pw = picture.shape[:2]
        if x + pw > sheet_w:
            x, y, row_h = 0, y + row_h, 0
        places[name_of(tx, ty, in_front)] = [x, y, pw, ph, ox, oy]
        x, row_h = x + pw + SHEET_GAP, max(row_h, ph + SHEET_GAP)
    sheet = np.zeros((y + row_h, sheet_w, 4), np.uint8)
    for (tx, ty, in_front), (picture, _, _) in pictures:
        sx, sy, pw, ph, _, _ = places[name_of(tx, ty, in_front)]
        sheet[sy:sy + ph, sx:sx + pw] = picture
    Image.fromarray(sheet, "RGBA").save(OUT / "fixtures.webp", quality=90, alpha_quality=100, method=6)
    (OUT / "fixtures.js").write_text(f"// Generated by tools/make_store.py: where each tile's picture is on the sheet, and where it goes in its {CELL_H * DETAIL}-high cell.\nwindow.MAHTTE_STORE = {json.dumps(places, separators=(',', ':'))};\n"
                                    f"// And its signs' empty boards, for the game to write on.\nwindow.MAHTTE_STORE_SIGNS = {json.dumps(SIGN_SPOTS, separators=(',', ':'))};\n", encoding="utf-8")
    print(len(chunks), "pieces of floor and", len(pictures), "tiles written, sheet", sheet.shape)


if __name__ == "__main__":
    main()
