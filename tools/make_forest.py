#!/usr/bin/env python3
"""Make the forest in 3D: the ground as one big picture in pieces, and the trees. The game only draws them.

The ground is a height field looked at from the world's angle, so banks, ruts and mounds are real shapes lit from the upper
left, with grass, flowers and stones set on it. Trees are 3D shapes with lumpy surfaces, lit in flat bands to keep the
pixel-art look. Where the tiles of data/map.js decide what can be walked on, this only decides how it looks.

Usage: python3 tools/make_forest.py          everything, into art/forest/
       python3 tools/make_forest.py trees    only the trees
       python3 tools/make_forest.py church   only the church
       python3 tools/make_forest.py preview OUT.png TILE_X TILE_Y   one view's worth, for looking at
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art/forest"
DETAIL = 4  # picture pixels to each of the world's
HW, HH, TOP_PAD, EDGE, MARGIN = 16, 8, 60, 10, 80  # as in src/world.js
VIEW_W, VIEW_H = 280, 190
CHUNK = 512  # picture pixels on a side. Must match FOREST_CHUNK in src/world.js.
WATER_DROP = 4.5
SUN = np.array([-0.5, -0.32, 0.8]) / np.linalg.norm([-0.5, -0.32, 0.8])

_text = (ROOT / "data/map.js").read_text(encoding="utf-8")
_place = json.loads(_text[_text.index("{"):_text.rindex("}") + 1])["forest"]
MAP, KINDS = _place["rows"], _place["trees"]
HEIGHT, WIDTH = len(MAP), len(MAP[0])
WORLD_W, WORLD_H = (WIDTH + HEIGHT) * HW + MARGIN * 2, (WIDTH + HEIGHT) * HH + TOP_PAD + EDGE + 60
OX = HEIGHT * HW + MARGIN


def colour(text):
    return np.array([int(text[i:i + 2], 16) for i in (1, 3, 5)], float)


# ---------------------------------------------------------------- noise
_grid = np.random.default_rng(7).random((512, 512))


def value_noise(x, y):
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    at = lambda a, b: _grid[(iy + b) & 511, (ix + a) & 511]
    return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy


def fbm(x, y, octaves=4):
    total, size, scale = 0, 0.5, 1
    for i in range(octaves):
        total = total + value_noise(x * scale + i * 37.1, y * scale - i * 11.7) * size
        size, scale = size / 2, scale * 2.03
    return total / (1 - 0.5 ** octaves)


def tile_field(values):
    """A map-sized table, read smoothly at any tile position."""
    table = np.array(values, float)
    def read(x, y):
        x, y = np.clip(x - 0.5, 0, WIDTH - 1.001), np.clip(y - 0.5, 0, HEIGHT - 1.001)
        ix, iy = x.astype(int), y.astype(int)
        fx, fy = x - ix, y - iy
        return (table[iy, ix] * (1 - fx) + table[iy, ix + 1] * fx) * (1 - fy) + (table[iy + 1, ix] * (1 - fx) + table[iy + 1, ix + 1] * fx) * fy
    return read


def blurred(table, times):
    t = np.array(table, float)
    for _ in range(times):
        t = (t + np.roll(t, 1, 0) + np.roll(t, -1, 0) + np.roll(t, 1, 1) + np.roll(t, -1, 1)) / 5
    return t


_tile = lambda test: [[1.0 if test(c) else 0.0 for c in row] for row in MAP]
_water = tile_field(_tile(lambda c: c in "wb"))
_trees = tile_field(blurred(_tile(lambda c: c == "t"), 3))
_paths = np.array(_tile(lambda c: c in "pb"))


def path_amount(x, y):
    """1 in the middle of a path, 0 off it, along its tiles, with an edge that wanders."""
    wander = (fbm(x * 3, y * 3, 3) - 0.5) * 0.3
    tx, ty = np.clip(x.astype(int), 0, WIDTH - 1), np.clip(y.astype(int), 0, HEIGHT - 1)
    fx, fy = x - tx, y - ty
    best = np.zeros_like(x)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = tx + dx, ty + dy
            ok = (nx >= 0) & (ny >= 0) & (nx < WIDTH) & (ny < HEIGHT)
            there = np.zeros_like(x)
            there[ok] = _paths[ny[ok], nx[ok]]
            away = np.hypot(np.maximum(np.abs(fx - 0.5 - dx) - 0.5, 0), np.maximum(np.abs(fy - 0.5 - dy) - 0.5, 0))
            best = np.maximum(best, there * np.clip(1 - away / (0.02 + np.maximum(wander + 0.12, 0.02)), 0, 1))
    return best


# ------------------------------------------------------------ the ground
GRASS = [colour(c) for c in ("#3c7a3e", "#4a8c46", "#5a9e4c", "#6cae54", "#82bf62")]
FLOOR = [colour(c) for c in ("#254f33", "#2f5f39", "#3a6f3e", "#4b8045")]
DIRT = [colour(c) for c in ("#8a6c48", "#a48659", "#bb9d6e", "#cfb384")]
BANK = [colour(c) for c in ("#46311f", "#5e432a", "#7a5a3a")]
WATER = [colour(c) for c in ("#123f74", "#1c5a98", "#2a74b4", "#46a0d4")]
WOOD = [colour(c) for c in ("#4a2e18", "#7c5430", "#9b6b3a", "#b98a54")]


def ramp(tones, level):
    level = np.clip(level, 0, 0.9999) * (len(tones) - 1)
    i = level.astype(int)
    f = (level - i)[..., None]
    return np.array(tones)[i] * (1 - f) + np.array(tones)[i + 1] * f


def height_at(x, y):
    """How high the land is, in the world's pixels: gentle mounds, sinking to the water and in the ruts of paths."""
    wet = _water(x, y)
    wobble = (fbm(x * 2.2 + 5, y * 2.2, 3) - 0.5) * 0.28
    shore = np.clip((wet + wobble - 0.36) / 0.2, 0, 1)
    h = (fbm(x * 0.55, y * 0.55, 3) - 0.5) * 3.2 + (fbm(x * 2.6, y * 2.6, 2) - 0.5) * 0.9
    paths = path_amount(x, y)
    h = h * (1 - paths * 0.8) - paths * 0.35
    h = h * (1 - shore) - shore * WATER_DROP
    return h, shore, paths


def bridge_at(x, y):
    """On a bridge's tiles, 0 to 1 across and along it. They all run along y."""
    tx, ty = np.clip(x.astype(int), 0, WIDTH - 1), np.clip(y.astype(int), 0, HEIGHT - 1)
    is_bridge = np.array([[c == "b" for c in row] for row in MAP])[ty, tx]
    return is_bridge, x - tx


