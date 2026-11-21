import crypto from 'node:crypto';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/db/schema';
import type { DB } from '@/lib/db/client';
import {
  relyingParty, cleanPasskeyName, userHandle, handleText, saveChallenge, takeChallenge, registrationOptions, authenticationOptions,
  verifyNewPasskey, verifyPasskeyAssertion, asRegistration, asAssertion, CHALLENGE_MS, type Passkey, type RelyingParty,
} from '@/lib/auth/passkeys';

const headersOf = (o: Record<string, string>) => new Headers(o);
const LOCAL: RelyingParty = { rpId: 'localhost', origin: 'http://localhost:3000' };
const PREVIEW: RelyingParty = { rpId: 'monolith-sports.onrender.com', origin: 'https://monolith-sports.onrender.com' };
const USER = '7f0c7d0e-3c0a-4a8e-9a43-0f3a6f3c2b11';

describe('passkey relying party (from the request)', () => {
  it('uses localhost on this computer and the preview’s own domain on Render', () => {
    expect(relyingParty(headersOf({ host: 'localhost:3000', origin: 'http://localhost:3000' }))).toEqual(LOCAL);
    expect(relyingParty(headersOf({ host: 'localhost:3000' }))).toEqual(LOCAL);
    expect(relyingParty(headersOf({ host: 'monolith-sports.onrender.com', 'x-forwarded-proto': 'https', origin: 'https://monolith-sports.onrender.com' }))).toEqual(PREVIEW);
    expect(relyingParty(headersOf({ host: 'internal:10000', 'x-forwarded-host': 'www.example.com', 'x-forwarded-proto': 'https' })))
      .toEqual({ rpId: 'www.example.com', origin: 'https://www.example.com' });
    expect(relyingParty(headersOf({ host: 'app.localhost:3100' }))).toEqual({ rpId: 'app.localhost', origin: 'http://app.localhost:3100' });
  });
  it('refuses where passkeys cannot work, or the origin names another host', () => {
    expect(relyingParty(headersOf({ host: '192.168.1.20:3000', origin: 'http://192.168.1.20:3000' }))).toBeNull();
    expect(relyingParty(headersOf({ host: '127.0.0.1:3100' }))).toBeNull();
    expect(relyingParty(headersOf({ host: '[::1]:3000' }))).toBeNull();
    expect(relyingParty(headersOf({ host: 'shop.example.com', origin: 'http://shop.example.com' }))).toBeNull(); // plain http
    expect(relyingParty(headersOf({ host: 'monolith-sports.onrender.com', origin: 'https://evil.example' }))).toBeNull();
    expect(relyingParty(headersOf({ host: 'localhost:3000', origin: 'not a url' }))).toBeNull();
    expect(relyingParty(headersOf({}))).toBeNull();
  });
});

describe('passkey names and user handles', () => {
  it('keeps a name to one clean line of at most 60 characters', () => {
    expect(cleanPasskeyName('  Salman’s   iPhone \n')).toBe('Salman’s iPhone');
    expect(cleanPasskeyName('a\u0000b\tc')).toBe('a b c');
    expect(cleanPasskeyName('x'.repeat(80))).toHaveLength(60);
    expect(cleanPasskeyName(undefined)).toBe('');
    expect(cleanPasskeyName('   ')).toBe('');
  });
  it('turns the account id into a 16-byte handle with no personal data', () => {
    expect(userHandle(USER)).toHaveLength(16);
    expect(Buffer.from(userHandle(USER)).toString('hex')).toBe(USER.replace(/-/g, ''));
    expect(handleText(USER)).toBe(Buffer.from(USER.replace(/-/g, ''), 'hex').toString('base64url'));
    expect(() => userHandle('someone@example.com')).toThrow();
  });
});

// ------------------------------------------------------------------ an in-memory database with the real migrations
let db: DB;
beforeAll(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema }) as unknown as DB;
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await db.insert(schema.users).values([
    { id: USER, email: 'staff@monolith.test', passwordHash: 'x', kind: 'staff', role: 'admin' },
    { id: '11111111-2222-4333-8444-555555555555', email: 'other@monolith.test', passwordHash: 'x', kind: 'staff', role: 'sales' },
  ]);
}, 60_000);

