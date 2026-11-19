import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, day, type SP } from '../ui';
import { uploadDocument, deleteDocument } from '../actions';

export default async function Documents({ searchParams }: { searchParams: SP }) {
  await requireStaff('customers.write');
  const sp = await searchParams;
  const db = await getDb();
  const [docs, companies] = await Promise.all([
    db.select({ d: s.documents, company: s.companies.name }).from(s.documents).leftJoin(s.companies, eq(s.companies.id, s.documents.companyId)).orderBy(desc(s.documents.createdAt)),
    db.select({ id: s.companies.id, name: s.companies.name }).from(s.companies).orderBy(asc(s.companies.name)),
  ]);
  return (
    <>
      <div className="admin-head"><h1>Documents</h1></div>
      <Flash sp={sp} />
      <form action={uploadDocument} className="panel-box" encType="multipart/form-data">
        <h2>Share a document</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" /></div>
          <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind"><option value="technical">Technical document</option><option value="catalogue">Catalogue</option><option value="certificate">Certificate</option><option value="other">Other</option></select></div>
          <div className="field"><label htmlFor="visibility">Who can see it</label><select id="visibility" name="visibility"><option value="company">One company</option><option value="customers">Every signed-in customer</option><option value="public">Everyone (Catalogues page)</option></select></div>
          <div className="field"><label htmlFor="companyId">Company (for “One company”)</label><select id="companyId" name="companyId" defaultValue=""><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field field--full"><label htmlFor="file">File (PDF, PNG or JPG, up to 20 MB)</label><input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required /></div>
        </div>
        <div><button className="btn btn--primary" type="submit">Upload and share</button></div>
      </form>
      <div className="table-wrap"><table className="data"><thead><tr><th>Document</th><th>Type</th><th>Visible to</th><th>Added</th><th></th></tr></thead><tbody>
        {docs.map(({ d, company }) => <tr key={d.id}><td><a className="link" href={`/media/${d.attachmentId}`}>{d.title}</a></td><td>{d.kind}</td><td>{d.visibility === 'company' ? company : d.visibility}</td><td>{day(d.createdAt)}</td>
          <td><form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className="btn-text" type="submit">Remove</button></form></td></tr>)}
      </tbody></table></div>
    </>
  );
}
