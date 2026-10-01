"""
DEPRECATED -- NOT USED BY THE WEBSITE. Do not wire this back in.

This script cut the studio backdrop out of each product photo to produce
"cutout" tiles. It was reverted because it was DAMAGING the product: the
flood fill was eating into the chicken itself (Wings lost large areas of
meat), and the un-mixing step amplified that by dividing already-clipped
pixels by a small alpha. Real product photographs were being destroyed to
chase a flat backdrop.

The site now displays the original photographs from public/images/products
directly, in a square container using object-fit: contain. Nothing is cropped,
stretched or background-removed, so nothing can be damaged.

Kept only as a record of the approach and its failure mode. If you re-run it,
it writes to a clearly-marked experimental folder that no component imports,
so a mistake here can never become the product image again.

Run:  python3 build_product_images.py
"""

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC_DIR = "public/images/products"
# Deliberately NOT "optimized" -- the site must never reference this folder.
OUT_DIR = os.path.join(SRC_DIR, "_cutout-experimental-DEPRECATED")

TILE = 720  # output square edge, px
PAD_RATIO = 0.085  # uniform breathing room around the artwork
BG_TOLERANCE = 30  # flood-fill tolerance against the sampled border colour
NEAR_WHITE = 225  # a border this bright and this flat is a studio backdrop

# Stage the artwork sits on.
#
# The real constraint, measured on the photos: product edges span L* 35 (liver)
# to L* 90 (thighs, whole leg), and the mid-tones are densely packed -- beef
# sausage at L* 60, nyama at 67, backs 74, royal butchery 78, pale cuts 79-82.
#
# Pale cuts need a DARKER stage; the mid sausages need a LIGHTER one. Those
# pull in opposite directions, so no flat stage can separate all 18 - which is
# exactly why pale cuts used to disappear into the old cream. Rather than drag
# the stage down to a muddy brown and make the site feel dark, the stage stays
# a light warm neutral and the outline below does the separating.
SURFACE_TOP = (236, 223, 202)
SURFACE_BOTTOM = (223, 207, 181)

# Thin warm outline hugging the silhouette.
#
# Because it follows the edge itself, it separates every product regardless of
# its own tone: L* 90 pale thigh and L* 60 dark sausage both get a large step.
# Thin and soft so it reads as contact shadow and ambient occlusion, the way
# real food photography defines an edge -- not as a drop shadow.
OUTLINE_RGB = (48, 34, 18)
OUTLINE_ALPHA = 0.70
OUTLINE_BLUR = 2.8
OUTLINE_OFFSET_Y = 2

PRODUCTS = [
    ("wholechicken.png", "whole-chicken"),
    ("mixed.png", "mixed-portion"),
    ("thighs.png", "whole-leg"),
    ("drumsticks.png", "drumsticks"),
    ("wings.png", "wings"),
    ("thighs.png", "thighs"),
    ("breat_fillet.png", "breast-fillets"),
    ("gizzards.png", "gizzards"),
    ("liver.png", "liver"),
    ("neck.png", "necks"),
    ("back.png", "backs"),
    ("hungarian beef saosage.png", "hungarian-beef-1kg"),
    ("hungarian beef saosage.png", "hungarian-beef-500g"),
    ("smokedchicken.png", "smoked-chicken-1kg"),
    ("smokedchicken.png", "smoked-chicken-500g"),
    ("nyamanyama.png", "nyama-nyama-beef-1kg"),
    ("royalbutchery.png", "royal-butchery-beef-1kg"),
    ("royalbutchery.png", "royal-butchery-beef-500g"),
]


def surface(size):
    """Warm neutral stage with a gentle vertical gradient for depth."""
    w, h = size
    top = np.array(SURFACE_TOP, dtype=float)
    bottom = np.array(SURFACE_BOTTOM, dtype=float)
    ramp = np.linspace(0.0, 1.0, h)[:, None]
    band = top[None, :] * (1 - ramp) + bottom[None, :] * ramp
    rgb = np.repeat(band[:, None, :], w, axis=1).astype(np.uint8)
    return Image.fromarray(rgb, "RGB").convert("RGBA")


def border_colour(arr):
    """Median colour of the outermost ring -- a robust backdrop sample."""
    h, w = arr.shape[:2]
    ring = np.concatenate(
        [arr[0, :, :], arr[h - 1, :, :], arr[:, 0, :], arr[:, w - 1, :]], axis=0
    )
    return np.median(ring.astype(float), axis=0)


def is_studio_backdrop(bg):
    flat = np.abs(bg - bg[0]).max() < 8
    return bool(flat and bg.min() >= NEAR_WHITE)


