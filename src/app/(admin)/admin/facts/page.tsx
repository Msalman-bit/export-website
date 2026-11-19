import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, type SP } from '../ui';
import { saveFacts } from '../actions';

export default async function Facts({ searchParams }: { searchParams: SP }) {
  await requireStaff('facts.write');
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(s.facts);
  return (
    <>
      <div className="admin-head"><h1>Business facts</h1></div>
      <Flash sp={sp} />
      <p className="t-small">The website shows a fact only when it has a value and “verified” is ticked. Leave anything you cannot document empty: the pages read correctly without it.</p>
      <form action={saveFacts} className="panel-box">
        <table className="data"><thead><tr><th>Fact</th><th>Value</th><th>Verified</th><th>Where it appears</th></tr></thead><tbody>
          {rows.map((f) => (
            <tr key={f.key}><td><label htmlFor={`v_${f.key}`}>{f.label}</label></td><td><input id={`v_${f.key}`} name={`v_${f.key}`} defaultValue={f.value} /></td>
              <td><input type="checkbox" name={`ok_${f.key}`} defaultChecked={f.verified} aria-label={`${f.label} verified`} /></td><td className="t-small">{f.note}</td></tr>
          ))}
        </tbody></table>
        <div><button className="btn btn--primary" type="submit">Save the facts</button></div>
      </form>
    </>
  );
}
