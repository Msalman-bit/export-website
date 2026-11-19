/* npm run db:migrate: applies ./drizzle migrations to DATABASE_URL (PostgreSQL) or the local PGlite
   database. The app also migrates on start; run this in a release step so a failed migration stops
   the deploy instead of the first request. Stop `next dev` / `next start` first when using PGlite. */
import { getDb } from '../src/lib/db/client';

getDb()
  .then(() => { console.log('Migrations applied (and an empty database seeded).'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
