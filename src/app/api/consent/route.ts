import { NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/security/request';

/* POST /api/consent { choice: "analytics" | "essential" }: stores the cookie choice for 12 months.
   Turning analytics off also expires Google Analytics' own cookies. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const choice = body?.choice === 'analytics' ? 'analytics' : 'essential';
  const res = NextResponse.json({ choice });
  res.cookies.set('ms_consent', choice, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  if (choice === 'essential') {
    for (const name of req.headers.get('cookie')?.split(';').map((c) => c.split('=')[0].trim()) ?? []) {
      if (name === '_ga' || name.startsWith('_ga_')) res.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
  }
  return res;
}
