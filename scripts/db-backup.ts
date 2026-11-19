/* npm run db:backup: a portable JSON backup of every table into ./storage/backups/<timestamp>.json,
   plus a list of the uploaded files it references. For PostgreSQL in production prefer the provider's
   point-in-time recovery or pg_dump (docs/MAINTENANCE.md); this script is the provider-free fallback
   and the way to back up the local PGlite database. Stop the server first when using PGlite. */
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/lib/db/client';
import * as s from '../src/lib/db/schema';

const TABLES = {
  companies: s.companies, users: s.users, categories: s.categories, products: s.products, inquiries: s.inquiries,
  inquiry_items: s.inquiryItems, attachments: s.attachments, inquiry_events: s.inquiryEvents, quotations: s.quotations,
  orders: s.orders, shipments: s.shipments, invoices: s.invoices, documents: s.documents, messages: s.messages,
  saved_products: s.savedProducts, customisations: s.customisations, pages: s.pages, articles: s.articles,
  testimonials: s.testimonials, certificates: s.certificates, facts: s.facts, markets: s.markets,
  translations: s.translations, settings: s.settings, subscribers: s.subscribers, audit_log: s.auditLog,
};

(async () => {
  const db = await getDb();
  const out: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(TABLES)) out[name] = await db.select().from(table);
  const dir = path.join(process.cwd(), 'storage', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ version: 1, at: new Date().toISOString(), tables: out }));
  const counts = Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join(', ');
  console.log(`Backup written to ${file}\n${counts}\nAlso copy ${process.env.UPLOAD_DIR || './storage/uploads'} (uploaded files).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
