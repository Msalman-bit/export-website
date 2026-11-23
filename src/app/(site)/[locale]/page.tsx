import { headers } from 'next/headers';
import { localeFrom, getDict, href } from '@/lib/i18n/server';
import { getFamilies, getMarkets, getPublishedPageSlugs, getSettings } from '@/lib/data';
import { pageMeta, jsonLd, organizationLd } from '@/lib/seo';
import { Img } from '@/components/site/Img';
import { Footer } from '@/components/site/Footer';
import { ExportMap } from '@/components/site/ExportMap';
import { HeroScene } from '@/components/site/HeroScene';
import { QuoteIcon } from '@/components/site/QuoteIcon';
import { shortName } from '@/components/site/Header';
import { pic } from '@/lib/media';

/* Home page plan (docs/PLAN.md):
   type product (site-kind other) · deal: hero film, nav-mega, close-type, footer-columns, rhythm dark-band,
   buttons block, mark dots, palette = the client's own (obsidian, white, lime) via start.mjs brand,
   pairing archivo (condensed by the brief), compositions trio / split / bleed
   moments: pinned-chapters (#process: eight stages walked in four chapters beside one changing frame),
            picture-develops (#customise: the custom range develops like a print as it enters) */

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  return pageMeta({
    locale, path: '/',
    title: 'Monolith Sports: custom sports equipment made in Pakistan for European clubs and brands',
    description: 'Footballs, gloves, teamwear and training equipment made in Pakistan for your brand, sampled before the bulk order and quoted in EUR, GBP or USD.',
  });
}

const Arrow = () => (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path className="m-arrow__stem" d="M1 6h8" /><path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
);

const RANGE_TITLE: Record<string, string> = {
  football: 'Footballs and goalkeeper gloves', futsal: 'Futsal balls in sizes 3 and 4', rugby: 'Rugby balls and headguards',
  handball: 'Handballs for clubs and schools', cricket: 'Cricket bats, balls and pads',
  'combat-sports': 'Boxing and MMA gloves', fitness: 'Lifting belts and gym gloves', 'racket-sports': 'Racket covers and bags',
  sportswear: 'Football kits and teamwear', accessories: 'Sports bags, cones and bibs',
};


/* The hero film's four chapters (seq.json stages split the film into them): the idea is drawn, it is made, it carries
   the buyer's brand, and it is the whole range. Only what the site states elsewhere: files are accepted with an
   inquiry, a sample is approved before the bulk order, and quotes come in EUR, GBP or USD. */
