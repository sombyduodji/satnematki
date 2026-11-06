#!/usr/bin/env python3
"""What the rooms made in 3D share: the library, the home and the general store, made as the classrooms are in tools/make_classrooms.py.

A room is its walls, windows and floor, and parts: each a shape (a distance function over points n×3 in the world's units, a tile being 16),
its colours, whether it glows by itself, and which tiles of data/map.js show it. Everything is lit together, so the sun through the windows
falls across the floor and whatever stands in its way. The tiles decide what can be walked on; this only decides how it looks.

Each room goes into art/<room>/: the floor in pieces with everything drawn into it, one sheet with each tile's picture to draw again over
someone behind it, and fixtures.js saying where each is. tools/make_light.py bakes the same room's light for the GPU.
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_forest import colour, value_noise  # noqa: E402
from make_store import SHEET_GAP, box, on_whole_pixels, tones  # noqa: E402,F401

ROOT = Path(__file__).resolve().parent.parent
DETAIL = 4
TILE = 16
HW, HH, TOP_PAD, EDGE, MARGIN = 16, 8, 60, 10, 80  # as in src/world.js
CHUNK = 512  # picture pixels on a side, as the forest's
CELL_H = 64  # how high a tile's picture is, in the world's pixels
WIDER = 4  # world's pixels of room round a tile's picture, for what stands out from the wall
PROUD = 2.6  # how far a tile of a back wall may reach out into the room, for what hangs on it
ROOM_LIGHT = np.array([-0.5, 0.35, 0.8]) / np.linalg.norm([-0.5, 0.35, 0.8])
_maps = (ROOT / "data/map.js").read_text(encoding="utf-8")
MAPS = json.loads(_maps[_maps.index("{"):_maps.rindex("}") + 1])
ROOMS = {}


def solid(tone):
    return lambda p: np.tile(colour(tone), (len(p), 1))


def cylinder(p, x, y, r, z0, z1):
    """An upright round post, from z0 to z1."""
    side = np.hypot(p[:, 0] - x, p[:, 1] - y) - r
    return np.maximum(side, np.maximum(z0 - p[:, 2], p[:, 2] - z1))


def ellipsoid(p, centre, radii):
    """Close enough to a true distance for a bounded, rounded shape."""
    q = (p - np.asarray(centre, float)) / np.asarray(radii, float)
    k = np.linalg.norm(q, axis=1)
    return (k - 1) * np.min(radii)


def picture(path_or_array):
    return np.array(path_or_array)


def texture(image, u, v):
    """Look up an RGB array at u and v from 0 to 1, across and down."""
    h, w = image.shape[:2]
    return image[np.clip((v * (h - 0.01)).astype(int), 0, h - 1), np.clip((u * (w - 0.01)).astype(int), 0, w - 1)].astype(float)


class Room:
    """One room's sizes, windows and light, and what stands where.

    windows_x are pairs of tiles along y in the back left wall (x = x0), windows_y pairs along x in the back right wall (y = y0).
    walls are the letters of the back walls' tiles, low those of the low walls at the near sides.
    """

    def __init__(self, name, *, wall_h, sun, windows_x=(), windows_y=(), win_low=14, win_high=38, transom=None, walls="W", low="X",
                 back="#191614", lamps=(), lamp_tone=(1.08, 1.0, 0.86), ambient=0.78, pools=(), sun_tone=(1.3, 1.2, 0.98), lamp_strength=0.14,
                 edge=2, proud=PROUD, outdoors=False, shade_tone=(1, 1, 1), tall=0):
        self.name, self.wall_h, self.walls_at, self.low_at, self.back = name, wall_h, walls, low, back
        self.sun = np.asarray(sun, float) / np.linalg.norm(sun)
        self.windows_x, self.windows_y, self.win_low, self.win_high = list(windows_x), list(windows_y), win_low, win_high
        self.transom = transom if transom is not None else win_low + (win_high - win_low) * 0.7
        self.lamps, self.lamp_tone, self.ambient = list(lamps), np.array(lamp_tone), ambient
        # Warm pools of light under lamps, such as reading lamps, as (x, y, z) of the bulb, and how far it reaches (13 if not given).
        self.pools, self.sun_tone, self.lamp_strength = list(pools), np.array(sun_tone), lamp_strength
        self.map = MAPS[name]["rows"]
        self.height, self.width = len(self.map), len(self.map[0])
        self.world_w, self.world_h = (self.width + self.height) * HW + MARGIN * 2, (self.width + self.height) * HH + TOP_PAD + EDGE + 60
        self.ox = self.height * HW + MARGIN
        # How many tiles thick the back walls are, how far what's on them may reach out, and whether the sky is open above, as in the car park.
        self.edge, self.proud, self.outdoors, self.shade_tone = edge, proud, outdoors, np.array(shade_tone)
        self.tall = tall  # how much higher than a cell a tile's picture may reach, for tall buildings
        self.x0, self.y0, self.x1, self.y1 = edge * TILE, edge * TILE, (self.width - edge) * TILE, (self.height - edge) * TILE
        self.out = ROOT / "art" / name
        self.parts = []
        self.occluders = []  # boxes, (low, high), that shade and cast shadows
        self.floor = solid("#b98a58")
        self.floor_at = None  # where else there's floor to draw, past the room's own: a function of p giving True there
        self.no_floor = None  # and where inside the room there's none, as beyond an L-shaped room's corner
        self.wall_paint_x = self.wall_paint_y = None
        self.outdoors = None
        # Furniture drawn whole rather than cut to tiles, each its parts (shape, colours, glows), the box it's in, and how deep it stands.
        self.pieces, self.pieces_depth = {}, {}
        ROOMS[name] = self

    def add(self, field, paint, letters, glows=False):
        self.parts.append((field, paint, glows, letters))

    def add_piece(self, key, parts, low, high, depth):
        """parts: (shape, colours, glows); low and high: the box it's in; depth: x + y of its middle, in tiles, for what's drawn over what."""
        self.pieces[key] = (parts, low, high)
        self.pieces_depth[key] = depth

    def tiles(self, letter):
        return [(x, y) for y, row in enumerate(self.map) for x, t in enumerate(row) if t == letter]

    def runs(self, letter):
        """Each straight run of a letter along x, as (x0, x1, y) in tiles, x1 being past the last."""
        found = []
        for y, row in enumerate(self.map):
            x = 0
            while x < len(row):
                if row[x] == letter:
                    start = x
                    while x < len(row) and row[x] == letter:
                        x += 1
                    found.append((start, x, y))
                else:
                    x += 1
        return found

    def runs_y(self, letter):
        """Each straight run of a letter along y, as (y0, y1, x) in tiles."""
        found = []
        for x in range(self.width):
            y = 0
            while y < self.height:
                if self.map[y][x] == letter:
                    start = y
                    while y < self.height and self.map[y][x] == letter:
                        y += 1
                    found.append((start, y, x))
                else:
                    y += 1
        return found

    # ------------------------------------------------------------ the walls
    def window_hole_x(self, p):
        if not self.windows_x:
            return np.full(len(p), 1e3)
        return np.minimum.reduce([box(p, (self.x0 - 12, a * TILE + 2, self.win_low), (self.x0 + 2, b * TILE - 2, self.win_high)) for a, b in self.windows_x])

    def window_hole_y(self, p):
        if not self.windows_y:
            return np.full(len(p), 1e3)
        return np.minimum.reduce([box(p, (a * TILE + 2, self.y0 - 12, self.win_low), (b * TILE - 2, self.y0 + 2, self.win_high)) for a, b in self.windows_y])

    def wall_x(self, p):
        return np.maximum(box(p, (self.x0 - 5, self.y0 - 5, 0), (self.x0, self.y1, self.wall_h)), -self.window_hole_x(p))

    def wall_y(self, p):
        return np.maximum(box(p, (self.x0 - 5, self.y0 - 5, 0), (self.x1, self.y0, self.wall_h)), -self.window_hole_y(p))

    def low_wall_y(self, p):
        return box(p, (self.x0 - 5, self.y1, 0), (self.x1 + 5, self.y1 + 5, 8))

    def low_wall_x(self, p):
        return box(p, (self.x1, self.y0 - 5, 0), (self.x1 + 5, self.y1 + 5, 8))

    def backdrop(self, p):
        d = []
        if self.windows_x:
            d.append(box(p, (self.x0 - 14, 0, 0), (self.x0 - 12, self.height * TILE, self.win_high + 0.5)))
        if self.windows_y:
            d.append(box(p, (0, self.y0 - 14, 0), (self.width * TILE, self.y0 - 12, self.win_high + 0.5)))
        return np.minimum.reduce(d)

    def bars(self, p):
        """Each window's frame, a post down its middle and a transom across."""
        d = [np.full(len(p), 1e3)]
        for a, b in self.windows_x:
            mid = (a + b) * TILE / 2
            d += [box(p, (self.x0 - 4, mid - 0.7, self.win_low), (self.x0 - 2, mid + 0.7, self.win_high)),
                  box(p, (self.x0 - 4, a * TILE, self.transom - 0.6), (self.x0 - 2, b * TILE, self.transom + 0.6)),
                  box(p, (self.x0 - 1.2, a * TILE + 1, self.win_low - 1.4), (self.x0 + 1.6, b * TILE - 1, self.win_low))]  # the sill
        for a, b in self.windows_y:
            mid = (a + b) * TILE / 2
            d += [box(p, (mid - 0.7, self.y0 - 4, self.win_low), (mid + 0.7, self.y0 - 2, self.win_high)),
                  box(p, (a * TILE, self.y0 - 4, self.transom - 0.6), (b * TILE, self.y0 - 2, self.transom + 0.6)),
                  box(p, (a * TILE + 1, self.y0 - 1.2, self.win_low - 1.4), (b * TILE - 1, self.y0 + 1.6, self.win_low))]
        return np.minimum.reduce(d)

    def default_outdoors(self, p):
        """Birches and a pale sky beyond the windows."""
        along = np.where(np.abs(p[:, 0] - (self.x0 - 13)) < 1.5, p[:, 1], p[:, 0])
        z = p[:, 2]
        out = np.tile(colour("#dff2fb"), (len(p), 1))
        leaves = value_noise(along * 0.28, z * 0.5) > 0.44 + (z - 20) * 0.03
        out[leaves] = np.array([colour("#a4d68a"), colour("#c8e8a8")])[(value_noise(along * 0.9, z * 0.9) > 0.5).astype(int)][leaves]
        out[(np.abs(((along + 300) % 23) - 11) < 0.7) & (z < 30)] = colour("#f4f1e8")
        out[z < 16] = colour("#8dc06a")
        return out

    def low_paint(self, p):
        out = tones(["#a89f88", "#c8bfa8"], np.ones(len(p)))
        out[p[:, 2] > 7.2] = colour("#f4eeda")
        return out

    def wall_parts(self):
        made = [(self.wall_x, self.wall_paint_x or solid("#efe3c8"), False, self.walls_at), (self.wall_y, self.wall_paint_y or solid("#efe3c8"), False, self.walls_at)]
        if self.windows_x or self.windows_y:
            made += [(self.bars, solid("#f6f2e6"), False, self.walls_at), (self.backdrop, self.outdoors or self.default_outdoors, True, self.walls_at)]
        made += [(self.low_wall_y, self.low_paint, False, self.low_at), (self.low_wall_x, self.low_paint, False, self.low_at)]
        return made

    def all_parts(self):
        return self.wall_parts() + self.parts

    # ------------------------------------------------------------ the light
    def occluder_field(self, p):
        if not self.occluders:
            return np.full(len(p), 1e3)
        return np.minimum.reduce([box(p, low, high) for low, high in self.occluders])

    def through_a_window(self, p):
        """Back along the sun's rays, whether a point reaches a pane. Outdoors, everywhere does."""
        if self.outdoors:
            return np.ones(len(p), bool)
        reached = np.zeros(len(p), bool)
        sun = self.sun
        if self.windows_x and sun[0] < 0:
            t = np.maximum(p[:, 0] - self.x0, 0) / -sun[0]
            y, z = p[:, 1] + sun[1] * t, p[:, 2] + sun[2] * t
            for a, b in self.windows_x:
                mid = (a + b) * TILE / 2
                reached |= (y > a * TILE + 3) & (y < b * TILE - 3) & (z > self.win_low + 1) & (z < self.win_high - 1) & (np.abs(y - mid) > 0.8) & (np.abs(z - self.transom) > 0.8)
        if self.windows_y and sun[1] < 0:
            t = np.maximum(p[:, 1] - self.y0, 0) / -sun[1]
            x, z = p[:, 0] + sun[0] * t, p[:, 2] + sun[2] * t
            for a, b in self.windows_y:
                mid = (a + b) * TILE / 2
                reached |= (x > a * TILE + 3) & (x < b * TILE - 3) & (z > self.win_low + 1) & (z < self.win_high - 1) & (np.abs(x - mid) > 0.8) & (np.abs(z - self.transom) > 0.8)
        return reached

    def lamp_light(self, p):
        if not self.lamps:
            return np.zeros(len(p))
        return np.minimum(sum(np.exp(-(((p[:, 0] - x) ** 2 + (p[:, 1] - y) ** 2) / 2400)) for x, y in self.lamps), 1)

    def pool_light(self, p, normal):
        """How much each lamp close by lights a surface: falling off fast, and only where it faces the bulb."""
        if not self.pools:
            return np.zeros(len(p))
        total = np.zeros(len(p))
        for pool in self.pools:
            x, y, z = pool[:3]
            reach = pool[3] if len(pool) > 3 else 13
            d = np.array((x, y, z)) - p
            r = np.linalg.norm(d, axis=1)
            facing = np.clip(np.sum(normal * d, axis=1) / np.maximum(r, 1e-3), 0, 1)
            total += facing * np.exp(-(r / reach) ** 2) * (p[:, 2] < z + 0.5)
        return np.minimum(total, 1)

    def sky_light(self, p):
        """The daylight from the windows that isn't direct sun: high by them, fading into the room. Outdoors, the whole sky's."""
        if self.outdoors:
            return np.ones(len(p))
        light = np.zeros(len(p))
        if self.windows_x:
            light = np.maximum(light, np.exp(-np.maximum(p[:, 0] - self.x0, 0) / 100))
        if self.windows_y:
            light = np.maximum(light, 0.8 * np.exp(-np.maximum(p[:, 1] - self.y0, 0) / 100))
        return light

    def lit(self, p, normal, rgb):
        """The colour of these surfaces in the room's light, the lamps, what shades them, and the sun where it gets in."""
        facing = normal @ ROOM_LIGHT
        shade = np.select([facing > 0.75, facing > 0.3, facing > -0.1], [1.05, 0.95, 0.82], 0.7)
        lamps = self.lamp_light(p)
        pools = self.pool_light(p, normal)
        light = shade * (self.ambient + 0.24 * self.sky_light(p) + self.lamp_strength * lamps) + 0.42 * pools
        def closeness(reach):
            return np.clip(np.minimum(self.occluder_field(p + normal * reach), np.minimum(p[:, 0] - self.x0, p[:, 1] - self.y0) + reach) / reach, 0, 1)
        light = light * (0.5 + 0.28 * closeness(2.2) + 0.22 * closeness(7))
        out = rgb * light[..., None] * self.shade_tone  # in the shade, outdoors, the sky's blue
        # The lamps are warm.
        out = out * (1 + (self.lamp_tone - 1) * np.minimum(lamps + pools * 2, 1.4)[..., None])
        idx = np.nonzero(self.through_a_window(p) & (normal @ self.sun > 0.05))[0]
        if len(idx):
            q = p[idx] + normal[idx] * 0.4
            travel = np.zeros(len(idx))
            blocked = np.zeros(len(idx), bool)
            for _ in range(22):
                d = self.occluder_field(q + self.sun * travel[..., None])
                blocked |= d < 0.06
                travel += np.maximum(d, 0.6)
            sunny = idx[~blocked]
            soft = 0.72 + 0.28 * self.through_a_window(p[sunny] + np.array([1.1, -0.7, 0]))
            warm = np.minimum(rgb[sunny] * self.sun_tone * np.maximum(light[sunny], 0.82)[..., None] + 12, 255)
            if self.outdoors:
                warm = np.minimum(warm * (1 + (self.lamp_tone - 1) * np.minimum(self.pool_light(p[sunny], normal[sunny]) * 2, 1)[..., None]), 255)
            out[sunny] = out[sunny] * (1 - soft[..., None]) + warm * soft[..., None]
        return out

    def light_boxes(self):
        """For tools/make_light.py: what stands on the floor, by its height."""
        return self.occluders