def shade_ground(x, y):
    """The colour and height of the land at these points. x and y are in tiles."""
    e = 0.012
    h, shore, paths = height_at(x, y)
    hx = height_at(x + e, y)[0] - height_at(x - e, y)[0]
    hy = height_at(x, y + e)[0] - height_at(x, y - e)[0]
    # The height's in world pixels and a tile is about 11 of them across.
    n = np.stack([-hx / (2 * e * 11), -hy / (2 * e * 11), np.ones_like(x)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lit = np.clip(n @ SUN, 0, 1)

    fine = fbm(x * 26, y * 26, 3)
    blades = fbm((x + y) * 9, (x - y) * 42, 2)
    broad = fbm(x * 0.9 + 9, y * 0.9, 3)
    under_trees = np.clip(_trees(x, y) * 1.5 + (broad - 0.5) * 0.5, 0, 1)
    grass = ramp(GRASS, broad * 0.55 + blades * 0.4 + (fine - 0.5) * 0.3)
    floor = ramp(FLOOR, broad * 0.4 + fine * 0.5)
    moss = fbm(x * 3 + 40, y * 3, 3) > 0.66
    floor = np.where(moss[..., None], ramp([colour("#708f5e"), colour("#a9c098")], fine), floor)
    needles = (fbm(x * 40 + 3, y * 13, 2) > 0.68) & (under_trees > 0.5)
    floor = np.where(needles[..., None], colour("#7f6f46"), floor)
    out = grass * (1 - under_trees[..., None]) + floor * under_trees[..., None]

    dirt = ramp(DIRT, fbm(x * 7, y * 7, 3) * 0.75 + (fine - 0.5) * 0.45)
    pebble = fbm(x * 60, y * 60, 2) > 0.74
    dirt = np.where(pebble[..., None], ramp([colour("#6f5a42"), colour("#e0cba4")], fine), dirt)
    amount = paths[..., None]
    blend = np.clip((amount - 0.25 + (fine[..., None] - 0.5) * 0.7) * 5, 0, 1)
    out = out * (1 - blend) + dirt * blend

    bank = ramp(BANK, fine * 0.8 + 0.1)
    stones = (fbm(x * 18 + 7, y * 18, 2) > 0.7)[..., None]
    bank = np.where(stones, ramp([colour("#74736f"), colour("#b3b2ab")], fine), bank)
    steep = np.clip((shore[..., None] - 0.1) * 2.2, 0, 1)
    out = out * (1 - steep) + bank * steep
    out = out * (0.68 + lit[..., None] * 0.55)
    return out, h, shore


def shade_water(x, y):
    """The river, darker where it's deep, with slow streaks along the flow. The moving light is drawn by the game."""
    wet = _water(x, y)
    depth = np.clip((wet - 0.45) * 1.9, 0, 1)
    streak = fbm(x * 3, y * 13, 3)
    out = ramp(WATER, (1 - depth) * 0.72 + (streak - 0.5) * 0.3 + 0.14)
    # Reeds' and banks' shade at the near edge of the sun.
    shade = np.clip(fbm(x * 1.7, y * 1.7, 2) * 0.2 + (1 - depth) * 0.1, 0, 0.3)
    return out * (1 - shade[..., None]), np.full_like(x, -WATER_DROP + 0.5)


def shade_bridge(x, y, across):
    along = y * 7
    plank = along.astype(int)
    gap = (along - plank) < 0.13
    grain = fbm(x * 30, y * 5, 2)
    wood = ramp(WOOD, 0.42 + (plank % 3) * 0.14 + (grain - 0.5) * 0.5)
    wood = np.where(gap[..., None], WOOD[0] * 0.8, wood)
    beam = (across < 0.2) | (across > 0.8)
    beam_wood = ramp(WOOD, 0.3 + (fbm(x * 8, y * 30, 2) - 0.5) * 0.4)
    # The far beam catches the sun and the near one is in shade.
    beam_wood = beam_wood * np.where(across < 0.5, 1.08, 0.72)[..., None]
    out = np.where(beam[..., None], beam_wood, wood)
    h = np.where(beam, 1.5, 0.45)
    keep = (across > 0.1) & (across < 0.9)
    return out, h, keep


def render_ground(left, top, w, h):
    """The picture of this part of the world, in world pixels. Each point of the land is put where it lands on screen, the
    nearest winning, so that what's high hides what's behind it."""
    pw, ph = int(w * DETAIL), int(h * DETAIL)
    image = np.zeros((ph, pw, 3))
    # Beyond the map, a dark forest, so that its edge never shows.
    gx, gy = np.meshgrid(np.arange(pw) / DETAIL + left, np.arange(ph) / DETAIL + top)
    image[:] = ramp([colour("#0f2622"), colour("#14302a"), colour("#1d3f33")], fbm(gx / 7, gy / 5, 3))
    nearest = np.full((ph, pw), -1e9)
    # A tile's corners a little beyond the picture, for what's high enough to reach into it.
    sx0, sy0 = left - 4, top - 4
    sub = 2.2  # samples to a picture pixel, so that steep banks leave no holes
    step_x, step_y = 1 / (DETAIL * sub), 1 / (DETAIL * sub)
    columns = np.arange(sx0, left + w + 4, step_x)
    for row_start in np.arange(sy0, top + h + 12, 1):
        rows = np.arange(row_start, row_start + 1, step_y)
        sx, sy = np.meshgrid(columns, rows)
        a, b = (sx - OX) / HW, (sy - TOP_PAD) / HH
        x, y = (a + b) / 2, (b - a) / 2
        inside = (x >= 0) & (y >= 0) & (x < WIDTH) & (y < HEIGHT)  # beyond that is the dark forest
        if not inside.any():
            continue
        x, y, sx, sy = x[inside], y[inside], sx[inside], sy[inside]
        cx, cy = np.clip(x, 0.001, WIDTH - 0.001), np.clip(y, 0.001, HEIGHT - 0.001)
        land, height, shore = shade_ground(cx, cy)
        water, water_height = shade_water(cx, cy)
        wet = height < water_height
        rgb = np.where(wet[..., None], water, land)
        hh = np.where(wet, water_height, height)
        on_bridge, across = bridge_at(cx, cy)
        if on_bridge.any():
            wood, wood_h, keep = shade_bridge(cx, cy, across)
            use = on_bridge & keep
            rgb = np.where(use[..., None], wood, rgb)
            hh = np.where(use, wood_h, hh)
        px = ((sx - left) * DETAIL).astype(int)
        py = ((sy - hh - top) * DETAIL).astype(int)
        ok = (px >= 0) & (py >= 0) & (px < pw) & (py < ph)
        depth = (x + y) + hh * 0.001
        px, py, rgb, depth = px[ok], py[ok], rgb[ok], depth[ok]
        order = np.argsort(depth)
        px, py, rgb, depth = px[order], py[order], rgb[order], depth[order]
        better = depth >= nearest[py, px]
        # Written in depth order, so that the last one to land on a pixel is the nearest.
        image[py[better], px[better]] = rgb[better]
        nearest[py[better], px[better]] = depth[better]
    return image, nearest


# ------------------------------------------------------------ what grows on it
def to_screen(x, y, z=0):
    return (x - y) * HW + OX, (x + y) * HH + TOP_PAD - z


def add_plants(image, left, top, rng_seed=11):
    """Grass and flowers set on the ground, far ones first."""
    ph, pw = image.shape[:2]
    grass_tones = np.array([colour(c) for c in ("#2f6232", "#4a8f49", "#79b961", "#a4d67a")])
    petals = np.array([colour(c) for c in ("#f7f3e3", "#f4d35e", "#c9a0e8", "#ef9ab4")])
    for sum_row in range(WIDTH + HEIGHT):
        for ty in range(HEIGHT):
            tx = sum_row - ty
            if not 0 <= tx < WIDTH or MAP[ty][tx] not in "gtA":
                continue
            cx, cy = to_screen(tx + 0.5, ty + 0.5)
            if cx < left - 30 or cx > left + pw / DETAIL + 30 or cy < top - 20 or cy > top + ph / DETAIL + 20:
                continue
            rng = np.random.default_rng(tx * 1009 + ty * 31 + rng_seed)
            for _ in range(rng.integers(6, 15)):
                u, v = rng.random(2)
                gx, gy = tx + u, ty + v
                ax, ay = np.array([gx]), np.array([gy])
                h, shore, paths = height_at(ax, ay)
                if shore[0] > 0.05 or paths[0] > 0.1:
                    continue
                sx, sy = to_screen(gx, gy, h[0])
                kind = rng.random()
                if kind < 0.72:
                    blades = rng.integers(3, 7)
                    for _b in range(blades):
                        tall = rng.uniform(2.2, 5)
                        lean = rng.uniform(-1.2, 1.2)
                        base = sx + rng.uniform(-1.4, 1.4)
                        for t in np.linspace(0, 1, int(tall * DETAIL)):
                            px = int((base + lean * t * t - left) * DETAIL)
                            py = int((sy - tall * t - top) * DETAIL)
                            if 0 <= px < pw and 0 <= py < ph:
                                image[py, px] = grass_tones[min(3, int(t * 3.6 + rng.random() * 0.4))]
                elif kind < 0.84:
                    tone = petals[rng.integers(0, len(petals))]
                    stem = rng.uniform(2.5, 4)
                    for t in np.linspace(0, 1, int(stem * DETAIL)):
                        px, py = int((sx - left) * DETAIL), int((sy - stem * t - top) * DETAIL)
                        if 0 <= px < pw and 0 <= py < ph:
                            image[py, px] = grass_tones[1]
                    for dy in range(-3, 4):
                        for dx in range(-3, 4):
                            if dx * dx + dy * dy <= 9:
                                px, py = int((sx - left) * DETAIL) + dx, int((sy - stem - top) * DETAIL) + dy
                                if 0 <= px < pw and 0 <= py < ph:
                                    image[py, px] = tone * (1.05 if dx + dy < 0 else 0.85) if dx * dx + dy * dy > 1 else colour("#f2c14e")
                elif kind < 0.865:
                    wide, high = rng.uniform(1.6, 3.2), rng.uniform(1, 1.9)
                    for dy in np.arange(-high, high, 1 / DETAIL):
                        for dx in np.arange(-wide, wide, 1 / DETAIL):
                            if (dx / wide) ** 2 + (dy / high) ** 2 < 1:
                                px, py = int((sx + dx - left) * DETAIL), int((sy + dy - high * 0.6 - top) * DETAIL)
                                if 0 <= px < pw and 0 <= py < ph:
                                    light = -dx / wide * 0.5 - dy / high * 0.7
                                    image[py, px] = colour("#8a8d8c") * (1 + light * 0.42)


# ------------------------------------------------------------------ the trees
def ray_points(w, h, anchor_x, anchor_y):
    """Rays from the world's angle, for a picture w by h in world pixels, with x=y=z=0 at the anchor."""
    u = (np.arange(int(w * DETAIL)) + 0.5) / DETAIL - anchor_x
    v = (np.arange(int(h * DETAIL)) + 0.5) / DETAIL - anchor_y
    uu, vv = np.meshgrid(u, v)
    # Screen x is x - y and screen y is (x + y) / 2 - z, as for the game's other models.
    return np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)


def noise3(p, scale, seed):
    q = p * scale
    return (value_noise(q[:, 0] + seed, q[:, 1]) + value_noise(q[:, 1] + seed * 2, q[:, 2]) + value_noise(q[:, 2] + seed * 3, q[:, 0])) / 3


def cone(p, base_z, top_z, radius):
    """A cone's distance, near enough to march by."""
    r = np.hypot(p[:, 0], p[:, 1])
    t = np.clip((p[:, 2] - base_z) / (top_z - base_z), 0, 1)
    across = r - radius * (1 - t)
    below = base_z - p[:, 2]
    return np.maximum(across * 0.8, below)


def capsule(p, a, b, r):
    a, b = np.array(a, float), np.array(b, float)
    u = b - a
    along = np.clip(((p - a) @ u) / (u @ u), 0, 1)
    return np.linalg.norm(p - a - np.outer(along, u), axis=1) - r


def blob(p, at, radii):
    k = np.linalg.norm((p - np.array(at, float)) / np.array(radii, float), axis=1)
    return (k - 1) * min(radii)


def spruce_field(height, seed):
    """Norway spruce: a narrow cone from near the ground, its branches hanging, very dark green."""
    tiers = max(6, int(height / 9))
    width = height * 0.2
    def field(p):
        trunk = capsule(p, (0, 0, 0), (0, 0, height * 0.6), 1.2 + height * 0.012)
        boughs = np.full(len(p), 1e6)
        for i in range(tiers):
            t = i / tiers
            base = height * 0.1 + height * 0.84 * t
            top = base + height * 0.3
            boughs = np.minimum(boughs, cone(p, base, min(top, height), width * (1 - t * 0.88)))
        angle = np.arctan2(p[:, 1], p[:, 0])
        rough = (noise3(p, 0.6, seed) - 0.5) * 1.8 + (noise3(p, 1.8, seed + 3) - 0.5) * 0.9 + np.sin(angle * 9 + p[:, 2] * 0.7 + seed) * 0.4
        return trunk, boughs - rough
    def paint(p, part, lit):
        if part == 0:
            bark = noise3(p, np.array([1.6, 1.6, 0.5]), seed)
            tones = np.array([colour(c) for c in ("#2c1f18", "#46332a", "#5e4739")])
            return tones[np.clip((lit * 1.6 + bark * 1.2).astype(int), 0, 2)]
        speck = noise3(p, 2.8, seed + 9)
        tones = np.array([colour(c) for c in ("#0c2e22", "#123f2c", "#1b5235", "#2a6a42", "#4a8a55")])
        return tones[np.clip((lit * 3.1 + (speck - 0.5) * 1.5).astype(int), 0, 4)]
    return field, paint


def pine_field(height, seed):
    """Scots pine, as on the fells: a tall slender trunk, grey-brown low down and orange high up, with a narrow crown of thin layers of
    branches and tufts of needles with the sky showing between them, and a few dead branches below. Shape from a photograph the user
    gave as a reference, which isn't in the project."""
    rng = np.random.default_rng(seed)
    lean = rng.uniform(-1, 1, 2) * height * 0.012
    tip = (lean[0], lean[1], height * 0.97)
    trunk_at = lambda z: (lean[0] * z / height, lean[1] * z / height, z)
    layers = int(height / 9.5)
    tufts, branches = [], []
    for i in range(layers):
        t = i / (layers - 1)
        z = height * (0.42 + 0.52 * t)
        reach = height * (0.17 * (1 - t) ** 0.8 + 0.03)
        turn = rng.uniform(0, 6.3)
        for arm in range(rng.integers(3, 6)):
            angle = turn + arm * 6.3 / 4 + rng.uniform(-0.4, 0.4)
            length = reach * rng.uniform(0.55, 1)
            end = (lean[0] * z / height + np.cos(angle) * length, lean[1] * z / height + np.sin(angle) * length, z + length * rng.uniform(-0.1, 0.2))
            branches.append((trunk_at(z - length * 0.1), end))
            size = height * rng.uniform(0.02, 0.03) * (1.15 - t * 0.5)
            tufts.append((end, (size * 1.5, size * 1.5, size * 0.6)))
            if rng.random() < 0.6:
                tufts.append(((end[0] * 0.6, end[1] * 0.6, end[2] - 0.4), (size, size, size * 0.45)))
    tufts.append((tip, (height * 0.022, height * 0.022, height * 0.045)))  # needles right up over the tip
    dead = [(trunk_at(z), (np.cos(a) * height * 0.09, np.sin(a) * height * 0.09, z - height * 0.03)) for z, a in ((height * 0.3, rng.uniform(0, 6.3)), (height * 0.36, rng.uniform(0, 6.3)))]
    def field(p):
        trunk = capsule(p, (0, 0, 0), tip, 0.9 + height * 0.009)
        for a, b_ in branches + dead:
            trunk = np.minimum(trunk, capsule(p, a, b_, 0.32))
        leaves = np.full(len(p), 1e6)
        for at, radii in tufts:
            leaves = np.minimum(leaves, blob(p, at, radii))
        rough = (noise3(p, 1.3, seed) - 0.5) * 0.9 + (noise3(p, 3.4, seed + 5) - 0.5) * 0.6
        return trunk, leaves - rough
    def paint(p, part, lit):
        if part == 0:
            up = np.clip(p[:, 2] / (height * 0.5) - 0.3, 0, 1)
            bark = noise3(p, np.array([2, 2, 0.5]), seed)
            low = np.array([colour(c) for c in ("#332620", "#5a463a", "#7d6653")])[np.clip((lit * 1.7 + bark).astype(int), 0, 2)]
            high = np.array([colour(c) for c in ("#8a4a26", "#c07a3e", "#e4a35f")])[np.clip((lit * 2 + bark * 0.8).astype(int), 0, 2)]
            return low * (1 - up[..., None]) + high * up[..., None]
        speck = noise3(p, 3, seed + 9)
        tones = np.array([colour(c) for c in ("#102f26", "#1a4432", "#2a5d40", "#42785a", "#6c9c72")])
        return tones[np.clip((lit * 3.1 + (speck - 0.5) * 1.5).astype(int), 0, 4)]
    return field, paint


def birch_field(height, seed):
    """Silver and downy birch, as in a grove: a slim white trunk with black bars, thick with them near the ground, and a high, airy crown
    of fresh green with branches showing through. Shape from a photograph the user gave as a reference, which isn't in the project."""
    rng = np.random.default_rng(seed)
    lean = rng.uniform(-1, 1, 2) * height * 0.035
    tip = (lean[0], lean[1], height * 0.94)
    clumps, branches = [], []
    for _ in range(int(height / 1.5)):
        z = height * rng.uniform(0.44, 0.98)
        t = (z / height - 0.44) / 0.54
        spread = height * 0.15 * np.sin(min(1, t * 0.9 + 0.12) * 3.14)
        angle = rng.uniform(0, 6.3)
        out = spread * rng.uniform(0.35, 1.1)
        at = (lean[0] * z / height + np.cos(angle) * out, lean[1] * z / height + np.sin(angle) * out, z)
        r = height * rng.uniform(0.018, 0.032)
        clumps.append((at, (r * 1.15, r * 1.15, r)))
        if rng.random() < 0.45:
            branches.append(((lean[0] * z / height, lean[1] * z / height, z - height * 0.05), at))
    def field(p):
        trunk = capsule(p, (0, 0, 0), tip, 0.85 + height * 0.008)
        for a, b_ in branches:
            trunk = np.minimum(trunk, capsule(p, a, b_, 0.25))
        leaves = np.full(len(p), 1e6)
        for at, radii in clumps:
            leaves = np.minimum(leaves, blob(p, at, radii))
        rough = (noise3(p, 1.4, seed) - 0.5) * 1 + (noise3(p, 3.6, seed + 5) - 0.5) * 0.7
        return trunk, leaves - rough
    def paint(p, part, lit):
        if part == 0:
            low = np.clip(1 - p[:, 2] / (height * 0.34), 0, 1)
            bars = noise3(p, np.array([1.1, 1.1, 2.3]), seed)
            tones = np.array([colour("#a39f90"), colour("#d6d2c4"), colour("#f4f1e6")])
            out = tones[np.clip((lit * 2.6).astype(int), 0, 2)]
            out[bars > 0.6 - low * 0.14] = colour("#2d2a2a")
            return out
        speck = noise3(p, 3.2, seed + 9)
        tones = np.array([colour(c) for c in ("#2f6a26", "#4f8f2c", "#6fae36", "#90c842", "#bce066")])
        return tones[np.clip((lit * 3.1 + (speck - 0.5) * 1.6).astype(int), 0, 4)]
    return field, paint


def juniper_field(height, seed):
    """Common juniper: a low narrow column, grey-green and prickly."""
    def field(p):
        trunk = capsule(p, (0, 0, 0), (0, 0, height * 0.3), 0.7)
        body = blob(p, (0, 0, height * 0.52), (height * 0.15, height * 0.15, height * 0.5))
        rough = (noise3(p, 0.8, seed) - 0.5) * 1.7 + (noise3(p, 2.3, seed + 5) - 0.5) * 0.9
        return trunk, body - rough
    def paint(p, part, lit):
        if part == 0:
            return np.full((len(p), 3), colour("#4a3626"))
        speck = noise3(p, 3, seed + 9)
        tones = np.array([colour(c) for c in ("#17392f", "#2a5a48", "#44785e", "#6f9c7c")])
        return tones[np.clip((lit * 2.6 + (speck - 0.5) * 1.5).astype(int), 0, 3)]
    return field, paint


def rowan_field(height, seed):
    """Rowan: a small open tree with feathery leaves and bunches of orange-red berries."""
    rng = np.random.default_rng(seed)
    crown = height * 0.66
    blobs = [((rng.uniform(-1, 1) * height * 0.15, rng.uniform(-1, 1) * height * 0.15, crown + rng.uniform(-0.2, 0.22) * height), rng.uniform(0.08, 0.13) * height) for _ in range(10)]
    def field(p):
        trunk = capsule(p, (0, 0, 0), (0.4, 0.2, height * 0.72), 1.05)
        leaves = np.full(len(p), 1e6)
        for at, r in blobs:
            leaves = np.minimum(leaves, blob(p, at, (r, r, r * 0.85)))
        rough = (noise3(p, 0.7, seed) - 0.5) * 3 + (noise3(p, 2, seed + 5) - 0.5) * 1.5
        return trunk, leaves - rough
    def paint(p, part, lit):
        if part == 0:
            tones = np.array([colour(c) for c in ("#4d4640", "#75695d", "#958879")])
            return tones[np.clip((lit * 2.6).astype(int), 0, 2)]
        speck = noise3(p, 2.6, seed + 9)
        tones = np.array([colour(c) for c in ("#2e5a2c", "#467c34", "#6a9c42", "#94be58")])
        out = tones[np.clip((lit * 2.8 + (speck - 0.5) * 1.6).astype(int), 0, 3)]
        out[noise3(p, 1.25, seed + 21) > 0.7] = colour("#e0562a")
        return out
    return field, paint


def render_tree(field_and_paint, w, h, anchor):
    """As RGBA, with a thin dark line round it."""
    field, paint = field_and_paint
    base = ray_points(w, h, *anchor)
    t = np.full(len(base), h * 1.2)
    hit = np.zeros(len(base), bool)
    live = np.arange(len(base))
    nearest = lambda p: np.minimum(*field(p))
    root3 = np.sqrt(3)
    for _ in range(70):
        if not len(live):
            break
        d = nearest(base[live] + t[live, None])
        arrived = d < 0.04
        hit[live[arrived]] = True
        t[live] -= np.maximum(d, 0.04) / root3 * 0.8
        live = live[~arrived & (t[live] > -h)]
    out = np.zeros((int(h * DETAIL), int(w * DETAIL), 4), np.uint8)
    at = np.nonzero(hit)[0]
    p = base[at] + t[at, None]
    e = 0.14
    normal = np.stack([nearest(p + np.eye(3)[i] * e) - nearest(p - np.eye(3)[i] * e) for i in range(3)], axis=1)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    light = np.array([-0.35, 0.45, 0.82]) / np.linalg.norm([-0.35, 0.45, 0.82])  # as for the game's other models
    lit = np.clip(normal @ light * 0.5 + 0.5, 0, 0.999)
    trunk, leaves = field(p)
    part = np.where(trunk < leaves, 0, 1)
    rgb = np.zeros((len(p), 3))
    for which in (0, 1):
        chosen = part == which
        if chosen.any():
            rgb[chosen] = paint(p[chosen], which, lit[chosen])
    ys, xs = at // out.shape[1], at % out.shape[1]
    out[ys, xs, :3] = np.clip(rgb, 0, 255)
    out[ys, xs, 3] = 255
    solid = out[:, :, 3] > 0
    grown = solid.copy()
    for _ in range(2):
        g = grown.copy()
        g[1:] |= grown[:-1]; g[:-1] |= grown[1:]; g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]
        grown = g
    edge = grown & ~solid
    out[edge] = (14, 26, 26, 255)
    return out


