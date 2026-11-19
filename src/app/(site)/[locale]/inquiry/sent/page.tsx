import { localeFrom } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';
import { REFERENCE_PATTERN } from '@/lib/inquiry/reference';
import { PageShell } from '@/components/site/PageShell';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ ref?: string; type?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({ locale, path: '/inquiry/sent', title: 'Request received | Monolith Sports', description: 'Your inquiry reference and what happens next.', noindex: true });
}

export default async function Sent({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { ref, type } = await searchParams;
  const valid = !!ref && REFERENCE_PATTERN.test(ref);
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
            <h1>Your {what} is in</h1>
            <p>Your reference:</p>
            <p className="ref">{ref}</p>
            <p>A copy is on its way to your email. Quote the reference when you write to us.</p>
          </>
        ) : (
          <>
            <h1>Reference not found</h1>
            <p>This page shows the reference of a request you just sent. Check the confirmation email for it.</p>
          </>
        )}
        <div className="btn-row">
          <a className="btn btn--primary" href={`/${locale}/account/register`}>Create a customer account</a>
          <a className="btn btn--secondary" href={`/${locale}/products`}>See the catalogue</a>
        </div>
      </div>
    </PageShell>
  );
}
