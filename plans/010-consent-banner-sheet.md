# 010 — Slide the cookie banner up from the bottom edge, and back down

- **Status**: DONE (2026-11-18, reviewed)
- **Commit**: no git repository (plan written 2026-11-18)
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (spatially connected UI that teleports)
- **Estimated scope**: 1 component + 1 CSS file, ~20 lines

## Problem

When Google Analytics is configured (Admin → Settings → Analytics, GA4 ID), first-time visitors get a
cookie banner fixed to the bottom of the screen. It appears in the first frame with no motion, at the same
moment the homepage hero runs its entrance, and vanishes instantly when a choice is made. It is a sheet
attached to the bottom edge, but nothing shows that.

```tsx
// src/components/site/ConsentBanner.tsx:6-15 — current
export function ConsentBanner({ locale, decided }: { locale: string; decided: boolean }) {
  const [open, setOpen] = useState(!decided);
  if (!open) return null;
  const choose = async (choice: 'analytics' | 'essential') => {
    await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
    setOpen(false);
    if (choice === 'analytics') location.reload();
  };
  return (
    <section className="consent" aria-label="Cookie choice">
```

```css
/* public/site/site.css:110 — current */
.consent { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; background: var(--bg); border-top: 1px solid var(--line); padding: var(--s-4) 0; }
```

## Target

- **Enter**: the banner slides up from fully below the edge (`translateY(100%)`, its own height) over
  400ms with the drawer curve `cubic-bezier(0.32, 0.72, 0, 1)`. It waits 500ms after load so the page's
  own entrance reads first.
- **Exit** ("Keep analytics off"): it slides back down over 200ms with `var(--m-ease)`
  (`cubic-bezier(.2, .8, .2, 1)`), then unmounts. "Allow analytics" reloads the page as today, so no exit is needed.
- **Reduced motion**: opacity only (fade in 200ms, fade out 200ms), no travel.
- It is a transition, so a choice made while it is still sliding in reverses smoothly.

```tsx
// target — ConsentBanner body
export function ConsentBanner({ locale, decided }: { locale: string; decided: boolean }) {
  const [open, setOpen] = useState(!decided);
  const [closing, setClosing] = useState(false);
  if (!open) return null;
  const choose = async (choice: 'analytics' | 'essential') => {
    await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
    if (choice === 'analytics') { location.reload(); return; }
    setClosing(true);                         // slides down (200ms), then leaves the page
    setTimeout(() => setOpen(false), 220);
  };
  return (
    <section className={`consent${closing ? ' is-closing' : ''}`} aria-label="Cookie choice">
      {/* children unchanged */}
```

```css
/* target — replace public/site/site.css:110 with these lines */
:root { --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1); } /* a sheet sliding in from a screen edge */
.consent { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; background: var(--bg); border-top: 1px solid var(--line); padding: var(--s-4) 0;
  transition: transform 400ms var(--ease-drawer) 500ms; }
@starting-style { .consent { transform: translateY(100%); } }
.consent.is-closing { transform: translateY(100%); transition: transform 200ms var(--m-ease); }
@media (prefers-reduced-motion: reduce) {
  .consent { transition: opacity 200ms var(--m-ease) 500ms; }
  @starting-style { .consent { transform: none; opacity: 0; } }
  .consent.is-closing { transform: none; opacity: 0; transition: opacity 200ms var(--m-ease); }
}
```

## Repo conventions to follow

- Entry by `@starting-style`: the kit's phone menu sheet, `public/assets/motion/motion.css:131-132`.
- Site tokens are declared in `public/site/site.css` (`:root { --… }`), never in `public/assets/`.
- `--m-ease` is the UI ease-out (`motion.css:26`).

## Steps

1. `src/components/site/ConsentBanner.tsx`: add `const [closing, setClosing] = useState(false);` under the `open` state; rewrite `choose` as in Target; change `className="consent"` to the Target className expression. Leave the paragraph and both buttons unchanged.
2. `public/site/site.css`: replace line 110 with the Target CSS block. Leave `.consent__row` (111) and `.consent__row p` (112) unchanged.

## Boundaries

- Do NOT change the consent logic, the cookie, the API call, or the button labels.
- Do NOT touch the GA scripts in `src/app/(site)/[locale]/layout.tsx`.
- Do NOT touch `public/assets/**`.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` → no errors; `npm run build` → succeeds.
- **Setup**: the banner only renders with a GA4 ID set. Start the site (`npm run dev`), sign in to `http://localhost:3000/admin` (the credentials are `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env.local`), go to Settings and enter a placeholder GA4 ID such as `G-TEST000000`. Open `http://localhost:3000/en` in a private window (no consent cookie). **Remove the ID again when you are done.**
- **Feel check**:
  - on load the hero enters first; about half a second later the banner slides up from the bottom edge and settles without overshoot;
  - click "Keep analytics off": it slides down quickly and is gone (Elements panel: the `section.consent` is removed);
  - DevTools → Animations at 10%: the entry starts fast and eases into place; the exit is shorter than the entry;
  - Rendering → `prefers-reduced-motion: reduce`: it fades in and out with no movement;
  - do not test "Allow analytics" with a real ID; with the placeholder it reloads the page as before.
- **Done when**: the banner enters from and leaves to the bottom edge, and the GA4 placeholder is removed from Settings.
