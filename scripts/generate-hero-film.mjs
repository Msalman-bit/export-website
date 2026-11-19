#!/usr/bin/env node
/* The new homepage hero film ("an idea becomes a hand-stitched ball"), made with Kie AI part by part and downloaded
   to media/raw/hero-film. The current hero (scripts/generate-hero-sequence.mjs) is not touched.
     node scripts/generate-hero-film.mjs frames                 the stitching scene: s1 (finished) first, then s0 (start) and s0b (laced) from it
     node scripts/generate-hero-film.mjs frames --only s0       just this keyframe again
     node scripts/generate-hero-film.mjs clip                   both stitching clips, s0 to s0b and s0b to s1 (Veo 3.1 Quality, 8 s, 1080p)
     node scripts/generate-hero-film.mjs clip --tier veo3_fast  the same with Veo 3.1 Fast (cheaper, for a draft)
   Keyframes: GPT Image 2.5 Sunburst (image to image, 2K), edited from the current hero's football (k1), so the new
   film keeps its framing, black ground and light. The key is read from KIE_API_KEY (environment or .env.local) and
   never printed; task ids, result links and credits are kept in media/hero-film-tasks.json. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'media', 'raw', 'hero-film');
const TASKS = path.join(ROOT, 'media', 'hero-film-tasks.json');
const OLD_TASKS = path.join(ROOT, 'media', 'hero-seq-tasks.json');
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
      const urls = r.resultUrls || r.result_urls || r.data?.result_urls || r.data?.resultUrls || [];
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
/** A keyframe's hosted link: one made here, or the current hero's football (k1) as the starting reference. */
function linkOf(id) {
  if (tasks[id]?.url) return tasks[id].url;
  const old = fs.existsSync(OLD_TASKS) ? JSON.parse(fs.readFileSync(OLD_TASKS, 'utf8')) : {};
  if (old[id]?.url) return old[id].url;
  throw new Error(`make ${id} first`);
}

