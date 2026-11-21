import { asc, count, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { Flash, day, type SP } from '../ui';
import { createStaff, updateStaff, changeOwnPassword } from '../actions';

export default async function Users({ searchParams }: { searchParams: SP }) {
  const me = await requireStaff('users.manage');
  const sp = await searchParams;
  const db = await getDb();
  const staff = await db.select().from(s.users).where(eq(s.users.kind, 'staff')).orderBy(asc(s.users.email));
  const passkeys = new Map((await db.select({ userId: s.passkeys.userId, n: count() }).from(s.passkeys).groupBy(s.passkeys.userId)).map((r) => [r.userId, r.n]));
  return (
    <>
      <div className="admin-head"><h1>Staff and roles</h1></div>
      <Flash sp={sp} />
      <div className="table-wrap"><table className="data"><thead><tr><th>Person</th><th>Role</th><th>Two-factor</th><th>Last sign-in</th><th>Access</th></tr></thead><tbody>
        {staff.map((u) => (
          <tr key={u.id}><td>{u.name}<br /><span className="t-small muted">{u.email}</span></td>
            <td><form action={updateStaff} className="inline-form"><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="role" />
              <label className="sr-only" htmlFor={`r-${u.id}`}>Role of {u.email}</label>
              <select id={`r-${u.id}`} name="role" defaultValue={u.role}>{s.STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><button className="btn-text" type="submit">Save</button></form></td>
            <td>{u.mfaEnabledAt ? 'On' : 'Not set up'}{passkeys.get(u.id) ? <><br /><span className="t-small muted">{passkeys.get(u.id)} {passkeys.get(u.id) === 1 ? 'passkey' : 'passkeys'}</span></> : null}</td><td>{day(u.lastLoginAt) || 'never'}</td>
            <td>{u.id === me.id ? 'You' : (
              <div className="inline-form">
                <form action={updateStaff}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value={u.disabledAt ? 'enable' : 'disable'} /><button className="btn-text" type="submit">{u.disabledAt ? 'Enable' : 'Disable'}</button></form>
                <form action={updateStaff}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="reset-mfa" /><button className="btn-text" type="submit">Reset two-factor</button></form>
              </div>
            )}</td></tr>
        ))}
      </tbody></table></div>
      <p className="t-small">Reset two-factor: for a lost or replaced phone. It also removes the person’s passkeys; they set up an authenticator app again at their next sign-in. Each person adds and removes their own passkeys under Your account.</p>
      <div className="cols-even">
        <form action={createStaff} className="panel-box"><h2>Add a staff member</h2>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" /></div>
          <div className="field"><label htmlFor="role">Role</label><select id="role" name="role" defaultValue="sales">{s.STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
          <p className="t-small">Administrators: everything. Sales managers: inquiries, quotations, customers, orders, shipping, exports. Content editors: catalogue, pages, articles, translations, proof. Production managers: production stages and shipping.</p>
          <div><button className="btn btn--primary" type="submit">Create the account</button></div>
        </form>
        <form action={changeOwnPassword} className="panel-box"><h2>Change your password</h2>
          <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
          <div className="field"><label htmlFor="next">New password (12+ characters)</label><input id="next" name="next" type="password" autoComplete="new-password" required /></div>
          <div><button className="btn btn--secondary" type="submit">Change the password</button></div>
        </form>
      </div>
    </>
  );
}
