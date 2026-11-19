import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession } from '@/lib/auth/session';
import { sameOrigin } from '@/lib/security/request';

/* POST /api/customisations { productId, name, config }: saves a studio design to the customer's company. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  const user = await readSession('customer');
  if (!user?.emailVerifiedAt || !user.companyId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = z.object({
    productId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(120),
    config: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).refine((c) => Object.keys(c).length <= 30),
  }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'The design could not be read.' }, { status: 400 });
  const db = await getDb();
  const [row] = await db.insert(s.customisations).values({ userId: user.id, companyId: user.companyId, productId: parsed.data.productId ?? null, name: parsed.data.name, config: parsed.data.config }).returning();
  return NextResponse.json({ id: row.id });
}
