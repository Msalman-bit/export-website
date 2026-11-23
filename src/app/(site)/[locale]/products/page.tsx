import { localeFrom, getDict, getText } from '@/lib/i18n/server';
import { getFamilies } from '@/lib/data';
import { pageMeta, jsonLd } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { Img } from '@/components/site/Img';
import { shortName } from '@/components/site/Header';
import { siteUrl } from '@/lib/seo';
import { shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string }> };


export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const [families, tx] = await Promise.all([getFamilies(), getText(locale)]);
  // the names come from the categories on show, so one hidden or emptied in the admin leaves the text too (no number is
  // stated); German keeps its nouns' capitals
  const names = families.map((f) => tx(shortName(f))).map((n) => (locale === 'de' ? n : n.toLowerCase()));
  return pageMeta({
    locale, path: '/products',
    title: tx('Sports equipment catalogue: footballs, gloves and teamwear | Monolith Sports'),
    description: tx('Sports equipment made in Pakistan for clubs, distributors and private-label brands: {list}.', { list: tx.list(names) }),
  });
}

export default async function Products({ params }: Props) {
  const locale = await localeFrom(params);
  const [t, tx, families] = await Promise.all([getDict(locale), getText(locale), getFamilies()]);
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: families.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: tx(f.name), url: `${siteUrl()}/${locale}/products/${f.slug}` })),
  };
  return (
    <PageShell locale={locale} crumbs={[{ name: t['nav.products'], path: '/products' }]}>
      <header className="page-head">
        <h1>{tx('Product catalogue')}</h1>
        <p>{tx('Every product in the catalogue is made to your specification, for your brand. Open a category to filter its products, or add products from several categories to one inquiry.')}</p>
      </header>
      <div className="fam-grid">
        {families.map((f) => (
          <a key={f.slug} className="card tile" href={`/${locale}/products/${f.slug}`}>
            <div className="tile__media"><Img url={f.image?.url} alt={tx.has(f.image?.alt) ? tx(f.image?.alt ?? f.name) : tx(f.name)} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 302px" prefer={640} /></div>
            <div className="tile__head"><h2 className="t-card" lang={tx.lang(shortName(f))}>{tx(shortName(f))}</h2></div>
            <p lang={tx.lang(f.summary)}>{shortLine(tx(f.summary))}</p>
            <p className="sku">{f.subs.length === 1 ? tx('1 product type') : tx('{n} product types', { n: f.subs.length })}</p>
          </a>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(list)} />
    </PageShell>
  );
}
