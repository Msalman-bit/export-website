'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, isNull, sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { INQUIRY_STATUSES, ORDER_STATUSES, STAFF_ROLES, type InquiryStatus, type OrderStatus, type QuoteLine } from '@/lib/db/schema';
import { hashPassword, verifyPassword, dummyHash, passwordProblem } from '@/lib/auth/password';
import { createSession, destroySession, destroyAllSessions, markMfaVerified, readSession, requireStaff } from '@/lib/auth/session';
import { newTotpSecret, verifyTotp, otpauthUri } from '@/lib/auth/totp';
import { checkStepUpCode } from '@/lib/auth/step-up';
import { stepUpWithPasskey } from '@/lib/auth/passkey-request';
import { encrypt, decrypt, randomToken } from '@/lib/security/crypto';
import { rateLimit, limited, LIMITS } from '@/lib/security/rate-limit';
import { keyFrom } from '@/lib/security/request';
import { checkFile, storeFile, removeStored, UploadError, type UploadKind } from '@/lib/security/upload';
import { can, type Permission } from '@/lib/auth/rbac';
import { audit } from '@/lib/audit';
import { sendEmail } from '@/lib/email/send';
import { statusUpdate, quotationSent, messageNotice } from '@/lib/email/templates';
import { documentNumber } from '@/lib/inquiry/reference';
import { STATUS_LABEL } from '@/lib/status';
import { slugify } from '@/lib/db/seed';
import { LOCALES } from '@/lib/i18n/config';

/* Every staff action: an MFA-verified session holding the permission, input checked here, an audit
   entry, then a redirect back with a short flash message (?ok= / ?error=). */

const str = (fd: FormData, k: string, max = 5000) => String(fd.get(k) ?? '').trim().slice(0, max);
const list = (v: string) => v.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
const back: (path: string, msg: string, kind?: 'ok' | 'error') => never = (path, msg, kind = 'ok') => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);
const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function staff(permission: Permission) {
  const u = await requireStaff(permission);
  return { u, actor: { id: u.id, email: u.email }, db: await getDb() };
}

async function upload(file: FormDataEntryValue | null, kind: UploadKind, ownerType: typeof s.attachments.$inferInsert['ownerType'], ownerId: string | null, by: string) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  const checked = await checkFile(file, kind);
  const stored = await storeFile(checked);
  const db = await getDb();
  const [a] = await db.insert(s.attachments).values({ ownerType, ownerId, filename: checked.filename, storedName: stored, mime: checked.mime, size: checked.size, uploadedBy: by }).returning();
  return a;
}

// ------------------------------------------------------------------ sign-in and MFA
export async function staffLogin(_: unknown, fd: FormData): Promise<{ message?: string }> {
  const email = str(fd, 'email', 160).toLowerCase();
  const password = String(fd.get('password') ?? '');
  const ip = keyFrom(await headers());
  if (!rateLimit(`slogin:${ip}`, LIMITS.login).ok || !rateLimit(`slogin:${email}`, LIMITS.login).ok) return { message: 'Too many attempts. Wait 15 minutes.' };
  const db = await getDb();
  const [user] = await db.select().from(s.users).where(and(eq(s.users.email, email), eq(s.users.kind, 'staff'))).limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok || user.disabledAt || (user.lockedUntil && user.lockedUntil > new Date())) {
    if (user && !ok) {
      const fails = user.failedLogins + 1;
      await db.update(s.users).set({ failedLogins: fails, lockedUntil: fails >= 6 ? new Date(Date.now() + 30 * 60_000) : user.lockedUntil }).where(eq(s.users.id, user.id));
      await audit({ id: user.id, email: user.email }, 'staff.login_failed', 'user', user.id);
    }
    return { message: 'That email and password do not match a staff account.' };
  }
  await db.update(s.users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(s.users.id, user.id));
  await createSession(user.id, 'staff', false);
  await audit({ id: user.id, email: user.email }, 'staff.password_ok', 'user', user.id);
  redirect(user.mfaEnabledAt ? '/admin/mfa' : '/admin/mfa/setup');
}

export async function mfaSetupData(): Promise<{ secret: string; qr: string; uri: string } | null> {
  const user = await readSession('staff');
  if (!user || user.mfaEnabledAt) return null;
  const db = await getDb();
  let secret = user.mfaSecret ? decrypt(user.mfaSecret) : '';
  if (!secret) {
    secret = newTotpSecret();
    await db.update(s.users).set({ mfaSecret: encrypt(secret) }).where(eq(s.users.id, user.id));
  }
  const uri = otpauthUri(secret, user.email);
  // drawn as SVG, so every square stays exactly even however the screen scales it (a pixel image shrunk to fit
  // made them 5, 6 or 7 pixels wide, which phone scanners misread), with a two-square white border inside the frame;
  // the lowest redundancy level keeps the code as sparse as possible, ample for a code read off a screen
  const svg = await QRCode.toString(uri, { type: 'svg', margin: 2, errorCorrectionLevel: 'L' });
  return { secret, uri, qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
}

export async function mfaConfirm(_: unknown, fd: FormData): Promise<{ message?: string }> {
  const user = await readSession('staff');
  if (!user) redirect('/admin/login');
  if (!rateLimit(`mfa:${user.id}`, LIMITS.login).ok) return { message: 'Too many codes tried. Wait 15 minutes.' };
  if (!user.mfaSecret || !verifyTotp(decrypt(user.mfaSecret), str(fd, 'code', 10))) return { message: 'That code is not right. Codes change every 30 seconds; type the current one.' };
  const db = await getDb();
  if (!user.mfaEnabledAt) await db.update(s.users).set({ mfaEnabledAt: new Date() }).where(eq(s.users.id, user.id));
  await markMfaVerified('staff');
  await audit({ id: user.id, email: user.email }, user.mfaEnabledAt ? 'staff.login' : 'staff.mfa_enrolled', 'user', user.id);
  redirect('/admin');
}

export async function staffLogout() {
  const user = await readSession('staff');
  if (user) await audit({ id: user.id, email: user.email }, 'staff.logout', 'user', user.id);
  await destroySession('staff');
  redirect('/admin/login');
}

// ------------------------------------------------------------------ inquiries
export async function setInquiryStatus(fd: FormData) {
  const { u, actor, db } = await staff('inquiries.write');
  const id = str(fd, 'id'); const to = str(fd, 'status') as InquiryStatus; const note = str(fd, 'note', 2000);
  const path = `/admin/inquiries/${id}`;
  if (!uuid(id) || !INQUIRY_STATUSES.includes(to)) back(path, 'Choose a valid status.', 'error');
  if (['in_production', 'quality_inspection', 'shipped'].includes(to) && !(u.role === 'admin' || u.role === 'production' || u.role === 'sales')) back(path, 'Your role cannot set production stages.', 'error');
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, id)).limit(1);
  if (!inq) back('/admin/inquiries', 'Inquiry not found.', 'error');
  await db.update(s.inquiries).set({ status: to, updatedAt: new Date() }).where(eq(s.inquiries.id, id));
  const visible = fd.get('notify') === 'on';
  await db.insert(s.inquiryEvents).values({ inquiryId: id, kind: 'status', fromStatus: inq.status, toStatus: to, body: note, visibleToCustomer: visible, authorId: u.id });
  if (visible) await sendEmail({ to: inq.email, ...statusUpdate({ reference: inq.reference, contactName: inq.contactName, status: STATUS_LABEL[to], note, locale: inq.locale }) });
  await audit(actor, 'inquiry.status', 'inquiry', id, { from: inq.status, to, notified: visible });
  back(path, `Status set to ${STATUS_LABEL[to]}${visible ? ' and the customer notified' : ''}.`);
}

