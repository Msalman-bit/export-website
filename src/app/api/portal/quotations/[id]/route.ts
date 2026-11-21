import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession } from '@/lib/auth/session';
import { quotationPdf } from '@/lib/pdf/documents';
import { getSettings } from '@/lib/data';

/* GET /api/portal/quotations/:id: the quotation PDF, for the customer company it belongs to (or staff). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const db = await getDb();
  const [q] = await db.select().from(s.quotations).where(eq(s.quotations.id, id)).limit(1);
  if (!q) return new NextResponse('Not found', { status: 404 });
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, q.inquiryId)).limit(1);
  const staff = await readSession('staff');
  const customer = await readSession('customer');
  const allowed = (staff && staff.session.mfaVerified) || (customer?.emailVerifiedAt && customer.companyId && inq?.companyId === customer.companyId && q.status !== 'draft');
  if (!allowed || !inq) return new NextResponse('Not found', { status: 404 });
  const settings = await getSettings();
  const pdf = await quotationPdf(q, inq, { footer: settings.quotation.footer, contact: settings.company.salesEmail });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${q.number}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}

export const dynamic = 'force-dynamic';
void and; void inArray;
