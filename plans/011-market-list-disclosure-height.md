# 011 — Open the phone market list by height instead of jumping open

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (state change that teleports)
- **Estimated scope**: 1 CSS file, ~6 lines

## Problem

On a phone, the homepage's "Shipping to Europe and North America" section folds its 21 target markets into
a `<details>` disclosure, "See the 21 markets". Tapping it makes the ~400px list appear in one frame and
pushes the map down. Closing it snaps back. Only the chevron rotates.

```tsx
// src/components/site/ExportMap.tsx — current (inside .export__list)
<details className="export__more">
  <summary>See the {markets.length} markets</summary>
  <dl className="export__regions"> … </dl>
</details>
```

```css
/* public/site/site.css — current (the market list block, around lines 493-503) */
.export__more { display: none; }
.export__more > summary { display: inline-flex; … }
.export__more > summary::after { … transform: rotate(45deg) translateY(-2px); transition: transform var(--m-in, 150ms) var(--ease); }
.export__more[open] > summary::after { transform: rotate(-135deg) translateY(-2px); }
.export__more > .export__regions { margin-top: var(--s-4); }
@media (max-width: 639px) {
  .export__all, .export__readout { display: none; }
  .export__more { display: block; }
}
```

## Target

The list opens and closes by animating its height over 250ms with `var(--m-ease)`
(`cubic-bezier(.2, .8, .2, 1)`). Measured height is the documented exception to "transform and opacity
only" for disclosures. This is a progressive enhancement: where `::details-content` or `interpolate-size`
is not supported, the list opens at once, as it does today. Reduced motion: no height animation.

```css
/* target — append after the line `.export__more > .export__regions { margin-top: var(--s-4); }` */
.export__more { interpolate-size: allow-keywords; }
.export__more::details-content { block-size: 0; overflow-y: clip;
  transition: block-size 250ms var(--m-ease), content-visibility 250ms var(--m-ease) allow-discrete; }
.export__more[open]::details-content { block-size: auto; }
@media (prefers-reduced-motion: reduce) { .export__more::details-content { transition: none; } }
```

`content-visibility … allow-discrete` keeps the names visible while the list closes, so the collapse is
seen instead of the content vanishing in the first frame.

## Repo conventions to follow

- Durations and curves from the kit tokens (`public/assets/motion/motion.css:18-26`); 250ms matches the
  kit's longest UI travel (`--m-slide: 240ms`, rounded to the AUDIT dropdown budget of 150-250ms).
- The kit itself never animates FAQ height (`motion.css:234-235`: answers stay open). This list is
  different: it is closed by default on phones only, so it is the one disclosure that opens.

## Steps

1. In `public/site/site.css`, find the line `.export__more > .export__regions { margin-top: var(--s-4); }` and insert the Target block directly after it.
2. Make no other change.

## Boundaries

- CSS only. Do NOT change `ExportMap.tsx`.
- Do NOT change the desktop list (`.export__all`), which is never collapsed.
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: none (static CSS).
- **Feel check**: `npm run dev`, DevTools device emulation at 390 × 844 (Chrome 131 or newer), open `http://localhost:3000/en`, scroll to "Shipping to Europe and North America":
  - tap "See the 21 markets": the list grows open over a quarter of a second while the map moves down with it; the chevron turns at the same time;
  - tap again: the list collapses smoothly, the names visible until it closes;
  - tap twice quickly: it reverses mid-way without jumping;
  - DevTools → Animations at 10%: only the disclosure's block-size animates;
  - Rendering → `prefers-reduced-motion: reduce`: it opens and closes at once;
  - in a browser without `::details-content` support: it still opens and closes, just without animation.
- **Done when**: on a current Chromium the list animates both ways, and elsewhere it behaves exactly as before.
