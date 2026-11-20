# 015 — Use the kit's easing token for the admin button press

- **Status**: DONE (2026-11-20, reviewed)
- **Commit**: 97baed5
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 CSS file, 1 line

## Problem

The admin's button press (added in commit 97baed5) types out the kit's UI curve by hand:

```css
/* public/site/admin.css:71-76 — current */
/* a press answers at once (the public site's motion layer is not loaded here): buttons dip 1.5% for 90ms;
   under reduced motion they only darken */
.btn { transition: transform 90ms cubic-bezier(.2, .8, .2, 1), background-color 120ms ease, border-color 120ms ease; }
.btn:active { transform: scale(.985); }
.btn--primary:active { background: color-mix(in oklab, var(--action) 80%, var(--bg)); }
@media (prefers-reduced-motion: reduce) { .btn:active { transform: none; } }
```

`cubic-bezier(.2, .8, .2, 1)` is the kit's `--ease`, declared in `public/assets/system.css:92`
(`--ease: cubic-bezier(.2, .8, .2, 1);`), which the admin does load (`src/app/(admin)/admin/layout.tsx` links
`/assets/system.css`). A hand-typed copy drifts the day the kit's curve is tuned. The admin does not load the
motion layer (`motion.css`), so `--m-press` and `--m-ease` are not available there; `--ease` is.

## Target

```css
/* target — public/site/admin.css:73 */
.btn { transition: transform 90ms var(--ease), background-color 120ms ease, border-color 120ms ease; }
```

Keep `90ms` as a number (it is the kit's `--m-press`, which the admin does not load) and keep the colour changes on
plain `ease` (hover and colour changes take `ease`, AUDIT category 2).

## Repo conventions to follow

- The kit's own rules use `var(--ease)` for UI motion, e.g. `.nav__expand svg { transition: transform var(--dur)
  var(--ease); }` (`public/assets/system.css:735`).

## Steps

1. In `public/site/admin.css`, replace `transform 90ms cubic-bezier(.2, .8, .2, 1)` with `transform 90ms var(--ease)`
   on the `.btn { transition: … }` line (around line 73).
2. Make no other change.

## Boundaries

- One line in `public/site/admin.css`. Do NOT load `motion.css` in the admin (the admin is a work tool with no
  motion beyond the press; that is deliberate).
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: `grep -n "cubic-bezier" public/site/admin.css` prints nothing.
- **Feel check**: `npm run dev`, sign in to `http://localhost:3000/admin`, press and hold any button: it still dips
  to 98.5% and comes back in 90ms; in DevTools → Elements → Computed, `transition-timing-function` on a `.btn` reads
  `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Done when**: the press looks exactly as before and the curve comes from `--ease`.
