import { eq, and, sql } from 'drizzle-orm';
import type { DB } from './client';
import * as s from './schema';
import { CATALOGUE } from '../catalogue-data';
import { PAGES, ARTICLES } from '../content/pages-data';
import { MARKETS } from '../content/markets';
import { hashPassword } from '../auth/password';
import manifest from '../../../media/manifest.json';

const prompts: Record<string, string> = Object.fromEntries(manifest.items.map((i: { id: string; prompt: string }) => [i.id, i.prompt]));
/** Alt text from the art direction: what the picture shows, first clause only. */
export function altFor(id: string, fallback: string): string {
  const p = prompts[id];
  if (!p) return fallback;
  return p.split(/[.;]/)[0].replace(/\s*\(#?[0-9A-Fa-f]{6}\)/g, '').trim();
}

export const FACTS: { key: string; label: string; note: string }[] = [
  { key: 'founded', label: 'Year founded', note: 'Shown on About when verified.' },
  { key: 'town', label: 'Production town', note: 'For example Sialkot. Used in the footer and About when verified.' },
  { key: 'street', label: 'Street and district (no house number)', note: 'Shown on Contact when verified.' },
  { key: 'phone', label: 'Sales phone number', note: 'Shown on Contact when verified.' },
  { key: 'facility', label: 'Facility (floor area, lines)', note: 'Factory and facilities page.' },
  { key: 'workforce', label: 'Number of employees', note: 'About page.' },
  { key: 'capacity', label: 'Monthly capacity per product family', note: 'Manufacturing page.' },
  { key: 'export_history', label: 'Countries shipped to', note: 'Mark them as established on Admin > Markets.' },
];

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  company: { name: 'Monolith Sports', salesEmail: 'sales@monolithsports.example', replyNote: '' },
  currencies: { enabled: ['EUR', 'GBP', 'USD'], default: 'EUR' },
  quotation: { paymentTerms: '', incoterm: '', validityDays: 30, footer: 'Prices exclude import duties and taxes in the destination country unless stated.' },
  locales: { enabled: ['en', 'de', 'fr', 'es', 'it', 'nl'], indexed: ['en'] },
  analytics: { ga4: '' },
  newsletter: { enabled: true },
};

export async function seedIfEmpty(db: DB) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.categories);
  if (n === 0) await seedCatalogue(db);

  const [{ p }] = await db.select({ p: sql<number>`count(*)::int` }).from(s.pages);
  if (p === 0) {
    for (const pg of PAGES) {
      await db.insert(s.pages).values({
        slug: pg.slug, section: pg.section, title: pg.title, summary: pg.summary, body: pg.body,
        status: pg.status ?? 'published', needsReview: !!pg.needsReview, reviewNote: pg.reviewNote ?? '',
        seoTitle: '', seoDescription: pg.summary,
      });
    }
    for (const a of ARTICLES) {
      await db.insert(s.articles).values({ ...a, status: 'published', publishedAt: new Date(), seoDescription: a.summary });
    }
  }

  const [{ f }] = await db.select({ f: sql<number>`count(*)::int` }).from(s.facts);
  if (f === 0) for (const fact of FACTS) await db.insert(s.facts).values({ ...fact, value: '', verified: false });

  const [{ m }] = await db.select({ m: sql<number>`count(*)::int` }).from(s.markets);
  if (m === 0) for (const mk of MARKETS) await db.insert(s.markets).values({ ...mk, status: 'target' });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }

  await seedAdmin(db);
}

async function seedCatalogue(db: DB) {
  let order = 0;
  for (const fam of CATALOGUE) {
    const [parent] = await db.insert(s.categories).values({
      slug: fam.slug, name: fam.name, summary: fam.summary, body: fam.body, sortOrder: order++, published: true,
      image: { url: `gen:${fam.image}`, alt: altFor(fam.image, fam.name), source: 'generated' },
      seoTitle: `${fam.name} manufacturer, private label and wholesale`, seoDescription: fam.summary,
    }).returning();
    let subOrder = 0;
    for (const sub of fam.subs) {
      const pr = sub.product;
      const [child] = await db.insert(s.categories).values({
        slug: sub.slug, parentId: parent.id, name: sub.name, summary: pr.summary, sortOrder: subOrder++, published: true,
        image: { url: `gen:${pr.image}`, alt: altFor(pr.image, pr.name), source: 'generated' },
        seoDescription: pr.summary,
      }).returning();
      await db.insert(s.products).values({
        slug: slugify(pr.name), sku: `MS-${pr.code}-001`, categoryId: child.id, name: pr.name, summary: pr.summary,
        description: pr.description, construction: pr.construction, materials: pr.materials ?? '', sizes: pr.sizes ?? [],
        brandingOptions: pr.branding ?? [], packagingOptions: pr.packaging ?? [], studioModel: pr.studio ?? null,
        images: [
          { url: `gen:${pr.image}`, alt: altFor(pr.image, pr.name), source: 'generated' },
          ...(prompts[`${pr.image}-detail`] ? [{ url: `gen:${pr.image}-detail`, alt: altFor(`${pr.image}-detail`, `${pr.name}, close-up`), source: 'generated' }] : []),
        ],
        status: 'published', sortOrder: subOrder, featured: fam.slug === 'football' && subOrder <= 2,
        seoTitle: `${pr.name}: custom and private-label manufacturing`, seoDescription: pr.summary,
      });
    }
  }
  // related products: the other products of the same family
  const all = await db.select({ id: s.products.id, cat: s.products.categoryId }).from(s.products);
  const cats = await db.select({ id: s.categories.id, parentId: s.categories.parentId }).from(s.categories);
  const familyOf = new Map(cats.map((c) => [c.id, c.parentId ?? c.id]));
  for (const pr of all) {
    const fam = familyOf.get(pr.cat);
    const related = all.filter((o) => o.id !== pr.id && familyOf.get(o.cat) === fam).slice(0, 4).map((o) => o.id);
    await db.update(s.products).set({ relatedIds: related }).where(eq(s.products.id, pr.id));
  }
}

async function seedAdmin(db: DB) {
  const existing = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.kind, 'staff'), eq(s.users.role, 'admin'))).limit(1);
  if (existing.length) return;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[monolith] No administrator exists. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD and restart.');
    return;
  }
  await db.insert(s.users).values({
    email, passwordHash: await hashPassword(password), name: 'Administrator', kind: 'staff', role: 'admin', emailVerifiedAt: new Date(),
  });
  console.log(`[monolith] Administrator ${email} created. Multifactor setup is required at first sign-in.`);
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
