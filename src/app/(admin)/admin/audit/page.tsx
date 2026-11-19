import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { fmt } from '../ui';

export default async function Audit() {
  await requireStaff('audit.read');
  const db = await getDb();
  const rows = await db.select().from(s.auditLog).orderBy(desc(s.auditLog.createdAt)).limit(500);
  return (
    <>
      <div className="admin-head"><h1>Audit log</h1></div>
      <p className="t-small">Every sign-in, change, status update, email and export by staff. The log is append-only from the application.</p>
      <div className="table-wrap"><table className="data"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{fmt(r.createdAt)}</td><td>{r.actorEmail}</td><td>{r.action}</td><td>{r.entity} {r.entityId.slice(0, 12)}</td><td className="t-small">{Object.keys(r.detail).length ? JSON.stringify(r.detail) : ''}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
