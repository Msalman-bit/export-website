import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { STATUS_LABEL } from '@/lib/status';
import { countryName } from '@/lib/inquiry/countries';
import { Flash, Status, day, type SP } from '../ui';

export default async function Inquiries({ searchParams }: { searchParams: SP }) {
  await requireStaff('inquiries.read');
  const sp = await searchParams;
  const db = await getDb();
  const where: SQL[] = [];
  if (sp.status && (s.INQUIRY_STATUSES as readonly string[]).includes(sp.status)) where.push(eq(s.inquiries.status, sp.status as s.InquiryStatus));
  if (sp.type) where.push(eq(s.inquiries.type, sp.type as s.InquiryType));
  if (sp.q) { const q = `%${sp.q.slice(0, 60)}%`; where.push(or(ilike(s.inquiries.reference, q), ilike(s.inquiries.companyName, q), ilike(s.inquiries.email, q), ilike(s.inquiries.contactName, q))!); }
  const rows = await db.select({
    i: s.inquiries, items: sql<number>`(select count(*)::int from inquiry_items where inquiry_id = ${s.inquiries.id})`,
  }).from(s.inquiries).where(where.length ? and(...where) : undefined).orderBy(desc(s.inquiries.createdAt)).limit(200);
  const counts = await db.select({ status: s.inquiries.status, n: sql<number>`count(*)::int` }).from(s.inquiries).groupBy(s.inquiries.status);
  const cn = Object.fromEntries(counts.map((c) => [c.status, c.n]));
  return (
    <>
      <div className="admin-head"><h1>Inquiries</h1><a className="btn btn--secondary" href="/api/admin/export?table=inquiries">Export as CSV</a></div>
      <Flash sp={sp} />
      <form className="filters-row panel-box" method="get">
        <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="" /></div>
        <div className="field"><label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ''}><option value="">All statuses</option>{s.INQUIRY_STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]} ({cn[st] ?? 0})</option>)}</select></div>
        <div className="field"><label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={sp.type ?? ''}><option value="">All types</option>{['quote', 'sample', 'distributor', 'partnership', 'contact'].map((t) => <option key={t}>{t}</option>)}</select></div>
        <button className="btn btn--primary" type="submit">Filter</button>
      </form>
      <div className="table-wrap"><table className="data"><thead><tr><th>Reference</th><th>Type</th><th>Company</th><th>Contact</th><th>Destination</th><th>Lines</th><th>Received</th><th>Status</th></tr></thead><tbody>
        {rows.map(({ i, items }) => (
          <tr key={i.id}><td><a className="link" href={`/admin/inquiries/${i.id}`}>{i.reference}</a></td><td>{i.type}</td><td>{i.companyName}</td><td>{i.contactName}<br /><span className="t-small muted">{i.email}</span></td><td>{countryName(i.country)}</td><td>{items}</td><td>{day(i.createdAt)}</td><td><Status value={i.status} /></td></tr>
        ))}
        {!rows.length ? <tr><td colSpan={8}>No inquiries match.</td></tr> : null}
      </tbody></table></div>
    </>
  );
}
