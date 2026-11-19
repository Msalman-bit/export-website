import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { countryName } from '@/lib/inquiry/countries';
import { Flash, Status, day, fmt, money, type SP } from '../../ui';
import { saveCompanyNotes, sendStaffMessage } from '../../actions';

export default async function Customer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireStaff('customers.read');
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [c] = await db.select().from(s.companies).where(eq(s.companies.id, id)).limit(1);
  if (!c) notFound();
  const [users, inquiries, orders, msgs, docs] = await Promise.all([
    db.select().from(s.users).where(eq(s.users.companyId, id)),
    db.select().from(s.inquiries).where(eq(s.inquiries.companyId, id)).orderBy(desc(s.inquiries.createdAt)),
    db.select().from(s.orders).where(eq(s.orders.companyId, id)).orderBy(desc(s.orders.createdAt)),
    db.select().from(s.messages).where(eq(s.messages.companyId, id)).orderBy(desc(s.messages.createdAt)).limit(50),
    db.select().from(s.documents).where(eq(s.documents.companyId, id)),
  ]);
  return (
    <>
      <div className="admin-head"><div><p className="t-small muted"><a className="link" href="/admin/customers">Customers</a></p><h1>{c.name}</h1></div></div>
      <Flash sp={sp} />
      <div className="cols-2">
        <div className="block">
          <section className="panel-box"><h2>Company</h2>
            <table className="spec-table"><tbody>
              <tr><th>Country</th><td>{countryName(c.country)}</td></tr><tr><th>Website</th><td>{c.website}</td></tr><tr><th>Phone</th><td>{c.phone}</td></tr>
              <tr><th>Address</th><td style={{ whiteSpace: 'pre-wrap' }}>{c.address}</td></tr><tr><th>Quotation currency</th><td>{c.preferredCurrency}</td></tr>
            </tbody></table>
            <h3>Accounts</h3>
            <ul>{users.map((u) => <li key={u.id}>{u.name} · {u.email} · {u.emailVerifiedAt ? 'verified' : 'email not confirmed'} · last sign-in {day(u.lastLoginAt) || 'never'}</li>)}{!users.length ? <li>No one has registered for this company yet.</li> : null}</ul>
          </section>
          <section className="panel-box"><h2>Inquiries</h2>
            <ul>{inquiries.map((i) => <li key={i.id}><a className="link" href={`/admin/inquiries/${i.id}`}>{i.reference}</a> · {day(i.createdAt)} · <Status value={i.status} /></li>)}</ul>
            <h2>Orders</h2>
            <ul>{orders.map((o) => <li key={o.id}><a className="link" href={`/admin/orders/${o.id}`}>{o.number}</a> · {money(o.total, o.currency)} · <Status value={o.status} /></li>)}{!orders.length ? <li>None yet.</li> : null}</ul>
            <h2>Shared documents</h2>
            <ul>{docs.map((d) => <li key={d.id}><a className="link" href={`/media/${d.attachmentId}`}>{d.title}</a></li>)}{!docs.length ? <li>None. <a className="link" href="/admin/documents">Share a document</a></li> : null}</ul>
          </section>
        </div>
        <div className="block">
          <section className="panel-box"><h2>Internal notes</h2>
            <form action={saveCompanyNotes} className="block"><input type="hidden" name="id" value={c.id} />
              <div className="field"><label htmlFor="notes">Notes (staff only)</label><textarea id="notes" name="notes" defaultValue={c.notes} /></div><button className="btn btn--secondary" type="submit">Save notes</button></form>
          </section>
          <section className="panel-box"><h2>Messages</h2>
            <form action={sendStaffMessage} className="block"><input type="hidden" name="companyId" value={c.id} /><input type="hidden" name="return" value={`/admin/customers/${c.id}`} />
              <div className="field"><label htmlFor="body">Message to the customer</label><textarea id="body" name="body" /></div><button className="btn btn--secondary" type="submit">Send</button></form>
            {msgs.map((m) => <div key={m.id} className={`msg${m.fromStaff ? ' msg--staff' : ''}`}><p className="msg__meta">{m.fromStaff ? 'Monolith' : 'Customer'} · {fmt(m.createdAt)}</p><p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p></div>)}
          </section>
        </div>
      </div>
    </>
  );
}