export async function addInquiryNote(fd: FormData) {
  const { u, actor, db } = await staff('inquiries.write');
  const id = str(fd, 'id'); const body = str(fd, 'body', 4000);
  if (!uuid(id) || !body) back(`/admin/inquiries/${id}`, 'Write the note first.', 'error');
  await db.insert(s.inquiryEvents).values({ inquiryId: id, kind: 'note', body, authorId: u.id });
  await audit(actor, 'inquiry.note', 'inquiry', id);
  back(`/admin/inquiries/${id}`, 'Note added.');
}

export async function assignInquiry(fd: FormData) {
  const { actor, db } = await staff('inquiries.write');
  const id = str(fd, 'id'); const to = str(fd, 'assignedTo');
  await db.update(s.inquiries).set({ assignedTo: uuid(to) ? to : null }).where(eq(s.inquiries.id, id));
  await audit(actor, 'inquiry.assign', 'inquiry', id, { to });
  back(`/admin/inquiries/${id}`, 'Owner updated.');
}

/** Creates (or finds) the customer company for an inquiry sent without an account, so quotations,
    orders and documents can be attached to it. */
export async function linkCompany(fd: FormData) {
  const { actor, db } = await staff('customers.write');
  const id = str(fd, 'id');
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, id)).limit(1);
  if (!inq) back('/admin/inquiries', 'Inquiry not found.', 'error');
  if (inq.companyId) back(`/admin/inquiries/${id}`, 'Already linked to a company.');
  const [existing] = await db.select().from(s.companies).where(sql`lower(${s.companies.name}) = lower(${inq.companyName})`).limit(1);
  const company = existing ?? (await db.insert(s.companies).values({ name: inq.companyName, country: inq.country === 'OTHER' ? '' : inq.country, phone: inq.phone }).returning())[0];
  await db.update(s.inquiries).set({ companyId: company.id }).where(eq(s.inquiries.email, inq.email));
  await audit(actor, 'company.link', 'company', company.id, { inquiry: id });
  back(`/admin/inquiries/${id}`, `Linked to ${company.name}. The customer sees it after registering with ${inq.email}.`);
}

function readLines(fd: FormData): QuoteLine[] {
  const desc = fd.getAll('l_desc').map(String), sku = fd.getAll('l_sku').map(String), qty = fd.getAll('l_qty').map(String), price = fd.getAll('l_price').map(String);
  return desc.map((d, i) => ({ description: d.trim().slice(0, 200), sku: (sku[i] ?? '').trim().slice(0, 60), quantity: Math.max(0, Math.floor(Number(qty[i]) || 0)), unitPrice: (Number(String(price[i]).replace(',', '.')) || 0).toFixed(2) }))
    .filter((l) => l.description && l.quantity > 0);
}

export async function saveQuotation(fd: FormData) {
  const { u, actor, db } = await staff('quotations.write');
  const inquiryId = str(fd, 'inquiryId'); const qid = str(fd, 'quotationId');
  const path = `/admin/inquiries/${inquiryId}`;
  const lines = readLines(fd);
  if (!lines.length) back(path, 'Add at least one line with a description and a quantity.', 'error');
  const currency = (['EUR', 'GBP', 'USD'].includes(str(fd, 'currency')) ? str(fd, 'currency') : 'EUR') as s.Currency;
  const shipping = Number(str(fd, 'shippingCost').replace(',', '.')) || 0;
  const total = lines.reduce((t, l) => t + Number(l.unitPrice) * l.quantity, 0) + shipping;
  const values = {
    currency, lines, shippingCost: shipping.toFixed(2), total: total.toFixed(2), paymentTerms: str(fd, 'paymentTerms', 500),
    incoterm: str(fd, 'incoterm', 120), leadTime: str(fd, 'leadTime', 200), validUntil: str(fd, 'validUntil', 20), notes: str(fd, 'notes', 2000),
  };
  if (uuid(qid)) {
    await db.update(s.quotations).set(values).where(and(eq(s.quotations.id, qid), eq(s.quotations.status, 'draft')));
  } else {
    await db.insert(s.quotations).values({ ...values, inquiryId, number: documentNumber('Q', await nextQuotationSequence(db)), createdBy: u.id });
    const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, inquiryId)).limit(1);
    if (inq && ['new', 'under_review'].includes(inq.status)) {
      await db.update(s.inquiries).set({ status: 'quotation_prepared', updatedAt: new Date() }).where(eq(s.inquiries.id, inquiryId));
      await db.insert(s.inquiryEvents).values({ inquiryId, kind: 'status', fromStatus: inq.status, toStatus: 'quotation_prepared', body: 'Quotation drafted', authorId: u.id });
    }
  }
  await audit(actor, 'quotation.save', 'inquiry', inquiryId, { total: values.total, currency });
  back(path, 'Quotation saved as a draft.');
}

/* The next quotation number follows the highest one ever issued, never the count of quotations: a deleted
   quotation (whose number a buyer may still hold) must not let its number, or any other, be issued twice.
   The numbers of deleted quotations are read back from the audit log, which is append-only. */
async function nextQuotationSequence(db: Awaited<ReturnType<typeof getDb>>) {
  const seq = (n: unknown) => Number(String(n ?? '').split('-').pop()) || 0;
  const live = await db.select({ number: s.quotations.number }).from(s.quotations);
  const gone = await db.select({ detail: s.auditLog.detail }).from(s.auditLog).where(eq(s.auditLog.action, 'quotation.delete'));
  return Math.max(0, ...live.map((r) => seq(r.number)), ...gone.map((r) => seq((r.detail as { number?: string }).number))) + 1;
}

/* Deleting a quotation. It is a business record, so: administrators only (quotations.delete); only a draft or a
   declined quotation, never one that is sent and awaiting an answer or accepted; never one an order points to;
   and only through the confirmation step, whose form carries the quotation's own number. The audit log keeps who
   deleted which quotation and when, with its number, status and total; the inquiry's timeline notes it too. */
export async function deleteQuotation(fd: FormData) {
  const { u, actor, db } = await staff('quotations.delete');
  const qid = str(fd, 'quotationId');
  if (!uuid(qid)) back('/admin/inquiries', 'Quotation not found.', 'error');
  const [q] = await db.select().from(s.quotations).where(eq(s.quotations.id, qid)).limit(1);
  if (!q) back('/admin/inquiries', 'Quotation not found.', 'error');
  const path = `/admin/inquiries/${q.inquiryId}`;
  if (str(fd, 'confirm') !== q.number) back(path, `Confirm the deletion of ${q.number} first.`, 'error');
  if (q.status !== 'draft' && q.status !== 'declined') {
    back(path, `${q.number} is ${q.status}. Only a draft or a declined quotation can be deleted${q.status === 'sent' ? ': mark it declined first' : ''}.`, 'error');
  }
  const [order] = await db.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.quotationId, q.id)).limit(1);
  if (order) back(path, `${q.number} belongs to an order and cannot be deleted.`, 'error');

  await db.delete(s.quotations).where(eq(s.quotations.id, q.id));
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, q.inquiryId)).limit(1);
  const left = await db.select({ id: s.quotations.id }).from(s.quotations).where(eq(s.quotations.inquiryId, q.inquiryId)).limit(1);
  const body = `Quotation ${q.number} (${q.status}) deleted`;
  // with no quotation left, an inquiry that said "quotation prepared" or "sent" steps back to review
  if (inq && !left.length && (inq.status === 'quotation_prepared' || inq.status === 'quotation_sent')) {
    await db.update(s.inquiries).set({ status: 'under_review', updatedAt: new Date() }).where(eq(s.inquiries.id, inq.id));
    await db.insert(s.inquiryEvents).values({ inquiryId: inq.id, kind: 'status', fromStatus: inq.status, toStatus: 'under_review', body, authorId: u.id });
  } else {
    await db.insert(s.inquiryEvents).values({ inquiryId: q.inquiryId, kind: 'note', body, authorId: u.id });
  }
  await audit(actor, 'quotation.delete', 'quotation', q.id, {
    number: q.number, status: q.status, total: q.total, currency: q.currency, inquiry: inq?.reference ?? q.inquiryId,
  });
  back(path, `Quotation ${q.number} deleted.`);
}

