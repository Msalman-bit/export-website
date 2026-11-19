# Accessibility report (target: WCAG 2.2 AA)

How the site was built and checked, and what is still open. The home page is checked automatically by the
tasteskill checker (`consistency.mjs`: names, alt text, labels, heading order, tab order, focus, contrast,
tap size, reduced motion, scripts off) at 1440, 1024, 820, 768, 390 and 320 px; results in
docs/PERFORMANCE.md.

| Criterion | How it is met |
| --- | --- |
| 1.1.1 Non-text content | Every content picture has alt text saying what it shows; decorative ones `alt=""`; the export map is `role="img"` with a label and an accessible list beside it; the 3D ball is `aria-hidden` and every choice in the studio is a form control |
| 1.3.1 Info and relationships | Landmarks (`header`, `nav` with labels, `main`, `footer`), one h1, headings in order, lists and tables for specifications and data, `dl` for the market regions |
| 1.4.3 / 1.4.11 Contrast | Ink #080808 on white 19.9:1; muted text 5.4:1; white on obsidian 19.9:1; lime only on obsidian (16:1), never as text on white; focus ring 2px in the action colour |
| 1.4.4 / 1.4.10 Resize and reflow | Fluid type with `clamp()`, one column from 639 px, no sideways scroll at 320 px (checked) |
| 1.4.12 Text spacing | No fixed heights on text containers; text sizes 16 px and up for reading |
| 2.1.1 Keyboard | Every control is a native link, button or field; menus open on focus; the gallery zoom and 360 view answer Enter, Space, Escape and the arrow keys |
| 2.4.1 Skip link | "Skip to content" is the first stop, shown on focus over the logo |
| 2.4.3 / 2.4.7 Focus order and visibility | Reading order; no positive `tabindex`; the kit's focus ring shows at once and never sits under the fixed header (scroll-padding) |
| 2.4.11 Focus not obscured (2.2) | The fixed header leaves room; the cookie banner (only with analytics) does not cover focused fields |
| 2.5.8 Target size (2.2) | Controls 44 px; the market names grow to 44 px on touch screens |
| 2.3.3 / 2.2.2 Motion | Under `prefers-reduced-motion` the hero stands, the moments show their finished state, the ball stops turning; the film plays only on a click, with controls and no sound |
| 3.1.1 / 3.1.2 Language | `<html lang>` per URL; English copy inside a translated page is marked `lang="en"` |
| 3.3.1 / 3.3.3 Errors | Errors under their field, linked by `aria-describedby`, `aria-invalid`, written as what to type; the first wrong field takes the focus; a status line announces sending and the result |
| 3.3.2 Labels | Every field has a visible label; hints in brackets; no placeholder as a label |
| 3.3.8 Accessible authentication (2.2) | Passwords can be pasted and filled by a manager; the second factor accepts typed or pasted codes |
| 4.1.2 Name, role, value | Native elements; toggles use `aria-pressed`; the menu button reports `aria-expanded` |

## Known limits and next checks

- The 3D studio view cannot be described in full to a screen reader; the same design is available as
  controls and the 2D view (stated on the Accessibility page).
- Generated product pictures carry descriptive alt text; when real photographs replace them, write new alt
  text for each (Admin > Products > picture "What it shows").
- Before launch: a manual pass with NVDA (Windows) and VoiceOver (iOS) through the inquiry and the portal,
  and a keyboard-only pass through the admin.
