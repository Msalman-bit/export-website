import { headers } from 'next/headers';
import type { Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/server';
import { getFamilies, getPublishedPageSlugs, getSettings } from '@/lib/data';
import { Footer, type Close } from './Footer';
import { jsonLd, breadcrumbLd } from '@/lib/seo';

/* The frame of every inner page: main, breadcrumbs (with their structured data) and the footer. */
export async function PageShell({ locale, crumbs, children, close, mainClass = 'page', enter }: {
  locale: Locale; crumbs: { name: string; path: string }[]; children: React.ReactNode; close?: Close; mainClass?: string;
  /* the page's entrance on load: 'content' (the heading rises, the photo settles) for pages read once,
     'media' (the photo settles only) for catalogue pages browsed again and again; none by default */
  enter?: 'content' | 'media';
}) {
  const [t, families, pages, settings] = await Promise.all([getDict(locale), getFamilies(), getPublishedPageSlugs(), getSettings()]);
  const path = (await headers()).get('x-pathname') ?? `/${locale}`;
  const trail = [{ name: 'Home', path: '' }, ...crumbs];
  return (
    <>
      <main id="top" className={mainClass} data-page-enter={enter}>
        <div className="wrap">
          {crumbs.length ? (
            <nav aria-label="Breadcrumb">
              <ol className="crumbs">
                {trail.map((c, i) => (
                  <li key={c.path}>{i < trail.length - 1 ? <a href={`/${locale}${c.path}`}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
                ))}
              </ol>
            </nav>
          ) : null}
          {children}
        </div>
      </main>
      <Footer locale={locale} t={t} families={families} pages={pages} path={path} salesEmail={settings.company.salesEmail}
        close={close === undefined ? { title: 'Send us your product list', line: 'One form covers every product you need. You receive a reference number immediately.' } : close} />
      {crumbs.length ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd(trail.map((c) => ({ name: c.name, url: `/${locale}${c.path}` }))))} /> : null}
    </>
  );
}
