import { describe, it, expect } from 'vitest';
import { totp, verifyTotp, base32Encode, base32Decode, newTotpSecret } from '@/lib/auth/totp';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/auth/password';
import { encrypt, decrypt, safeEqual, sha256 } from '@/lib/security/crypto';
import { rateLimit, limited, resetRateLimits } from '@/lib/security/rate-limit';
import { checkStepUpCode } from '@/lib/auth/step-up';
import { filledHoneypot, sentTooFast } from '@/lib/security/turnstile';
import { checkFile, UploadError } from '@/lib/security/upload';
import { can } from '@/lib/auth/rbac';

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 appendix B: the ASCII secret "12345678901234567890", SHA-1; 8-digit 94287082 at T=59 s
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('encodes the RFC secret', () => expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'));
  it('matches the RFC test vector at 59 s', () => expect(totp(secret, 59_000, 30, 8)).toBe('94287082'));
  it('matches the RFC test vector at 1111111109 s', () => expect(totp(secret, 1111111109_000, 30, 8)).toBe('07081804'));
  it('accepts the current code and one step of drift, refuses others', () => {
    const now = Date.now();
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 120_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
  });
  it('round-trips base32', () => {
    const s = newTotpSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
});

describe('passwords', () => {
  it('hashes with scrypt and verifies', async () => {
    const h = await hashPassword('correct horse battery 9');
    expect(h.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery 9', h)).toBe(true);
    expect(await verifyPassword('wrong password 1234', h)).toBe(false);
  });
  it('never stores the same hash twice (random salt)', async () => {
    expect(await hashPassword('same-password-123')).not.toBe(await hashPassword('same-password-123'));
  });
  it('enforces the password rule', () => {
    expect(passwordProblem('short1')).toMatch(/12/);
    expect(passwordProblem('onlylettershere')).toMatch(/number/);
    expect(passwordProblem('a-good-password-42')).toBeNull();
  });
});

describe('crypto helpers', () => {
  it('encrypts and decrypts secrets at rest', () => {
    const sealed = encrypt('JBSWY3DPEHPK3PXP');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(sealed)).toBe('JBSWY3DPEHPK3PXP');
  });
  it('detects tampering', () => {
    const sealed = encrypt('secret');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('compares in constant time and hashes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(sha256('a')).toHaveLength(64);
  });
});

describe('rate limiting', () => {
  it('allows the limit and refuses the next request', () => {
    resetRateLimits();
    const lim = { limit: 3, windowMs: 1000 };
    expect([1, 2, 3].map(() => rateLimit('t', lim, 0).ok)).toEqual([true, true, true]);
    expect(rateLimit('t', lim, 10).ok).toBe(false);
    expect(rateLimit('t', lim, 1500).ok).toBe(true);
  });
});

describe('step-up codes for destructive actions', () => {
  it('accepts the current code once, then refuses it as spent', () => {
    const secret = newTotpSecret(); const now = Date.now();
    const code = totp(secret, now);
    expect(checkStepUpCode('admin-1', secret, code, now)).toBe('ok');
    expect(checkStepUpCode('admin-1', secret, code, now + 1_000)).toBe('spent');
    expect(checkStepUpCode('admin-1', secret, totp(secret, now + 30_000), now + 1_000)).toBe('ok'); // the next code works
  });
  it('refuses a wrong, empty or old code and a missing key', () => {
    const secret = newTotpSecret(); const now = Date.now();
    expect(checkStepUpCode('admin-2', secret, '000000' === totp(secret, now) ? '111111' : '000000', now)).toBe('wrong');
    expect(checkStepUpCode('admin-2', secret, '', now)).toBe('wrong');
    expect(checkStepUpCode('admin-2', secret, totp(secret, now - 120_000), now)).toBe('wrong');
    expect(checkStepUpCode('admin-2', '', totp(secret, now), now)).toBe('wrong');
  });
  it('counts only failures towards the lock', () => {
    resetRateLimits();
    const lim = { limit: 2, windowMs: 60_000 };
    expect(limited('stepup:x', lim)).toBe(false);
    rateLimit('stepup:x', lim); expect(limited('stepup:x', lim)).toBe(false);
    rateLimit('stepup:x', lim); expect(limited('stepup:x', lim)).toBe(true);
  });
});

describe('form spam checks', () => {
  const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };
  it('takes a filled honeypot for a bot', () => {
    expect(filledHoneypot(form({ company_website: 'http://spam.example' }))).toBe(true);
    expect(filledHoneypot(form({ company_website: ' ' }))).toBe(false);
    expect(filledHoneypot(form({}))).toBe(false);
  });
  it('times the form on the sender’s clock only, so a clock ahead of the server is never mistaken for a bot', () => {
    expect(sentTooFast(form({ elapsed: '800' }))).toBe(true);
    expect(sentTooFast(form({ elapsed: '3000' }))).toBe(false);
    expect(sentTooFast(form({ elapsed: '42000', started: String(Date.now() + 600_000) }))).toBe(false); // old field ignored
    expect(sentTooFast(form({}))).toBe(false); // API clients send no timing
  });
});

describe('uploads', () => {
  const file = (name: string, bytes: number[] | string) => new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name);
  it('accepts a real PDF and PNG', async () => {
    await expect(checkFile(file('brief.pdf', '%PDF-1.7 test'), 'artwork')).resolves.toMatchObject({ ext: 'pdf', mime: 'application/pdf' });
    await expect(checkFile(file('logo.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), 'artwork')).resolves.toMatchObject({ ext: 'png' });
  });
  it('refuses a renamed executable, an SVG and a wrong extension', async () => {
    await expect(checkFile(file('logo.png', 'MZ\x90\x00 not a png'), 'artwork')).rejects.toBeInstanceOf(UploadError);
    await expect(checkFile(file('logo.svg', '<svg onload="alert(1)"/>'), 'artwork')).rejects.toBeInstanceOf(UploadError);
    await expect(checkFile(file('script.exe', 'MZ'), 'artwork')).rejects.toBeInstanceOf(UploadError);
  });
  it('cleans file names', async () => {
    const f = await checkFile(file('../../etc/<x>.pdf', '%PDF-1.4'), 'artwork');
    expect(f.filename).not.toMatch(/[/<>]/);
  });
});

describe('role-based access', () => {
  it('gives each role only its areas', () => {
    expect(can('admin', 'users.manage')).toBe(true);
    expect(can('sales', 'quotations.write')).toBe(true);
    expect(can('sales', 'users.manage')).toBe(false);
    // deleting a quotation is for administrators only: sales prepares, sends and declines them
    expect(can('admin', 'quotations.delete')).toBe(true);
    expect(can('sales', 'quotations.delete')).toBe(false);
    expect(can('production', 'quotations.delete')).toBe(false);
    expect(can('content', 'quotations.delete')).toBe(false);
    // deleting an inquiry likewise (and it needs a fresh authenticator code: step-up, below)
    expect(can('admin', 'inquiries.delete')).toBe(true);
    expect(can('sales', 'inquiries.delete')).toBe(false);
    expect(can('production', 'inquiries.delete')).toBe(false);
    expect(can('content', 'inquiries.delete')).toBe(false);
    // deleting a product too (also with a fresh code); a content editor edits and hides products but cannot delete
    expect(can('admin', 'catalogue.delete')).toBe(true);
    expect(can('content', 'catalogue.delete')).toBe(false);
    expect(can('content', 'catalogue.write')).toBe(true);
    expect(can('sales', 'catalogue.delete')).toBe(false);
    expect(can('production', 'catalogue.delete')).toBe(false);
    // so is resetting the analytics; sales and content staff only read them
    expect(can('admin', 'analytics.reset')).toBe(true);
    expect(can('sales', 'analytics.reset')).toBe(false);
    expect(can('content', 'analytics.reset')).toBe(false);
    expect(can('sales', 'analytics.read')).toBe(true);
    expect(can('content', 'inquiries.read')).toBe(false);
    expect(can('production', 'production.write')).toBe(true);
    expect(can('production', 'catalogue.write')).toBe(false);
    expect(can('customer', 'inquiries.read')).toBe(false);
  });
});
