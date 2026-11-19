# 002 — Swap the range photo in 180ms with no darkening dip

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, ~6 lines

## Problem

The homepage product range shows one photo beside ten family rows; pointing at (or tabbing to) a row
brings up that family's photo. All ten photos sit stacked (`position: absolute`), and the swap is a
symmetric two-way crossfade of **320ms**:

```css
/* public/site/site.css:418 — current */
.range-index__pics > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 320ms var(--ease, ease); }
/* :419 */ .range-index__pics > img:first-child { opacity: 1; }
/* :420 */ .range-index:has(li > a:is(:hover, :focus-visible)) .range-index__pics > img:first-child { opacity: 0; }
/* :421-432: one selector per row, ending in */
… .range-index:has(li:nth-child(12) > a:is(:hover, :focus-visible)) .range-index__pics > img:nth-child(12) { opacity: 1; }
```

Two problems:

1. It is a hover-driven swap on a list people scan quickly (tens of times per visit). 320ms is over the
   300ms UI budget and trails the pointer.
2. Fading out and in at the same time puts both photos at roughly 50% halfway through, over the light
   `var(--surface)` ground of `.range-index__pics`: the frame visibly dims and double-exposes on every move.

## Target

An **asymmetric** crossfade: the incoming photo fades in over 180ms with the UI ease-out; the outgoing
photo holds for 60ms, then fades out over 140ms. The incoming photo is already about three-quarters
opaque when the outgoing one starts to go, so the frame never dims, whichever of the two is on top in
the stack. Transitions (not keyframes) retarget cleanly when the pointer sweeps fast.

```css
/* target — line 418 becomes these two lines */
:root { --m-swap: 180ms; } /* a photograph swapped in place by pointing at a list row */
.range-index__pics > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0;
  transition: opacity calc(var(--m-swap) - 40ms) var(--m-ease) 60ms; }   /* leaving: hold 60ms, out in 140ms */
```

```css
/* target — the shown-photo rules (line 419 and the group 421-432) also carry the arriving transition */
.range-index__pics > img:first-child { opacity: 1; transition: opacity var(--m-swap) var(--m-ease); }
.range-index:has(li:nth-child(1) > a:is(:hover, :focus-visible)) .range-index__pics > img:nth-child(1),
/* … nth-child(2) through nth-child(11), unchanged … */
.range-index:has(li:nth-child(12) > a:is(:hover, :focus-visible)) .range-index__pics > img:nth-child(12) { opacity: 1; transition: opacity var(--m-swap) var(--m-ease); }
```

```css
/* target — line 420 (the first photo leaving while another row is pointed at) */
.range-index:has(li > a:is(:hover, :focus-visible)) .range-index__pics > img:first-child { opacity: 0; transition: opacity calc(var(--m-swap) - 40ms) var(--m-ease) 60ms; }
```

`--m-ease` is the repo's UI ease-out, `cubic-bezier(.2, .8, .2, 1)` (`public/assets/system.css:90`, aliased
in `public/assets/motion/motion.css:26`). Reduced motion needs nothing extra: it is an opacity change.

Specificity check (no reordering needed): line 420 is (0,4,3); each row selector such as
`…:has(li:nth-child(1) > a…) … img:nth-child(1)` is (0,5,3), so pointing at row 1 still shows photo 1.

## Repo conventions to follow

- Motion tokens are `--m-*` custom properties (kit: `public/assets/motion/motion.css:17-31`). Add site
  tokens the same way in `public/site/site.css` — never in `public/assets/`.
- Exemplar of the UI ease-out in the site file: `.export__map path { … transition: fill var(--m-in, 150ms) var(--ease); }` (`public/site/site.css:90`).

## Steps

1. In `public/site/site.css`, replace line 418 with the two lines of the first Target block.
2. Replace line 419 with `.range-index__pics > img:first-child { opacity: 1; transition: opacity var(--m-swap) var(--m-ease); }`.
3. Replace line 420 with the third Target block.
4. In the group on lines 421-432, change only the final declaration block `{ opacity: 1; }` to `{ opacity: 1; transition: opacity var(--m-swap) var(--m-ease); }`. Keep all twelve selectors exactly as written.

## Boundaries

- Only these `.range-index__pics > img` rules change. Do NOT touch `.range-index__pics`, the list rules or `src/app/(site)/[locale]/page.tsx`.
- Do NOT add JavaScript or `z-index`.
- If lines 418-432 do not match the excerpt, STOP and report.

## Verification

- **Mechanical**: `npm run dev`, open `http://localhost:3000/en`, select a `.range-index__pics > img` in DevTools: at rest its computed `transition` is `opacity 0.14s cubic-bezier(0.2, 0.8, 0.2, 1) 0.06s`; the first photo's is `opacity 0.18s …`.
- **Feel check**:
  - move the pointer down the ten rows at normal speed: each photo arrives within about a fifth of a second; the frame never dims and the pale ground never shows between photos;
  - DevTools → Animations at 10%: the new photo is well on its way before the old one starts fading;
  - sweep fast from row 1 to row 10 and back: no flicker, no photo stuck half-visible;
  - leave the list: the first family's photo returns the same way;
  - keyboard: Tab through the rows; the photo follows focus identically.
- **Done when**: no frame of the swap is darker or paler than the photos themselves, and the swap completes in 200ms.
