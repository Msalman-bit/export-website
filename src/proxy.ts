import { NextResponse, type NextRequest } from 'next/server';

/* Runs before every page:
   1. a path without a language prefix is redirected to one (cookie, then Accept-Language, then English);
   2. a fresh nonce goes into the Content-Security-Policy, which Next.js applies to its own scripts;
   3. the path is handed to the layouts (hreflang links, the nav's current word). */

const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'nl'];
const PUBLIC_FILE = /\.[a-z0-9]+$/i;

function pickLocale(req: NextRequest): string {
  const cookie = req.cookies.get('ms_locale')?.value;
  if (cookie && LOCALES.includes(cookie)) return cookie;
  const header = req.headers.get('accept-language') || '';
  for (const part of header.split(',')) {
    const lang = part.trim().slice(0, 2).toLowerCase();
    if (LOCALES.includes(lang)) return lang;
  }
  return 'en';
}

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com`,
    `media-src 'self' blob:`,
    `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com${dev ? ' ws: wss:' : ''}`,
    `frame-src https://challenges.cloudflare.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' mailto:`,
    `object-src 'none'`,
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split('/')[1] || '';
  const isApp = first === 'admin' || first === 'api' || first === 'media';

  if (!isApp && !PUBLIC_FILE.test(pathname) && !LOCALES.includes(first)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${pickLocale(req)}${pathname === '/' ? '' : pathname}`;
    url.search = search;
    return NextResponse.redirect(url, 307);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('content-security-policy', policy);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', policy);
  if (LOCALES.includes(first) && req.cookies.get('ms_locale')?.value !== first) {
    res.cookies.set('ms_locale', first, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  }
  return res;
}

export const config = {
  matcher: [
    // every page and route, but not Next.js internals or the static kit files
    '/((?!_next/static|_next/image|assets/|favicon|robots.txt|sitemap.xml|share.jpg).*)',
  ],
};
