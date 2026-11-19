import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession } from '@/lib/auth/session';
import { sameOrigin } from '@/lib/security/request';

/* POST /api/saved { productId } saves a product to the signed-in customer's account; DELETE removes it. */
async function handle(req: Request, remove: boolean) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  const user = await readSession('customer');
  if (!user?.emailVerifiedAt) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const productId = String(body?.productId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  const db = await getDb();
  if (remove) await db.delete(s.savedProducts).where(and(eq(s.savedProducts.userId, user.id), eq(s.savedProducts.productId, productId)));
  else await db.insert(s.savedProducts).values({ userId: user.id, productId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export const POST = (req: Request) => handle(req, false);
export const DELETE = (req: Request) => handle(req, true);
