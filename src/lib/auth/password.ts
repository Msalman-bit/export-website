import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (pw: crypto.BinaryLike, salt: crypto.BinaryLike, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

// scrypt with N = 2^15, r = 8, p = 1 (OWASP's minimum for scrypt), 64-byte key, 16-byte salt.
const N = 32768, R = 8, P = 1, LEN = 64;
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** A hash to compare against when the account does not exist, so timing does not reveal it. */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword(crypto.randomBytes(12).toString('hex')));
}

/** The password rule, in words the form shows: 12 characters or more, not only letters. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'Use 12 characters or more.';
  if (password.length > 200) return 'Use 200 characters or fewer.';
  if (/^[a-zA-Z]+$/.test(password)) return 'Add a number or a symbol.';
  return null;
}
