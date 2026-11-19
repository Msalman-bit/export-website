import crypto from 'node:crypto';

/* Small, dependency-free crypto helpers (Node's built-in crypto only). */

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function appKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET must be set (32+ characters) in production.');
    // development only: a fixed key so local sessions survive restarts
    return crypto.createHash('sha256').update('monolith-dev-only-secret').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/** AES-256-GCM, for secrets kept at rest (an administrator's TOTP seed). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', appKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(sealed: string): string {
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', appKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** HMAC signature for small values carried in cookies or links. */
export function sign(value: string): string {
  return crypto.createHmac('sha256', appKey()).update(value).digest('base64url');
}
