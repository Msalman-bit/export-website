import { eq, lt } from 'drizzle-orm';
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { DB } from '../db/client';
import * as s from '../db/schema';
import { randomToken, sha256 } from '../security/crypto';

/* Passkeys (WebAuthn) for staff. A passkey is a key pair made by the person's phone, computer or password manager:
   the private half never leaves the device, which unlocks it only with Face ID, a fingerprint or the device PIN
   ("user verification", required here every time). The site keeps the public half (table passkeys) and checks a
   signature over a fresh random challenge. Because the device both holds the key (something you have) and checked
   the person (something you are or know), a verified passkey counts as both factors of a staff sign-in.

   A passkey belongs to one domain, the relying party ID, taken from the address the request came to: localhost here,
   monolith-sports.onrender.com on the preview, the own domain later. The browser refuses to use a passkey on any
   other domain, so passkeys made on the preview must be added again after the move.

   Request-free on purpose (no cookies or headers read here), so every helper is unit-tested; the request side is
   ./passkey-request.ts and the admin's passkey actions. */

export const RP_NAME = 'Monolith Sports admin'; // what the phone shows when saving the passkey
export const CEREMONY_MS = 3 * 60_000; // the browser's own time limit: signing in on a computer with a phone takes a moment
export const CHALLENGE_MS = 5 * 60_000; // a challenge is refused after this, even if the browser still waits
export const MAX_PASSKEYS = 10;
export const NAME_MAX = 60;
/* The signature kinds accepted: EdDSA, ES256 (what phones and Windows Hello use) and RS256, named here rather than left to
   the library, whose default also offers an experimental post-quantum kind wherever the Node version has it: the same
   list on every server, for making and for checking a passkey. */
export const ALGORITHMS = [-8, -7, -257];

export type RelyingParty = { rpId: string; origin: string };
export type Passkey = typeof s.passkeys.$inferSelect;
export type ChallengePurpose = 'register' | 'signin' | 'stepup';
type HeaderReader = { get(name: string): string | null };

const first = (v: string | null) => (v ?? '').split(',')[0].trim();
const isIpAddress = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');
const isLocalName = (host: string) => host === 'localhost' || host.endsWith('.localhost');

/** The site a request came to, as WebAuthn needs it: the relying party ID (the bare domain) and the origin (scheme,
    domain and port). Null where passkeys cannot work: an IP address (http://192.168.1.20:3000 from a phone on the
    Wi-Fi, 127.0.0.1), plain http anywhere but localhost, or an Origin header that names another host. Behind Render's
    or Caddy's proxy the forwarded host and scheme are used. */
export function relyingParty(h: HeaderReader): RelyingParty | null {
  const host = first(h.get('x-forwarded-host') || h.get('host')).toLowerCase();
  if (!host) return null;
  let url: URL;
  try {
    const hostname = new URL(`http://${host}`).hostname;
    const scheme = first(h.get('x-forwarded-proto')) || (isLocalName(hostname) ? 'http' : 'https');
    url = new URL(h.get('origin') || `${scheme}://${host}`);
  } catch {
    return null;
  }
  if (url.host !== host) return null;
  const rpId = url.hostname;
  if (!rpId || isIpAddress(rpId)) return null;
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalName(rpId))) return null;
  return { rpId, origin: url.origin };
}

/** The name a person gives a passkey ("Salman's iPhone"): one line, no control characters, at most 60 characters. */
export function cleanPasskeyName(raw: unknown): string {
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

/** The WebAuthn user handle: the account's id as 16 bytes (no email or name in it, as the standard asks). One handle
    per person, so a device keeps one passkey per staff account and replaces it rather than piling up copies. */
export function userHandle(userId: string): Uint8Array<ArrayBuffer> {
  const hex = userId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error('Not a user id');
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

export const handleText = (userId: string) => Buffer.from(userHandle(userId)).toString('base64url');
const toBytes = (b64url: string) => new Uint8Array(Buffer.from(b64url, 'base64url'));

// ------------------------------------------------------------------ challenges: single-use, a few minutes
/** Starts a ceremony: stores its challenge and returns the random token for the browser's cookie (only the token's
    SHA-256 is stored). Expired challenges are cleared on the way. */
export async function saveChallenge(
  db: DB,
  v: { purpose: ChallengePurpose; userId: string | null; challenge: string; rp: RelyingParty; data?: Record<string, string> },
  now = new Date(),
): Promise<string> {
  const token = randomToken(32);
  await db.delete(s.webauthnChallenges).where(lt(s.webauthnChallenges.expiresAt, now));
  await db.insert(s.webauthnChallenges).values({
    id: sha256(token), purpose: v.purpose, userId: v.userId, challenge: v.challenge, rpId: v.rp.rpId, origin: v.rp.origin,
    data: v.data ?? {}, expiresAt: new Date(now.getTime() + CHALLENGE_MS),
  });
  return token;
}

/** Takes the challenge a cookie token points to: it is deleted in the same statement, so it can answer only once,
    whether the answer then verifies or not. Null when it is missing, used, expired, for another purpose, for another
    person, or was made on another address of the site. */
export async function takeChallenge(
  db: DB, token: string | undefined, purpose: ChallengePurpose, userId: string | null, rp: RelyingParty, now = new Date(),
) {
  if (!token || token.length > 100) return null;
  const [row] = await db.delete(s.webauthnChallenges).where(eq(s.webauthnChallenges.id, sha256(token))).returning();
  if (!row || row.purpose !== purpose || row.expiresAt <= now || (row.userId ?? null) !== userId) return null;
  if (row.rpId !== rp.rpId || row.origin !== rp.origin) return null;
  return row;
}

// ------------------------------------------------------------------ options for the browser
export function registrationOptions(
  rp: RelyingParty, user: { id: string; email: string; name: string }, existing: Pick<Passkey, 'id' | 'transports'>[],
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return generateRegistrationOptions({
    rpName: RP_NAME, rpID: rp.rpId, userName: user.email, userDisplayName: user.name || user.email, userID: userHandle(user.id),
    timeout: CEREMONY_MS, attestationType: 'none', supportedAlgorithmIDs: ALGORITHMS,
    // the device already holding one of this person's passkeys says so instead of making a second
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports })),
    // a discoverable passkey (it can be offered without typing an email first, also through the phone's QR flow),
    // always unlocked with Face ID, a fingerprint or the device PIN
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
  });
}

