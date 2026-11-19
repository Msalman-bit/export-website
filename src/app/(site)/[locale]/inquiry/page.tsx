import Script from 'next/script';
import { headers } from 'next/headers';
import { localeFrom } from '@/lib/i18n/server';
import { getSettings, getDb, s, eq } from '@/lib/data-server';
import { pageMeta } from '@/lib/seo';
import { readSession } from '@/lib/auth/session';
import { PageShell } from '@/components/site/PageShell';
import { InquiryForm } from '@/components/site/InquiryForm';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({ locale, path: '/inquiry', title: 'Request a quote | Monolith Sports', description: 'Send one inquiry for every product you need: quantities, branding, packaging, delivery and files. You get a reference number at once.' });
}

export default async function InquiryPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { type } = await searchParams;
  const settings = await getSettings();
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
    <PageShell locale={locale} crumbs={[{ name: 'Request a quote', path: '/inquiry' }]} close={null}>
      <div className="split-page">
        <div className="block">
          <header className="page-head">
            <h1>Request a quote</h1>
            <p>One request for every product on your list. Tell us the quantities, your branding and where the goods go; the quotation comes back in {settings.currencies.enabled.join(', ').replace(/, ([^,]*)$/, ' or $1')}.</p>
          </header>
          <InquiryForm locale={locale} mode={type === 'sample' ? 'sample' : 'quote'} currencies={settings.currencies.enabled} user={prefill} turnstileKey={turnstile || undefined} />
        </div>
        <aside className="block">
          <div className="form-section">
            <h2>What happens next</h2>
            <ol className="timeline">
              <li className="is-done"><span>You send the request and get a reference number.</span></li>
              <li><span>Sales reviews it and asks about anything missing.</span></li>
              <li><span>You receive the quotation as a PDF.</span></li>
              <li><span>You approve a sample; production starts.</span></li>
            </ol>
            <p className="t-small">With a <a className="link" href={`/${locale}/account/register`}>customer account</a> you can follow every request and download its documents.</p>
          </div>
        </aside>
      </div>
      {turnstile ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} /> : null}
    </PageShell>
  );
}
