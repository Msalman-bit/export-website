import { and, asc, eq, ilike, inArray, isNull, or, sql, desc } from 'drizzle-orm';
import { getDb } from './db/client';
import * as s from './db/schema';
import { DEFAULT_SETTINGS } from './db/seed';
import { MARKETS } from './content/markets';

/* Read-side queries for the public site. Everything the public sees is filtered to published rows. */

export type Settings = typeof DEFAULT_SETTINGS & {
  company: { name: string; salesEmail: string; replyNote: string };
  currencies: { enabled: string[]; default: string };
  quotation: { paymentTerms: string; incoterm: string; validityDays: number; footer: string };
  locales: { enabled: string[]; indexed: string[] };
  analytics: { ga4: string };
  newsletter: { enabled: boolean };
};

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(s.settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  const st = out as Settings;
  if (process.env.GA4_MEASUREMENT_ID && !st.analytics.ga4) st.analytics = { ga4: process.env.GA4_MEASUREMENT_ID };
  return st;
}

export type Family = typeof s.categories.$inferSelect & { subs: (typeof s.categories.$inferSelect)[] };

/** The families the public sees: published, and only with their product types that hold at least one published
    product. A family left with no such type is left out everywhere (menus, catalogue, home page, sitemap, its own
    page), so an emptied family never shows as an empty shelf, even while its Published box is still ticked. */
export async function getFamilies(): Promise<Family[]> {
  const db = await getDb();
  const [cats, stocked] = await Promise.all([
    db.select().from(s.categories).where(eq(s.categories.published, true)).orderBy(asc(s.categories.sortOrder)),
    db.selectDistinct({ id: s.products.categoryId }).from(s.products).where(eq(s.products.status, 'published')),
  ]);
  const hasProducts = new Set(stocked.map((r) => r.id));
  const parents = cats.filter((c) => !c.parentId);
  return parents
    .map((p) => ({ ...p, subs: cats.filter((c) => c.parentId === p.id && hasProducts.has(c.id)) }))
    .filter((f) => f.subs.length > 0);
}

export async function getFamily(slug: string): Promise<Family | null> {
  const fams = await getFamilies();
  return fams.find((f) => f.slug === slug) ?? null;
}

export type ProductRow = typeof s.products.$inferSelect;
export type ProductCard = ProductRow & { subSlug: string; subName: string; familySlug: string };

export async function getProductsInFamily(family: Family): Promise<ProductCard[]> {
  const db = await getDb();
  const subIds = family.subs.map((c) => c.id);
  if (!subIds.length) return [];
  const rows = await db.select().from(s.products)
    .where(and(eq(s.products.status, 'published'), inArray(s.products.categoryId, subIds)))
    .orderBy(asc(s.products.sortOrder), asc(s.products.name));
  return rows.map((r) => {
    const sub = family.subs.find((c) => c.id === r.categoryId)!;
    return { ...r, subSlug: sub.slug, subName: sub.name, familySlug: family.slug };
  });
}

export async function getProduct(familySlug: string, productSlug: string) {
  const family = await getFamily(familySlug);
  if (!family) return null;
  const db = await getDb();
  const [product] = await db.select().from(s.products)
    .where(and(eq(s.products.slug, productSlug), eq(s.products.status, 'published'))).limit(1);
  if (!product) return null;
  const sub = family.subs.find((c) => c.id === product.categoryId);
  if (!sub) return null;
  const related = product.relatedIds.length
    ? await db.select().from(s.products).where(and(inArray(s.products.id, product.relatedIds), eq(s.products.status, 'published')))
    : [];
  return { family, sub, product, related: related.map((r) => ({ ...r, familySlug: family.slug })) };
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  return db.select().from(s.products).where(and(inArray(s.products.id, ids), eq(s.products.status, 'published')));
}

/** Every published product with the slugs needed to link it (sitemap, search, studio). */
export async function getAllProducts(): Promise<ProductCard[]> {
  const fams = await getFamilies();
  const out: ProductCard[] = [];
  for (const f of fams) out.push(...(await getProductsInFamily(f)));
  return out;
}

export async function searchProducts(q: string, limit = 24): Promise<ProductCard[]> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const all = await getAllProducts();
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  return all
    .map((p) => {
      const hay = `${p.name} ${p.subName} ${p.summary} ${p.construction} ${p.sku}`.toLowerCase();
      const score = words.reduce((n, w) => n + (hay.includes(w) ? (p.name.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export async function getPage(slug: string) {
  const db = await getDb();
  const [page] = await db.select().from(s.pages).where(and(eq(s.pages.slug, slug), eq(s.pages.status, 'published'))).limit(1);
  return page ?? null;
}

export async function getPublishedPageSlugs(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select({ slug: s.pages.slug }).from(s.pages).where(eq(s.pages.status, 'published'));
  return new Set(rows.map((r) => r.slug));
}

export async function getPublishedPages() {
  const db = await getDb();
  return db.select({ slug: s.pages.slug, title: s.pages.title, section: s.pages.section, updatedAt: s.pages.updatedAt })
    .from(s.pages).where(eq(s.pages.status, 'published'));
}

export async function getArticles() {
  const db = await getDb();
  return db.select().from(s.articles).where(eq(s.articles.status, 'published')).orderBy(desc(s.articles.publishedAt));
}

export async function getArticle(slug: string) {
  const db = await getDb();
  const [a] = await db.select().from(s.articles).where(and(eq(s.articles.slug, slug), eq(s.articles.status, 'published'))).limit(1);
  return a ?? null;
}

/** The markets on the list in content/markets.ts, with their status from the database. */
export async function getMarkets() {
  const db = await getDb();
  return db.select().from(s.markets).where(inArray(s.markets.code, MARKETS.map((m) => m.code))).orderBy(asc(s.markets.region), asc(s.markets.name));
}

/** Facts the owner has entered AND marked verified; anything else is never shown publicly. */
export async function getVerifiedFacts(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select().from(s.facts).where(eq(s.facts.verified, true));
  return Object.fromEntries(rows.filter((r) => r.value.trim()).map((r) => [r.key, r.value.trim()]));
}

export async function getPublishedCertificates() {
  const db = await getDb();
  return db.select().from(s.certificates).where(and(eq(s.certificates.published, true), eq(s.certificates.verified, true)));
}

export async function getPublishedTestimonials() {
  const db = await getDb();
  return db.select().from(s.testimonials)
    .where(and(eq(s.testimonials.published, true), eq(s.testimonials.verified, true), eq(s.testimonials.consentConfirmed, true)));
}

export async function getPublicDocuments() {
  const db = await getDb();
  return db.select().from(s.documents).where(eq(s.documents.visibility, 'public'));
}

export async function getReviewedTranslations(locale: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select().from(s.translations).where(and(eq(s.translations.locale, locale), eq(s.translations.status, 'reviewed')));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export { s, sql, eq, and, or, ilike, isNull, inArray, desc, asc };