# ------------------------------------------------------------------ the floor
def make_chunk(spec):
    name, column, row = spec
    room = ROOMS[name]
    left, top = column * CHUNK / DETAIL, row * CHUNK / DETAIL
    u = (np.arange(CHUNK) + 0.5) / DETAIL + left - room.ox
    v = (np.arange(CHUNK) + 0.5) / DETAIL + top - TOP_PAD
    uu, vv = np.meshgrid(u, v)
    p = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    image = np.tile(colour(room.back), (CHUNK * CHUNK, 1))
    inside = (p[:, 0] > room.x0 - 6) & (p[:, 1] > room.y0 - 6) & (p[:, 0] < room.x1 + 6) & (p[:, 1] < room.y1 + 6)
    if room.floor_at is not None:
        inside |= room.floor_at(p)
    if room.no_floor is not None:
        inside &= ~room.no_floor(p)
    if inside.any():
        q = p[inside]
        out = room.lit(q + np.array([0, 0, 0.01]), np.tile(np.array([0, 0, 1.0]), (len(q), 1)), room.floor(q))
        # A polished floor mirrors the windows, faintly.
        t = np.maximum(q[:, 0] - room.x0, 0)
        for a, b in room.windows_x:
            shine = (q[:, 1] - t > a * TILE + 2) & (q[:, 1] - t < b * TILE - 2) & (t > room.win_low) & (t < room.win_high)
            out[shine] = out[shine] * 0.93 + colour("#eaf4fa") * 0.07
        t = np.maximum(q[:, 1] - room.y0, 0)
        for a, b in room.windows_y:
            shine = (q[:, 0] - t > a * TILE + 2) & (q[:, 0] - t < b * TILE - 2) & (t > room.win_low) & (t < room.win_high)
            out[shine] = out[shine] * 0.94 + colour("#eaf4fa") * 0.06
        image[inside] = out
    return (column, row), np.clip(image, 0, 255).astype(np.uint8).reshape(CHUNK, CHUNK, 3)


