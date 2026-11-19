# Performance and test results

Measured on the production build (`next build` + `next start`) on the development machine (Windows 11,
CPU-rendered headless Chrome), with the tasteskill checks. Numbers on a real host behind a CDN differ;
treat Lighthouse targets (95+ on all four, LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) as targets to confirm on
staging with PageSpeed Insights (mobile and desktop).

## What keeps the pages fast

- Server-rendered HTML; the only client JavaScript is React's runtime, the design kit's small modules
  (loaded after hydration) and the islands that need it (basket, filters, map, forms, studio).
- Three.js loads only on the studio page, and only when the browser supports WebGL (dynamic import).
- The hero scroll film is a frame sequence on a canvas: the head asks for the first frame at once, the
  player loads after hydration and fetches the rest coarse to fine, six at a time, in one of three sets
  chosen by screen (lg 1920 px for 1024 px and wider, md 1280 px for high-density phones and tablets,
  sm 960 px otherwise and on data saver; 4.3 MB, 1.7 MB and 1.2 MB in all). It draws only when the
  scroll moves and pauses off screen.
  Reduced motion or a window under 600 px tall: the still photograph, one screen, no frames loaded.
- Images: pre-sized WebP in 3 to 4 widths with `srcset` and `sizes` matched to the layout; the hero is
  eager with `fetchpriority="high"`, everything else lazy and async; width and height set (no layout shift).
- One font family (Archivo, variable) from Google Fonts with `display=swap`; kit CSS cached 7 days.
- No analytics script before consent.

## Results

Filled in from the last check run (see the final report in the session for the exact gate output).

| Check | Result |
| --- | --- |
| Unit tests (Vitest) | 30 of 30 pass |
| End-to-end: buyer journey (pages, redirect, datasheet PDF, inquiry with files, validation, cross-site refusal, closed areas, 404s, sitemap) | 7 of 7 pass |
| End-to-end: staff workflow (two-factor, quotation, order, production, shipment, invoice, outbox, audit, CSV) | 1 of 1 passes |
| End-to-end: customer portal (register, email confirmation by POST, quotation, order stage, tracking, quotation and invoice PDFs, another company refused) | 1 of 1 passes |
| TypeScript strict | 0 errors |
| tasteskill gate (homepage, 1440 and 390, three rounds) | 35 FAILs in round 1, 5 in round 2, 1 open after round 3: hero-maxchars, the scroll film hero the owner asked for (three screens of scroll by design). Waivers: the same hero's pinned, hero-screen, hero-fold and empty-area findings, each marked client-directed in .taste-skill/waivers.json |
| Copy lint (homepage) | 0 FAIL, 0 WARN |
| `npm audit --omit=dev` | 0 vulnerabilities |
| copy-lint (home page) | 0 FAIL, 0 WARN |
| consistency.mjs (home page, 1440 to 320 px) | see the final report |
| check.mjs layout (1440, 1024, 820, 768, 390) | see the final report |
| perf.mjs (image weight, contexts, layout shift) | see the final report |
