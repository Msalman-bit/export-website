# 014 — Give the phone menu button a press, and turn its icon in

- **Status**: DONE (2026-11-20, reviewed)
- **Commit**: 97baed5
- **Severity**: LOW
- **Category**: Physicality & origin (press feedback)
- **Estimated scope**: 1 CSS file, ~10 lines

## Problem

The menu button (`.nav__toggle`, the 44px square at the top right on any screen up to 1023px wide) is the one
control every phone visitor uses, and it has no press response at all: no rule in the kit's motion layer or the
site covers it. Its icon changes from two bars to a cross (and back) in a single frame, because the kit's script
replaces the button's SVG:

```css
/* public/assets/system.css:719-722 — current (inside @media (max-width: 1023px)) */
.nav__toggle {
  display: inline-grid; place-items: center; margin-left: auto; width: 44px; height: 44px; border-radius: var(--r-btn);
  border: 1px solid var(--line-strong); background: transparent; color: var(--ink); cursor: pointer; flex: none;
}
```

```js
// public/assets/system.js:76-90 — current (excerpt)
const bars = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">…</svg>';
const cross = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">…</svg>';
// in setOpen():
if (toggle) { toggle.setAttribute('aria-expanded', String(open)); toggle.innerHTML = open ? cross : bars; }
```

Every other pressable control on the site dips when pressed (buttons `scale(.985)`, `motion.css:47`; gallery
thumbnails `scale(.97)`, `site.css:192`; swatches `scale(.95)`, `site.css:665`).

## Target

- **Press**: the button shrinks to 95% while pressed, 90ms with the kit's UI ease-out, and springs back the same way.
  95% (the low end of the 95-98% press range) suits a small 44px icon button, like the swatches.
- **Icon**: the new icon turns in from 45° and 90% size while fading in, 200ms with the same ease-out, each time the
  menu opens or closes. No script change is needed: the script inserts a fresh `<svg>` on every toggle, and
  `@starting-style` animates a newly inserted element. It is scoped to `.nav.is-open`, which is present both when the
  cross goes in (opening) and when the bars go in (closing: `.is-open` stays on during the 140ms close, with
  `.is-closing` added), and absent at page load, so the bars do not animate when a page loads.
- **Reduced motion**: no press movement; the icon only fades.

```css
/* target — public/site/site.css, at the end of the file */
/* the phone menu button: a press like every other control, and its icon (a new <svg> from system.js on every
   toggle) turns in instead of swapping in one frame; at page load the icon is left alone (.is-open is absent) */
@media (max-width: 1023px) {
  .nav__toggle { transition: transform var(--m-press, 90ms) var(--m-ease, ease-out); }
  .nav__toggle:active { transform: scale(.95); }
  .nav__toggle svg { transition: opacity 200ms var(--m-ease, ease-out), transform 200ms var(--m-ease, ease-out); }
  @starting-style { .nav.is-open .nav__toggle svg { opacity: 0; transform: rotate(-45deg) scale(.9); } }
}
@media (max-width: 1023px) and (prefers-reduced-motion: reduce) {
  .nav__toggle:active { transform: none; }
  @starting-style { .nav.is-open .nav__toggle svg { opacity: 0; transform: none; } }
}
```

Values: `--m-press` 90ms and `--m-ease` `cubic-bezier(.2, .8, .2, 1)` (`public/assets/motion/motion.css:20, 26`);
scale .95 per the AUDIT press range (0.95-0.98); entrance from `scale(.9)` + `opacity: 0` (never from 0).

## Repo conventions to follow

- Press feedback exemplar: `.swatch { transition: … transform var(--m-press) var(--m-ease); } .swatch:active
  { transform: scale(.95); }` (`public/site/site.css:662-665`), with the reduced-motion override removing the
  transform (`site.css:193` for the gallery thumbnails).
- Insertion entrances use `@starting-style` (exemplar: `.status-line__msg`, `site.css:206-210`).

## Steps

1. Append the Target block (comment included) to the end of `public/site/site.css`.
2. Make no other change.

## Boundaries

- CSS only. Do NOT edit `public/assets/system.js` or `system.css` (the design kit); the icon swap stays in the kit.
- Do NOT add a press to `.nav__expand` (the sub-list chevrons; plan 016 handles those lists).
- If `system.js` no longer replaces the toggle's `innerHTML` on each toggle, STOP and report: the icon part of this
  plan depends on it.

## Verification

- **Mechanical**: none (static CSS).
- **Feel check**: `npm run dev`, DevTools device emulation 390 × 844, open `http://localhost:3000/en`:
  - press and hold the menu button: it visibly dips; release: it comes back;
  - tap it: the cross turns in as the sheet opens; tap again: the bars turn in as it closes;
  - reload the page: the bars are simply there, with no fade or turn;
  - DevTools → Animations at 10%: the icon's transition runs 200ms from 45° and 90% to upright and full size;
  - Rendering → `prefers-reduced-motion: reduce`: no dip, the icon only fades.
- **Done when**: the button has an `:active` transform, the icon animates on every toggle, and not on page load.