# -------------------------------------------------------------- each picture
def march(parts, room, base, far):
    """Where each ray lands on these shapes, in shaded colour. parts are (shape, colour, glows)."""
    nearest = lambda p: np.minimum.reduce([part[0](p) for part in parts])
    t = np.full(len(base), far)
    hit = np.zeros(len(base), bool)
    live = np.arange(len(base))
    for _ in range(90):
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
            rgb[chosen] = colours if part[2] else room.lit(p[chosen], normal[chosen], colours)
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


def _cropped(out, depth):
    """A picture cut to what's in it, on the world's whole pixels, with its depth, and where the cut begins."""
    rows, columns = np.nonzero(out[:, :, 3].any(axis=1))[0], np.nonzero(out[:, :, 3].any(axis=0))[0]
    picture, x1, y1 = on_whole_pixels(out, rows, columns)
    return picture, depth[y1:y1 + picture.shape[0], x1:x1 + picture.shape[1]], x1, y1


def _depth_of(at, t, w, h):
    depth = np.full(w * h, -1e6)
    depth[at] = t[at]
    return depth.reshape(h, w)


def render_tile(spec):
    """A tile's walls and fixtures, cut to the tile. Its picture, depth, and where it goes in the world, in picture pixels."""
    name, tx, ty = spec
    room = ROOMS[name]
    letter = room.map[ty][tx]
    w, h = (32 + 2 * WIDER) * DETAIL, (CELL_H + WIDER + room.tall) * DETAIL
    u = (np.arange(w) + 0.5) / DETAIL - 16 - WIDER + (tx - ty) * HW
    v = (np.arange(h) + 0.5) / DETAIL - CELL_H - room.tall + (tx + ty) * HH + 16
    uu, vv = np.meshgrid(u, v)
    base = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    x0, y0 = tx * TILE, ty * TILE
    reach_x = room.proud if tx == room.edge - 1 else 0
    reach_y = room.proud if ty == room.edge - 1 else 0
    def clipped(field):
        return lambda p: np.maximum(field(p), np.maximum(np.maximum(x0 - p[:, 0], p[:, 0] - x0 - TILE - reach_x), np.maximum(y0 - p[:, 1], p[:, 1] - y0 - TILE - reach_y)))
    # A shape can be made for each tile, from only what's near it, when there are many.
    mine = [((part[0].for_tile(tx, ty) if hasattr(part[0], "for_tile") else part[0]), *part[1:]) for part in room.all_parts() if letter in part[3]]
    parts = [(clipped(part[0]), part[1], part[2]) for part in mine]
    if not parts:
        return spec, None
    at, t, rgb = march(parts, room, base, 80.0)
    if at is None:
        return spec, None
    out = picture_from(at, t, rgb, w, h)
    # Where a tile has only been cut off from the next one there's nothing to see: that one's picture has what's really there.
    cut = np.abs(np.min([part[0](base[at] + t[at, None]) for part in mine], axis=0)) > 0.12
    out[(at // w)[cut], (at % w)[cut]] = 0
    if not out[:, :, 3].any():
        return spec, None
    picture, depth, x1, y1 = _cropped(out, _depth_of(at, t, w, h))
    left = ((tx - ty) * HW + room.ox - 16 - WIDER) * DETAIL + x1
    top = ((tx + ty) * HH + TOP_PAD + 16 - CELL_H - room.tall) * DETAIL + y1
    return spec, (picture, depth, left, top)


def render_piece(spec):
    """A piece of furniture, whole: its picture, depth, and where it goes in the world, in picture pixels."""
    name, _, key = spec
    room = ROOMS[name]
    parts, low, high = room.pieces[key]
    corners = np.array([[x, y, z] for x in (low[0], high[0]) for y in (low[1], high[1]) for z in (low[2], high[2])])
    us, vs = corners[:, 0] - corners[:, 1], (corners[:, 0] + corners[:, 1]) / 2 - corners[:, 2]
    left = int(np.floor(us.min() + room.ox - 2)) * DETAIL
    top = int(np.floor(vs.min() + TOP_PAD - 2)) * DETAIL
    w = int(np.ceil(us.max() + room.ox + 2)) * DETAIL - left
    h = int(np.ceil(vs.max() + TOP_PAD + 2)) * DETAIL - top
    u = (left + np.arange(w) + 0.5) / DETAIL - room.ox
    v = (top + np.arange(h) + 0.5) / DETAIL - TOP_PAD
    uu, vv = np.meshgrid(u, v)
    base = np.stack([vv.ravel() + uu.ravel() / 2, vv.ravel() - uu.ravel() / 2, np.zeros(uu.size)], axis=1)
    at, t, rgb = march(parts, room, base, high[2] + 4)
    if at is None:
        return spec, None
    out = picture_from(at, t, rgb, w, h)
    picture, depth, x1, y1 = _cropped(out, _depth_of(at, t, w, h))
    return spec, (picture, depth, left + x1, top + y1)


def _render(spec):
    return render_piece(spec) if spec[1] == "piece" else render_tile(spec)


def make_room(pool, room):
    room.out.mkdir(parents=True, exist_ok=True)
    chunks = [(room.name, c, r) for r in range(int(np.ceil(room.world_h * DETAIL / CHUNK))) for c in range(int(np.ceil(room.world_w * DETAIL / CHUNK)))]
    letters = set("".join(part[3] for part in room.all_parts()))
    specs = [(room.name, x, y) for y in range(room.height) for x in range(room.width) if room.map[y][x] in letters]
    specs += [(room.name, "piece", key) for key in room.pieces]
    floor = dict(pool.map(make_chunk, chunks))
    pictures = [item for item in pool.map(_render, specs) if item[1] is not None]
    # It all goes into the floor's pictures, drawn just once, each pixel from whatever is nearest there. A tile or a piece is only drawn
    # again over someone behind it, and then only what shows of it. The back walls never need to be.
    columns, rows = max(c for c, _ in floor) + 1, max(r for _, r in floor) + 1
    world = np.zeros((rows * CHUNK, columns * CHUNK, 3), np.uint8)
    for (column, row), image in floor.items():
        world[row * CHUNK:(row + 1) * CHUNK, column * CHUNK:(column + 1) * CHUNK] = image
    nearest = np.zeros(world.shape[:2])  # the floor is at 0, and what stands on it nearer
    owner = np.full(world.shape[:2], -1, np.int32)
    order = lambda item: (item[0][1] + item[0][2]) if item[0][1] != "piece" else room.pieces_depth[item[0][2]]
    pictures.sort(key=order)
    for i, (spec, (picture, depth, left, top)) in enumerate(pictures):
        ph, pw = picture.shape[:2]
        here = (picture[..., 3] > 0) & (depth > nearest[top:top + ph, left:left + pw] - 0.05)
        world[top:top + ph, left:left + pw][here] = picture[..., :3][here]
        nearest[top:top + ph, left:left + pw][here] = depth[here]
        owner[top:top + ph, left:left + pw][here] = i
    for column, row in floor:
        Image.fromarray(world[row * CHUNK:(row + 1) * CHUNK, column * CHUNK:(column + 1) * CHUNK], "RGB").save(room.out / f"ground-{column}-{row}.webp", quality=84, method=6)
    kept = []
    for i, (spec, (picture, depth, left, top)) in enumerate(pictures):
        if spec[1] != "piece" and (spec[1] < 2 or spec[2] < 2):
            continue
        ph, pw = picture.shape[:2]
        shown = picture.copy()
        shown[owner[top:top + ph, left:left + pw] != i] = 0
        if not shown[..., 3].any():
            continue
        cut, _, x1, y1 = _cropped(shown, depth)
        kept.append((spec, cut, left + x1, top + y1))
    # All into one sheet, row after row, and where each one is: a tile's place in its cell, a piece's in the world, both in picture pixels.
    sheet_w = 2048
    kept.sort(key=lambda item: -item[1].shape[0])
    x = y = row_h = 0
    places = {}
    for spec, picture, left, top in kept:
        ph, pw = picture.shape[:2]
        if x + pw > sheet_w:
            x, y, row_h = 0, y + row_h, 0
        if spec[1] == "piece":
            places[f"piece:{spec[2]}"] = [x, y, pw, ph, left, top]
        else:
            tx, ty = spec[1], spec[2]
            places[f"{tx},{ty}"] = [x, y, pw, ph, left - ((tx - ty) * HW + room.ox - 16) * DETAIL, top - ((tx + ty) * HH + TOP_PAD + 16 - CELL_H) * DETAIL]
        x, row_h = x + pw + SHEET_GAP, max(row_h, ph + SHEET_GAP)
    sheet = np.zeros((max(y + row_h, 1), sheet_w, 4), np.uint8)
    for spec, picture, _, _ in kept:
        sx, sy, pw, ph = places[f"piece:{spec[2]}" if spec[1] == "piece" else f"{spec[1]},{spec[2]}"][:4]
        sheet[sy:sy + ph, sx:sx + pw] = picture
    Image.fromarray(sheet, "RGBA").save(room.out / "fixtures.webp", quality=90, alpha_quality=100, method=6)
    (room.out / "fixtures.js").write_text(f"// Generated by tools/{Path(sys.argv[0]).name}: where each tile's picture is on the room's sheet, and where it goes in its {CELL_H * DETAIL}-high cell;\n"
                                          f"// for a piece of furniture (piece:…), where it goes in the world. In picture pixels, {DETAIL} to the world's pixel.\n"
                                          f"(window.MAHTTE_ROOMS ??= {{}})[{json.dumps(room.name)}] = {json.dumps(places, separators=(',', ':'))};\n", encoding="utf-8")
    print(room.name, len(chunks), "pieces of floor,", len(kept), "tiles and pieces, sheet", sheet.shape)
    return places


def make(names, workers=6):
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for name in names:
            make_room(pool, ROOMS[name])


class TileBoxes:
    """Many boxes, of which each tile's picture needs only those near it: a shape for any point, and a quicker one for each tile."""

    def __init__(self, boxes):
        self.boxes = list(boxes)

    def __call__(self, p):
        return np.minimum.reduce([box(p, low, high) for low, high in self.boxes]) if self.boxes else np.full(len(p), 1e3)

    def for_tile(self, tx, ty):
        near = [(low, high) for low, high in self.boxes
                if low[0] < (tx + 1) * TILE + 6 and high[0] > tx * TILE - 6 and low[1] < (ty + 1) * TILE + 6 and high[1] > ty * TILE - 6]
        return TileBoxes(near)


def low_walls_of(room, letter, height=8, thick=5, floor_letters=None):
    """Low walls along every edge between a tile of the letter and the floor beside it, on the letter's side: a room of any shape."""
    rows = room.map
    def floor(x, y):
        if not (0 <= y < room.height and 0 <= x < room.width):
            return False
        t = rows[y][x]
        return t != letter and t != "_" and (floor_letters is None or t in floor_letters)
    boxes = []
    for y in range(room.height):
        for x in range(room.width):
            if rows[y][x] != letter:
                continue
            x0, y0 = x * TILE, y * TILE
            if floor(x - 1, y):
                boxes.append(((x0, y0 - 0.01, 0), (x0 + thick, y0 + TILE + 0.01, height)))
            if floor(x + 1, y):
                boxes.append(((x0 + TILE - thick, y0 - 0.01, 0), (x0 + TILE, y0 + TILE + 0.01, height)))
            if floor(x, y - 1):
                boxes.append(((x0 - 0.01, y0, 0), (x0 + TILE + 0.01, y0 + thick, height)))
            if floor(x, y + 1):
                boxes.append(((x0 - 0.01, y0 + TILE - thick, 0), (x0 + TILE + 0.01, y0 + TILE, height)))
            # Where the floor is only round the corner, a post, so that two walls meet.
            for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                if floor(x + dx, y + dy) and not floor(x + dx, y) and not floor(x, y + dy):
                    cx = x0 if dx < 0 else x0 + TILE - thick
                    cy = y0 if dy < 0 else y0 + TILE - thick
                    boxes.append(((cx, cy, 0), (cx + thick, cy + thick, height)))
    return boxes
