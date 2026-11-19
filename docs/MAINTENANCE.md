# Maintenance and backups

## Backups

- **Database (production PostgreSQL):** turn on the provider's daily backups and point-in-time recovery
  (Neon, Supabase and RDS all offer it). Weekly, also keep an off-site `pg_dump`:
  `pg_dump --format=custom "$DATABASE_URL" > monolith-$(date +%F).dump`, kept 30 days.
- **Uploaded files:** back up `UPLOAD_DIR` (or the bucket) daily with the database; file names are random
  and referenced by the `attachments` table, so the two must be restored together.
- **Provider-free fallback:** `npm run db:backup` writes every table to `storage/backups/<time>.json`.
- **Test a restore** every quarter on a staging database.

## Updates

- Monthly: `npm outdated`, `npm run audit:deps`, update patch and minor versions, `npm run typecheck && npm test
  && npm run build`, deploy to staging, `npm run test:e2e`, then production.
- Next.js majors: read `node_modules/next/dist/docs/01-app/02-guides/upgrading/`.
- Schema changes: edit `src/lib/db/schema.ts`, `npm run db:generate`, commit the new SQL in `drizzle/`; the
  app applies it on start.

## Monitoring

- Uptime check on `/en` and `/api/catalogue?family=football`.
- Errors: the host's logs, or add Sentry (`@sentry/nextjs`) with its DSN as an environment variable.
- Watch **Admin > Email outbox** for "failed" and **Admin > Audit log** for repeated `staff.login_failed`.

## Content upkeep

- Replace concept pictures as photography arrives (docs/CONTENT-CHECKLIST.md section 5).
- Keep certificates' validity dates current; unpublish expired ones.
- Re-check the legal pages yearly and when processing changes.

## Generated imagery

`media/manifest.json` holds every prompt; `node scripts/generate-media.mjs --only <id>` regenerates one
frame (needs `KIE_API_KEY`), `python scripts/process-media.py <id>` makes its WebP sizes, and
`src/lib/media.generated.json` records them. Remove the key from the environment when not generating.
