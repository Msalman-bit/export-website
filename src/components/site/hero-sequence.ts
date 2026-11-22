/* The hero's scroll film: a frame sequence drawn to a canvas, scrubbed by the scroll through the hero
   (the way product launch pages play a film on scroll). The frames come from the generated film
   (scripts/generate-hero-film.mjs, scripts/build-hero-bridges.py, scripts/build-hero-frames.mjs): a pencil draws
   the ball, the drawing becomes its rubber bladder, the panels fly in and are stitched, the client's graphic prints
   on, and the football turns into a handball and then a rugby ball. seq.json's stages split it into the chapters
   the hero's words follow (onStage), with its pacing in timeline.

   Self-play: before anyone scrolls, the pencil sketch draws itself once (SELF_PLAY) and rests on the finished sketch.
   The first scroll takes over at any moment, from exactly where the film is: what is left of the film is spread over
   the whole scroll (base), so it never jumps or rewinds, and scrolling back to the top returns to that same picture.
   It lasts under five seconds, so it needs no pause button (WCAG 2.2.2). A page opened part-way down, a visitor saving
   data, or frames that take too long to arrive: it does not play, and the film is the scroll's alone.

   Loading: the first frame first, then every second frame of the sketch (it plays first, and starts with those), then
   every 16th of the film, the sketch's others and the rest coarse to fine. A visitor who scrolls early turns what is
   left into plain coarse to fine, so the scrub works at once and sharpens as frames arrive. Drawing: the nearest loaded frames, cross-faded,
   only when the position changes; paused off screen and in background tabs. */

type SetInfo = { width: number; height: number; count: number };
type Seq = { ball: { x: number; y: number; d: number }; bg?: string; stages?: number[]; timeline?: number[][]; ext?: string; sets: Record<string, SetInfo> };

// a folder per film: the assets are cached for a week, so a new film never shares a path with the last one's files
const BASE = '/assets/img/hero-film';
/* Self-play: how far into the film it runs (film time, 0 to 1: the finished sketch, frame 66 of 404), how long it
   takes, how long after the first frame it waits (the film fades in first), and how long its frames may take to arrive
   before it does not play at all. A new film: set `until` to its resting picture. */
const SELF_PLAY = { until: 65 / 403, seconds: 4, wait: 800, giveUp: 12000 };
const STAGE_MARGIN = 0.008; // of the whole scroll: about 30px on a 900px-tall window, enough to stop a boundary flickering
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* Self-play's speed over its run, 0 to 1: up to speed in the first eighth, steady, then slowing over the last third. */
export function selfPlayEase(u: number) {
  const x = clamp01(u), a = 0.125, d = 0.33, area = 1 - a / 2 - d / 2;
  if (x < a) return (x * x) / (2 * a) / area;
  if (x < 1 - d) return (x - a / 2) / area;
  return 1 - ((1 - x) * (1 - x)) / (2 * d) / area;
}

/* Where the film is for a scroll position (0 to 1), once self-play has left it at `base`. */
export const followScroll = (base: number, scroll: number) => base + (1 - base) * clamp01(scroll);

/* The scroll position whose film time is t: the inverse of seq.json's timeline (piecewise linear). */
export function progressAt(t: number, timeline?: number[][]) {
  if (!timeline || timeline.length < 2) return clamp01(t);
  for (let i = 1; i < timeline.length; i++) {
    const [p0, t0] = timeline[i - 1], [p1, t1] = timeline[i];
    if (t1 > t0 && t <= t1) return p0 + ((t - t0) / (t1 - t0)) * (p1 - p0);
  }
  return 1;
}

/* The same choice as the page head's preload, so the first frame is already on its way. */
export function pickSet(): 'lg' | 'md' | 'sm' {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (c?.saveData) return 'sm';
  if (window.innerWidth >= 1024) return 'lg';
  return (window.devicePixelRatio || 1) >= 1.5 ? 'md' : 'sm';
}

