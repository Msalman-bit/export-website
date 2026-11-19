import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, day, type SP } from '../ui';
import { saveArticle, deleteArticle } from '../actions';

export default async function Articles({ searchParams }: { searchParams: SP }) {
  await requireStaff('content.write');
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(s.articles).orderBy(desc(s.articles.updatedAt));
  const edit = rows.find((a) => a.id === sp.edit);
  return (
    <>
      <div className="admin-head"><h1>Articles</h1><a className="btn btn--secondary" href="/admin/articles?edit=new">Write an article</a></div>
      <Flash sp={sp} />
      {sp.edit ? (
        <form action={saveArticle} className="panel-box">
          {edit ? <input type="hidden" name="id" value={edit.id} /> : null}
          <div className="form-grid">
            <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" defaultValue={edit?.title} required /></div>
            <div className="field"><label htmlFor="slug">Address (slug)</label><input id="slug" name="slug" defaultValue={edit?.slug} /></div>
            <div className="field field--full"><label htmlFor="summary">Summary</label><input id="summary" name="summary" defaultValue={edit?.summary} /></div>
            <div className="field field--full"><label htmlFor="body">Text (the same format as pages)</label><textarea id="body" name="body" className="tall" defaultValue={edit?.body} /></div>
            <div className="field"><label htmlFor="author">Author</label><input id="author" name="author" defaultValue={edit?.author ?? 'Monolith Sports'} /></div>
            <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={edit?.status ?? 'draft'}><option value="draft">Draft</option><option value="published">Published</option></select></div>
            <div className="field"><label htmlFor="seoTitle">Search title</label><input id="seoTitle" name="seoTitle" defaultValue={edit?.seoTitle} /></div>
            <div className="field"><label htmlFor="seoDescription">Search description</label><input id="seoDescription" name="seoDescription" defaultValue={edit?.seoDescription} /></div>
          </div>
          <div className="btn-row"><button className="btn btn--primary" type="submit">Save the article</button><a className="btn btn--secondary" href="/admin/articles">Cancel</a></div>
        </form>
      ) : null}
      <div className="table-wrap"><table className="data"><thead><tr><th>Article</th><th>Status</th><th>Published</th><th></th></tr></thead><tbody>
        {rows.map((a) => <tr key={a.id}><td><a className="link" href={`/admin/articles?edit=${a.id}`}>{a.title}</a></td><td>{a.status}</td><td>{day(a.publishedAt)}</td>
          <td><form action={deleteArticle}><input type="hidden" name="id" value={a.id} /><button className="btn-text" type="submit">Delete</button></form></td></tr>)}
      </tbody></table></div>
    </>
  );
}