/* Step 2 of a destructive action: the six-digit code the staff member's authenticator app shows now, although the
   session already passed two-factor at sign-in, or instead one of their own passkeys, unlocked on the device with
   Face ID, a fingerprint or its PIN (the form's "passkey" field, filled by PasskeyConfirm in ./forms). A code
   confirms one action only (deleting an inquiry or a product, resetting the analytics: one spent list), a passkey
   answer one challenge only, and five failures in 15 minutes lock these actions for that person. A refusal is
   audited, and nothing happens. Returns how it was confirmed, for the action's own audit entry. */
async function requireStepUp(u: Awaited<ReturnType<typeof requireStaff>>, fd: FormData, path: string, refused: { action: string; entity: string; id: string; detail: Record<string, unknown> }, nothing: string): Promise<string> {
  const limitKey = `stepup:${u.id}`;
  if (limited(limitKey, LIMITS.stepUp)) back(path, 'Too many wrong codes. Wait 15 minutes, then try again.', 'error');
  const passkey = String(fd.get('passkey') ?? '');
  if (passkey) {
    const r = await stepUpWithPasskey(u.id, passkey);
    if (r.ok) return `passkey (${r.name})`;
    rateLimit(limitKey, LIMITS.stepUp);
    await audit({ id: u.id, email: u.email }, refused.action, refused.entity, refused.id, { ...refused.detail, reason: `passkey: ${r.reason}` });
    back(path, `The passkey could not be confirmed. Try again, or use the code from your authenticator app. ${nothing}`, 'error');
  }
  const result = checkStepUpCode(u.id, u.mfaSecret ? decrypt(u.mfaSecret) : '', str(fd, 'code', 10));
  if (result === 'ok') return 'authenticator code';
  rateLimit(limitKey, LIMITS.stepUp);
  await audit({ id: u.id, email: u.email }, refused.action, refused.entity, refused.id, { ...refused.detail, reason: result === 'spent' ? 'code already used' : 'wrong code' });
  back(path, result === 'spent'
    ? `That code was already used. Wait for the next code in your authenticator app. ${nothing}`
    : `That code is not right. Type the six-digit code your authenticator app shows now. ${nothing}`, 'error');
}

/* Resetting the analytics (administrators only, analytics.reset): every count recorded so far is deleted (product
   views, list additions, quote and sample requests, downloads, registrations, studio use), on Analytics and on the
   dashboard, and counting starts again. Two steps, as for deleting an inquiry: the warning, then a fresh
   authenticator code. Inquiries, customers, orders and emails are not touched. The audit log keeps who reset it and
   when, with the number removed of each count. */
export async function resetAnalytics(fd: FormData) {
  const { u, actor, db } = await staff('analytics.reset');
  const path = '/admin/analytics';
  if (str(fd, 'confirm') !== 'reset-analytics') back(path, 'Confirm the reset first.', 'error');
  const counts = await db.select({ name: s.events.name, n: sql<number>`count(*)::int` }).from(s.events).groupBy(s.events.name);
  const total = counts.reduce((t, c) => t + c.n, 0);
  if (!total) back(path, 'Nothing to reset: every count is already at zero.');
  const verified = await requireStepUp(u, fd, path, { action: 'analytics.reset_refused', entity: 'analytics', id: 'all', detail: { total } }, 'Nothing was reset.');
  await db.delete(s.events);
  await audit(actor, 'analytics.reset', 'analytics', 'all', { total, counts: Object.fromEntries(counts.map((c) => [c.name, c.n])), verified });
  back(path, `Analytics reset: ${total} ${total === 1 ? 'count' : 'counts'} removed. Counting starts again from now.`);
}

/* Deleting an inquiry. Administrators only (inquiries.delete), in two steps: the warning on the inquiry page, then
   the six-digit code the administrator's authenticator app shows now (step-up: the signed-in session alone is not
   enough, and a code confirms one deletion only). Refused while the inquiry has an order (orders and invoices stay
   on record) or a quotation that is sent or accepted. It removes the inquiry with its product lines, timeline,
   draft and declined quotations and uploaded files; emails already sent stay in the outbox, the buyer's account
   and messages stay. The analytics are not touched: only Analytics > Reset the analytics changes the counts. The
   audit log keeps who deleted which inquiry and when, and every quotation number it held, so those numbers are never
   issued again (nextQuotationSequence). */
export async function deleteInquiry(fd: FormData) {
  const { u, actor, db } = await staff('inquiries.delete');
  const id = str(fd, 'id');
  if (!uuid(id)) back('/admin/inquiries', 'Inquiry not found.', 'error');
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, id)).limit(1);
  if (!inq) back('/admin/inquiries', 'Inquiry not found.', 'error');
  const path = `/admin/inquiries/${id}`;
  if (str(fd, 'confirm') !== inq.reference) back(path, `Confirm the deletion of ${inq.reference} first.`, 'error');

  const [order] = await db.select({ number: s.orders.number }).from(s.orders).where(eq(s.orders.inquiryId, id)).limit(1);
  if (order) back(path, `Order ${order.number} was made from ${inq.reference}, so it cannot be deleted: orders and invoices stay on record.`, 'error');
  const quotes = await db.select().from(s.quotations).where(eq(s.quotations.inquiryId, id));
  const live = quotes.find((q) => q.status === 'sent' || q.status === 'accepted');
  if (live) back(path, `Quotation ${live.number} is ${live.status}, so ${inq.reference} cannot be deleted${live.status === 'sent' ? ': mark the quotation declined first' : ''}.`, 'error');

  // step 2: the authenticator code or a passkey
  const verified = await requireStepUp(u, fd, path, { action: 'inquiry.delete_refused', entity: 'inquiry', id, detail: { reference: inq.reference } }, 'Nothing was deleted.');

  const files = await db.select().from(s.attachments).where(and(eq(s.attachments.ownerType, 'inquiry'), eq(s.attachments.ownerId, id)));
  const lines = await db.select({ productId: s.inquiryItems.productId }).from(s.inquiryItems).where(eq(s.inquiryItems.inquiryId, id));
  await db.transaction(async (tx) => {
    await tx.delete(s.attachments).where(and(eq(s.attachments.ownerType, 'inquiry'), eq(s.attachments.ownerId, id)));
    await tx.delete(s.inquiries).where(eq(s.inquiries.id, id)); // its lines, timeline and quotations go with it
  });
  for (const f of files) await removeStored(f.storedName).catch(() => undefined);
  for (const q of quotes) {
    await audit(actor, 'quotation.delete', 'quotation', q.id, {
      number: q.number, status: q.status, total: q.total, currency: q.currency, inquiry: inq.reference, with: 'inquiry',
    });
  }
  await audit(actor, 'inquiry.delete', 'inquiry', id, {
    reference: inq.reference, company: inq.companyName, email: inq.email, status: inq.status, items: lines.length, files: files.length,
    quotations: quotes.map((q) => q.number), verified,
  });
  back('/admin/inquiries', `Inquiry ${inq.reference} deleted.`);
}

