import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { datasheetPdf } from '@/lib/pdf/documents';
import { track } from '@/lib/audit';

/* GET /api/products/:id/datasheet: the product's technical datasheet as a PDF (published products only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const db = await getDb();
  const [p] = await db.select().from(s.products).where(and(eq(s.products.id, id), eq(s.products.status, 'published'))).limit(1);
  if (!p) return new NextResponse('Not found', { status: 404 });
  const [sub] = await db.select().from(s.categories).where(eq(s.categories.id, p.categoryId)).limit(1);
  const [fam] = sub?.parentId ? await db.select().from(s.categories).where(eq(s.categories.id, sub.parentId)).limit(1) : [sub];
  const pdf = await datasheetPdf(p, fam?.name ?? '', sub?.name ?? '');
  await track('datasheet_download', { productId: p.id });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="monolith-${p.sku.toLowerCase()}-datasheet.pdf"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