describe('passkey challenges', () => {
  it('answer once only', async () => {
    const token = await saveChallenge(db, { purpose: 'signin', userId: null, challenge: 'abc', rp: LOCAL });
    expect((await takeChallenge(db, token, 'signin', null, LOCAL))?.challenge).toBe('abc');
    expect(await takeChallenge(db, token, 'signin', null, LOCAL)).toBeNull();
  });
  it('keep only the token’s hash', async () => {
    const token = await saveChallenge(db, { purpose: 'signin', userId: null, challenge: 'hash-check', rp: LOCAL });
    const rows = await db.select().from(schema.webauthnChallenges);
    expect(rows.some((r) => r.id === token)).toBe(false);
    expect(rows.some((r) => r.challenge === 'hash-check')).toBe(true);
  });
  it('refuse an expired challenge, another purpose, another person or another address, and are spent by the refusal', async () => {
    const t0 = new Date('2026-11-21T10:00:00Z');
    const expired = await saveChallenge(db, { purpose: 'signin', userId: null, challenge: 'old', rp: LOCAL }, t0);
    expect(await takeChallenge(db, expired, 'signin', null, LOCAL, new Date(t0.getTime() + CHALLENGE_MS + 1))).toBeNull();

    const reg = await saveChallenge(db, { purpose: 'register', userId: USER, challenge: 'r', rp: LOCAL, data: { name: 'Laptop' } });
    expect(await takeChallenge(db, reg, 'signin', null, LOCAL)).toBeNull();
    expect(await takeChallenge(db, reg, 'register', USER, LOCAL)).toBeNull(); // the wrong try used it up

    const mine = await saveChallenge(db, { purpose: 'stepup', userId: USER, challenge: 's', rp: LOCAL });
    expect(await takeChallenge(db, mine, 'stepup', '11111111-2222-4333-8444-555555555555', LOCAL)).toBeNull();

    const there = await saveChallenge(db, { purpose: 'signin', userId: null, challenge: 'p', rp: PREVIEW });
    expect(await takeChallenge(db, there, 'signin', null, LOCAL)).toBeNull();

    expect(await takeChallenge(db, undefined, 'signin', null, LOCAL)).toBeNull();
    expect(await takeChallenge(db, 'x'.repeat(200), 'signin', null, LOCAL)).toBeNull();
  });
  it('clear expired challenges when a new one starts', async () => {
    const t0 = new Date('2020-01-01T00:00:00Z');
    await saveChallenge(db, { purpose: 'signin', userId: null, challenge: 'stale', rp: LOCAL }, t0);
    await saveChallenge(db, { purpose: 'signin', userId: null, challenge: 'fresh', rp: LOCAL });
    const rows = await db.select().from(schema.webauthnChallenges);
    expect(rows.some((r) => r.challenge === 'stale')).toBe(false);
  });
});

// ------------------------------------------------------------------ a software authenticator (a pretend phone)
/* Just enough CBOR (RFC 8949) for an attestation object and a COSE key: small integers, byte and text strings, maps. */
function cbor(v: unknown): Buffer {
  const head = (major: number, n: number) => {
    if (n < 24) return Buffer.from([(major << 5) | n]);
    if (n < 256) return Buffer.from([(major << 5) | 24, n]);
    const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b;
  };
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, b.length), b]); }
  if (v instanceof Uint8Array) return Buffer.concat([head(2, v.length), Buffer.from(v)]);
  const entries = v instanceof Map ? [...v.entries()] : Object.entries(v as object);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest();
const UP = 0x01, UV = 0x04, BE = 0x08, BS = 0x10, AT = 0x40;

