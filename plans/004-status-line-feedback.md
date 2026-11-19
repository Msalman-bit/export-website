# 004 — Make every "added" and "saved" confirmation visibly arrive

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: MEDIUM
- **Category**: Missed feedback (Purpose & frequency: state indication)
- **Estimated scope**: 2 components + 1 CSS file, ~20 lines

## Problem

The two main actions a buyer takes on the site confirm themselves only by swapping the text of a status
line. When the same action is repeated, the text is identical, React renders nothing new, and the buyer
sees **no feedback at all** — they cannot tell whether the second "Add to inquiry" worked.

```tsx
// src/components/site/AddToInquiry.tsx:30 — current
setStatus(sample ? `A sample of ${product.name} is on your inquiry list.` : `${n.toLocaleString('en-GB')} × ${product.name}: ${labels.added.toLowerCase()}.`);
```

```tsx
// src/components/site/AddToInquiry.tsx:44-46 — current
<p className="status-line" role="status">
  {status}{status || count ? <> <a className="link" href={`/${locale}/inquiry`}>Open your inquiry list{count ? ` (${count})` : ''}</a></> : null}
</p>
```

```tsx
// src/components/studio/Studio.tsx:226 — current (setStatus is called at lines 135, 142, 148, 149, 161)
<p className="status-line" role="status">{status}{status.includes('inquiry list') ? <> <a className="link" href={`/${locale}/inquiry`}>Send the inquiry</a></> : null}</p>
```

```css
/* public/site/site.css:181 — current */
.status-line { font-size: var(--t-small); min-height: 1.5em; }
```

## Target

Every call that sets a status produces a **new** message element, which rises 6px and fades in over
200ms with the UI ease-out. Repeating an action replays it. The live region stays the `<p role="status">`
(unchanged), so screen readers still announce each message.

```tsx
// target pattern (both components)
const [status, setStatus] = useState('');
const [statusN, setStatusN] = useState(0);
const say = (s: string) => { setStatus(s); setStatusN((x) => x + 1); };
// … every former setStatus(x) becomes say(x); the empty reset setStatus('') (if any) stays setStatus('')
<p className="status-line" role="status">
  {status ? <span key={statusN} className="status-line__msg">{status}</span> : null}
  {/* the existing link part, unchanged */}
</p>
```

```css
/* target — append after public/site/site.css:181 */
.status-line__msg { display: inline-block; transition: opacity 200ms var(--m-ease), transform 200ms var(--m-ease); }
@starting-style { .status-line__msg { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) {
  @starting-style { .status-line__msg { opacity: 0; transform: none; } }
}
```

`--m-ease` = `cubic-bezier(.2, .8, .2, 1)` (the repo's UI ease-out). `@starting-style` gives the entry
without JS timing; browsers without it simply show the text (today's behaviour).

## Repo conventions to follow

- Entry by `@starting-style` is already the kit's pattern: `public/assets/motion/motion.css:131-132` (the phone menu sheet: `@starting-style { … .nav.is-open .nav__links { opacity: 0; transform: translateY(-8px); } }`).
- Status lines are `<p className="status-line" role="status">` everywhere; keep that element and class.

## Steps

1. `src/components/site/AddToInquiry.tsx`:
   a. Below `const [status, setStatus] = useState('');` (line 13) add `const [statusN, setStatusN] = useState(0);` and `const say = (s: string) => { setStatus(s); setStatusN((x) => x + 1); };`.
   b. On line 30 replace `setStatus(` with `say(`.
   c. Replace `{status}` at the start of line 45 with `{status ? <span key={statusN} className="status-line__msg">{status}</span> : null}`. Keep the rest of the line (the link) exactly as is.
2. `src/components/studio/Studio.tsx`:
   a. Below `const [status, setStatus] = useState('');` (line 58) add the same `statusN` state and `say` helper.
   b. Replace every `setStatus(` call at lines 135, 142, 148, 149 and 161 with `say(`. Do not change calls that pass `''` (if any exist elsewhere) — those may stay `setStatus('')`.
   c. On line 226 replace the leading `{status}` with `{status ? <span key={statusN} className="status-line__msg">{status}</span> : null}`; keep `status.includes('inquiry list')` and the link as they are.
3. `public/site/site.css`: append the CSS block from Target right after line 181.

## Boundaries

- Do NOT change the text of any message.
- Do NOT move or remove `role="status"`.
- Do NOT touch `InquiryForm.tsx`, `CookieChoice.tsx` or `Footer.tsx` (their statuses appear once per submit and navigate away).
- No new dependencies. If the quoted lines differ, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` → no errors; `npm run build` → succeeds; `npm test` → 30 passed.
- **Feel check** (`npm run dev`):
  - open `http://localhost:3000/en/products/football/match-football`, click **Add to inquiry** three times: the confirmation rises in each time, and the "(n)" count in the link goes up;
  - DevTools → Animations at 10%: the message moves 6px up while fading in; nothing else on the page moves;
  - Rendering → `prefers-reduced-motion: reduce`: the message fades in without moving;
  - in the studio (`/en/studio`), add a design to the inquiry twice: the same replay happens;
  - screen reader / Accessibility tree: the `<p role="status">` content updates on each click.
- **Done when**: repeating either action always produces a visible confirmation.
