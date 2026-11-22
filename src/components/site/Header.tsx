import type { Dict } from '@/lib/i18n/dictionaries';
import { LOCALES, LOCALE_NAMES, swapLocale, type Locale } from '@/lib/i18n/config';
import { href } from '@/lib/i18n/server';
import type { Family } from '@/lib/data';
import { Img } from './Img';
import { HeaderSearch } from './HeaderSearch';
import { CATALOGUE } from '@/lib/catalogue-data';
import { pic } from '@/lib/media';

// a family added in the admin has no short name of its own: "Basketball equipment" reads "Basketball", like the others
export const shortName = (f: { slug: string; name: string }) => CATALOGUE.find((c) => c.slug === f.slug)?.short ?? (f.name.replace(/\s+equipment$/i, '') || f.name);

/* nav-mega (sections-library.md): five words, Products/Manufacturing/Customisation/Resources/About open a
   panel after 150ms of hover; a click on the word goes to its page. Search and language are two more
   items: search opens in place (HeaderSearch; a plain link on a phone), language has a small list under
   its word; system.js turns the bar into the phone sheet. Plain links: every page is a
   full load, so the kit's scripts start fresh on each one. */

const FAMILY_LINE: Record<string, string> = {
  football: 'Balls, gloves, shin guards', futsal: 'Match, training, junior balls', rugby: 'Balls and protection',
  handball: 'Match, training, junior balls', cricket: 'Bats, balls, gloves, pads',
  'combat-sports': 'Gloves, bags, pads, guards', fitness: 'Belts, gloves, wraps, bands', 'racket-sports': 'Padel, tennis, badminton',
  sportswear: 'Kits, training wear, teamwear', accessories: 'Bags, cones, bibs, aids',
};

