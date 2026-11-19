import { desc, gte, sql, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { Flash, Status, day, type SP } from './ui';

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const u = await requireStaff();
  const sp = await searchParams;
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [[newInq], [open], [orders], [customers], recent, events, review] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(s.inquiries).where(eq(s.inquiries.status, 'new')),
    db.select({ n: sql<number>`count(*)::int` }).from(s.inquiries).where(sql`${s.inquiries.status} <> 'completed'`),
    db.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(sql`${s.orders.status} <> 'completed'`),
    db.select({ n: sql<number>`count(*)::int` }).from(s.companies),
    db.select().from(s.inquiries).orderBy(desc(s.inquiries.createdAt)).limit(8),
    db.select({ name: s.events.name, n: sql<number>`count(*)::int` }).from(s.events).where(gte(s.events.createdAt, since)).groupBy(s.events.name),
    db.select({ title: s.pages.title, id: s.pages.id, note: s.pages.reviewNote, status: s.pages.status }).from(s.pages).where(eq(s.pages.needsReview, true)),
  ]);
  const ev = Object.fromEntries(events.map((e) => [e.name, e.n]));
  return (
    <>
      <div className="admin-head"><h1>Good to see you, {u.name || 'team'}</h1><a className="btn btn--primary" href="/admin/inquiries?status=new">Open new inquiries</a></div>
      <Flash sp={sp} />
      <div className="kpis">
        <div className="kpi"><span className="t-small muted">New inquiries</span><strong>{newInq.n}</strong></div>
        <div className="kpi"><span className="t-small muted">Open inquiries</span><strong>{open.n}</strong></div>
        <div className="kpi"><span className="t-small muted">Orders in progress</span><strong>{orders.n}</strong></div>
        <div className="kpi"><span className="t-small muted">Customer companies</span><strong>{customers.n}</strong></div>
        <div className="kpi"><span className="t-small muted">Product views, 30 days</span><strong>{ev.product_view ?? 0}</strong></div>
        <div className="kpi"><span className="t-small muted">Quotes requested, 30 days</span><strong>{(ev.quote_submitted ?? 0) + (ev.sample_requested ?? 0)}</strong></div>
      </div>
      {can(u.role, 'analytics.reset') ? <p className="t-small">The views and requests come from Analytics. <a className="link" href="/admin/analytics#reset">Reset the counts</a> (for example after testing, before launch).</p> : null}
      <div className="cols-2">
        <section className="panel-box"><h2>Latest inquiries</h2>
          <div className="table-wrap"><table className="data"><thead><tr><th>Reference</th><th>Company</th><th>Country</th><th>Received</th><th>Status</th></tr></thead><tbody>
            {recent.map((i) => <tr key={i.id}><td><a className="link" href={`/admin/inquiries/${i.id}`}>{i.reference}</a></td><td>{i.companyName}</td><td>{i.country}</td><td>{day(i.createdAt)}</td><td><Status value={i.status} /></td></tr>)}
            {!recent.length ? <tr><td colSpan={5}>No inquiries yet. They arrive here from the website’s quote, sample and contact forms.</td></tr> : null}
          </tbody></table></div>
        </section>
        <section className="panel-box"><h2>Launch checklist</h2>
          <p className="t-small">Pages marked for review before launch (legal pages need a qualified adviser):</p>
          <ul className="prose" style={{ fontSize: 14 }}>{review.map((r) => <li key={r.id}><a href={`/admin/pages/${r.id}`}>{r.title}</a> ({r.status}): {r.note}</li>)}</ul>
          <p className="t-small"><a className="link" href="/admin/facts">Enter and verify business facts</a> · <a className="link" href="/admin/categories">Publish only the families you supply</a></p>
        </section>
      </div>
    </>
  );
}
