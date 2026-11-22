import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { DB } from '@/lib/db/client';
import { seedIfEmpty } from '@/lib/db/seed';
import { updateTexts, TEXT_UPDATE, type TextChange } from '@/lib/db/text-update';
import changes from '@/lib/db/text-update-2026-11-22.json';

const LIST = changes as unknown as TextChange[];
const s = schema;
const COL = { pages: s.pages.slug, articles: s.articles.slug, categories: s.categories.slug, products: s.products.sku };

/** a database as the sites have it: the site's content, with every changed text put back to its old wording */
async function oldDatabase(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema }) as unknown as DB;
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await seedIfEmpty(db);
  for (const c of LIST) await db.update(s[c.table]).set({ [c.field]: c.from[0] } as never).where(eq(COL[c.table], c.key));
  return db;
}
const read = async (db: DB, c: TextChange) => ((await db.select().from(s[c.table]).where(eq(COL[c.table], c.key)))[0] as Record<string, unknown>)[c.field];

describe('the one-time update of the reworded texts', () => {
  let db: DB;
  beforeEach(async () => { db = await oldDatabase(); }, 60000);

  it('replaces every old text once, and notes it', async () => {
    const r = await updateTexts(db);
    expect(r).toEqual({ changed: LIST.length, left: [], missing: [] });
    for (const c of LIST) expect(await read(db, c), `${c.table} ${c.key} ${c.field}`).toEqual(c.to);
    expect(await db.select().from(s.settings).where(eq(s.settings.key, TEXT_UPDATE))).toHaveLength(1);
    expect(await db.select().from(s.auditLog).where(eq(s.auditLog.action, 'content.text_update'))).toHaveLength(1);
  }, 60000);

  it('never touches a text edited in the admin, and runs only once', async () => {
    const about = LIST.find((c) => c.table === 'pages' && c.key === 'about' && c.field === 'body')!;
    const faq = LIST.find((c) => c.table === 'pages' && c.key === 'faq' && c.field === 'body')!;
    await db.update(s.pages).set({ body: 'My own words about the company.' }).where(eq(s.pages.slug, 'about'));
    // saved in the admin without a change: a text box sends Windows line endings
    await db.update(s.pages).set({ body: `${String(faq.from[0]).replace(/\n/g, '\r\n')}\r\n` }).where(eq(s.pages.slug, 'faq'));
    const r = await updateTexts(db);
    expect(r?.left).toEqual(['pages about body']);
    expect(await read(db, about)).toBe('My own words about the company.');
    expect(await read(db, faq)).toBe(faq.to);
    // later, a text set back to an old wording on purpose stays as it is
    await db.update(s.pages).set({ body: String(about.from[0]) }).where(eq(s.pages.slug, 'about'));
    expect(await updateTexts(db)).toBeNull();
    expect(await read(db, about)).toBe(about.from[0]);
  }, 60000);

  it('copes with a page, category or product that was deleted', async () => {
    const bags = LIST.find((c) => c.table === 'products' && c.key === 'MS-AC-BBG-001')!;
    await db.delete(s.products).where(eq(s.products.sku, bags.key));
    const r = await updateTexts(db);
    expect(r?.missing).toEqual([`products ${bags.key}`]);
    expect(r?.changed).toBe(LIST.filter((c) => !(c.table === 'products' && c.key === bags.key)).length);
  }, 60000);

  it('finds a product under the SKU it was delivered with earlier', async () => {
    const thb = LIST.find((c) => c.table === 'products' && c.key === 'MS-FB-THB-001' && c.field === 'description')!;
    expect(thb.also).toEqual(['MS-FB-TBD-001']);
    await db.update(s.products).set({ sku: 'MS-FB-TBD-001' }).where(eq(s.products.sku, 'MS-FB-THB-001'));
    expect(await updateTexts(db)).toEqual({ changed: LIST.length, left: [], missing: [] });
    const [row] = await db.select().from(s.products).where(eq(s.products.sku, 'MS-FB-TBD-001'));
    expect(row.description).toBe(thb.to);
  }, 60000);

  it('says "under your brand" nowhere', () => {
    for (const c of LIST) expect(JSON.stringify(c.to), `${c.table} ${c.key} ${c.field}`).not.toMatch(/under (your|the buyer’s) (brand|label)/i);
  });

  it('names cricket nowhere on the content pages', () => {
    for (const c of LIST.filter((x) => x.table === 'pages')) expect(String(c.to), `${c.key} ${c.field}`).not.toMatch(/cricket/i);
  });

  it('leaves no old wording behind: no North America, no "family", no number of categories', () => {
    for (const c of LIST) expect(JSON.stringify(c.to), `${c.table} ${c.key} ${c.field}`).not.toMatch(/North America|\bfamil(y|ies)\b|\b(eight|nine|ten|\d+) (product )?categories/i);
  });
});

describe('a new database', () => {
  it('is filled with the new texts, so there is nothing to change', async () => {
    const db = drizzle(new PGlite(), { schema }) as unknown as DB;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    await seedIfEmpty(db);
    expect(await updateTexts(db)).toEqual({ changed: 0, left: [], missing: [] });
  }, 60000);
});
