import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { fmt, type SP } from '../ui';

export default async function Outbox({ searchParams }: { searchParams: SP }) {
  await requireStaff('outbox.read');
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(s.emailOutbox).orderBy(desc(s.emailOutbox.createdAt)).limit(200);
  const open = rows.find((r) => r.id === sp.id);
  return (
    <>
      <div className="admin-head"><h1>Email outbox</h1></div>
      <p className="t-small">{process.env.RESEND_API_KEY ? 'Emails are sent through Resend.' : 'No RESEND_API_KEY is set: emails are logged here instead of sent. Add the key to send them.'}</p>
      {open ? (
        <section className="panel-box"><h2>{open.subject}</h2><p className="t-small">To {open.to} · {open.status} · {fmt(open.createdAt)}</p>
          <iframe title="Email preview" sandbox="" srcDoc={open.html} style={{ width: '100%', height: 560, border: '1px solid var(--line)', background: '#fff' }} /></section>
      ) : null}
      <div className="table-wrap"><table className="data"><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{fmt(r.createdAt)}</td><td>{r.to}</td><td><a className="link" href={`/admin/outbox?id=${r.id}`}>{r.subject}</a></td><td>{r.status}{r.error ? `: ${r.error}` : ''}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