function fakeDevice() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credId = crypto.randomBytes(32);
  let counter = 0;
  const cose = cbor(new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')]]));
  const clientData = (type: string, challenge: string, origin: string) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  const count = () => { const b = Buffer.alloc(4); b.writeUInt32BE(counter); return b; };
  return {
    id: b64u(credId),
    /** navigator.credentials.create(), as @simplewebauthn/browser hands it on */
    create(o: { challenge: string; rpId: string; origin: string; flags?: number }) {
      const authData = Buffer.concat([
        sha(o.rpId), Buffer.from([o.flags ?? (UP | UV | BE | BS | AT)]), count(),
        Buffer.alloc(16), Buffer.from([0, credId.length]), credId, cose,
      ]);
      return {
        id: b64u(credId), rawId: b64u(credId), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: b64u(clientData('webauthn.create', o.challenge, o.origin)),
          attestationObject: b64u(cbor({ fmt: 'none', attStmt: {}, authData })), transports: ['internal', 'hybrid'],
        },
      };
    },
    /** navigator.credentials.get() */
    get(o: { challenge: string; rpId: string; origin: string; flags?: number; userId?: string; keepCounter?: boolean }) {
      if (!o.keepCounter) counter += 1;
      const authData = Buffer.concat([sha(o.rpId), Buffer.from([o.flags ?? (UP | UV | BE | BS)]), count()]);
      const cd = clientData('webauthn.get', o.challenge, o.origin);
      const signature = crypto.sign('sha256', Buffer.concat([authData, sha(cd)]), privateKey);
      return {
        id: b64u(credId), rawId: b64u(credId), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: b64u(cd), authenticatorData: b64u(authData), signature: b64u(signature),
          userHandle: o.userId ? handleText(o.userId) : undefined,
        },
      };
    },
  };
}

