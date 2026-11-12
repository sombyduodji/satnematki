"""Makes the game's icon: Máhtte and Biret side by side on the flag's yellow, the icon the user chose (2026-11-12).

The two figures are the game's own, standing and facing the player, as src/game.js draws them from art/mahtte/ with the
first look of each in the character chooser; they were taken from the game once into art/icon/biret.png and mahtte.png
(96 × 160, the sheet's own pixels), as the game colours hair and eyes only as it runs. This puts them together, enlarged
without smoothing, and writes:

  art/icon/icon-512.png, icon-192.png        the icon, square, for the web app manifest
  art/icon/maskable-512.png                  the same with room round it, for phones that cut icons into circles or squircles
  art/icon/apple-touch-icon.png              180 px, for an iPhone's home screen
  art/icon/favicon-32.png, favicon-48.png    for a browser tab

    python3 tools/make_icon.py   (needs Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ICON = Path(__file__).resolve().parent.parent / "art" / "icon"
SIZE = 1024
YELLOW, SHADE = (247, 201, 25), (220, 170, 10)


def figure(name):
    image = Image.open(ICON / f"{name}.png").convert("RGBA")
    return image.crop(image.getbbox())


def enlarged(image, height):
    k = max(1, round(height / image.height))
    return image.resize((image.width * k, image.height * k), Image.NEAREST)


def with_shadow(canvas, image, x, y):
    alpha = image.split()[3].point(lambda v: 90 if v else 0)
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow.putalpha(alpha)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(shadow, (x, y + 8), shadow)
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(18)))
    canvas.alpha_composite(image, (x, y))


def icon(figure_height, ground):
    """The two on yellow, standing on a patch of shade; the figures' height decides how much room is left round them."""
    canvas = Image.new("RGBA", (SIZE, SIZE), YELLOW + (255,))
    mahtte, biret = enlarged(figure("mahtte"), figure_height), enlarged(figure("biret"), figure_height)
    top = ground - mahtte.height
    ImageDraw.Draw(canvas).ellipse([SIZE // 2 - int(figure_height * 0.66), ground - 50, SIZE // 2 + int(figure_height * 0.66), ground + 70], fill=SHADE)
    overlap = figure_height // 26
    left = (SIZE - (mahtte.width + biret.width - 2 * overlap)) // 2  # the pair together in the middle
    with_shadow(canvas, mahtte, left, top)
    with_shadow(canvas, biret, left + mahtte.width - 2 * overlap, top)
    return canvas.convert("RGB")


def main():
    full = icon(520, 750)
    # A maskable icon must keep what matters within the middle 80%; a circle cut from it loses the corners.
    maskable = icon(400, 700)
    for size in (512, 192):
        full.resize((size, size), Image.LANCZOS).save(ICON / f"icon-{size}.png", optimize=True)
    maskable.resize((512, 512), Image.LANCZOS).save(ICON / "maskable-512.png", optimize=True)
    full.resize((180, 180), Image.LANCZOS).save(ICON / "apple-touch-icon.png", optimize=True)
    for size in (32, 48):
        full.resize((size, size), Image.LANCZOS).save(ICON / f"favicon-{size}.png", optimize=True)
    print("written:", ", ".join(sorted(p.name for p in ICON.glob("*.png") if p.name not in ("biret.png", "mahtte.png"))))


if __name__ == "__main__":
    main()
