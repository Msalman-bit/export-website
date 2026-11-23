import { notFound } from 'next/navigation';
import { localeFrom, getDict, getText } from '@/lib/i18n/server';
import { seoTitle } from '@/lib/i18n/tx';
import { getFamily, getProductsInFamily } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { Img } from '@/components/site/Img';
import { CatalogueFilter } from '@/components/site/CatalogueFilter';
import { pic } from '@/lib/media';
import { shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string; family: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const { family } = await params;
  const [f, tx] = await Promise.all([getFamily(family), getText(locale)]);
  if (!f) return {};
  return pageMeta({
    locale, path: `/products/${family}`,
    title: `${seoTitle(tx, f.seoTitle, f.name, '{name} manufacturer for private label and wholesale')} | Monolith Sports`,
    description: tx(f.seoDescription || f.summary),
    image: pic(f.image?.url, 1200)?.src,
  });
}

/* A family's landing page: the products first (the name, one line, then every product with filters for type and
   construction), the family's longer story and photograph after them, where a buyer who wants more reads on and
   search engines still find it. The filters work without script (a GET form) and instantly with it
   (CatalogueFilter); on a phone they fold into one row. */
export default async function FamilyPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { family } = await params;
  const sp = await searchParams;
  const f = await getFamily(family);
  if (!f) notFound();
  const [t, tx, products] = await Promise.all([getDict(locale), getText(locale), getProductsInFamily(f)]);
  const types = f.subs.map((c) => ({ value: c.slug, label: tx(c.name) }));
  // the filter's value stays the English word (it is in the address); its label is in the page's language
  const constructions = [...new Set(products.flatMap((p) => constructionKeys(p.construction)))].map((c) => ({ value: c, label: tx(c) }));
  const about = `About ${/^[A-Z][a-z]/.test(f.name) ? f.name.charAt(0).toLowerCase() + f.name.slice(1) : f.name}`;
  const initial = {
    type: ([] as string[]).concat(sp.type ?? []),
    construction: ([] as string[]).concat(sp.construction ?? []),
    studio: sp.studio === '1',
  };
  return (
    <PageShell locale={locale} crumbs={[{ name: t['nav.products'], path: '/products' }, { name: tx(f.name), path: `/products/${f.slug}`, lang: tx.lang(f.name) }]} enter="content">
      <header className="page-head">
        <h1 lang={tx.lang(f.name)}>{tx(f.name)}</h1>
        <p lang={tx.lang(f.summary)}>{shortLine(tx(f.summary))}</p>
      </header>
      <CatalogueFilter
        locale={locale}
        labels={{ type: t['filter.type'], construction: t['filter.construction'], studio: t['filter.studio'], result: t['filter.result'], results: t['filter.results'], all: t['filter.all'] }}
        text={tx.pick(['Filter products', 'Filter', 'Filter ({n} selected)', 'Apply filters', 'Clear filters', 'No product matches these filters.', 'Describe your requirements'])}
        types={types}
        constructions={constructions}
        initial={initial}
        products={products.map((p) => ({
          id: p.id, name: tx(p.name), sku: p.sku, summary: tx(p.summary), type: p.subSlug, typeName: tx(p.subName),
          lang: tx.lang(p.name) ?? tx.lang(p.summary),
          constructions: constructionKeys(p.construction), studio: !!p.studioModel,
          href: `/${locale}/products/${f.slug}/${p.slug}`, image: p.images[0] ? { ...p.images[0], alt: tx.has(p.images[0].alt) ? tx(p.images[0].alt) : tx(p.name) } : null,
        }))}
      />
      {f.body || f.image ? (
        <section className="block fam-about" aria-labelledby="fam-about-h">
          <div className="split-page">
            <div className="block">
              {/* "About football equipment": the first letter lowered only for an ordinary word, never an acronym */}
              <h2 id="fam-about-h" lang={tx.lang(about)}>{tx(about)}</h2>
              {f.body ? <p className="t-body" lang={tx.lang(f.body)}>{tx(f.body)}</p> : null}
            </div>
            {f.image ? (
              <figure className="split-page__media" style={{ aspectRatio: '4 / 3', position: 'static' }}>
                <Img url={f.image.url} alt={tx.has(f.image.alt) ? tx(f.image.alt ?? f.name) : tx(f.name)} sizes="(max-width: 1023px) 100vw, 520px" prefer={960} />
              </figure>
            ) : null}
          </div>
        </section>
      ) : null}
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
