#!/usr/bin/env node
/* The homepage hero's scroll sequence, made with Kie AI and downloaded to media/raw/hero-seq.
     node scripts/generate-hero-sequence.mjs keyframes             the four keyframes (football first, the rest edited from it)
     node scripts/generate-hero-sequence.mjs keyframes --only k2   just this keyframe again
     node scripts/generate-hero-sequence.mjs video --model kling   one continuous take through all five keyframes (Kling 4.0 keyframe-to-video)
     node scripts/generate-hero-sequence.mjs video --model seedance  three clips, first and last frame each (Seedance 2.0)
     node scripts/generate-hero-sequence.mjs video --model veo       three clips, first and last frame each (Veo 3.1)
   Keyframes: k0 the exploded view (bladder, lining, panels), k0b the panels closing in, k1 the football, k2 the rugby
   ball, k3 the handball, all on the same
   black ground, framing and light, so the clips join without a jump. The key is read from KIE_API_KEY
   (environment or .env.local) and never printed; progress and credits are kept in media/hero-seq/tasks.json. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'media', 'raw', 'hero-seq');
const TASKS = path.join(ROOT, 'media', 'hero-seq-tasks.json');
const API = 'https://api.kie.ai/api/v1/jobs';
fs.mkdirSync(OUT, { recursive: true });

function readKey() {
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY.trim();
  const m = fs.existsSync(path.join(ROOT, '.env.local')) && fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^KIE_API_KEY=(.*)$/m);
  if (m && m[1].trim()) return m[1].trim();
  console.error('KIE_API_KEY is not set (environment or .env.local).'); process.exit(1);
}
const KEY = readKey();
const tasks = fs.existsSync(TASKS) ? JSON.parse(fs.readFileSync(TASKS, 'utf8')) : {};
const save = () => fs.writeFileSync(TASKS, JSON.stringify(tasks, null, 1) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);

async function api(method, url, body) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000) });
      const j = await r.json();
      if (j.code === 429) { await sleep(4000 * (i + 1)); continue; }
      return j;
    } catch (e) { if (i === 4) throw e; await sleep(3000); }
  }
  throw new Error('rate limited');
}
async function create(model, input) {
  const res = await api('POST', `${API}/createTask`, { model, input });
  if (res.code !== 200 || !res.data?.taskId) throw new Error(`createTask ${res.code}: ${res.msg}`);
  return res.data.taskId;
}
async function wait(taskId, label, maxMs = 40 * 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await sleep(8000);
    const d = (await api('GET', `${API}/recordInfo?taskId=${encodeURIComponent(taskId)}`)).data || {};
    if (d.state === 'success') {
      const r = typeof d.resultJson === 'string' ? JSON.parse(d.resultJson) : d.resultJson || {};
      const urls = r.resultUrls || r.result_urls || r.data?.result_urls || [];
      return { urls, credits: d.creditsConsumed ?? null };
    }
    if (d.state === 'fail') throw new Error(`${label} failed: ${d.failMsg || d.failCode || 'unknown'}`);
  }
  throw new Error(`${label}: timed out`);
}
async function download(url, file) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!r.ok) throw new Error(`download ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/* ---------- the keyframes ---------- */
const SAME = 'Keep exactly the same camera, lens, framing, seamless pure black background and lighting as the reference photograph, and the same position and size in the frame (right of centre, centre two thirds across, vertically centred). No logo, no text, no printing, no gold stamp, no branding of any kind. Photorealistic studio product photograph, true-to-life materials, high detail.';
const KEYFRAMES = {
  k1: {
    prompt: 'Photorealistic studio product photograph, 16:9. A brand-new hand-stitched match football (soccer ball) of the classic 32-panel construction: 20 matte white hexagonal panels and 12 deep black pentagonal panels, fine lock-stitched seams with slightly recessed stitch lines, a subtle pebble-grain leather texture, and two of the white hexagons carry thin lime-green (#C5F900) accent lines. No logo, no text, no printing, no branding of any kind. The ball floats in mid-air with no support, right of centre: its centre two thirds of the way across the frame and vertically centred, its diameter a little under half the frame height, the left half of the frame empty. Seamless pure black background (#000000) with no floor, no horizon and no gradient banding. Low-key lighting: a large soft key light from the upper left, a thin cool rim light from behind on the right tracing the edge of the ball, deep natural shadow on its lower right side. Medium-format camera, 100 mm lens, f/8, the whole ball sharp.',
  },
  k0: {
    from: 'k1',
    prompt: `A technical exploded view of this same football, like the opening shot of a premium product launch film. There is NO complete football in this image. At the exact spot where the ball sat there is now only its core: a smooth, matte charcoal-grey butyl rubber bladder, a slightly smaller sphere, with a small black valve. Around it, pulled outward evenly along radial lines, float the layers built on top of it: first a shell of cream laminated cotton-polyester lining pieces, each a gently curved hexagon or pentagon of fabric, hovering a short distance off the bladder; further out, the outer stitched panels of the ball — matte white hexagons, black pentagons and two white hexagons with thin lime-green accent lines — each curved like a real ball panel, with stitch holes along its edges. The outermost panels reach beyond the edges of the frame and are cropped by them. Precise, clean, evenly spaced, nothing touching. ${SAME}`,
  },
  k0b: {
    from: 'k1',
    prompt: `The moment just before this football is finished, as in a premium product launch film. The ball's core — a matte charcoal-grey rubber bladder wrapped in cream laminated lining — sits at the exact spot where the ball sat, slightly smaller than the finished ball. Its outer stitched panels — matte white hexagons, black pentagons and two white hexagons with thin lime-green accent lines — have closed in around it and hover a few centimetres off the surface with even gaps between them, each panel in its final place and orientation, about to lock together. The cream lining shows through the gaps. ${SAME}`,
  },
  k2: {
    from: 'k1',
    prompt: `Replace the football with a hand-stitched rugby ball in the same spot: an elongated oval ball made of four panels of white pebble-grip rubber with black stitched seams running along its length and one thin lime-green (#C5F900) accent band around its middle, its long axis horizontal and tilted slightly up to the right, its length about one and a half times the football's diameter and its width about the football's diameter. The same low-key light, rim light and shadow. ${SAME}`,
  },
  k3: {
    from: 'k1',
    prompt: `Replace the football with a professional indoor match handball, centred on the same spot and noticeably smaller than the football (about 80% of its diameter). Its casing is soft, grippy synthetic leather with a deep pebbled grip texture and a faint glossy resin sheen, hand-stitched panels, and bold angular graphic panels in black and lime green (#C5F900) over white in the style of a modern match handball, clearly different from the football: no hexagon-and-pentagon pattern. The same low-key light, rim light and shadow. ${SAME}`,
  },
};

