import { notFound } from 'next/navigation';
import Script from 'next/script';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { localeFrom } from '@/lib/i18n/server';
import { getPage, getSettings, getVerifiedFacts, getPublishedCertificates } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';
import { RichText } from '@/components/site/RichText';
import { Img } from '@/components/site/Img';
import { LeadForm } from '@/components/site/LeadForm';
import { CookieChoice } from '@/components/site/CookieChoice';
import { PAGES } from '@/lib/content/pages-data';

type Params = { params: Promise<{ locale: string; slug: string[] }> };
const one = async (p: Params['params']) => { const { slug } = await p; return slug.length === 1 ? slug[0] : ''; };

const SECTION_NAME: Record<string, string> = { company: 'About', manufacturing: 'Manufacturing', support: 'Support', legal: 'Legal' };
/* what each content page's picture shows (the same words the homepage uses for the same picture), for screen
   readers and image search; a picture without an entry stays decorative */
const IMAGE_ALT: Record<string, string> = {
  'intro-stitching': 'A curved needle pulling waxed white thread through the edges of a white hexagon and a black pentagon',
  'process-prototype': 'A finished sample football beside die-cut panels, a steel ruler and calipers',
  'process-packing': 'Export cartons stacked on a wrapped pallet with deflated footballs packed in polybags',
  'custom-embroidery': 'An embroidered chevron emblem in silver and lime thread on black jersey fabric',
  'custom-football': 'A football printed in navy and crimson panels with a geometric shield emblem',
};
const FORMS: Record<string, 'contact' | 'distributor' | 'partnership'> = {
  contact: 'contact', 'become-a-distributor': 'distributor', partnerships: 'partnership',
};

export async function generateMetadata({ params }: Params) {
  const locale = await localeFrom(params);
  const slug = await one(params);
  const page = slug ? await getPage(slug) : null;
  if (!page) return {};
  return pageMeta({
    locale, path: `/${slug}`,
    title: page.seoTitle || `${page.title} | Monolith Sports`,
    description: page.seoDescription || page.summary,
  });
}

export default async function ContentPage({ params }: Params) {
  const locale = await localeFrom(params);
  const slug = await one(params);
  const page = slug ? await getPage(slug) : null;
  if (!page) notFound();
  const image = PAGES.find((p) => p.slug === slug)?.image;
  const [facts, certificates, settings] = await Promise.all([getVerifiedFacts(), slug === 'quality-control' ? getPublishedCertificates() : [], getSettings()]);
  const form = FORMS[slug];
  const consent = (await cookies()).get('ms_consent')?.value;
  const lang = locale === 'en' ? undefined : 'en';

  const factRows = slug === 'about'
    ? ([['founded', 'Founded'], ['town', 'Production'], ['workforce', 'Employees']] as const).filter(([k]) => facts[k])
    : slug === 'contact'
      ? ([['street', 'Address'], ['phone', 'Phone']] as const).filter(([k]) => facts[k])
      : [];

  return (
    <PageShell locale={locale} crumbs={[{ name: SECTION_NAME[page.section] ?? 'Company', path: page.section === 'manufacturing' ? '/manufacturing' : '/about' }, { name: page.title, path: `/${slug}` }].filter((c, i, a) => !(i === 0 && a[1].path === c.path))} enter="content">
      <div className={image ? 'split-page' : 'block'}>
        <div className="block" lang={lang}>
          <header className="page-head">
            <h1>{page.title}</h1>
            <p>{page.summary}</p>
          </header>
          {factRows.length ? (
            <table className="spec-table"><tbody>{factRows.map(([k, label]) => <tr key={k}><th scope="row">{label}</th><td>{facts[k]}</td></tr>)}</tbody></table>
          ) : null}
          <RichText body={page.body} locale={locale} />
          {slug === 'quality-control' && certificates.length ? (
            <div className="block">
              <h2>Certificates on file</h2>
              <table className="spec-table"><tbody>{certificates.map((c) => (
                <tr key={c.id}><th scope="row">{c.name}</th><td>{[c.issuer, c.number, c.scope, c.validUntil && `valid until ${c.validUntil}`].filter(Boolean).join(' · ')}{c.attachmentId ? <> · <a className="link" href={`/media/${c.attachmentId}`}>Certificate document</a></> : null}</td></tr>
              ))}</tbody></table>
            </div>
          ) : null}
          {slug === 'cookies' ? <CookieChoice current={consent ?? ''} analyticsOn={!!settings.analytics.ga4} /> : null}
          {form ? <LeadForm locale={locale} type={form} /> : null}
          {form && process.env.TURNSTILE_SITE_KEY ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={(await headers()).get('x-nonce') ?? undefined} /> : null}
        </div>
        {image ? <figure className="split-page__media"><Img url={`gen:${image}`} alt={IMAGE_ALT[image] ?? ''} sizes="(max-width: 1023px) 100vw, 520px" prefer={960} decorative={!IMAGE_ALT[image]} /></figure> : null}
      </div>
    </PageShell>
  );
}
