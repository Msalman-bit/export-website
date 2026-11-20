# 016 — Open the phone menu's sub-lists by height instead of jumping open

- **Status**: DONE (2026-11-20, reviewed)
- **Commit**: 97baed5
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (a state change that teleports)
- **Estimated scope**: 1 CSS file, ~12 lines

## Problem

In the phone menu sheet (screens up to 1023px), a top-level item with a sub-list (Products, Manufacturing,
Resources, About) has a chevron button (`.nav__expand`). Tapping it shows the sub-list in one frame: measured at
375 × 812, opening Products grows the sheet's content from 756px to 1740px at once, pushing every item below
almost a full screen down. Only the chevron turns (180ms). Closing snaps back the same way.

```css
/* public/assets/system.css:735-741 — current (the design kit, inside @media (max-width: 1023px)) */
.nav__expand svg { width: 16px; height: 16px; transition: transform var(--dur) var(--ease); }
.nav__item.is-expanded .nav__expand svg { transform: rotate(180deg); }
.nav.is-open .nav__menu {
  position: static; grid-column: 1 / -1; display: none; opacity: 1; visibility: visible; transform: none;
  box-shadow: none; border: 0; padding: 0 0 var(--s-4);
}
.nav.is-open .nav__item.is-expanded .nav__menu { display: block; }
```

The kit's script toggles `.is-expanded` on the `.nav__item` (`public/assets/system.js`, `nav()`, the
`btn.addEventListener('click', …)` handler).

## Target

The sub-list opens and closes by animating its height (and its 16px bottom padding) over 250ms with the kit's UI
ease-out, and the chevron turns over the same 250ms so they move as one. Height is the documented exception for
disclosures. This is a progressive enhancement, exactly like the market list (plan 011): where `interpolate-size`
is not supported (Safari, Firefox today), the list opens at once, as now. A closed sub-list still ends at
`display: none`, so its links are never focusable while hidden. Reduced motion: no height animation.

```css
/* target — public/site/site.css, at the end of the file (site rules override the kit's, which load first) */
/* the phone menu's sub-lists open by height, the chevron turning with them; closed, a list still ends at
   display: none (its links leave the tab order); where interpolate-size is unsupported it opens at once */
@media (max-width: 1023px) {
  .nav.is-open .nav__menu { interpolate-size: allow-keywords; overflow: clip; height: 0; padding-block-end: 0;
    transition: height 250ms var(--m-ease, ease-out), padding-block-end 250ms var(--m-ease, ease-out), display 250ms allow-discrete; }
  .nav.is-open .nav__item.is-expanded .nav__menu { height: auto; padding-block-end: var(--s-4); }
  @starting-style { .nav.is-open .nav__item.is-expanded .nav__menu { height: 0; padding-block-end: 0; } }
  .nav__expand svg { transition-duration: 250ms; }
}
@media (max-width: 1023px) and (prefers-reduced-motion: reduce) {
  .nav.is-open .nav__menu { transition: none; }
}
```

Values: 250ms with `--m-ease` (`cubic-bezier(.2, .8, .2, 1)`, `public/assets/motion/motion.css:26`), the same as the
market list (`public/site/site.css:546-550`); 250ms is the top of the AUDIT budget for dropdown-like disclosures.
`var(--s-4)` is the kit's 16px padding the expanded list already has.

## Repo conventions to follow

- Exemplar to imitate: the market list (`public/site/site.css:546-550`), which opens by `block-size` with
  `interpolate-size: allow-keywords`, 250ms `var(--m-ease)`, a discrete property carried with `allow-discrete`, and a
  reduced-motion rule that drops the transition.
- Override the kit from `site.css`; never edit `public/assets/**`.

## Steps

1. Append the Target block (comment included) to the end of `public/site/site.css`.
2. Make no other change.

## Boundaries

- CSS only, in `public/site/site.css`. Do NOT edit `public/assets/system.css` or `system.js`.
- Everything stays inside `@media (max-width: 1023px)`: the desktop mega menu (hover panels) must not change.
- Do NOT change how the whole sheet opens and closes (`.nav.is-open`, `.nav.is-closing` rules from the Apple design
  pass, and plan 012).
- If the kit rules no longer match the excerpt, STOP and report.

## Verification

- **Mechanical**: none (static CSS).
- **Feel check**: `npm run dev` in Chrome 129 or newer, DevTools device emulation 390 × 844, open
  `http://localhost:3000/en`, tap the menu button:
  - tap the chevron beside Products: the ten families grow open over a quarter of a second and the items below slide
    down with them, the chevron turning at the same pace;
  - tap it again: the list closes smoothly and the items below slide back up;
  - tap twice quickly: it reverses mid-way without jumping;
  - with a list closed, press Tab through the sheet: focus never lands on a hidden family link;
  - Rendering → `prefers-reduced-motion: reduce`: the list opens and closes at once;
  - desktop width (1440): hovering Products still opens the full-width panel exactly as before;
  - Safari or Firefox: the list opens and closes at once, as today.
- **Done when**: in Chrome the sheet's content height moves over about 250ms when a sub-list is toggled, and the
  desktop header is unchanged.