# Each kind on the map has its pictures: width and height in the world's pixels, and a seed. Must match FOREST_TREES in src/world.js.
TREES = {
    "P": (pine_field, [(48, 88, 1), (54, 102, 2), (58, 116, 3)]),
    "S": (spruce_field, [(40, 66, 4), (46, 80, 5), (52, 94, 6)]),
    "B": (birch_field, [(34, 70, 7), (38, 84, 8), (42, 98, 9)]),
    "J": (juniper_field, [(16, 24, 10), (18, 30, 11)]),
    "R": (rowan_field, [(30, 40, 12), (34, 46, 13)]),
}


# ----------------------------------------------------------------- the church
# Pielpajärvi's wilderness church. A cross church, its arms nearly equal at about 14 m by 13.6 m, with the belfry an extension of the western
# arm and the porch in its lower part, in a stony churchyard inside a paling fence: see CREDITS.md. The look follows two photographs the user
# gave as references, which aren't in the project. It's smaller than life beside the character, and the details are by eye. Must match FOREST_CHURCH in src/world.js and CHURCH in tools/make_map.py.
CHURCH = (46, 27, 58, 37)
CHURCH_SIZE = (360, 214)  # in the world's pixels
CHURCH_ANCHOR = (180, 112)  # where the yard's middle lands in the picture
LOGS = [colour(c) for c in ("#47200f", "#6f3a1d", "#96582e")]
SHINGLES = [colour(c) for c in ("#4f4b47", "#6f6a64", "#918c84")]
TOWER_RED = [colour(c) for c in ("#5c1f18", "#843023", "#a4412e")]
TIMBER = [colour(c) for c in ("#8a5a26", "#c8903f", "#e6b65e")]
FENCE_RED = [colour(c) for c in ("#6e2a22", "#a13c2e", "#c4543f")]


