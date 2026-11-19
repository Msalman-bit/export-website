/* npm run db:seed: seeds an empty database with the catalogue, pages, articles, facts, markets and
   settings, and creates the first administrator from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
   It never overwrites rows that exist. */
import { getDb } from '../src/lib/db/client';
import { seedIfEmpty } from '../src/lib/db/seed';

(async () => {
  const db = await getDb();
  await seedIfEmpty(db);
  console.log('Seed complete.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
