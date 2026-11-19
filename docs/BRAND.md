# Brand system

## Logo

| File | Use |
| --- | --- |
| `public/brand/monogram.svg` | The mark: four forms on an electric-lime tile. Favicon, app icon, social avatar, the back of the business card |
| `public/brand/logo-primary.svg` | Mark and name, for light grounds |
| `public/brand/logo-reverse.svg` | Mark and name, for obsidian grounds |
| `public/brand/logo-stacked.svg` | Secondary logo: mark over the name, for square spaces |
| `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | Browser and device icons |

The website draws the mark in CSS (the `dots` mark of the design system) beside the name in Archivo.
The SVG wordmarks use live text in Archivo at 82% width: before print, a designer should convert the text
to outlines and register the mark (a trademark search is the owner's to run).

Clear space: the height of one dot on every side. Minimum size: the monogram 16 px; the primary logo 120 px wide.
Never recolour the tile, stretch the mark or put the lime tile on a lime ground.

## Colour

| Name | Hex | Use |
| --- | --- | --- |
| Obsidian | `#080808` | Text, primary buttons, the dark band, the footer of documents |
| Carbon | `#141414` / `#151515` | Surfaces on dark grounds, the photographic backdrop |
| Metallic silver | `#B8BDC5` | Lines and quiet surfaces (`#EEF0F2` as the light surface tint) |
| White | `#FFFFFF` | The page ground |
| Electric lime | `#C5F900` | The accent: the mark, buttons and focus on dark grounds, one rule on documents. Never text on white (contrast 1.3:1) |

The interface is about 95% neutral; lime is spent where it reads (on obsidian) and nowhere else.

## Type

Archivo (Google Fonts, SIL Open Font License), one family: headlines at 82% width and weight 400 with tight
tracking; text at normal width, 400 and 500. Sentence case everywhere; no tracked capitals in the interface.

## Photography

One studio set for every product: charcoal seamless backdrop falling to black, one large softbox from the
upper left, a thin rim light, matte black floor, products without any brand marks. Process pictures: hands,
tools and materials close up. Real people only with consent. Generated concepts follow the same direction
(`media/manifest.json`) and are replaced by photography.

## Templates

| Template | File |
| --- | --- |
| Quotation PDF | `src/lib/pdf/documents.ts` `quotationPdf` (obsidian band, lime rule, Helvetica for universal readers) |
| Invoice PDF | `invoicePdf` |
| Product datasheet PDF | `datasheetPdf` |
| Catalogue PDF | `cataloguePdf`, built from the live catalogue |
| Emails | `src/lib/email/templates.ts` (confirmation, notification, status, quotation, verification, reset, message) |
| Business card (85 x 55 mm) | `docs/brand/business-card.html` |
| Email signature | `docs/brand/email-signature.html` |
| Social post (1080 x 1350) | `docs/brand/social-post.html` |
| Share image | `public/share.jpg`, the hero |

Slogan (one use a page at most, never as a heading over a plain claim): "Engineered for performance. Built
for the world." The home page spends its one brand line as "Built without compromise."
