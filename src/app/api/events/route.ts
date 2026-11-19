import { NextResponse } from 'next/server';
import { track } from '@/lib/audit';
import { rateLimit, LIMITS } from '@/lib/security/rate-limit';
import { keyFrom, countryFrom, sameOrigin } from '@/lib/security/request';

const ALLOWED = new Set(['basket_add', 'studio_preview_download', 'studio_saved', 'studio_to_inquiry']);

/* POST /api/events { name, productId?, path? }: first-party counts for Admin > Analytics. No cookie,
   no IP stored, a fixed list of event names. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 204 });
  if (!rateLimit(`ev:${keyFrom(req.headers)}`, LIMITS.event).ok) return new NextResponse(null, { status: 204 });
  const body = await req.json().catch(() => null) as { name?: string; productId?: string; path?: string } | null;
  if (body?.name && ALLOWED.has(body.name)) {
    const productId = body.productId && /^[0-9a-f-]{36}$/i.test(body.productId) ? body.productId : null;
    await track(body.name, { productId, path: String(body.path ?? '').slice(0, 200), country: countryFrom(req.headers) });
  }
  return new NextResponse(null, { status: 204 });
}
