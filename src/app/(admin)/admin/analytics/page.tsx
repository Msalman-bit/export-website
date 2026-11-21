import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { hasPasskeyHere } from '@/lib/auth/passkey-request';
import { Flash, type SP } from '../ui';
import { PasskeyConfirm } from '../forms';
import { resetAnalytics } from '../actions';

/* First-party, cookieless counts (no IP, no identifier): views, basket, quotes, samples, downloads,
   registrations, countries from the CDN header, and the funnel from product view to quote. */
export default async function Analytics({ searchParams }: { searchParams: SP }) {
  const u = await requireStaff('analytics.read');
  const sp = await searchParams;
  const days = Math.max(1, Math.min(365, Number(sp.days) || 30));
  const since = new Date(Date.now() - days * 86400_000);
  const db = await getDb();
  const [byName, topProducts, countries, byDay] = await Promise.all([
    db.select({ name: s.events.name, n: sql<number>`count(*)::int` }).from(s.events).where(gte(s.events.createdAt, since)).groupBy(s.events.name),
    db.select({ name: s.products.name, n: sql<number>`count(*)::int` }).from(s.events).innerJoin(s.products, eq(s.products.id, s.events.productId))
      .where(and(gte(s.events.createdAt, since), eq(s.events.name, 'product_view'), isNotNull(s.events.productId))).groupBy(s.products.name).orderBy(desc(sql`count(*)`)).limit(10),
    db.select({ c: s.events.country, n: sql<number>`count(*)::int` }).from(s.events).where(and(gte(s.events.createdAt, since), sql`${s.events.country} <> ''`)).groupBy(s.events.country).orderBy(desc(sql`count(*)`)).limit(10),
    db.select({ d: sql<string>`to_char(${s.events.createdAt}, 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` }).from(s.events).where(and(gte(s.events.createdAt, since), eq(s.events.name, 'product_view'))).groupBy(sql`1`).orderBy(sql`1`),
  ]);
  const ev = Object.fromEntries(byName.map((e) => [e.name, e.n]));
  const reset = can(u.role, 'analytics.reset');
  const [{ all }] = reset ? await db.select({ all: sql<number>`count(*)::int` }).from(s.events) : [{ all: 0 }];
  const funnel = [['Product views', ev.product_view ?? 0], ['Added to an inquiry', ev.basket_add ?? 0], ['Quotes requested', ev.quote_submitted ?? 0], ['Samples requested', ev.sample_requested ?? 0]] as const;
  const top = Math.max(1, ...funnel.map(([, n]) => n));
  const maxDay = Math.max(1, ...byDay.map((d) => d.n));
  return (
    <>
      <div className="admin-head"><h1>Analytics</h1>
        <nav className="btn-row" aria-label="Period">{[7, 30, 90].map((d) => <a key={d} className={`btn ${d === days ? 'btn--primary' : 'btn--secondary'}`} href={`/admin/analytics?days=${d}`}>{d} days</a>)}</nav></div>
      <Flash sp={sp} />
      <div className="kpis">
        {[['Product views', 'product_view'], ['Quotes requested', 'quote_submitted'], ['Samples requested', 'sample_requested'], ['Catalogue downloads', 'catalogue_download'], ['Datasheet downloads', 'datasheet_download'], ['New customer accounts', 'customer_registered'], ['Studio designs sent', 'studio_to_inquiry']].map(([label, key]) => (
          <div className="kpi" key={key}><span className="t-small muted">{label}</span><strong>{ev[key] ?? 0}</strong></div>
        ))}
      </div>
      <div className="cols-even">
        <section className="panel-box"><h2>Funnel</h2>
          {funnel.map(([label, n]) => <div key={label} className="block" style={{ gap: 4 }}><span className="t-small">{label}: {n}</span><div className="bar"><span style={{ width: `${(n / top) * 100}%` }} /></div></div>)}
        </section>
        <section className="panel-box"><h2>Most viewed products</h2>
          <ol>{topProducts.map((p) => <li key={p.name}>{p.name}: {p.n}</li>)}{!topProducts.length ? <li>No views yet.</li> : null}</ol>
        </section>
        <section className="panel-box"><h2>Countries</h2>
          <p className="t-small">From the CDN’s country header (Cloudflare or Vercel); empty when the site runs without one.</p>
          <ol>{countries.map((c) => <li key={c.c}>{c.c}: {c.n}</li>)}{!countries.length ? <li>No country data yet.</li> : null}</ol>
        </section>
        <section className="panel-box"><h2>Product views per day</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: 120 }} role="img" aria-label={`Product views per day over ${days} days`}>
            {byDay.map((d) => <span key={d.d} title={`${d.d}: ${d.n}`} style={{ flex: 1, background: 'var(--ink)', height: `${(d.n / maxDay) * 100}%`, minHeight: 2 }} />)}
          </div>
        </section>
      </div>
      <p className="t-small">For traffic sources and sessions, connect Google Analytics 4 in Settings; it loads only for visitors who accept analytics cookies.</p>
      {reset ? <ResetAnalytics total={all} passkey={await hasPasskeyHere(u.id)} /> : null}
    </>
  );
}

/* Resetting the analytics (administrators only): "Reset…" opens the warning, and its button resets only with the
   six-digit code the administrator's authenticator app shows now (resetAnalytics in ../actions). Typically used
   once, before launch, to clear the counts left by testing. */
function ResetAnalytics({ total, passkey }: { total: number; passkey: boolean }) {
  return (
    <section className="panel-box" id="reset"><h2>Reset the analytics</h2>
      {!total ? <p className="t-small">Nothing to reset: every count is at zero.</p> : (
        <details className="danger-zone">
          <summary className="btn btn--quiet-danger">Reset…</summary>
          <div className="danger-zone__body" role="group" aria-label="Reset the analytics">
            <p><strong>Reset all analytics counts? This can’t be undone.</strong></p>
            <p className="t-small">
              It removes every count recorded so far ({total.toLocaleString('en-GB')}): product views, list additions, quote and
              sample requests, downloads, new accounts and studio use, here and on the dashboard. Counting starts again
              from now. Inquiries, customers, orders and emails are not touched. The audit log keeps a record of who reset
              it and when, with the totals removed.
            </p>
            <form action={resetAnalytics} className="block">
              <input type="hidden" name="confirm" value="reset-analytics" />
              <div className="field">
                <label htmlFor="reset-code">Code from your authenticator app</label>
                <input id="reset-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
              </div>
              <div className="btn-row"><button className="btn btn--danger" type="submit">Reset the analytics</button></div>
              {passkey ? <PasskeyConfirm label="Reset with a passkey" /> : null}
            </form>
          </div>
        </details>
      )}
    </section>
  );
}
