import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, Status, day, money, type SP } from '../ui';

export default async function Orders({ searchParams }: { searchParams: SP }) {
  await requireStaff('orders.read');
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select({ o: s.orders, company: s.companies.name }).from(s.orders).leftJoin(s.companies, eq(s.companies.id, s.orders.companyId)).orderBy(desc(s.orders.createdAt)).limit(300);
  return (
    <>
      <div className="admin-head"><h1>Orders and production</h1><a className="btn btn--secondary" href="/api/admin/export?table=orders">Export as CSV</a></div>
      <Flash sp={sp} />
      <p className="t-small">Orders are created from an accepted quotation on its inquiry.</p>
      <div className="table-wrap"><table className="data"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Created</th><th>Stage</th></tr></thead><tbody>
        {rows.map(({ o, company }) => <tr key={o.id}><td><a className="link" href={`/admin/orders/${o.id}`}>{o.number}</a></td><td>{company}</td><td>{money(o.total, o.currency)}</td><td>{day(o.createdAt)}</td><td><Status value={o.status} /></td></tr>)}
        {!rows.length ? <tr><td colSpan={5}>No orders yet.</td></tr> : null}
      </tbody></table></div>
    </>
  );
}