export async function sendQuotationAction(fd: FormData) {
  const { u, actor, db } = await staff('quotations.write');
  const qid = str(fd, 'quotationId');
  const [q] = await db.select().from(s.quotations).where(eq(s.quotations.id, qid)).limit(1);
  if (!q) back('/admin/inquiries', 'Quotation not found.', 'error');
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, q.inquiryId)).limit(1);
  await db.update(s.quotations).set({ status: 'sent', sentAt: new Date() }).where(eq(s.quotations.id, qid));
  await db.update(s.inquiries).set({ status: 'quotation_sent', updatedAt: new Date() }).where(eq(s.inquiries.id, inq.id));
  await db.insert(s.inquiryEvents).values({ inquiryId: inq.id, kind: 'status', fromStatus: inq.status, toStatus: 'quotation_sent', body: `Quotation ${q.number} sent`, visibleToCustomer: true, authorId: u.id });
  await sendEmail({ to: inq.email, ...quotationSent({ reference: inq.reference, number: q.number, contactName: inq.contactName, total: Number(q.total).toLocaleString('en-GB', { minimumFractionDigits: 2 }), currency: q.currency, validUntil: q.validUntil, locale: inq.locale }) });
  await audit(actor, 'quotation.send', 'quotation', qid);
  back(`/admin/inquiries/${inq.id}`, `Quotation ${q.number} sent to ${inq.email}.`);
}

export async function setQuotationOutcome(fd: FormData) {
  const { actor, db } = await staff('quotations.write');
  const qid = str(fd, 'quotationId'); const outcome = str(fd, 'outcome') === 'accepted' ? 'accepted' : 'declined';
  const [q] = await db.update(s.quotations).set({ status: outcome }).where(eq(s.quotations.id, qid)).returning();
  await audit(actor, `quotation.${outcome}`, 'quotation', qid);
  back(`/admin/inquiries/${q.inquiryId}`, `Quotation marked ${outcome}.`);
}

export async function createOrder(fd: FormData) {
  const { u, actor, db } = await staff('orders.write');
  const qid = str(fd, 'quotationId');
  const [q] = await db.select().from(s.quotations).where(eq(s.quotations.id, qid)).limit(1);
  if (!q) back('/admin/orders', 'Quotation not found.', 'error');
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, q.inquiryId)).limit(1);
  if (!inq.companyId) back(`/admin/inquiries/${inq.id}`, 'Link the inquiry to a company first, so the customer sees the order.', 'error');
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.orders);
  const [order] = await db.insert(s.orders).values({ number: documentNumber('O', n + 1), companyId: inq.companyId, inquiryId: inq.id, quotationId: q.id, currency: q.currency, total: q.total }).returning();
  await db.update(s.quotations).set({ status: 'accepted' }).where(eq(s.quotations.id, qid));
  await db.update(s.inquiries).set({ status: 'order_confirmed', updatedAt: new Date() }).where(eq(s.inquiries.id, inq.id));
  await db.insert(s.inquiryEvents).values({ inquiryId: inq.id, kind: 'status', fromStatus: inq.status, toStatus: 'order_confirmed', body: `Order ${order.number} confirmed`, visibleToCustomer: true, authorId: u.id });
  await audit(actor, 'order.create', 'order', order.id, { quotation: q.number });
  back(`/admin/orders/${order.id}`, `Order ${order.number} created.`);
}

export async function sendStaffMessage(fd: FormData) {
  const { u, actor, db } = await staff('customers.write');
  const companyId = str(fd, 'companyId'); const inquiryId = str(fd, 'inquiryId'); const body = str(fd, 'body', 4000); const ret = str(fd, 'return', 200) || '/admin';
  if (!uuid(companyId) || !body) back(ret, 'Write the message first.', 'error');
  await db.insert(s.messages).values({ companyId, inquiryId: uuid(inquiryId) ? inquiryId : null, authorId: u.id, fromStaff: true, body });
  const users = await db.select().from(s.users).where(and(eq(s.users.companyId, companyId), eq(s.users.kind, 'customer')));
  const [inq] = uuid(inquiryId) ? await db.select().from(s.inquiries).where(eq(s.inquiries.id, inquiryId)).limit(1) : [];
  for (const cu of users) if (cu.emailVerifiedAt) await sendEmail({ to: cu.email, ...messageNotice({ name: cu.name, reference: inq?.reference ?? 'your account', locale: inq?.locale ?? 'en' }) });
  await audit(actor, 'message.send', 'company', companyId);
  back(ret, 'Message sent.');
}

// ------------------------------------------------------------------ orders
export async function setOrderStatus(fd: FormData) {
  const { u, actor, db } = await staff('production.write');
  const id = str(fd, 'id'); const to = str(fd, 'status') as OrderStatus;
  if (!ORDER_STATUSES.includes(to)) back(`/admin/orders/${id}`, 'Choose a valid stage.', 'error');
  const [o] = await db.update(s.orders).set({ status: to, updatedAt: new Date() }).where(eq(s.orders.id, id)).returning();
  if (o.inquiryId) {
    const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, o.inquiryId)).limit(1);
    await db.update(s.inquiries).set({ status: to, updatedAt: new Date() }).where(eq(s.inquiries.id, o.inquiryId));
    await db.insert(s.inquiryEvents).values({ inquiryId: o.inquiryId, kind: 'status', fromStatus: inq?.status, toStatus: to, body: str(fd, 'note', 1000), visibleToCustomer: true, authorId: u.id });
    if (inq && fd.get('notify') === 'on') await sendEmail({ to: inq.email, ...statusUpdate({ reference: `${o.number} (${inq.reference})`, contactName: inq.contactName, status: STATUS_LABEL[to], note: str(fd, 'note', 1000), locale: inq.locale }) });
  }
  await audit(actor, 'order.status', 'order', id, { to });
  back(`/admin/orders/${id}`, `Stage set to ${STATUS_LABEL[to]}.`);
}

export async function addShipment(fd: FormData) {
  const { actor, db } = await staff('shipping.write');
  const orderId = str(fd, 'orderId');
  const url = str(fd, 'trackingUrl', 400);
  if (url && !/^https:\/\//.test(url)) back(`/admin/orders/${orderId}`, 'The tracking link must start with https://.', 'error');
  await db.insert(s.shipments).values({ orderId, method: str(fd, 'method', 40), carrier: str(fd, 'carrier', 80), trackingNumber: str(fd, 'trackingNumber', 80), trackingUrl: url, shippedAt: str(fd, 'shippedAt', 20), eta: str(fd, 'eta', 20), status: 'booked' });
  await audit(actor, 'shipment.add', 'order', orderId);
  back(`/admin/orders/${orderId}`, 'Shipment added.');
}

export async function addInvoice(fd: FormData) {
  const { actor, db } = await staff('orders.write');
  const orderId = str(fd, 'orderId');
  const amount = Number(str(fd, 'amount').replace(',', '.'));
  if (!(amount > 0)) back(`/admin/orders/${orderId}`, 'Write the invoice amount.', 'error');
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId)).limit(1);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.invoices);
  await db.insert(s.invoices).values({ orderId, number: documentNumber('INV', n + 1), amount: amount.toFixed(2), currency: o.currency, issuedAt: new Date().toISOString().slice(0, 10), dueAt: str(fd, 'dueAt', 20), notes: str(fd, 'notes', 1000) });
  await audit(actor, 'invoice.add', 'order', orderId, { amount });
  back(`/admin/orders/${orderId}`, 'Invoice issued.');
}

