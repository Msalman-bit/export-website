# 007 — Replace hand-typed durations and the duplicate ease in site.css with tokens

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, ~10 lines

## Problem

The kit's motion tokens (`--m-in`, `--m-out`, `--m-ease` …, `public/assets/motion/motion.css:17-31`) are
the vocabulary everywhere else, but `public/site/site.css` mixes in raw durations and two spellings of the
same curve (`var(--ease)`, `var(--ease, ease)` and `var(--m-ease)` are all `cubic-bezier(.2, .8, .2, 1)`).

```css
/* public/site/site.css — current */
:90   .export__map path { … transition: fill var(--m-in, 150ms) var(--ease); }
:164  .gallery__main img { … transition: transform 300ms var(--ease); … }
:356  .hero-scene canvas { … opacity: 0; transition: opacity 900ms var(--ease, ease); }
:358  .hero__media > picture { transition: opacity 700ms var(--ease, ease); }
:366  (.hero-stages a) … transition: color var(--m-in, 150ms) var(--ease); }
:367  .hero-stages a::before { … transition: background-color var(--m-in, 150ms) var(--ease); }
:439  .range-index__line { … transition: color var(--m-in, 150ms) var(--ease); }
:499  .export__more > summary::after { … transition: transform var(--m-in, 150ms) var(--ease); }
```

(Line 418's `320ms` is handled by plan 002; line 440's transition is removed by plan 001.)

## Target

One token block for the site's own durations, and `var(--m-ease)` as the only spelling of the UI curve.
No value changes: every animation keeps its current duration and curve.

```css
/* target — add once, directly above the hero block that starts "/* ---------- the scroll hero (html.hero-seq" */
:root {
  --m-film-in: 900ms;   /* the scroll film's canvas fading in over the still (marketing, longer by design) */
  --m-film-out: 700ms;  /* the still photograph handing over to the film */
  --m-zoom: 300ms;      /* the product photo zooming to 2x and back */
}
```

Replacements:
- `:164` → `transition: transform var(--m-zoom) var(--m-ease);`
- `:356` → `transition: opacity var(--m-film-in) var(--m-ease);`
- `:358` → `transition: opacity var(--m-film-out) var(--m-ease);`
- `:90, :366, :367, :439, :499` → keep `var(--m-in, 150ms)`, change `var(--ease)` to `var(--m-ease)`.

## Repo conventions to follow

- Token naming and comment style: `public/assets/motion/motion.css:17-31` (`--m-*`, one line each, a short comment on what moves).
- Site tokens go in `public/site/site.css`, never in `public/assets/`.

## Steps

1. In `public/site/site.css`, find the comment line beginning `/* ---------- the scroll hero (html.hero-seq` and insert the Target `:root { … }` block immediately above it.
2. Make the eight replacements listed in Target, on the lines quoted in Problem. Search by the quoted text if line numbers have shifted.
3. Search the file for any remaining `var(--ease` inside a `transition` and change it to `var(--m-ease)`; do not touch `var(--ease)` used outside transitions (there should be none).

## Boundaries

- Do NOT change any duration or curve value; this is a rename only.
- Do NOT touch `public/assets/**`.
- If plan 002 or 006 has been executed, leave their `--m-swap` / `.gallery__img` rules as they are (they already use `--m-ease`); in plan 006's `.gallery__main .gallery__img` rule, change `300ms var(--ease)` to `var(--m-zoom) var(--m-ease)` too.

## Verification

- **Mechanical**: `grep -n "transition[^;]*var(--ease" public/site/site.css` → no output; `grep -nE "transition[^;]*[0-9]{3}ms" public/site/site.css` → only lines that plans 002/004/005/006 intentionally wrote with literal values (none expected if those plans use tokens).
- **Feel check**: `npm run dev`, open `http://localhost:3000/en`: the film still fades in over the still photo at the same pace; on a product page the zoom feels identical. Nothing should look different.
- **Done when**: the greps pass and no motion changed.
