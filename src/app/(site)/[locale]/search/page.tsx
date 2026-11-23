import { localeFrom, getDict, getText } from '@/lib/i18n/server';
import { searchProducts } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { Img } from '@/components/site/Img';
import { shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const tx = await getText(locale);
  return pageMeta({ locale, path: '/search', title: tx('Search the catalogue | Monolith Sports'), description: tx('Find a product by name, type, construction or SKU.'), noindex: true });
}

export default async function Search({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { q = '' } = await searchParams;
  const tx = await getText(locale);
  // the words are searched in the page's language as well as in English, and the results shown in it
  const [t, results] = await Promise.all([getDict(locale), searchProducts(q, 24, tx)]);
  const query = q.trim().slice(0, 60);
  return (
    <PageShell locale={locale} crumbs={[{ name: t['nav.search'], path: '/search' }]}>
      <header className="page-head">
        <h1>{t['search.label']}</h1>
        <form className="nav-search" action={`/${locale}/search`} method="get" role="search">
          <label htmlFor="q" className="t-label">{tx('Product name, type or SKU')}</label>
          <div className="nav-search__row">
            <input id="q" name="q" type="search" defaultValue={query} minLength={2} maxLength={60} />
            <button className="btn btn--primary" type="submit">{t['nav.search']}</button>
          </div>
        </form>
      </header>
      {query.length >= 2 ? (
        <section className="block" aria-live="polite">
          <p className="result-count">{tx('{count} for “{query}”', { count: `${results.length} ${results.length === 1 ? t['filter.result'] : t['filter.results']}`, query })}</p>
          {results.length ? (
            <div className="prod-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {results.map((p) => (
                <a key={p.id} className="card tile" href={`/${locale}/products/${p.familySlug}/${p.slug}`} lang={tx.lang(p.name) ?? tx.lang(p.summary)}>
                  <div className="tile__media"><Img url={p.images[0]?.url} alt={tx.has(p.images[0]?.alt) ? tx(p.images[0]?.alt ?? p.name) : tx(p.name)} sizes="300px" prefer={640} /></div>
                  <div className="tile__head"><h2 className="t-card">{tx(p.name)}</h2></div>
                  <p>{shortLine(tx(p.summary))}</p>
                  <p className="sku">{tx(p.subName)}, {p.sku}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty"><p>{t['search.none']}</p><a className="btn btn--secondary" href={`/${locale}/products`}>{t['cta.catalogue']}</a></div>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