export async function setInvoiceStatus(fd: FormData) {
  const { actor, db } = await staff('orders.write');
  const id = str(fd, 'id'); const st = (['issued', 'paid', 'void'].includes(str(fd, 'status')) ? str(fd, 'status') : 'issued') as 'issued' | 'paid' | 'void';
  const [inv] = await db.update(s.invoices).set({ status: st }).where(eq(s.invoices.id, id)).returning();
  await audit(actor, 'invoice.status', 'invoice', id, { st });
  back(`/admin/orders/${inv.orderId}`, `Invoice ${inv.number} marked ${st}.`);
}

export async function saveCompanyNotes(fd: FormData) {
  const { actor, db } = await staff('customers.write');
  const id = str(fd, 'id');
  await db.update(s.companies).set({ notes: str(fd, 'notes', 4000), updatedAt: new Date() }).where(eq(s.companies.id, id));
  await audit(actor, 'company.notes', 'company', id);
  back(`/admin/customers/${id}`, 'Notes saved.');
}

// ------------------------------------------------------------------ catalogue
export async function saveProduct(fd: FormData) {
  const { actor, db } = await staff('catalogue.write');
  const id = str(fd, 'id');
  const name = str(fd, 'name', 160);
  const categoryId = str(fd, 'categoryId');
  if (!name || !uuid(categoryId)) back(id ? `/admin/products/${id}` : '/admin/products/new', 'Name and category are required.', 'error');
  const specs = list(str(fd, 'specs', 4000).replace(/,/g, '\u0000')).map((line) => line.replace(/\u0000/g, ',')).map((line) => { const [label, ...v] = line.split(':'); return { label: label.trim(), value: v.join(':').trim() }; }).filter((x) => x.label && x.value);
  const values = {
    name, categoryId, slug: slugify(str(fd, 'slug', 120) || name), sku: str(fd, 'sku', 60) || `MS-${randomToken(4).toUpperCase()}`,
    summary: str(fd, 'summary', 400), description: str(fd, 'description', 5000), construction: str(fd, 'construction', 300), materials: str(fd, 'materials', 300),
    sizes: list(str(fd, 'sizes', 500)), weight: str(fd, 'weight', 120), colours: list(str(fd, 'colours', 500)),
    brandingOptions: list(str(fd, 'brandingOptions', 800)), packagingOptions: list(str(fd, 'packagingOptions', 800)),
    moq: str(fd, 'moq', 120), leadTime: str(fd, 'leadTime', 120), testingStandards: list(str(fd, 'testingStandards', 800)), specs,
    studioModel: (['football', 'rugby', 'glove', 'jersey'].includes(str(fd, 'studioModel')) ? str(fd, 'studioModel') : null) as 'football' | 'rugby' | 'glove' | 'jersey' | null,
    status: (str(fd, 'status') === 'published' ? 'published' : 'draft') as 'draft' | 'published', featured: fd.get('featured') === 'on',
    seoTitle: str(fd, 'seoTitle', 160), seoDescription: str(fd, 'seoDescription', 300), updatedAt: new Date(),
  };
  try {
    if (uuid(id)) await db.update(s.products).set(values).where(eq(s.products.id, id));
    else { const [p] = await db.insert(s.products).values(values).returning(); await audit(actor, 'product.create', 'product', p.id); back(`/admin/products/${p.id}`, 'Product created.'); }
  } catch (e) {
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) back(id ? `/admin/products/${id}` : '/admin/products/new', 'That SKU or URL is already used by another product.', 'error');
    throw e;
  }
  await audit(actor, 'product.update', 'product', id, { status: values.status });
  back(`/admin/products/${id}`, 'Product saved.');
}

/* Deleting a product (administrators only, catalogue.delete): it leaves the site at once and its page stops working,
   so it takes two steps, as for deleting an inquiry: the product's SKU typed to confirm, then a fresh authenticator
   code. Past inquiries and quotations keep its name and SKU. Hiding it (Status: Draft) is the everyday, reversible way
   to take a product off the site; adding and editing need no code. */
