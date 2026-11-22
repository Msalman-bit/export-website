import { notFound } from 'next/navigation';
import { localeFrom } from '@/lib/i18n/server';
import { getArticle } from '@/lib/data';
import { pageMeta, jsonLd, siteUrl } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { RichText } from '@/components/site/RichText';
import { longDate, shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return {};
  return pageMeta({ locale, path: `/insights/${slug}`, title: `${a.seoTitle || a.title} | Monolith Sports`, description: a.seoDescription || a.summary, type: 'article' });
}

export default async function Article({ params }: Props) {
  const locale = await localeFrom(params);
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.summary,
    datePublished: a.publishedAt?.toISOString(), dateModified: a.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: a.author || 'Monolith Sports' }, publisher: { '@type': 'Organization', name: 'Monolith Sports' },
    mainEntityOfPage: `${siteUrl()}/${locale}/insights/${slug}`,
  };
  return (
    <PageShell locale={locale} crumbs={[{ name: 'Insights', path: '/insights' }, { name: a.title, path: `/insights/${slug}` }]} enter="content">
      <article className="block" lang={locale === 'en' ? undefined : 'en'}>
        <header className="page-head">
          <h1>{a.title}</h1>
          <p>{shortLine(a.summary)}</p>
          <p className="t-small muted">{[a.author, longDate(a.publishedAt)].filter(Boolean).join(', ')}</p>
        </header>
        <RichText body={a.body} locale={locale} />
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </PageShell>
  );
}
