import { asc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { pic } from '@/lib/media';
import { Flash, day, type SP } from '../ui';
import { LiveSearch } from '../live-search';

export default async function Products({ searchParams }: { searchParams: SP }) {
  await requireStaff('catalogue.write');
  const sp = await searchParams;
  const db = await getDb();
  const q = sp.q?.slice(0, 60);
  const rows = await db.select({ p: s.products, cat: s.categories.name }).from(s.products).innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .where(q ? or(ilike(s.products.name, `%${q}%`), ilike(s.products.sku, `%${q}%`)) : undefined).orderBy(asc(s.categories.name), asc(s.products.name));
  return (
    <>
      <div className="admin-head"><h1>Products</h1><div className="btn-row"><a className="btn btn--primary" href="/admin/products/new">Add a product</a><a className="btn btn--secondary" href="/api/admin/export?table=products">Export as CSV</a></div></div>
      <Flash sp={sp} />
      <LiveSearch><div className="field"><label htmlFor="q">Name or SKU</label><input id="q" name="q" defaultValue={q} /></div><button className="btn btn--primary" type="submit">Search</button></LiveSearch>
      <div className="table-wrap"><table className="data"><thead><tr><th>Picture</th><th>Product</th><th>SKU</th><th>Type</th><th>Status</th><th>Filled in</th><th>Updated</th></tr></thead><tbody>
        {rows.map(({ p, cat }) => {
          const im = pic(p.images[0]?.url, 400);
          const filled = [p.moq, p.leadTime, p.weight, p.materials, p.sizes.length ? 'x' : '', p.testingStandards.length ? 'x' : ''].filter(Boolean).length;
          return (
            <tr key={p.id}>
              <td>{im ? <img src={im.src} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 4 }} /> : null}</td>
              <td><a className="link" href={`/admin/products/${p.id}${q ? `?q=${encodeURIComponent(q)}` : ''}`}>{p.name}</a>{p.images.some((i) => i.source === 'generated') ? <><br /><span className="t-small muted">concept picture: replace with a photograph</span></> : null}</td>
              <td>{p.sku}</td><td>{cat}</td><td><span className={`pill-status${p.status === 'draft' ? ' badge-draft' : ''}`}>{p.status}</span></td>
              <td>{filled} of 6 commercial fields</td><td>{day(p.updatedAt)}</td>
            </tr>
          );
        })}
        {!rows.length ? <tr><td colSpan={7}>{q ? `No product name or SKU contains “${q}”.` : 'No products yet.'}</td></tr> : null}
      </tbody></table></div>
    </>
  );
}
