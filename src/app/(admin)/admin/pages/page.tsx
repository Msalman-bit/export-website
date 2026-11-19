import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, day, type SP } from '../ui';

export default async function Pages({ searchParams }: { searchParams: SP }) {
  await requireStaff('content.write');
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(s.pages).orderBy(asc(s.pages.section), asc(s.pages.title));
  return (
    <>
      <div className="admin-head"><h1>Pages and SEO</h1></div>
      <Flash sp={sp} />
      <p className="t-small">Drafts are not public and are left out of menus and the sitemap. “Review” marks a page whose facts or legal wording the owner must confirm before launch.</p>
      <div className="table-wrap"><table className="data"><thead><tr><th>Page</th><th>Section</th><th>Address</th><th>Status</th><th>Review</th><th>Updated</th></tr></thead><tbody>
        {rows.map((p) => <tr key={p.id}><td><a className="link" href={`/admin/pages/${p.id}`}>{p.title}</a></td><td>{p.section}</td><td>/{p.slug}</td>
          <td><span className={`pill-status${p.status === 'draft' ? ' badge-draft' : ''}`}>{p.status}</span></td><td>{p.needsReview ? <span className="pill-status badge-review">needs review</span> : ''}</td><td>{day(p.updatedAt)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
