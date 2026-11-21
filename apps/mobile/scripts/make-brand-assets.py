#!/usr/bin/env python3
"""
Draws the app icon, splash mark and adaptive icon layers into assets/.  Run:  python3 scripts/make-brand-assets.py
Needs Pillow. Text only (no illustrations): an "MN." monogram in Figtree ExtraBold, the dashboard's navy and orange.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

NAVY = (16, 26, 51, 255)      # #101a33
ORANGE = (240, 131, 29, 255)  # #f0831d
WHITE = (255, 255, 255, 255)
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets"
FONT = HERE.parent.parent.parent / "node_modules/@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf"
if not FONT.exists():
    FONT = HERE.parent / "node_modules/@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf"
SS = 3  # draw larger, shrink for smooth edges
S = 1024


def mark(size, text_w, letters=WHITE, dot=ORANGE, bg=None):
    """'MN' with an orange full stop, optically centred, text_w px wide (of `size`)."""
    px = size * SS
    img = Image.new("RGBA", (px, px), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # find a font size that gives the requested width for "MN."
    fs = 100
    for _ in range(12):
        f = ImageFont.truetype(str(FONT), fs)
        w = d.textlength("MN.", font=f)
        fs = int(fs * (text_w * SS) / w)
    f = ImageFont.truetype(str(FONT), fs)
    wm = d.textlength("MN", font=f)
    wd = d.textlength(".", font=f)
    x = (px - (wm + wd)) / 2
    # centre on the cap height of M, not the line box
    top, bottom = d.textbbox((0, 0), "MN", font=f)[1], d.textbbox((0, 0), "MN", font=f)[3]
    y = (px - (bottom - top)) / 2 - top
    d.text((x, y), "MN", font=f, fill=letters)
    d.text((x + wm, y), ".", font=f, fill=dot)
    return img


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(OUT / name)
    print("wrote", name)


# native splash mark (transparent; sits on the navy splash background). Keep it inside Android 12's circular mask.
save(mark(S, S * 0.36), S, "splash-icon.png")

# iOS icon: full-bleed navy square, iOS rounds it
save(mark(S, S * 0.62, bg=NAVY), S, "icon.png")

# Android adaptive icon: layers (safe zone is the centre 66%)
save(Image.new("RGBA", (S, S), NAVY), S, "android-icon-background.png")
save(mark(S, S * 0.46), S, "android-icon-foreground.png")

# themed (monochrome) icon: single colour, no orange
save(mark(S, S * 0.46, letters=WHITE, dot=WHITE), S, "android-icon-monochrome.png")

# favicon
save(mark(48, 48 * 0.66, bg=NAVY), 48, "favicon.png")
