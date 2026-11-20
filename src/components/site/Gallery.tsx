'use client';
import { useEffect, useRef, useState } from 'react';
import { pic } from '@/lib/media';
import type { ProductImage } from '@/lib/db/schema';

/* Product gallery: the main view, thumbnails for every angle, zoom (click or Enter: 2x under the
   pointer; Escape leaves) and, when the product has spin frames, a 360-degree view dragged by
   pointer or stepped with the arrow keys.
   Touch, the way a phone's own photos behave: a tap zooms in where the finger landed, and the zoomed photo
   then follows the finger 1:1 (a mouse keeps looking around under the pointer). A flick of the 360 view keeps
   turning at the finger's speed and slows down like a real spin; touching it again stops it there. */
const STEP = 12;      // px of drag per spin frame
const SLOP = 8;       // px a finger may wander before a tap becomes a drag
const DECAY = 0.995;  // the spin's slow-down per ms after a flick (Apple's projection, a little snappier than scroll)

export function Gallery({ images, spin, name }: { images: ProductImage[]; spin: string[]; name: string }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null); // the photo being replaced, kept under the new one
  const [ready, setReady] = useState(true);              // the current photo has loaded (true at first: no fade on load)
  const [zoom, setZoom] = useState(false);
  const [touchZoom, setTouchZoom] = useState(false);    // zoomed by a finger: the photo pans with it
  const [mode, setMode] = useState<'photo' | 'spin'>('photo');
  const [frame, setFrame] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; f: number; hist: { x: number; t: number }[] } | null>(null);
  const pan = useRef<{ x: number; y: number; zx: number; zy: number; moved: boolean } | null>(null);
  const origin = useRef({ zx: 50, zy: 50 });
  const pointer = useRef('mouse');
  const swallowClick = useRef(false);
  const coast = useRef(0);
  const cur = images[i];
  const p = pic(cur?.url, 1600);
  const pp = prev !== null ? pic(images[prev]?.url, 1600) : null;
  const SIZES = '(max-width: 1023px) 100vw, 740px';

  // drop the old layer once the new photo has faded in
  useEffect(() => {
    if (!ready || prev === null) return;
    const t = setTimeout(() => setPrev(null), 260);
    return () => clearTimeout(t);
  }, [ready, prev]);
  useEffect(() => () => cancelAnimationFrame(coast.current), []);

  const stopCoast = () => { cancelAnimationFrame(coast.current); coast.current = 0; };
  const show = (n: number) => {
    stopCoast(); setMode('photo'); setZoom(false);
    if (n === i) return;
    setPrev(i); setI(n); setReady(false);
  };
  const preload = (n: number) => {
    const q = pic(images[n]?.url, 1600); if (!q) return;
    const im = new Image(); if (q.srcSet) { im.sizes = SIZES; im.srcset = q.srcSet; } im.src = q.src;
  };
  const wrap = (n: number) => ((n % spin.length) + spin.length) % spin.length;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const setOrigin = (zx: number, zy: number) => {
    origin.current = { zx, zy };
    ref.current?.style.setProperty('--zx', `${zx}%`);
    ref.current?.style.setProperty('--zy', `${zy}%`);
  };
  const pointAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { zx: ((e.clientX - r.left) / r.width) * 100, zy: ((e.clientY - r.top) / r.height) * 100 };
  };

  // keep receiving the finger's moves even when it leaves the picture (a pointer the browser no longer tracks is skipped)
  const capture = (e: React.PointerEvent<HTMLDivElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ } };

  /* ---------- the photo: zoom, look around, pan ---------- */
  const photoDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointer.current = e.pointerType; swallowClick.current = false;
    if (e.pointerType === 'mouse' || !ref.current) return;
    if (!zoom) { const o = pointAt(e); setOrigin(o.zx, o.zy); return; } // the tap that follows zooms in right here
    capture(e);
    pan.current = { x: e.clientX, y: e.clientY, ...origin.current, moved: false };
  };
  const photoMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    if (e.pointerType === 'mouse') { const o = pointAt(e); setOrigin(o.zx, o.zy); return; }
    const pn = pan.current;
    if (!pn) return;
    const dx = e.clientX - pn.x, dy = e.clientY - pn.y;
    if (!pn.moved && Math.hypot(dx, dy) < SLOP) return;
    pn.moved = true;
    // at 2x about the origin, moving the origin by d moves the picture by -d: it moves against the finger, so
    // the picture stays under it
    const r = ref.current.getBoundingClientRect();
    setOrigin(clamp(pn.zx - (dx / r.width) * 100), clamp(pn.zy - (dy / r.height) * 100));
  };
  const photoUp = () => { if (pan.current?.moved) swallowClick.current = true; pan.current = null; };
  const photoClick = () => {
    if (swallowClick.current) { swallowClick.current = false; return; } // that was a pan, not a tap
    setTouchZoom(!zoom && pointer.current !== 'mouse');
    setZoom(!zoom);
  };

  /* ---------- the 360 view: drag, flick ---------- */
  const spinDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopCoast(); // a finger on a turning product stops it where it is
    capture(e);
    drag.current = { x: e.clientX, f: frame, hist: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const spinMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.hist.push({ x: e.clientX, t: e.timeStamp });
    d.hist = d.hist.filter((h) => e.timeStamp - h.t <= 100);
    setFrame(wrap(d.f + Math.round((e.clientX - d.x) / STEP)));
  };
  const spinUp = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    drag.current = null;
    if (!d || cancelled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // the release speed over the last 80ms; a finger that stopped before lifting leaves no speed
    const last = d.hist[d.hist.length - 1];
    const recent = d.hist.filter((h) => last.t - h.t <= 80);
    const first = recent[0];
    let v = last.t > first.t && e.timeStamp - last.t < 60 ? (last.x - first.x) / (last.t - first.t) : 0; // px per ms
    if (Math.abs(v) < 0.05) return;
    let x = last.x - d.x;
    let then = performance.now();
    const tick = (now: number) => {
      const ms = Math.min(32, now - then); then = now;
      x += v * ms; v *= Math.pow(DECAY, ms);
      setFrame(wrap(d.f + Math.round(x / STEP)));
      coast.current = Math.abs(v) > 0.02 ? requestAnimationFrame(tick) : 0;
    };
    coast.current = requestAnimationFrame(tick);
  };

  if (!images.length) return null;
  return (
    <div className="gallery">
      {mode === 'photo' ? (
        <div ref={ref} className={`gallery__main${zoom ? ' is-zoomed' : ''}${zoom && touchZoom ? ' is-touch' : ''}${prev !== null ? ' is-swapping' : ''}`} role="button" tabIndex={0}
          aria-label={zoom ? `Zoom out of ${cur.alt}` : `Zoom into ${cur.alt}`} aria-pressed={zoom}
          onClick={photoClick} onPointerDown={photoDown} onPointerMove={photoMove} onPointerUp={photoUp} onPointerCancel={photoUp}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTouchZoom(false); setZoom(!zoom); } if (e.key === 'Escape') setZoom(false); }}>
          {pp ? <img className="gallery__under" src={pp.src} srcSet={pp.srcSet} sizes={SIZES} alt="" aria-hidden="true" /> : null}
          {p ? <img key={i} className={`gallery__img${ready ? ' is-ready' : ''}`} src={p.src} srcSet={p.srcSet} sizes={SIZES} width={p.width} height={p.height} alt={cur.alt} data-source={p.generated ? 'stand-in' : 'client'}
            draggable={false}
            ref={(el) => { if (el && el.complete && el.naturalWidth && !ready) setReady(true); }}
            onLoad={() => setReady(true)} onError={() => { setReady(true); setPrev(null); }} /> : null}
        </div>
      ) : (
        <div ref={ref} className="gallery__main" role="slider" tabIndex={0} aria-label={`${name}, 360-degree view`} aria-valuemin={1} aria-valuemax={spin.length} aria-valuenow={frame + 1}
          onPointerDown={spinDown} onPointerMove={spinMove} onPointerUp={(e) => spinUp(e)} onPointerCancel={(e) => spinUp(e, true)}
          onKeyDown={(e) => { stopCoast(); if (e.key === 'ArrowRight') setFrame((frame + 1) % spin.length); if (e.key === 'ArrowLeft') setFrame((frame - 1 + spin.length) % spin.length); }}
          style={{ cursor: 'grab', touchAction: 'pan-y' }}>
          <img src={spin[frame]} alt={`${name}, view ${frame + 1} of ${spin.length}`} draggable={false} />
        </div>
      )}
      <div className="gallery__thumbs">
        {images.length > 1 || spin.length ? images.map((im, n) => {
          const t = pic(im.url, 400);
          return (
            <button key={im.url + n} type="button" aria-pressed={mode === 'photo' && n === i} aria-label={`Show view ${n + 1}: ${im.alt}`}
              onPointerEnter={() => preload(n)} onFocus={() => preload(n)} onClick={() => show(n)}>
              {t ? <img src={t.src} alt="" width={72} height={72} /> : null}
            </button>
          );
        }) : null}
        {spin.length ? <button type="button" aria-pressed={mode === 'spin'} onClick={() => { stopCoast(); setMode('spin'); }} className="gallery__spin">360°</button> : null}
      </div>
      <p className="gallery__hint">{mode === 'spin' ? 'Drag, or use the arrow keys, to turn the product.' : (
        <><span className="gallery__hint-fine">Click the picture to zoom; move the pointer to look closer.</span>
          <span className="gallery__hint-touch">Tap the picture to zoom; drag to look closer.</span></>
      )}</p>
    </div>
  );
}
