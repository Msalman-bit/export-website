import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { currentRelyingParty } from '@/lib/auth/passkey-request';
import { MAX_PASSKEYS, type Passkey } from '@/lib/auth/passkeys';
import type { StaffRole } from '@/lib/db/schema';
import { Flash, fmt, type SP } from '../ui';
import { AddPasskeyForm } from '../forms';
import { removePasskey } from '../passkey-actions';

/* Your account: every staff member's own page (no permission needed), for their passkeys. A passkey signs in with the
   phone's or computer's own lock instead of the password and the authenticator code. Adding one takes a fresh
   authenticator code; removing one takes a second click. */
export default async function Account({ searchParams }: { searchParams: SP }) {
  const u = await requireStaff();
  const sp = await searchParams;
  const rp = await currentRelyingParty();
  const db = await getDb();
  const keys = await db.select().from(s.passkeys).where(eq(s.passkeys.userId, u.id)).orderBy(asc(s.passkeys.createdAt));
  const here = keys.filter((k) => rp && k.rpId === rp.rpId);
  const elsewhere = keys.filter((k) => !rp || k.rpId !== rp.rpId);
  return (
    <>
      <div className="admin-head"><h1>Your account</h1></div>
      <Flash sp={sp} />
      <p className="t-small">{u.name ? `${u.name}, ` : ''}{u.email} · {ROLE_LABELS[u.role as StaffRole] ?? u.role}</p>

      <section className="panel-box" id="passkeys"><h2>Passkeys</h2>
        <p>
          A passkey lets you sign in with your phone’s or computer’s own lock (Face ID, a fingerprint or the device PIN)
          instead of typing your password and the authenticator code. It counts as both. Each person adds their own, and
          you can add several: your phone, your laptop.
        </p>
        <p className="t-small">
          A passkey belongs to one web address. {rp ? <>Passkeys added here work on <strong>{rp.rpId}</strong> only. </> : null}
          When the site moves to its own domain, passkeys made on this address do not move with it: add them again there.
        </p>
        {here.length ? <PasskeyTable keys={here} /> : <p className="t-small muted">{rp ? 'You have no passkey for this address yet.' : ''}</p>}

        {!rp ? (
          <p className="t-small">
            Passkeys cannot be used on this address. They need the site’s secure address (https://…), or localhost on
            the computer that runs the site.
          </p>
        ) : keys.length >= MAX_PASSKEYS ? (
          <p className="t-small">You have {keys.length} passkeys, the most one account can have. Remove one you no longer use to add another.</p>
        ) : (
          <div className="passkey-add">
            <h3>Add a passkey</h3>
            <p className="t-small">
              On your phone: open this page on the phone and add it there. At a computer: add it for this computer, or
              choose “Use a phone or tablet” in the window that opens and scan the code with your phone. The phone keeps
              the passkey (in iCloud Keychain or Google Password Manager, for example).
            </p>
            <AddPasskeyForm />
          </div>
        )}

        {elsewhere.length ? (
          <div className="passkey-add">
            <h3>Passkeys for other addresses of the site</h3>
            <p className="t-small">These work only at the address shown, not here. Remove the ones you no longer need.</p>
            <PasskeyTable keys={elsewhere} showSite />
          </div>
        ) : null}
      </section>

      <section className="panel-box"><h2>Password and authenticator</h2>
        <p className="t-small">
          Your password and authenticator app keep working as before, so you can always sign in without a passkey.
          Lost a phone that holds a passkey? Remove the passkey here from another device, or ask an administrator to
          reset your two-factor sign-in under Staff and roles: that also removes all your passkeys.
        </p>
      </section>
    </>
  );
}

function PasskeyTable({ keys, showSite = false }: { keys: Passkey[]; showSite?: boolean }) {
  return (
    <div className="table-wrap"><table className="data"><thead><tr>
      <th>Name</th>{showSite ? <th>Works on</th> : null}<th>Added</th><th>Last used</th><th><span className="sr-only">Remove</span></th>
    </tr></thead><tbody>
      {keys.map((k) => (
        <tr key={k.id}>
          <td>{k.name}{k.deviceType === 'multiDevice' ? <><br /><span className="t-small muted">Synced across your devices</span></> : null}</td>
          {showSite ? <td>{k.rpId}</td> : null}
          <td>{fmt(k.createdAt)}</td>
          <td>{k.lastUsedAt ? fmt(k.lastUsedAt) : 'not yet'}</td>
          <td>
            <details className="passkey-remove">
              <summary className="btn-text">Remove…</summary>
              <form action={removePasskey} className="passkey-remove__body">
                <input type="hidden" name="id" value={k.id} />
                <p className="t-small">Remove “{k.name}”? It stops signing in at once.</p>
                <button className="btn btn--quiet-danger" type="submit">Remove</button>
              </form>
            </details>
          </td>
        </tr>
      ))}
    </tbody></table></div>
  );
}
