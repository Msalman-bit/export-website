import { eq, inArray } from 'drizzle-orm';
import type { DB } from './client';
import * as s from './schema';
import changes from './text-update-2026-11-22.json';

/* The English texts reworded on 2026-11-22, brought into a database that already holds the old ones (the data files
   only fill new databases). Runs once per database, when the server first opens it: a text is replaced only where it
   is still one of the wordings this site was delivered with (line endings aside), so a text edited in the admin is
   never touched. The result is kept in settings (TEXT_UPDATE) and in the audit log. Once the live databases have run
   it, this file, its JSON and the call in client.ts can be removed. */

// raised when a later wording followed a run: _b took cricket out of two pages, _c wrote "for your brand"
export const TEXT_UPDATE = 'text_update_2026_11_22_c';

type Table = 'pages' | 'articles' | 'categories' | 'products';
/** `key` is the row's address (a product's SKU); `also` the SKUs it was delivered with earlier */
export type TextChange = { table: Table; key: string; also?: string[]; field: string; from: unknown[]; to: unknown };
export type TextUpdateResult = { changed: number; left: string[]; missing: string[] };

const plain = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : JSON.stringify(v));
const same = (a: unknown, b: unknown) => plain(a) === plain(b);
const keyOf = { pages: s.pages.slug, articles: s.articles.slug, categories: s.categories.slug, products: s.products.sku };

export async function updateTexts(db: DB, list: TextChange[] = changes as unknown as TextChange[]): Promise<TextUpdateResult | null> {
  const [done] = await db.select({ key: s.settings.key }).from(s.settings).where(eq(s.settings.key, TEXT_UPDATE)).limit(1);
  if (done) return null;
  return db.transaction(async (tx) => {
    const out: TextUpdateResult = { changed: 0, left: [], missing: [] };
    const rows = new Map<string, TextChange[]>();
    for (const c of list) rows.set(`${c.table} ${c.key}`, [...(rows.get(`${c.table} ${c.key}`) ?? []), c]);
    for (const [name, fields] of rows) {
      const { table, key } = fields[0];
      const t = s[table];
      const [row] = (await tx.select().from(t).where(inArray(keyOf[table], [key, ...(fields[0].also ?? [])])).limit(1)) as ({ id: string } & Record<string, unknown>)[];
      if (!row) { out.missing.push(name); continue; }
      const set: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.from.some((old) => same(row[f.field], old))) set[f.field] = f.to;
        else if (!same(row[f.field], f.to)) out.left.push(`${name} ${f.field}`);
      }
      const n = Object.keys(set).length;
      if (!n) continue;
      await tx.update(t).set({ ...set, updatedAt: new Date() } as never).where(eq(t.id, row.id));
      out.changed += n;
    }
    await tx.insert(s.settings).values({ key: TEXT_UPDATE, value: { at: new Date().toISOString(), ...out } }).onConflictDoNothing();
    if (out.changed) await tx.insert(s.auditLog).values({ actorEmail: 'system', action: 'content.text_update', entity: 'settings', entityId: TEXT_UPDATE, detail: { ...out } });
    return out;
  });
}
