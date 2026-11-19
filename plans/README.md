# Animation plans

Written 2026-11-18 by an animation audit of the whole site (no git repository, so plans carry the date
instead of a commit). Each plan is self-contained: exact files, current code, target values, steps,
boundaries and a feel check. Run one with `/improve-animations execute plans/<file>`, or hand the file to
any agent.

## Rules for every plan

- **Never edit `public/assets/**`.** That is the design kit (tasteskill); its checker flags kit edits.
  The kit's motion layer (`public/assets/motion/motion.css`) is already sound and stays as it is. Every
  change goes in `public/site/site.css` or the site's own components.
- Use the kit's motion tokens: `--m-in` 150ms, `--m-out` 120ms, `--m-press` 90ms, `--m-ease`
  `cubic-bezier(.2, .8, .2, 1)` (UI ease-out), `--m-ease-enter` `cubic-bezier(.22, 1, .36, 1)` (entrances).
  New site tokens are declared in `public/site/site.css` (`--m-swap`, `--m-film-in`, `--m-film-out`,
  `--m-zoom`, `--ease-drawer`).
- Static CSS under `public/` needs no rebuild in `npm run dev`; component changes do (`npm run build` for production).
- If the code no longer matches a plan's excerpt, stop and report rather than improvise.

## Plans

| # | Plan | Severity | Kind | Status |
| --- | --- | --- | --- | --- |
| 001 | [Give the range-index arrow one nudge, not two](001-range-arrow-single-nudge.md) | MEDIUM | fix | DONE |
| 002 | [Swap the range photo in 180ms with no darkening dip](002-range-photo-swap.md) | MEDIUM | fix | DONE |
| 003 | [Make the product-gallery zoom instant under reduced motion](003-gallery-zoom-reduced-motion.md) | MEDIUM | fix | DONE |
| 004 | [Make every "added" and "saved" confirmation visibly arrive](004-status-line-feedback.md) | MEDIUM | fix | DONE |
| 005 | [Give the gallery thumbnails hover and press feedback](005-gallery-thumb-feedback.md) | LOW | fix | DONE |
| 006 | [Crossfade the product photo when a thumbnail is picked](006-gallery-photo-crossfade.md) | LOW | fix | DONE |
| 007 | [Replace hand-typed durations and the duplicate ease with tokens](007-site-motion-tokens.md) | LOW | fix | DONE |
| 008 | [Give inner pages a short, non-blocking entrance](008-inner-page-entrance.md) | LOW | added | DONE |
| 009 | [Give the "request is in" confirmation one moment of delight](009-inquiry-sent-moment.md) | LOW | added | DONE |
| 010 | [Slide the cookie banner up from the bottom edge, and back down](010-consent-banner-sheet.md) | LOW | added | DONE |
| 011 | [Open the phone market list by height](011-market-list-disclosure-height.md) | LOW | added | DONE |

## Recommended order

1. **001, 002**: homepage range, CSS only, a few minutes each.
2. **003, 005**: product gallery CSS (accessibility, then press feedback).
3. **004**: status-line feedback (two components).
4. **006**: gallery crossfade (component and CSS). Run after 003 and 005, which touch the same rules.
5. **007**: token clean-up. Run after 001, 002 and 006, which remove or rewrite some of the lines it renames.
6. **008 → 011**: the four additions, in any order. 008 before 009 keeps the `m-` keyframe names together at the end of `site.css`.

## Dependencies

- **003 ↔ 006**: both touch the product gallery's main image. 003 has a step for the case where 006 is already done (keep the opacity fade, drop only the transform transition).
- **007 after 001, 002, 006**: 007 renames what those plans leave behind; it lists the exact lines it expects.
- **008 + 006**: 008's photo settle matches `.gallery__main img`, which also covers 006's `.gallery__img`; no change needed either way.
- All others are independent.

## Checked and left as they are

- The kit's motion layer: buttons (1px hover step, 90ms press), drawn underlines, 2px card lift, 3% photo zoom, the mega menu (150ms intent delay, instant swap between menus), the phone menu sheet, tab indicator, inputs, reduced-motion handling.
- Catalogue filters: results change instantly. They are used many times per visit, so instant is right.
- Studio colour and option picks: direct manipulation, so instant is right.
- Admin dashboard: no motion. It is a work tool used all day, so that is correct.
- The homepage scroll film and the two scroll moments (pinned chapters, picture develops): marketing scenes, so the longer durations are fine, and reduced motion is handled.

## Execution review (2026-11-18)

All eleven plans were executed in the recommended order by an executor agent. The folder has no git, so
the review is a diff against a snapshot of the 14 touched files taken before execution. Nothing under
`public/assets/` changed. Checks: typecheck clean, 30/30 unit tests, build OK, 9/9 end-to-end tests.

Measured in the browser:
- 001: on hover only the arrow head moves (3px); the arrow itself has no transform.
- 002: the new photo is 89% visible at 78ms, before the old one leaves; frame coverage never drops below 99.8%.
- 004: each repeated "Add to inquiry" creates a new message that starts at opacity 0, 6px low.
- 006: the new photo fades 0 → 1 in about 200ms over the old one, the old layer is gone by about 300ms; a cached photo still fades.
- 008: About gets heading rise (0/40ms) and photo settle; family and product pages get the photo settle only; the inquiry form none.
- 009: ring 300ms, tick 400ms from 150ms, reference wipe 500ms from 250ms; an invalid reference has no motion.
- 011: the phone list opens 44 → 464px and closes back in about 250ms.

Not exercised in a browser (code reviewed only): 003, 005 and the reduced-motion variants (this browser
pane cannot emulate `prefers-reduced-motion`), 007 (a rename), 010 (the banner needs a GA4 ID in Settings).

Notes, not blocking:
- Under reduced motion the gallery crossfade runs 300ms instead of 200ms (the reduced-motion rule keeps
  only `opacity`, which then takes the first duration in the list). It is opacity only.
- The thumbnail press uses the kit's `--m-press` (90ms), a little under the 100–160ms press range, to
  match every other button on the site.
