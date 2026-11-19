import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes SQL migrations into ./drizzle from the schema.
// The same migrations run on PGlite (local, no install) and on any PostgreSQL 14+ server.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
