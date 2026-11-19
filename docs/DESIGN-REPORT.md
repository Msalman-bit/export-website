# Design report (tasteskill 2.5)

## Kind, deal and voice

- **Kind:** product (page type `product`, site-kind `other`). Photographs, type and flat colour; no
  shader effects, scenes or loops; motion = the hero's entrance, two dealt moments, the hover layer.
- **Deal:** hero `film`, nav `nav-mega`, close `close-type`, footer `footer-columns`, rhythm `dark-band`,
  buttons `block`, mark `dots`, compositions `trio` (intro), `split` (customisation, pricing, FAQ, all on the
  page's one split line at column 6), `bleed` (quality, built on the container lines), the range as an index
  (one picture beside the ten families, the picture following the family pointed at), moments
  `pinned-chapters` (#process) and `picture-develops` (#customise).
- **Palette:** the client's own colours (start.mjs `brand`): white ground, obsidian #080808 ink and
  actions, lime #C5F900 as the accent on the obsidian band and in the mark. Lime fails contrast on white
  (1.3:1), so the light page is monochrome and lime is spent where it reads.
- **Type:** Archivo (dealt for the trade; chosen over the first pairing, a warm serif, because the brief
  asks for firm, condensed headlines), headlines at 82% width and weight 400.
- **Voice:** technical-dry with plain facts; "you" for the buyer, "we" for the work; no virtue words, no
  invented figures; one admission (businesses only, minimum order per product); one brand line
  ("Built without compromise.", the brief's own headline, used on the quality band, not as the h1).

## Deviations from the brief, and why

| Brief | Built | Why |
| --- | --- | --- |
| h1 "BUILT WITHOUT COMPROMISE." | h1 "Custom sports equipment, made in Pakistan"; the line kept as the quality band's heading | A buyer who has never heard of Monolith needs the category and the place in the first five seconds; all-caps slogans read as a mood |
| CTA "Explore Products" | "See the catalogue" | Buttons say what the visitor gets |
| Hero particles and a turning 3D ball | On the owner's request: a realistic scroll film in the hero (a pencil sketch becomes the ball's bladder, the panels fly in and are stitched, the graphic prints on, and the football becomes a handball and a rugby ball), held for five screens of scroll, with the hero's words in four chapters that follow it; the still photograph for reduced motion, short windows and browsers without AVIF; the turning 3D ball lives in the studio | The owner asked for an Apple-style scroll hero. It breaks the kit's one-screen hero rule, so its gate findings are waived as client-directed (see the session report) |
| GSAP / Motion | The kit's motion layer and moments | Same effect without an animation library |
| Tailwind | Token CSS | One design system |

## Stand-ins and client files

Every picture is a generated concept (Kie AI: Flux-2 Pro stills, a few by Nano Banana Pro; the hero scroll film from GPT Image 2.5 Sunburst keyframes and Veo 3.1 clips), listed on `/en/credits`
and in `media/manifest.json`; the footer says so in one line. None shows Monolith's own products, people
or premises; no factory or worker was generated. Shot list in docs/CONTENT-CHECKLIST.md section 5.

| Slot | File | Stand-in |
| --- | --- | --- |
| Hero scroll film (`HeroScene`, canvas) | a 1080p take of the real ball, cut with `scripts/build-hero-frames.mjs --format avif` into `public/assets/img/hero-film/{lg,md,sm}` | the generated film (about 50 s): GPT Image 2.5 Sunburst keyframes (pencil sketch, bladder, panels, laced, stitched, printed, handball, rugby ball), Veo 3.1 Quality first-and-last-frame clips (`scripts/generate-hero-film.mjs`), two matched dissolves (`scripts/build-hero-bridges.py`) |
| Product photographs | each product's admin page | `p-*` concepts, one per product, a close-up for seven |
| Process photographs | `media/raw/process-*.jpg` then `process-media.py` | `process-materials`, `-prototype`, `-inspection`, `-packing` |

## Facts assumed

None. No price, minimum order, lead time, certification, capacity, address, phone or customer is stated.
Contacts: the sales email `sales@monolithsports.example` is a stand-in until the owner sets the real one
(Admin > Settings); no phone, no street. Canonical domain: `SITE_URL` (today localhost).

## Check results

See docs/PERFORMANCE.md and the final session report for the gate line, the waivers and the open findings.
