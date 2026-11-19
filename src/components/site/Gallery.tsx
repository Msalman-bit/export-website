'use client';
import { useEffect, useRef, useState } from 'react';
import { pic } from '@/lib/media';
import type { ProductImage } from '@/lib/db/schema';

/* Product gallery: the main view, thumbnails for every angle, zoom (click or Enter: 2x under the
   pointer; Escape leaves) and, when the product has spin frames, a 360-degree view dragged by
   pointer or stepped with the arrow keys. */
export function Gallery({ images, spin, name }: { images: ProductImage[]; spin: string[]; name: string }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null); // the photo being replaced, kept under the new one
  const [ready, setReady] = useState(true);              // the current photo has loaded (true at first: no fade on load)
  const [zoom, setZoom] = useState(false);
  const [mode, setMode] = useState<'photo' | 'spin'>('photo');
  const [frame, setFrame] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; f: number } | null>(null);
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

  const show = (n: number) => {
    setMode('photo'); setZoom(false);
    if (n === i) return;
    setPrev(i); setI(n); setReady(false);
  };
  const preload = (n: number) => {
    const q = pic(images[n]?.url, 1600); if (!q) return;
    const im = new Image(); if (q.srcSet) { im.sizes = SIZES; im.srcset = q.srcSet; } im.src = q.src;
  };

  const move = (e: React.PointerEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
    if (mode === 'spin' && drag.current) {
      const step = Math.round((e.clientX - drag.current.x) / 12);
      setFrame(((drag.current.f + step) % spin.length + spin.length) % spin.length);
    }
  };

  if (!images.length) return null;
  return (
    <div className="gallery">
      {mode === 'photo' ? (
        <div ref={ref} className={`gallery__main${zoom ? ' is-zoomed' : ''}${prev !== null ? ' is-swapping' : ''}`} role="button" tabIndex={0}
          aria-label={zoom ? `Zoom out of ${cur.alt}` : `Zoom into ${cur.alt}`} aria-pressed={zoom}
          onClick={() => setZoom(!zoom)} onPointerMove={move}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoom(!zoom); } if (e.key === 'Escape') setZoom(false); }}>
          {pp ? <img className="gallery__under" src={pp.src} srcSet={pp.srcSet} sizes={SIZES} alt="" aria-hidden="true" /> : null}
          {p ? <img key={i} className={`gallery__img${ready ? ' is-ready' : ''}`} src={p.src} srcSet={p.srcSet} sizes={SIZES} width={p.width} height={p.height} alt={cur.alt} data-source={p.generated ? 'stand-in' : 'client'}
            ref={(el) => { if (el && el.complete && el.naturalWidth && !ready) setReady(true); }}
            onLoad={() => setReady(true)} onError={() => { setReady(true); setPrev(null); }} /> : null}
        </div>
      ) : (
        <div ref={ref} className="gallery__main" role="slider" tabIndex={0} aria-label={`${name}, 360-degree view`} aria-valuemin={1} aria-valuemax={spin.length} aria-valuenow={frame + 1}
          onPointerDown={(e) => { drag.current = { x: e.clientX, f: frame }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
          onPointerUp={() => { drag.current = null; }} onPointerMove={move}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') setFrame((frame + 1) % spin.length); if (e.key === 'ArrowLeft') setFrame((frame - 1 + spin.length) % spin.length); }}
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
        {spin.length ? <button type="button" aria-pressed={mode === 'spin'} onClick={() => setMode('spin')} className="gallery__spin">360°</button> : null}
      </div>
      <p className="gallery__hint">{mode === 'spin' ? 'Drag, or use the arrow keys, to turn the product.' : 'Click the picture to zoom; move the pointer to look closer.'}</p>
    </div>
  );
}
