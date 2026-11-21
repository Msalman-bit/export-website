'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, asc, count, eq } from 'drizzle-orm';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { createSession, requireStaff } from '@/lib/auth/session';
import { checkStepUpCode } from '@/lib/auth/step-up';
import {
  MAX_PASSKEYS, asAssertion, asRegistration, authenticationOptions, cleanPasskeyName, registrationOptions, verifyNewPasskey,
  verifyPasskeyAssertion,
} from '@/lib/auth/passkeys';
import { currentRelyingParty, finishCeremony, startCeremony } from '@/lib/auth/passkey-request';
import { decrypt } from '@/lib/security/crypto';
import { limited, rateLimit, LIMITS } from '@/lib/security/rate-limit';
import { keyFrom } from '@/lib/security/request';
import { audit } from '@/lib/audit';

/* Passkeys in the admin: each ceremony is two calls from the browser, "start" (the server makes a single-use challenge
   and the options for the browser) and "finish" (the server checks the device's answer). Every addition, removal and
   sign-in is audited; refusals are too. The helpers are in src/lib/auth/passkeys.ts. */

type Start<T> = Promise<{ options?: T; message?: string }>;
type Done = Promise<{ ok?: true; message?: string }>;

const NO_PASSKEYS_HERE = 'Passkeys work only on the site’s secure address (https://…) or on localhost on this computer, not on this address.';
const TIMED_OUT = 'That took too long, or was already used. Start again.';

// ------------------------------------------------------------------ signing in with a passkey
export async function passkeySignInStart(): Start<PublicKeyCredentialRequestOptionsJSON> {
  const ip = keyFrom(await headers());
  if (!rateLimit(`pkstart:${ip}`, LIMITS.passkeyStart).ok) return { message: 'Too many attempts. Wait 15 minutes.' };
  const rp = await currentRelyingParty();
  if (!rp) return { message: NO_PASSKEYS_HERE };
  const options = await authenticationOptions(rp);
  await startCeremony({ purpose: 'signin', userId: null, challenge: options.challenge, rp });
  return { options };
}

/** A verified passkey (the device checked Face ID, a fingerprint or its PIN) is both factors: it opens the same full
    staff session as a password followed by an authenticator code. */
export async function passkeySignInFinish(answer: unknown): Done {
  const ip = keyFrom(await headers());
  if (!rateLimit(`pklogin:${ip}`, LIMITS.login).ok) return { message: 'Too many attempts. Wait 15 minutes.' };
  const rp = await currentRelyingParty();
  if (!rp) return { message: NO_PASSKEYS_HERE };
  const challenge = await finishCeremony('signin', null, rp);
  const response = asAssertion(answer);
  if (!response) return { message: 'The browser’s answer could not be read. Try again.' };
  if (!challenge) return { message: TIMED_OUT };
  const db = await getDb();
  const [key] = await db.select().from(s.passkeys).where(eq(s.passkeys.id, response.id)).limit(1);
  if (!key) {
    await audit(null, 'staff.passkey_login_failed', 'passkey', response.id.slice(0, 40), { site: rp.rpId, reason: 'unknown passkey' });
    return { message: `This passkey is not (or no longer) set up for ${rp.rpId}. Sign in with your password and code, then add it again under Your account.` };
  }
  const [user] = await db.select().from(s.users).where(eq(s.users.id, key.userId)).limit(1);
  const actor = user ? { id: user.id, email: user.email } : null;
  if (!user || user.kind !== 'staff' || user.disabledAt || !user.mfaEnabledAt) {
    await audit(actor, 'staff.passkey_login_failed', 'passkey', key.id, { name: key.name, site: rp.rpId, reason: user?.disabledAt ? 'account disabled' : 'account not usable' });
    return { message: 'This passkey cannot sign in. Ask an administrator.' };
  }
  const v = await verifyPasskeyAssertion(response, challenge.challenge, rp, key);
  if (!v.ok) {
    await audit(actor, 'staff.passkey_login_failed', 'passkey', key.id, { name: key.name, site: rp.rpId, reason: v.reason });
    return { message: 'The passkey could not be confirmed. Try again, or sign in with your password and code.' };
  }
  const now = new Date();
  await db.update(s.passkeys).set({ counter: v.counter, backedUp: v.backedUp, lastUsedAt: now }).where(eq(s.passkeys.id, key.id));
  await db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, user.id));
  await createSession(user.id, 'staff', true);
  await audit(actor, 'staff.login_passkey', 'passkey', key.id, { name: key.name, site: rp.rpId });
  return { ok: true };
}

// ------------------------------------------------------------------ adding a passkey (Your account)
/** Step 1: the person names the passkey and confirms with a fresh authenticator code (the same step-up as for a
    deletion: a code works once, five wrong codes lock it for 15 minutes). */