async function keyframe(id) {
  const k = KEYFRAMES[id];
  const t = (tasks[id] ||= {});
  const input = { prompt: k.prompt, aspect_ratio: '16:9', resolution: '2K', output_format: 'png' };
  if (k.from) {
    if (!tasks[k.from]?.url) throw new Error(`${id}: make ${k.from} first`);
    input.image_input = [tasks[k.from].url];
    input.prompt = `Edit the reference photograph. ${k.prompt}`;
  }
  t.model = 'nano-banana-pro'; t.prompt = input.prompt; t.taskId = await create(t.model, input); t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, id, 10 * 60_000);
  if (!urls[0]) throw new Error(`${id}: no image in the result`);
  await download(urls[0], path.join(OUT, `${id}.png`));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done ${id} (${credits ?? '?'} credits)`);
}

/* ---------- the motion ---------- */
const LOOK = 'Locked-off camera, no cuts, no camera shake. Seamless pure black background throughout. Photorealistic leather, stitching and light; the same soft key light from the upper left and cool rim light on the right. No text, no logos, no people, no hands.';
const CLIPS = [
  { id: 'c1', from: 'k0', to: 'k1', prompt: `An exploded view assembles itself with precise, weighty, perfectly smooth motion: the cream lining layers settle onto the rubber bladder, then the stitched outer panels glide in from beyond the frame along straight radial lines, decelerate and lock together edge to edge into one complete football, which turns slowly as the last panel seats. ${LOOK}` },
  { id: 'c2', from: 'k1', to: 'k2', prompt: `The football keeps spinning slowly while it smoothly stretches along one axis and its panels flow and re-stitch into the white rugby ball with a lime-green band. One continuous, fluid transformation, no cut, no flash. ${LOOK}` },
  { id: 'c3', from: 'k2', to: 'k3', prompt: `The rugby ball keeps turning slowly while it smoothly rounds off into a sphere and its panels flow and re-stitch into the grippy white, black and lime-green panels of a handball. One continuous, fluid transformation, no cut, no flash. ${LOOK}` },
];

async function clip(model, c) {
  const id = `${model}-${c.id}`;
  const t = (tasks[id] ||= {});
  const first = tasks[c.from]?.url, last = tasks[c.to]?.url;
  if (!first || !last) throw new Error(`${id}: make the keyframes first`);
  if (model === 'seedance') {
    t.model = 'bytedance/seedance-2';
    t.taskId = await create(t.model, { prompt: c.prompt, first_frame_url: first, last_frame_url: last, resolution: '1080p', aspect_ratio: '16:9', duration: Number(arg('--seconds') || 5), generate_audio: false });
  } else {
    t.model = 'veo-3-1';
    t.taskId = await create(t.model, { prompt: c.prompt, model: arg('--tier') || 'veo3', generation_type: 'FIRST_AND_LAST_FRAMES_2_VIDEO', image_urls: [first, last], aspect_ratio: '16:9', resolution: '1080p', duration: 8, enable_translation: false });
  }
  t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, id);
  if (!urls[0]) throw new Error(`${id}: no video in the result`);
  await download(urls[0], path.join(OUT, `${id}.mp4`));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done ${id} (${credits ?? '?'} credits)`);
}

