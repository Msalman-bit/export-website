"""Bridges for the new hero film where an AI clip could not hold the ball still: a dissolve between the last frame
of one clip and the first frame of the next, with the ball's size and position matched through the dissolve, so the
two balls never show a double outline. Used for the seams pulling tight (laced -> stitched) and the football turning
into the handball (the same round ball, a new surface and a slightly smaller size).

    python scripts/build-hero-bridges.py

Reads media/raw/hero-film/<clip>-veo3.mp4 and writes media/raw/hero-film/<name>-bridge.mp4 (1920x1080, 24 fps).
Needs numpy, Pillow and imageio-ffmpeg (pip install numpy pillow imageio-ffmpeg)."""
import math, os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageFilter
import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'media', 'raw', 'hero-film')
FF = os.environ.get('FFMPEG') or imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 24

# name: (clip whose LAST frame starts it, clip whose FIRST frame ends it, seconds)
BRIDGES = {
    'tighten': ('thread', 'print', 1.5),
    'handball': ('print', 'rugby', 2.0),
}


def frame(clip, which):
    """The first or last frame of a clip as an RGB image."""
    src = os.path.join(RAW, f'{clip}-veo3.mp4')
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, 'f.png')
        args = [FF, '-hide_banner', '-loglevel', 'error', '-y']
        args += ['-sseof', '-0.1'] if which == 'last' else []
        args += ['-i', src, '-frames:v', '1', '-update', '1', out]
        subprocess.run(args, check=True)
        return Image.open(out).convert('RGB').resize((W, H), Image.LANCZOS)


def ball(img):
    """Centre and diameter of the bright ball on the black ground."""
    a = np.asarray(img.convert('L'), dtype=np.uint8)
    ys, xs = np.nonzero(a > 38)
    # ignore stray bright pixels: keep the central 98% of the bright area
    x0, x1 = np.percentile(xs, [1, 99]); y0, y1 = np.percentile(ys, [1, 99])
    return ((x0 + x1) / 2, (y0 + y1) / 2), max(x1 - x0, y1 - y0)


def place(img, c_from, c_to, s):
    """The image scaled by s about c_from, with c_from moved to c_to (black outside)."""
    a, e = 1 / s, 1 / s
    c = c_from[0] - c_to[0] / s
    f = c_from[1] - c_to[1] / s
    return img.transform((W, H), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC, fillcolor=(0, 0, 0))


def smooth(t):
    return t * t * (3 - 2 * t)


def build(name, a_clip, b_clip, seconds):
    A, B = frame(a_clip, 'last'), frame(b_clip, 'first')
    (ca, da), (cb, db) = ball(A), ball(B)
    n = round(seconds * FPS)
    out = os.path.join(RAW, f'{name}-bridge.mp4')
    p = subprocess.Popen([FF, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                          '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow',
                          '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for i in range(n):
        t = i / (n - 1)
        e = smooth(t)
        c = (ca[0] + (cb[0] - ca[0]) * e, ca[1] + (cb[1] - ca[1]) * e)
        d = da + (db - da) * e
        a_img = place(A, ca, c, d / da)
        b_img = place(B, cb, c, d / db)
        mix = Image.blend(a_img, b_img, e)
        r = 1.6 * math.sin(math.pi * t)  # a touch of blur at the middle hides the two surfaces crossing
        if r > 0.2:
            mix = mix.filter(ImageFilter.GaussianBlur(r))
        p.stdin.write(mix.tobytes())
    p.stdin.close(); p.wait()
    print(f'{name}: {n} frames, ball {da:.0f}px -> {db:.0f}px, centre ({ca[0]:.0f},{ca[1]:.0f}) -> ({cb[0]:.0f},{cb[1]:.0f}) -> {out}')


if __name__ == '__main__':
    for name, (a, b, s) in BRIDGES.items():
        build(name, a, b, s)
