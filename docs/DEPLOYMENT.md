# Deployment

Nothing has been deployed. These are the steps for the owner's hosting; no paid service is required to
run the site, but production needs a PostgreSQL database and (to send email) a Resend account.

## 1. Choose where it runs

The app is a standard Next.js 16 Node server (`next build` + `next start`). Two tested shapes:

- **Vercel** (simplest): import the repository, set the environment variables below, and use a managed
  PostgreSQL (Neon, Supabase, Vercel Postgres). Uploaded files: Vercel's filesystem is not persistent, so
  set `UPLOAD_DIR` to a mounted volume on a VM, or swap `src/lib/security/upload.ts` `storeFile`/`readStored`
  for S3 or Supabase Storage (the two functions are the only place files are written and read).
- **A small VM or container** (Hetzner, DigitalOcean, AWS Lightsail): Node 20.9+, `npm ci && npm run build &&
  npm start` behind Caddy or Nginx for HTTPS, `UPLOAD_DIR` on a persistent disk. Run one process per
  instance; put Cloudflare in front for the CDN, WAF and rate-limit rules.

Never run the embedded PGlite database in production: it is for development and demos. With `DATABASE_URL`
set, the app uses PostgreSQL through `pg`.

## 2. Environment variables

See `.env.example`; all are server-only.

| Variable | Required | Notes |
| --- | --- | --- |
| `SITE_URL` | yes | `https://www.your-domain`: canonical URLs, sitemap, emails, PDFs |
| `DATABASE_URL` | yes | PostgreSQL 14+, SSL; the app runs the migrations on start |
| `APP_SECRET` | yes | 32+ random bytes (`openssl rand -base64 32`); encrypts staff TOTP secrets |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | first start | Creates the first administrator if none exists; remove afterwards |
| `RESEND_API_KEY`, `EMAIL_FROM` | to send email | Verify the sending domain in Resend (SPF, DKIM, DMARC) |
| `ADMIN_NOTIFY_EMAIL` | recommended | Where new inquiries are announced |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional | Cloudflare Turnstile on public forms |
| `GA4_MEASUREMENT_ID` | optional | Or set it in Admin > Settings; loads only after consent |
| `GOOGLE_SITE_VERIFICATION` | optional | Search Console HTML-tag value |
| `UPLOAD_DIR` | yes on a VM | Persistent folder outside `public/` |

## 3. Release steps

```bash
npm ci
npm run typecheck && npm test
npm run build
npm run db:migrate          # optional: migrations also run on the first request
npm start                   # PORT=3000 by default
BASE_URL=https://staging.your-domain npm run test:e2e
```

Point the domain, enable HTTPS (HSTS is sent in production), then in Search Console submit
`https://www.your-domain/sitemap.xml`.

## 3a. One-folder release (no build on the server)

`npm run build && npm run package` writes `deploy/monolith-sports/` (and `deploy/monolith-sports.zip`): the
standalone server, only the dependencies it uses, the static files, `public/` and the migrations, about 106 MB.
Copy it to any host with Node.js 20.9+, copy `.env.example` to `.env` there and fill it in, then run
`node start.mjs` (or build the included `Dockerfile`). Its `START-HERE.md` lists the steps.

The package never contains a secret or local data: it is built from an allow-list, every `.env*` file but the
example is left out, and the script stops if any secret value from the local `.env.local` appears in it. Keep
`storage/` (built-in database and uploads) on persistent disk if you use it, or set `DATABASE_URL` and `UPLOAD_DIR`.

## 3b. Hostinger VPS (or any Linux server with Docker)

The package also carries a one-server setup: `docker-compose.yml` runs the site, PostgreSQL 16 and Caddy (HTTPS
with automatic certificates) together, with `backup.sh` (daily database and uploads backup), `update.sh` and
`rollback.sh`. The sources live in `deploy-kit/hostinger/`; the step-by-step guide, written for Hostinger's hPanel,
is `HOSTINGER.md` in the package. Choose a KVM VPS: Hostinger's web and cloud hosting plans offer no PostgreSQL.

## 4. Cloudflare (optional, recommended)

- Proxy the domain; SSL mode Full (strict).
- Cache rule: `/assets/*` and `/_next/static/*` cache everything; HTML bypass (pages are per-request because
  of the CSP nonce and the session).
- Rate limiting rules for `/api/inquiries`, `/api/newsletter`, `/admin/login` (the app's in-memory limits are
  per instance).
- WAF managed rules on.
- The app reads `CF-Connecting-IP` and `CF-IPCountry` (country only, for analytics).

## 5. After launch

- Remove `SEED_ADMIN_*`; every staff member signs in with two-factor.
- Set backups (docs/MAINTENANCE.md) and error monitoring (Sentry or the host's logs).
- Work through docs/CONTENT-CHECKLIST.md.
