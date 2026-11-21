import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession } from '@/lib/auth/session';
import { invoicePdf } from '@/lib/pdf/documents';
import { getSettings } from '@/lib/data';

/* GET /api/portal/invoices/:id: the invoice PDF, for the customer company of its order (or staff). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const db = await getDb();
  const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, id)).limit(1);
  if (!inv) return new NextResponse('Not found', { status: 404 });
  const [order] = await db.select().from(s.orders).where(eq(s.orders.id, inv.orderId)).limit(1);
  const staff = await readSession('staff');
  const customer = await readSession('customer');
  const allowed = (staff && staff.session.mfaVerified) || (customer?.emailVerifiedAt && order?.companyId && order.companyId === customer.companyId);
  if (!allowed || !order) return new NextResponse('Not found', { status: 404 });
  const [company] = order.companyId ? await db.select().from(s.companies).where(eq(s.companies.id, order.companyId)).limit(1) : [];
  const pdf = await invoicePdf(inv, order, { name: company?.name ?? '', address: company?.address ?? '', country: company?.country ?? '' }, { contact: (await getSettings()).company.salesEmail });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.number}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}

export const dynamic = 'force-dynamic';