export async function deleteProduct(fd: FormData) {
  const { u, actor, db } = await staff('catalogue.delete');
  const id = str(fd, 'id');
  // back to the list as it was searched when the product was opened (the product page passes its ?q= along)
  const q = str(fd, 'q', 60);
  const list = q ? `/admin/products?q=${encodeURIComponent(q)}` : '/admin/products';
  const [p] = uuid(id) ? await db.select().from(s.products).where(eq(s.products.id, id)).limit(1) : [];
  if (!p) back(list, 'Product not found.', 'error');
  const path = `/admin/products/${id}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  if (str(fd, 'confirm', 60).toUpperCase() !== p!.sku.toUpperCase()) back(path, `Type the SKU, ${p!.sku}, to confirm the deletion. Nothing was deleted.`, 'error');
  // step 2: the authenticator code or a passkey
  const verified = await requireStepUp(u, fd, path, { action: 'product.delete_refused', entity: 'product', id, detail: { sku: p!.sku, name: p!.name } }, 'Nothing was deleted.');
  await db.delete(s.products).where(eq(s.products.id, id));
  await audit(actor, 'product.delete', 'product', id, { sku: p!.sku, name: p!.name, status: p!.status, verified });
  back(list, `Product ${p!.name} (${p!.sku}) deleted.`);
}

export async function addProductImage(fd: FormData) {
  const { u, actor, db } = await staff('media.write');
  const id = str(fd, 'id');
  try {
    const a = await upload(fd.get('file'), 'media', 'media', id, u.id);
    if (!a || !a.mime.startsWith('image/')) back(`/admin/products/${id}`, 'Choose a PNG, JPG or WEBP photograph.', 'error');
    const [p] = await db.select().from(s.products).where(eq(s.products.id, id)).limit(1);
    const images = [...p.images, { url: `/media/${a!.id}`, alt: str(fd, 'alt', 200) || p.name, source: 'client' }];
    await db.update(s.products).set({ images, updatedAt: new Date() }).where(eq(s.products.id, id));
  } catch (e) { if (e instanceof UploadError) back(`/admin/products/${id}`, e.message, 'error'); throw e; }
  await audit(actor, 'product.image_add', 'product', id);
  back(`/admin/products/${id}`, 'Photograph added.');
}

export async function removeProductImage(fd: FormData) {
  const { actor, db } = await staff('catalogue.write');
  const id = str(fd, 'id'); const idx = Number(str(fd, 'index'));
  const [p] = await db.select().from(s.products).where(eq(s.products.id, id)).limit(1);
  await db.update(s.products).set({ images: p.images.filter((_, i) => i !== idx) }).where(eq(s.products.id, id));
  await audit(actor, 'product.image_remove', 'product', id, { idx });
  back(`/admin/products/${id}`, 'Picture removed.');
}

export async function saveCategory(fd: FormData) {
  const { actor, db } = await staff('catalogue.write');
  const id = str(fd, 'id');
  const [c] = uuid(id) ? await db.select({ parentId: s.categories.parentId }).from(s.categories).where(eq(s.categories.id, id)).limit(1) : [];
  if (!c) back(CATS, 'That category no longer exists.', 'error');
  await db.update(s.categories).set({
    name: str(fd, 'name', 120), summary: str(fd, 'summary', 400), body: str(fd, 'body', 3000), published: fd.get('published') === 'on',
    seoTitle: str(fd, 'seoTitle', 160), seoDescription: str(fd, 'seoDescription', 300), sortOrder: Number(str(fd, 'sortOrder')) || 0, updatedAt: new Date(),
  }).where(eq(s.categories.id, id));
  await audit(actor, 'category.update', 'category', id, { published: fd.get('published') === 'on' });
  backToSection(`cat-${c!.parentId ?? id}`, 'Category saved.');
}

/* The categories page is long (a section per family): each form below sends its message back to the section it
   was sent from, the page opens scrolled there and shows the message in it. */
const CATS = '/admin/categories';
const backToSection: (section: string, msg: string, kind?: 'ok' | 'error') => never = (section, msg, kind = 'ok') =>
  redirect(`${CATS}?at=${encodeURIComponent(section)}&${kind}=${encodeURIComponent(msg)}#${section}`);

/** A new family (no parentId) or a new product type inside a family. It starts hidden, so its products can be
    added before anyone sees it; a family brings the picture for its tile. Its web address comes from the name. */
export async function createCategory(fd: FormData) {
  const { u, actor, db } = await staff('catalogue.write');
  const parentId = str(fd, 'parentId');
  const isType = parentId !== '';
  const here = isType && uuid(parentId) ? `cat-${parentId}` : 'new-family';
  const fail = (msg: string): never => backToSection(here, msg, 'error');
  const name = str(fd, 'name', 120).replace(/\s+/g, ' ');
  const summary = str(fd, 'summary', 400);
  if (isType && !uuid(parentId)) fail('Choose the family the product type belongs to.');
  if (name.length < 2) fail(isType ? 'Give the product type a name.' : 'Give the family a name.');
  const [fam] = isType ? await db.select().from(s.categories).where(and(eq(s.categories.id, parentId), isNull(s.categories.parentId))).limit(1) : [null];
  if (isType && !fam) fail('That family no longer exists.');
  const all = await db.select({ slug: s.categories.slug, name: s.categories.name, parentId: s.categories.parentId, sortOrder: s.categories.sortOrder }).from(s.categories);
  const siblings = all.filter((c) => (c.parentId ?? '') === parentId);
  if (siblings.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    fail(isType ? `${fam!.name} already has a product type called “${name}”.` : `There is already a family called “${name}”.`);
  }
  const base = slugify(name);
  if (!base) fail('Use letters or numbers in the name: it becomes the web address.');
  // web addresses are unique across every family and type: a second "Protective accessories" becomes "...-2"
  const taken = new Set(all.map((c) => c.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  if (!isType && !summary) fail('Write the family’s one-line summary: it shows under its name on the home page and in the catalogue.');
  if (!isType && !hasFile(fd.get('file'))) fail('Add a picture for the family’s tile.');
  if (!isType && !can(u.role, 'media.write')) fail('Your role cannot upload pictures.');

  const id = randomUUID();
  let image: s.ProductImage | null = null;
  if (!isType) {
    try {
      const a = await upload(fd.get('file'), 'media', 'media', id, u.id);
      if (!a || !a.mime.startsWith('image/')) { if (a) await dropOwnPicture(`/media/${a.id}`, id); fail('Choose a PNG, JPG or WEBP picture for the family.'); }
      image = { url: `/media/${a!.id}`, alt: str(fd, 'alt', 200) || name, source: 'client' };
    } catch (e) { if (e instanceof UploadError) fail(e.message); throw e; }
  }
  const sortOrder = siblings.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;
  await db.insert(s.categories).values({
    id, slug, parentId: isType ? parentId : null, name, summary, body: isType ? '' : str(fd, 'body', 3000), image, sortOrder, published: false,
    seoTitle: isType ? '' : `${name} manufacturer, private label and wholesale`, seoDescription: summary,
  });
  await audit(actor, 'category.create', 'category', id, { name, slug, family: isType ? fam!.name : null });
  if (isType) backToSection(here, `Product type “${name}” added to ${fam!.name}. It stays hidden until you tick its Published box; add its products first (Products, New product).`);
  backToSection(`cat-${id}`, `Family “${name}” added. It stays hidden until you tick its Published box; add its product types below and their products first.`);
}

/** A family's tile picture (home page, catalogue, its own page). A picture uploaded for this family before is deleted. */
export async function setCategoryPicture(fd: FormData) {
  const { u, actor, db } = await staff('catalogue.write');
  const id = str(fd, 'id');
  const [c] = uuid(id) ? await db.select().from(s.categories).where(eq(s.categories.id, id)).limit(1) : [];
  if (!c || c.parentId) back(CATS, 'Only a family has a picture.', 'error');
  const fail = (msg: string): never => backToSection(`cat-${id}`, msg, 'error');
  if (!can(u.role, 'media.write')) fail('Your role cannot upload pictures.');
  if (!hasFile(fd.get('file'))) fail('Choose a picture.');
  try {
    const a = await upload(fd.get('file'), 'media', 'media', id, u.id);
    if (!a || !a.mime.startsWith('image/')) { if (a) await dropOwnPicture(`/media/${a.id}`, id); fail('Choose a PNG, JPG or WEBP picture.'); }
    await db.update(s.categories).set({ image: { url: `/media/${a!.id}`, alt: str(fd, 'alt', 200) || c!.name, source: 'client' }, updatedAt: new Date() }).where(eq(s.categories.id, id));
  } catch (e) { if (e instanceof UploadError) fail(e.message); throw e; }
  await dropOwnPicture(c!.image?.url, id);
  await audit(actor, 'category.image', 'category', id);
  backToSection(`cat-${id}`, `New picture for ${c!.name}.`);
}

/** Deletes a family or product type that holds nothing: a typing mistake in a new name is fixed this way, since a
    web address never changes. Anything with products (or a family with product types) is refused. */
export async function deleteCategory(fd: FormData) {
  const { actor, db } = await staff('catalogue.write');
  const id = str(fd, 'id');
  const [c] = uuid(id) ? await db.select().from(s.categories).where(eq(s.categories.id, id)).limit(1) : [];
  if (!c) back(CATS, 'That category no longer exists.', 'error');
  const here = `cat-${c!.parentId ?? id}`;
  const [{ types }] = await db.select({ types: sql<number>`count(*)::int` }).from(s.categories).where(eq(s.categories.parentId, id));
  const [{ products }] = await db.select({ products: sql<number>`count(*)::int` }).from(s.products).where(eq(s.products.categoryId, id));
  if (types) backToSection(here, `${c!.name} still has ${types === 1 ? 'a product type' : `${types} product types`}. Delete those first (each must be empty).`, 'error');
  if (products) backToSection(here, `${c!.name} still has ${products === 1 ? 'a product' : `${products} products`}. Move them to another type or delete them first.`, 'error');
  await db.delete(s.categories).where(eq(s.categories.id, id));
  await dropOwnPicture(c!.image?.url, id);
  await audit(actor, 'category.delete', 'category', id, { name: c!.name, slug: c!.slug });
  if (c!.parentId) backToSection(here, `${c!.name} deleted.`);
  back(CATS, `${c!.name} deleted.`);
}

const hasFile = (f: FormDataEntryValue | null) => !!f && typeof f !== 'string' && f.size > 0;

/** Deletes a picture that was uploaded for this category (never a generated one, or a library file used elsewhere). */
async function dropOwnPicture(url: string | undefined, categoryId: string) {
  const aid = url?.match(/^\/media\/([0-9a-f-]{36})$/i)?.[1];
  if (!aid) return;
  const db = await getDb();
  const [a] = await db.select().from(s.attachments).where(and(eq(s.attachments.id, aid), eq(s.attachments.ownerId, categoryId))).limit(1);
  if (!a) return;
  await db.delete(s.attachments).where(eq(s.attachments.id, a.id));
  await removeStored(a.storedName).catch(() => undefined);
}

export async function uploadMedia(fd: FormData) {
  const { u, actor } = await staff('media.write');
  try {
    const a = await upload(fd.get('file'), 'media', 'media', null, u.id);
    if (!a) back('/admin/media', 'Choose a file.', 'error');
    await audit(actor, 'media.upload', 'attachment', a!.id);
    back('/admin/media', `Uploaded. Its address is /media/${a!.id}`);
  } catch (e) { if (e instanceof UploadError) back('/admin/media', e.message, 'error'); throw e; }
}

// ------------------------------------------------------------------ content
export async function savePage(fd: FormData) {
  const { actor, db } = await staff('content.write');
  const id = str(fd, 'id');
  await db.update(s.pages).set({
    title: str(fd, 'title', 160), summary: str(fd, 'summary', 400), body: str(fd, 'body', 20000), seoTitle: str(fd, 'seoTitle', 160),
    seoDescription: str(fd, 'seoDescription', 300), status: str(fd, 'status') === 'published' ? 'published' : 'draft',
    needsReview: fd.get('needsReview') === 'on', updatedAt: new Date(),
  }).where(eq(s.pages.id, id));
  await audit(actor, 'page.update', 'page', id, { status: str(fd, 'status') });
  back(`/admin/pages/${id}`, 'Page saved.');
}

export async function saveArticle(fd: FormData) {
  const { actor, db } = await staff('content.write');
  const id = str(fd, 'id');
  const title = str(fd, 'title', 200);
  if (!title) back('/admin/articles', 'Write a title.', 'error');
  const status = str(fd, 'status') === 'published' ? 'published' : 'draft';
  const values = { title, slug: slugify(str(fd, 'slug', 120) || title), summary: str(fd, 'summary', 400), body: str(fd, 'body', 30000), author: str(fd, 'author', 120), status: status as 'draft' | 'published', seoTitle: str(fd, 'seoTitle', 160), seoDescription: str(fd, 'seoDescription', 300), updatedAt: new Date() };
  if (uuid(id)) {
    const [prev] = await db.select().from(s.articles).where(eq(s.articles.id, id)).limit(1);
    await db.update(s.articles).set({ ...values, publishedAt: status === 'published' ? prev.publishedAt ?? new Date() : prev.publishedAt }).where(eq(s.articles.id, id));
  } else await db.insert(s.articles).values({ ...values, publishedAt: status === 'published' ? new Date() : null });
  await audit(actor, 'article.save', 'article', id || values.slug);
  back('/admin/articles', 'Article saved.');
}

export async function deleteArticle(fd: FormData) {
  const { actor, db } = await staff('content.write');
  await db.delete(s.articles).where(eq(s.articles.id, str(fd, 'id')));
  await audit(actor, 'article.delete', 'article', str(fd, 'id'));
  back('/admin/articles', 'Article deleted.');
}

export async function saveTestimonial(fd: FormData) {
  const { actor, db } = await staff('testimonials.write');
  const id = str(fd, 'id');
  const values = { quote: str(fd, 'quote', 600), personName: str(fd, 'personName', 120), role: str(fd, 'role', 120), company: str(fd, 'company', 120), consentConfirmed: fd.get('consent') === 'on', verified: fd.get('verified') === 'on' };
  if (!values.quote || !values.personName) back('/admin/proof', 'A testimonial needs the words and the person.', 'error');
  // published only when verified and consented: the database refuses to show anything else
  const published = fd.get('published') === 'on' && values.verified && values.consentConfirmed;
  if (uuid(id)) await db.update(s.testimonials).set({ ...values, published }).where(eq(s.testimonials.id, id));
  else await db.insert(s.testimonials).values({ ...values, published });
  await audit(actor, 'testimonial.save', 'testimonial', id, { published });
  back('/admin/proof', published || fd.get('published') !== 'on' ? 'Testimonial saved.' : 'Saved, but not published: confirm consent and verification first.');
}

export async function saveCertificate(fd: FormData) {
  const { u, actor, db } = await staff('certificates.write');
  try {
    const a = await upload(fd.get('file'), 'document', 'certificate', null, u.id);
    const verified = fd.get('verified') === 'on';
    const published = fd.get('published') === 'on' && verified && !!a;
    await db.insert(s.certificates).values({ name: str(fd, 'name', 160), issuer: str(fd, 'issuer', 160), number: str(fd, 'number', 80), scope: str(fd, 'scope', 300), validUntil: str(fd, 'validUntil', 20), attachmentId: a?.id ?? null, verified, published });
    await audit(actor, 'certificate.add', 'certificate', str(fd, 'name'), { published });
    back('/admin/proof', published ? 'Certificate published.' : 'Certificate saved, unpublished: a certificate is shown only with its document and once verified.');
  } catch (e) { if (e instanceof UploadError) back('/admin/proof', e.message, 'error'); throw e; }
}

export async function deleteProof(fd: FormData) {
  const { actor, db } = await staff('testimonials.write');
  const id = str(fd, 'id');
  if (str(fd, 'kind') === 'certificate') await db.delete(s.certificates).where(eq(s.certificates.id, id));
  else await db.delete(s.testimonials).where(eq(s.testimonials.id, id));
  await audit(actor, 'proof.delete', str(fd, 'kind'), id);
  back('/admin/proof', 'Deleted.');
}

export async function saveFacts(fd: FormData) {
  const { actor, db } = await staff('facts.write');
  const rows = await db.select().from(s.facts);
  for (const r of rows) {
    await db.update(s.facts).set({ value: str(fd, `v_${r.key}`, 300), verified: fd.get(`ok_${r.key}`) === 'on', updatedAt: new Date() }).where(eq(s.facts.key, r.key));
  }
  await audit(actor, 'facts.update', 'facts');
  back('/admin/facts', 'Facts saved. Only verified facts appear on the site.');
}

export async function setMarket(fd: FormData) {
  const { actor, db } = await staff('markets.write');
  const code = str(fd, 'code', 3);
  const status = str(fd, 'status') === 'established' ? 'established' : 'target';
  await db.update(s.markets).set({ status, note: str(fd, 'note', 300) }).where(eq(s.markets.code, code));
  await audit(actor, 'market.update', 'market', code, { status });
  back('/admin/markets', 'Market saved.');
}

export async function saveTranslations(fd: FormData) {
  const { actor, db } = await staff('translations.write');
  const locale = str(fd, 'locale', 5);
  if (!(LOCALES as readonly string[]).includes(locale) || locale === 'en') back('/admin/translations', 'Choose a language.', 'error');
  let n = 0;
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith('t_') || typeof v !== 'string') continue;
    const key = k.slice(2);
    if (fd.get(`r_${key}`) !== 'on') continue;
    // page and product text ("x:" keys, tx.ts) can be a whole paragraph or list; interface words stay short
    const value = v.replace(/\r\n?/g, '\n').trim().slice(0, key.startsWith('x:') ? 6000 : 500);
    if (!value) continue;
    await db.insert(s.translations).values({ locale, key, value, status: 'reviewed' })
      .onConflictDoUpdate({ target: [s.translations.locale, s.translations.key], set: { value, status: 'reviewed', updatedAt: new Date() } });
    n++;
  }
  const section = str(fd, 'section', 40).replace(/[^a-z]/g, '');
  await audit(actor, 'translations.review', 'locale', locale, { n, section: section || 'interface' });
  back(`/admin/translations?locale=${locale}${section ? `&section=${section}` : ''}`, `${n} strings saved as reviewed.`);
}

export async function uploadDocument(fd: FormData) {
  const { u, actor, db } = await staff('customers.write');
  try {
    const a = await upload(fd.get('file'), 'document', 'document', null, u.id);
    if (!a) back('/admin/documents', 'Choose a PDF or image file.', 'error');
    const visibility = (['public', 'customers', 'company'].includes(str(fd, 'visibility')) ? str(fd, 'visibility') : 'company') as 'public' | 'customers' | 'company';
    const companyId = str(fd, 'companyId');
    if (visibility === 'company' && !uuid(companyId)) back('/admin/documents', 'Choose the company this document is for.', 'error');
    await db.insert(s.documents).values({ title: str(fd, 'title', 160) || a!.filename, kind: (str(fd, 'kind') || 'technical') as 'technical', visibility, companyId: visibility === 'company' ? companyId : null, attachmentId: a!.id });
    await audit(actor, 'document.upload', 'document', a!.id, { visibility });
    back('/admin/documents', 'Document shared.');
  } catch (e) { if (e instanceof UploadError) back('/admin/documents', e.message, 'error'); throw e; }
}

export async function deleteDocument(fd: FormData) {
  const { actor, db } = await staff('customers.write');
  await db.delete(s.documents).where(eq(s.documents.id, str(fd, 'id')));
  await audit(actor, 'document.delete', 'document', str(fd, 'id'));
  back('/admin/documents', 'Document removed.');
}

// ------------------------------------------------------------------ users and settings
export async function createStaff(fd: FormData) {
  const { actor, db } = await staff('users.manage');
  const email = str(fd, 'email', 160).toLowerCase(); const role = str(fd, 'role');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !(STAFF_ROLES as readonly string[]).includes(role)) back('/admin/users', 'Write an email and choose a role.', 'error');
  const temp = `${randomToken(9)}-${randomToken(6)}`;
  try {
    await db.insert(s.users).values({ email, name: str(fd, 'name', 120), kind: 'staff', role, passwordHash: await hashPassword(temp), emailVerifiedAt: new Date() });
  } catch { back('/admin/users', 'A staff account with that email already exists.', 'error'); }
  await audit(actor, 'staff.create', 'user', email, { role });
  back('/admin/users', `Account created. Give ${email} this one-time password in person or by phone, never by email: ${temp}. They set up two-factor sign-in at first sign-in.`);
}

