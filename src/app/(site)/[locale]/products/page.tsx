import { localeFrom, getDict } from '@/lib/i18n/server';
import { getFamilies } from '@/lib/data';
import { pageMeta, jsonLd } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { Img } from '@/components/site/Img';
import { shortName } from '@/components/site/Header';
import { siteUrl } from '@/lib/seo';
import { shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string }> };

// the names come from the categories on show, so one hidden or emptied in the admin leaves the text too (no number is stated)
const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '');

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const families = await getFamilies();
  return pageMeta({
    locale, path: '/products',
    title: 'Sports equipment catalogue: footballs, gloves and teamwear | Monolith Sports',
    description: `Sports equipment made in Pakistan for clubs, distributors and private-label brands: ${listOf(families.map((f) => shortName(f).toLowerCase()))}.`,
  });
}

export default async function Products({ params }: Props) {
  const locale = await localeFrom(params);
  const [t, families] = await Promise.all([getDict(locale), getFamilies()]);
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: families.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: f.name, url: `${siteUrl()}/${locale}/products/${f.slug}` })),
  };
  return (
    <PageShell locale={locale} crumbs={[{ name: t['nav.products'], path: '/products' }]}>
      <header className="page-head">
        <h1>Product catalogue</h1>
        <p>Every product in the catalogue is made to your specification, for your brand. Open a category to filter its products, or add products from several categories to one inquiry.</p>
      </header>
      <div className="fam-grid">
        {families.map((f) => (
          <a key={f.slug} className="card tile" href={`/${locale}/products/${f.slug}`}>
            <div className="tile__media"><Img url={f.image?.url} alt={f.image?.alt ?? f.name} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 302px" prefer={640} /></div>
            <div className="tile__head"><h2 className="t-card">{shortName(f)}</h2></div>
            <p>{shortLine(f.summary)}</p>
            <p className="sku">{f.subs.length} product {f.subs.length === 1 ? 'type' : 'types'}</p>
          </a>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(list)} />
    </PageShell>
  );
}