const Chev = () => (
  <svg className="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

type Link = { label: string; line: string; path: string; slug?: string };

export function Header({ locale, t, families, pages, path }: {
  locale: Locale; t: Dict; families: Family[]; pages: Set<string>; path: string;
}) {
  const L = (p: string) => href(locale, p);
  const live = (links: Link[]) => links.filter((l) => !l.slug || pages.has(l.slug));
  const section = path.split('/')[2] || '';
  const current = (key: string) => (section === key ? { 'aria-current': 'page' as const } : {});

  const half = Math.ceil(families.length / 2);
  const services = live([
    { label: 'OEM manufacturing', line: 'Your design, made to spec', path: '/oem-manufacturing', slug: 'oem-manufacturing' },
    { label: 'ODM manufacturing', line: 'Our base, your brand', path: '/odm-manufacturing', slug: 'odm-manufacturing' },
    { label: 'Private labelling', line: 'Your labels and packaging', path: '/private-label', slug: 'private-label' },
    { label: 'Custom development', line: 'New products from a brief', path: '/custom-development', slug: 'custom-development' },
  ]);
  const production = live([
    { label: 'Capabilities', line: 'What we make and how', path: '/manufacturing', slug: 'manufacturing' },
    { label: 'Factory and facilities', line: 'Visits and video audits', path: '/factory', slug: 'factory' },
    { label: 'Quality control', line: 'Checks against your sample', path: '/quality-control', slug: 'quality-control' },
    { label: 'Research and development', line: 'From brief to prototype', path: '/research-development', slug: 'research-development' },
  ]);
  const guides = live([
    { label: 'Insights', line: 'Guides for buyers', path: '/insights' },
    { label: 'Questions', line: 'Orders, samples, files', path: '/faq', slug: 'faq' },
    { label: 'Product catalogues', line: 'PDF catalogue to download', path: '/catalogues' },
  ]);
  const ordering = live([
    { label: 'Sample ordering', line: 'Approve before bulk', path: '/sample-ordering', slug: 'sample-ordering' },
    { label: 'Global exports', line: 'Markets and currencies', path: '/global-exports', slug: 'global-exports' },
  ]);
  // the Customisation menu: the studio, and the services that make a product to a buyer's own brief (lines the site
  // already uses in its other menus and on the homepage)
  const studio: Link[] = [
    { label: 'Customisation studio', line: 'Colours and logo on a football', path: '/studio' },
    { label: 'Your inquiry list', line: 'Products added so far', path: '/inquiry' },
  ];
  const madeForYou = live([
    { label: 'Private labelling', line: 'Your labels and packaging', path: '/private-label', slug: 'private-label' },
    { label: 'Custom development', line: 'New products from a brief', path: '/custom-development', slug: 'custom-development' },
    { label: 'Sample ordering', line: 'Approve before bulk', path: '/sample-ordering', slug: 'sample-ordering' },
  ]);
  const company = live([
    { label: 'Mission and vision', line: 'What we work towards', path: '/mission-vision', slug: 'mission-vision' },
    { label: 'Company history', line: 'How we started', path: '/company-history', slug: 'company-history' },
    { label: 'Sustainability', line: 'Freight, packing, materials', path: '/sustainability', slug: 'sustainability' },
    { label: 'Ethical sourcing', line: 'Labour and audits', path: '/ethical-sourcing', slug: 'ethical-sourcing' },
  ]);
  const work = live([
    { label: 'Become a distributor', line: 'Sell our range in your region', path: '/become-a-distributor', slug: 'become-a-distributor' },
    { label: 'Partnerships', line: 'Supply and co-development', path: '/partnerships', slug: 'partnerships' },
    { label: 'Contact', line: 'Write to the sales team', path: '/contact', slug: 'contact' },
    { label: t['footer.portal'], line: 'Quotes, orders, tracking', path: '/account' },
  ]);

  // the page you are on keeps its row in a menu (aria-current), like the bar's own words do
  const here = (p: string) => (L(p).split('?')[0] === path ? { 'aria-current': 'page' as const } : {});
  const col = (title: string, links: Link[]) => (
    <div className="menu-col span-3">
      <p className="t-label">{title}</p>
      {links.map((l) => (
        <a key={l.path} href={L(l.path)} {...here(l.path)}>{l.label}<span>{l.line}</span></a>
      ))}
    </div>
  );
  // the picture tile that fills the rest of a panel (columns 7-12): one of the site's pages, its photograph over its words
  const tile = (p: { path: string; url: string; alt: string; title: string; line: string }) => (
    <a className="menu-card menu-card--feature span-6 start-7" href={L(p.path)} {...here(p.path)}>
      <div className="panel"><Img className="frame__img" url={p.url} alt={p.alt} eager sizes="600px" prefer={960} /></div>
      <span className="t-card">{p.title}</span>
      <span className="t-small muted">{p.line}</span>
    </a>
  );
  // the next steps at a panel's foot: what its own lists do not already offer (the header bar carries the quote)
  const nextSteps = [{ label: t['cta.sample'], path: '/inquiry?type=sample' }, pages.has('contact') && { label: 'Write to the sales team', path: '/contact' }] as ({ label: string; path: string } | false)[];
  const foot = (...links: ({ label: string; path: string } | false)[]) => (
    <div className="menu-foot">
      {links.flatMap((l) => (l ? [<a key={l.path} className="link" href={L(l.path)}>{l.label}</a>] : []))}
    </div>
  );

  return (
    <header className="nav">
      <div className="wrap nav__bar">
        <a className="skip-link" href="#top">{t.skip}</a>
        <a className="nav__logo" href={L('/')}><span className="mark" data-mark="dots" aria-hidden="true" />Monolith Sports</a>
        <nav className="nav__links" aria-label={t['nav.main']}>
          <div className="nav__item">
            <a className="nav__link" href={L('/products')} {...current('products')}>{t['nav.products']} <Chev /></a>
            <div className="nav__menu">
              <div className="wrap grid">
                {col('Product families', families.slice(0, half).map((f) => ({ label: shortName(f), line: FAMILY_LINE[f.slug] ?? '', path: `/products/${f.slug}` })))}
                {col('More families', families.slice(half).map((f) => ({ label: shortName(f), line: FAMILY_LINE[f.slug] ?? '', path: `/products/${f.slug}` })))}
                {tile({ path: '/studio', url: 'gen:nav-footballs', alt: 'Five footballs in different colourways in a row', title: 'Customisation studio', line: 'Colours and logo on a football' })}
                {foot({ label: t['cta.catalogue'], path: '/products' }, { label: t['cta.sample'], path: '/inquiry?type=sample' }, { label: t['nav.basket'], path: '/inquiry' })}
              </div>
            </div>
          </div>
          <div className="nav__item">
            <a className="nav__link" href={L('/manufacturing')} {...current('manufacturing')}>{t['nav.manufacturing']} <Chev /></a>
            <div className="nav__menu">
              <div className="wrap grid">
                {col('Services', services)}
                {col('Production', production)}
                {tile({ path: '/sample-ordering', url: 'gen:process-prototype', alt: 'A sample football beside die-cut panels, a ruler and calipers', title: 'Sample ordering', line: 'See it before the bulk order' })}
                {foot(...nextSteps)}
              </div>
            </div>
          </div>
          <div className="nav__item nav__item--wide">
            <a className="nav__link" href={L('/studio')} {...current('studio')}>{t['nav.customisation']} <Chev /></a>
            <div className="nav__menu">
              <div className="wrap grid">
                {col('Design it yourself', studio)}
                {madeForYou.length ? col('Made for you', madeForYou) : null}
                {tile({ path: '/studio', url: 'gen:custom-range', alt: 'Four footballs in custom club colourways: navy and crimson, black and lime, white and silver, green and white', title: 'Your colours, logo and packaging', line: 'The preview goes into your inquiry' })}
                {foot(...nextSteps)}
              </div>
            </div>
          </div>
          <div className="nav__item nav__item--wide">
            <a className="nav__link" href={L('/insights')} {...current('insights')}>{t['nav.resources']} <Chev /></a>
            <div className="nav__menu">
              <div className="wrap grid">
                {col('Guides', guides)}
                {col('Ordering', ordering)}
                {pages.has('shipping-logistics')
                  ? tile({ path: '/shipping-logistics', url: 'gen:process-packing', alt: 'Export cartons stacked on a wrapped pallet with deflated footballs packed in polybags', title: 'Shipping and logistics', line: 'Sea, air and courier' })
                  : tile({ path: '/catalogues', url: 'gen:terms-swatches', alt: 'Synthetic leather colour swatches, a cut football panel, a measuring tape and a ruler on a steel desk', title: 'Product catalogues', line: 'PDF catalogue to download' })}
                {foot(...nextSteps)}
              </div>
            </div>
          </div>
          <div className="nav__item">
            <a className="nav__link" href={L('/about')} {...current('about')}>{t['nav.about']} <Chev /></a>
            <div className="nav__menu">
              <div className="wrap grid">
                {col('Company', company)}
                {col('Work with us', work)}
                {tile({ path: '/about', url: 'gen:intro-stitching', alt: 'A curved needle pulling waxed white thread through the edges of a white hexagon and a black pentagon', title: 'About Monolith Sports', line: 'Who we are and who for' })}
                {foot({ label: t['cta.sample'], path: '/inquiry?type=sample' }, { label: t['cta.catalogue'], path: '/products' })}
              </div>
            </div>
          </div>
          <div className="nav__item nav__item--tool nav__item--search">
            <a className="nav__link" href={L('/search')} aria-label={t['nav.search']} {...current('search')}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11.6 11.6 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <span className="nav__tool-label">{t['nav.search']}</span>
            </a>
            <HeaderSearch locale={locale} searchHref={L('/search')} catalogueHref={L('/products')}
              families={families.map((f) => ({ name: shortName(f), href: L(`/products/${f.slug}`), image: pic(f.image?.url, 160)?.src ?? null }))}
              text={{ label: t['nav.search'], short: t['search.short'], all: t['search.all'], none: t['search.none'], result: t['filter.result'], results: t['filter.results'], catalogue: t['cta.catalogue'] }} />
          </div>
          <div className="nav__item nav__item--tool nav__item--lang">
            <a className="nav__link" href={swapLocale(path, locale)} aria-label={`${t['nav.language']}: ${LOCALE_NAMES[locale]}`} lang={locale}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M1.6 8h12.8M8 1.4c2 2 2 11.2 0 13.2M8 1.4c-2 2-2 11.2 0 13.2" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
              {locale.toUpperCase()} <Chev />
            </a>
            <div className="nav__menu">
              <div className="wrap grid">
                <div className="menu-col span-3">
                  <p className="t-label">{t['nav.language']}</p>
                  {LOCALES.map((l) => (
                    <a key={l} href={swapLocale(path, l)} hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined}>
                      {LOCALE_NAMES[l]}<span>{l.toUpperCase()}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div className="nav__actions">
          <a className="nav__link nav-signin" href={L('/account')}>{t['nav.signIn']}</a>
          <a className="btn btn--primary" href={L('/inquiry')}>{t['cta.quote']}</a>
        </div>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label={t['nav.menu']}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
    </header>
  );
}
