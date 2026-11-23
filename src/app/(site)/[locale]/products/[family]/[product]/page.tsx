import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { localeFrom, getDict, getText } from '@/lib/i18n/server';
import { seoTitle } from '@/lib/i18n/tx';
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
  const [data, tx] = await Promise.all([getProduct(family, product), getText(locale)]);
  if (!data) return {};
  const p = data.product;
  return pageMeta({
    locale, path: `/products/${family}/${product}`,
    title: `${seoTitle(tx, p.seoTitle, p.name, '{name}: custom and private-label manufacturing')} | Monolith Sports`,
    description: tx(p.seoDescription || p.summary),
    image: pic(p.images[0]?.url, 1200)?.src,
  });
}

export default async function ProductPage({ params }: Props) {
  const locale = await localeFrom(params);
  const { family, product } = await params;
  const data = await getProduct(family, product);
  if (!data) notFound();
  const { product: p, sub, related, family: fam } = data;
  const [t, tx] = await Promise.all([getDict(locale), getText(locale)]);
  const h = await headers();
  await track('product_view', { path: `/products/${family}/${product}`, productId: p.id, country: countryFrom(h), locale });
  const user = await readSession('customer');
  const onQuote = t['product.onQuote'];
  const main = pic(p.images[0]?.url, 640);
  const href = `/${locale}/products/${family}/${product}`;

  // each row: label, value, and lang="en" for a value (or an owner's own label) with no translation yet
  type Row = [label: string, value: string, valueLang?: string, labelLang?: string];
  const one = (label: string, v: string, fallback = onQuote): Row => (v ? [label, tx(v), tx.lang(v)] : [label, fallback]);
  const many = (label: string, vs: string[], fallback = onQuote): Row =>
    (vs.length ? [label, vs.map((v) => tx(v)).join(', '), vs.some((v) => tx.lang(v)) ? 'en' : undefined] : [label, fallback]);
  const rows: Row[] = [
    [t['product.sku'], p.sku],
    one(t['product.construction'], p.construction),
    one(t['product.materials'], p.materials),
    many(t['product.sizes'], p.sizes),
    one(t['product.weight'], p.weight),
    many(t['product.colours'], p.colours, tx('Your colours, matched to Pantone references')),
    one(t['product.moq'], p.moq),
    one(t['product.leadTime'], p.leadTime),
    many(t['product.testing'], p.testingStandards, tx('Named in the quotation for your market')),
    ...p.specs.map((s): Row => [tx(s.label), tx(s.value), tx.lang(s.value), tx.lang(s.label)]),
  ];
  const name = tx(p.name);
  // the pictures' words: a description with a translation, else the product's name (and "detail" for the others)
  const images = p.images.map((im, n) => ({ ...im, alt: tx.has(im.alt) ? tx(im.alt) : n === 0 ? name : tx('{name}, detail', { name }) }));

  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name, sku: p.sku, description: tx(p.summary),
    brand: { '@type': 'Brand', name: 'Monolith Sports' }, category: tx(sub.name),
    image: p.images.map((im) => pic(im.url, 1200)?.src).filter(Boolean).map((u) => `${siteUrl()}${u}`),
    url: `${siteUrl()}${href}`,
  };

  return (
    <PageShell locale={locale} crumbs={[
      { name: t['nav.products'], path: '/products' }, { name: tx(fam.name), path: `/products/${fam.slug}`, lang: tx.lang(fam.name) }, { name, path: `/products/${fam.slug}/${p.slug}`, lang: tx.lang(p.name) },
    ]} enter="media">
      <div className="pdp">
        <Gallery images={images} spin={p.spinFrames} name={name}
          text={tx.pick(['Drag, or use the arrow keys, to turn the product.', 'Click the picture to zoom; move the pointer to look closer.', 'Tap the picture to zoom; drag to look closer.', 'Zoom into {alt}', 'Zoom out of {alt}', '{name}, 360-degree view', '{name}, view {n} of {total}', 'Show view {n}: {alt}'])} />
        <div className="buy">
          <p className="sku"><span lang={tx.lang(sub.name)}>{tx(sub.name)}</span>, {t['product.sku']} {p.sku}</p>
          <h1 lang={tx.lang(p.name)}>{name}</h1>
          <p className="t-lead" lang={tx.lang(p.summary)}>{shortLine(tx(p.summary))}</p>
          <AddToInquiry locale={locale} product={{ id: p.id, name, sku: p.sku, image: main?.src, href }}
            labels={{ add: t['cta.add'], sample: t['cta.sample'], added: t['cta.added'], quantity: t['basket.quantity'], quote: t['cta.quote'] }}
            text={tx.pick(['Enter a whole number of 1 or more.', 'Sample request for {name}: added to your inquiry.', '{n} × {name}: added to your inquiry.', 'Open your inquiry list', 'You are requesting samples first.', 'Switch to a bulk quotation'])} />
          <div className="btn-row">
            <a className="link" href={`/api/products/${p.id}/datasheet`} download>{t['cta.datasheet']}</a>
            {p.studioModel ? <a className="link" href={`/${locale}/studio?product=${p.id}`}>{tx('Design it in the studio')}</a> : null}
            {user?.emailVerifiedAt ? <SaveProduct productId={p.id} label={t['cta.save']} /> : null}
          </div>
        </div>
      </div>

      <div className="split-page split-page--even">
        <section className="block" aria-labelledby="desc-h">
          <h2 id="desc-h">{tx('About this product')}</h2>
          <div className="prose"><p lang={tx.lang(p.description)}>{tx(p.description)}</p></div>
          {p.brandingOptions.length ? (<><h3>{t['product.branding']}</h3><ul className="chips">{p.brandingOptions.map((b) => <li key={b} lang={tx.lang(b)}>{tx(b)}</li>)}</ul></>) : null}
          {p.packagingOptions.length ? (<><h3>{t['product.packaging']}</h3><ul className="chips">{p.packagingOptions.map((b) => <li key={b} lang={tx.lang(b)}>{tx(b)}</li>)}</ul></>) : null}
        </section>
        <section className="block" aria-labelledby="spec-h">
          <h2 id="spec-h">{t['product.specs']}</h2>
          <table className="spec-table"><tbody>{rows.map(([k, v, vLang, kLang]) => <tr key={k}><th scope="row" lang={kLang}>{k}</th><td lang={vLang}>{v}</td></tr>)}</tbody></table>
        </section>
      </div>

      {related.length ? (
        <section className="block" aria-labelledby="rel-h">
          <h2 id="rel-h">{t['product.related']}</h2>
          <div className="fam-grid">
            {related.map((r) => (
              <a key={r.id} className="card tile" href={`/${locale}/products/${r.familySlug}/${r.slug}`}>
                <div className="tile__media"><Img url={r.images[0]?.url} alt={tx.has(r.images[0]?.alt) ? tx(r.images[0]?.alt ?? r.name) : tx(r.name)} sizes="(max-width: 1023px) 50vw, 302px" prefer={640} /></div>
                <div className="tile__head"><h3 lang={tx.lang(r.name)}>{tx(r.name)}</h3></div>
                <p lang={tx.lang(r.summary)}>{shortLine(tx(r.summary))}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </PageShell>
  );
}
