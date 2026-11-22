# Monolith Sports website

B2B website and business platform for **Monolith Sports**, a Pakistani sports equipment manufacturer, sourcing
and export brand selling to clubs, distributors, retailers and private-label brands in Europe.

Public site with a product catalogue, a customisation studio and a consolidated quotation system, plus a
customer portal and an administration dashboard. One Next.js application, one PostgreSQL schema.

## Quick start (local, nothing to install but Node 22+)

```bash
npm install
cp .env.example .env.local      # then set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and APP_SECRET
npm run dev                     # http://localhost:3000  (redirects to /en)
```

The first request creates the embedded database in `storage/pgdata` (PGlite, a WebAssembly PostgreSQL),
runs the migrations, seeds the catalogue and pages, and creates the first administrator from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Sign in at `/admin/login`; two-factor setup is required on
first sign-in (any authenticator app).

Production: `npm run build && npm start` with `DATABASE_URL` pointing at PostgreSQL. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js development, production build, production server |
| `npm test` | 30 unit tests (Vitest): security, validation, references, i18n, rich text, emails, PDFs |
| `npm run test:e2e` | 9 end-to-end tests in three journeys (buyer, staff, customer portal) against a running server (`BASE_URL`, default localhost:3000; needs a fresh database and SEED_ADMIN_* in .env.local) |
| `npm run typecheck` | TypeScript, strict |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:backup` | Drizzle migrations, seed, JSON backup |
| `node scripts/generate-media.mjs` then `python scripts/process-media.py` | Concept imagery (Kie AI) and responsive WebP |
| `npm run map:build` | Rebuilds the export map paths from Natural Earth |
| `npm run audit:deps` | Dependency vulnerability scan |

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript 5.9, Drizzle ORM on PostgreSQL
(PGlite locally, any PostgreSQL 14+ in production), Zod 4, pdf-lib, Three.js, Vitest. No UI framework: the
design system is the tasteskill kit (`public/assets/system.css`, `layout.css`, `motion.css`, moments) plus
`public/site/site.css`. Auth, sessions, TOTP, rate limits, uploads and emails are first-party code with no
external service required to run.

Choices that differ from the brief's preferred list, and why:
- **Tailwind CSS: not used.** The site follows one token-based design system; a second styling system
  would duplicate it. Everything is plain CSS with tokens.
- **GSAP / Motion: not used.** The design system's motion layer and its two scroll moments (pinned
  chapters, a picture that develops) cover every animation without an animation library, which keeps
  the JavaScript small.
- **Supabase: replaced by first-party auth** (scrypt passwords, database sessions, email verification,
  password reset, TOTP for staff). Supabase or Neon can still host the PostgreSQL database.
- **Cloudinary: not used.** Images are pre-sized WebP files in `public/assets/img/gen`; uploads are served
  through `/media/:id`. A CDN (Cloudflare) in front of the site caches them.
- **Resend: used through its HTTP API** without the SDK; without a key, emails go to the outbox table.

## What is in it: status

Legend: **Done** built and working in this repository · **Tested** covered by the automated tests or
checked in a browser · **Pending** needs owner input before launch · **External** needs an account,
key or service outside this repository.

| Area | Status | Notes |
| --- | --- | --- |
| Home page (film hero, range, process, customisation, quality, export map, questions, close) | Done, Tested | Built to the tasteskill system; gate results in docs/PERFORMANCE.md |
| Sticky nav, mega menus, search, language selector, footer with newsletter | Done, Tested | |
| Catalogue: 10 families (the brief's 8 plus futsal and handball), 48 product types, family pages with filters, product pages | Done, Tested | Family filters: type, construction, studio; URL keeps the filter |
| Product page: gallery, zoom, 360 view (when frames exist), specs, branding, packaging, datasheet PDF, related | Done, Tested | Empty commercial fields read "Confirmed in your quotation" |
| Customisation studio: 3D football (Three.js), 2D glove and shirt, logo upload, all options, PNG concept, save, add to inquiry | Done | 2D fallback without WebGL; previews labelled as concepts |
| Inquiry basket and consolidated quote, sample, contact, distributor, partnership forms | Done, Tested | Reference number, files, spam honeypot, rate limit, Turnstile when configured |
| Confirmation email to the buyer, notification to sales | Done, Tested | **External:** RESEND_API_KEY to send; logged to Admin > Outbox until then |
| Customer portal: register, verify email, sign in, reset, company profile, requests, quotations, samples, orders, production, tracking, invoices, documents, messages, saved products and designs | Done | Company-scoped queries; downloads checked per company |
| Admin: dashboard, inquiries workflow (11 statuses), quotation builder and PDF, orders, shipments, invoices, customers, messages | Done | |
| Admin: products, categories, media, pages and SEO, articles, testimonials, certificates, facts, markets, translations, documents | Done | |
| Admin: staff roles (admin, sales, content, production), two-factor sign-in, settings, analytics, CSV export, outbox, audit log | Done, Tested | |
| Internationalisation: /en /de /fr /es /it /nl, hreflang, translated interface | Done, Tested | **Pending:** native review of the five translations; long-form copy is English |
| SEO: titles, descriptions, canonical, hreflang, Open Graph, JSON-LD, sitemap, robots, breadcrumbs | Done, Tested | **External:** Search Console verification code |
| Analytics: first-party counts and funnel; GA4 only after consent | Done | **External:** GA4 measurement ID |
| Security: CSP with nonces, HSTS, secure cookies, RBAC, MFA, CSRF checks, rate limits, upload sniffing, audit log | Done, Tested | docs/SECURITY.md |
| Brand assets: logos, monogram, favicon, colours, type, business card, email signature, social template, PDF templates | Done | Wordmark to be outlined by a designer (docs/BRAND.md) |
| Concept imagery (66 stills, 1 film) | Done | **Pending:** the client's own photography replaces it (docs/CONTENT-CHECKLIST.md) |
| Real business facts (founding year, town, capacity, certifications, export history) | Pending | Admin > Business facts; nothing is shown until verified |
| Legal pages (privacy, cookies, terms) | Done, Pending | **Pending:** review by a qualified adviser before launch |
| Production deployment | Pending | Not deployed: needs the owner's hosting and domain (docs/DEPLOYMENT.md) |

## Folder map

```
src/app/(site)/[locale]/   public pages: home, products, studio, inquiry, account, insights, catalogues, CMS pages
src/app/(admin)/admin/     administration (its own layout, staff sessions, server actions)
src/app/api/               inquiries, newsletter, consent, events, saved, customisations, PDFs, CSV export
src/app/media/[id]/        access-controlled downloads of uploaded files
src/lib/                   db (schema, client, seed), auth, security, email, pdf, i18n, seo, data queries
src/components/            site chrome, catalogue, inquiry form, studio (3D and 2D)
public/assets/             the design-system kit (unchanged) and generated imagery (img/gen)
public/site/               site.css and admin.css (page CSS on the kit's tokens)
media/                     manifest of the generated imagery and its task log
drizzle/                   SQL migrations
tests/                     unit (Vitest) and end-to-end (node:test)
docs/                      plan, API, deployment, security, accessibility, SEO, performance, admin guide, maintenance, brand, content checklist
```

## Documentation

- [docs/PLAN.md](docs/PLAN.md): the home page plan, the design deal and the voice
- [docs/CONTENT-CHECKLIST.md](docs/CONTENT-CHECKLIST.md): what the owner must supply or confirm before launch
- [docs/API.md](docs/API.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)
- [docs/SECURITY.md](docs/SECURITY.md) · [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) · [docs/SEO.md](docs/SEO.md)
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) · [docs/MAINTENANCE.md](docs/MAINTENANCE.md) · [docs/BRAND.md](docs/BRAND.md)
