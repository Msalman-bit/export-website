import { localeFrom } from '@/lib/i18n/server';
import { getArticles } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { longDate, shortLine } from '@/lib/text';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({ locale, path: '/insights', title: 'Insights for sports equipment buyers | Monolith Sports', description: 'Guides on football constructions and private-label briefs for clubs, distributors and brands.' });
}

export default async function Insights({ params }: Props) {
  const locale = await localeFrom(params);
  const articles = await getArticles();
  return (
    <PageShell locale={locale} crumbs={[{ name: 'Insights', path: '/insights' }]} enter="content">
      <header className="page-head">
        <h1>Insights for buyers</h1>
        <p>Practical guides on football constructions and private-label briefs, written for clubs, distributors and brands</p>
      </header>
      <div className="cards-3" lang={locale === 'en' ? undefined : 'en'}>
        {articles.map((a) => (
          <a key={a.id} className="card" href={`/${locale}/insights/${a.slug}`}>
            <p className="t-label muted">{longDate(a.publishedAt)}</p>
            <h2 className="t-card">{a.title}</h2>
            <p>{shortLine(a.summary)}</p>
          </a>
        ))}
      </div>
    </PageShell>
  );
}