/* ---------- the stitching scene's keyframes ---------- */
const SAME = 'Keep exactly the same camera, lens, framing, seamless pure black background (#000000) and lighting as the reference photograph: a large soft key light from the upper left, a thin cool rim light from behind on the right, deep natural shadow on the lower right. Keep the same position and size in the frame (right of centre, its centre two thirds of the way across, vertically centred; the left half of the frame empty and black). No logo, no text, no printing, no graphics, no branding of any kind. A photorealistic studio product photograph, true-to-life materials, high detail, the whole subject in sharp focus.';
const FRAMES = {
  s1: {
    from: 'k1',
    prompt: `Edit the reference photograph. Replace the football with a brand-new, hand-stitched match football of the classic 32-panel construction (20 hexagons and 12 pentagons) in plain matte white: every panel is the same clean white synthetic leather with a fine pebble grain; no black panels, no coloured accents, no print. Its seams are hand-stitched with natural white waxed polyester thread: tight, even lock stitches sunk into slightly recessed seam lines, each individual stitch just visible, the panels gently domed between the seams like a real hand-stitched ball. ${SAME}`,
  },
  // the start: panels further out, each lifted straight off its own place on the finished ball; only a few threads
  s0: {
    from: 's1',
    prompt: `Edit the reference photograph. The same football taken apart, as in a premium product launch film: there is NO finished ball in this image. Every one of its 32 white panels keeps exactly its place in the pattern, its shape and its orientation as in the reference, but is lifted straight outward along its own radius, about a tenth of the ball's diameter off the core, with even dark gaps between all neighbouring panels. Through the gaps you see the core at the exact spot where the ball sat: a smooth, matte charcoal-grey rubber bladder wrapped in a cream laminated lining. Every panel edge is lined with a neat row of small round stitch holes. Only a few seams have begun: along five or six seams spread around the ball, natural white waxed thread is already stitched through the first few holes in a neat zig-zag across the gap, its loose end trailing a short way into the gap. Every other hole is still empty. No needles, no hands, no tools, nothing else in the frame. ${SAME}`,
  },
  // the middle: panels close to the core, every hole laced, the thread still slack
  s0b: {
    from: 's1',
    prompt: `Edit the reference photograph. The same football a moment before its seams are pulled closed, as in a premium product launch film: there is NO finished ball in this image. Every one of its 32 white panels keeps exactly its place in the pattern, its shape and its orientation as in the reference, but is lifted straight outward along its own radius by only a little, leaving narrow, even dark gaps between all neighbouring panels; through the gaps you glimpse the cream lining over the charcoal rubber bladder at the exact spot where the ball sat. Along every seam, every single stitch hole is laced: natural white waxed thread runs through each hole in a neat, regular zig-zag across the gap, like a loosened shoelace, the thread still slightly slack. The lacing is tidy and even on every seam, never tangled. No needles, no hands, no tools, nothing else in the frame. ${SAME}`,
  },
  // the end of the film: the finished ball with the client's graphic printed on (made first, so the sketch can show it)
  p1: {
    from: 's1',
    prompt: `Edit the reference photograph. The same finished hand-stitched white football, now with a bold modern graphic printed on it, as in a premium product launch film: a sweep of sharp, angular lime-green (#C5F900) chevrons and triangles that flows diagonally across several panels from the lower left to the upper right, with a few thin deep-black accent lines running alongside it. The graphic is matte screen-printed ink sitting in the leather's pebble grain, following the curve of every panel, crisp-edged, and broken naturally by the recessed stitched seams, which stay exactly as they are. Most of the ball stays clean white. Keep the ball itself, its panels, stitching, position, size, framing, black background and lighting exactly as in the reference. No logo, no letters, no numbers, no words, no branding of any kind. A photorealistic studio product photograph, high detail, the whole ball in sharp focus.`,
  },
  // the opening: the designer's finished pencil drawing of that ball, white pencil on black paper, where the ball will be
  d1: {
    from: 'p1',
    prompt: `Turn the reference photograph into a designer's hand-drawn technical sketch of this exact football, drawn in white pencil on matte black drawing paper. The drawing sits at exactly the same position and size in the frame as the ball in the reference (right of centre, its centre two thirds of the way across, vertically centred), and it shows exactly the same panels and graphic: the outline of the ball, every hexagon and pentagon seam in clean white pencil lines with a fine dotted stitch line beside each seam, and the chevron graphic drawn as crisp outlines filled with light lime-green (#C5F900) coloured-pencil hatching. Around the ball a few faint construction lines: a light guide circle, a centre cross and two compass arcs. Light pencil shading on the lower right gives the sphere its volume. The paper fills the whole frame, almost pure black with a very subtle paper grain; the left half of the frame stays empty paper. No hand, no pencil, no tools, no text, no letters, no numbers, no measurements, no logo.`,
  },
  // the first try of the opening, kept for reference: the drawing begun by a designer's hand (d0-hand)
  'd0-hand': {
    from: 'd1',
    prompt: `Edit the reference image. The same black drawing paper, the same framing and the same white pencil drawing, but only just begun: only the faint guide circle, the centre cross, the outer outline of the ball and three or four panel seams on its upper left are drawn; everything else on the page is still empty black paper. A designer's hand enters the frame from the lower right, holding a white pencil, the pencil tip resting on the paper at the end of the newest seam line. A real, relaxed, well-groomed adult hand with natural skin, five fingers, a clean shirt cuff at the wrist, lit softly from the upper left. The hand stays in the right third of the frame and the left half of the frame stays empty black paper. No text, no letters, no numbers, no logo, no other objects.`,
  },
  // the first frame of the film: the drawing only just begun, a white pencil drawing on its own, with no hand
  d0: {
    from: 'd0-hand',
    prompt: `Edit the reference image. Remove the hand, the fingers, the wrist and the shirt cuff completely: there is no hand and no person anywhere in the image. Keep the white pencil exactly where it is, at the same angle, its tip resting on the paper at the end of the newest seam line, now floating on its own as if guided by an invisible hand, casting a faint soft shadow on the paper. Keep the black paper, the framing and the half-finished white pencil drawing exactly as they are, and fill where the hand was with the same empty black paper. No text, no letters, no numbers, no logo, no other objects.`,
  },
  // the drawing has become the real core: only the bare rubber bladder, where the drawn ball was
  b0: {
    from: 's1',
    prompt: `Edit the reference photograph. Replace the football with only its inner core: a bare, smooth, matte charcoal-grey butyl rubber bladder, a perfect sphere slightly smaller than the football (about nine tenths of its diameter), centred on exactly the same spot, with a small black rubber valve on its upper left and a soft sheen from the key light. There are no panels, no lining, no thread and nothing else in the frame. ${SAME}`,
  },
  // the end of the film: the same lime graphic on a handball, then on a rugby ball, in the same spot and light
  h1: {
    from: 'p1',
    prompt: `Edit the reference photograph. Replace the football with a professional hand-stitched match handball centred on exactly the same spot, a little smaller than the football (about four fifths of its diameter). Its casing is soft, grippy white synthetic leather with a deep pebbled grip texture and a faint resin sheen, its panels laid out like a modern match handball (not hexagons and pentagons), joined by fine hand-stitched seams. It carries the same bold lime-green (#C5F900) chevron graphic with thin deep-black accent lines, sweeping diagonally from the lower left to the upper right and following the curve of the ball. Keep the framing, the seamless pure black background and the lighting exactly as in the reference. No logo, no letters, no numbers, no words, no branding of any kind. A photorealistic studio product photograph, high detail, the whole ball in sharp focus.`,
  },
  r1: {
    from: 'p1',
    prompt: `Edit the reference photograph. Replace the football with a hand-stitched rugby ball centred on exactly the same spot: an elongated oval of four panels of white pebble-grip rubber joined by stitched seams running along its length, its long axis horizontal and tilted slightly up to the right, its length about one and a half times the football's diameter and its width about the football's diameter. It carries the same bold lime-green (#C5F900) chevron graphic with thin deep-black accent lines, sweeping along the ball and following its curve. Keep the framing, the seamless pure black background and the lighting exactly as in the reference. No logo, no letters, no numbers, no words, no branding of any kind. A photorealistic studio product photograph, high detail, the whole ball in sharp focus.`,
  },
};

