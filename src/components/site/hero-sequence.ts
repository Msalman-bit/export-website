/* The hero's scroll film: a frame sequence drawn to a canvas, scrubbed by the scroll through the hero
   (the way product launch pages play a film on scroll). The frames come from the generated film
   (scripts/generate-hero-film.mjs, scripts/build-hero-bridges.py, scripts/build-hero-frames.mjs): a pencil draws
   the ball, the drawing becomes its rubber bladder, the panels fly in and are stitched, the client's graphic prints
   on, and the football turns into a handball and then a rugby ball. seq.json's stages split it into the chapters
   the hero's words follow (onStage), with its pacing in timeline.

   Loading: the first frame first, then the rest coarse to fine (every 16th, 8th, 4th, ...), so the
   scrub works at once and sharpens as frames arrive. Drawing: the nearest loaded frames, cross-faded,
   only when the position changes; paused off screen and in background tabs. */

type SetInfo = { width: number; height: number; count: number };
type Seq = { ball: { x: number; y: number; d: number }; bg?: string; stages?: number[]; timeline?: number[][]; ext?: string; sets: Record<string, SetInfo> };

// a folder per film: the assets are cached for a week, so a new film never shares a path with the last one's files
const BASE = '/assets/img/hero-film';
const STAGE_MARGIN = 0.008; // of the whole scroll: about 30px on a 900px-tall window, enough to stop a boundary flickering
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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
  /** the scroll through the film, 0 to 1, eased like the film itself (for a progress line) */
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
    target = total > 0 ? clamp01(-r.top / total) : 0;
    wake();
  };

  function tick(now: number) {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    prog += (target - prog) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - prog) < 0.0004) prog = target;
    const ok = draw(prog);
    if (ok && !ready) { ready = true; canvas.classList.add('is-on'); onReady(); }
    // the chapter: one more than the stage points passed, with a small margin each way so a scroll that stops on a
    // boundary never makes the words flicker between two chapters
    const st = seq?.stages ?? [0.62, 0.86];
    let s = stageIdx < 0 ? st.filter((x) => prog >= x).length : stageIdx;
    while (s < st.length && prog >= st[s] + STAGE_MARGIN) s++;
    while (s > 0 && prog < st[s - 1] - STAGE_MARGIN) s--;
    if (s !== stageIdx) { stageIdx = s; onStage(s); }
    if (prog !== lastProg) { lastProg = prog; onProgress?.(prog); }
    if (prog !== target || !ok) raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  const ro = new ResizeObserver(() => { layout(); wake(); });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); });
  const onVis = () => { if (!document.hidden) wake(); };

  /* coarse to fine: 0, then every 16th, 8th, 4th, 2nd, 1st frame, six at a time */
  function order(n: number) {
    const seen = new Set<number>(), out: number[] = [];
    for (const step of [n, 16, 8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); }
    if (!seen.has(n - 1)) out.push(n - 1);
    return out;
  }
  function load(queue: number[]) {
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
        img.decode().then(() => { if (!disposed) { frames[i] = img; drawn = -1; wake(); } })
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
      readScroll(); prog = target;
      load(order(set.count));
    })
    .catch(fail);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
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