const HERO_CHAPTERS = [
  { step: 'Your design', line: 'Start with a sketch', text: 'A drawing, a logo or a reference ball is enough for us to begin.' },
  { step: 'Production', line: 'Built panel by panel', text: 'The bladder, the lining and the panels are assembled and stitched together.' },
  { step: 'Your branding', line: 'Printed in your colours', text: 'You approve a sample before the bulk order goes into production.' },
  { step: 'Your range', line: 'One manufacturer for your whole range', text: 'Request footballs, handballs and rugby balls in one inquiry, quoted in EUR, GBP or USD.' },
];

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const [t, families, markets, pages, settings] = await Promise.all([
    getDict(locale), getFamilies(), getMarkets(), getPublishedPageSlugs(), getSettings(),
  ]);
  const p = (await headers()).get('x-pathname') ?? `/${locale}`;
  const L = (x: string) => href(locale, x);
  const hero = pic('gen:hero-football', 1920);
  const heroPhone = pic('gen:hero-football-phone', 1080);
  // the portrait crops a phone shows where these two photographs take the section's height
  const termsPhone = pic('gen:terms-swatches-phone', 648);
  const faqPhone = pic('gen:faq-valve-phone', 720);
  const qualityPhone = pic('gen:quality-seam-phone', 720);
  const enLang = locale === 'en' ? undefined : 'en';

  return (
    <>
      <main id="top">
        <section className="hero hero--film hero--scroll" data-enter aria-labelledby="hero-h">
          <div className="wrap"><div className="hero-text hero__in">
            <div className="hero__media hero__fill">
              {/* CLIENT FILE scroll film: the generated film (a pencil sketch becomes the bladder, the panels are stitched on, the
                  print appears, then a handball and a rugby ball), cut with scripts/build-hero-frames.mjs into
                  public/assets/img/hero-film; replace it with a take of the real ball the same way. The still below is the
                  poster and the fallback (reduced motion, no script, no AVIF). Stand-ins: generated concepts. */}
              {hero ? (
                <picture>
                  {heroPhone ? <source media="(max-width: 639px), (max-width: 1023px) and (orientation: portrait)" srcSet={heroPhone.srcSet} sizes="100vw" /> : null}
                  <img src={hero.src} srcSet={hero.srcSet} sizes="(max-width: 1440px) 100vw, 1280px" width={hero.width} height={hero.height}
                    alt="A white and black hand-stitched football, seen very close, with lime accent lines"
                    fetchPriority="high" decoding="sync" data-source="stand-in" data-subject="match football"
                    style={{ '--ly-pos': '78% 50%', '--ly-pos-phone': '60% 22%' } as React.CSSProperties} />
                </picture>
              ) : null}
              <div className="hero__over">
                <div>
                  <h1 id="hero-h">Custom and private-label sports equipment made in Pakistan</h1>
                  {/* the film's chapters (html.hero-seq only): a large line per stage of the film, led by HeroScene; the
                      paragraph below stays for screen readers and is the words when the film is off */}
                  <div className="hero-chapters" aria-hidden="true" lang={enLang}>
                    {HERO_CHAPTERS.map((c, i) => (
                      <p key={c.step} className="hero-chapter" data-state={i === 0 ? 'on' : 'future'}
                        style={{ '--n': c.line.split(' ').length } as React.CSSProperties}>
                        <span className="hero-chapter__step">{c.step}</span>
                        <span className="hero-chapter__line">
                          {c.line.split(' ').map((w, k) => (
                            <span key={k}><span className="hcw"><span className="hcw__in" style={{ '--k': k } as React.CSSProperties}>{w}</span></span>{' '}</span>
                          ))}
                        </span>
                        <span className="hero-chapter__text">{c.text}</span>
                      </p>
                    ))}
                  </div>
                  <p className="hero__lead" lang={enLang}>We make footballs, gloves, teamwear and training equipment for your brand, supply a sample before the bulk order and ship to clubs and distributors across Europe.</p>
                  <div className="btn-row">
                    <a className="btn btn--primary" href={L('/inquiry')}>{t['cta.quote']}<QuoteIcon /></a>
                    <a className="btn btn--secondary" href={L('/products')}>{t['cta.catalogue']}</a>
                  </div>
                </div>
              </div>
              {/* after the words, so the keyboard meets the two main buttons first */}
              <HeroScene lang={enLang} />
            </div>
          </div></div>
        </section>

        <section className="section" id="range" aria-labelledby="range-h">
          <div className="wrap">
            <div className="section-head section-head--row">
              <div><h2 id="range-h">Product range</h2><p lang={enLang}>One inquiry can cover products from several categories</p></div>
              <a className="link" href={L('/products')}>See all products</a>
            </div>
            {/* the range as an index: one picture beside the ten families; the picture follows the family a
                visitor points at (first family at rest) */}
            <div className="grid range-index fill">
              <div className="range-index__pics span-6">
                {families.map((f, i) => (
                  <Img key={f.slug} url={f.image?.url} alt={f.image?.alt ?? f.name} decorative={i > 0}
                    sizes="(max-width: 1023px) 100vw, 616px" prefer={i === 0 ? 1200 : 960} />
                ))}
              </div>
              <ul className="range-index__list span-6 start-7">
                {families.map((f) => (
                  <li key={f.slug}>
                    <a href={L(`/products/${f.slug}`)}>
                      <span className="range-index__name">{shortName(f)}</span>
                      <span className="range-index__line" lang={enLang}>{RANGE_TITLE[f.slug] ?? f.summary}</span>
                      <Arrow />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="section" id="about" aria-labelledby="about-h">
          <div className="wrap">
            <div className="grid grid--top intro__head">
              <h2 id="about-h" className="span-5">Sports equipment made for your brand</h2>
              <div className="intro__text span-7 start-6" lang={enLang}>
                <p>We make and source sports equipment in Pakistan for businesses abroad. Send us a design or a reference product, and we make a sample, produce the order with your branding and arrange the export.</p>
                <a className="link" href={L('/about')}>Read about Monolith Sports</a>
              </div>
            </div>
            <div className="grid grid--top trio">
              <figure className="span-5"><Img url="gen:intro-stitching" alt="A curved needle pulling waxed white thread through the edges of a white hexagon and a black pentagon" sizes="(max-width: 639px) 342px, (max-width: 1023px) 300px, 519px" prefer={960} /></figure>
              <figure className="span-4"><Img url="gen:intro-panels" alt="A stack of die-cut white hexagon and black pentagon football panels with punched stitch holes" sizes="(max-width: 639px) 220px, (max-width: 1023px) 400px, 576px" prefer={800} /></figure>
              <figure className="span-3"><Img url="gen:intro-thread" alt="Spools of waxed white thread and two curved stitching needles on a steel workbench" sizes="(max-width: 639px) 165px, (max-width: 1023px) 300px, 432px" prefer={640} /></figure>
            </div>
          </div>
        </section>

        <section className="section" id="terms" aria-labelledby="terms-h">
          <div className="wrap grid grid--top terms-split">
            <div className="span-5 terms-split__text">
              <div className="section-head">
                <h2 id="terms-h">Quotation and order terms</h2>
                <p lang={enLang}>Each quotation is prepared for one order and covers its products, quantities, branding and destination</p>
              </div>
              <ul className="rows terms" lang={enLang}>
              <li><span className="rows__name">Currencies</span><p>{settings.currencies.enabled.join(', ').replace(/, ([^,]*)$/, ' or $1')}, selected on the inquiry form</p></li>
              <li><span className="rows__name">Minimum order quantity</span><p>Set per product and stated in the quotation</p></li>
              <li><span className="rows__name">Samples</span><p>Requested from any product page and approved before production starts</p></li>
              <li><span className="rows__name">Lead time</span><p>Confirmed in the quotation and counted from sample approval</p></li>
              <li><span className="rows__name">Shipping</span><p>Sea freight, air freight or courier, to your forwarder or your premises</p></li>
              <li><span className="rows__name">Artwork</span><p>Up to 5 files of 10 MB each (PDF, AI, EPS, PNG, JPG or WEBP), attached to the inquiry</p></li>
              </ul>
            </div>
            <figure className="side-photo side-photo--tall span-7 start-6"><picture>{termsPhone ? <source media="(max-width: 639px)" srcSet={termsPhone.srcSet} sizes="100vw" /> : null}<Img url="gen:terms-swatches" alt="Synthetic leather colour swatches, a cut football panel, a measuring tape and a ruler on a steel desk" sizes="(max-width: 1023px) 100vw, 740px" prefer={1280} /></picture></figure>
          </div>
        </section>

        <section className="section" id="process" style={{ '--h': 2 } as React.CSSProperties} data-moment="pinned-chapters" aria-labelledby="process-h">
          <div className="wrap mo-pc__grid">
            <div className="mo-pc__text">
              <h2 id="process-h">Order process from brief to shipment</h2>
              <ol className="mo-pc__steps" lang={enLang}>
                <li className="mo-pc__step">
                  <h3>Product development</h3>
                  <p>We carry out the research, choose materials that suit where the product is used and draw the design for your approval.</p>
                  <figure className="mo-pc__visual"><Img url="gen:process-materials" alt="Rolls and swatches of white, black, silver and lime synthetic leather on a steel workbench" sizes="(max-width: 1023px) 100vw, 960px" prefer={1280} /></figure>
                </li>
                <li className="mo-pc__step">
                  <h3>Sample approval</h3>
                  <p>We make a sample with your materials, colours and branding. Production starts only after you approve it.</p>
                  <figure className="mo-pc__visual"><Img url="gen:process-prototype" alt="A finished sample football beside die-cut panels, a steel ruler and calipers" sizes="(max-width: 1023px) 100vw, 960px" prefer={1280} /></figure>
                </li>
                <li className="mo-pc__step">
                  <h3>Production and inspection</h3>
                  <p>The bulk order is made to match the approved sample and is checked lot by lot before packing.</p>
                  <figure className="mo-pc__visual"><Img url="gen:process-inspection" alt="A football resting in a ring gauge beside a digital scale and a measuring tape" sizes="(max-width: 1023px) 100vw, 960px" prefer={1280} /></figure>
                </li>
                <li className="mo-pc__step">
                  <h3>Packing and shipment</h3>
                  <p>The order is packed and labelled to your instructions, then booked by sea, air or courier with its export documents.</p>
                  <figure className="mo-pc__visual"><Img url="gen:process-packing" alt="Export cartons stacked on a wrapped pallet with deflated footballs packed in polybags" sizes="(max-width: 1023px) 100vw, 960px" prefer={1280} /></figure>
                </li>
              </ol>
              <p><a className="link" href={L('/manufacturing')}>Read how production works</a></p>
            </div>
            <div className="mo-pc__visuals frame" />
          </div>
        </section>

        <section className="section" id="customise" aria-labelledby="custom-h">
          <div className="wrap grid grid--top">
            <div className="span-5 stack-5 customise__text">
              <h2 id="custom-h">Colours, logo and packaging to your specification</h2>
              <p className="t-lead" lang={enLang}>Choose the panel colours, place your logo and select the packaging in the customisation studio. The preview is attached to your inquiry.</p>
              <p lang={enLang}>The preview is a visual concept; production follows the approved sample.</p>
              <p><a className="link" href={L('/studio')}>{t['cta.configure']}</a></p>
            </div>
            <figure className="develop span-7 start-6" data-moment="picture-develops">
              <Img url="gen:custom-range" alt="Four footballs in custom club colourways: navy and crimson, black and lime, white and silver, green and white" sizes="(max-width: 1023px) 100vw, 737px" prefer={1200} />
            </figure>
          </div>
        </section>

        <section className="section ground-inverse" id="quality" aria-labelledby="quality-h">
          <div className="wrap">
            <div className="grid grid--top quality__head">
              <div className="span-5"><h2 id="quality-h" data-type-moment="letters">Quality control and inspection</h2></div>
              <div className="quality__text span-7 start-6" lang={enLang}>
                <p>Every lot is checked against the sample you approved: size, weight, seams, print and packing count.</p>
                <a className="link" href={L('/quality-control')}>Read how orders are inspected</a>
              </div>
            </div>
            <div className="quality__photo"><picture>
              {qualityPhone ? <source media="(max-width: 639px)" srcSet={qualityPhone.srcSet} sizes="100vw" /> : null}
              <Img url="gen:quality-seam" alt="Close-up of tight hand-stitched seams where white hexagon panels meet a black pentagon" sizes="(max-width: 639px) 670px, (max-width: 1023px) 130vw, (max-width: 1440px) 90vw, 1280px" prefer={1920} />
            </picture></div>
          </div>
        </section>

        <section className="section" id="markets" aria-labelledby="markets-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="markets-h">Export markets in Europe</h2>
              <p lang={enLang}>Ireland, the United Kingdom and the European Union are our priority markets. Quotations cover delivery to your forwarder, your port or your premises.</p>
            </div>
            <ExportMap markets={markets} />
          </div>
        </section>

        <section className="section" id="faq" aria-labelledby="faq-h">
          <div className="wrap grid grid--top faq-split">
            <div className="span-5 faq-split__text">
              <div className="section-head">
                <h2 id="faq-h">Frequently asked questions</h2>
                <p lang={enLang}>Answers for trade buyers on samples, custom designs and certificates</p>
              </div>
              <div className="btn-row">
                <a className="btn btn--primary" href={L('/inquiry')}>{t['cta.quote']}<QuoteIcon /></a>
                {pages.has('faq') ? <a className="btn btn--secondary" href={L('/faq')}>Read all answers</a> : null}
              </div>
              <figure className="side-photo side-photo--faq"><picture>{faqPhone ? <source media="(max-width: 639px)" srcSet={faqPhone.srcSet} sizes="100vw" /> : null}<Img url="gen:faq-valve" alt="The inflation valve in a white hexagon panel of a football, its stitched seams sharp" sizes="(max-width: 1023px) 100vw, 519px" prefer={960} /></picture></figure>
            </div>
            <div className="faq span-7 start-6" lang={enLang}>
            <div className="faq__item"><h3>Do you sell to individual players?</h3><p>No. We supply businesses: clubs, academies, schools, retailers, distributors and brands.</p></div>
            <div className="faq__item"><h3>Can we order a sample before the bulk order?</h3><p>Yes. Request one from any product page; the quotation lists its cost and lead time.</p></div>
            <div className="faq__item"><h3>Can you make a product to our own design?</h3><p>Yes. Send drawings, a reference product or a written brief, and we will develop the product with you.</p></div>
            <div className="faq__item"><h3>Are your products certified?</h3><p>We list a certificate on this site only when the document itself is published here. Tell us your market, and the quotation will name the tests that apply.</p></div>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} t={t} families={families} pages={pages} path={p} salesEmail={settings.company.salesEmail}
        close={{ title: 'Send us your product list', line: 'One form covers every product you need. You receive a reference number immediately.' }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationLd())} />
    </>
  );
}