export async function updateStaff(fd: FormData) {
  const { u, actor, db } = await staff('users.manage');
  const id = str(fd, 'id'); const op = str(fd, 'op');
  if (id === u.id && op !== 'role') back('/admin/users', 'You cannot change your own access here.', 'error');
  if (op === 'role') {
    const role = str(fd, 'role');
    if (!(STAFF_ROLES as readonly string[]).includes(role)) back('/admin/users', 'Choose a role.', 'error');
    if (id === u.id && role !== 'admin') back('/admin/users', 'You cannot remove your own administrator role.', 'error');
    await db.update(s.users).set({ role }).where(eq(s.users.id, id));
  } else if (op === 'disable') { await db.update(s.users).set({ disabledAt: new Date() }).where(eq(s.users.id, id)); await destroyAllSessions(id); }
  else if (op === 'enable') await db.update(s.users).set({ disabledAt: null, failedLogins: 0, lockedUntil: null }).where(eq(s.users.id, id));
  else if (op === 'reset-mfa') {
    // a lost phone usually holds the passkeys too: they go with the authenticator, and the person sets both up again
    await db.update(s.users).set({ mfaSecret: null, mfaEnabledAt: null }).where(eq(s.users.id, id));
    const removed = await db.delete(s.passkeys).where(eq(s.passkeys.userId, id)).returning({ name: s.passkeys.name });
    await destroyAllSessions(id);
    await audit(actor, 'staff.reset-mfa', 'user', id, { passkeysRemoved: removed.map((p) => p.name) });
    back('/admin/users', `Two-factor sign-in reset${removed.length ? ` and ${removed.length} ${removed.length === 1 ? 'passkey' : 'passkeys'} removed` : ''}. They set up an authenticator again at their next sign-in.`);
  }
  await audit(actor, `staff.${op}`, 'user', id);
  back('/admin/users', 'Saved.');
}

