# API

All endpoints are same-origin. POST endpoints refuse requests whose `Origin` is another site (403).
Staff-only endpoints answer 404 to anyone without an MFA-verified staff session, so they do not reveal
that they exist. Server Actions (account and admin forms) are not listed: they are called by the pages,
POST only, origin-checked by Next.js, and validate every field on the server.

## Public

### `POST /api/inquiries` (multipart/form-data)
One consolidated quote, sample, distributor, partnership or contact inquiry.

| Field | Rule |
| --- | --- |
| `type` | `quote` (default), `sample`, `distributor`, `partnership`, `contact` |
| `companyName`, `contactName` | 2 to 120 characters |
| `email` | a valid address, stored lower-case |
| `phone` | optional; digits, spaces, `+().-` |
| `country` | ISO code from `src/lib/inquiry/countries.ts`, or `OTHER` |
| `currency` | `EUR`, `GBP`, `USD` |
| `branding`, `packaging` | up to 2,000 characters |
| `targetDate` | `YYYY-MM-DD` or empty |
| `shippingMethod` | empty, `sea`, `air`, `courier` |
| `message` | up to 5,000; required (10+) for contact types, and for quotes without items |
| `items` | JSON array, at most 50: `{ productId?: uuid, name?: string, quantity: 1..1,000,000, notes?: string, sample?: boolean, customisation?: object (< 6 KB) }` |
| `files` | up to 5 files: PDF, AI, EPS, PNG, JPG, WEBP, 10 MB each, checked by their first bytes |
| `locale`, `sourcePage` | where it was sent from |
| `company_website`, `elapsed` | spam honeypot (a bot that fills it gets a fake success, nothing is stored) and the milliseconds since the form opened, timed in the browser (under 3000: 400 with `errors.form`, so a person sends again) |
| `cf-turnstile-response` | required only when Turnstile keys are configured |

Responses: `200 { reference: "MS-261118-7KQ4F", type }` · `400 { errors: { field: message } }` ·
`403` cross-site · `429` with `Retry-After` (10 per hour per address). Product names and SKUs are read from
the database, never trusted from the browser. Side effects: the inquiry, its lines and files, a history entry,
a confirmation email to the buyer, a notification to `ADMIN_NOTIFY_EMAIL`, an analytics count.

### `POST /api/newsletter` (form data: `email`, `locale`)
`200 { ok: true }` for a new or known address alike · `400` · `403` · `429` (5 per hour).

### `POST /api/consent` (JSON `{ choice: "analytics" | "essential" }`)
Sets the `ms_consent` cookie for 12 months; "essential" also expires Google Analytics cookies.

### `POST /api/events` (JSON `{ name, productId?, path? }`)
First-party counts for a fixed list of names (`basket_add`, `studio_preview_download`, `studio_saved`,
`studio_to_inquiry`). Always `204`.

### `GET /api/products/:id/datasheet`
The product's datasheet PDF (published products only).

### `GET /api/catalogue[?family=slug]`
The catalogue PDF built from the published catalogue.

### `GET /sitemap.xml`, `GET /robots.txt`
Indexed languages only; drafts, account, search and confirmation pages excluded.

## Customer (signed-in, email verified)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/saved` / `DELETE /api/saved` `{ productId }` | Save or unsave a product |
| `POST /api/customisations` `{ productId?, name, config }` | Save a studio design to the company |
| `GET /api/portal/quotations/:id` | Quotation PDF, only for the company that owns its inquiry (and never a draft) |
| `GET /api/portal/invoices/:id` | Invoice PDF, only for the company that owns its order |
| `GET /media/:attachmentId` | Uploaded files: product media and published certificates for everyone; documents by visibility; inquiry files for staff and the owning company |

## Staff (MFA-verified, by role)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/admin/export?table=inquiries|inquiry_items|quotations|orders|customers|products|subscribers` | CSV export (needs `export.data`), audited, formula-safe cells |

## Errors

Every JSON error is `{ error: string }` or `{ errors: { field: string } }` with words a buyer can act on.
Downloads that are not allowed answer `404 Not found`.
