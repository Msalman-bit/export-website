import path from 'node:path';
import fs from 'node:fs';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

/* One database handle per server process.
   - DATABASE_URL set (postgres://...): node-postgres pool against PostgreSQL (production).
   - DATABASE_URL empty: PGlite, a WebAssembly build of PostgreSQL, persisted in ./storage/pgdata.
   Both run the same SQL migrations from ./drizzle on first use, then seed an empty database. */

export type DB = ReturnType<typeof drizzlePglite<typeof schema>>;

type Holder = { promise?: Promise<DB> };
const g = globalThis as unknown as { __monolithDb?: Holder };
const holder: Holder = g.__monolithDb ?? (g.__monolithDb = {});

const MIGRATIONS = path.join(/* turbopackIgnore: true */ process.cwd(), 'drizzle');

async function open(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim();
  let db: DB;
  if (url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    const pg = drizzle(pool, { schema });
    await migrate(pg, { migrationsFolder: MIGRATIONS });
    db = pg as unknown as DB;
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = path.join(/* turbopackIgnore: true */ process.cwd(), 'storage', 'pgdata');
    fs.mkdirSync(dir, { recursive: true });
    const client = await PGlite.create(dir);
    db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
  }
  const { seedIfEmpty } = await import('./seed');
  await seedIfEmpty(db);
  return db;
}

export function getDb(): Promise<DB> {
  if (!holder.promise) {
    holder.promise = open().catch((err) => {
      holder.promise = undefined;
      throw err;
    });
  }
  return holder.promise;
}

export { schema };
