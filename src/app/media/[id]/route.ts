import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession } from '@/lib/auth/session';
import { readStored } from '@/lib/security/upload';

/* GET /media/:attachmentId: an uploaded file, served only to who may see it.
   media (product photographs and films) and published certificates: everyone; documents: by visibility;
   inquiry and message attachments: staff, or the customer company they belong to. Always nosniff;
   anything but an image or a film is sent as a download. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const db = await getDb();
  const [a] = await db.select().from(s.attachments).where(eq(s.attachments.id, id)).limit(1);
  if (!a) return new NextResponse('Not found', { status: 404 });

  const staff = await readSession('staff');
  const isStaff = !!staff?.session.mfaVerified;
  let allowed = isStaff || a.ownerType === 'media';
  if (!allowed && a.ownerType === 'certificate') {
    const [c] = await db.select().from(s.certificates).where(and(eq(s.certificates.attachmentId, a.id), eq(s.certificates.published, true))).limit(1);
    allowed = !!c;
  }
  if (!allowed && a.ownerType === 'document') {
    const [d] = await db.select().from(s.documents).where(eq(s.documents.attachmentId, a.id)).limit(1);
    if (d?.visibility === 'public') allowed = true;
    else if (d) {
      const c = await readSession('customer');
      allowed = !!c?.emailVerifiedAt && (d.visibility === 'customers' || d.companyId === c.companyId);
    }
  }
  if (!allowed && a.ownerType === 'inquiry' && a.ownerId) {
    const c = await readSession('customer');
    const [inq] = await db.select({ companyId: s.inquiries.companyId }).from(s.inquiries).where(eq(s.inquiries.id, a.ownerId)).limit(1);
    allowed = !!c?.emailVerifiedAt && !!inq?.companyId && inq.companyId === c.companyId;
  }
  if (!allowed) return new NextResponse('Not found', { status: 404 });

  const bytes = await readStored(a.storedName).catch(() => null);
  if (!bytes) return new NextResponse('Not found', { status: 404 });
  const inline = /^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(a.mime);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': a.mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${a.filename.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
      'Cache-Control': a.ownerType === 'media' ? 'public, max-age=86400' : 'private, no-store',
    },
  });
}