def cutout(im, bg, tolerance=BG_TOLERANCE):
    """Alpha-mask the artwork via edge-connected flood fill."""
    arr = np.asarray(im).astype(float)
    diff = np.abs(arr - bg).max(axis=2).astype(np.uint8)

    # Flood fill has to run on the difference image itself -- it compares
    # neighbouring pixel values, so filling a blank mask would reach nothing.
    filled = Image.fromarray(diff, "L").copy()
    w, h = im.size
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    for seed in seeds:
        if diff[seed[1], seed[0]] <= tolerance:
            ImageDraw.floodfill(filled, seed, 255, thresh=tolerance)

    backdrop = Image.fromarray(
        (np.asarray(filled) == 255).astype(np.uint8) * 255, "L"
    )

    # Grow the backdrop region by 2px and feather, so cut edges are smooth
    # rather than stair-stepped against the stage.
    grown = backdrop.filter(ImageFilter.MaxFilter(5))
    alpha = Image.fromarray((255 - np.asarray(grown)).astype(np.uint8), "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))

    # Un-mix the feathered edge back to true product colour.
    #
    # Feathering makes edge pixels semi-transparent, but those pixels still
    # carry the *background* colour they were sampled from. Compositing them
    # as-is leaves a pale rim -- a visible halo on any stage darker than the
    # studio white. Recovering the real colour keeps the outline clean:
    #     observed = fg*a + bg*(1-a)   =>   fg = (observed - bg*(1-a)) / a
    obs = np.asarray(im).astype(np.float64)
    a = (np.asarray(alpha).astype(np.float64) / 255.0)[..., None]
    bgc = np.asarray(bg, dtype=np.float64).reshape(1, 1, 3)
    safe = np.where(a > 0.04, a, 1.0)
    fg = np.clip((obs - bgc * (1.0 - a)) / safe, 0, 255)

    out = Image.fromarray(
        np.dstack([fg, np.asarray(alpha).astype(np.uint8)]).astype(np.uint8), "RGBA"
    )
    return out


def outline(size, artwork, offset):
    """A thin, soft dark band hugging the silhouette.

    A displaced drop shadow cannot define the outline of pale skin -- the
    shadow lands away from the edge and leaves it flat. A band that follows
    the silhouette itself can, the way contact shadow and ambient occlusion
    define an edge in real food photography.
    """
    w, h = size
    # Build a tile-sized alpha from the artwork alpha at its paste position.
    full = Image.new("L", (w, h), 0)
    full.paste(artwork.split()[3], offset)

    # Spread the mask outward, then subtract the original, leaving only the
    # band that sits outside the product.
    spread = full.filter(ImageFilter.GaussianBlur(OUTLINE_BLUR))
    band = Image.fromarray(
        np.clip(
            np.asarray(spread).astype(int) - np.asarray(full).astype(int), 0, 255
        ).astype(np.uint8),
        "L",
    )
    band = band.point(lambda v: int(v * OUTLINE_ALPHA))

    outline_layer = Image.new("RGBA", (w, h), OUTLINE_RGB + (0,))
    outline_layer.putalpha(band)

    # Nudge downward, kept inside the tile so it never clips.
    dy = min(OUTLINE_OFFSET_Y, h // 8)
    shifted = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shifted.paste(outline_layer, (0, dy))
    return shifted


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    cache = {}
    total_before = total_after = 0

    for filename, slug in PRODUCTS:
        src = os.path.join(SRC_DIR, filename)
        before = os.path.getsize(src)
        total_before += before

        if filename not in cache:
            im = Image.open(src).convert("RGB")
            arr = np.asarray(im)
            bg = border_colour(arr)
            if is_studio_backdrop(bg):
                cache[filename] = (cutout(im, bg), True)
            else:
                cache[filename] = (im.convert("RGBA"), False)

        art, keyed = cache[filename]

        if keyed:
            box = art.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
            art = art.crop(box)

        canvas = surface((TILE, TILE))
        inner = TILE - int(TILE * PAD_RATIO * 2)
        # Explicit scale rather than Image.thumbnail(), which only ever shrinks.
        # Without allowing upscale, a 193 px source would sit tiny in the tile
        # next to a 1200 px one and the grid would look arbitrary.
        scale = min(inner / art.width, inner / art.height)
        fitted = art.resize(
            (max(1, round(art.width * scale)), max(1, round(art.height * scale))),
            Image.LANCZOS,
        )
        if keyed:
            pos = ((TILE - fitted.width) // 2, (TILE - fitted.height) // 2)
            canvas.alpha_composite(outline((TILE, TILE), fitted, pos))
            canvas.paste(fitted, pos, fitted)
        else:
            # Already a full-bleed styled photo: cover-crop, centred.
            fill = Image.new("RGBA", (inner, inner))
            scale = max(inner / art.width, inner / art.height)
            big = art.resize(
                (max(inner, round(art.width * scale)), max(inner, round(art.height * scale))),
                Image.LANCZOS,
            )
            off = ((big.width - inner) // 2, (big.height - inner) // 2)
            fill.paste(big.crop((off[0], off[1], off[0] + inner, off[1] + inner)), (0, 0))
            canvas.paste(fill, ((TILE - inner) // 2, (TILE - inner) // 2), fill)

        out = os.path.join(OUT_DIR, slug + ".webp")
        # The stage fills the whole tile opaquely, so the alpha channel is
        # always fully opaque -- save as RGB rather than carrying dead alpha.
        canvas.convert("RGB").save(out, "WEBP", quality=84, method=6)
        total_after += os.path.getsize(out)
        print(
            "%-24s %-28s %-6s %7d b -> %6d b  art %dx%d"
            % (slug, filename, "keyed" if keyed else "cover",
               before, os.path.getsize(out), art.width, art.height)
        )

    print("-" * 78)
    print("total source %d b -> total tiles %d b (%.0f%%)"
          % (total_before, total_after, total_after / total_before * 100))


if __name__ == "__main__":
    main()