def box_d(p, low, high):
    low, high = np.array(low, float), np.array(high, float)
    q = np.abs(p - (low + high) / 2) - (high - low) / 2
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0)


def prism_d(p, x0, x1, half, z0, z1):
    """A roof's shape, its ridge along x and over y = 0."""
    high = z1 - z0
    slope = (np.abs(p[:, 1]) * high + (p[:, 2] - z0) * half - half * high) / np.hypot(high, half)
    return np.maximum.reduce([slope, z0 - p[:, 2], np.abs(p[:, 0] - (x0 + x1) / 2) - (x1 - x0) / 2])


def pyramid_d(p, cx, half, z0, z1, top_half=0):
    """A four-sided roof round x = cx, y = 0, cut flat at top_half."""
    rise = z1 - z0
    falls = (half - top_half) / rise
    across = np.maximum(np.abs(p[:, 0] - cx), np.abs(p[:, 1]))
    return np.maximum.reduce([(across - (half - (p[:, 2] - z0) * falls)) / np.hypot(1, falls), z0 - p[:, 2], p[:, 2] - z1])


def pick_tone(tones, level):
    return np.array(tones)[np.clip(level.astype(int), 0, len(tones) - 1)]


def logs_paint(p, lit):
    """Laid logs: each course its own tone, with a dark line between them."""
    course = np.floor(p[:, 2] / 3.3)
    within = p[:, 2] / 3.3 - course
    tone = value_noise(course * 7.3, (p[:, 0] + p[:, 1]) * 0.06) + value_noise((p[:, 0] + p[:, 1]) * 0.5, p[:, 2] * 2) * 0.5
    out = pick_tone(LOGS, lit * 2.6 + (tone - 0.75) * 1.1)
    out[within < 0.15] = LOGS[0] * 0.65
    return out


