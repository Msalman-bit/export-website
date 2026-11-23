import Script from 'next/script';
import { KIT_VERSION } from '@/lib/kit-version';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { localeFrom, getDict, getText } from '@/lib/i18n/server';
import { getFamilies, getPublishedPageSlugs, getSettings } from '@/lib/data';
import { Header } from '@/components/site/Header';
import { ConsentBanner } from '@/components/site/ConsentBanner';
import { SiteMotion } from '@/components/site/SiteMotion';

// Every public page renders per request: the CSP nonce, the language and the database change per request.
export const dynamic = 'force-dynamic';
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

/* The :root block as start.mjs brand printed it for Monolith's own colours (obsidian #080808, white,
   lime #C5F900, a silver-white surface), Archivo, radius sharp. One change, from the brief: headlines
   set condensed (the brief asks for condensed display type; Archivo's width axis runs 62 to 125). */
const ROOT = `:root {
  --p-bg: #ffffff; --p-surface: #eef0f2; --p-ink: #080808; --p-muted: #6a6a6a;
  --p-accent: #c5f900; --p-accent-ink: #080808; --p-action: #080808; --p-action-ink: #ffffff;
  --p-inv-bg: #080808; --p-inv-surface: #151515; --p-inv-ink: #ffffff; --p-inv-muted: #959595;
  --p-inv-accent: #c5f900; --p-inv-accent-ink: #080808; --p-inv-action: #c5f900; --p-inv-action-ink: #080808;
  --font-display: "Archivo", system-ui, sans-serif;
  --font-text: "Archivo", system-ui, sans-serif;
  --display-weight: 400;
  --display-tracking: -0.025em;
  --display-tracking-xl: -0.035em;
  --display-stretch: 82%;
  --ly-scale: 0.9;
}`;

// m-enter: the hero's one entrance. The empty touchstart listener makes iOS Safari show :active, so a button
// answers the moment a finger lands on it, as it does under a mouse (iOS skips :active without one).
const ENTER = "document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700);document.addEventListener('touchstart',function(){},{passive:true})";
const HERO_SEQ = "try{if(matchMedia('(prefers-reduced-motion: no-preference)').matches&&(innerWidth<640||innerHeight>=420)){document.documentElement.classList.add('hero-seq');var c=navigator.connection,s=c&&c.saveData?'sm':innerWidth>=1024?'lg':(devicePixelRatio||1)>=1.5?'md':'sm',l=document.createElement('link');l.rel='preload';l.as='image';l.href='/assets/img/hero-film/'+s+'/0001.avif';l.type='image/avif';l.setAttribute('fetchpriority','high');document.head.appendChild(l)}}catch(e){}";
const MO = "document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const settings = await getSettings();
  if (!settings.locales.enabled.includes(locale)) redirect('/en');
  const h = await headers();
  const nonce = h.get('x-nonce') ?? undefined;
  const path = h.get('x-pathname') ?? `/${locale}`;
  const isHome = path === `/${locale}` || path === `/${locale}/`;
  const [t, tx, families, pages] = await Promise.all([getDict(locale), getText(locale), getFamilies(), getPublishedPageSlugs()]);
  const consent = (await cookies()).get('ms_consent')?.value;
  const ga = settings.analytics.ga4?.trim();

  return (
    <html lang={locale} data-type="product" data-radius="sharp" data-buttons="block" data-motion="" suppressHydrationWarning>
      <head>
        <meta name="site-kind" content="other" />
        <meta name="page-type" content="product" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href={`/assets/system.css?v=${KIT_VERSION}`} />
        <link rel="stylesheet" href="/assets/ui/cards.css" />
        <link rel="stylesheet" href="/assets/motion/motion.css" />
        <link rel="stylesheet" href="/assets/backgrounds/backgrounds.css" />
        <link rel="stylesheet" href="/assets/layout/layout.css" />
        <link rel="stylesheet" href="/assets/icons/icon.css" />
        <style>{ROOT}</style>
        <link rel="stylesheet" href="/site/site.css" />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ENTER }} />
        {isHome ? (
          <>
            <script nonce={nonce} dangerouslySetInnerHTML={{ __html: HERO_SEQ }} />
            <script nonce={nonce} dangerouslySetInnerHTML={{ __html: MO }} />
            <link rel="modulepreload" href="/assets/moments/moments.js" />
            <link rel="modulepreload" href="/assets/moments/lib.js" />
            <link rel="modulepreload" href="/assets/moments/pinned-chapters/moment.js" />
            <link rel="modulepreload" href="/assets/moments/picture-develops/moment.js" />
          </>
        ) : null}
      </head>
      <body>
        <Header locale={locale} t={t} tx={tx} families={families} pages={pages} path={path} />
        {children}
        <SiteMotion />
        {ga ? <ConsentBanner locale={locale} decided={!!consent} /> : null}
        {ga && consent === 'analytics' ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`} strategy="afterInteractive" nonce={nonce} />
            <Script id="ga4" strategy="afterInteractive" nonce={nonce}>
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('config',${JSON.stringify(ga)},{anonymize_ip:true});`}
            </Script>
          </>
        ) : null}
        <Script src={`/assets/system.js?v=${KIT_VERSION}`} type="module" strategy="afterInteractive" nonce={nonce} />
        <Script src="/assets/motion/motion.js" type="module" strategy="afterInteractive" nonce={nonce} />
        <Script src="/assets/layout/layout.js" type="module" strategy="afterInteractive" nonce={nonce} />
      </body>
    </html>
  );
}
