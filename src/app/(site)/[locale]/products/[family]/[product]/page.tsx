import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { localeFrom, getDict } from '@/lib/i18n/server';
import { getProduct } from '@/lib/data';
import { pageMeta, jsonLd, siteUrl } from '@/lib/seo';
import { pic } from '@/lib/media';
import { shortLine } from '@/lib/text';
import { track } from '@/lib/audit';
import { countryFrom } from '@/lib/security/request';
import { readSession } from '@/lib/auth/session';
import { PageShell } from '@/components/site/PageShell';
import { Gallery } from '@/components/site/Gallery';
import { AddToInquiry } from '@/components/site/AddToInquiry';
import { SaveProduct } from '@/components/site/SaveProduct';
import { Img } from '@/components/site/Img';

type Props = { params: Promise<{ locale: string; family: string; product: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const { family, product } = await params;
  const data = await getProduct(family, product);
  if (!data) return {};
  const p = data.product;
  return pageMeta({
    locale, path: `/products/${family}/${product}`,
    title: `${p.seoTitle || p.name} | Monolith Sports`,
    description: p.seoDescription || p.summary,
    image: pic(p.images[0]?.url, 1200)?.src,
  });
}

export default async function ProductPage({ params }: Props) {
  const locale = await localeFrom(params);
  const { family, product } = await params;
  const data = await getProduct(family, product);
  if (!data) notFound();
  const { product: p, sub, related, family: fam } = data;
  const t = await getDict(locale);
  const h = await headers();
  await track('product_view', { path: `/products/${family}/${product}`, productId: p.id, country: countryFrom(h), locale });
  const user = await readSession('customer');
  const onQuote = t['product.onQuote'];
  const main = pic(p.images[0]?.url, 640);
  const href = `/${locale}/products/${family}/${product}`;

  const rows: [string, string][] = [
    [t['product.sku'], p.sku],
    [t['product.construction'], p.construction || onQuote],
    [t['product.materials'], p.materials || onQuote],
    [t['product.sizes'], p.sizes.length ? p.sizes.join(', ') : onQuote],
    [t['product.weight'], p.weight || onQuote],
    [t['product.colours'], p.colours.length ? p.colours.join(', ') : 'Your colours, matched to Pantone references'],
    [t['product.moq'], p.moq || onQuote],
    [t['product.leadTime'], p.leadTime || onQuote],
    [t['product.testing'], p.testingStandards.length ? p.testingStandards.join(', ') : 'Named in the quotation for your market'],
    ...p.specs.map((s) => [s.label, s.value] as [string, string]),
  ];

  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, description: p.summary,
    brand: { '@type': 'Brand', name: 'Monolith Sports' }, category: sub.name,
    image: p.images.map((im) => pic(im.url, 1200)?.src).filter(Boolean).map((u) => `${siteUrl()}${u}`),
    url: `${siteUrl()}${href}`,
  };

  return (
    <PageShell locale={locale} crumbs={[
      { name: t['nav.products'], path: '/products' }, { name: fam.name, path: `/products/${fam.slug}` }, { name: p.name, path: `/products/${fam.slug}/${p.slug}` },
    ]} enter="media">
      <div className="pdp">
        <Gallery images={p.images} spin={p.spinFrames} name={p.name} />
        <div className="buy">
          <p className="sku">{sub.name}, {t['product.sku']} {p.sku}</p>
          <h1>{p.name}</h1>
          <p className="t-lead">{shortLine(p.summary)}</p>
          <AddToInquiry locale={locale} product={{ id: p.id, name: p.name, sku: p.sku, image: main?.src, href }}
            labels={{ add: t['cta.add'], sample: t['cta.sample'], added: t['cta.added'], quantity: t['basket.quantity'], quote: t['cta.quote'] }} />
          <div className="btn-row">
            <a className="link" href={`/api/products/${p.id}/datasheet`} download>{t['cta.datasheet']}</a>
            {p.studioModel ? <a className="link" href={`/${locale}/studio?product=${p.id}`}>Design it in the studio</a> : null}
            {user?.emailVerifiedAt ? <SaveProduct productId={p.id} label={t['cta.save']} /> : null}
          </div>
        </div>
      </div>

      <div className="split-page split-page--even">
        <section className="block" aria-labelledby="desc-h">
          <h2 id="desc-h">About this product</h2>
          <div className="prose"><p>{p.description}</p></div>
          {p.brandingOptions.length ? (<><h3>{t['product.branding']}</h3><ul className="chips">{p.brandingOptions.map((b) => <li key={b}>{b}</li>)}</ul></>) : null}
          {p.packagingOptions.length ? (<><h3>{t['product.packaging']}</h3><ul className="chips">{p.packagingOptions.map((b) => <li key={b}>{b}</li>)}</ul></>) : null}
        </section>
        <section className="block" aria-labelledby="spec-h">
          <h2 id="spec-h">{t['product.specs']}</h2>
          <table className="spec-table"><tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
        </section>
      </div>

      {related.length ? (
        <section className="block" aria-labelledby="rel-h">
          <h2 id="rel-h">{t['product.related']}</h2>
          <div className="fam-grid">
            {related.map((r) => (
              <a key={r.id} className="card tile" href={`/${locale}/products/${r.familySlug}/${r.slug}`}>
                <div className="tile__media"><Img url={r.images[0]?.url} alt={r.images[0]?.alt ?? r.name} sizes="(max-width: 1023px) 50vw, 302px" prefer={640} /></div>
                <div className="tile__head"><h3>{r.name}</h3></div>
                <p>{shortLine(r.summary)}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </PageShell>
  );
}
