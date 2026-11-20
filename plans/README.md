# Animation plans

Plans 001-011 were written 2026-11-18 by an animation audit of the whole site (no git repository then, so
they carry the date). Plans 012-017 were written 2026-11-20 by a second whole-site audit, at commit 97baed5.
Each plan is self-contained: exact files, current code, target values, steps, boundaries and a feel check.
Run one with `/improve-animations execute plans/<file>`, or hand the file to any agent.

## Rules for every plan

- **Never edit `public/assets/**`.** That is the design kit (tasteskill); its checker flags kit edits.
  The kit's motion layer (`public/assets/motion/motion.css`) is already sound and stays as it is. Every
  change goes in `public/site/site.css` or the site's own components.
  - **Recorded exception (commit 97baed5, the Apple design pass, not an animation plan):** two kit files were
    edited deliberately. `public/assets/system.css` sets the type scale in rem (identical at the default text
    size, larger with a visitor's own text setting), and `public/assets/system.js` holds the phone menu sheet's
    `.is-closing` class for 140ms so it can leave the way it came. Their links carry `?v=${KIT_VERSION}`
    (`src/lib/kit-version.ts`): raise that value whenever either file changes, because `/assets` is cached for a
    week. The plans below still never edit the kit.
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
| 012 | [Bring the phone menu's bottom buttons in with the list, instead of jumping](012-phone-menu-actions-entrance.md) | MEDIUM | fix | DONE |
| 013 | [Let a field's error line open, instead of shoving the next field down](013-field-error-open.md) | MEDIUM | fix | DONE |
| 014 | [Give the phone menu button a press, and turn its icon in](014-menu-button-press-and-icon.md) | LOW | fix | DONE |
| 015 | [Use the kit's easing token for the admin button press](015-admin-press-token.md) | LOW | fix | DONE |
| 016 | [Open the phone menu's sub-lists by height instead of jumping open](016-phone-submenu-height.md) | LOW | added | DONE |
| 017 | [Fade and close up a product row when it is removed from the inquiry](017-inquiry-row-remove.md) | LOW | added | DONE |

## Recommended order

1. **001, 002**: homepage range, CSS only, a few minutes each.
2. **003, 005**: product gallery CSS (accessibility, then press feedback).
3. **004**: status-line feedback (two components).
4. **006**: gallery crossfade (component and CSS). Run after 003 and 005, which touch the same rules.
5. **007**: token clean-up. Run after 001, 002 and 006, which remove or rewrite some of the lines it renames.
6. **008 → 011**: the four additions, in any order. 008 before 009 keeps the `m-` keyframe names together at the end of `site.css`.

Second audit (2026-11-20), all TODO:

7. **012, 014**: the phone menu, CSS only, a few minutes each. 012 first: it is the more visible fix.
8. **013**: form error lines, CSS only.
9. **015**: one-line admin token swap.
10. **016**: phone sub-lists, CSS only. Run after 012 and 014 so the whole phone menu is checked in one sitting.
11. **017**: inquiry row removal, the only one with a component change (needs `npx tsc --noEmit -p .`).

## Dependencies

- **003 ↔ 006**: both touch the product gallery's main image. 003 has a step for the case where 006 is already done (keep the opacity fade, drop only the transform transition).
- **007 after 001, 002, 006**: 007 renames what those plans leave behind; it lists the exact lines it expects.
- **008 + 006**: 008's photo settle matches `.gallery__main img`, which also covers 006's `.gallery__img`; no change needed either way.
- **012, 014, 016**: all three add rules for the phone menu to the end of `public/site/site.css`; they touch different
  selectors (`.nav__actions`, `.nav__toggle`, `.nav__menu`) and can run in any order. 012 edits the existing
  "phone menu sheet" block from the Apple design pass; 014 and 016 append new blocks after it.
- **013 and 017** both add rules near `.err` / `.basket` (`site.css` around lines 230-232); if both run, apply 013
  first and find 017's anchor line (`.basket > li { display: grid;`) by its text, not its number.
- All others are independent.

## Checked and left as they are

- The kit's motion layer: buttons (1px hover step, 90ms press), drawn underlines, 2px card lift, 3% photo zoom, the mega menu (150ms intent delay, instant swap between menus), tab indicator, inputs, reduced-motion handling.
- The phone menu sheet now drops out of the bar and goes back up into it (Apple design pass, 97baed5): 200ms in,
  120ms out, interruptible, fade-only under reduced motion. Its one gap (the bottom buttons) is plan 012.
- The hero's chapter text (2026-11-20 audit): transitions rather than keyframes, so a fast scroll retargets; the
  chapter boundaries have a margin so a resting scroll never flickers; the long word-by-word arrival is a marketing
  scene. The scroll film follows the scroll with an exponential catch-up (time constant about 110ms,
  `hero-sequence.ts`) that hides the jumps of a mouse wheel; left as it is.
- The product gallery's touch zoom, 1:1 pan and 360 flick, and the studio ball pausing while held (Apple design
  pass): checked in the browser, right as they are.
- The logo mark's 460ms quarter turn on hover is documented as a rare, small delight (`site.css`, "the mark"); left.
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

## Execution review (2026-11-20, plans 012-017)

An executor agent applied the six plans in an isolated git worktree; none had drifted from its excerpt. The diff
(3 files: `public/site/site.css`, `public/site/admin.css`, `src/components/site/InquiryForm.tsx`; nothing under
`public/assets/`) was reviewed against the animation standards and approved, then applied to the working copy.
Checks: typecheck clean, 38/38 unit tests.

Checked in the browser at 375 × 812 (the pane was hidden, so frames did not advance: each animation was read through
`getAnimations()` and finished to check its end state, instead of being timed):
- 012: opening creates `m-sheet-rise`, 200ms `cubic-bezier(0.2, 0.8, 0.2, 1)`, from opacity 0 and 8px down to 1 and
  none; closing still runs the 120ms transitions.
- 014: no animation on the icon at page load; on opening and on closing the new icon transitions opacity and transform
  over 200ms to 1 and none. The `:active` press rule is loaded.
- 016: expanding Products animates height 0 → 1175px and padding to 16px over 250ms; collapsing animates back and ends
  at `display: none`.
- 013: an error line starts at height 0, margin -8px, opacity 0 and ends at its natural height (43px), 0, 1 over 200ms.
- 017: Remove marks the row `is-leaving` (height and padding 200ms, opacity and border 150ms); the stored basket keeps
  the product until the row has closed, then both drop it together; a double click removes it once.
- 015: the served `admin.css` uses `90ms var(--ease)`; no `cubic-bezier` left in it.

Not exercised: real-time feel at full speed (pane hidden) and Safari/Firefox (where 013, 016 and 017 fall back to
the change happening at once by design).
