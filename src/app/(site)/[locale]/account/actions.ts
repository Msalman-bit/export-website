'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, gt, isNull, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { hashPassword, verifyPassword, dummyHash, passwordProblem } from '@/lib/auth/password';
import { createSession, destroySession, destroyAllSessions, readSession, requireCustomer } from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/security/crypto';
import { rateLimit, LIMITS } from '@/lib/security/rate-limit';
import { keyFrom } from '@/lib/security/request';
import { sendEmail } from '@/lib/email/send';
import { verifyEmail, resetEmail } from '@/lib/email/templates';
import { siteUrl } from '@/lib/seo';
import { audit, track } from '@/lib/audit';
import { COUNTRIES } from '@/lib/inquiry/countries';
import { isLocale } from '@/lib/i18n/config';

/* Customer account actions. Server Actions are POST-only and Next.js checks their Origin against the
   host, which is the CSRF defence here; every input is validated again on the server. */

export type FormState = { errors?: Record<string, string>; message?: string; ok?: boolean };

const loc = (fd: FormData) => { const l = String(fd.get('locale') || 'en'); return isLocale(l) ? l : 'en'; };
const ipKey = async () => keyFrom(await headers());

async function issueToken(userId: string, purpose: 'verify' | 'reset', hours: number) {
  const db = await getDb();
  const token = randomToken(32);
  await db.insert(s.tokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + hours * 3600_000) });
  return token;
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  if (!rateLimit(`reg:${await ipKey()}`, LIMITS.register).ok) return { message: 'Too many sign-ups from this connection. Try again in an hour.' };
  if (String(fd.get('company_website') || '')) return { message: 'Check your email to confirm the address.' };
  const parsed = z.object({
    company: z.string().trim().min(2, 'Write your company name.').max(120),
    name: z.string().trim().min(2, 'Write your name.').max(120),
    email: z.string().trim().toLowerCase().email('Write your business email with an @.').max(160),
    country: z.string().refine((c) => COUNTRIES.some((x) => x.code === c), 'Choose your country.'),
    password: z.string(),
    terms: z.literal('on', { error: 'Accept the terms to open an account.' }),
  }).safeParse(Object.fromEntries(fd));
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
  const pw = String(fd.get('password') || '');
  const problem = passwordProblem(pw);
  if (problem) errors.password = problem;
  if (Object.keys(errors).length || !parsed.success) return { errors };

  const db = await getDb();
  const d = parsed.data;
  const [existing] = await db.select().from(s.users).where(and(eq(s.users.email, d.email), eq(s.users.kind, 'customer'))).limit(1);
  if (existing) {
    // the same answer as a new account, so the form cannot be used to find out who has one
    if (!existing.emailVerifiedAt) {
      const token = await issueToken(existing.id, 'verify', 24);
      await sendEmail({ to: existing.email, ...verifyEmail({ name: existing.name, url: `${siteUrl()}/${locale}/account/verify/${token}` }) });
    }
    redirect(`/${locale}/account/verify?sent=1`);
  }
  const [company] = await db.insert(s.companies).values({ name: d.company, country: d.country }).returning();
  const [user] = await db.insert(s.users).values({
    email: d.email, passwordHash: await hashPassword(pw), name: d.name, kind: 'customer', role: 'owner', companyId: company.id,
  }).returning();
  const token = await issueToken(user.id, 'verify', 24);
  await sendEmail({ to: user.email, ...verifyEmail({ name: user.name, url: `${siteUrl()}/${locale}/account/verify/${token}` }) });
  await createSession(user.id, 'customer');
  await track('customer_registered', { locale });
  redirect(`/${locale}/account/verify?sent=1`);
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  if (!email || !password) return { errors: { ...(email ? {} : { email: 'Write your email address.' }), ...(password ? {} : { password: 'Write your password.' }) } };
  const ip = await ipKey();
  if (!rateLimit(`login:${ip}`, LIMITS.login).ok || !rateLimit(`login:${email}`, LIMITS.login).ok) return { message: 'Too many attempts. Wait 15 minutes and try again.' };
  const db = await getDb();
  const [user] = await db.select().from(s.users).where(and(eq(s.users.email, email), eq(s.users.kind, 'customer'))).limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok || user.disabledAt || (user.lockedUntil && user.lockedUntil > new Date())) {
    if (user && !ok) {
      const fails = user.failedLogins + 1;
      await db.update(s.users).set({ failedLogins: fails, lockedUntil: fails >= 10 ? new Date(Date.now() + 15 * 60_000) : user.lockedUntil }).where(eq(s.users.id, user.id));
    }
    return { message: 'That email and password do not match an account.' };
  }
  await db.update(s.users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(s.users.id, user.id));
  await createSession(user.id, 'customer');
  await audit({ id: user.id, email: user.email }, 'customer.login', 'user', user.id);
  redirect(user.emailVerifiedAt ? `/${locale}/account` : `/${locale}/account/verify`);
}