export function mountHeroSequence(o: {
  host: HTMLElement;
  section: HTMLElement;
  onStage: (i: number) => void;
  /** where the film is, 0 to 1, eased like the film itself (for a progress line) */
  onProgress?: (p: number) => void;
  onReady: () => void;
  onFail: () => void;
}) {
  const { host, section, onStage, onProgress, onReady, onFail } = o;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { onFail(); return () => {}; }
  host.appendChild(canvas);

  let disposed = false;
  let seq: Seq | null = null;
  let set: SetInfo | null = null;
  let setId = 'lg';
  let ext = 'webp';
  let frames: (HTMLImageElement | null)[] = [];
  let bg = '#000';
  let W = 0, H = 0, dpr = 1;
  let box = { dx: 0, dy: 0, sw: 0, sh: 0 };
  let wide = true;
  let target = 0, prog = 0, lastProg = -1, drawn = -1, stageIdx = -1, visible = true, raf = 0, last = performance.now(), ready = false;
  // self-play: 'wait' for the frames, 'play', then 'done' for good; base is where it left the film
  let auto: 'wait' | 'play' | 'done' = 'wait', autoT = 0, autoFrom = 0, autoTo = 0, base = 0, readyAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: number[] = [];

  // AVIF frames: a browser that cannot decode them fails on the first frame, and the hero stays the still photograph
  const src = (i: number) => `${BASE}/${setId}/${String(i + 1).padStart(4, '0')}.${ext}`;

  /* Where the film sits: on a wide frame the ball sits in the middle of the free right side (the words
     stand on the left); on a tall frame it sits above the words. Wherever an edge of the film falls
     inside the frame it fades into the black ground, so the film never shows a border. */
  function layout() {
    if (!seq || !set) return;
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const aspect = set.width / set.height, b = seq.ball;
    let sh: number, X: number, Y: number;
    wide = W / H >= 1.1;
    if (wide) {
      // the free side of the frame: the words take the left half, the ball sits in the middle of the rest
      const D = Math.min(H * 0.68, W * 0.37);
      sh = D / b.d;
      // on a wide, short frame the ball moves further right, so it keeps clear of the words
      X = Math.max(W * 0.74, W - D * 0.5 - W * 0.05); Y = H * 0.5;
    } else {
      // a little smaller and higher than the football alone needs: the rugby ball at the end is wider and sits lower
      const D = Math.min(W * 0.74, H * 0.4);
      sh = D / b.d;
      X = W * 0.5; Y = H * 0.28;
    }
    const sw = sh * aspect;
    let dx = X - b.x * sw, dy = Y - b.y * sh;
    if (sw >= W) dx = Math.min(0, Math.max(W - sw, dx));
    if (sh >= H) dy = Math.min(0, Math.max(H - sh, dy));
    box = { dx, dy, sw, sh };
    drawn = -1;
  }

  function nearestLoaded(i: number, dir: 1 | -1) {
    for (let k = i; k >= 0 && k < frames.length; k += dir) if (frames[k]) return k;
    return -1;
  }

  /* scroll progress to film time: the pacing in seq.json (piecewise linear), else straight through */
  function filmTime(p: number) {
    const tl = seq?.timeline;
    if (!tl || tl.length < 2) return clamp01(p);
    for (let i = 1; i < tl.length; i++) {
      const [p0, t0] = tl[i - 1], [p1, t1] = tl[i];
      if (p <= p1) return p1 > p0 ? t0 + ((p - p0) / (p1 - p0)) * (t1 - t0) : t1;
    }
    return tl[tl.length - 1][1];
  }

  function draw(pos: number) {
    if (!set) return false;
    const n = set.count;
    const f = clamp01(filmTime(clamp01(pos))) * (n - 1);
    let a = nearestLoaded(Math.floor(f), -1);
    let b = nearestLoaded(Math.ceil(f), 1);
    if (a < 0) a = b; if (b < 0) b = a;
    if (a < 0) return false;
    const mix = a === b ? 0 : (f - a) / (b - a);
    const key = a * 10000 + b + Math.round(mix * 64) / 64;
    if (key === drawn) return true;
    drawn = key;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.globalAlpha = 1;
    ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, H);
    const { dx, dy, sw, sh } = box;
    ctx!.drawImage(frames[a]!, dx, dy, sw, sh);
    if (mix > 0.01) { ctx!.globalAlpha = mix; ctx!.drawImage(frames[b]!, dx, dy, sw, sh); ctx!.globalAlpha = 1; }
    // any film edge inside the frame melts into the ground
    const fl = 0.2 * sh;
    const band = (x: number, y: number, w: number, h: number, x0: number, y0: number, x1: number, y1: number) => {
      const g = ctx!.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgba(bg, 0)); g.addColorStop(0.45, rgba(bg, 0.55)); g.addColorStop(0.8, rgba(bg, 0.94)); g.addColorStop(1, rgba(bg, 1));
      ctx!.fillStyle = g; ctx!.fillRect(x, y, w, h);
    };
    ctx!.fillStyle = bg;
    if (dy > 0) { band(0, dy, W, fl, 0, dy + fl, 0, dy); ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, dy); }
    if (dy + sh < H) { band(0, dy + sh - fl, W, fl, 0, dy + sh - fl, 0, dy + sh); ctx!.fillStyle = bg; ctx!.fillRect(0, dy + sh, W, H - dy - sh); }
    if (dx > 0) { band(dx, 0, fl, H, dx + fl, 0, dx, 0); ctx!.fillStyle = bg; ctx!.fillRect(0, 0, dx, H); }
    if (dx + sw < W) { band(dx + sw - fl, 0, fl, H, dx + sw - fl, 0, dx + sw, 0); ctx!.fillStyle = bg; ctx!.fillRect(dx + sw, 0, W - dx - sw, H); }
    // a soft shade where the words stand (left on a wide frame, below on a tall one): unseen on the black,
    // it dims only the parts that fly behind the type
    const sg = wide ? ctx!.createLinearGradient(0, 0, W * 0.6, 0) : ctx!.createLinearGradient(0, H, 0, H * 0.42);
    sg.addColorStop(0, rgba(bg, 0.88)); sg.addColorStop(0.5, rgba(bg, 0.6)); sg.addColorStop(1, rgba(bg, 0));
    ctx!.fillStyle = sg;
    if (wide) ctx!.fillRect(0, 0, W * 0.6, H); else ctx!.fillRect(0, H * 0.42, W, H * 0.58);
    return true;
  }

  const readScroll = () => {
    const r = section.getBoundingClientRect(), total = section.offsetHeight - window.innerHeight;
    const scroll = total > 0 ? clamp01(-r.top / total) : 0;
    // the visitor's first scroll ends self-play where it stands, or before it began
    if (auto !== 'done' && scroll > 0.0005) { auto = 'done'; queue.sort((a, b) => coarse(a) - coarse(b)); }
    target = followScroll(base, scroll);
    wake();
  };

  /* every second frame of the sketch is in; the ones between arrive while it plays */
  function sketchLoaded() {
    if (!set) return false;
    for (let i = 0; i <= Math.ceil(SELF_PLAY.until * (set.count - 1)); i += 2) if (!frames[i]) return false;
    return true;
  }
  function trySelfPlay() {
    if (auto !== 'wait' || !ready || disposed) return;
    const waited = performance.now() - readyAt;
    if (waited > SELF_PLAY.giveUp) { auto = 'done'; return; }
    if (waited < SELF_PLAY.wait || !sketchLoaded()) return;
    auto = 'play'; autoT = 0;
    wake();
  }

  function tick(now: number) {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (auto === 'play') {
      autoT += dt;
      prog = autoFrom + (autoTo - autoFrom) * selfPlayEase(autoT / SELF_PLAY.seconds);
      base = target = prog;
      if (autoT >= SELF_PLAY.seconds) auto = 'done';
    } else {
      prog += (target - prog) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - prog) < 0.0004) prog = target;
    }
    const ok = draw(prog);
    if (ok && !ready) {
      ready = true; readyAt = performance.now(); canvas.classList.add('is-on'); onReady();
      timer = setTimeout(trySelfPlay, SELF_PLAY.wait + 20);
    }
    // the chapter: one more than the stage points passed, with a small margin each way so a scroll that stops on a
    // boundary never makes the words flicker between two chapters
    const st = seq?.stages ?? [0.62, 0.86];
    let s = stageIdx < 0 ? st.filter((x) => prog >= x).length : stageIdx;
    while (s < st.length && prog >= st[s] + STAGE_MARGIN) s++;
    while (s > 0 && prog < st[s - 1] - STAGE_MARGIN) s--;
    if (s !== stageIdx) { stageIdx = s; onStage(s); }
    if (prog !== lastProg) { lastProg = prog; onProgress?.(prog); }
    if (auto === 'play' || prog !== target || !ok) raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  const ro = new ResizeObserver(() => { layout(); wake(); });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); });
  const onVis = () => { if (!document.hidden) wake(); };

  /* the order frames load in, six at a time: 0; every second one of the sketch, when it may play by itself; every 16th
     of the film; the sketch's others; then the rest, every 8th, 4th, 2nd, 1st */
  function order(n: number) {
    const seen = new Set<number>(), out: number[] = [];
    const add = (step: number, end: number) => { for (let i = 0; i < end; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); } };
    const sketch = auto === 'wait' ? Math.ceil(SELF_PLAY.until * (n - 1)) + 1 : 0;
    add(n, n);
    for (const step of [8, 4, 2]) add(step, sketch);
    add(16, n); add(1, sketch);
    for (const step of [8, 4, 2, 1]) add(step, n);
    if (!seen.has(n - 1)) out.push(n - 1);
    return out;
  }
  const coarse = (i: number) => [16, 8, 4, 2, 1].findIndex((step) => i % step === 0);
  function load(list: number[]) {
    queue = list;
    let active = 0;
    const next = () => {
      if (disposed) return;
      while (active < 6 && queue.length) {
        const i = queue.shift()!;
        active++;
        const img = new Image();
        img.decoding = 'async';
        if (i === 0) (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
        img.src = src(i);
        img.decode().then(() => { if (!disposed) { frames[i] = img; drawn = -1; wake(); trySelfPlay(); } })
          .catch(() => { if (i === 0) fail(); })
          .finally(() => { active--; next(); });
      }
    };
    next();
  }
  function fail() { if (!disposed) { dispose(); onFail(); } }

  fetch(`${BASE}/seq.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: Seq) => {
      if (disposed) return;
      seq = j; setId = pickSet(); set = j.sets[setId] ?? j.sets.lg;
      if (!set) throw new Error('no frames');
      bg = j.bg || '#000';
      ext = j.ext === 'avif' ? 'avif' : 'webp';
      frames = new Array(set.count).fill(null);
      layout();
      ro.observe(host); io.observe(section);
      window.addEventListener('scroll', readScroll, { passive: true });
      document.addEventListener('visibilitychange', onVis);
      // the opening hold in the timeline is the film's first frame standing still, so self-play starts after it
      autoFrom = progressAt(0.0001, j.timeline); autoTo = progressAt(SELF_PLAY.until, j.timeline);
      if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) auto = 'done';
      readScroll(); prog = target;
      load(order(set.count));
    })
    .catch(fail);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    ro.disconnect(); io.disconnect();
    window.removeEventListener('scroll', readScroll);
    document.removeEventListener('visibilitychange', onVis);
    frames = [];
    canvas.remove();
  }
  return dispose;
}

function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
}
