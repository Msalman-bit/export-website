import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, type SP } from '../../ui';
import { savePage } from '../../actions';

export default async function PageEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireStaff('content.write');
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [p] = await db.select().from(s.pages).where(eq(s.pages.id, id)).limit(1);
  if (!p) notFound();
  return (
    <>
      <div className="admin-head"><div><p className="t-small muted"><a className="link" href="/admin/pages">Pages</a></p><h1>{p.title}</h1></div>
        {p.status === 'published' ? <a className="btn btn--secondary" href={`/en/${p.slug}`} target="_blank" rel="noopener">View the page</a> : null}</div>
      <Flash sp={sp} />
      {p.reviewNote ? <p className="flash flash--error">Before publishing: {p.reviewNote}</p> : null}
      <form action={savePage} className="panel-box">
        <input type="hidden" name="id" value={p.id} />
        <div className="form-grid">
          <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" defaultValue={p.title} /></div>
          <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={p.status}><option value="draft">Draft (hidden)</option><option value="published">Published</option></select></div>
          <div className="field field--full"><label htmlFor="summary">Summary (shown under the title)</label><input id="summary" name="summary" defaultValue={p.summary} /></div>
          <div className="field field--full"><label htmlFor="body">Text: “## ” starts a heading, “- ” a list item, [label](/path) a link, [[cta:Label|/path]] a button</label><textarea id="body" name="body" className="tall" defaultValue={p.body} /></div>
          <div className="field"><label htmlFor="seoTitle">Search title (50 to 60 characters)</label><input id="seoTitle" name="seoTitle" defaultValue={p.seoTitle} maxLength={160} /></div>
          <div className="field"><label htmlFor="seoDescription">Search description (120 to 155 characters)</label><input id="seoDescription" name="seoDescription" defaultValue={p.seoDescription} maxLength={300} /></div>
          <label className="chk"><input type="checkbox" name="needsReview" defaultChecked={p.needsReview} /> Needs review before launch</label>
        </div>
        <div className="btn-row"><button className="btn btn--primary" type="submit">Save the page</button></div>
      </form>
    </>
  );
}
