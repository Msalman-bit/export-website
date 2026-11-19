import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { audit } from '@/lib/audit';

/* GET /api/admin/export?table=…: a CSV for staff with export rights. Cells that start with = + - @ are
   prefixed with ' so a spreadsheet never runs them as formulas (CSV injection). */
const cell = (v: unknown) => {
  let t = v instanceof Date ? v.toISOString() : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
};

export async function GET(req: Request) {
  const user = await readSession('staff');
  if (!user?.session.mfaVerified || !can(user.role, 'export.data')) return new NextResponse('Not found', { status: 404 });
  const table = new URL(req.url).searchParams.get('table') ?? '';
  const db = await getDb();
  let rows: Record<string, unknown>[];
  switch (table) {
    case 'inquiries': rows = await db.select().from(s.inquiries).orderBy(desc(s.inquiries.createdAt)); break;
    case 'inquiry_items': rows = await db.select({ reference: s.inquiries.reference, item: s.inquiryItems }).from(s.inquiryItems).innerJoin(s.inquiries, eq(s.inquiries.id, s.inquiryItems.inquiryId)).then((r) => r.map((x) => ({ reference: x.reference, ...x.item }))); break;
    case 'quotations': rows = await db.select().from(s.quotations).orderBy(desc(s.quotations.createdAt)); break;
    case 'orders': rows = await db.select().from(s.orders).orderBy(desc(s.orders.createdAt)); break;
    case 'customers': rows = await db.select().from(s.companies); break;
    case 'products': rows = await db.select().from(s.products); break;
    case 'subscribers': rows = (await db.select().from(s.subscribers)).map(({ unsubscribeToken: _t, ...r }) => r); break;
    default: return new NextResponse('Unknown table', { status: 400 });
  }
  await audit({ id: user.id, email: user.email }, 'data.export', table, '', { rows: rows.length });
  return new NextResponse('﻿' + toCsv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="monolith-${table}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' },
  });
}
