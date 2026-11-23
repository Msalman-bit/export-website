import type { Dict } from '@/lib/i18n/dictionaries';
import { LOCALES, LOCALE_NAMES, swapLocale, type Locale } from '@/lib/i18n/config';
import { href } from '@/lib/i18n/server';
import type { Family } from '@/lib/data';
import { shortName } from './Header';
import { QuoteIcon } from './QuoteIcon';

/* footer.closing (layout-v4.md): row 1 the dealt close (close-type), row 2 the directory
   (footer-columns) with the one newsletter field and the legal row. */

export type Close = { title: string; line: string; action?: { label: string; path: string } } | null;

const Arrow = () => (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path className="m-arrow__stem" d="M1 6h8" /><path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
);

export function Footer({ locale, t, families, pages, path, close, salesEmail }: {
  locale: Locale; t: Dict; families: Family[]; pages: Set<string>; path: string; close: Close; salesEmail: string;
}) {
  const L = (p: string) => href(locale, p);
  const page = (slug: string, label: string) => (pages.has(slug) ? <li key={slug}><a href={L(`/${slug}`)}>{label}</a></li> : null);
  const year = new Date().getFullYear();
  const legal = (slug: string, label: string) => (pages.has(slug) ? <a key={slug} href={L(`/${slug}`)}>{label}</a> : null);
  return (
    <footer className="footer closing g2m" id="contact" aria-labelledby={close ? 'close-h' : undefined} aria-label={close ? undefined : 'Footer'}>
      <div className="wrap">
        {close ? (
          <div className="closing__cta close--type">
            <div className="section-head">
              <h2 id="close-h">{close.title}</h2>
              <p>{close.line}</p>
            </div>
            <a className="btn btn--primary btn--xl" href={L(close.action?.path ?? '/inquiry')}>{close.action?.label ?? t['cta.quote']}{(close.action?.path ?? '/inquiry') === '/inquiry' ? <QuoteIcon /> : <Arrow />}</a>
          </div>
        ) : null}
        <div className="closing__links">
          <div className="grid">
            <div className="span-4 stack-4 footer__brand">
              <a className="nav__logo" href={L('/')}><span className="mark" data-mark="dots" aria-hidden="true" />Monolith Sports</a>
              <p className="footer__lede">{t['footer.line']}</p>
              <form className="form newsletter" action={`mailto:${salesEmail}`} method="post" encType="text/plain" data-endpoint="/api/newsletter"
                data-sent={t['footer.subscribed']} noValidate>
                <input type="hidden" name="locale" value={locale} />
                <div className="field field--full">
                  <label htmlFor="nl-email">{t['footer.email']}</label>
                  <div className="newsletter__row">
                    <input id="nl-email" name="email" type="email" autoComplete="email" inputMode="email" required aria-describedby="nl-email-err" />
                    <button className="btn btn--secondary" type="submit">{t['footer.subscribe']}</button>
                  </div>
                  <p className="field__error" id="nl-email-err" hidden>{t['footer.emailError']}</p>
                </div>
                <div className="newsletter__trap" aria-hidden="true"><label htmlFor="nl-company">Company</label><input id="nl-company" name="company" tabIndex={-1} autoComplete="off" /></div>
                <p className="form__status t-small" role="status" data-form-status></p>
              </form>
              <nav className="footer__langs" aria-label={t['nav.language']}>
                {LOCALES.map((l) => (
                  <a key={l} href={swapLocale(path, l)} hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined} title={LOCALE_NAMES[l]}>{l.toUpperCase()}</a>
                ))}
              </nav>
            </div>
            <div className="span-2 footer__col">
              <h3>{t['footer.products']}</h3>
              <ul>{families.map((f) => <li key={f.slug}><a href={L(`/products/${f.slug}`)}>{shortName(f)}</a></li>)}</ul>
            </div>
            <div className="span-2 footer__col">
              <h3>{t['footer.manufacturing']}</h3>
              <ul>
                {page('oem-manufacturing', 'OEM manufacturing')}{page('odm-manufacturing', 'ODM manufacturing')}
                {page('private-label', 'Private labelling')}{page('custom-development', 'Custom development')}
                {page('manufacturing', 'Capabilities')}{page('quality-control', 'Quality control')}
                {page('factory', 'Factory and facilities')}{page('research-development', 'Research and development')}
              </ul>
            </div>
            <div className="span-2 footer__col">
              <h3>{t['footer.company']}</h3>
              <ul>
                {page('about', 'About')}{page('company-history', 'Company history')}{page('mission-vision', 'Mission and vision')}
                {page('sustainability', 'Sustainability')}{page('ethical-sourcing', 'Ethical sourcing')}{page('global-exports', 'Global exports')}
                {page('become-a-distributor', 'Become a distributor')}{page('partnerships', 'Partnerships')}
              </ul>
            </div>
            <div className="span-2 footer__col">
              <h3>{t['footer.support']}</h3>
              <ul>
                {page('contact', t['footer.contactForm'])}
                <li><a href={`mailto:${salesEmail}`}>{t['footer.emailUs']}</a></li>
                {page('faq', 'FAQ')}{page('sample-ordering', 'Sample ordering')}{page('shipping-logistics', 'Shipping')}
                <li><a href={L('/catalogues')}>Catalogues</a></li>
                <li><a href={L('/insights')}>Insights</a></li>
                <li><a href={L('/account')}>{t['footer.portal']}</a></li>
              </ul>
            </div>
          </div>
          <div className="footer__legal">
            <span className="footer__legal-links">
              <span>&copy; {year} Monolith Sports</span>
              {legal('privacy', t['footer.privacy'])}{legal('cookies', t['footer.cookies'])}{legal('terms', t['footer.terms'])}{legal('accessibility', t['footer.accessibility'])}
            </span>
            <div className="socials" />
          </div>
        </div>
      </div>
    </footer>
  );
}
