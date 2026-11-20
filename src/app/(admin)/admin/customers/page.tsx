import { desc, ilike, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { countryName } from '@/lib/inquiry/countries';
import { Flash, day, type SP } from '../ui';
import { LiveSearch } from '../live-search';

export default async function Customers({ searchParams }: { searchParams: SP }) {
  await requireStaff('customers.read');
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select({
    c: s.companies,
    users: sql<number>`(select count(*)::int from users where company_id = ${s.companies.id})`,
    inquiries: sql<number>`(select count(*)::int from inquiries where company_id = ${s.companies.id})`,
    orders: sql<number>`(select count(*)::int from orders where company_id = ${s.companies.id})`,
  }).from(s.companies).where(sp.q ? ilike(s.companies.name, `%${sp.q.slice(0, 60)}%`) : undefined).orderBy(desc(s.companies.createdAt)).limit(300);
  return (
    <>
      <div className="admin-head"><h1>Customers</h1><a className="btn btn--secondary" href="/api/admin/export?table=customers">Export as CSV</a></div>
      <Flash sp={sp} />
      <LiveSearch><div className="field"><label htmlFor="q">Company name</label><input id="q" name="q" defaultValue={sp.q} /></div><button className="btn btn--primary" type="submit">Search</button></LiveSearch>
      <div className="table-wrap"><table className="data"><thead><tr><th>Company</th><th>Country</th><th>Accounts</th><th>Inquiries</th><th>Orders</th><th>Since</th></tr></thead><tbody>
        {rows.map(({ c, users, inquiries, orders }) => <tr key={c.id}><td><a className="link" href={`/admin/customers/${c.id}`}>{c.name}</a></td><td>{countryName(c.country)}</td><td>{users}</td><td>{inquiries}</td><td>{orders}</td><td>{day(c.createdAt)}</td></tr>)}
        {!rows.length ? <tr><td colSpan={6}>{sp.q ? `No company name contains “${sp.q.slice(0, 60)}”.` : 'No customer companies yet.'}</td></tr> : null}
      </tbody></table></div>
    </>
  );
}