export async function logout(fd: FormData) {
  await destroySession('customer');
  redirect(`/${loc(fd)}/account/login`);
}

export async function resendVerification(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const user = await readSession('customer');
  if (!user) redirect(`/${locale}/account/login`);
  if (!rateLimit(`resend:${user.id}`, LIMITS.reset).ok) return { message: 'We sent several links already. Check your spam folder, or wait an hour.' };
  const token = await issueToken(user.id, 'verify', 24);
  await sendEmail({ to: user.email, ...verifyEmail({ name: user.name, url: `${siteUrl()}/${locale}/account/verify/${token}` }) });
  return { ok: true, message: 'A new confirmation link is on its way.' };
}

/** Called by the verification page: marks the email verified and attaches earlier inquiries sent from it. */
export async function consumeVerification(token: string): Promise<boolean> {
  const db = await getDb();
  const [t] = await db.select().from(s.tokens).where(and(eq(s.tokens.tokenHash, sha256(token)), eq(s.tokens.purpose, 'verify'), isNull(s.tokens.usedAt), gt(s.tokens.expiresAt, new Date()))).limit(1);
  if (!t) return false;
  await db.update(s.tokens).set({ usedAt: new Date() }).where(eq(s.tokens.id, t.id));
  const [user] = await db.update(s.users).set({ emailVerifiedAt: new Date() }).where(eq(s.users.id, t.userId)).returning();
  if (!user?.companyId) return true;
  // Sales may already have created the buyer's company from an inquiry sent from this (now verified)
  // address: the buyer joins that company, and the empty one made at registration is removed.
  const linked = await db.selectDistinct({ companyId: s.inquiries.companyId }).from(s.inquiries)
    .where(and(eq(s.inquiries.email, user.email), isNotNull(s.inquiries.companyId)));
  const target = linked.length === 1 ? linked[0].companyId : null;
  if (target && target !== user.companyId) {
    const fresh = user.companyId;
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.inquiries).where(eq(s.inquiries.companyId, fresh));
    const [{ m }] = await db.select({ m: sql<number>`count(*)::int` }).from(s.users).where(eq(s.users.companyId, fresh));
    if (n === 0 && m === 1) {
      await db.update(s.users).set({ companyId: target }).where(eq(s.users.id, user.id));
      await db.update(s.customisations).set({ companyId: target }).where(eq(s.customisations.companyId, fresh));
      await db.delete(s.companies).where(eq(s.companies.id, fresh));
      user.companyId = target;
    }
  }
  await db.update(s.inquiries).set({ companyId: user.companyId, userId: user.id }).where(and(eq(s.inquiries.email, user.email), isNull(s.inquiries.companyId)));
  return true;
}

export async function confirmEmail(fd: FormData) {
  const locale = loc(fd);
  const token = String(fd.get('token') || '').slice(0, 100);
  const ok = token ? await consumeVerification(token) : false;
  redirect(`/${locale}/account/verify/${encodeURIComponent(token)}?done=${ok ? '1' : '0'}`);
}

