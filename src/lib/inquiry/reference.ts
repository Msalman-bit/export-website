import crypto from 'node:crypto';

// Crockford base32 without I, L, O, U: readable on the phone and in an email subject.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}

/** An inquiry reference such as MS-261118-7KQ4F: the date it arrived and five random characters. */
export function inquiryReference(at = new Date()): string {
  const d = at.toISOString().slice(2, 10).replace(/-/g, '');
  return `MS-${d}-${randomCode(5)}`;
}

/** Document numbers: Q-2026-0042 (quotation), O-2026-0007 (order), INV-2026-0003 (invoice). */
export function documentNumber(prefix: 'Q' | 'O' | 'INV', sequence: number, at = new Date()): string {
  return `${prefix}-${at.getUTCFullYear()}-${String(sequence).padStart(4, '0')}`;
}

export const REFERENCE_PATTERN = /^MS-\d{6}-[0-9A-HJKMNP-TV-Z]{5}$/;
