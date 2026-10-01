from PIL import Image, ImageDraw
import math

INK = (26, 20, 16, 255)
RED = (176, 35, 26, 255)
GOLD = (240, 180, 41, 255)
CREAM = (246, 238, 221, 255)

def rotate_pt(px, py, cx, cy, deg):
    a = math.radians(deg)
    dx, dy = px - cx, py - cy
    rx = dx*math.cos(a) - dy*math.sin(a)
    ry = dx*math.sin(a) + dy*math.cos(a)
    return (cx+rx, cy+ry)

def drumstick(img, cx, cy, s, color, angle=-35):
    # Build the drumstick upright (meat on top, bone/knob at bottom),
    # then rotate the whole composite by `angle` degrees.
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)

    meat_r = s*0.50
    meat_cx, meat_cy = cx, cy - s*0.28

    bone_top_w = s*0.30
    bone_bottom_w = s*0.16
    bone_top_y = meat_cy + meat_r*0.55
    bone_bottom_y = cy + s*0.62

    # tapered bone as polygon (trapezoid)
    d.polygon([
        (cx - bone_top_w/2, bone_top_y),
        (cx + bone_top_w/2, bone_top_y),
        (cx + bone_bottom_w/2, bone_bottom_y),
        (cx - bone_bottom_w/2, bone_bottom_y),
    ], fill=color)

    # meat lobe
    d.ellipse([meat_cx-meat_r, meat_cy-meat_r, meat_cx+meat_r, meat_cy+meat_r], fill=color)

    # knob at bottom
    knob_r = s*0.135
    d.ellipse([cx-knob_r, bone_bottom_y-knob_r*0.6, cx+knob_r, bone_bottom_y+knob_r*1.4], fill=color)

    layer = layer.rotate(angle, resample=Image.BICUBIC, center=(cx, cy))
    img.alpha_composite(layer)

def make_icon(size, path, maskable=False, bg=INK):
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rectangle([0,0,size,size], fill=bg)

    cx, cy = size/2, size/2
    circle_r = size * (0.40 if maskable else 0.42)

    d.ellipse([cx-circle_r, cy-circle_r, cx+circle_r, cy+circle_r], fill=RED)
    ring_w = max(2, int(size*0.02))
    d.ellipse([cx-circle_r, cy-circle_r, cx+circle_r, cy+circle_r], outline=GOLD, width=ring_w)

    drumstick(img, cx, cy + size*0.01, circle_r*0.98, CREAM, angle=-30)

    img.save(path, "PNG")

make_icon(192, "/home/claude/lakuku-react/public/icons/icon-192.png", maskable=False)
make_icon(512, "/home/claude/lakuku-react/public/icons/icon-512.png", maskable=False)
make_icon(192, "/home/claude/lakuku-react/public/icons/maskable-192.png", maskable=True)
make_icon(512, "/home/claude/lakuku-react/public/icons/maskable-512.png", maskable=True)
make_icon(180, "/home/claude/lakuku-react/public/icons/apple-touch-icon.png", maskable=False)
make_icon(32, "/home/claude/lakuku-react/public/icons/favicon-32.png", maskable=False)
make_icon(16, "/home/claude/lakuku-react/public/icons/favicon-16.png", maskable=False)
print("done")