async function frame(id) {
  const f = FRAMES[id];
  const t = (tasks[id] ||= {});
  t.model = 'gpt-image-2-5-sunburst-image-to-image';
  t.prompt = f.prompt;
  t.taskId = await create(t.model, { prompt: f.prompt, input_urls: [linkOf(f.from)], aspect_ratio: '16:9', resolution: '2K' });
  t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, id, 15 * 60_000);
  if (!urls[0]) throw new Error(`${id}: no image in the result`);
  await download(urls[0], path.join(OUT, `${id}.png`));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done ${id} (${credits ?? '?'} credits)`);
}

/* ---------- the stitching clips: s0 to s0b (the thread runs on through every hole), s0b to s1 (it pulls tight) ---------- */
const LOOK = 'Precise, weighty, perfectly smooth motion; every panel stays rigid and keeps its exact shape and place in the pattern; no morphing, no melting, no flicker, nothing popping in or out. The ball barely rotates. Locked-off camera, no cuts, no zoom, no camera shake. Seamless pure black background throughout, the same soft key light from the upper left and cool rim light on the right. No text, no logos, no people, no hands, no needles.';
const PAPER = 'Locked-off camera, no cuts, no zoom, no camera shake. Matte black drawing paper with a very subtle grain, soft light from the upper left. Clean, confident pencil strokes; the drawing stays exactly in place and only grows. No text, no letters, no numbers, no logo.';
const CLIPS = {
  // in film order: the idea is drawn, the drawing becomes the real panels, they are stitched, the graphic prints on
  draw: { from: 'd0', to: 'd1', prompt: `One continuous locked-off shot from a premium product launch film. A single white pencil draws a football on black paper all by itself, as if guided by an invisible hand: with calm, confident strokes it completes every remaining panel seam with its dotted stitch line, then outlines the chevron graphic and fills it with lime-green coloured-pencil hatching, and adds light shading on the lower right. In the last second the pencil lifts off the paper and drifts smoothly out of the frame to the lower right, leaving the finished drawing. There is no hand and no person at any moment. ${PAPER}` },
  core: { from: 'd1', to: 'b0', prompt: `One continuous locked-off shot from a premium product launch film. The white pencil lines, the construction lines and the lime-green hatching of the drawing fade out gently, line by line, and the faint paper grain fades into a seamless pure black void. At the same time, inside the drawn outline, the sphere fills with smooth matte charcoal-grey rubber and becomes a real rubber bladder with a small black valve, in exactly the same place and size. Nothing passes in front of the camera: no curtain, no wipe, no dark shapes, no vignette, no spotlight, no other objects. There is never a finished football in between: the drawing turns straight into the bare bladder. No light effects of any kind: no lens flare, no light sweep, no glow, no light rays; the background stays seamless pure black and the lighting stays exactly the same throughout. Locked-off camera, no cuts, no zoom, no camera shake. No text, no logos, no people, no hands.` },
  panels: { from: 'b0', to: 's0', prompt: `One continuous locked-off shot from a premium product launch film. Thin cream laminated lining wraps smoothly around the charcoal rubber bladder, then the 32 white pebble-grain leather panels of a hand-stitched football fly in from beyond the edges of the frame along straight radial lines, decelerate and stop in their exact places just off the core, leaving even narrow gaps; the first few seams already carry white waxed thread. ${LOOK}` },
  handball: { from: 'p1', to: 'h1', prompt: `One continuous locked-off shot from a premium product launch film. The printed football gradually becomes a handball in exactly the same place: its smooth leather surface turns into a deep pebbled grip texture, its panels shift subtly into the handball panels, and it shrinks slightly to the size of the handball, keeping the same lime-green chevron graphic in the same place. It stays perfectly round the whole time: never an American football, never an oval, no laces. No spinning, it barely rotates. No light effects of any kind: no lens flare, no light sweep, no glow, no light rays; the background stays seamless pure black and the lighting stays exactly the same throughout. Locked-off camera, no cuts, no zoom, no camera shake. No text, no logos, no people, no hands.` },
  rugby: { from: 'h1', to: 'r1', prompt: `One continuous locked-off shot from a premium product launch film. The handball makes a smooth half turn, and as a soft band of light sweeps across it, it stretches in one fluid movement along one axis into a hand-stitched white rugby ball with seams along its length, lying horizontal and tilted slightly up to the right, carrying the same lime-green chevron graphic. The surfaces stay crisp and detailed throughout: no melting, no smearing, no flicker. The ball stays centred on exactly the same spot. Locked-off camera, no cuts, no zoom, no camera shake. Seamless pure black background, the same key light from the upper left and rim light on the right. No text, no logos, no people, no hands.` },
  print: { from: 's1', to: 'p1', prompt: `One continuous locked-off shot from a premium product launch film. The lime-green chevron graphic with thin black accent lines prints onto the finished white football: it appears progressively from the lower left to the upper right, as if ink soaks into the leather grain, crisp-edged, following the curve of the panels and broken naturally by the stitched seams. The ball stays a perfectly round football the whole time, its panels and stitching unchanged: no laces, never an American football, never any other ball. No light effects of any kind: no lens flare, no light sweep, no glow, no light rays; the background stays seamless pure black and the lighting stays exactly the same throughout. ${LOOK}` },
  thread: { from: 's0', to: 's0b', prompt: `One continuous locked-off shot from a premium product launch film. The lifted white panels of a hand-stitched football draw slowly and evenly inward towards the core, each along its own radius. As they move in, the natural white waxed thread on the few seams already begun keeps running on through the next stitch holes, hole after hole, in a neat zig-zag across each gap, and from the ends of those seams it carries on into the neighbouring seams, until every single hole on every seam is laced and the thread is still slightly slack. The thread only ever grows out of thread that is already there, like a seam being sewn, never appearing from nowhere. ${LOOK}` },
  tighten: { from: 's0b', to: 's1', prompt: `One continuous locked-off shot from a premium product launch film. All the white waxed thread laced through the stitch holes of the football pulls tight where it is: every stitch tightens in place, the narrow gaps between the panels close slowly and evenly, and the lacing sinks into tight, even lock stitches in slightly recessed seam lines, until it is one finished, plain white hand-stitched football. The thread never leaves the ball: no strands stretch away from it, nothing reaches towards the edges of the frame, no loose ends. The thread stays white the whole time, never dark. Gradual and even, with no sudden change at the end. No light effects of any kind: no lens flare, no light sweep, no glow, no light rays; the background stays seamless pure black and the lighting stays exactly the same throughout. ${LOOK}` },
};

async function clip(name) {
  const c = CLIPS[name];
  const tier = arg('--tier') || 'veo3';
  const id = `${name}-${tier}`;
  const t = (tasks[id] ||= {});
  t.model = 'veo-3-1';
  t.prompt = c.prompt;
  t.taskId = await create(t.model, { prompt: c.prompt, model: tier, generation_type: 'FIRST_AND_LAST_FRAMES_2_VIDEO', image_urls: [linkOf(c.from), linkOf(c.to)], aspect_ratio: '16:9', resolution: '1080p', duration: Number(arg('--seconds') || 8), enable_translation: false });
  t.created = new Date().toISOString(); save();
  const { urls, credits } = await wait(t.taskId, id);
  if (!urls[0]) throw new Error(`${id}: no video in the result`);
  await download(urls[0], path.join(OUT, `${id}.mp4`));
  t.url = urls[0]; t.credits = credits; t.done = new Date().toISOString(); save();
  console.log(`done ${id} (${credits ?? '?'} credits)`);
}

async function main() {
  const cmd = args[0];
  if (cmd === 'frames') {
    const only = arg('--only')?.split(',');
    if (only) { for (const id of only) await frame(id); } // in the order given: list a frame after the one it is edited from
    else {
      await frame('s1'); // the stitched ball first: s0, s0b and p1 are edited from it
      const res = await Promise.allSettled(['s0', 's0b', 'p1'].map(frame));
      res.forEach((r) => r.status === 'rejected' && (console.error(`FAIL ${r.reason.message}`), (process.exitCode = 1)));
      await frame('d1'); await frame('d0'); // the sketch from the printed ball, then the hand starting it
    }
  } else if (cmd === 'clip') {
    const names = (arg('--only')?.split(',') ?? Object.keys(CLIPS)).filter((n) => CLIPS[n]);
    const res = await Promise.allSettled(names.map(clip));
    res.forEach((r, i) => r.status === 'rejected' && (console.error(`FAIL ${names[i]}: ${r.reason.message}`), (process.exitCode = 1)));
  } else throw new Error('frames [--only s1,s0,s0b] | clip [--only thread,tighten] [--tier veo3|veo3_fast]');
  const spent = Object.values(tasks).reduce((s, t) => s + (Number(t.credits) || 0), 0);
  console.log(`credits recorded for the new hero film: ${spent}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
