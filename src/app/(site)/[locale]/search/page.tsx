import { localeFrom, getDict } from '@/lib/i18n/server';
import { searchProducts } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { Img } from '@/components/site/Img';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({ locale, path: '/search', title: 'Search the catalogue | Monolith Sports', description: 'Find a product by name, type, construction or SKU.', noindex: true });
}

export default async function Search({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { q = '' } = await searchParams;
  const [t, results] = await Promise.all([getDict(locale), searchProducts(q)]);
  const query = q.trim().slice(0, 60);
  return (
    <PageShell locale={locale} crumbs={[{ name: t['nav.search'], path: '/search' }]}>
      <header className="page-head">
        <h1>{t['search.label']}</h1>
        <form className="nav-search" action={`/${locale}/search`} method="get" role="search">
          <label htmlFor="q" className="t-label">Product name, type or SKU</label>
          <div className="nav-search__row">
            <input id="q" name="q" type="search" defaultValue={query} minLength={2} maxLength={60} />
            <button className="btn btn--primary" type="submit">{t['nav.search']}</button>
          </div>
        </form>
      </header>
      {query.length >= 2 ? (
        <section className="block" aria-live="polite">
          <p className="result-count">{results.length} {results.length === 1 ? t['filter.result'] : t['filter.results']} for “{query}”</p>
          {results.length ? (
            <div className="prod-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {results.map((p) => (
                <a key={p.id} className="card tile" href={`/${locale}/products/${p.familySlug}/${p.slug}`}>
                  <div className="tile__media"><Img url={p.images[0]?.url} alt={p.images[0]?.alt ?? p.name} sizes="300px" prefer={640} /></div>
                  <div className="tile__head"><h2 className="t-card">{p.name}</h2></div>
                  <p>{p.summary}</p>
                  <p className="sku">{p.subName} · {p.sku}</p>
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
