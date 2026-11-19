#!/usr/bin/env node
/* Turns the hero film into the frame sequences the homepage scrubs with the scroll (the way product
   launch pages play a film on scroll: one still per step, drawn to a canvas, so seeking is instant).
     node scripts/build-hero-frames.mjs                                   media/raw/hero-seq/kling-take.mp4
     node scripts/build-hero-frames.mjs --in a.mp4,b.mp4,c.mp4            clips joined in order
     node scripts/build-hero-frames.mjs --ball 0.649,0.487,0.712          the football's centre x, y (fractions of the frame) and diameter (of its height)
     node scripts/build-hero-frames.mjs --bg "#020202" --stages 0.56,0.81  the film's ground colour; where the stage label changes
     node scripts/build-hero-frames.mjs --timeline 0:0,0.4:0.25,1:1        scroll progress to film time pairs (the pacing)
     node scripts/build-hero-frames.mjs --steps lg:2,md:3,sm:3             keep every nth film frame per set (fewer: lighter, more: smoother)
     node scripts/build-hero-frames.mjs --format avif                      AVIF frames (about a third lighter than WebP; the player checks support)
   Writes public/assets/img/hero-film/{lg,md,sm}/NNNN.webp|avif and public/assets/img/hero-film/seq.json.
   ffmpeg: the FFMPEG environment variable, else the one bundled with Python's imageio-ffmpeg, else ffmpeg on PATH. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// a folder per film (the site caches /assets for a week): change it, and the player's BASE, for the next film
const OUT = path.join(ROOT, 'public', 'assets', 'img', 'hero-film');
const args = process.argv.slice(2);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim(); } catch { return 'ffmpeg'; }
}
const FF = ffmpegPath();
const inputs = (arg('--in') || 'media/raw/hero-seq/kling-take.mp4').split(',').map((p) => path.resolve(ROOT, p));
for (const f of inputs) if (!fs.existsSync(f)) { console.error(`missing ${f}`); process.exit(1); }
const [bx, by, bd] = (arg('--ball') || '0.649,0.487,0.712').split(',').map(Number);
const bg = arg('--bg') || '#000000';                       // the film's ground, so the canvas fill matches it
const stages = (arg('--stages') || '0.56,0.81').split(',').map(Number); // where the label moves to rugby, then handball
/* The pacing: scroll progress to film time (both 0 to 1), piecewise linear. More scroll for the assembly and
   the two changes, less for the holds in between. */
const timeline = (arg('--timeline') || '0:0,0.04:0,0.40:0.249,0.48:0.415,0.64:0.540,0.76:0.797,0.86:0.864,1:1')
  .split(',').map((pair) => pair.split(':').map(Number));

/* Three sets: lg for screens 1024px and wider, md for high-density phones and tablets, sm for the
   rest and for data saver. Every second (lg) or third (md, sm) film frame is kept; the player cross-fades between neighbours, so the motion
   stays fluid while the download stays a few megabytes. */
const FORMAT = arg('--format') === 'avif' ? 'avif' : 'webp';
/* AVIF (the long film): narrower lg frames and fewer frames on phones keep the download near the old film's per
   second of scroll; a light denoise takes the costly paper grain out without softening the leather or the thread. */
const SETS = FORMAT === 'avif' ? [
  { id: 'lg', width: 1600, step: 3, quality: 44 },
  { id: 'md', width: 1280, step: 4, quality: 42 },
  { id: 'sm', width: 960, step: 5, quality: 40 },
] : [
  { id: 'lg', width: 1920, step: 2, quality: 74 },
  { id: 'md', width: 1280, step: 3, quality: 72 },
  { id: 'sm', width: 960, step: 3, quality: 70 },
];
for (const pair of (arg('--steps') || '').split(',').filter(Boolean)) {
  const [id, n] = pair.split(':'); const s = SETS.find((x) => x.id === id);
  if (s && Number(n) >= 1) s.step = Math.round(Number(n));
}

const join = inputs.length > 1
  ? { pre: inputs.flatMap((f) => ['-i', f]), filter: `${inputs.map((_, i) => `[${i}:v]setsar=1,fps=24[j${i}];`).join('')}${inputs.map((_, i) => `[j${i}]`).join('')}concat=n=${inputs.length}:v=1:a=0,` }
  : { pre: ['-i', inputs[0]], filter: '' };

const manifest = { ball: { x: bx, y: by, d: bd }, bg, stages, timeline, ext: FORMAT, sets: {} };
for (const s of SETS) {
  const dir = path.join(OUT, s.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const size = `scale=${s.width}:${Math.round((s.width * 9) / 16)}:flags=lanczos`;
  const vf = `${join.filter}select='not(mod(n\\,${s.step}))',${FORMAT === 'avif' ? `hqdn3d=3:2:4:4,${size}` : size}`;
  if (FORMAT === 'avif') {
    // ffmpeg cuts lossless PNG frames; Pillow (libavif) writes the AVIF files: ffmpeg's image-sequence muxer leaves
    // out parts of the AVIF container that browsers need, so its files do not decode
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `hero-${s.id}-`));
    execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...join.pre, '-filter_complex', vf, '-fps_mode', 'vfr', path.join(tmp, '%04d.png')], { stdio: 'inherit' });
    execFileSync('python', [path.join(ROOT, 'scripts', 'png-to-avif.py'), tmp, dir, String(s.quality), '6'], { stdio: 'inherit' });
    fs.rmSync(tmp, { recursive: true, force: true });
  } else {
    execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...join.pre, '-filter_complex', vf, '-fps_mode', 'vfr',
      '-c:v', 'libwebp', '-quality', String(s.quality), '-compression_level', '6', '-preset', 'photo', path.join(dir, '%04d.webp')], { stdio: 'inherit' });
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(`.${FORMAT}`)).sort();
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  manifest.sets[s.id] = { width: s.width, height: Math.round((s.width * 9) / 16), count: files.length };
  console.log(`${s.id}: ${files.length} frames, ${(bytes / 1048576).toFixed(1)} MB`);
}
fs.writeFileSync(path.join(OUT, 'seq.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log('wrote public/assets/img/hero-film/seq.json');
