import { localeFrom } from '@/lib/i18n/server';
import { getFamilies, getPublicDocuments } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { shortName } from '@/components/site/Header';
import { shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({ locale, path: '/catalogues', title: 'Product catalogues to download | Monolith Sports', description: 'Download the Monolith Sports catalogue as a PDF: every product category, product type and SKU, generated from the live catalogue.' });
}

export default async function Catalogues({ params }: Props) {
  const locale = await localeFrom(params);
  const [families, docs] = await Promise.all([getFamilies(), getPublicDocuments()]);
  return (
    <PageShell locale={locale} crumbs={[{ name: 'Product catalogues', path: '/catalogues' }]} enter="content">
      <header className="page-head">
        <h1>Product catalogues</h1>
        <p>The PDF catalogue is generated from the online catalogue at each download, so it always lists the current products and SKUs</p>
      </header>
      <div className="cards-3">
        <div className="card">
          <h2 className="t-card">Full catalogue</h2>
          <p>All categories in one PDF</p>
          <p><a className="btn btn--primary" href="/api/catalogue" download>Download the full catalogue</a></p>
        </div>
        {families.map((f) => (
          <div className="card" key={f.slug}>
            <h2 className="t-card">{shortName(f)}</h2>
            <p>{shortLine(f.summary)}</p>
            <p><a className="link" href={`/api/catalogue?family=${f.slug}`} download>Download the {shortName(f).toLowerCase()} catalogue</a></p>
          </div>
        ))}
        {docs.map((d) => (
          <div className="card" key={d.id}>
            <h2 className="t-card">{d.title}</h2>
            <p><a className="link" href={`/media/${d.attachmentId}`} download>Download the PDF</a></p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
