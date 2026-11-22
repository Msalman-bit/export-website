import { getMarkets } from '@/lib/data';
import { requireStaff } from '@/lib/auth/session';
import { Flash, type SP } from '../ui';
import { setMarket } from '../actions';

export default async function Markets({ searchParams }: { searchParams: SP }) {
  await requireStaff('markets.write');
  const sp = await searchParams;
  const rows = await getMarkets();
  return (
    <>
      <div className="admin-head"><h1>Export markets</h1></div>
      <Flash sp={sp} />
      <p className="t-small">The home page map marks every market as a target market. Mark a country “shipped to” only after an order has been delivered there; it then appears in lime with its own legend.</p>
      <div className="table-wrap"><table className="data"><thead><tr><th>Country</th><th>Region</th><th>Status and note</th></tr></thead><tbody>
        {rows.map((m) => (
          <tr key={m.code}><td>{m.name}</td><td>{m.region}</td><td>
            <form action={setMarket} className="inline-form"><input type="hidden" name="code" value={m.code} />
              <label className="sr-only" htmlFor={`st-${m.code}`}>Status of {m.name}</label>
              <select id={`st-${m.code}`} name="status" defaultValue={m.status}><option value="target">Target market</option><option value="established">Shipped to</option></select>
              <label className="sr-only" htmlFor={`nt-${m.code}`}>Note for {m.name}</label><input id={`nt-${m.code}`} name="note" defaultValue={m.note} />
              <button className="btn-text" type="submit">Save</button></form>
          </td></tr>
        ))}
      </tbody></table></div>
    </>
  );
}
