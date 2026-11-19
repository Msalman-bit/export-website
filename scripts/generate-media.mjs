#!/usr/bin/env node
/* Generates the concept imagery in media/manifest.json with Kie AI and downloads it to media/raw.
     node scripts/generate-media.mjs                 every still not yet downloaded
     node scripts/generate-media.mjs --only a,b      just these ids (regenerates them)
     node scripts/generate-media.mjs --video         the hero film (first frame: the hero still)
     node scripts/generate-media.mjs --only a --nano --ref b   with Nano Banana Pro, matching the studio of still b
                                                     (it keeps balls free of invented logos where Flux-2 does not)
   The key is read from KIE_API_KEY (environment or .env.local) and never printed.
   Progress and credits used are kept in media/tasks.json, so a rerun resumes. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media');
const RAW = path.join(MEDIA, 'raw');
const TASKS = path.join(MEDIA, 'tasks.json');
const API = 'https://api.kie.ai/api/v1/jobs';

function readKey() {
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY.trim();
  const env = path.join(ROOT, '.env.local');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^KIE_API_KEY=(.*)$/m);
    if (m && m[1].trim()) return m[1].trim();
  }
  console.error('KIE_API_KEY is not set (environment or .env.local).');
  process.exit(1);
}

const KEY = readKey();
const manifest = JSON.parse(fs.readFileSync(path.join(MEDIA, 'manifest.json'), 'utf8'));
const tasks = fs.existsSync(TASKS) ? JSON.parse(fs.readFileSync(TASKS, 'utf8')) : {};
const save = () => fs.writeFileSync(TASKS, JSON.stringify(tasks, null, 1) + '\n');
fs.mkdirSync(RAW, { recursive: true });

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const wantVideo = args.includes('--video');
const nano = args.includes('--nano');
const refId = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, url, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
      const json = await r.json();
      if (json.code === 429) { await sleep(4000 * (attempt + 1)); continue; }
      return json;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(3000);
    }
  }
  throw new Error('rate limited');
}

async function create(model, input) {
  const res = await api('POST', `${API}/createTask`, { model, input });
  if (res.code !== 200 || !res.data?.taskId) throw new Error(`createTask ${res.code}: ${res.msg}`);
  return res.data.taskId;
}

async function wait(taskId, label, maxMs = 15 * 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(6000);
    const res = await api('GET', `${API}/recordInfo?taskId=${encodeURIComponent(taskId)}`);
    const d = res.data || {};
    if (d.state === 'success') {
      const result = typeof d.resultJson === 'string' ? JSON.parse(d.resultJson) : d.resultJson || {};
      const urls = result.resultUrls || result.result_urls || result.data?.result_urls || [];
      return { urls, credits: d.creditsConsumed ?? null };
    }
    if (d.state === 'fail') throw new Error(`${label} failed: ${d.failMsg || d.failCode || 'unknown'}`);
  }
  throw new Error(`${label}: timed out`);
}

async function download(url, file) {
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`download ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

function rawFile(id) {
  return fs.readdirSync(RAW).find((f) => f.startsWith(id + '.'));
}

async function still(item) {
  const t = (tasks[item.id] ||= {});
  if (!only && rawFile(item.id)) return;
  let prompt = `${manifest.style} Subject: ${item.prompt}`;
  if (nano) {
    const ref = refId && tasks[refId]?.url;
    if (ref) prompt += ' Match the studio, backdrop, floor, light and colour of the reference photograph exactly; the product itself is new.';
    t.model = 'nano-banana-pro';
    t.taskId = await create(t.model, { prompt, image_input: ref ? [ref] : [], aspect_ratio: item.aspect, resolution: item.resolution || '2K', output_format: 'jpg' });
  } else {
    t.model = 'flux-2/pro-text-to-image';
    t.taskId = await create(t.model, { prompt, aspect_ratio: item.aspect, resolution: item.resolution || '2K', nsfw_checker: false });
  }
  t.prompt = item.prompt; t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, item.id);
  if (!urls[0]) throw new Error(`${item.id}: no image in the result`);
  const ext = (urls[0].split('?')[0].split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg');
  const old = rawFile(item.id); if (old) fs.rmSync(path.join(RAW, old));
  await download(urls[0], path.join(RAW, `${item.id}.${ext}`));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done ${item.id} (${credits ?? '?'} credits)`);
}

async function video() {
  const f = manifest.film;
  const first = tasks[f.first_frame]?.url;
  if (!first) throw new Error(`generate ${f.first_frame} first: the film starts on it`);
  const t = (tasks[f.id] ||= {});
  t.model = 'veo-3-1';
  t.taskId = await create(t.model, {
    prompt: f.prompt, model: 'veo3_fast', generation_type: 'FIRST_AND_LAST_FRAMES_2_VIDEO', image_urls: [first],
    aspect_ratio: f.aspect_ratio, resolution: '1080p', duration: f.duration, enable_translation: false,
  });
  t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, f.id, 25 * 60_000);
  if (!urls[0]) throw new Error('film: no video in the result');
  await download(urls[0], path.join(RAW, `${f.id}.mp4`));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done ${f.id} (${credits ?? '?'} credits)`);
}

async function main() {
  if (wantVideo) return video();
  const queue = manifest.items.filter((i) => !only || only.has(i.id));
  const failed = [];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try { await still(item); } catch (e) { failed.push(`${item.id}: ${e.message}`); console.error(`FAIL ${item.id}: ${e.message}`); }
    }
  });
  await Promise.all(workers);
  const spent = Object.values(tasks).reduce((s, t) => s + (Number(t.credits) || 0), 0);
  console.log(`credits recorded so far: ${spent}`);
  if (failed.length) { console.log('failed:\n' + failed.join('\n')); process.exitCode = 1; }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
