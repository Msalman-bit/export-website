# 013 — Let a field's error line open, instead of shoving the next field down

- **Status**: DONE (2026-11-20, reviewed)
- **Commit**: 97baed5
- **Severity**: MEDIUM
- **Category**: Missed opportunity (a state change that teleports), corrective
- **Estimated scope**: 1 CSS file, ~10 lines

## Problem

The inquiry form now checks a field as the visitor leaves it (`src/components/site/InquiryForm.tsx`, `leave()` and
`edit()` since commit 97baed5). When a check fails, an error line is inserted under that field:

```tsx
// src/components/site/InquiryForm.tsx:45 — current
const errLine = (name: string) => (errors[name] ? <p className="err" id={`${name}-err`}>{errors[name]}</p> : null);
// used inside each field, e.g. :197
<div className="field"><label htmlFor="email">…</label>
  <input id="email" name="email" … {...err('email')} />{errLine('email')}</div>
```

```css
/* public/assets/system.css:1242 — the field is a grid with an 8px gap between its parts */
.field { display: grid; gap: var(--s-2); font-size: var(--t-small); font-weight: 500; }
/* public/site/site.css:230 — current */
.err { color: #b3261e; font-size: var(--t-small); font-weight: 500; }
```

The line appears in one frame, and with it a new grid row plus the 8px gap: everything below moves down by about
29px at once. Because the check runs as focus leaves, the field that just received focus (the one below) is the
thing that jumps under the visitor's eyes and finger. The same `.field > .err` pattern shows errors on the account
forms (`src/app/(site)/[locale]/account/forms.tsx:17`), where they appear after sending; those get the same opening.
"Add to inquiry" places its error outside any `.field` (`src/components/site/AddToInquiry.tsx:44`), so it is not
affected.

## Target

An error line inside a field opens over 200ms: its height grows from 0, an 8px negative top margin cancels the
grid gap at the start and eases to 0, and the text fades in. The fields below slide down instead of jumping.
Under reduced motion the line fades in where it lands, with no growing. Disappearing stays instant (the line is
removed by React; the fields below then move up, which happens while the visitor is typing above them, so nothing
moves under their eyes).

```css
/* target — public/site/site.css, directly after the line `.err { color: #b3261e; … }` */
/* an error under a field opens: its height grows from 0 and the field's 8px gap eases in with it, so the next
   field slides down instead of jumping (height: the documented exception for disclosures; where interpolate-size
   is not supported the line simply fades in) */
.field > .err { interpolate-size: allow-keywords; overflow: clip;
  transition: height 200ms var(--m-ease), margin-block-start 200ms var(--m-ease), opacity 200ms var(--m-ease); }
@starting-style { .field > .err { height: 0; margin-block-start: calc(-1 * var(--s-2)); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .field > .err { transition: opacity 200ms var(--m-ease); }
  @starting-style { .field > .err { height: auto; margin-block-start: 0; opacity: 0; } }
}
```

Values: 200ms with `--m-ease` (`cubic-bezier(.2, .8, .2, 1)`, `public/assets/motion/motion.css:26`), the same
entrance the site's other confirmation line uses (`site.css:206-210`). `var(--s-2)` is the field's gap (8px).

## Repo conventions to follow

- Insertions are animated with `@starting-style` plus a transition, never keyframes (exemplar: the status line,
  `public/site/site.css:205-210`, including its reduced-motion `@starting-style` that keeps only the fade).
- Height growth uses `interpolate-size: allow-keywords` as a progressive enhancement (exemplar: the market list,
  `site.css:546-550`).

## Steps

1. In `public/site/site.css`, find the line `.err { color: #b3261e; font-size: var(--t-small); font-weight: 500; }`
   (around line 230) and insert the Target block (comment included) directly after it.
2. Make no other change.

## Boundaries

- CSS only. Do NOT change `InquiryForm.tsx` or any other component.
- Scope is `.field > .err` only: the form-level error (`InquiryForm.tsx:238`), the "Add to inquiry" quantity error
  (`AddToInquiry.tsx:44`), the Studio error and the "Not saved" span are not inside a `.field` and stay as they are.
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: none (static CSS).
- **Feel check**: `npm run dev` in Chrome 129 or newer, open `http://localhost:3000/en/inquiry`:
  - type `buyer@club` in Business email, press Tab: the error line opens under the email field over a fifth of a
    second and the Phone field below slides down with it, rather than jumping;
  - finish the address (`buyer@club.com`): the line disappears at once;
  - press Send with empty fields: every error line opens together, smoothly;
  - DevTools → Animations at 10%: each `.err` animates `height`, `margin-block-start` and `opacity` from the
    start values to its natural size;
  - Rendering → `prefers-reduced-motion: reduce`: the lines fade in, and the fields below move at once;
  - Safari or Firefox: the lines fade in (no height growth); nothing is broken.
- **Done when**: in Chrome, measuring the Phone field's `getBoundingClientRect().top` right after leaving a bad
  email shows it moving over about 200ms instead of in one frame.