/** For signing in: no list of passkeys, so the browser offers every passkey it holds for this site, and offers to use
    a phone (the QR code) when this computer has none. For confirming an action: only this person's passkeys. */
export function authenticationOptions(rp: RelyingParty, allow?: Pick<Passkey, 'id' | 'transports'>[]): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: rp.rpId, timeout: CEREMONY_MS, userVerification: 'required',
    allowCredentials: allow?.map((p) => ({ id: p.id, transports: p.transports })),
  });
}

// ------------------------------------------------------------------ checking what the browser sent back
const looksLikeCredential = (v: unknown): v is { id: string; rawId: string; type: string; response: Record<string, unknown> } => {
  const r = v as Record<string, unknown> | null;
  return !!r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 1400
    && /^[A-Za-z0-9_-]+$/.test(r.id) && typeof r.rawId === 'string' && r.type === 'public-key'
    && !!r.response && typeof r.response === 'object';
};

/** The browser's answer to "make a passkey", or null when it is not shaped like one. */
export function asRegistration(v: unknown): RegistrationResponseJSON | null {
  if (!looksLikeCredential(v)) return null;
  const r = v.response;
  return typeof r.clientDataJSON === 'string' && typeof r.attestationObject === 'string' ? (v as unknown as RegistrationResponseJSON) : null;
}

/** The browser's answer to "sign with a passkey", or null when it is not shaped like one. */
export function asAssertion(v: unknown): AuthenticationResponseJSON | null {
  if (!looksLikeCredential(v)) return null;
  const r = v.response;
  const ok = typeof r.clientDataJSON === 'string' && typeof r.authenticatorData === 'string' && typeof r.signature === 'string'
    && (r.userHandle === undefined || r.userHandle === null || typeof r.userHandle === 'string');
  return ok ? (v as unknown as AuthenticationResponseJSON) : null;
}

export type NewPasskey = Omit<typeof s.passkeys.$inferInsert, 'userId' | 'name'>;

/** Checks a new passkey against the challenge it answered. The device must have verified the person. */
export async function verifyNewPasskey(response: RegistrationResponseJSON, challenge: string, rp: RelyingParty): Promise<{ ok: true; passkey: NewPasskey } | { ok: false; reason: string }> {
  try {
    const v = await verifyRegistrationResponse({
      response, expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpId, requireUserVerification: true,
      supportedAlgorithmIDs: ALGORITHMS,
    });
    if (!v.verified) return { ok: false, reason: 'not verified' };
    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = v.registrationInfo;
    return {
      ok: true,
      passkey: {
        id: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter,
        transports: (credential.transports ?? response.response.transports ?? []).map(String).slice(0, 10),
        rpId: rp.rpId, deviceType: credentialDeviceType, backedUp: credentialBackedUp, aaguid,
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 200) : 'not verified' };
  }
}

/** Checks a signature from a stored passkey against the challenge it answered: the right site, the right key, the
    person verified on the device, the user handle (when sent) naming the passkey's owner, and a signature counter
    that only goes up (a copied key would repeat it). Returns the new counter to store. */
export async function verifyPasskeyAssertion(
  response: AuthenticationResponseJSON, challenge: string, rp: RelyingParty, passkey: Passkey,
): Promise<{ ok: true; counter: number; backedUp: boolean } | { ok: false; reason: string }> {
  if (passkey.id !== response.id) return { ok: false, reason: 'another passkey' };
  if (passkey.rpId !== rp.rpId) return { ok: false, reason: `made for ${passkey.rpId}` };
  const handle = response.response.userHandle;
  if (handle && handle !== handleText(passkey.userId)) return { ok: false, reason: 'user handle does not match' };
  try {
    const v = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpId, requireUserVerification: true,
      credential: { id: passkey.id, publicKey: toBytes(passkey.publicKey), counter: passkey.counter, transports: passkey.transports },
    });
    if (!v.verified || !v.authenticationInfo.userVerified) return { ok: false, reason: 'not verified' };
    return { ok: true, counter: v.authenticationInfo.newCounter, backedUp: v.authenticationInfo.credentialBackedUp };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 200) : 'not verified' };
  }
}
