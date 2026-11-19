import { NextResponse } from 'next/server';
import { getFamilies, getProductsInFamily } from '@/lib/data';
import { cataloguePdf } from '@/lib/pdf/documents';
import { track } from '@/lib/audit';

/* GET /api/catalogue[?family=slug]: the catalogue PDF, built from the published catalogue. */
export async function GET(req: Request) {
  const family = new URL(req.url).searchParams.get('family');
  const fams = (await getFamilies()).filter((f) => !family || f.slug === family);
  if (!fams.length) return new NextResponse('Not found', { status: 404 });
  const data = [];
  for (const f of fams) data.push({ name: f.name, summary: f.summary, products: await getProductsInFamily(f) });
  const pdf = await cataloguePdf(data);
  await track('catalogue_download', { path: family ? `/products/${family}` : '/catalogues' });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="monolith-sports-${family ?? 'catalogue'}.pdf"`,
      'Cache-Control': 'public, max-age=600',
    },
  });
}