export async function changeOwnPassword(fd: FormData) {
  const u = await requireStaff();
  const db = await getDb();
  const actor = { id: u.id, email: u.email };
  const current = String(fd.get('current') ?? ''); const next = String(fd.get('next') ?? '');
  if (!(await verifyPassword(current, u.passwordHash))) back('/admin/users', 'Your current password is not right.', 'error');
  const problem = passwordProblem(next);
  if (problem) back('/admin/users', problem, 'error');
  await db.update(s.users).set({ passwordHash: await hashPassword(next) }).where(eq(s.users.id, u.id));
  await audit(actor, 'staff.password_change', 'user', u.id);
  back('/admin/users', 'Password changed.');
}

export async function saveSettings(fd: FormData) {
  const { actor, db } = await staff('settings.write');
  const currencies = ['EUR', 'GBP', 'USD'].filter((c) => fd.get(`cur_${c}`) === 'on');
  const enabled = LOCALES.filter((l) => l === 'en' || fd.get(`loc_${l}`) === 'on');
  const indexed = enabled.filter((l) => l === 'en' || fd.get(`idx_${l}`) === 'on');
  const ga = str(fd, 'ga4', 30);
  if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) back('/admin/settings', 'A GA4 measurement ID looks like G-XXXXXXX.', 'error');
  const salesEmail = str(fd, 'salesEmail', 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salesEmail)) back('/admin/settings', 'Write the sales email address.', 'error');
  const values: Record<string, unknown> = {
    company: { name: str(fd, 'name', 120) || 'Monolith Sports', salesEmail, replyNote: str(fd, 'replyNote', 200) },
    currencies: { enabled: currencies.length ? currencies : ['EUR'], default: currencies.includes(str(fd, 'defaultCurrency')) ? str(fd, 'defaultCurrency') : currencies[0] ?? 'EUR' },
    quotation: { paymentTerms: str(fd, 'paymentTerms', 500), incoterm: str(fd, 'incoterm', 120), validityDays: Math.max(1, Math.min(365, Number(str(fd, 'validityDays')) || 30)), footer: str(fd, 'footer', 500) },
    locales: { enabled, indexed },
    analytics: { ga4: ga },
  };
  for (const [key, value] of Object.entries(values)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value, updatedAt: new Date() } });
  }
  await audit(actor, 'settings.update', 'settings', '', { locales: enabled, indexed, currencies });
  back('/admin/settings', 'Settings saved.');
}
