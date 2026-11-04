#!/usr/bin/env python3
"""Draw the player characters: base models (art/mahtte/base/) and every sprite sheet.

The base models are the reference later animation and clothing start from.
Colours, clothing and hair live here, so a correction is made once. The design
follows Store norske leksikon's article on the Karasjok kofta; see
art/mahtte/README.md for what each part is and what still needs checking.

Usage: python3 tools/make_mahtte.py
"""
from itertools import product
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art/mahtte"

# Light comes from the top left. Each ramp runs dark, mid, light.
BLUE = ("#17316a", "#2450a6", "#3a78d6")
RED = ("#7d1a24", "#bb2a2d", "#e44c3b")
YEL = ("#b57a14", "#ecb92e", "#ffe27a")
SKIN = ("#bd7350", "#e6a378", "#f9cda6")
LEATHER = ("#2d2227", "#4c3a36", "#6d5548")
FUR = ("#6b4629", "#a5784a", "#d3ad7c")
WHITE = ("#b9ae98", "#ece3cf", "#fbf6e8")
SILK = "#f2d15c"
EYE = "#1d1420"
BLUSH = "#ee9078"
SILVER = ("#8d95a3", "#d8dde6")
OUTLINE = (27, 20, 32, 255)

HAIRS = {
    "blond": ("#a9782c", "#dcae4e", "#f6d98a"),
    "brown": ("#2f1b17", "#55321f", "#835433"),
    "red": ("#7c2a14", "#b5481d", "#e27a3a"),
}
GENDERS = ("boy", "girl")
# Each gender has its own three styles. The game's chooser lists the same ones in STYLES.
HAIR_STYLES = {"boy": ("short", "tousled", "mid"), "girl": ("mid", "long", "braids")}
HAIR_DROP = {"short": 0, "tousled": 0, "mid": 3, "long": 8, "braids": 9}  # sprite rows below the head
BASE_HAIR_END = {"short": None, "tousled": None, "mid": 70, "long": 94, "braids": None}

# The two gákti the player can choose, shown only as 1 and 2 with no place names,
# as the user decided. Both are the same documented kofta and differ in the belt.
# The names are internal; the leather belt is NOT a known Utsjoki feature.
OUTFITS = {
    "ohcejohka": {"belt": "leather"},
    "karasjohka": {"belt": "woven"},
}

look = {"outfit": "ohcejohka", "gender": "boy", "hair": "brown", "length": "short"}


def hair():
    return HAIRS[look["hair"]]


def is_girl():
    return look["gender"] == "girl"