def shingles_paint(p, lit):
    row = np.floor(p[:, 2] / 1.9)
    x = p[:, 0] + p[:, 1] + row * 1.4
    tone = value_noise(np.floor(x / 2.8) * 3.1, row * 5.7)
    out = pick_tone(SHINGLES, lit * 2.5 + (tone - 0.5) * 1.3)
    out[(p[:, 2] / 1.9 - row) < 0.16] = SHINGLES[0] * 0.72
    return out


def boards_paint(p, lit):
    across = np.where(np.abs(p[:, 0]) > 0, p[:, 0] + p[:, 1], 0)
    board = np.floor(across / 3)
    out = pick_tone(TOWER_RED, lit * 2.4 + (value_noise(board * 3.3, p[:, 2] * 0.1) - 0.5) * 0.7)
    out[(across / 3 - board) < 0.13] = TOWER_RED[0] * 0.7
    return out


def planks_paint(p, lit, along):
    """A door or shutter's boards, set on the slant as in the photograph, the two halves meeting in the middle."""
    slant = (np.abs(along) + p[:, 2]) / 2
    out = pick_tone(TIMBER, lit * 2.2 + 0.2)
    out[(slant % 1) < 0.24] = TIMBER[0] * 0.6
    return out


def church_parts():
    """Everything but the fence's near sides, about the middle of the yard. The church is a cross of four arms of nearly equal length,
    and the bell tower was added as an extension of one of them, with the porch in its lower part."""
    parts = []
    def add(field, paint):
        parts.append((field, paint))
    cy = -15  # the crossing, in y; the arm with the tower comes towards the viewer's left along +y
    reach, half_arm, wall, ridge = 55, 17, 22, 47
    tower_y0, tower_y1 = cy + reach, cy + reach + 30

    # Both arms' roofs are shaped along x, about the crossing.
    x_arm = lambda p: p - np.array([0, cy, 0])
    y_arm = lambda p: np.stack([p[:, 1] - cy, p[:, 0], p[:, 2]], axis=1)

    def planks_upright(p, lit, along):
        board = np.floor(along / 2.3)
        out = pick_tone(TIMBER, lit * 2.2 + (value_noise(board * 3.7, p[:, 2] * 0.1) - 0.5) * 0.9)
        out[(along / 2.3 - board) < 0.16] = TIMBER[0] * 0.7
        return out

    def window(out, p, lit, face, along):
        z = p[:, 2]
        out[face & (np.abs(along) < 10) & (z > 6.5) & (z < 18.6)] = np.array(LOGS[0]) * 0.6
        shutter = face & (np.abs(along) > 4.3) & (np.abs(along) < 9.4) & (z > 7.2) & (z < 17.8)
        out[shutter] = planks_paint(p, lit, along)[shutter]
        pane = face & (np.abs(along) < 3.8) & (z > 7.2) & (z < 17.8)
        out[pane] = colour("#2b3540")
        out[pane & ((np.abs(along) < 0.35) | (((z - 7.2) % 3.5) < 0.5))] = colour("#efe9d8")

    def walls_paint(p, lit):
        out = logs_paint(p, lit)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        # Which wall a point is on.
        x_end = x > reach - 0.6
        arm_side = (np.abs(y - cy - half_arm) < 0.7) & (x > half_arm - 0.6)  # the long side of the arm running along +x, facing the viewer's left
        y_arm_side = (x > half_arm - 0.6) & (np.abs(x - half_arm) < 0.7) & (y - cy > half_arm)  # the side of the tower's arm, facing the viewer's right
        # Wide pale boards up the corners, and in the corner between the arms.
        corners = (x_end & (np.abs(y - cy) > half_arm - 4)) | (arm_side & ((x > reach - 4) | (x < half_arm + 3))) | (y_arm_side & (y - cy < half_arm + 3)) | (y_arm_side & (y > tower_y0 - 4))
        out[corners] = planks_upright(p, lit, x + y)[corners]
        # Scalloped trim under the eaves.
        scallop = (arm_side | y_arm_side) & (z > wall - 3) & (z - wall + 3 > 1.4 * np.abs(((x + y + 300) % 3) - 1.5))
        out[scallop] = pick_tone(TIMBER, lit * 2)[scallop]
        # A window with its shutters open on each side of the corner.
        window(out, p, lit, arm_side, x - 36)
        window(out, p, lit, y_arm_side, y - (cy + 36))
        # The gable's door, with a hatch of slanted boards over it.
        across = y - cy
        out[x_end & (np.abs(across) < 7.4) & (z < 17.2)] = np.array(LOGS[0]) * 0.6
        door = x_end & (np.abs(across) < 6.2) & (z < 16)
        out[door] = planks_upright(p, lit, across + 30)[door]
        out[x_end & (np.abs(across) < 5.6) & (z > 20) & (z < 31)] = np.array(LOGS[0]) * 0.6
        hatch = x_end & (np.abs(across) < 4.6) & (z > 21) & (z < 30)
        out[hatch] = planks_paint(p, lit, across)[hatch]
        return out

    add(lambda p: box_d(p, (-reach, cy - half_arm, 0), (reach, cy + half_arm, wall)), walls_paint)
    add(lambda p: box_d(p, (-half_arm, cy - reach, 0), (half_arm, tower_y0, wall)), walls_paint)
    add(lambda p: prism_d(x_arm(p), -reach, reach, half_arm, wall, ridge), walls_paint)
    add(lambda p: prism_d(y_arm(p), -reach, reach, half_arm, wall, ridge), walls_paint)

    # The roofs of the arms cross under the spire, their ends standing out over the gables.
    def one_roof(q):
        outer = prism_d(q, -reach - 4, reach + 4, half_arm + 4.5, wall - 3, ridge + 3)
        inner = prism_d(q, -99, 99, half_arm + 2, wall - 5.5, ridge)
        return np.maximum(outer, -np.maximum(inner, reach - 1 - np.abs(q[:, 0])))
    def roof_paint(p, lit):
        out = shingles_paint(p, lit)
        rim = p[:, 0] > reach + 3.2
        out[rim] = pick_tone(TIMBER, lit * 2.4)[rim]
        out[p[:, 0] > reach + 3.7] = pick_tone(FENCE_RED, lit * 2.4)[p[:, 0] > reach + 3.7]
        return out
    add(lambda p: one_roof(x_arm(p)), roof_paint)
    add(lambda p: one_roof(y_arm(p)), shingles_paint)

    # The belfry at the end of its arm: the porch in its lower part, of logs under a low roof of pale boards, and over it the shaft.
    def base_paint(p, lit):
        out = logs_paint(p, lit)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        side = x > half_arm - 0.5
        corner = (side & ((y > tower_y1 - 4) | (y < tower_y0 + 3))) | (y > tower_y1 - 0.5) & (np.abs(x) > half_arm - 4)
        out[corner] = planks_upright(p, lit, x + y)[corner]
        middle = (tower_y0 + tower_y1) / 2
        out[side & (np.abs(y - middle) < 9.4) & (z < 16)] = np.array(LOGS[0]) * 0.6
        door = side & (np.abs(y - middle) < 8.2) & (z < 14.8)
        out[door] = planks_upright(p, lit, y + 100)[door]
        out[door & (np.abs(y - middle) < 0.4)] = TIMBER[0] * 0.6
        return out
    add(lambda p: box_d(p, (-half_arm, tower_y0, 0), (half_arm, tower_y1, 20)), base_paint)
    tower_q = lambda p: np.stack([p[:, 0], p[:, 1] - (tower_y0 + tower_y1) / 2, p[:, 2]], axis=1)
    def skirt_paint(p, lit):
        seam = ((p[:, 0] + p[:, 1] + 300) % 3.6) < 0.45
        out = pick_tone([colour("#8d7468"), colour("#b89f90"), colour("#dcc8b8")], lit * 2.6)
        out[seam] = colour("#7d675c")
        return out
    add(lambda p: pyramid_d(tower_q(p), 0, 21.5, 19, 32, 10), skirt_paint)
    def shaft_paint(p, lit):
        out = boards_paint(p, lit)
        q = tower_q(p)
        x, y, z = q[:, 0], q[:, 1], q[:, 2]
        for face, along in ((y > 10, x), (x > 10, y)):
            out[face & (np.abs(along) < 4.6) & (np.abs(z - 42) < 4.6)] = np.array(LOGS[0]) * 0.6
            hatch = face & (np.abs(along) < 3.8) & (np.abs(z - 42) < 3.8)
            ray = (np.arctan2(z - 42, along) * 8 / 6.283 % 1) < 0.5
            out[hatch] = pick_tone(TIMBER, lit * 2 + 0.2)[hatch]
            out[hatch & ray] = TIMBER[0] * 0.6
            trim = face & (z > 51) & (z - 51 > 1.4 * np.abs(((along + 300) % 3) - 1.5))
            out[trim] = TOWER_RED[0] * 0.75
        return out
    add(lambda p: box_d(tower_q(p), (-10.5, -10.5, 26), (10.5, 10.5, 56)), shaft_paint)
    add(lambda p: pyramid_d(tower_q(p), 0, 15.5, 54.5, 69), shingles_paint)

    # Thin spires with a small knob, on the tower, over the crossing and on the gable.
    metal = lambda p, lit: pick_tone([colour("#5d6168"), colour("#8e939a"), colour("#c8ccd0")], lit * 2.6)
    tower_middle = (tower_y0 + tower_y1) / 2
    for x, y, bottom, top in ((0, tower_middle, 67, 90), (0, cy, ridge + 2, 68), (reach, cy, ridge, 64)):
        add(lambda p, x=x, y=y, bottom=bottom, top=top: capsule(p, (x, y, bottom), (x, y, top), 0.45), metal)
        add(lambda p, x=x, y=y, top=top: blob(p, (x, y, top - 2), (1, 1, 1.5)), metal)

    # Wooden decks at the two doors, and the trodden path from the gable's to the gate.
    def deck_paint(p, lit):
        out = pick_tone([colour("#7a6a58"), colour("#a8967f"), colour("#c8b69c")], lit * 2.6)
        out[(p[:, 0] + p[:, 1] + 300) % 2.6 < 0.34] = colour("#5e5145")
        return out
    add(lambda p: box_d(p, (reach, cy - 9, 0), (reach + 11, cy + 9, 1.6)), deck_paint)
    add(lambda p: box_d(p, (half_arm, tower_middle - 11, 0), (half_arm + 9, tower_middle + 11, 1.6)), deck_paint)
    earth = lambda p, lit: pick_tone(DIRT, 0.8 + (value_noise(p[:, 0] * 0.8, p[:, 1] * 0.8)) * 2.4)
    add(lambda p: np.maximum(capsule(p * np.array([1, 1, 0]), (66, cy, 0), (58, 84, 0), 4.2), np.abs(p[:, 2]) - 0.3), earth)
    add(lambda p: np.maximum(capsule(p * np.array([1, 1, 0]), (26, tower_middle, 0), (58, 76, 0), 3.4), np.abs(p[:, 2]) - 0.3), earth)

    # The stony yard: boulders with lichen in the corner between the arms, and low shrubs.
    def rock_field(p):
        rocks = [((38, 22, 4.5), (10, 8, 6.5)), ((27, 30, 3), (7, 6, 5)), ((46, 34, 3.2), (7, 6, 5)), ((36, 40, 2.2), (4.5, 4, 3.4))]
        return np.minimum.reduce([blob(p, at, radii) for at, radii in rocks]) - (noise3(p, 0.55, 3) - 0.5) * 1.8
    def rock_paint(p, lit):
        speck = noise3(p, 1.1, 9)
        out = pick_tone([colour("#55585a"), colour("#7d8284"), colour("#a4a9a8")], lit * 2.6)
        out[speck > 0.6] = colour("#b6bd9c")
        out[speck < 0.36] = colour("#474b4d")
        return out
    add(rock_field, rock_paint)
    def shrub_field(p):
        shrubs = [((80, 42, 3.5), (9, 7, 4.5)), ((82, -44, 3.5), (8, 10, 4.5)), ((-40, 40, 4), (10, 8, 5)), ((-70, 56, 4), (9, 8, 5)), ((80, 66, 3), (7, 6, 4))]
        return np.minimum.reduce([blob(p, at, radii) for at, radii in shrubs]) - (noise3(p, 0.8, 5) - 0.5) * 2.4
    def shrub_paint(p, lit):
        speck = noise3(p, 2.2, 11)
        return pick_tone([colour("#1f4a2c"), colour("#2f6a38"), colour("#4e8f46"), colour("#7ab55c")], lit * 3 + (speck - 0.5) * 1.6)
    add(shrub_field, shrub_paint)
    return parts + fence_parts(-1)


