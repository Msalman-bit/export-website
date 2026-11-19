import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { randomToken, sha256 } from '../security/crypto';
import { can, type Permission } from './rbac';

/* Database sessions. The cookie holds a random token; the database holds only its SHA-256, so a
   leaked database cannot be replayed as cookies. Staff and customers use separate cookies, lifetimes
   and sign-in pages, and a staff session counts only after its second factor. */

type Kind = 'customer' | 'staff';
const COOKIE: Record<Kind, string> = { customer: 'ms_session', staff: 'ms_staff' };
const LIFETIME: Record<Kind, number> = { customer: 14 * 24 * 3600_000, staff: 12 * 3600_000 };

export type SessionUser = typeof s.users.$inferSelect & { session: typeof s.sessions.$inferSelect };

export async function createSession(userId: string, kind: Kind, mfaVerified = false) {
  const db = await getDb();
  const token = randomToken(32);
  const h = await headers();
  const expiresAt = new Date(Date.now() + LIFETIME[kind]);
  await db.insert(s.sessions).values({
    id: sha256(token), userId, kind, mfaVerified, expiresAt, userAgent: (h.get('user-agent') || '').slice(0, 200),
  });
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(COOKIE[kind], token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: kind === 'staff' ? 'strict' : 'lax',
    path: '/', expires: expiresAt,
  });
}

export async function readSession(kind: Kind): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const rows = await db.select().from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, sha256(token)), eq(s.sessions.kind, kind), gt(s.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.users.disabledAt || row.users.kind !== kind) return null;
  return { ...row.users, session: row.sessions };
}

export async function markMfaVerified(kind: Kind) {
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  if (!token) return;
  const db = await getDb();
  await db.update(s.sessions).set({ mfaVerified: true }).where(eq(s.sessions.id, sha256(token)));
}

export async function destroySession(kind: Kind) {
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  if (token) {
    const db = await getDb();
    await db.delete(s.sessions).where(eq(s.sessions.id, sha256(token)));
  }
  jar.delete(COOKIE[kind]);
}

export async function destroyAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

/** A customer with a verified email and a company; otherwise to sign-in. */
export async function requireCustomer(locale: string): Promise<SessionUser & { companyId: string }> {
  const u = await readSession('customer');
  if (!u) redirect(`/${locale}/account/login`);
  if (!u.emailVerifiedAt) redirect(`/${locale}/account/verify`);
  if (!u.companyId) redirect(`/${locale}/account/login`);
  return u as SessionUser & { companyId: string };
}

/** A staff member past the second factor, holding the permission; otherwise to sign-in or 403. */
export async function requireStaff(permission?: Permission): Promise<SessionUser> {
  const u = await readSession('staff');
  if (!u) redirect('/admin/login');
  if (!u.mfaEnabledAt) redirect('/admin/mfa/setup');
  if (!u.session.mfaVerified) redirect('/admin/mfa');
  if (permission && !can(u.role, permission)) redirect('/admin?denied=1');
  return u;
}
