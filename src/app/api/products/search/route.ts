import { NextResponse } from 'next/server';
import { searchProducts, getFamilies } from '@/lib/data';
import { pic } from '@/lib/media';
import { rateLimit, type Limit } from '@/lib/security/rate-limit';
import { keyFrom } from '@/lib/security/request';
import { isLocale } from '@/lib/i18n/config';
import { getText } from '@/lib/i18n/server';

// one request a pause in typing: 600 an hour per visitor is far past any real search, and stops a scraper
const SEARCH: Limit = { limit: 600, windowMs: 60 * 60_000 };

/* GET /api/products/search?q=&locale=: up to six published products matching a name, type, construction or product
   code, for the inquiry form's "Add a product" box. The same search as the /search page, returning only what the box
   shows (name, type, code, a small picture and the product's address). Read-only; no cookie, nothing stored. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const lang = url.searchParams.get('locale') ?? '';
  const locale = isLocale(lang) ? lang : 'en';
  if (q.length < 2) return NextResponse.json({ results: [] });
  if (!rateLimit(`ps:${keyFrom(req.headers)}`, SEARCH).ok) return NextResponse.json({ results: [] }, { status: 429 });
  // names, types and the words searched in the page's language as well as in English
  const tx = await getText(locale);
  const [all, families] = await Promise.all([searchProducts(q, 24, tx), getFamilies()]);
  // a buyer typing "match" means the match balls, not a tracksuit whose description says "matching": when some
  // products carry every word in their name or code, only those are offered; otherwise the wider matches are
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const named = all.filter((p) => words.every((w) => `${p.name} ${tx(p.name)} ${p.sku}`.toLowerCase().includes(w)));
  const found = (named.length ? named : all).slice(0, 6);
  // the family ("Football", "Cricket"), not the product's own type, which often repeats its name ("Goalkeeper gloves")
  const family = new Map(families.map((f) => [f.slug, tx(f.name.replace(/\s+equipment$/i, ''))]));
  return NextResponse.json({
    results: found.map((p) => ({
      id: p.id, name: tx(p.name), sku: p.sku, type: family.get(p.familySlug) ?? tx(p.subName),
      image: pic(p.images[0]?.url, 160)?.src ?? null,
      href: `/${locale}/products/${p.familySlug}/${p.slug}`,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
