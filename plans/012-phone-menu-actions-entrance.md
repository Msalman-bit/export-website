# 012 — Bring the phone menu's bottom buttons in with the list, instead of jumping

- **Status**: DONE (2026-11-20, reviewed)
- **Commit**: 97baed5
- **Severity**: MEDIUM
- **Category**: Physicality & origin (spatial consistency)
- **Estimated scope**: 1 CSS file, ~8 lines

## Problem

On a phone (any width up to 1023px), the menu button opens a full-screen sheet: the page links fade in and drop
8px out of the bar, but the action buttons at the bottom of the sheet ("Request a quote" and the sign-in link)
jump there in a single frame at full opacity. Measured at 375 × 812: closed, `.nav__actions` sits in the top bar
(`top: 6px`, `display: flex`); open, it is at `top: 675px` (`display: grid`) with `opacity: 1` at +0ms, +50ms and
+350ms. So half of the sheet glides in and the other half teleports.

The cause: the sheet's entrance uses `@starting-style`, which only runs when an element goes from
`display: none` to shown. The page links do (`display: none` → `flex`), the actions never do: when the menu is
closed they are already shown in the bar (the main button stays in the bar on phones), so their
`@starting-style` never fires.

```css
/* public/site/site.css:760-775 — current */
/* the phone menu sheet comes down out of the bar and goes back up into it (system.js holds .is-closing for 140ms
   before taking it away); the links drop 8px, the actions rise 8px from the bottom; scrolling the sheet never
   carries on into the page under it */
@media (max-width: 1023px) {
  .nav.is-open :is(.nav__links, .nav__actions) {
    overscroll-behavior: contain;
    transition: opacity var(--m-panel, 200ms) var(--m-ease, ease-out), transform var(--m-panel, 200ms) var(--m-ease, ease-out);
  }
  @starting-style {
    .nav.is-open .nav__links { opacity: 0; transform: translateY(-8px); }
    .nav.is-open .nav__actions { opacity: 0; transform: translateY(8px); }
  }
  .nav.is-closing .nav__links { opacity: 0; transform: translateY(-8px); }
  .nav.is-closing .nav__actions { opacity: 0; transform: translateY(8px); }
  .nav.is-closing :is(.nav__links, .nav__actions) { transition-duration: var(--m-close, 120ms); pointer-events: none; }
}
/* reduced motion: the sheet fades in and out where it stands */
@media (max-width: 1023px) and (prefers-reduced-motion: reduce) {
  @starting-style { .nav.is-open :is(.nav__links, .nav__actions) { transform: none; } }
  .nav.is-closing :is(.nav__links, .nav__actions) { transform: none; }
}
```

The closing half already works for the actions (they fade and sink 8px over 120ms via `.is-closing`); only the
opening is missing.

## Target

When the sheet opens, the actions panel rises 8px from the bottom edge and fades in over 200ms with the kit's UI
ease-out, at the same moment the links drop in. Under reduced motion it only fades. The closing transition stays
exactly as it is.

A keyframe animation is right here, not a transition: it runs when `.is-open` starts to match, whether or not the
element was hidden before. It is not a problem for interruption: `.is-open` stays on the nav while the sheet is
closing (only `.is-closing` is added and removed), so a tap that reopens the sheet mid-close does not restart the
animation; the existing transition carries the actions back from wherever they are. Transitions also win over
animations in the cascade, so the closing transition still applies after this animation has run.

```css
/* target — inside the existing @media (max-width: 1023px) block, replacing its @starting-style rule */
  @starting-style {
    .nav.is-open .nav__links { opacity: 0; transform: translateY(-8px); }
  }
  /* the actions are already shown in the bar when the sheet is closed, so @starting-style never runs for them:
     a one-time entrance from the bottom edge instead */
  .nav.is-open .nav__actions { animation: m-sheet-rise var(--m-panel, 200ms) var(--m-ease, ease-out); }

/* target — inside the existing reduced-motion block */
  .nav.is-open .nav__actions { animation-name: m-sheet-fade; }

/* target — after both blocks */
@keyframes m-sheet-rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes m-sheet-fade { from { opacity: 0; } }
```

Values: 200ms = `--m-panel` ("a menu or sheet opening", `public/assets/motion/motion.css:21`); curve `--m-ease` =
`cubic-bezier(.2, .8, .2, 1)` (`motion.css:26`), the kit's one UI ease-out. No fill mode: when the animation ends,
the element simply shows its normal styles.

## Repo conventions to follow

- Keyframe names in `site.css` start with `m-` and sit next to the rules that use them (exemplar:
  `@keyframes m-page-rise` / `m-page-fade`, `public/site/site.css:600-602`, with the reduced-motion variant swapping
  the name, `site.css:597-599`).
- Motion tokens come from the kit with a fallback, as the surrounding rules already write them:
  `var(--m-panel, 200ms) var(--m-ease, ease-out)`.

## Steps

1. In `public/site/site.css`, in the block that starts `@media (max-width: 1023px) {` right after the comment
   "the phone menu sheet comes down out of the bar…" (around line 763), replace the `@starting-style { … }` rule
   (two lines inside it) with the one-line version that keeps only `.nav.is-open .nav__links`, followed by the
   comment and the `.nav.is-open .nav__actions { animation: … }` line, exactly as in Target.
2. In the block `@media (max-width: 1023px) and (prefers-reduced-motion: reduce) {` directly below (around line
   777), add the line `.nav.is-open .nav__actions { animation-name: m-sheet-fade; }` after its existing two lines.
3. Directly after that reduced-motion block's closing `}`, add the two `@keyframes` lines from Target.
4. Make no other change.

## Boundaries

- CSS only, in `public/site/site.css`. Do NOT touch `public/assets/**` (the design kit) or `system.js`.
- Do NOT change the closing rules (`.nav.is-closing …`) or the links' entrance.
- Do NOT change the desktop header (everything here is inside `max-width: 1023px`).
- If the block does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (static CSS). Reload with the cache bypassed (DevTools open, "Disable cache"), since
  `/site/site.css` is served `max-age=0` but a stale tab may hold the old file.
- **Feel check**: `npm run dev`, DevTools device emulation 390 × 844, open `http://localhost:3000/en`:
  - tap the menu button: the links drop from the bar and the buttons rise from the bottom edge at the same time,
    both fading in; nothing appears at full strength in the first frame;
  - tap again: both halves leave the way they came (links up, buttons down), faster than they came;
  - tap open, close and open again quickly: the buttons never blink to invisible and back; they turn around from
    where they are;
  - DevTools → Animations at 10%: the actions panel shows one `m-sheet-rise` animation of 200ms on opening and
    none on closing;
  - Rendering → `prefers-reduced-motion: reduce`: the panel fades in where it stands, with no movement.
- **Done when**: on opening, `getComputedStyle(document.querySelector('.nav__actions')).opacity` is below 1 at
  +50ms and 1 by +250ms, and closing behaves exactly as before.
