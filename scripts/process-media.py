"""Turns the generated originals in media/raw into responsive WebP files in public/assets/img/gen,
cropped to the ratio each slot uses, and writes src/lib/media.generated.json (sizes for srcset).
Run: python scripts/process-media.py  (needs Pillow)."""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'media', 'raw')
OUT = os.path.join(ROOT, 'public', 'assets', 'img', 'gen')
INDEX = os.path.join(ROOT, 'src', 'lib', 'media.generated.json')
os.makedirs(OUT, exist_ok=True)

# id prefix -> (crop ratio w/h or None, widths, quality)
RULES = [
    ('hero-football-phone', (9 / 16, [780, 1080], 74)),
    ('terms-swatches-phone', (0.45, [360, 648], 76)),   # the phone's portrait crop, taking the section's height
    ('faq-valve-phone', (0.5, [360, 720], 76)),
    ('quality-seam-phone', (0.7, [360, 720], 76)),
    ('hero-football', (None, [1280, 1920, 2560], 72)),
    ('range-', (4 / 5, [420, 640, 960, 1200], 76)),
    ('custom-football', (4 / 5, [640, 960, 1200], 76)),
    ('custom-embroidery', (1.0, [420, 640, 900], 76)),
    ('intro-stitching', (1.0, [640, 960, 1200], 76)),
    ('intro-panels', (4 / 3, [480, 800, 1200], 76)),
    ('intro-thread', (1.0, [420, 640, 900], 76)),
    ('custom-range', (4 / 3, [800, 1200, 1600], 76)),
    ('process-', (4 / 3, [640, 960, 1280, 1600], 76)),
    ('terms-', (4 / 3, [640, 960, 1280], 76)),
    ('faq-', (4 / 3, [640, 960, 1280], 76)),
    ('quality-seam', (1440 / 560, [960, 1440, 1920], 74)),
    ('nav-', (16 / 9, [480, 800], 76)),
    ('studio-', (16 / 9, [800, 1200], 76)),
    ('p-', (1.0, [400, 640, 960, 1600], 78)),
]


def rule_for(name):
    for prefix, rule in RULES:
        if name == prefix or name.startswith(prefix):
            return rule
    return (None, [960], 78)


def crop(im, ratio):
    if not ratio:
        return im
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ratio)
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def main():
    index = {}
    if os.path.exists(INDEX):
        with open(INDEX, encoding='utf8') as f:
            index = json.load(f)
    only = set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None
    for fname in sorted(os.listdir(RAW)):
        name, ext = os.path.splitext(fname)
        if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        if only and name not in only:
            continue
        ratio, widths, quality = rule_for(name)
        im = Image.open(os.path.join(RAW, fname)).convert('RGB')
        im = crop(im, ratio)
        w, h = im.size
        made = []
        for target in widths:
            if target > w:
                continue
            th = round(h * target / w)
            out = im.resize((target, th), Image.LANCZOS)
            out.save(os.path.join(OUT, f'{name}-{target}.webp'), 'WEBP', quality=quality, method=6)
            made.append(target)
        if not made or made[-1] < w and w not in widths and w <= max(widths):
            im.save(os.path.join(OUT, f'{name}-{w}.webp'), 'WEBP', quality=quality, method=6)
            made.append(w)
        if name.startswith(('p-', 'range-')):
            small = im.copy(); small.thumbnail((600, 600))
            small.save(os.path.join(OUT, f'{name}-pdf.jpg'), 'JPEG', quality=80, optimize=True)
        index[name] = {'w': made[-1], 'h': round(h * made[-1] / w), 'widths': made}
        print(name, made)
    with open(INDEX, 'w', encoding='utf8') as f:
        json.dump(dict(sorted(index.items())), f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