def fence_parts(way):
    """The red fence's far sides, or with way 1 the near ones, which someone in the churchyard walks behind: pickets with two rails, and
    posts capped in white. Its gate stands open on the path into the yard, and the sides lie on the edges of tiles."""
    parts = []
    def add(field, paint):
        parts.append((field, paint))
    fx, fy = 96, 80
    gate0, gate1 = 48, 64
    def fence(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        # Only this fence's sides, and a gap for the gate.
        y_side = np.abs(y - way * fy)
        x_side = np.abs(x - way * fx)
        along_x = np.where(way > 0, np.maximum(y_side, np.where((x > gate0) & (x < gate1), 99, 0)), y_side)
        along_y = x_side
        run_x = np.abs(((x + 300) % 3.1) - 1.55)
        run_y = np.abs(((y + 300) % 3.1) - 1.55)
        def picket(across, along, limit):
            tip = np.maximum(np.abs(z - 5) - 5 + across * 0.6, 0)
            q = np.stack([np.maximum(across - 0.72, 0), np.maximum(along - 0.3, 0), tip], axis=1)
            return np.maximum(np.linalg.norm(q, axis=1), limit)
        pickets = np.minimum(picket(run_x, along_x, np.abs(x) - fx), picket(run_y, along_y, np.abs(y) - fy))
        rail = np.minimum(np.linalg.norm(np.maximum(np.stack([np.abs(x) - fx, along_x - 0.5, np.abs(z - 7) - 0.45], axis=1), 0), axis=1),
                          np.linalg.norm(np.maximum(np.stack([np.abs(y) - fy, along_y - 0.5, np.abs(z - 7) - 0.45], axis=1), 0), axis=1))
        rail_low = np.minimum(np.linalg.norm(np.maximum(np.stack([np.abs(x) - fx, along_x - 0.5, np.abs(z - 2.6) - 0.45], axis=1), 0), axis=1),
                              np.linalg.norm(np.maximum(np.stack([np.abs(y) - fy, along_y - 0.5, np.abs(z - 2.6) - 0.45], axis=1), 0), axis=1))
        return np.minimum.reduce([pickets, rail, rail_low])
    add(fence, lambda p, lit: pick_tone(FENCE_RED, lit * 2.5))
    posts = [(x, way * fy) for x in range(-fx, fx + 1, 24)] + [(way * fx, y) for y in range(-fy, fy + 1, 20)]
    if way > 0:
        posts += [(gate0, fy), (gate1, fy)]
        # The gate's two leaves, swung in.
        def gate(p):
            leaves = []
            for x0 in (gate0, gate1):
                across = np.abs(p[:, 0] - x0)
                along = np.maximum(np.abs(p[:, 1] - (fy - 7)) - 7, 0)
                upright = np.abs(((p[:, 1] + 300) % 3.1) - 1.55) < 0.8
                rails = (np.abs(p[:, 2] - 7) < 0.5) | (np.abs(p[:, 2] - 2.6) < 0.5)
                tall = np.maximum(np.abs(p[:, 2] - 5) - 5, 0)
                solid = np.linalg.norm(np.stack([np.maximum(across - 0.35, 0), along, tall], axis=1), axis=1)
                leaves.append(np.where(upright | rails, solid, solid + 0.7))
            return np.minimum(*leaves)
        add(gate, lambda p, lit: pick_tone(FENCE_RED, lit * 2.5))
    def post_field(p):
        return np.minimum.reduce([box_d(p, (x - 1.1, y - 1.1, 0), (x + 1.1, y + 1.1, 11.8)) for x, y in posts])
    def post_paint(p, lit):
        out = pick_tone(FENCE_RED, lit * 2.5)
        cap = p[:, 2] > 10.4
        out[cap] = pick_tone([colour("#b9ae98"), colour("#ece3cf"), colour("#fbf6e8")], lit * 2.6)[cap]
        return out
    add(post_field, post_paint)
    return parts


def render_parts(parts, w, h, anchor):
    base = ray_points(w, h, *anchor)
    t = np.full(len(base), 210.0)
    hit = np.zeros(len(base), bool)
    live = np.arange(len(base))
    nearest = lambda p: np.minimum.reduce([field(p) for field, _ in parts])
    for _ in range(170):
        if not len(live):
            break
        d = nearest(base[live] + t[live, None])
        arrived = d < 0.03
        hit[live[arrived]] = True
        t[live] -= np.maximum(d, 0.03) / np.sqrt(3) * 0.9
        live = live[~arrived & (t[live] > -130)]
    out = np.zeros((int(h * DETAIL), int(w * DETAIL), 4), np.uint8)
    at = np.nonzero(hit)[0]
    p = base[at] + t[at, None]
    e = 0.05
    normal = np.stack([nearest(p + np.eye(3)[i] * e) - nearest(p - np.eye(3)[i] * e) for i in range(3)], axis=1)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    light = np.array([-0.35, 0.45, 0.82]) / np.linalg.norm([-0.35, 0.45, 0.82])
    lit = np.clip(normal @ light * 0.62 + 0.42, 0, 0.999)
    which = np.argmin([field(p) for field, _ in parts], axis=0)
    rgb = np.zeros((len(p), 3))
    for i, (_, paint) in enumerate(parts):
        chosen = which == i
        if chosen.any():
            rgb[chosen] = paint(p[chosen], lit[chosen])
    ys, xs = at // out.shape[1], at % out.shape[1]
    out[ys, xs, :3] = np.clip(rgb, 0, 255)
    out[ys, xs, 3] = 255
    solid = out[:, :, 3] > 0
    grown = solid.copy()
    for _ in range(2):
        g = grown.copy()
        g[1:] |= grown[:-1]; g[:-1] |= grown[1:]; g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]
        grown = g
    out[grown & ~solid] = (14, 20, 24, 255)
    return out


