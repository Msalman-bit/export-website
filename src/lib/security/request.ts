import { headers } from 'next/headers';
import { sha256 } from './crypto';

/* Request facts used for rate limits, CSRF and coarse analytics. The address is only ever hashed. */

export function clientIpFrom(h: Headers): string {
  return (h.get('cf-connecting-ip') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0').trim();
}

export async function clientKey(): Promise<string> {
  const h = await headers();
  return sha256(clientIpFrom(h)).slice(0, 24);
}

export function keyFrom(h: Headers): string {
  return sha256(clientIpFrom(h)).slice(0, 24);
}

/** Country from the CDN (Cloudflare / Vercel), never from the address itself. */
export function countryFrom(h: Headers): string {
  return (h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || '').slice(0, 2).toUpperCase();
}

/** CSRF defence for JSON and form route handlers: the request must come from this site.
    Server Actions get the same check from Next.js itself. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return false;
  if (!origin) {
    // browsers send Origin on every cross-site POST; a missing one is a same-site navigation or a tool
    const site = req.headers.get('sec-fetch-site');
    return !site || site === 'same-origin' || site === 'none';
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
