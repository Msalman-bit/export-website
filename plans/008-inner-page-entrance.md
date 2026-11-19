# 008 — Give inner pages a short, non-blocking entrance

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (cohesion with the homepage's entrance)
- **Estimated scope**: 1 shared component, 7 pages (one prop each), 1 CSS file, ~30 lines

## Problem

Only the homepage enters on load: its hero has `data-enter` and the kit's motion layer runs the headline
in word by word, settles the picture, and staggers the buttons
(`public/assets/motion/motion.css:257-298`, driven by `public/assets/motion/motion.js`). Every other page
renders with no motion at all, so leaving the homepage feels like dropping into a different site.

The inner pages share one frame and one heading block:

```tsx
// src/components/site/PageShell.tsx:9-19 — current
export async function PageShell({ locale, crumbs, children, close, mainClass = 'page' }: {
  locale: Locale; crumbs: { name: string; path: string }[]; children: React.ReactNode; close?: Close; mainClass?: string;
}) {
  …
  return (
    <>
      <main id="top" className={mainClass}>
```

```tsx
// heading block used by content pages, e.g. src/app/(site)/[locale]/[...slug]/page.tsx:56-59 — current
<header className="page-head">
  <h1>{page.title}</h1>
  <p>{page.summary}</p>
</header>
```

```tsx
// family page media, src/app/(site)/[locale]/products/[family]/page.tsx:49-51 — current
<figure className="split-page__media" style={{ aspectRatio: '4 / 3', position: 'static' }}>
  <Img url={f.image?.url} … eager />
</figure>
```

The product page's main photo is `.gallery__main img` (`src/components/site/Gallery.tsx`).

## Target

Two entrance strengths, chosen by how often a page is seen:

- **`content`**: company, manufacturing and legal pages, insights, catalogues and credits. These are read
  once or twice, so the heading block rises in: each direct `h1` / `p` child of `.page-head` fades up 8px
  over 320ms with `var(--m-ease-enter)`, staggered 0 / 40 / 80ms. The page's photo settles too.
- **`media`**: product family and product pages. Buyers flip through these many times a visit, so the
  text appears at once and only the main photo settles, from `scale: 1.02` to `1` over 600ms with
  `var(--m-ease-enter)`, inside its clipping frame.
- Search, inquiry, account, studio, the 404 and the sent page get no prop and stay static (plan 009
  handles the sent page).
- Nothing waits on JavaScript: plain CSS animations that never delay clicks or focus.
- Reduced motion: `content` headings fade in over 200ms with `var(--m-ease)` and no movement; photos do not scale.

Token values (kit, `public/assets/motion/motion.css:26-28`): `--m-ease: cubic-bezier(.2, .8, .2, 1)`,
`--m-ease-enter: cubic-bezier(.22, 1, .36, 1)`.

```tsx
// target — PageShell signature and <main>
export async function PageShell({ locale, crumbs, children, close, mainClass = 'page', enter }: {
  locale: Locale; crumbs: { name: string; path: string }[]; children: React.ReactNode; close?: Close; mainClass?: string;
  /* the page's entrance on load: 'content' (the heading rises, the photo settles) for pages read once,
     'media' (the photo settles only) for catalogue pages browsed again and again; none by default */
  enter?: 'content' | 'media';
}) {
  …
      <main id="top" className={mainClass} data-page-enter={enter}>
```

```css
/* target — append to public/site/site.css */
/* ---------- inner pages: a short entrance on load (the homepage hero has the kit's own). 'content'
   pages: the heading rises 8px in 320ms, 40ms apart; both kinds: the main photo settles from 1.02 in
   600ms inside its frame. CSS only: nothing waits, nothing blocks a click ---------- */
@media (prefers-reduced-motion: no-preference) {
  main[data-page-enter="content"] .page-head > :is(h1, p) { animation: m-page-rise 320ms var(--m-ease-enter) both; }
  main[data-page-enter="content"] .page-head > :nth-child(2) { animation-delay: 40ms; }
  main[data-page-enter="content"] .page-head > :nth-child(n+3) { animation-delay: 80ms; }
  main[data-page-enter] :is(.split-page__media, .gallery__main) img { animation: m-page-settle 600ms var(--m-ease-enter) both; }
}
@media (prefers-reduced-motion: reduce) {
  main[data-page-enter="content"] .page-head > :is(h1, p) { animation: m-page-fade 200ms var(--m-ease) both; }
}
@keyframes m-page-rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes m-page-settle { from { scale: 1.02; } }
@keyframes m-page-fade { from { opacity: 0; } }
```

The settle animates the `scale` property, not `transform`, so it composes with the gallery's click zoom
(`transform: scale(2)`), the same technique the kit uses for its hero settle (`motion.css:289`). Both
frames already clip: `.split-page__media { overflow: clip }` (`public/site/site.css:135`) and
`.gallery__main { overflow: hidden }` (`:163`).

## Repo conventions to follow

- Entrance curve `--m-ease-enter` and the scale-property settle: `public/assets/motion/motion.css:276-289`.
- Optional props on server components default to `undefined` and are passed straight through, e.g. `mainClass` in `PageShell`.

## Steps

1. `src/components/site/PageShell.tsx`: add the `enter` prop to the destructuring and type as in Target, and add `data-page-enter={enter}` to `<main id="top" className={mainClass}>`.
2. Pass `enter="content"` to `<PageShell …>` in:
   - `src/app/(site)/[locale]/[...slug]/page.tsx` (the PageShell call above `<div className={image ? 'split-page' : 'block'}>`)
   - `src/app/(site)/[locale]/insights/page.tsx` (line 17)
   - `src/app/(site)/[locale]/insights/[slug]/page.tsx` (line 30)
   - `src/app/(site)/[locale]/catalogues/page.tsx` (line 18)
   - `src/app/(site)/[locale]/credits/page.tsx` (line 17)
3. Pass `enter="media"` to `<PageShell …>` in:
   - `src/app/(site)/[locale]/products/[family]/page.tsx` (the call above `<div className="split-page">`)
   - `src/app/(site)/[locale]/products/[family]/[product]/page.tsx` (the call above `<div className="pdp">`)
4. Append the Target CSS block to the end of `public/site/site.css`.

## Boundaries

- Do NOT touch the homepage, `public/assets/**`, or pages not listed in steps 2-3 (`products/page.tsx`, search, inquiry, account, studio, not-found, inquiry/sent).
- Do NOT animate on scroll; this is on load only.
- Do NOT hide anything before JavaScript runs: no JS, no `opacity: 0` outside the animations.
- If plan 006 is executed, its `.gallery__img` is matched by `.gallery__main img`; nothing else is needed.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` → no errors; `npm run build` → succeeds; `npm run test:e2e` against a running fresh build → 9 passed.
- **Feel check** (`npm run dev`):
  - open `http://localhost:3000/en/about`: the title, then the summary, rise in quickly (under a third of a second) and the photo eases from slightly larger to its place; the links are clickable immediately;
  - open `http://localhost:3000/en/products/football`: the text is there at once; only the photo settles;
  - open a product page: the main photo settles; clicking during the settle still zooms;
  - click between two family pages several times: the motion is subtle enough not to feel like a wait;
  - DevTools → Animations at 10%: the stagger is 0 / 40 / 80ms and the movement is 8px;
  - Rendering → `prefers-reduced-motion: reduce`: headings fade without moving; photos do not scale;
  - `/en/inquiry` and `/en/account/login`: no entrance.
- **Done when**: the listed pages enter as described, and every other inner page is unchanged.