def make_church():
    Image.fromarray(render_parts(church_parts(), *CHURCH_SIZE, CHURCH_ANCHOR), "RGBA").save(OUT / "church.png", optimize=True)
    Image.fromarray(render_parts(fence_parts(1), *CHURCH_SIZE, CHURCH_ANCHOR), "RGBA").save(OUT / "church-fence.png", optimize=True)


def make_tree(spec):
    kind, i = spec
    field, sizes = TREES[kind]
    w, h, seed = sizes[i]
    return kind, i, render_tree(field(h - 4 - w / 4, seed), w, h, (w / 2, h - 3 - w / 4))


def js_noise(x, y):
    n = np.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return n - np.floor(n)


def tree_list():
    """Where the trees stand, as placeThings in src/world.js puts them: (kind, picture, x, y), far ones first."""
    trees = []
    for ty in range(HEIGHT):
        for tx in range(WIDTH):
            if MAP[ty][tx] != "t":
                continue
            kind = KINDS[ty][tx]
            which = int(js_noise(tx, ty * 3) * len(TREES[kind][1])) % len(TREES[kind][1])
            x = (tx - ty) * HW + OX + round((js_noise(tx, ty + 2) - 0.5) * 9)
            y = (tx + ty) * HH + TOP_PAD + HH + round((js_noise(tx + 2, ty) - 0.5) * 5)
            trees.append((kind, which, x, y))
    return sorted(trees, key=lambda t: t[3])


