import { cookies, headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import {
  CHALLENGE_MS, asAssertion, relyingParty, saveChallenge, takeChallenge, verifyPasskeyAssertion,
  type ChallengePurpose, type RelyingParty,
} from './passkeys';

/* The request side of passkeys (see ./passkeys.ts): the short-lived cookie that ties a ceremony to the browser that
   started it, and the passkey check for confirming a deletion. Not a 'use server' file, so none of this is reachable
   from the browser by itself; the admin's server actions call it. */

const COOKIE = 'ms_webauthn';

export async function currentRelyingParty(): Promise<RelyingParty | null> {
  return relyingParty(await headers());
}

/** Stores a new challenge and gives this browser the cookie that points to it (five minutes, admin pages only). */
export async function startCeremony(v: { purpose: ChallengePurpose; userId: string | null; challenge: string; rp: RelyingParty; data?: Record<string, string> }) {
  const db = await getDb();
  const token = await saveChallenge(db, v);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/admin', maxAge: CHALLENGE_MS / 1000,
  });
}

/** Takes this browser's challenge (it works once) and clears the cookie. */
export async function finishCeremony(purpose: ChallengePurpose, userId: string | null, rp: RelyingParty) {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) jar.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/admin', maxAge: 0 });
  return takeChallenge(await getDb(), token, purpose, userId, rp);
}

/** Whether this person has a passkey for the address this page was opened at (deletion forms then offer it). */
export async function hasPasskeyHere(userId: string): Promise<boolean> {
  const rp = await currentRelyingParty();
  if (!rp) return false;
  const db = await getDb();
  const [row] = await db.select({ id: s.passkeys.id }).from(s.passkeys).where(and(eq(s.passkeys.userId, userId), eq(s.passkeys.rpId, rp.rpId))).limit(1);
  return !!row;
}

/** Confirms a destructive action with one of the signed-in person's own passkeys, instead of an authenticator code.
    `raw` is the browser's answer as JSON (the form's hidden "passkey" field). On success the passkey's counter and
    "last used" are updated; the caller writes the audit entry. */
export async function stepUpWithPasskey(userId: string, raw: string): Promise<{ ok: true; name: string } | { ok: false; reason: string }> {
  const rp = await currentRelyingParty();
  if (!rp) return { ok: false, reason: 'passkeys do not work on this address' };
  let parsed: unknown;
  try { parsed = raw.length <= 20_000 ? JSON.parse(raw) : null; } catch { parsed = null; }
  const answer = asAssertion(parsed);
  const challenge = await finishCeremony('stepup', userId, rp);
  if (!answer) return { ok: false, reason: 'unreadable answer' };
  if (!challenge) return { ok: false, reason: 'expired or already used' };
  const db = await getDb();
  const [key] = await db.select().from(s.passkeys).where(and(eq(s.passkeys.id, answer.id), eq(s.passkeys.userId, userId))).limit(1);
  if (!key) return { ok: false, reason: 'not one of your passkeys' };
  const v = await verifyPasskeyAssertion(answer, challenge.challenge, rp, key);
  if (!v.ok) return v;
  await db.update(s.passkeys).set({ counter: v.counter, backedUp: v.backedUp, lastUsedAt: new Date() }).where(eq(s.passkeys.id, key.id));
  return { ok: true, name: key.name };
}
