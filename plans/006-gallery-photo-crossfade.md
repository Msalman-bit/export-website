# 006 — Crossfade the product photo when a thumbnail is picked

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW
- **Category**: Missed opportunity (state change that teleports)
- **Estimated scope**: 1 component + 1 CSS file, ~35 lines

## Problem

Picking a thumbnail under a product photo swaps the main `<img>`'s `src` in place. The new photo replaces
the old instantly, and if it is not cached yet the frame shows the old photo, then a half-decoded or blank
frame, then the new one. The swap has no continuity.

```tsx
// src/components/site/Gallery.tsx:10-17 — current
const [i, setI] = useState(0);
const [zoom, setZoom] = useState(false);
const [mode, setMode] = useState<'photo' | 'spin'>('photo');
const [frame, setFrame] = useState(0);
const ref = useRef<HTMLDivElement>(null);
const drag = useRef<{ x: number; f: number } | null>(null);
const cur = images[i];
const p = pic(cur?.url, 1600);
```

```tsx
// src/components/site/Gallery.tsx:38 — current (inside the photo-mode .gallery__main)
{p ? <img src={p.src} srcSet={p.srcSet} sizes="(max-width: 1023px) 100vw, 740px" width={p.width} height={p.height} alt={cur.alt} data-source={p.generated ? 'stand-in' : 'client'} /> : null}
```

```tsx
// src/components/site/Gallery.tsx:53-54 — current (each thumbnail)
<button key={im.url + n} type="button" aria-pressed={mode === 'photo' && n === i} aria-label={`Show view ${n + 1}: ${im.alt}`}
  onClick={() => { setMode('photo'); setI(n); setZoom(false); }}>
```

```css
/* public/site/site.css:164 — current */
.gallery__main img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 300ms var(--ease); transform-origin: var(--zx, 50%) var(--zy, 50%); }
```

## Target

- The old photo stays in place underneath; the new one is loaded first (preloaded when the thumbnail is
  pointed at or focused), then fades in on top over **200ms** with `var(--m-ease)`
  (`cubic-bezier(.2, .8, .2, 1)`). The old layer is removed 260ms after the new photo is ready.
- The first photo on page load never fades (it is the page's main image).
- Zoom keeps working exactly as before.
- Reduced motion: the opacity fade stays (it carries no movement).

```tsx
// target — state and helpers (replace lines 10-17's block with this, keeping the existing lines)
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
```

```tsx
// target — the photo-mode main image (replaces line 38)
{pp ? <img className="gallery__under" src={pp.src} srcSet={pp.srcSet} sizes={SIZES} alt="" aria-hidden="true" /> : null}
{p ? <img key={i} className={`gallery__img${ready ? ' is-ready' : ''}`} src={p.src} srcSet={p.srcSet} sizes={SIZES} width={p.width} height={p.height} alt={cur.alt} data-source={p.generated ? 'stand-in' : 'client'}
  ref={(el) => { if (el && el.complete && el.naturalWidth && !ready) setReady(true); }}
  onLoad={() => setReady(true)} onError={() => { setReady(true); setPrev(null); }} /> : null}
```

```tsx
// target — each thumbnail button (replaces lines 53-54's onClick, adds preload)
<button key={im.url + n} type="button" aria-pressed={mode === 'photo' && n === i} aria-label={`Show view ${n + 1}: ${im.alt}`}
  onPointerEnter={() => preload(n)} onFocus={() => preload(n)} onClick={() => show(n)}>
```

```tsx
// target — the photo-mode container (line 34): add the swapping class to its className
<div ref={ref} className={`gallery__main${zoom ? ' is-zoomed' : ''}${prev !== null ? ' is-swapping' : ''}`} role="button" tabIndex={0}
```

```css
/* target — public/site/site.css, after line 165 (.gallery__main.is-zoomed img { transform: scale(2); }) */
.gallery__main .gallery__under { position: absolute; inset: 0; }
.gallery__main .gallery__img { position: relative; opacity: 0; transition: transform 300ms var(--ease), opacity 200ms var(--m-ease); }
.gallery__main .gallery__img.is-ready { opacity: 1; }
/* a photo inserted during a swap starts transparent even when it is cached and ready in the same frame,
   so it always fades; on page load there is no swap, so the first photo shows at once */
@starting-style { .gallery__main.is-swapping .gallery__img { opacity: 0; } }
```

The existing `.gallery__main img` rule (line 164) still sizes and zooms both images; `.gallery__img`
only adds the stacking and the fade. Positioned and later in the DOM, it paints above `.gallery__under`.
Why both `is-ready` and `@starting-style`: an uncached photo waits at 0 until it loads (`is-ready` then
fades it); a cached one is ready immediately, and the starting style still gives it a 0 → 1 transition.

## Repo conventions to follow

- `--m-ease` is the UI ease-out token (`public/assets/motion/motion.css:26`); the zoom keeps its existing `300ms var(--ease)`.
- Client components import hooks from `react` at the top: line 2 is `import { useRef, useState } from 'react';` — add `useEffect` there.

## Steps

1. `src/components/site/Gallery.tsx` line 2: change to `import { useEffect, useRef, useState } from 'react';`.
2. Replace the state block (lines 10-17) with the Target state-and-helpers block.
3. Replace line 38 with the two-image Target block, and on line 34 change the container's `className` to the Target container className (adds `is-swapping` while an old photo is kept underneath).
4. Replace the thumbnail button's opening tag (lines 53-54) with the Target button tag; leave its children (`{t ? <img … /> : null}`) unchanged.
5. Leave the spin-mode branch (lines 40-48) and the "360°" button (line 59) unchanged.
6. `public/site/site.css`: add the four Target rules (three rules and the `@starting-style` block) after line 165.

## Boundaries

- Do NOT change zoom behaviour, the 360° spin view, keyboard handling or ARIA attributes other than adding `aria-hidden` on the under-layer.
- Do NOT add dependencies.
- Plan 003 (reduced-motion zoom) touches the same image; if it is already done, keep its rule and make it `transition-property: opacity` for `.gallery__img` as that plan's step 2 says.
- If the quoted lines differ, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` → no errors; `npm run build` → succeeds; `npm test` → 30 passed; `npm run test:e2e` against a running fresh build → 9 passed (the product page test reads the main image).
- **Feel check** (`npm run dev`, `http://localhost:3000/en/products/football/match-football`, which has several photos):
  - on load the main photo appears at once, with no fade;
  - click each thumbnail: the new photo fades in over the old one; the frame never goes blank or dark;
  - click back to a thumbnail you have already viewed (now cached): it still fades, it does not snap;
  - DevTools → Network → throttle to "Slow 4G", click an uncached thumbnail: the old photo stays until the new one has loaded, then the fade runs;
  - DevTools → Animations at 10%: only opacity animates on the swap;
  - click thumbnails rapidly: no stacked ghosts remain after 300ms (Elements panel shows at most one `.gallery__under`);
  - zoom (click the photo), then pick another thumbnail: zoom resets and the crossfade runs.
- **Done when**: every thumbnail change is a 200ms fade from the old photo to the new one, with no blank frame.
