import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import type { InquiryInput } from './validation';
import { inquiryReference } from './reference';
import { countryName } from './countries';
import { sendEmail } from '../email/send';
import { inquiryConfirmation, inquiryNotification } from '../email/templates';
import { storeFile, type CheckedFile } from '../security/upload';
import { track } from '../audit';

/** The analytics count a request of this type adds (Admin > Analytics, the dashboard's "Quotes requested"). */
export const requestEventName = (type: string) => (type === 'sample' ? 'sample_requested' : type === 'quote' ? 'quote_submitted' : `${type}_submitted`);

/* Creates one consolidated inquiry: its items (names and SKUs read from the database, never trusted
   from the browser), its attachments, the first history entry, the two emails and an analytics count. */
export async function createInquiry(input: InquiryInput, files: CheckedFile[], who: { userId?: string; companyId?: string | null; country?: string }) {
  const db = await getDb();

  const ids = input.items.map((i) => i.productId).filter((x): x is string => !!x);
  const products = ids.length
    ? await db.select({ id: s.products.id, name: s.products.name, sku: s.products.sku }).from(s.products)
      .where(and(inArray(s.products.id, ids), eq(s.products.status, 'published')))
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = input.items.map((i) => {
    const p = i.productId ? byId.get(i.productId) : undefined;
    return {
      productId: p?.id ?? null,
      productName: p?.name ?? (i.name || 'Custom product'),
      sku: p?.sku ?? '',
      quantity: i.quantity,
      notes: [i.sample ? 'Sample first' : '', i.notes].filter(Boolean).join(' · '),
      customisation: i.customisation ?? null,
    };
  });
  const type = input.type === 'quote' && input.items.some((i) => i.sample) ? 'sample' : input.type;

  let reference = inquiryReference();
  for (let tries = 0; tries < 5; tries++) {
    const clash = await db.select({ id: s.inquiries.id }).from(s.inquiries).where(eq(s.inquiries.reference, reference)).limit(1);
    if (!clash.length) break;
    reference = inquiryReference();
  }

  const [inq] = await db.insert(s.inquiries).values({
    // every request lands in "New inquiry", the team's inbox, whatever its type: a sample request is told apart by
    // its type (and its "Sample first" lines), and the team moves it on to "Sample requested" or further
    reference, type, status: 'new',
    companyName: input.companyName, contactName: input.contactName, email: input.email, phone: input.phone,
    country: input.country, currency: input.currency, branding: input.branding, packaging: input.packaging,
    targetDate: input.targetDate, shippingMethod: input.shippingMethod, message: input.message, locale: input.locale,
    sourcePage: input.sourcePage, userId: who.userId ?? null, companyId: who.companyId ?? null,
  }).returning();

  if (items.length) await db.insert(s.inquiryItems).values(items.map((i) => ({ ...i, inquiryId: inq.id })));
  for (const f of files) {
    const stored = await storeFile(f);
    await db.insert(s.attachments).values({ ownerType: 'inquiry', ownerId: inq.id, filename: f.filename, storedName: stored, mime: f.mime, size: f.size, uploadedBy: who.userId ?? null });
  }
  await db.insert(s.inquiryEvents).values({ inquiryId: inq.id, kind: 'created', toStatus: inq.status, body: `${type} inquiry received`, visibleToCustomer: true });

  const lines = items.map((i) => ({ name: i.productName, sku: i.sku, quantity: i.quantity, notes: i.notes }));
  const confirm = inquiryConfirmation({ reference, contactName: input.contactName, items: lines, type, locale: input.locale });
  await sendEmail({ to: input.email, ...confirm });
  const notifyTo = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (notifyTo) {
    const n = inquiryNotification({ reference, company: input.companyName, contactName: input.contactName, email: input.email, country: countryName(input.country), type, items: lines, message: input.message, id: inq.id });
    await sendEmail({ to: notifyTo, replyTo: input.email, ...n });
  }
  await track(requestEventName(type), { path: input.sourcePage, country: who.country, locale: input.locale });
  return { id: inq.id, reference, type };
}
