import { localeFrom, getDict, getText } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';
import { REFERENCE_PATTERN } from '@/lib/inquiry/reference';
import { PageShell } from '@/components/site/PageShell';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ ref?: string; type?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const tx = await getText(locale);
  return pageMeta({ locale, path: '/inquiry/sent', title: tx('Request received | Monolith Sports'), description: tx('Your inquiry reference and what happens next.'), noindex: true });
}

export default async function Sent({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { ref, type } = await searchParams;
  const valid = !!ref && REFERENCE_PATTERN.test(ref);
  const [t, tx] = await Promise.all([getDict(locale), getText(locale)]);
  const what = type === 'sample' ? 'sample request' : type === 'quote' ? 'quotation request' : 'message';
  return (
    <PageShell locale={locale} crumbs={[]} close={null}>
      <div className={`page-head${valid ? ' sent' : ''}`}>
        {valid ? (
          <>
            <svg className="sent__check" viewBox="0 0 48 48" aria-hidden="true">
              <circle className="sent__ring" cx="24" cy="24" r="22" />
              <path className="sent__tick" d="M14 24.5l7 7 13-14" />
            </svg>
            <h1>{tx(`Your ${what} has been received`)}</h1>
            <p>{tx('Your reference number:')}</p>
            <p className="ref">{ref}</p>
            <p>{tx('A copy will be sent to your email address. Please quote this reference when you contact us.')}</p>
          </>
        ) : (
          <>
            <h1>{tx('Reference not found')}</h1>
            <p>{tx('This page shows the reference number of a request you have just sent. You will also find it in your confirmation email.')}</p>
          </>
        )}
        <div className="btn-row">
          <a className="btn btn--primary" href={`/${locale}/account/register`}>{tx('Create a customer account')}</a>
          <a className="btn btn--secondary" href={`/${locale}/products`}>{t['cta.catalogue']}</a>
        </div>
      </div>
    </PageShell>
  );
}
