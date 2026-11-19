import type { MetadataRoute } from 'next';
import { getAllProducts, getArticles, getFamilies, getPublishedPages, getSettings } from '@/lib/data';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/* /sitemap.xml: every published page in every indexed language, each with its hreflang alternates.
   Unpublished drafts, account pages and search results are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const settings = await getSettings();
  const langs = settings.locales.indexed;
  const [families, products, pages, articles] = await Promise.all([getFamilies(), getAllProducts(), getPublishedPages(), getArticles()]);
  const paths: { path: string; modified?: Date; priority: number }[] = [
    { path: '', priority: 1 }, { path: '/products', priority: 0.9 }, { path: '/studio', priority: 0.7 }, { path: '/inquiry', priority: 0.8 },
    { path: '/insights', priority: 0.5 }, { path: '/catalogues', priority: 0.6 },
    ...families.map((f) => ({ path: `/products/${f.slug}`, modified: f.updatedAt, priority: 0.8 })),
    ...products.map((p) => ({ path: `/products/${p.familySlug}/${p.slug}`, modified: p.updatedAt, priority: 0.7 })),
    ...pages.map((p) => ({ path: `/${p.slug}`, modified: p.updatedAt, priority: p.section === 'legal' ? 0.2 : 0.6 })),
    ...articles.map((a) => ({ path: `/insights/${a.slug}`, modified: a.updatedAt, priority: 0.5 })),
  ];
  return paths.flatMap((p) => langs.map((l) => ({
    url: `${base}/${l}${p.path}`,
    lastModified: p.modified ?? new Date(),
    priority: p.priority,
    alternates: { languages: Object.fromEntries(langs.map((x) => [x, `${base}/${x}${p.path}`])) },
  })));
}
