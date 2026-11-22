import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/* Uploads are checked by size, extension AND their first bytes (a renamed .exe is refused), stored
   under a random name outside /public, and only ever served back as a download with nosniff. */

export type UploadKind = 'artwork' | 'image' | 'media' | 'document';

type Rule = { exts: string[]; maxBytes: number };

export const UPLOAD_RULES: Record<UploadKind, Rule> = {
  // a customer's logo, artwork or brief attached to an inquiry
  artwork: { exts: ['pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg', 'webp'], maxBytes: 10 * 1024 * 1024 },
  // a concept preview or a logo image
  image: { exts: ['png', 'jpg', 'jpeg', 'webp'], maxBytes: 8 * 1024 * 1024 },
  // product photographs and films uploaded by staff
  media: { exts: ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'], maxBytes: 60 * 1024 * 1024 },
  // datasheets, certificates, invoices and technical documents
  document: { exts: ['pdf', 'png', 'jpg', 'jpeg'], maxBytes: 20 * 1024 * 1024 },
};

const MIME: Record<string, string> = {
  pdf: 'application/pdf', ai: 'application/postscript', eps: 'application/postscript', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm',
};

function sniff(head: Buffer): string | null {
  const s = head.subarray(0, 12);
  if (s.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (s.subarray(0, 4).toString('latin1') === '%!PS') return 'ps';
  if (s[0] === 0xc5 && s[1] === 0xd0 && s[2] === 0xd3 && s[3] === 0xc6) return 'ps';
  if (s[0] === 0x89 && s.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (s[0] === 0xff && s[1] === 0xd8 && s[2] === 0xff) return 'jpg';
  if (s.subarray(0, 4).toString('latin1') === 'RIFF' && s.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (s.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
  if (s[0] === 0x1a && s[1] === 0x45 && s[2] === 0xdf && s[3] === 0xa3) return 'webm';
  return null;
}

const FAMILY: Record<string, string[]> = {
  pdf: ['pdf', 'ai'], ps: ['ai', 'eps'], png: ['png'], jpg: ['jpg', 'jpeg'], webp: ['webp'], mp4: ['mp4'], webm: ['webm'],
};

export type CheckedFile = { filename: string; ext: string; mime: string; size: number; bytes: Buffer };

export class UploadError extends Error {}

export async function checkFile(file: File, kind: UploadKind): Promise<CheckedFile> {
  const rule = UPLOAD_RULES[kind];
  const filename = path.basename(file.name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'file';
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  if (!rule.exts.includes(ext)) throw new UploadError(`${filename}: send ${rule.exts.map((e) => e.toUpperCase()).join(', ')} files only.`);
  if (file.size === 0) throw new UploadError(`${filename} is empty.`);
  if (file.size > rule.maxBytes) throw new UploadError(`${filename} is over ${Math.round(rule.maxBytes / 1048576)} MB.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kindFound = sniff(bytes);
  if (!kindFound || !FAMILY[kindFound]?.includes(ext)) throw new UploadError(`${filename} is not a valid ${ext.toUpperCase()} file.`);
  return { filename, ext, mime: MIME[ext] || 'application/octet-stream', size: bytes.length, bytes };
}

export function uploadRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || './storage/uploads');
}

export async function storeFile(f: CheckedFile): Promise<string> {
  const month = new Date().toISOString().slice(0, 7);
  const stored = `${month}/${crypto.randomBytes(16).toString('hex')}.${f.ext}`;
  const full = path.join(/* turbopackIgnore: true */ uploadRoot(), stored);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, f.bytes, { flag: 'wx' });
  return stored;
}

export async function readStored(stored: string): Promise<Buffer> {
  const root = uploadRoot();
  const full = path.resolve(/* turbopackIgnore: true */ root, stored);
  if (!full.startsWith(root + path.sep)) throw new UploadError('Bad path');
  return fs.readFile(full);
}

export async function removeStored(stored: string): Promise<void> {
  const root = uploadRoot();
  const full = path.resolve(/* turbopackIgnore: true */ root, stored);
  if (!full.startsWith(root + path.sep)) return;
  await fs.rm(full, { force: true });
}
