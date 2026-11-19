# 001 — Give the range-index arrow one nudge, not two

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens (with Accessibility: ungated hover)
- **Estimated scope**: 1 file, delete 2 declarations

## Problem

On the homepage product range (the list of ten families beside one photo), each row ends with the drawn
arrow `.m-arrow`. The design kit's motion layer already animates that arrow on hover: its stem grows and
its head moves 3px (`public/assets/motion/motion.css:66-74`). The site stylesheet adds a second rule that
moves the **whole** arrow 3px on top, so the head travels 6px and the arrow slides while its stem draws —
two motions where the rest of the site has one. The site rule is also not gated to fine pointers (a tap on
a phone leaves a stuck shifted arrow) and is not covered by the kit's reduced-motion rule (which only
resets `.m-arrow__head` / `.m-arrow__stem`).

```css
/* public/site/site.css:440 — current */
.range-index__list a .m-arrow { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.6; transition: transform var(--m-in, 150ms) var(--ease); }
```

```css
/* public/site/site.css:442 — current */
.range-index__list a:is(:hover, :focus-visible) .m-arrow { transform: translateX(3px); }
```

The markup is `src/app/(site)/[locale]/page.tsx`, inside the `#range` section: `<a ...><span className="range-index__name">…</span><span className="range-index__line">…</span><Arrow /></a>`,
where `Arrow` renders `<svg className="m-arrow"><path className="m-arrow__stem" …/><path className="m-arrow__head" …/></svg>`.
The `.m-arrow` is a direct child of the `<a>`, so the kit's rule `:is(a, button):hover > .m-arrow .m-arrow__head { transform: translateX(3px) }` already applies.

## Target

The arrow moves exactly as every other arrow on the site does (the kit's stem-and-head move, 150ms in,
120ms out, fine pointer only, reduced motion respected). No transform on `.m-arrow` itself.

```css
/* public/site/site.css:440 — target (sizing and stroke stay; the transition goes) */
.range-index__list a .m-arrow { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.6; }
```

Line 442 is deleted entirely.

## Repo conventions to follow

- The kit owns arrow motion: `public/assets/motion/motion.css:59-75` (`.m-arrow__stem` / `.m-arrow__head`).
  Exemplar of an arrow that relies on it with no site rule: the hero's "Request a quote" button in
  `src/app/(site)/[locale]/page.tsx` (`<a className="btn btn--primary" …>{t['cta.quote']}<Arrow /></a>`).
- Never edit anything under `public/assets/` (the design kit; its checker flags kit edits).

## Steps

1. In `public/site/site.css`, find the line that starts `.range-index__list a .m-arrow {` (line 440) and
   remove ` transition: transform var(--m-in, 150ms) var(--ease);` from it, leaving
   `.range-index__list a .m-arrow { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.6; }`.
2. Delete the whole line `.range-index__list a:is(:hover, :focus-visible) .m-arrow { transform: translateX(3px); }` (line 442).
3. Leave the phone rule `.range-index__list a .m-arrow { grid-row: 1 / span 2; grid-column: 2; }` (inside `@media (max-width: 639px)`, around line 454) untouched — it is layout, not motion.

## Boundaries

- Do NOT touch `public/assets/**`.
- Do NOT change the markup in `page.tsx`.
- Do NOT change `.range-index__line` (its colour change on hover is correct).
- If the lines quoted above are not found verbatim, STOP and report.

## Verification

- **Mechanical**: no build step needed for CSS (it is a static file under `public/`). Run
  `grep -n "range-index__list a:is(:hover, :focus-visible) .m-arrow" public/site/site.css` → no output.
- **Feel check**: `npm run dev`, open `http://localhost:3000/en`, scroll to "The product range", hover a family row:
  - the arrow's stem draws in and its head moves 3px right; the arrow as a whole does not slide;
  - in DevTools → Animations at 10% speed, only `.m-arrow__stem` and `.m-arrow__head` animate;
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: hovering shows the full arrow with no movement;
  - in device emulation (touch), tapping a row leaves no shifted arrow behind on Back.
- **Done when**: the two declarations are gone and the hover matches the hero button's arrow.
