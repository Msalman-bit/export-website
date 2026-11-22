import type { Metadata } from 'next';
import { LOCALES, HREFLANG, type Locale } from './i18n/config';
import { getSettings } from './data';

export function siteUrl(): string {
  // SITE_URL on the live site; on Render without it, the address Render gives the service
  return (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Title, description, canonical, hreflang alternates (indexed languages only), Open Graph and robots. */
export async function pageMeta(opts: {
  locale: Locale; path: string; title: string; description: string; image?: string; noindex?: boolean; type?: 'website' | 'article';
}): Promise<Metadata> {
  const settings = await getSettings();
  const indexed = settings.locales.indexed.filter((l): l is Locale => (LOCALES as readonly string[]).includes(l));
  const base = siteUrl();
  const path = opts.path === '/' ? '' : opts.path;
  const languages: Record<string, string> = {};
  for (const l of indexed) languages[HREFLANG[l]] = `${base}/${l}${path}`;
  if (indexed.includes('en')) languages['x-default'] = `${base}/en${path}`;
  const index = !opts.noindex && indexed.includes(opts.locale);
  const image = opts.image || '/share.jpg';
  return {
    metadataBase: new URL(base),
    title: opts.title,
    description: opts.description,
    alternates: { canonical: `${base}/${opts.locale}${path}`, languages },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: opts.type ?? 'website', title: opts.title, description: opts.description, url: `${base}/${opts.locale}${path}`,
      siteName: 'Monolith Sports', images: [{ url: image, width: 1200, height: 630 }], locale: opts.locale,
    },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description, images: [image] },
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  };
}

export function jsonLd(data: Record<string, unknown>) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}

export function organizationLd() {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'Monolith Sports', url: base,
    logo: `${base}/favicon.svg`, slogan: 'Engineered for performance. Built for the world.',
    description: 'Sports equipment manufacturer and exporter in Pakistan: footballs, gloves, teamwear and training equipment made for the buyer’s brand.',
    areaServed: ['IE', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'DK', 'NO', 'SE', 'FI'],
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${siteUrl()}${it.url}` })),
  };
}
