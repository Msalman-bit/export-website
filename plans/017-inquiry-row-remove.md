# 017 — Fade and close up a product row when it is removed from the inquiry

- **Status**: DONE (2026-11-20, reviewed)
- **Commit**: 97baed5
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (a state change that teleports)
- **Estimated scope**: 1 component (~12 lines) and 1 CSS file (~6 lines)

## Problem

On the inquiry page (`/en/inquiry`), the products the visitor added are listed with a quantity, notes and a
"Remove" button. Removing one deletes the row in a single frame and every row below snaps up by about 120px, so the
visitor loses their place in a list they are working through.

```tsx
// src/components/site/InquiryForm.tsx:42 — current
const remove = (key: string) => { const next = items.filter((i) => i.key !== key); setItems(next); writeBasket(next); };

// src/components/site/InquiryForm.tsx:163-165 and :181 — current
<ul className="basket">
  {items.map((i, n) => (
    <li key={i.key}>
      …
      <button type="button" className="btn-text basket__rm" onClick={() => remove(i.key)}>Remove<span className="sr-only"> {i.name}</span></button>
    </li>
  ))}
</ul>
```

```css
/* public/site/site.css:231-232 — current */
.basket { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.basket > li { display: grid; grid-template-columns: 88px minmax(0, 1fr) 120px auto; gap: var(--s-4); align-items: start; padding: var(--s-4) 0; border-bottom: 1px solid var(--line); }
```

`writeBasket()` also fires the `ms-basket` event, which re-reads the list (`InquiryForm.tsx:31-36`), so the row
disappears the instant the stored list changes.

## Target

On "Remove", the row is marked as leaving: it fades out (150ms) while its height and padding close to 0 (200ms), and
the rows below slide up into the space. After 200ms the product is taken out of the list and the stored basket, as
today. A second click on the same row while it is leaving does nothing. Under reduced motion the row only fades, then
the list closes up at once. Where `interpolate-size` is unsupported (Safari, Firefox today) the row fades and the
list closes up at once.

```tsx
// target — src/components/site/InquiryForm.tsx, replacing line 42
// a removed product fades and its row closes up first (CSS .is-leaving, 200ms); then it leaves the list and the
// stored basket (which fires ms-basket and re-reads the list)
const [leaving, setLeaving] = useState<string[]>([]);
const remove = (key: string) => {
  if (leaving.includes(key)) return;
  setLeaving((l) => [...l, key]);
  setTimeout(() => {
    setItems((cur) => { const next = cur.filter((i) => i.key !== key); writeBasket(next); return next; });
    setLeaving((l) => l.filter((k) => k !== key));
  }, 200);
};

// target — the row's opening tag (line 165)
<li key={i.key} className={leaving.includes(i.key) ? 'is-leaving' : undefined}>
```

```css
/* target — public/site/site.css, directly after the `.basket > li { … }` line */
/* a removed row fades and closes up before it leaves (InquiryForm.tsx holds it 200ms); the rows below slide up */
.basket > li { interpolate-size: allow-keywords;
  transition: height 200ms var(--m-ease), padding-block 200ms var(--m-ease), opacity 150ms var(--m-ease), border-color 150ms var(--m-ease); }
.basket > li.is-leaving { height: 0; padding-block: 0; opacity: 0; overflow: clip; border-bottom-color: transparent; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .basket > li { transition: opacity 150ms var(--m-ease); } }
```

Values: 200ms with `--m-ease` (`cubic-bezier(.2, .8, .2, 1)`, `public/assets/motion/motion.css:26`) for the collapse,
150ms for the fade so the content is gone before the row is fully closed. The exit is a UI exit: ease-out, under
300ms.

## Repo conventions to follow

- Height changes use `interpolate-size: allow-keywords` as a progressive enhancement (exemplar: the market list,
  `public/site/site.css:546-550`).
- Component state follows the file's existing style: `useState` hooks at the top of `InquiryForm`
  (`InquiryForm.tsx:21-28`), small arrow helpers like `update` and `remove` (`:38-42`).

## Steps

1. In `src/components/site/InquiryForm.tsx`, replace the one-line `const remove = …` (line 42) with the `leaving`
   state and the new `remove` from Target (comment included).
2. In the same file, change the row's opening tag `<li key={i.key}>` (inside `<ul className="basket">`, around
   line 165) to the Target version with the `className`.
3. In `public/site/site.css`, insert the Target CSS block directly after the line that starts
   `.basket > li { display: grid;` (around line 232).
4. Make no other change.

## Boundaries

- Do NOT change `writeBasket`/`readBasket` or the `ms-basket` event.
- Do NOT change focus handling (focus is lost when the row goes, as today; a focus fix is a separate concern).
- Do NOT animate rows being added (they arrive from other pages).
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` passes; `npx vitest run` passes (38 tests at 97baed5); the end-to-end tests
  do not run this script and need not change.
- **Feel check**: `npm run dev` in Chrome 129 or newer. Add three products to the inquiry (product page → "Add to
  inquiry"), open `http://localhost:3000/en/inquiry`:
  - remove the middle product: it fades and its row closes up over a fifth of a second while the last row slides up
    into its place;
  - double-click "Remove" on a row: one removal, no error, no flicker;
  - remove all three quickly one after another: each closes up, and after the last one the "Your inquiry list is
    empty" message appears;
  - reload the page: the removed products stay removed (the stored basket was updated);
  - Rendering → `prefers-reduced-motion: reduce`: the row fades, then the list closes up at once;
  - Safari or Firefox: the row fades, then the list closes up at once.
- **Done when**: removing a row never makes the rows below jump in a single frame in Chrome, and the stored basket
  matches what is on screen after each removal.