def add_outline(img):
    """Dark pixel outline around the silhouette, as in Terraria and Core Keeper."""
    px = img.load()
    w, h = img.size
    edge = [
        (x, y) for y in range(h) for x in range(w)
        if px[x, y][3] == 0 and any(
            0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
    ]
    for x, y in edge:
        px[x, y] = OUTLINE
    return img


# ---------------------------------------------------------------- base model
W, H = 96, 134  # the views are drawn 16 rows lower and cropped when saved
TOP = 16


def poly(d, pts, fill):
    d.polygon(pts, fill=fill)


def box(d, x0, y0, x1, y1, fill):
    d.rectangle([x0, y0, x1, y1], fill=fill)


def belt(d, x0, x1, y):
    """Woven: white with a red pattern, red and blue edges. Leather: silver buttons."""
    if OUTFITS[look["outfit"]]["belt"] == "leather":
        box(d, x0, y, x1, y + 6, LEATHER[1])
        box(d, x0, y, x1, y, LEATHER[2])
        box(d, x0, y + 6, x1, y + 6, LEATHER[0])
        for x in range(x0 + 2, x1 - 1, 5):
            box(d, x, y + 2, x + 2, y + 4, SILVER[0])
            box(d, x, y + 2, x + 1, y + 3, SILVER[1])
        return
    box(d, x0, y, x1, y + 6, WHITE[1])
    box(d, x0, y, x1, y, RED[1])
    box(d, x0, y + 6, x1, y + 6, BLUE[0])
    for x in range(x0 + 2, x1, 4):
        box(d, x, y + 2, x + 1, y + 4, RED[1])


def legs_and_shoes(d, cx):
    """Trousers (boy) or stockings (girl), and summer nebbsko with woven shoe bands."""
    leg = (BLUE[0], BLUE[0], BLUE[1]) if is_girl() else LEATHER
    for side in (-1, 1):
        x0, x1 = (cx - 15, cx - 3) if side < 0 else (cx + 3, cx + 15)
        box(d, x0, 124, x1, 138, leg[1])
        box(d, x0, 124, x0 + 3, 138, leg[2])
        box(d, x1 - 2, 124, x1, 138, leg[0])
        box(d, x0 - 1, 136, x1 + 1, 140, WHITE[1])
        box(d, x0 - 1, 136, x1 + 1, 136, RED[1])
        box(d, x0 - 1, 140, x1 + 1, 140, BLUE[0])
        tip = x0 - 7 if side < 0 else x1 + 7
        poly(d, [(x0, 141), (x1, 141), (x1 + (0 if side < 0 else 4), 148), (x0 - (4 if side < 0 else 0), 148)], FUR[1])
        poly(d, [(x0 if side < 0 else x1, 141), (tip, 141), (tip, 144), (x0 if side < 0 else x1, 148)], FUR[1])
        box(d, x0, 141, x1 - 4, 143, FUR[2])
        box(d, x0 - 3, 147, x1 + 3, 148, FUR[0])


def sleeves(d, cx):
    poly(d, [(cx - 19, 68), (cx - 28, 72), (cx - 33, 104), (cx - 24, 106), (cx - 18, 82)], BLUE[2])
    poly(d, [(cx + 19, 68), (cx + 28, 72), (cx + 33, 104), (cx + 24, 106), (cx + 18, 82)], BLUE[0])
    poly(d, [(cx - 33, 100), (cx - 24, 102), (cx - 24, 107), (cx - 34, 105)], RED[2])
    poly(d, [(cx + 33, 100), (cx + 24, 102), (cx + 24, 107), (cx + 34, 105)], RED[1])
    d.ellipse([cx - 34, 105, cx - 25, 114], fill=SKIN[2])
    d.ellipse([cx + 25, 105, cx + 34, 114], fill=SKIN[1])


def lower_body(d, cx, half=21, flare=27):
    """Below the belt. Boy: short, no holbi, a red double seam at the hem. Girl: longer,
    with a yellow strip, the red holbeláđđi with its gathers, and a lower edge."""
    hem = 134 if is_girl() else 128 - 4 * BOY_SHORTER  # about 4 base pixels to a sprite row
    if is_girl():
        flare += 4
    poly(d, [(cx - half, 104), (cx + half, 104), (cx + flare, hem), (cx - flare, hem)], BLUE[1])
    poly(d, [(cx - half, 104), (cx - half + 8, 104), (cx - flare + 10, hem), (cx - flare, hem)], BLUE[2])
    poly(d, [(cx + half - 7, 104), (cx + half, 104), (cx + flare, hem), (cx + flare - 9, hem)], BLUE[0])
    for x in (cx - 7, cx + 7):
        d.line([(x, 106), (x + (x - cx) // 3, hem - 1)], fill=BLUE[0])
    if is_girl():
        box(d, cx - flare + 2, 120, cx + flare - 2, 121, YEL[1])
        box(d, cx - flare + 1, 122, cx + flare - 1, 131, RED[1])
        box(d, cx - flare + 1, 122, cx - flare + 9, 131, RED[2])
        for x in range(cx - flare + 3, cx + flare - 1, 4):
            box(d, x, 123, x, 130, RED[0])
        box(d, cx - flare, 132, cx + flare, 134, BLUE[1])
    else:
        box(d, cx - flare + 1, hem - 3, cx + flare - 1, hem - 3, RED[1])
        box(d, cx - flare + 1, hem - 1, cx + flare - 1, hem - 1, RED[1])


def collar(d, cx):
    """Boy: the high čeabe with yellow and red strips. Girl: no separate collar is
    described, only the red cloth in the neck opening, so the neck shows."""
    if is_girl():
        box(d, cx - 7, 56, cx + 7, 66, SKIN[1])
        box(d, cx - 13, 66, cx + 13, 67, BLUE[1])
        return
    box(d, cx - 12, 57, cx + 12, 66, RED[1])
    box(d, cx - 12, 57, cx - 7, 66, RED[2])
    box(d, cx + 8, 57, cx + 12, 66, RED[0])
    box(d, cx - 12, 65, cx + 12, 65, YEL[1])
    box(d, cx - 13, 66, cx + 13, 67, BLUE[1])


def hair_front_top(d, cx, y):
    h = hair()
    d.pieslice([cx - 18, y - 8, cx + 18, y + 30], 180, 360, fill=h[1])
    poly(d, [(cx - 18, y + 10), (cx + 18, y + 10), (cx + 18, y + 13), (cx + 12, y + 8), (cx + 5, y + 11),
             (cx - 2, y + 7), (cx - 9, y + 11), (cx - 13, y + 8), (cx - 18, y + 15)], h[1])
    d.pieslice([cx - 16, y - 6, cx + 4, y + 16], 190, 300, fill=h[2])


def base_tufts(d, cx):
    """Tousled hair: tufts standing up from the crown."""
    if look["length"] != "tousled":
        return
    for dx, y, rise in ((-13, 30, 7), (-5, 24, 7), (4, 24, 8), (13, 30, 6)):
        poly(d, [(cx + dx - 5, y + 3), (cx + dx + 5, y + 3), (cx + dx + 1, y - rise)], hair()[1])


def base_braid(d, x, top, bottom):
    """One plait: overlapping sections, tied at the end."""
    h = hair()
    for y in range(top, bottom, 5):
        d.ellipse([x - 4, y, x + 4, y + 6], fill=h[1])
        d.line([(x - 2, y + 1), (x + 1, y + 4)], fill=h[2])
        d.line([(x - 3, y + 5), (x + 3, y + 5)], fill=h[0])
    box(d, x - 2, bottom, x + 2, bottom + 2, RED[1])
    box(d, x - 2, bottom + 3, x + 2, bottom + 6, h[1])


def hair_locks(d, cx, y):
    """Hair falling in front of the shoulders."""
    h = hair()
    if look["length"] == "braids":
        base_braid(d, cx - 17, y + 6, y + 60)
        base_braid(d, cx + 17, y + 6, y + 60)
        return
    bottom = BASE_HAIR_END[look["length"]]
    if bottom is None:
        return
    for x0, x1, tone in ((cx - 21, cx - 13, h[2]), (cx + 13, cx + 21, h[0])):
        poly(d, [(x0, y + 6), (x1, y + 6), (x1, bottom - 3), ((x0 + x1) // 2, bottom), (x0, bottom - 3)], h[1])
        box(d, x0 + 1, y + 8, x0 + 3, bottom - 5, tone)


def face_front(d, cx, y):
    d.ellipse([cx - 16, y, cx + 16, y + 30], fill=SKIN[1])
    d.ellipse([cx - 15, y + 1, cx + 11, y + 26], fill=SKIN[2])
    for ex in (cx - 9, cx + 5):
        box(d, ex, y + 14, ex + 4, y + 20, EYE)
        box(d, ex, y + 14, ex + 1, y + 15, WHITE[2])
    box(d, cx - 13, y + 21, cx - 10, y + 22, BLUSH)
    box(d, cx + 10, y + 21, cx + 13, y + 22, BLUSH)
    box(d, cx - 3, y + 24, cx + 3, y + 24, SKIN[0])
    box(d, cx - 4, y + 23, cx - 4, y + 23, SKIN[0])
    box(d, cx + 4, y + 23, cx + 4, y + 23, SKIN[0])


def finish(img):
    return add_outline(img.crop((0, TOP, W, TOP + H)))


def draw_front():
    img = Image.new("RGBA", (W, TOP + H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = 48
    legs_and_shoes(d, cx)
    sleeves(d, cx)
    poly(d, [(cx - 20, 66), (cx + 20, 66), (cx + 21, 98), (cx - 21, 98)], BLUE[1])
    poly(d, [(cx - 20, 66), (cx - 11, 66), (cx - 13, 98), (cx - 21, 98)], BLUE[2])
    poly(d, [(cx + 13, 66), (cx + 20, 66), (cx + 21, 98), (cx + 14, 98)], BLUE[0])
    lower_body(d, cx)
    # Red chest cloth, split at the neck opening, edged in blue, with a narrow
    # yellow and a red strip below it.
    box(d, cx - 13, 68, cx + 13, 86, RED[1])
    box(d, cx - 13, 68, cx - 8, 86, RED[2])
    box(d, cx + 9, 68, cx + 13, 86, RED[0])
    box(d, cx - 13, 87, cx + 13, 88, YEL[1])
    box(d, cx - 13, 87, cx - 6, 87, YEL[2])
    box(d, cx - 13, 89, cx + 13, 91, RED[1])
    if not is_girl():  # silk scarf (čeabetliidni) inside the opening
        poly(d, [(cx - 3, 68), (cx + 3, 68), (cx, 82)], SILK)
    d.line([(cx - 4, 68), (cx, 83)], fill=BLUE[1])
    d.line([(cx + 4, 68), (cx, 83)], fill=BLUE[1])
    d.line([(cx - 5, 68), (cx - 1, 83)], fill=BLUE[1])
    d.line([(cx + 5, 68), (cx + 1, 83)], fill=BLUE[1])
    belt(d, cx - 22, cx + 22, 98)
    collar(d, cx)
    if not is_girl():
        box(d, cx - 1, 57, cx + 1, 67, BLUE[1])
    hair_locks(d, cx, 30)
    face_front(d, cx, 30)
    hair_front_top(d, cx, 30)
    base_tufts(d, cx)
    return finish(img)


def draw_back():
    img = Image.new("RGBA", (W, TOP + H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = 48
    legs_and_shoes(d, cx)
    sleeves(d, cx)
    poly(d, [(cx - 20, 66), (cx + 20, 66), (cx + 21, 98), (cx - 21, 98)], BLUE[1])
    poly(d, [(cx - 20, 66), (cx - 13, 66), (cx - 15, 98), (cx - 21, 98)], BLUE[2])
    poly(d, [(cx + 14, 66), (cx + 20, 66), (cx + 21, 98), (cx + 15, 98)], BLUE[0])
    lower_body(d, cx)
    # Hárdodilli: red and yellow strips over the shoulder seam.
    box(d, cx - 20, 76, cx + 20, 77, RED[1])
    box(d, cx - 20, 78, cx + 20, 79, YEL[1])
    # Dearis: red strips down the back seams, about to the belt.
    for x in (cx - 10, cx + 9):
        box(d, x, 80, x + 1, 97, RED[1])
    belt(d, cx - 22, cx + 22, 98)
    collar(d, cx)
    h = hair()
    d.ellipse([cx - 18, 22, cx + 18, 60], fill=h[1])
    d.ellipse([cx - 16, 24, cx + 5, 50], fill=h[2])
    base_tufts(d, cx)
    if look["length"] == "braids":
        base_braid(d, cx - 9, 50, 90)
        base_braid(d, cx + 9, 50, 90)
    bottom = BASE_HAIR_END[look["length"]]
    if bottom:
        half = 18 if look["length"] == "mid" else 15
        poly(d, [(cx - half, 44), (cx + half, 44), (cx + half, bottom - 3), (cx, bottom), (cx - half, bottom - 3)], h[1])
        box(d, cx - half + 2, 46, cx - half + 5, bottom - 5, h[2])
        box(d, cx + half - 4, 46, cx + half - 2, bottom - 5, h[0])
    return finish(img)


def draw_side():
    """Facing right."""
    img = Image.new("RGBA", (W, TOP + H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = 46
    leg = (BLUE[0], BLUE[0], BLUE[1]) if is_girl() else LEATHER
    box(d, cx - 4, 124, cx + 8, 138, leg[0])
    box(d, cx - 8, 124, cx + 4, 138, leg[1])
    box(d, cx - 8, 124, cx - 5, 138, leg[2])
    box(d, cx - 9, 136, cx + 5, 140, WHITE[1])
    box(d, cx - 9, 136, cx + 5, 136, RED[1])
    box(d, cx - 9, 140, cx + 5, 140, BLUE[0])
    poly(d, [(cx - 9, 141), (cx + 5, 141), (cx + 13, 142), (cx + 17, 139), (cx + 18, 144), (cx + 12, 148), (cx - 9, 148)], FUR[1])
    box(d, cx - 8, 141, cx + 4, 143, FUR[2])
    box(d, cx - 9, 147, cx + 12, 148, FUR[0])
    poly(d, [(cx - 15, 66), (cx + 15, 66), (cx + 16, 98), (cx - 16, 98)], BLUE[1])
    poly(d, [(cx - 15, 66), (cx - 8, 66), (cx - 10, 98), (cx - 16, 98)], BLUE[2])
    lower_body(d, cx, half=16, flare=21)
    box(d, cx + 5, 68, cx + 15, 86, RED[1])
    box(d, cx + 5, 87, cx + 15, 88, YEL[1])
    box(d, cx + 5, 89, cx + 15, 91, RED[1])
    box(d, cx - 15, 76, cx - 8, 77, RED[1])
    box(d, cx - 15, 78, cx - 8, 79, YEL[1])
    belt(d, cx - 17, cx + 17, 98)
    poly(d, [(cx - 6, 68), (cx + 5, 68), (cx + 7, 104), (cx - 4, 106)], BLUE[2])
    poly(d, [(cx + 2, 68), (cx + 5, 68), (cx + 7, 104), (cx + 3, 105)], BLUE[1])
    poly(d, [(cx - 4, 101), (cx + 7, 100), (cx + 7, 105), (cx - 4, 106)], RED[2])
    d.ellipse([cx - 3, 105, cx + 7, 114], fill=SKIN[2])
    if is_girl():
        box(d, cx - 5, 56, cx + 9, 66, SKIN[1])
        box(d, cx - 11, 66, cx + 14, 67, BLUE[1])
    else:
        box(d, cx - 10, 57, cx + 13, 66, RED[1])
        box(d, cx - 10, 57, cx - 4, 66, RED[2])
        box(d, cx - 10, 65, cx + 13, 65, YEL[1])
        box(d, cx - 11, 66, cx + 14, 67, BLUE[1])
    d.ellipse([cx - 15, 30, cx + 17, 60], fill=SKIN[2])
    box(d, cx + 16, 44, cx + 18, 48, SKIN[1])  # nose
    h = hair()
    if look["length"] == "braids":
        base_braid(d, cx - 12, 48, 90)
    bottom = BASE_HAIR_END[look["length"]]
    if bottom:
        poly(d, [(cx - 18, 42), (cx - 2, 42), (cx - 3, bottom - 3), (cx - 10, bottom), (cx - 18, bottom - 3)], h[1])
        box(d, cx - 16, 44, cx - 13, bottom - 5, h[2])
    d.pieslice([cx - 18, 22, cx + 18, 60], 180, 360, fill=h[1])
    poly(d, [(cx - 18, 40), (cx + 16, 40), (cx + 8, 38), (cx, 42), (cx - 2, 56), (cx - 13, 54), (cx - 18, 46)], h[1])
    d.pieslice([cx - 16, 24, cx + 4, 46], 190, 300, fill=h[2])
    base_tufts(d, cx)
    box(d, cx + 7, 44, cx + 11, 50, EYE)
    box(d, cx + 7, 44, cx + 8, 45, WHITE[2])
    box(d, cx + 3, 52, cx + 6, 53, BLUSH)
    box(d, cx + 9, 54, cx + 14, 54, SKIN[0])
    return finish(img)


def contact_sheet(views, scale, background="#2d4350", gap=8, columns=None):
    columns = columns or len(views)
    rows = (len(views) + columns - 1) // columns
    vw, vh = views[0].size
    sheet = Image.new("RGBA", ((vw + gap) * columns * scale + gap * scale, (vh + gap) * rows * scale + gap * scale), background)
    for i, v in enumerate(views):
        big = v.resize((vw * scale, vh * scale), Image.NEAREST)
        sheet.alpha_composite(big, ((gap + (vw + gap) * (i % columns)) * scale, (gap + (vh + gap) * (i // columns)) * scale))
    return sheet


# --------------------------------------------------------------- sprite sheet
FW, FH = 24, 40  # tall enough for a full jump
SWAYS = (-2, -1, 1, 2)  # pixels the hem and hair ends move; 0 is the plain idle and walk rows
BOY_SHORTER = 1  # sprite rows taken off the boy's hem
GROUND = 38
CX = 12


class Px:
    def __init__(self):
        self.img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def r(self, x0, y0, x1, y1, c):
        self.d.rectangle([x0, y0, x1, y1], fill=c)


def sprite_head(p, cx, y, facing, blink, look_x=0):
    h = hair()
    if facing == "up":
        p.r(cx - 4, y - 1, cx + 3, y - 1, h[1])
        p.r(cx - 5, y, cx + 4, y + 6, h[1])
        p.r(cx - 5, y, cx - 3, y + 4, h[2])
        p.r(cx - 4, y + 7, cx + 3, y + 7, h[0])
        return
    p.r(cx - 5, y, cx + 4, y + 6, SKIN[2])
    p.r(cx - 4, y + 7, cx + 3, y + 7, SKIN[1])
    p.r(cx + 3, y + 1, cx + 4, y + 6, SKIN[1])
    p.r(cx - 4, y - 1, cx + 3, y - 1, h[1])
    p.r(cx - 3, y - 1, cx - 1, y - 1, h[2])
    if facing == "down":
        p.r(cx - 5, y, cx + 4, y, h[1])
        p.r(cx - 4, y, cx - 2, y, h[2])
        p.r(cx - 5, y + 1, cx - 4, y + 2, h[1])
        p.r(cx + 3, y + 1, cx + 4, y + 2, h[1])
        p.r(cx - 1, y + 1, cx, y + 1, h[1])
        ey = y + 3
        if blink:
            p.r(cx - 3 + look_x, ey + 1, cx - 2 + look_x, ey + 1, EYE)
            p.r(cx + 1 + look_x, ey + 1, cx + 2 + look_x, ey + 1, EYE)
        else:
            p.r(cx - 3 + look_x, ey, cx - 3 + look_x, ey + 1, EYE)
            p.r(cx + 2 + look_x, ey, cx + 2 + look_x, ey + 1, EYE)
        p.r(cx - 5, y + 5, cx - 4, y + 5, BLUSH)
        p.r(cx + 3, y + 5, cx + 4, y + 5, BLUSH)
        p.r(cx - 1, y + 6, cx, y + 6, SKIN[0])
    else:  # right
        p.r(cx - 5, y, cx + 3, y, h[1])
        p.r(cx - 5, y + 1, cx - 2, y + 4, h[1])
        p.r(cx - 5, y + 1, cx - 4, y + 3, h[2])
        p.r(cx - 5, y + 5, cx - 3, y + 6, h[0])
        p.r(cx + 5, y + 3, cx + 5, y + 4, SKIN[1])  # nose
        if blink:
            p.r(cx + 1, y + 3, cx + 2, y + 3, EYE)
        else:
            p.r(cx + 2, y + 2, cx + 2, y + 3, EYE)
        p.r(cx, y + 5, cx + 1, y + 5, BLUSH)


def cloth_shift(sway, reach):
    """How far one row moves. reach runs from 0 where it is attached to 1 at the free end."""
    amount = abs(sway) * reach * reach
    return int(amount + 0.5) * ((sway > 0) - (sway < 0))


def hair_rows(p, x0, x1, top, bottom, sway, tones):
    """Rows of hair that bend: the roots stay with the head and the ends move furthest."""
    for row in range(top, bottom + 1):
        at = x0 + cloth_shift(sway, (row - top + 1) / (bottom - top + 1))
        p.r(at, row, at + x1 - x0, row, tones[0])
        for offset, tone in tones[1]:
            p.r(at + offset, row, at + offset, row, tone)


def sprite_braid(p, x, top, bottom, sway):
    """A plait bends like loose hair. Light and dark rows show the sections; the end is tied."""
    h = hair()
    for row in range(top, bottom + 1):
        at = x + cloth_shift(sway, (row - top + 1) / (bottom - top + 1))
        tone = RED[1] if row == bottom - 1 else h[2] if (row - top) % 2 else h[1]
        p.r(at, row, at + 1, row, tone)
        if tone != RED[1] and (row - top) % 2 == 0:
            p.r(at + 1, row, at + 1, row, h[0])


def sprite_long_hair(p, cx, y, facing, sway=0, lift=0):
    """Hair ends lag behind the body: sway bends the hair, lift raises it in a fall."""
    h = hair()
    drop = HAIR_DROP[look["length"]]
    if not drop:
        return
    bottom = y + 6 + drop - (lift if drop > 3 else 0)
    if look["length"] == "braids":
        if facing == "down":
            sprite_braid(p, cx - 6, y + 3, bottom, sway)
            sprite_braid(p, cx + 4, y + 3, bottom, sway)
        elif facing == "up":
            sprite_braid(p, cx - 4, y + 6, bottom, sway)
            sprite_braid(p, cx + 2, y + 6, bottom, sway)
        else:
            sprite_braid(p, cx - 5, y + 5, bottom, sway)
        return
    if facing == "down":
        hair_rows(p, cx - 6, cx - 5, y + 1, bottom, sway, (h[1], [(0, h[2])]))
        hair_rows(p, cx + 4, cx + 5, y + 1, bottom, sway, (h[1], [(1, h[0])]))
    elif facing == "up":
        # Strands in the block, so that it reads as hair and shows the bending.
        hair_rows(p, cx - 5, cx + 4, y + 6, bottom, sway, (h[1], [(0, h[2]), (1, h[2]), (4, h[0]), (7, h[2]), (9, h[0])]))
    else:
        hair_rows(p, cx - 6, cx - 3, y + 2, bottom, sway, (h[1], [(0, h[2]), (1, h[2])]))


def sprite_short_hair_flick(p, cx, y, facing, sway):
    """Short hair has no ends to bend, so one tuft flicks out when the body changes speed.
    Tousled hair also has tufts on top, which lean with the sway."""
    if look["length"] not in ("short", "tousled"):
        return
    h = hair()
    if look["length"] == "tousled":
        lean = (sway > 0) - (sway < 0)
        for x in (cx - 3, cx + 1) if facing != "right" else (cx - 4, cx):
            p.r(x + lean, y - 2, x + lean, y - 2, h[1])
        p.r(cx - 5, y - 1, cx - 5, y - 1, h[1])
        p.r(cx + 4, y - 1, cx + 4, y - 1, h[1])
    if not sway:
        return
    if facing == "right":
        if sway < 0:
            p.r(cx - 6, y + 2, cx - 6, y + 2 + abs(sway), h[1])
        else:
            p.r(cx + 4, y - 1, cx + 3 + sway, y - 1, h[1])
    elif facing == "down":
        x = cx - 6 if sway < 0 else cx + 5
        p.r(x, y + 1, x, y + abs(sway), h[1])
    else:
        x = cx - 6 if sway < 0 else cx + 5
        p.r(x, y + 2, x, y + 1 + abs(sway), h[1])


def sprite_torso(p, cx, y, facing):
    """y is the collar's top row. Collar 2, chest 7."""
    girl = is_girl()
    if facing == "right":
        p.r(cx - 4, y + 2, cx + 3, y + 8, BLUE[1])
        p.r(cx - 4, y + 2, cx - 3, y + 8, BLUE[2])
        p.r(cx + 1, y + 2, cx + 3, y + 5, RED[1])
        p.r(cx + 1, y + 6, cx + 3, y + 6, YEL[1])
        p.r(cx - 4, y + 4, cx - 3, y + 4, YEL[1])
        if girl:
            p.r(cx - 2, y, cx + 2, y + 1, SKIN[1])
        else:
            p.r(cx - 3, y, cx + 3, y + 1, RED[1])
            p.r(cx - 3, y, cx - 2, y, RED[2])
        return
    p.r(cx - 5, y + 2, cx + 4, y + 8, BLUE[1])
    p.r(cx - 5, y + 2, cx - 4, y + 8, BLUE[2])
    p.r(cx + 3, y + 2, cx + 4, y + 8, BLUE[0])
    if facing == "down":
        p.r(cx - 3, y + 2, cx + 2, y + 5, RED[1])
        p.r(cx - 3, y + 2, cx - 2, y + 5, RED[2])
        p.r(cx - 1, y + 2, cx, y + 3, BLUE[1] if girl else SILK)
        p.r(cx - 3, y + 6, cx + 2, y + 6, YEL[1])
        if girl:
            p.r(cx - 2, y, cx + 1, y + 1, SKIN[1])
        else:
            p.r(cx - 3, y, cx + 2, y + 1, RED[1])
            p.r(cx - 1, y, cx, y + 1, BLUE[1])
    else:  # up: hárdodilli across, dearis down
        p.r(cx - 5, y + 3, cx + 4, y + 3, RED[1])
        p.r(cx - 5, y + 4, cx + 4, y + 4, YEL[1])
        for x in (cx - 3, cx + 2):
            p.r(x, y + 5, x, y + 8, RED[1])
        p.r(cx - 3, y, cx + 2, y + 1, SKIN[1] if girl else RED[1])


def sprite_skirt(p, cx, y, facing, sway, flare=0, lift=0, floor=None):
    """The gákti below the belt, which moves on its own. sway: the cloth bends, with the
    hem moving furthest. flare: the hem opens out. lift: positive rises with falling air,
    negative trails when going up. floor: the cloth spreads there instead of passing through."""
    half = 4 if facing == "right" else 5
    leather = OUTFITS[look["outfit"]]["belt"] == "leather"
    p.r(cx - half, y, cx + half - 1, y, LEATHER[1] if leather else WHITE[1])  # belt
    dot = SILVER[1] if leather else RED[1]
    p.r(cx - half + 1, y, cx - half + 1, y, dot)
    p.r(cx - 1, y, cx - 1, y, dot)
    p.r(cx + half - 2, y, cx + half - 2, y, dot)
    trim = 3 if is_girl() else 1  # yellow, red, red (girl) or the red seam (boy)
    bottom = y + 7 + (2 if is_girl() else -BOY_SHORTER) - lift - 2
    if floor is not None:
        bottom = min(bottom, floor)
    for row in range(y + 1, bottom + 1):
        depth = row - y
        shift = cloth_shift(sway, depth / (bottom - y))
        out = (1 if depth >= 3 else 0) + (flare if depth >= 3 else 0)
        if depth >= 5:
            out += 1 if is_girl() else 0
        x0, x1 = cx - half - out + shift, cx + half - 1 + out + shift
        from_hem = bottom - row
        if from_hem < trim:
            colour = YEL[1] if is_girl() and from_hem == 2 else RED[1]
            p.r(x0, row, x1, row, colour)
            p.r(x0, row, x0 + 1, row, YEL[2] if colour == YEL[1] else RED[2])
        else:
            p.r(x0, row, x1, row, BLUE[1])
            p.r(x0, row, x0 + 1, row, BLUE[2])
            p.r(x1 - 1, row, x1, row, BLUE[0])


def sprite_arm(p, x, y, swing, light=True, up=False, edge=False):
    """edge: a dark line that separates the near sleeve from the blue body in the side view."""
    c = BLUE[2] if light else BLUE[0]
    if up:
        p.r(x, y - 6, x + 1, y + 1, c)
        p.r(x, y - 6, x + 1, y - 6, RED[2 if light else 1])
        p.r(x, y - 8, x + 1, y - 7, SKIN[2])
        return
    p.r(x, y + swing, x + 1, y + 5 + swing, c)
    if edge:
        p.r(x + 2, y + swing, x + 2, y + 4 + swing, BLUE[0])
    p.r(x, y + 5 + swing, x + 1, y + 5 + swing, RED[2 if light else 1])
    p.r(x, y + 6 + swing, x + 1, y + 7 + swing, SKIN[2 if light else 1])


def sprite_leg(p, x, ground, lift, shift, near=True, toe=-1):
    y1 = ground - lift
    x += shift
    leg = (BLUE[0], BLUE[0], BLUE[1]) if is_girl() else LEATHER
    p.r(x, y1 - 5, x + 2, y1 - 2, leg[1 if near else 0])
    p.r(x, y1 - 5, x, y1 - 2, leg[2 if near else 1])
    p.r(x, y1 - 2, x + 2, y1 - 2, WHITE[1])  # shoe band
    p.r(x, y1 - 1, x + 2, y1, FUR[1 if near else 0])
    if toe:  # upturned nebbsko toe
        tip = x - 1 if toe < 0 else x + 3
        p.r(tip, y1 - 1, tip, y1, FUR[2 if near else 1])


def sprite_brushing_arm(p, side, stroke, shoulder_y, belt_y):
    """An arm reaching across in front of the hem. side -1 is the viewer's left. Stroke 1 starts
    high at the outside, stroke 2 ends lower and further in, so the hand visibly sweeps. A dark edge and
    the red cuff keep the blue sleeve readable against the blue gákti."""
    shoulder_x = CX - 7 if side < 0 else CX + 5
    hand_x = shoulder_x + side * -1 * (2 if stroke == 1 else 5)
    hand_y = belt_y + (1 if stroke == 1 else 4)
    rows = hand_y - shoulder_y
    for i in range(rows):
        x = shoulder_x + round((hand_x - shoulder_x) * i / rows)
        p.r(x, shoulder_y + i, x + 1, shoulder_y + i, BLUE[2])
        p.r(x + (2 if side < 0 else -1), shoulder_y + i, x + (2 if side < 0 else -1), shoulder_y + i, BLUE[0])
    p.r(hand_x, hand_y - 1, hand_x + 1, hand_y - 1, RED[2])
    p.r(hand_x - 1, hand_y, hand_x + 2, hand_y + 1, SKIN[2])
    p.r(hand_x - 1, hand_y + 2, hand_x + 2, hand_y + 2, SKIN[1])


def frame(facing, *, up=0, left=(0, 0), right=(0, 0), swing=0, blink=False, look_x=0, hop=0, sway=0,
          arms_up=False, flare=0, lift=0, squat=0, sitting=False, pat=0, bend=0):
    """left and right are (lift, shift) for the feet. up raises the upper body, squat lowers it.
    pat: a hand brushing the gákti, negative on the left, positive on the right, 2 being further
    along its stroke. bend: the head dips forward over the chest, looking down."""
    p = Px()
    g = GROUND - hop
    body = GROUND - 9 - up - hop + squat  # belt row
    collar_y = body - 9
    head = collar_y - 8 + bend
    skirt = dict(flare=flare, lift=lift, floor=g)
    if facing == "right":
        sprite_leg(p, CX - 3, g, right[0], right[1], near=False, toe=1)
        sprite_arm(p, CX + 1, collar_y + 2, -swing, light=False, up=arms_up)
        sprite_torso(p, CX, collar_y, facing)
        sprite_leg(p, CX - 1, g, left[0], left[1], near=True, toe=1)
        sprite_skirt(p, CX, body, facing, sway, **skirt)
        sprite_long_hair(p, CX, head, facing, sway, lift)
        sprite_head(p, CX, head, facing, blink)
        sprite_short_hair_flick(p, CX, head, facing, sway)
        sprite_arm(p, CX - 2, collar_y + 2, swing, light=True, up=arms_up, edge=not arms_up)
    else:
        if not sitting:
            sprite_leg(p, CX - 5, g, left[0], left[1], toe=-1 if facing == "down" else 0)
            sprite_leg(p, CX + 2, g, right[0], right[1], toe=1 if facing == "down" else 0)
        sprite_torso(p, CX, collar_y, facing)
        sprite_skirt(p, CX, body, facing, sway, **skirt)
        if sitting:  # legs out in front, shoes showing past the spread cloth
            for x, tip in ((CX - 10, CX - 11), (CX + 7, CX + 10)):
                p.r(x, g - 1, x + 2, g, FUR[1])
                p.r(tip, g - 2, tip, g - 1, FUR[2])
        if pat >= 0:
            sprite_arm(p, CX - 7, collar_y + 2, swing, light=True, up=arms_up)
        if pat <= 0:
            sprite_arm(p, CX + 5, collar_y + 2, -swing, light=False, up=arms_up)
        if pat:
            sprite_brushing_arm(p, -1 if pat < 0 else 1, abs(pat), collar_y + 2, body)
        sprite_head(p, CX, head, facing, blink, look_x)
        if bend:  # more of the top of the head shows, and the fringe falls forward
            p.r(CX - 5, head + 1, CX + 4, head + 1 + (bend > 1), hair()[1])
            p.r(CX - 4, head + 1, CX - 2, head + 1, hair()[2])
        sprite_long_hair(p, CX, head, facing, sway, lift)
        sprite_short_hair_flick(p, CX, head, facing, sway)
    return add_outline(p.img)


# ----------------------------------------------------------- the diagonal views
def diagonal_head_lower(p, cx, y, blink):
    h = hair()
    p.r(cx - 5, y, cx + 4, y + 6, SKIN[2])
    p.r(cx - 4, y + 7, cx + 3, y + 7, SKIN[1])
    p.r(cx - 4, y - 1, cx + 3, y - 1, h[1])
    p.r(cx - 3, y - 1, cx - 1, y - 1, h[2])
    p.r(cx - 5, y, cx + 4, y, h[1])
    p.r(cx - 5, y + 1, cx - 3, y + 5, h[1])
    p.r(cx - 5, y + 1, cx - 4, y + 3, h[2])
    p.r(cx - 4, y + 6, cx - 3, y + 6, h[0])
    p.r(cx - 2, y + 1, cx - 1, y + 1, h[1])
    p.r(cx + 4, y + 1, cx + 4, y + 2, h[1])
    if blink:
        p.r(cx, y + 4, cx + 1, y + 4, EYE); p.r(cx + 3, y + 4, cx + 4, y + 4, EYE)
    else:
        p.r(cx, y + 3, cx, y + 4, EYE); p.r(cx + 3, y + 3, cx + 3, y + 4, EYE)
    p.r(cx - 2, y + 5, cx - 1, y + 5, BLUSH)
    p.r(cx + 3, y + 5, cx + 4, y + 5, BLUSH)
    p.r(cx + 1, y + 6, cx + 2, y + 6, SKIN[0])

def diagonal_head_upper(p, cx, y):
    h = hair()
    p.r(cx - 4, y - 1, cx + 3, y - 1, h[1])
    p.r(cx - 5, y, cx + 4, y + 6, h[1])
    p.r(cx - 5, y, cx - 3, y + 4, h[2])
    p.r(cx - 4, y + 7, cx + 3, y + 7, h[0])
    p.r(cx + 3, y + 3, cx + 4, y + 6, SKIN[1])  # the cheek shows, turned away to the right

def diagonal_frame(facing, up=0, left=(0, 0), right=(0, 0), swing=0, blink=False, sway=0, flare=0, lift=0):
    p = Px()
    g = GROUND; body = g - 9 - up; y = body - 9; head = y - 8; cx = CX
    girl = is_girl()
    h = hair()
    sprite_leg(p, cx + 1, g - 1, right[0], right[1], near=False, toe=1 if facing == "se" else 0)
    sprite_arm(p, cx + 4, y + 2, -swing, light=False)
    p.r(cx - 5, y + 2, cx + 3, y + 8, BLUE[1])
    p.r(cx - 5, y + 2, cx - 4, y + 8, BLUE[2])
    if facing == "se":
        p.r(cx - 2, y + 2, cx + 3, y + 5, RED[1])
        p.r(cx - 2, y + 2, cx - 1, y + 5, RED[2])
        p.r(cx, y + 2, cx + 1, y + 3, BLUE[1] if girl else SILK)
        p.r(cx - 2, y + 6, cx + 3, y + 6, YEL[1])
        if girl:
            p.r(cx - 2, y, cx + 2, y + 1, SKIN[1])
        else:
            p.r(cx - 3, y, cx + 3, y + 1, RED[1])
            p.r(cx, y, cx + 1, y + 1, BLUE[1])
    else:
        p.r(cx - 5, y + 3, cx + 3, y + 3, RED[1])
        p.r(cx - 5, y + 4, cx + 3, y + 4, YEL[1])
        for x in (cx - 3, cx + 1):
            p.r(x, y + 5, x, y + 8, RED[1])
        p.r(cx - 3, y, cx + 2, y + 1, SKIN[1] if girl else RED[1])
    sprite_leg(p, cx - 4, g, left[0], left[1], near=True, toe=1 if facing == "se" else 0)
    sprite_skirt(p, cx, body, "down", sway, flare=flare, lift=lift, floor=g)
    sprite_arm(p, cx - 7, y + 2, swing, light=True)
    if facing == "se":
        diagonal_head_lower(p, cx, head, blink)
        drop = HAIR_DROP[look["length"]]
        if look["length"] == "braids":
            sprite_braid(p, cx - 6, head + 3, head + 6 + drop, sway)
            sprite_braid(p, cx + 4, head + 3, head + 3 + drop, sway)
        elif drop:
            hair_rows(p, cx - 6, cx - 4, head + 1, head + 6 + drop, sway, (h[1], [(0, h[2])]))
            hair_rows(p, cx + 4, cx + 5, head + 1, head + 3 + drop, sway, (h[1], [(1, h[0])]))
    else:
        sprite_long_hair(p, cx, head, "up", sway)
        diagonal_head_upper(p, cx, head)
    sprite_short_hair_flick(p, cx, head, "down" if facing == "se" else "up", sway)
    return add_outline(p.img)

DIAGONAL_STEPS = [((0, 2), (0, -2), 2, 0), ((0, 1), (1, -1), 2, 1), ((0, 0), (2, 0), 1, 1), ((0, -1), (1, 1), 0, 0),
         ((0, -2), (0, 2), -2, 0), ((1, -1), (0, 1), -2, 1), ((2, 0), (0, 0), -1, 1), ((1, 1), (0, -1), 0, 0)]

def diagonal_rows():
    """Idle and walk, facing lower right then upper right, each with sway -2 to 2. West is mirrored."""
    rows = []
    for pose in ("idle", "walk"):
        for facing in ("se", "ne"):
            for sway in (-2, -1, 0, 1, 2):
                if pose == "idle":
                    ups = (0, 0, 0, 1, 1, 1, 0, 0)
                    rows.append([diagonal_frame(facing, up=ups[c], blink=c == 7, sway=sway) for c in range(8)])
                else:
                    rows.append([diagonal_frame(facing, left=l, right=r, swing=s, up=u, sway=sway) for l, r, s, u in DIAGONAL_STEPS])
    return rows


def walk(facing, sway=0):
    if facing == "right":
        steps = [((0, 3), (0, -3), 2, 0), ((0, 2), (1, -2), 2, 1), ((0, 1), (2, -1), 1, 1), ((0, 0), (1, 0), 0, 0),
                 ((0, -3), (0, 3), -2, 0), ((1, -2), (0, 2), -2, 1), ((2, -1), (0, 1), -1, 1), ((1, 0), (0, 0), 0, 0)]
    else:
        steps = [((0, 0), (2, 0), 2, 0), ((0, 0), (2, 0), 2, 1), ((0, 0), (1, 0), 1, 1), ((0, 0), (0, 0), 0, 0),
                 ((2, 0), (0, 0), -2, 0), ((2, 0), (0, 0), -2, 1), ((1, 0), (0, 0), -1, 1), ((0, 0), (0, 0), 0, 0)]
    # Cloth and hair don't follow each step. The game picks the row for their sway, so they
    # can trail behind the walk and swing more slowly than the legs.
    return [frame(facing, left=l, right=r, swing=s, up=u, sway=sway) for l, r, s, u in steps]


def idle(facing, sway=0, **cloth):
    ups = (0, 0, 0, 1, 1, 1, 0, 0)
    return [frame(facing, up=u, blink=i == 7, sway=sway, **cloth) for i, u in enumerate(ups)]


def cheer():
    return [frame("down", squat=1, flare=1), frame("down", hop=2, arms_up=True, lift=-1), frame("down", hop=4, arms_up=True, lift=-1),
            frame("down", hop=5, arms_up=True, blink=True, flare=1), frame("down", hop=3, arms_up=True, lift=1, flare=2),
            frame("down", hop=1, arms_up=True, lift=1, flare=2)]


def jump():
    return [frame("down", squat=2, flare=1), frame("down", hop=3, lift=-1), frame("down", hop=6, lift=-1),
            frame("down", hop=7, flare=1), frame("down", hop=4, lift=1, flare=2), frame("down", squat=1, flare=2)]


def crouch():
    return [frame("down", squat=1), frame("down", squat=2, flare=1), frame("down", squat=3, flare=2),
            frame("down", squat=3, flare=2), frame("down", squat=3, flare=2, blink=True), frame("down", squat=3, flare=2)]


def fall():
    return [frame("down", swing=2, arms_up=True, sway=1), frame("down", squat=2, arms_up=True, lift=1, flare=2),
            frame("down", squat=5, sitting=True, flare=3, blink=True), frame("down", squat=5, sitting=True, flare=3, blink=True),
            frame("down", squat=5, sitting=True, flare=2), frame("down", squat=2, flare=1)]


RUN_SWAYS = (-3, -2, -1, 0, 1, 2, 3)  # running throws the hem and hair further than walking


def run_rows():
    """Eight frames for each way of facing and each sway. Long strides with both feet off the ground
    between them, arms pumping, and the hem blown back and open."""
    side = [((0, 4), (3, -4), 3, 0), ((1, 2), (4, -2), 3, 1), ((3, 0), (3, 0), 1, 2), ((4, -2), (1, 2), -1, 1),
            ((3, -4), (0, 4), -3, 0), ((4, -2), (1, 2), -3, 1), ((3, 0), (3, 0), -1, 2), ((1, 2), (4, -2), 1, 1)]
    front = [((0, 0), (4, 0), 3, 0), ((1, 0), (4, 0), 3, 1), ((3, 0), (3, 0), 1, 2), ((4, 0), (1, 0), -1, 1),
             ((4, 0), (0, 0), -3, 0), ((4, 0), (1, 0), -3, 1), ((3, 0), (3, 0), -1, 2), ((1, 0), (4, 0), 1, 1)]
    diagonal = [((0, 2), (3, -2), 3, 0), ((1, 1), (4, -1), 3, 1), ((3, 0), (3, 0), 1, 2), ((4, -1), (1, 1), -1, 1),
                ((3, -2), (0, 2), -3, 0), ((4, -1), (1, 1), -3, 1), ((3, 0), (3, 0), -1, 2), ((1, 1), (4, -1), 1, 1)]
    rows = []
    for facing, steps in (("down", front), ("up", front), ("right", side)):
        for sway in RUN_SWAYS:
            rows.append([frame(facing, left=l, right=r, swing=s, up=u, sway=sway, flare=1, lift=-1) for l, r, s, u in steps])
    for facing in ("se", "ne"):
        for sway in RUN_SWAYS:
            rows.append([diagonal_frame(facing, left=l, right=r, swing=s, up=u, sway=sway, flare=1, lift=-1) for l, r, s, u in diagonal])
    return rows


def slide_frame(stage):
    """A slide on the tummy, head first to the right, arms reaching ahead and legs out behind. Stage 0 dives;
    1 to 3 slide, with the cloth flapping; 4 lies still; 5 pushes up to get to the feet."""
    if stage == 0:
        return frame("right", squat=2, flare=1, lift=-1, sway=-3)
    if stage == 5:
        return frame("right", squat=4, flare=2, sway=-1)
    p = Px()
    g = GROUND
    flap = stage % 2 if stage < 4 else 0
    leg = (BLUE[0], BLUE[0], BLUE[1]) if is_girl() else LEATHER
    # Legs out behind, the shoes tipping up.
    p.r(CX - 10, g - 3, CX - 4, g - 1, leg[1])
    p.r(CX - 10, g - 3, CX - 4, g - 3, leg[2])
    p.r(CX - 11, g - 3, CX - 11, g - 1, WHITE[1])
    p.r(CX - 12, g - 6 - flap, CX - 11, g - 4, FUR[1])
    p.r(CX - 12, g - 1, CX - 12, g, FUR[0])
    # The body along the floor.
    p.r(CX - 4, g - 5, CX + 4, g, BLUE[1])
    p.r(CX - 4, g - 5, CX + 4, g - 5, BLUE[2])
    p.r(CX + 1, g - 3, CX + 4, g, RED[1])
    p.r(CX, g - 3, CX, g, YEL[1])
    # The hem thrown up over the legs, longer for the girl.
    back = 9 if is_girl() else 6
    p.r(CX - 4 - back, g - 5 - flap, CX - 4, g - 4 - flap, BLUE[1])
    p.r(CX - 4 - back, g - 5 - flap, CX - 4, g - 5 - flap, BLUE[2])
    p.r(CX - 5 - back, g - 5 - flap, CX - 4 - back, g - 4 - flap, RED[1])
    p.r(CX - 3, g - 5, CX - 3, g, LEATHER[1] if OUTFITS[look["outfit"]]["belt"] == "leather" else WHITE[1])
    # The head up, looking where it's going, with the hair flying behind.
    head = g - 12
    sprite_long_hair(p, CX + 5, head, "right", -3 + flap)
    p.r(CX + 2, g - 6, CX + 6, g - 5, RED[1] if not is_girl() else SKIN[1])
    sprite_head(p, CX + 5, head, "right", stage == 4)
    sprite_short_hair_flick(p, CX + 5, head, "right", -2 - flap)
    # Both arms reaching ahead along the floor.
    p.r(CX + 3, g - 3, CX + 7, g - 2, BLUE[2])
    p.r(CX + 3, g - 1, CX + 7, g - 1, BLUE[0])
    p.r(CX + 8, g - 3, CX + 8, g - 1, RED[2])
    p.r(CX + 9, g - 3, CX + 10, g - 1, SKIN[2])
    return add_outline(p.img)


def sit_frame(swing):
    """Sitting on a chair, side on and facing right: hips on the seat, the gákti over the lap and hanging behind against
    the chair, and the shins off the seat's edge, feet clear of the floor. swing moves the lower legs."""
    p = Px()
    g = GROUND
    body = g - 8  # the belt
    collar_y = body - 9
    head = collar_y - 8
    knee = CX + 6
    leg = (BLUE[0], BLUE[0], BLUE[1]) if is_girl() else LEATHER
    def shin(x, y0, light, side_swing):
        bottom = g - 2 - abs(side_swing) // 2
        foot = x + side_swing
        p.r(x, y0, x + 1, y0 + 1, leg[1 if light else 0])
        p.r(foot, y0 + 2, foot + 1, max(y0 + 2, bottom - 2), leg[1 if light else 0])
        p.r(foot, bottom - 2, foot + 1, bottom - 2, WHITE[1])
        p.r(foot, bottom - 1, foot + 2, bottom, FUR[1 if light else 0])
        p.r(foot + 2, bottom - 2, foot + 2, bottom - 1, FUR[2 if light else 1])
    # The far leg swings against the near one.
    p.r(CX, g - 7, knee, g - 6, leg[0])
    shin(knee, g - 7, False, -swing)
    # The gákti hanging behind, against the chair.
    bottom_back = g - 2 if is_girl() else g - 4
    p.r(CX - 6, body + 1, CX - 4, bottom_back, BLUE[1])
    p.r(CX - 6, body + 1, CX - 6, bottom_back, BLUE[2])
    p.r(CX - 6, bottom_back, CX - 4, bottom_back, RED[1])
    sprite_torso(p, CX, collar_y, "right")
    # The near leg, and the gákti over the lap and past the knee for the girl.
    p.r(CX - 1, g - 6, knee, g - 5, leg[1])
    shin(knee, g - 6, True, swing)
    lap = knee + 2 if is_girl() else knee - 1
    p.r(CX - 4, body + 1, lap, body + 2, BLUE[1])
    p.r(CX - 4, body + 1, CX - 2, body + 2, BLUE[2])
    if is_girl():
        p.r(lap - 1, body + 3, lap, g - 3, BLUE[1])
        p.r(lap - 1, g - 3, lap, g - 3, YEL[1])
        p.r(lap - 1, g - 2, lap, g - 2, RED[1])
    else:
        p.r(lap, body + 1, lap, body + 2, RED[1])
    # The belt, the arm with its hand on the lap, then the head and hair.
    leather = OUTFITS[look["outfit"]]["belt"] == "leather"
    p.r(CX - 4, body, CX + 3, body, LEATHER[1] if leather else WHITE[1])
    p.r(CX - 1, body, CX - 1, body, SILVER[1] if leather else RED[1])
    p.r(CX - 1, collar_y + 2, CX, body - 1, BLUE[2])
    p.r(CX + 1, collar_y + 2, CX + 1, body - 1, BLUE[0])
    p.r(CX, body - 1, CX + 3, body, BLUE[2])
    p.r(CX + 3, body, CX + 4, body, RED[2])
    p.r(CX + 5, body, CX + 6, body + 1, SKIN[2])
    sprite_long_hair(p, CX, head, "right", 0)
    sprite_head(p, CX, head, "right", False)
    sprite_short_hair_flick(p, CX, head, "right", 0)
    return add_outline(p.img)


def jump_rows():
    """Rising, at the top, coming down, for each way the character can face. The feet tuck up
    and the hem and hair lag: it trails going up and opens on the way down."""
    phases = (
        dict(left=(2, 0), right=(1, 0), lift=-1),
        dict(left=(3, 0), right=(3, 0), flare=1),
        dict(left=(1, 0), right=(2, 0), lift=1, flare=2),
    )
    rows = [[frame(facing, **phase) for phase in phases] for facing in ("down", "up", "right")]
    rows += [[diagonal_frame(facing, **phase) for phase in phases] for facing in ("se", "ne")]
    return rows


def wipe():
    """Getting up after sitting down hard, brushing the gákti, then shaking the hem straight."""
    bent = dict(squat=2, bend=2, flare=1)
    return [frame("down", squat=3, bend=1, flare=2), frame("down", squat=2, bend=2, flare=1),
            frame("down", pat=-1, sway=1, **bent), frame("down", pat=-2, sway=2, **bent),
            frame("down", pat=1, sway=-1, **bent), frame("down", pat=2, sway=-2, **bent),
            frame("down", sway=2, flare=1), frame("down", sway=-2, flare=1)]


def main():
    (OUT / "base").mkdir(parents=True, exist_ok=True)
    (OUT / "sprites").mkdir(parents=True, exist_ok=True)

    # Base models: one per gákti and girl/boy, in the default hair.
    for name, gender in product(OUTFITS, GENDERS):
        look.update(outfit=name, gender=gender, hair="brown", length="long" if gender == "girl" else "short")
        views = [draw_front(), draw_side(), draw_back()]
        for view_name, view in zip(("front", "side", "back"), views):
            view.save(OUT / f"base/{name}-{gender}-{view_name}.png")
        contact_sheet(views, 5).save(OUT / f"base/{name}-{gender}-sheet.png")

    # Sprite sheets. Rows: idle down/up/right and walk down/up/right (eight frames),
    # cheer, jump, crouch, fall (six frames), then the momentum rows: idle and walk again
    # for each direction and each sway in SWAYS, then the hem lifting when a walk toward
    # or away from the viewer stops, then the diagonal views. The game picks among them;
    # see cloth in src/game.js.
    fronts = []
    for old in (OUT / "sprites").glob("*.png"):
        old.unlink()  # all generated here; a style that was dropped must not linger
    combinations = ((n, g, c, length) for n, g, c in product(OUTFITS, GENDERS, HAIRS) for length in HAIR_STYLES[g])
    for name, gender, hair_name, length in combinations:
        look.update(outfit=name, gender=gender, hair=hair_name, length=length)
        rows = [idle("down"), idle("up"), idle("right"), walk("down"), walk("up"), walk("right"),
                cheer(), jump(), crouch(), fall()]
        rows += [pose(facing, sway) for pose in (idle, walk) for facing in ("down", "up", "right") for sway in SWAYS]
        rows += [idle(facing, flare=1, lift=1) for facing in ("down", "up")]
        rows += diagonal_rows()
        rows += jump_rows() + [wipe()]
        rows += run_rows() + [[slide_frame(stage) for stage in range(6)]]
        rows += [[frame("right", squat=3, flare=1)] + [sit_frame(swing) for swing in (0, 1, 2, 1, 0, -1)]]
        sheet = Image.new("RGBA", (FW * 8, FH * len(rows)), (0, 0, 0, 0))
        for y, row in enumerate(rows):
            for x, fr in enumerate(row):
                sheet.alpha_composite(fr, (x * FW, y * FH))
        sheet.save(OUT / f"sprites/{name}-{gender}-{hair_name}-{length}.png", optimize=True)
        if name == "ohcejohka":
            fronts.append(draw_front())
        if name == "ohcejohka" and hair_name == "brown" and length == ("long" if gender == "girl" else "short"):
            first_rows = sheet.crop((0, 0, FW * 8, FH * 10))  # the plain animations, without the sway rows
            contact_sheet([first_rows], 3, gap=2).save(OUT / f"base/animations-{gender}.png")
    contact_sheet(fronts, 2, columns=9, gap=4).save(OUT / "base/hair-options.png")
    print("base models and", len(list((OUT / "sprites").glob("*.png"))), "sprite sheets written")


if __name__ == "__main__":
    main()
