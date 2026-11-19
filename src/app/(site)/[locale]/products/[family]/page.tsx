import { notFound } from 'next/navigation';
import { localeFrom, getDict } from '@/lib/i18n/server';
import { getFamily, getProductsInFamily } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { Img } from '@/components/site/Img';
import { CatalogueFilter } from '@/components/site/CatalogueFilter';
import { pic } from '@/lib/media';

type Props = { params: Promise<{ locale: string; family: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const { family } = await params;
  const f = await getFamily(family);
  if (!f) return {};
  return pageMeta({
    locale, path: `/products/${family}`,
    title: f.seoTitle ? `${f.seoTitle} | Monolith Sports` : `${f.name} | Monolith Sports`,
    description: f.seoDescription || f.summary,
    image: pic(f.image?.url, 1200)?.src,
  });
}

/* A family's landing page: its story, then every product with filters for type and construction.
   The filters work without script (a GET form) and instantly with it (CatalogueFilter). */
export default async function FamilyPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { family } = await params;
  const sp = await searchParams;
  const f = await getFamily(family);
  if (!f) notFound();
  const [t, products] = await Promise.all([getDict(locale), getProductsInFamily(f)]);
  const types = f.subs.map((c) => ({ value: c.slug, label: c.name }));
  const constructions = [...new Set(products.flatMap((p) => constructionKeys(p.construction)))].map((c) => ({ value: c, label: c }));
  const initial = {
    type: ([] as string[]).concat(sp.type ?? []),
    construction: ([] as string[]).concat(sp.construction ?? []),
    studio: sp.studio === '1',
  };
  return (
    <PageShell locale={locale} crumbs={[{ name: t['nav.products'], path: '/products' }, { name: f.name, path: `/products/${f.slug}` }]} enter="media">
      <div className="split-page">
        <header className="page-head">
          <h1>{f.name}</h1>
          <p>{f.summary}</p>
          <p className="t-body">{f.body}</p>
        </header>
        <figure className="split-page__media" style={{ aspectRatio: '4 / 3', position: 'static' }}>
          <Img url={f.image?.url} alt={f.image?.alt ?? f.name} sizes="(max-width: 1023px) 100vw, 520px" prefer={960} eager />
        </figure>
      </div>
      <CatalogueFilter
        locale={locale}
        labels={{ type: t['filter.type'], construction: t['filter.construction'], studio: t['filter.studio'], result: t['filter.result'], results: t['filter.results'], all: t['filter.all'] }}
        types={types}
        constructions={constructions}
        initial={initial}
        products={products.map((p) => ({
          id: p.id, name: p.name, sku: p.sku, summary: p.summary, type: p.subSlug, typeName: p.subName,
          constructions: constructionKeys(p.construction), studio: !!p.studioModel,
          href: `/${locale}/products/${f.slug}/${p.slug}`, image: p.images[0] ?? null,
        }))}
      />
    </PageShell>
  );
}

/** The filter values a free-text construction offers: a ball made thermally bonded or hand-stitched appears under both. */
function constructionKeys(c: string): string[] {
  const s = c.toLowerCase();
  const keys: string[] = [];
  if (s.includes('thermally')) keys.push('Thermally bonded');
  if (s.includes('hand-stitched')) keys.push('Hand-stitched');
  if (s.includes('machine')) keys.push('Machine-stitched');
  if (s.includes('hybrid')) keys.push('Hybrid');
  if (s.includes('sublimat') || s.includes('cut and sewn') || s.includes('flatlock')) keys.push('Cut and sewn');
  if (s.includes('moulded')) keys.push('Moulded');
  if (!keys.length && (s.includes('padd') || s.includes('foam'))) keys.push('Padded');
  return keys.length ? keys : ['Other'];
}
