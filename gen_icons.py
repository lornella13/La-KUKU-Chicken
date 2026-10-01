"""
Build the PWA / install icons from the real La Kuku brand logo.

The app icon used to be a generated drumstick badge on a navy background, which
is why installing the site put a blue tile on the home screen. The installed app
now shows the same La Kuku logo the website uses.

Icon flavours, matching what browsers ask for:
  * "any"       - square, logo on a full-bleed brand background
  * "maskable"  - Android crops these to a circle/squircle, so the logo is kept
                  well inside the safe zone and the background is full-bleed
  * apple-touch - iOS home screen icon (iOS never honours transparency)
  * favicon     - browser tab

Run from anywhere:  python3 gen_icons.py
"""

import os

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
BRAND_LOGO = os.path.join(ROOT, 'public', 'images', 'brand', 'logo.png')
ICON_DIR = os.path.join(ROOT, 'public', 'icons')

# Matches --ink / theme_color / background_color in index.css + manifest, so the
# installed app sits with the rest of the brand rather than fighting it.
BRAND_BG = (26, 20, 16, 255)


def load_mark():
    """The brand logo, cropped to its visible artwork so it centres properly."""
    im = Image.open(BRAND_LOGO).convert('RGBA')

    # Crop away transparent padding using the alpha channel.
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def make_icon(size, filename, mark_ratio):
    """
    Build one icon: full-bleed brand background with the centred logo.

    `mark_ratio` is the logo width as a fraction of the icon. Smaller ratios
    leave more margin, which maskable icons need because the platform crops.
    """
    mark = load_mark()

    # Fit the logo inside a square, then scale to the requested share.
    side = max(mark.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))

    target = max(1, round(size * mark_ratio))
    square = square.resize((target, target), Image.LANCZOS)

    canvas = Image.new('RGBA', (size, size), BRAND_BG)
    canvas.alpha_composite(square, ((size - target) // 2, (size - target) // 2))

    path = os.path.join(ICON_DIR, filename)
    canvas.convert('RGB').save(path, 'PNG', optimize=True)
    print(f'  {filename:<22} {size}x{size}  logo at {int(mark_ratio * 100)}%')


def main():
    os.makedirs(ICON_DIR, exist_ok=True)
    if not os.path.exists(BRAND_LOGO):
        raise SystemExit(f'brand logo not found: {BRAND_LOGO}')

    print('building icons from', os.path.relpath(BRAND_LOGO, ROOT))
    # "any" + apple + favicons: comfortable margin
    make_icon(512, 'icon-512.png', 0.76)
    make_icon(192, 'icon-192.png', 0.76)
    make_icon(180, 'apple-touch-icon.png', 0.76)
    # maskable: Android may crop to a circle covering ~80% of the canvas, so the
    # logo stays inside the middle ~58% to survive the tightest masks.
    make_icon(512, 'maskable-512.png', 0.58)
    make_icon(192, 'maskable-192.png', 0.58)
    # favicons: fill more of the small square, but leave a hairline of padding
    make_icon(32, 'favicon-32.png', 0.82)
    make_icon(16, 'favicon-16.png', 0.86)
    print('done')


if __name__ == '__main__':
    main()