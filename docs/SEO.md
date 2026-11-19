# SEO

## What the site does

| Item | Where |
| --- | --- |
| Unique titles and descriptions | `generateMetadata` on every page; products, families, pages and articles take theirs from the admin (search title and description fields), with sensible defaults |
| Canonical URLs | `src/lib/seo.ts` `pageMeta`: `https://<SITE_URL>/<lang><path>` |
| hreflang | For **indexed** languages only (Admin > Settings), plus `x-default` to English. Unreviewed languages are reachable but `noindex` and absent from hreflang and the sitemap, so machine-assisted text never competes in search |
| Language URLs | `/en`, `/de`, `/fr`, `/es`, `/it`, `/nl`; a bare path redirects by cookie, then `Accept-Language` |
| Structured data | Organization (home), BreadcrumbList (every inner page), ItemList (catalogue), Product with SKU and brand (product pages; no price or rating is invented), Article (insights) |
| Sitemap | `/sitemap.xml`: home, catalogue, families, products, published pages and articles, with alternates |
| robots.txt | Allows the site; disallows `/admin`, `/api/`, `/media/`, account, search and confirmation pages |
| Open Graph and Twitter cards | Title, description, image per page (product and family pictures where they exist) |
| Semantic HTML | One h1 per page, headings in order, `main`, `nav` with labels, breadcrumbs as an ordered list, tables for specifications |
| Image alt text | Every picture says what it shows; decorative ones are empty |
| Internal links | Mega menus, footer directory, breadcrumbs, related products, CMS links between service pages |
| Search-friendly URLs | `/en/products/football/match-football`, `/en/oem-manufacturing`, `/en/insights/<slug>` |
| Search Console | `GOOGLE_SITE_VERIFICATION` adds the verification tag; submit `/sitemap.xml` |

## Target searches and the pages that answer them

| Search | Page |
| --- | --- |
| sports equipment manufacturer Pakistan | Home (title, h1, organisation data), About |
| football manufacturer Sialkot | Hand-stitched footballs (names Sialkot's construction); About once the production town is verified |
| custom football supplier Europe | Football family page, Customisation studio, Global exports |
| wholesale football supplier Ireland | Global exports, Home (Ireland first in the market list) |
| OEM sports equipment manufacturer | OEM manufacturing |
| private label football manufacturer | Private labelling, the private-label brief article |
| custom sportswear manufacturer Pakistan | Sportswear family, Football kits, Custom teamwear |
| boxing gloves wholesale Europe | Combat sports family, Boxing gloves |
| sports equipment exporter Pakistan | Global exports, Shipping and logistics |

No keyword lists, hidden text or doorway pages: each phrase is answered by a page that is about it.

## Next steps for the owner

- Verify the production town and add it to About and Contact (Admin > Business facts): the strongest local
  signal for "Sialkot" searches, only if true.
- Write one article a month from real buyer questions (Admin > Articles).
- Commission reviewed translations of the key pages before indexing each language.
- Replace concept pictures with photographs and fill the product fields: unique, specific product pages rank.