describe('passkey ceremonies (with a software authenticator)', () => {
  const user = { id: USER, email: 'staff@monolith.test', name: 'Staff Member' };

  async function enrol(device = fakeDevice(), rp = LOCAL) {
    const options = await registrationOptions(rp, user, []);
    const answer = asRegistration(device.create({ challenge: options.challenge, rpId: rp.rpId, origin: rp.origin }));
    expect(answer).not.toBeNull();
    const v = await verifyNewPasskey(answer!, options.challenge, rp);
    if (!v.ok) throw new Error(v.reason);
    const stored: Passkey = {
      ...v.passkey, userId: USER, name: 'Test phone', counter: v.passkey.counter ?? 0, transports: v.passkey.transports ?? [],
      deviceType: v.passkey.deviceType ?? '', backedUp: !!v.passkey.backedUp, aaguid: v.passkey.aaguid ?? '', createdAt: new Date(), lastUsedAt: null,
    };
    return { device, stored };
  }

  it('asks for a discoverable passkey unlocked by the person, without attestation', async () => {
    const o = await registrationOptions(LOCAL, user, [{ id: 'AAAA', transports: ['internal'] }]);
    expect(o.rp).toEqual({ name: 'Monolith Sports admin', id: 'localhost' });
    expect(o.user.id).toBe(handleText(USER));
    expect(o.user.name).toBe('staff@monolith.test');
    expect(o.authenticatorSelection).toMatchObject({ residentKey: 'required', requireResidentKey: true, userVerification: 'required' });
    expect(o.attestation).toBe('none');
    expect(o.excludeCredentials?.map((c) => c.id)).toEqual(['AAAA']);
    expect(o.pubKeyCredParams.map((p) => p.alg)).toEqual([-8, -7, -257]);
    const a = await authenticationOptions(LOCAL);
    expect(a.rpId).toBe('localhost');
    expect(a.userVerification).toBe('required');
    expect(a.allowCredentials ?? []).toEqual([]); // empty: the browser offers any passkey, or a phone by QR code
  });

  it('adds a passkey and keeps its public key, site and kind', async () => {
    const { stored, device } = await enrol();
    expect(stored.id).toBe(device.id);
    expect(stored.rpId).toBe('localhost');
    expect(stored.deviceType).toBe('multiDevice');
    expect(stored.backedUp).toBe(true);
    expect(stored.transports).toEqual(['internal', 'hybrid']);
    expect(Buffer.from(stored.publicKey, 'base64url').length).toBeGreaterThan(60);
  });

  it('refuses a new passkey made without Face ID, fingerprint or PIN, for another challenge, or on another site', async () => {
    const device = fakeDevice();
    const options = await registrationOptions(LOCAL, user, []);
    const noUv = asRegistration(device.create({ challenge: options.challenge, rpId: 'localhost', origin: LOCAL.origin, flags: UP | AT }))!;
    expect((await verifyNewPasskey(noUv, options.challenge, LOCAL)).ok).toBe(false);
    const other = asRegistration(device.create({ challenge: 'c29tZXRoaW5nLWVsc2U', rpId: 'localhost', origin: LOCAL.origin }))!;
    expect((await verifyNewPasskey(other, options.challenge, LOCAL)).ok).toBe(false);
    const phished = asRegistration(device.create({ challenge: options.challenge, rpId: 'localhost', origin: 'https://evil.example' }))!;
    expect((await verifyNewPasskey(phished, options.challenge, LOCAL)).ok).toBe(false);
  });

  it('signs in with the passkey and moves its counter on', async () => {
    const { device, stored } = await enrol();
    const o = await authenticationOptions(LOCAL);
    const answer = asAssertion(device.get({ challenge: o.challenge, rpId: 'localhost', origin: LOCAL.origin, userId: USER }))!;
    const v = await verifyPasskeyAssertion(answer, o.challenge, LOCAL, stored);
    expect(v).toEqual({ ok: true, counter: 1, backedUp: true });
  });

  it('refuses a sign-in without user verification, a replay, a wrong signature, another site or another person’s handle', async () => {
    const { device, stored } = await enrol();
    const o = await authenticationOptions(LOCAL);

    const noUv = asAssertion(device.get({ challenge: o.challenge, rpId: 'localhost', origin: LOCAL.origin, flags: UP }))!;
    expect((await verifyPasskeyAssertion(noUv, o.challenge, LOCAL, stored)).ok).toBe(false);

    const good = asAssertion(device.get({ challenge: o.challenge, rpId: 'localhost', origin: LOCAL.origin }))!;
    const used = { ...stored, counter: 5 }; // the device's counter (2) is behind what was stored: a copied key
    expect((await verifyPasskeyAssertion(good, o.challenge, LOCAL, used)).ok).toBe(false);

    const tampered = { ...good, response: { ...good.response, signature: b64u(crypto.randomBytes(70)) } };
    expect((await verifyPasskeyAssertion(tampered, o.challenge, LOCAL, stored)).ok).toBe(false);

    expect((await verifyPasskeyAssertion(good, 'b3RoZXItY2hhbGxlbmdl', LOCAL, stored)).ok).toBe(false);

    const onPreview = asAssertion(device.get({ challenge: o.challenge, rpId: PREVIEW.rpId, origin: PREVIEW.origin }))!;
    expect(await verifyPasskeyAssertion(onPreview, o.challenge, PREVIEW, stored)).toEqual({ ok: false, reason: 'made for localhost' });

    const someoneElse = asAssertion(device.get({ challenge: o.challenge, rpId: 'localhost', origin: LOCAL.origin, userId: '11111111-2222-4333-8444-555555555555' }))!;
    expect((await verifyPasskeyAssertion(someoneElse, o.challenge, LOCAL, stored)).ok).toBe(false);

    const otherKey = await enrol();
    const fromOther = asAssertion(otherKey.device.get({ challenge: o.challenge, rpId: 'localhost', origin: LOCAL.origin }))!;
    expect((await verifyPasskeyAssertion(fromOther, o.challenge, LOCAL, stored)).ok).toBe(false);
  });

  it('reads only answers shaped like a passkey', () => {
    expect(asRegistration(null)).toBeNull();
    expect(asRegistration({ id: 'abc', rawId: 'abc', type: 'public-key', response: {} })).toBeNull();
    expect(asAssertion({ id: 'a b', rawId: 'x', type: 'public-key', response: { clientDataJSON: '', authenticatorData: '', signature: '' } })).toBeNull();
    expect(asAssertion({ id: 'abc', rawId: 'abc', type: 'password', response: { clientDataJSON: '', authenticatorData: '', signature: '' } })).toBeNull();
    expect(asAssertion({ id: 'abc', rawId: 'abc', type: 'public-key', response: { clientDataJSON: 'a', authenticatorData: 'b', signature: 'c' } })).not.toBeNull();
  });
});
