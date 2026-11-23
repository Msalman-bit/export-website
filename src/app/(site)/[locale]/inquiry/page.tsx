import Script from 'next/script';
import { headers } from 'next/headers';
import { Fragment } from 'react';
import { localeFrom, getDict, getText, formText, formCountries } from '@/lib/i18n/server';
import { getSettings, getDb, s, eq } from '@/lib/data-server';
import { pageMeta } from '@/lib/seo';
import { readSession } from '@/lib/auth/session';
import { PageShell } from '@/components/site/PageShell';
import { InquiryForm } from '@/components/site/InquiryForm';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const tx = await getText(locale);
  return pageMeta({ locale, path: '/inquiry', title: tx('Request a quotation | Monolith Sports'), description: tx('Send one inquiry for every product you need: quantities, branding, packaging, delivery and files. You receive a reference number immediately.') });
}

export default async function InquiryPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { type } = await searchParams;
  const [settings, t, tx] = await Promise.all([getSettings(), getDict(locale), getText(locale)]);
  const user = await readSession('customer');
  let prefill = null;
  if (user?.companyId) {
    const db = await getDb();
    const [co] = await db.select().from(s.companies).where(eq(s.companies.id, user.companyId)).limit(1);
    prefill = { company: co?.name ?? '', name: user.name, email: user.email, country: co?.country ?? '' };
  }
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const turnstile = process.env.TURNSTILE_SITE_KEY || '';
  return (
    <PageShell locale={locale} crumbs={[{ name: t['cta.quote'], path: '/inquiry' }]} close={null}>
      <div className="split-page">
        <div className="block">
          <header className="page-head">
            <h1>{t['cta.quote']}</h1>
            <p>{tx('Use one request for every product on your list. Tell us the quantities, the branding and the destination, and we will send the quotation in {list}.', { list: tx.list(settings.currencies.enabled, 'or') })}</p>
          </header>
          <InquiryForm locale={locale} mode={type === 'sample' ? 'sample' : 'quote'} pickSaved={type !== 'sample' && type !== 'quote'} currencies={settings.currencies.enabled} user={prefill} turnstileKey={turnstile || undefined}
            text={formText(t, tx)} countries={locale === 'en' ? undefined : formCountries(tx)} />
        </div>
        <aside className="block">
          <div className="form-section">
            <h2>{tx('Next steps')}</h2>
            <ol className="timeline">
              <li className="is-done"><span>{tx('You send the request and receive a reference number.')}</span></li>
              <li><span>{tx('Our sales team reviews the request and asks for any missing details.')}</span></li>
              <li><span>{tx('You receive the quotation as a PDF.')}</span></li>
              <li><span>{tx('You approve a sample, and production starts.')}</span></li>
            </ol>
            <p className="t-small">{tx('With a {link}, you can follow every request and download its documents.').split('{link}').map((part, k) => (
              k === 0 ? part : <Fragment key={k}><a className="link" href={`/${locale}/account/register`}>{tx('customer account')}</a>{part}</Fragment>
            ))}</p>
          </div>
        </aside>
      </div>
      {turnstile ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} /> : null}
    </PageShell>
  );
}