export async function passkeyAddStart(input: { name?: unknown; code?: unknown }): Start<PublicKeyCredentialCreationOptionsJSON> {
  const u = await requireStaff();
  const rp = await currentRelyingParty();
  if (!rp) return { message: NO_PASSKEYS_HERE };
  const name = cleanPasskeyName(input?.name);
  if (!name) return { message: 'Name the passkey first, for example “Salman’s iPhone”.' };
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(s.passkeys).where(eq(s.passkeys.userId, u.id));
  if (n >= MAX_PASSKEYS) return { message: `You have ${n} passkeys, the most one account can have. Remove one you no longer use first.` };

  const limitKey = `stepup:${u.id}`;
  if (limited(limitKey, LIMITS.stepUp)) return { message: 'Too many wrong codes. Wait 15 minutes, then try again.' };
  const result = checkStepUpCode(u.id, u.mfaSecret ? decrypt(u.mfaSecret) : '', String(input?.code ?? '').slice(0, 10));
  if (result !== 'ok') {
    rateLimit(limitKey, LIMITS.stepUp);
    await audit({ id: u.id, email: u.email }, 'passkey.add_refused', 'user', u.id, { name, reason: result === 'spent' ? 'code already used' : 'wrong code' });
    return {
      message: result === 'spent'
        ? 'That code was already used. Wait for the next code in your authenticator app.'
        : 'That code is not right. Type the six-digit code your authenticator app shows now.',
    };
  }

  const mine = await db.select({ id: s.passkeys.id, transports: s.passkeys.transports }).from(s.passkeys)
    .where(and(eq(s.passkeys.userId, u.id), eq(s.passkeys.rpId, rp.rpId)));
  const options = await registrationOptions(rp, { id: u.id, email: u.email, name: u.name }, mine);
  await startCeremony({ purpose: 'register', userId: u.id, challenge: options.challenge, rp, data: { name } });
  return { options };
}

/** Step 2: the device made the passkey; the server checks it and keeps its public key. */
export async function passkeyAddFinish(answer: unknown): Done {
  const u = await requireStaff();
  const rp = await currentRelyingParty();
  if (!rp) return { message: NO_PASSKEYS_HERE };
  const challenge = await finishCeremony('register', u.id, rp);
  const response = asRegistration(answer);
  if (!response) return { message: 'The browser’s answer could not be read. Nothing was added.' };
  if (!challenge) return { message: `${TIMED_OUT} Nothing was added.` };
  const v = await verifyNewPasskey(response, challenge.challenge, rp);
  const actor = { id: u.id, email: u.email };
  const name = challenge.data.name || 'Passkey';
  if (!v.ok) {
    await audit(actor, 'passkey.add_refused', 'user', u.id, { name, site: rp.rpId, reason: v.reason });
    return { message: 'The passkey could not be checked. Nothing was added. Try again.' };
  }
  const db = await getDb();
  try {
    await db.insert(s.passkeys).values({ ...v.passkey, userId: u.id, name });
  } catch {
    return { message: 'That passkey is already set up. Nothing was added.' };
  }
  await audit(actor, 'passkey.add', 'passkey', v.passkey.id, {
    name, site: rp.rpId, synced: v.passkey.deviceType === 'multiDevice', backedUp: v.passkey.backedUp,
  });
  return { ok: true };
}

/** Removing one of your own passkeys: it stops signing in at once. (It stays saved on the device until deleted there;
    it can no longer open anything here.) */
export async function removePasskey(fd: FormData) {
  const u = await requireStaff();
  const id = String(fd.get('id') ?? '').slice(0, 1400);
  const db = await getDb();
  const [gone] = id ? await db.delete(s.passkeys).where(and(eq(s.passkeys.id, id), eq(s.passkeys.userId, u.id))).returning() : [];
  if (!gone) redirect(`/admin/account?error=${encodeURIComponent('Passkey not found.')}`);
  await audit({ id: u.id, email: u.email }, 'passkey.remove', 'passkey', gone.id, { name: gone.name, site: gone.rpId });
  redirect(`/admin/account?ok=${encodeURIComponent(`Passkey “${gone.name}” removed: it no longer signs in. You can also delete it from the device (its passwords or passkeys settings).`)}`);
}

// ------------------------------------------------------------------ confirming a deletion with a passkey
/** The options for confirming a destructive action with one of your passkeys; the answer goes into the action's
    own form (field "passkey") and is checked there (requireStepUp in ./actions). */
export async function passkeyStepUpStart(): Start<PublicKeyCredentialRequestOptionsJSON> {
  const u = await requireStaff();
  const rp = await currentRelyingParty();
  if (!rp) return { message: NO_PASSKEYS_HERE };
  if (limited(`stepup:${u.id}`, LIMITS.stepUp)) return { message: 'Too many failed confirmations. Wait 15 minutes, then try again.' };
  const db = await getDb();
  const mine = await db.select({ id: s.passkeys.id, transports: s.passkeys.transports }).from(s.passkeys)
    .where(and(eq(s.passkeys.userId, u.id), eq(s.passkeys.rpId, rp.rpId))).orderBy(asc(s.passkeys.createdAt));
  if (!mine.length) return { message: 'You have no passkey for this address yet. Use the code from your authenticator app.' };
  const options = await authenticationOptions(rp, mine);
  await startCeremony({ purpose: 'stepup', userId: u.id, challenge: options.challenge, rp });
  return { options };
}
