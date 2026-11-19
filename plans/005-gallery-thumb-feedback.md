# 005 — Give the gallery thumbnails hover and press feedback

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, ~8 lines

## Problem

The thumbnail buttons under every product photo are plain `<button>`s, so the design kit's button
motion (`.btn`) does not reach them. They have no hover state, no press feedback, and the selected
border snaps on instantly. Everywhere else on the site, a pressable control steps and presses.

```css
/* public/site/site.css:168-169 — current */
.gallery__thumbs button { width: 72px; height: 72px; padding: 0; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; background: var(--surface); cursor: pointer; }
.gallery__thumbs button[aria-pressed="true"] { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
```

Markup: `src/components/site/Gallery.tsx:49-60` (one `<button aria-pressed>` per image, plus a `.gallery__spin` "360°" button when spin frames exist).

## Target

- Border and inset ring fade in 120ms out / 150ms in (the kit's hover pair), curve `var(--m-ease)`.
- On a fine pointer, an unselected thumbnail's border darkens on hover.
- Pressing scales the thumbnail to 0.97 over the kit's press duration (`--m-press`, 90ms).
- Reduced motion keeps the colour changes and drops the scale.

```css
/* target — replaces line 168's declarations by adding the transition, and adds the rules after line 169 */
.gallery__thumbs button { width: 72px; height: 72px; padding: 0; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; background: var(--surface); cursor: pointer;
  transition: border-color var(--m-out) var(--m-ease), box-shadow var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
@media (hover: hover) and (pointer: fine) {
  .gallery__thumbs button:hover:not([aria-pressed="true"]) { border-color: color-mix(in oklab, var(--ink) 40%, transparent); transition-duration: var(--m-in), var(--m-in), var(--m-press); }
}
.gallery__thumbs button:active { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) { .gallery__thumbs button:active { transform: none; } }
```

Token values (kit, `public/assets/motion/motion.css:18-26`): `--m-in: 150ms`, `--m-out: 120ms`,
`--m-press: 90ms`, `--m-ease: cubic-bezier(.2, .8, .2, 1)`.

## Repo conventions to follow

- The kit's `.btn` is the exemplar: hover out 120ms, in 150ms, press by transform, hover gated to `(hover: hover) and (pointer: fine)` — `public/assets/motion/motion.css:34-57`.

## Steps

1. In `public/site/site.css` line 168, add `transition: border-color var(--m-out) var(--m-ease), box-shadow var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease);` to the end of the declaration block.
2. After line 169, add the three rules from Target (hover in its media query, `:active`, reduced motion).

## Boundaries

- CSS only; do NOT change `Gallery.tsx`.
- Do NOT touch `public/assets/**`.
- Do NOT restyle the selected state (ink border + inset ring) beyond adding its transition.

## Verification

- **Mechanical**: none (static CSS).
- **Feel check** on a product page with several photos (`npm run dev`, e.g. `http://localhost:3000/en/products/football/match-football`):
  - hovering an unselected thumbnail darkens its border; leaving fades it back slightly faster;
  - clicking a thumbnail gives a brief, small press (3%), then it becomes the selected one with the ink ring fading in;
  - holding the mouse down keeps it pressed; releasing returns it in 90ms;
  - Rendering → `prefers-reduced-motion: reduce`: the press no longer scales; colours still change;
  - touch emulation: no stuck hover border after a tap.
- **Done when**: thumbnails press and hover like the site's buttons.
