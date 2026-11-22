import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { randomToken } from '@/lib/security/crypto';
import { rateLimit, LIMITS } from '@/lib/security/rate-limit';
import { sameOrigin, keyFrom } from '@/lib/security/request';

/* POST /api/newsletter (form data: email, locale): adds a subscriber. Always answers the same way for a
   new and a known address, so the endpoint cannot be used to test who is subscribed. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  if (!rateLimit(`nl:${keyFrom(req.headers)}`, LIMITS.newsletter).ok) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (String(form.get('company') ?? '').trim()) return NextResponse.json({ ok: true });
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(160), locale: z.string().max(5).default('en') })
    .safeParse({ email: form.get('email'), locale: form.get('locale') || 'en' });
  if (!parsed.success) return NextResponse.json({ error: 'Enter an email address, for example name@club.com.' }, { status: 400 });
  const db = await getDb();
  await db.insert(s.subscribers).values({ email: parsed.data.email, locale: parsed.data.locale, unsubscribeToken: randomToken(18) })
    .onConflictDoUpdate({ target: s.subscribers.email, set: { unsubscribedAt: null } });
  return NextResponse.json({ ok: true });
}
