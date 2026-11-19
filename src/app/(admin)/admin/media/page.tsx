import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, day, type SP } from '../ui';
import { uploadMedia } from '../actions';

export default async function Media({ searchParams }: { searchParams: SP }) {
  await requireStaff('media.write');
  const sp = await searchParams;
  const db = await getDb();
  const files = await db.select().from(s.attachments).where(and(eq(s.attachments.ownerType, 'media'))).orderBy(desc(s.attachments.createdAt)).limit(200);
  return (
    <>
      <div className="admin-head"><h1>Media library</h1></div>
      <Flash sp={sp} />
      <form action={uploadMedia} className="panel-box" encType="multipart/form-data">
        <div className="field"><label htmlFor="file">Photograph or film (PNG, JPG, WEBP up to 60 MB; MP4 or WEBM)</label><input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" required /></div>
        <div><button className="btn btn--primary" type="submit">Upload</button></div>
        <p className="t-small">Product photographs are added on each product’s page. Uploads here get an address to use anywhere (for example a brand film).</p>
      </form>
      <div className="thumbs">{files.map((f) => (
        <figure key={f.id}>{f.mime.startsWith('image/') ? <img src={`/media/${f.id}`} alt={f.filename} loading="lazy" /> : <span className="mono">{f.mime}</span>}<span>{f.filename}<br />/media/{f.id.slice(0, 8)}… · {day(f.createdAt)}</span></figure>
      ))}</div>
    </>
  );
}
