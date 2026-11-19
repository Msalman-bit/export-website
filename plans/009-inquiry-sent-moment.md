# 009 — Give the "request is in" confirmation one moment of delight

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (rare, high-emotion moment)
- **Estimated scope**: 1 page + 1 CSS file, ~25 lines

## Problem

After a buyer sends a quotation or sample request, they land on `/[locale]/inquiry/sent?ref=MS-…`: the
end of the site's main conversion path, seen once per request. It renders the reference number as large
static text, with nothing to mark the moment.

```tsx
// src/app/(site)/[locale]/inquiry/sent/page.tsx:20-27 — current (valid-reference branch)
<div className="page-head">
  {valid ? (
    <>
      <h1>Your {what} is in</h1>
      <p>Your reference:</p>
      <p className="ref">{ref}</p>
      <p>A copy is on its way to your email. Quote the reference when you write to us.</p>
    </>
```

```css
/* public/site/site.css:210 — current */
.ref { font-family: var(--font-display); font-size: clamp(32px, 2vw + 20px, 48px); letter-spacing: var(--display-tracking); font-variant-numeric: tabular-nums; }
```

## Target

One short, calm sequence (about 0.9s in total, never blocking the buttons below):

1. A 48px check in a circle appears above the heading. The ring fades and grows from `scale: .9` over 300ms; the tick then draws its stroke over 400ms, starting at 150ms.
2. The reference number reveals left to right with a `clip-path` wipe over 500ms, starting at 250ms.
3. Curves: `var(--m-ease)` (`cubic-bezier(.2, .8, .2, 1)`) for the ring and tick, `var(--m-ease-enter)` (`cubic-bezier(.22, 1, .36, 1)`) for the wipe.
4. Reduced motion: the check is drawn complete with no animation, and the reference fades in over 200ms.

```tsx
// target — valid branch; the page-head gets a hook class, the check goes above the h1
<div className={`page-head${valid ? ' sent' : ''}`}>
  {valid ? (
    <>
      <svg className="sent__check" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="sent__ring" cx="24" cy="24" r="22" />
        <path className="sent__tick" d="M14 24.5l7 7 13-14" />
      </svg>
      <h1>Your {what} is in</h1>
      <p>Your reference:</p>
      <p className="ref">{ref}</p>
      <p>A copy is on its way to your email. Quote the reference when you write to us.</p>
    </>
```

```css
/* target — append to public/site/site.css */
/* ---------- the sent page: the one success moment of the inquiry path. A check draws, then the reference
   wipes in left to right; about 0.9s, nothing waits on it ---------- */
.sent__check { display: block; width: 48px; height: 48px; margin-bottom: var(--s-5); fill: none; stroke: var(--ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.sent__ring { stroke: var(--line-strong); transform-box: fill-box; transform-origin: center; }
.sent__tick { stroke-dasharray: 30; stroke-dashoffset: 0; }
@media (prefers-reduced-motion: no-preference) {
  .sent .sent__ring { animation: m-sent-ring 300ms var(--m-ease) both; }
  .sent .sent__tick { animation: m-sent-tick 400ms var(--m-ease) 150ms both; }
  .sent .ref { animation: m-sent-ref 500ms var(--m-ease-enter) 250ms both; }
}
@media (prefers-reduced-motion: reduce) {
  .sent .ref { animation: m-sent-fade 200ms var(--m-ease) both; }
}
@keyframes m-sent-ring { from { opacity: 0; scale: .9; } }
@keyframes m-sent-tick { from { stroke-dashoffset: 30; } }
@keyframes m-sent-ref  { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
@keyframes m-sent-fade { from { opacity: 0; } }
```

The tick path `M14 24.5 l7 7 l13 -14` is about 29 units long (√98 + √365), so `stroke-dasharray: 30`
hides it completely at offset 30.

## Repo conventions to follow

- Keyframe names in the site start with `m-` (as in plan 008); tokens from `public/assets/motion/motion.css:26-28`.
- The kit's hero entrance also reveals with `clip-path: inset(…)` (`motion.css:279`, `:291`).
- Ink and line colours come from the page tokens `--ink` and `--line-strong` (used across `public/site/site.css`).

## Steps

1. `src/app/(site)/[locale]/inquiry/sent/page.tsx`: change `<div className="page-head">` to the Target className expression, and insert the `<svg className="sent__check" …>` block as the first child of the valid branch, before `<h1>`.
2. Leave the "Reference not found" branch and the button row unchanged.
3. Append the Target CSS block to the end of `public/site/site.css`.

## Boundaries

- Do NOT change any text, the reference format, or the buttons.
- Do NOT add confetti, sound, or anything that loops.
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` → no errors; `npm run build` → succeeds; `npm run test:e2e` against a running fresh build → 9 passed (the journey test opens this page).
- **Feel check** (`npm run dev`): open `http://localhost:3000/en/inquiry/sent?ref=MS-261118-AB12C&type=quote` (any value matching `MS-YYMMDD-XXXXX`):
  - the ring appears, the tick draws, then the reference wipes in from the left; the whole thing settles in under a second;
  - the "Create a customer account" and "See the catalogue" buttons are visible and clickable from the first frame;
  - DevTools → Animations at 10%: the order is ring, then tick, then reference, slightly overlapping, with no jump at the end;
  - Rendering → `prefers-reduced-motion: reduce`: the check is shown complete and the reference only fades;
  - `?ref=bad`: "Reference not found", no check and no motion.
- **Done when**: the valid page plays the sequence once on load, and the invalid page is unchanged.
