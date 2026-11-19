"""Encodes a folder of PNG frames into AVIF files browsers can decode (Pillow's libavif writes a complete AVIF
container; ffmpeg's image-sequence muxer does not), several at a time. Used by scripts/build-hero-frames.mjs.

    python scripts/png-to-avif.py <png folder> <avif folder> <quality 0-100> [speed 0-10]
"""
import os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image


def encode(job):
    src, dst, quality, speed = job
    with Image.open(src) as im:
        im.convert('RGB').save(dst, format='AVIF', quality=quality, speed=speed, subsampling='4:2:0')
    return os.path.getsize(dst)


if __name__ == '__main__':
    src_dir, dst_dir, quality = sys.argv[1], sys.argv[2], int(sys.argv[3])
    speed = int(sys.argv[4]) if len(sys.argv) > 4 else 6
    os.makedirs(dst_dir, exist_ok=True)
    names = sorted(f for f in os.listdir(src_dir) if f.endswith('.png'))
    jobs = [(os.path.join(src_dir, n), os.path.join(dst_dir, n[:-4] + '.avif'), quality, speed) for n in names]
    with ProcessPoolExecutor() as pool:
        total = sum(pool.map(encode, jobs, chunksize=4))
    print(f'{len(jobs)} frames, {total / 1048576:.1f} MB')