export async function forgot(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { errors: { email: 'Write your email address with an @.' } };
  if (!rateLimit(`forgot:${await ipKey()}`, LIMITS.reset).ok) return { message: 'Too many requests. Try again in an hour.' };
  const db = await getDb();
  const [user] = await db.select().from(s.users).where(and(eq(s.users.email, email), eq(s.users.kind, 'customer'))).limit(1);
  if (user && !user.disabledAt) {
    const token = await issueToken(user.id, 'reset', 1);
    await sendEmail({ to: user.email, ...resetEmail({ name: user.name, url: `${siteUrl()}/${locale}/account/reset?token=${token}` }) });
  }
  return { ok: true, message: 'If an account uses that address, a reset link is on its way. It works for one hour.' };
}

export async function reset(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const token = String(fd.get('token') || '');
  const pw = String(fd.get('password') || '');
  const problem = passwordProblem(pw);
  if (problem) return { errors: { password: problem } };
  if (pw !== String(fd.get('confirm') || '')) return { errors: { confirm: 'Type the same password twice.' } };
  const db = await getDb();
  const [t] = await db.select().from(s.tokens).where(and(eq(s.tokens.tokenHash, sha256(token)), eq(s.tokens.purpose, 'reset'), isNull(s.tokens.usedAt), gt(s.tokens.expiresAt, new Date()))).limit(1);
  if (!t) return { message: 'This reset link has expired or was used. Ask for a new one.' };
  await db.update(s.tokens).set({ usedAt: new Date() }).where(eq(s.tokens.id, t.id));
  await db.update(s.users).set({ passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null }).where(eq(s.users.id, t.userId));
  await destroyAllSessions(t.userId);
  await audit({ id: t.userId, email: '' }, 'customer.password_reset', 'user', t.userId);
  redirect(`/${locale}/account/login?reset=1`);
}

export async function updateCompany(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const user = await requireCustomer(locale);
  const parsed = z.object({
    name: z.string().trim().min(2, 'Write the company name.').max(120),
    country: z.string().refine((c) => COUNTRIES.some((x) => x.code === c), 'Choose a country.'),
    website: z.string().trim().max(200).refine((v) => !v || /^https?:\/\/[^\s]+$/.test(v), 'Start the address with https://.'),
    address: z.string().trim().max(500),
    phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, 'Use digits, spaces and + only.'),
    preferredCurrency: z.enum(['EUR', 'GBP', 'USD']),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors };
  }
  const db = await getDb();
  await db.update(s.companies).set({ ...parsed.data, updatedAt: new Date() }).where(eq(s.companies.id, user.companyId));
  await audit({ id: user.id, email: user.email }, 'customer.company_updated', 'company', user.companyId);
  return { ok: true, message: 'Company details saved.' };
}

export async function sendCustomerMessage(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const user = await requireCustomer(locale);
  const body = String(fd.get('body') || '').trim();
  if (body.length < 2) return { errors: { body: 'Write your message.' } };
  if (body.length > 4000) return { errors: { body: 'Keep the message under 4,000 characters.' } };
  const inquiryId = String(fd.get('inquiryId') || '') || null;
  const db = await getDb();
  if (inquiryId) {
    const [own] = await db.select({ id: s.inquiries.id }).from(s.inquiries).where(and(eq(s.inquiries.id, inquiryId), eq(s.inquiries.companyId, user.companyId))).limit(1);
    if (!own) return { message: 'That request is not on your account.' };
  }
  await db.insert(s.messages).values({ companyId: user.companyId, inquiryId, authorId: user.id, fromStaff: false, body });
  const notify = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (notify) await sendEmail({ to: notify, subject: `Customer message from ${user.email}`, html: `<p>${body.replace(/[<>&]/g, '')}</p>`, text: body });
  return { ok: true, message: 'Message sent to the sales team.' };
}