def shadow_layer(left, top, pw, ph):
    """The trees' shadows, long to the lower right, on one layer so that where they overlap they don't get darker."""
    canvas = Image.new("L", (pw, ph), 0)
    draw = ImageDraw.Draw(canvas)
    for kind, which, x, y in tree_list():
        w, h, _ = TREES[kind][1][which]
        length, wide = h * 0.62, w * 0.3
        sx, sy = (x - left) * DETAIL, (y - top) * DETAIL
        if not (-500 < sx < pw + 100 and -300 < sy < ph + 100):
            continue
        # The trunk's shadow from its foot, and the crown's further along it, with rough edges from a few overlapping ovals.
        draw.line([sx, sy, sx + length * 0.72 * DETAIL, sy + length * 0.3 * DETAIL], fill=255, width=int(DETAIL * 1.5))
        for i in range(5):
            t = 0.55 + i * 0.1125
            cx, cy = sx + t * length * 0.72 * DETAIL, sy + t * length * 0.3 * DETAIL
            r = wide * (0.5 + 0.5 * np.sin((t - 0.45) * 5)) * DETAIL
            if -200 < cx < pw + 200 and -200 < cy < ph + 200:
                draw.ellipse([cx - r, cy - r * 0.5, cx + r, cy + r * 0.5], fill=255)
    # The church's, over the ground to its lower right.
    corners = [(52, 34), (54, 34), (54, 33), (56, 33), (56, 30), (58.4, 30.6), (58.4, 34), (55, 34), (55, 37), (52.6, 37)]
    draw.polygon([((to_screen(x, y)[0] - left) * DETAIL, (to_screen(x, y)[1] - top) * DETAIL) for x, y in corners], fill=255)
    return np.array(canvas.filter(ImageFilter.GaussianBlur(2))) / 255


def picture_of_ground(left, top, w, h):
    image, _ = render_ground(left, top, w, h)
    shade = shadow_layer(left, top, image.shape[1], image.shape[0])[..., None]
    image = image * (1 - shade * 0.36) + colour("#0a1c2c") * shade * 0.36
    add_plants(image, left, top)
    return np.clip(image, 0, 255).astype(np.uint8)


def preview(path, tx, ty):
    cx, cy = to_screen(tx, ty)
    left, top = cx - VIEW_W / 2, cy - VIEW_H / 2
    picture = Image.fromarray(picture_of_ground(left, top, VIEW_W, VIEW_H), "RGB").convert("RGBA")
    made = {}
    for kind, which, x, y in tree_list():
        w, h, _ = TREES[kind][1][which]
        px, py = int((x - left - w / 2) * DETAIL), int((y + 2 - h - top) * DETAIL)
        if px > picture.width or py > picture.height or px < -w * DETAIL or py < -h * DETAIL:
            continue
        if (kind, which) not in made:
            made[kind, which] = Image.fromarray(make_tree((kind, which))[2], "RGBA")
        tree = made[kind, which]
        box = (max(0, -px), max(0, -py), tree.width, tree.height)
        picture.alpha_composite(tree.crop(box), (max(0, px), max(0, py)))
    picture.save(path)


def make_chunk(spec):
    column, row = spec
    left, top = column * CHUNK / DETAIL, row * CHUNK / DETAIL
    Image.fromarray(picture_of_ground(left, top, CHUNK / DETAIL, CHUNK / DETAIL), "RGB").save(OUT / f"ground-{column}-{row}.webp", quality=84, method=6)
    return spec


def main():
    if sys.argv[1:2] == ["preview"]:
        preview(sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
        return
    OUT.mkdir(parents=True, exist_ok=True)
    trees = [(kind, i) for kind, (_, sizes) in TREES.items() for i in range(len(sizes))]
    if sys.argv[1:] == ["trees"]:
        for kind, i, image in map(make_tree, trees):
            Image.fromarray(image, "RGBA").save(OUT / f"tree-{kind}-{i}.png", optimize=True)
        return
    if sys.argv[1:] == ["church"]:
        make_church()
        return
    workers = int(sys.argv[1]) if sys.argv[1:] else 6
    specs = [(c, r) for r in range(int(np.ceil(WORLD_H * DETAIL / CHUNK))) for c in range(int(np.ceil(WORLD_W * DETAIL / CHUNK)))]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for _ in pool.map(make_chunk, specs):
            pass
        for kind, i, image in pool.map(make_tree, trees):
            Image.fromarray(image, "RGBA").save(OUT / f"tree-{kind}-{i}.png", optimize=True)
    make_church()
    print(len(specs), "pieces of ground and", len(trees), "trees written")


if __name__ == "__main__":
    main()
