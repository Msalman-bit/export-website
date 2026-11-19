# 003 — Make the product-gallery zoom instant under reduced motion

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, ~4 lines

## Problem

On every product page (`/en/products/<family>/<product>`), clicking the main photo zooms it to 2× under
the pointer. The zoom is a 300ms scale animation, and nothing stops it for visitors who set
`prefers-reduced-motion: reduce`. A 2× scale is a large, vestibular-triggering motion. The kit's
reduced-motion rule (`public/assets/motion/motion.css:301-321`) only covers photos inside links, linked
cards and `.m-zoom`; the gallery is none of these.

```css
/* public/site/site.css:164-165 — current */
.gallery__main img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 300ms var(--ease); transform-origin: var(--zx, 50%) var(--zy, 50%); }
.gallery__main.is-zoomed img { transform: scale(2); }
```

Component: `src/components/site/Gallery.tsx:34-39` toggles `is-zoomed` on click / Enter / Space and clears it on Escape.

## Target

With reduced motion the zoom still happens (it is a function, not decoration) but jumps to 2× and back
with no transition. Without reduced motion nothing changes.

```css
/* target — append after line 166 (.gallery__main.is-zoomed { cursor: zoom-out; }) */
@media (prefers-reduced-motion: reduce) {
  .gallery__main img { transition: none; }
}
```

## Repo conventions to follow

- Reduced motion keeps the state change and drops the movement — the kit's own pattern, e.g.
  `public/assets/motion/motion.css:310` (`.m-tab-ind { transition: none; }`: the tab pill jumps).

## Steps

1. In `public/site/site.css`, after the line `.gallery__main.is-zoomed { cursor: zoom-out; }`, add the media block from Target.
2. If plan 006 (gallery crossfade) has already been executed, the selector there may be `.gallery__main .gallery__img`; add it to the same rule so both images lose the transform transition: `.gallery__main img, .gallery__main .gallery__img { transition-property: opacity; }` — keep the opacity fade from plan 006, drop only transform. Use `transition: none` only if plan 006 is not executed.

## Boundaries

- Do NOT change `Gallery.tsx`.
- Do NOT remove the zoom or change its 2× value.
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: none (static CSS).
- **Feel check**: `npm run dev`, open any product page, e.g. `http://localhost:3000/en/products/football/match-football`.
  - Normal: clicking the photo zooms smoothly over 300ms toward the pointer; clicking again zooms out smoothly.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: clicking jumps straight to 2× and straight back; moving the pointer while zoomed still pans.
- **Done when**: under reduced motion the computed `transition` of the gallery image shows no `transform`.