async function kling() {
  const t = (tasks['kling-take'] ||= {});
  for (const k of ['k0', 'k0b', 'k1', 'k2', 'k3']) if (!tasks[k]?.url) throw new Error(`make ${k} first`);
  t.model = 'kling-4.0/keyframe-to-video';
  const prompt = `One continuous locked-off shot in the style of a premium product launch film, every movement precise, weighty and perfectly smooth. @first_frame: an exploded view of a football — the charcoal rubber bladder at the centre, the cream lining layers and the stitched outer panels pulled apart along radial lines, the outer panels beyond the frame. The parts glide inward along straight lines and decelerate: the lining settles onto the bladder and the panels close in around it, @keyframe_1. The panels lock together edge to edge, seam by seam, into @keyframe_2, a complete football that turns slowly. The turning football then smoothly stretches and its panels flow and re-stitch into @keyframe_3, a white rugby ball with a lime-green band. The rugby ball keeps turning, smoothly rounds off and its panels flow into @last_frame, a professional handball with white, black and lime-green panels. No cuts, no flashes, no morphing artefacts. ${LOOK}`;
  t.taskId = await create(t.model, { prompt, first_frame_url: tasks.k0.url, keyframe_urls: [tasks.k0b.url, tasks.k1.url, tasks.k2.url], last_frame_url: tasks.k3.url, duration: Number(arg('--seconds') || 12), resolution: '1080p' });
  t.prompt = prompt; t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, 'kling-take');
  if (!urls[0]) throw new Error('kling-take: no video in the result');
  await download(urls[0], path.join(OUT, 'kling-take.mp4'));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done kling-take (${credits ?? '?'} credits)`);
}

async function main() {
  const cmd = args[0];
  if (cmd === 'keyframes') {
    const only = arg('--only')?.split(',');
    if (!only || only.includes('k1')) await keyframe('k1');
    const rest = ['k0', 'k0b', 'k2', 'k3'].filter((k) => !only || only.includes(k));
    const res = await Promise.allSettled(rest.map(keyframe));
    res.forEach((r, i) => r.status === 'rejected' && (console.error(`FAIL ${rest[i]}: ${r.reason.message}`), (process.exitCode = 1)));
  } else if (cmd === 'video') {
    const model = arg('--model');
    if (model === 'kling') await kling();
    else if (model === 'seedance' || model === 'veo') {
      const only = arg('--only')?.split(',');
      const res = await Promise.allSettled(CLIPS.filter((c) => !only || only.includes(c.id)).map((c) => clip(model, c)));
      res.forEach((r) => r.status === 'rejected' && (console.error(`FAIL ${r.reason.message}`), (process.exitCode = 1)));
    } else throw new Error('--model kling|seedance|veo');
  } else throw new Error('keyframes | video --model kling|seedance|veo');
  const spent = Object.values(tasks).reduce((s, t) => s + (Number(t.credits) || 0), 0);
  console.log(`credits recorded for the hero sequence: ${spent}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
