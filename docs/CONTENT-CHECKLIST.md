# Owner checklist before launch

The site states nothing about Monolith Sports that the brief did not give. Where a fact is missing, the page
reads correctly without it, a field stays empty, or the page is an unpublished draft. This list is what the
owner supplies or confirms. Work through it in the admin (`/admin`); the dashboard repeats the open items.

## 1. Facts (Admin > Business facts)

Shown on the site only when filled in **and** ticked as verified.

- [ ] Year founded
- [ ] Production town (for example Sialkot) and street and district for Contact (no house number)
- [ ] Sales phone number (otherwise the site shows none; the forms and the sales email cover contact)
- [ ] Facility: floor area, production lines, in-house and subcontracted steps
- [ ] Number of employees, monthly capacity per product family
- [ ] Countries already shipped to: mark each in **Admin > Export markets** as "Shipped to"; the home page
      map then shows them in lime with their own legend

## 2. Catalogue (Admin > Categories, Admin > Products)

- [ ] Unpublish every family and product type Monolith does **not** genuinely supply (futsal and handball
      were added on request; confirm both, with their sizes, before launch)
- [ ] For each product: minimum order quantity, lead time, weight, materials, sizes, standard colours
      (until filled in, the product page says "Confirmed in your quotation")
- [ ] Testing standards: enter only standards with a test report on file
- [ ] Branding and packaging options: confirm the seeded options per product, remove any production cannot do
- [ ] Replace each concept picture with real photographs (see section 5); the product list marks every
      product still showing a concept picture

## 3. Pages (Admin > Pages and SEO)

| Page | State | What it needs |
| --- | --- | --- |
| Company history | Draft (hidden) | Founding year, founders, real milestones |
| Ethical sourcing | Draft (hidden) | Labour policy, audit history, subcontracting; Sialkot buyers ask about child-labour monitoring |
| Mission and vision | Published, review | Confirm the wording |
| Factory and facilities | Published, review | Location, floor area, lines; never generated factory imagery |
| Quality control | Published, review | Confirm the inspection points; add certificates only with documents |
| Research and development | Published, review | Confirm the steps |
| Sustainability | Published, review | Confirm which lower-impact options production offers; add measured figures only |
| Privacy, Cookies, Terms | Published, review | **Legal review by a qualified adviser** (GDPR, UK GDPR, ePrivacy/PECR, terms of sale); name the data controller and its address |

## 4. Proof (Admin > Testimonials and certificates)

- [ ] Certificates: upload the document, check it with the issuing body, then publish. Never list FIFA,
      ISO, CE or other marks without the document and the right to use them.
- [ ] Testimonials: only from real customers who agreed in writing to be quoted.
- [ ] Client logos: none are shown. Add them only with written permission (the design system then uses a
      plain row, never a logo wall).

## 5. Photography to commission

Every product and process picture on the site today is a **generated concept** (Kie AI: Flux-2 Pro stills,
a few product pictures by Nano Banana Pro; the hero scroll film, GPT Image 2.5 Sunburst keyframes and Veo 3.1
clips), listed on `/en/credits` and named in `media/manifest.json`. None shows Monolith's products, people or
premises. Replace them in this order:

1. Hero: a match football on a dark set, ball large and running off the frame (16:9 and a 9:16 phone crop): the
   still shown before the film loads and to visitors who turn animation off. For the scroll film (about 50
   seconds today), 1080p footage on black of the same story in four chapters, which the hero's words follow:
   **Your idea** (a design sketched on paper), **Made for real** (the bladder, the panels coming together and
   being stitched), **Your brand** (the client's graphic printed on), **Your range** (the football, then a
   handball, then a rugby ball). The film ends on the rugby ball. Cut it to frames with
   `scripts/build-hero-frames.mjs --format avif` into a new folder (the site caches `/assets` for a week, so a
   new film never reuses the last one's folder: change `OUT` there and `BASE` in
   `src/components/site/hero-sequence.ts`), and set where each chapter starts with `--stages`. The four lines of
   words are `HERO_CHAPTERS` in `src/app/(site)/[locale]/page.tsx`.
   **Confirm** before launch: the film shows hand stitching, and the second chapter says the ball is "assembled
   and stitched panel by panel". If your balls are hand-stitched, that line can say so.
2. Each product on one dark backdrop, three angles (front, three-quarter, detail), 2000 px or larger.
3. Process details: panels being cut, hand stitching (hands only, or staff who consent), inspection,
   packing. Real staff only with written consent.
4. Packing and shipping: cartons with your marks, a pallet, a container loading.

Upload product photographs on each product's admin page; replace home-page frames by putting files with the
same names in `media/raw` and running `python scripts/process-media.py`.

## 6. Languages (Admin > Translations, Admin > Settings)

- [ ] A native speaker reviews the interface strings for German, French, Spanish, Italian and Dutch
- [ ] Commission translations of the key pages (home, products, quality, terms) before indexing a language
- [ ] Only then tick "Indexed" for that language in Settings (it then enters hreflang and the sitemap)

## 7. Accounts and keys (environment variables, docs/DEPLOYMENT.md)

- [ ] Domain and `SITE_URL`; `APP_SECRET` (32+ random bytes)
- [ ] PostgreSQL (`DATABASE_URL`) with daily backups
- [ ] Resend (`RESEND_API_KEY`, `EMAIL_FROM` on a verified domain, `ADMIN_NOTIFY_EMAIL`)
- [ ] Optional: Cloudflare Turnstile keys; GA4 measurement ID; Search Console verification code
- [ ] Rotate the Kie AI key used during the build (it was shared in a chat)

## 8. Commercial settings (Admin > Settings)

- [ ] Sales email address shown as "Email us" (today `sales@monolithsports.example`, a placeholder domain)
- [ ] Default payment terms and Incoterm printed on quotations
- [ ] Quotation validity, the small print, the currencies offered
- [ ] A reply-time promise only if the sales team can keep it
