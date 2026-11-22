import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { localeFrom } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { readSession, requireCustomer } from '@/lib/auth/session';
import { PageShell } from '@/components/site/PageShell';
import { STATUS_LABEL, ORDER_STEPS } from '@/lib/status';
import { pic } from '@/lib/media';
import { longDate } from '@/lib/text';
import { confirmEmail, logout } from '../actions';
import { RegisterForm, LoginForm, ForgotForm, ResetForm, ResendForm, CompanyForm, MessageForm } from '../forms';

type Props = { params: Promise<{ locale: string; slug?: string[] }>; searchParams: Promise<Record<string, string | undefined>> };

const TITLES: Record<string, string> = {
  '': 'Your account', login: 'Sign in', register: 'Create a customer account', verify: 'Confirm your email', forgot: 'Reset your password',
  reset: 'Choose a new password', quotations: 'Quotations', samples: 'Sample requests', orders: 'Orders and production', saved: 'Saved products',
  designs: 'Saved designs', documents: 'Documents', messages: 'Messages', company: 'Company profile',
};

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  const { slug = [] } = await params;
  return pageMeta({ locale, path: `/account${slug.length ? '/' + slug[0] : ''}`, title: `${TITLES[slug[0] ?? ''] ?? 'Account'} | Monolith Sports`, description: 'The Monolith Sports customer portal: quotations, samples, orders, production status, tracking and documents.', noindex: true });
}

const fmtDate = longDate;
// the words a customer reads for the stored type and status codes
const TYPE_LABEL: Record<string, string> = { quote: 'Quotation', sample: 'Sample', contact: 'Message', distributor: 'Distributor application', partnership: 'Partnership inquiry' };
const asWord = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);

export default async function Account({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { slug = [] } = await params;
  const sp = await searchParams;
  const [page, sub] = slug;

  // ---- signed-out pages
  if (page === 'login' || page === 'register' || page === 'forgot' || page === 'reset') {
    const signedIn = await readSession('customer');
    if (signedIn?.emailVerifiedAt && page !== 'reset') redirect(`/${locale}/account`);
    return (
      <PageShell locale={locale} crumbs={[{ name: TITLES[page], path: `/account/${page}` }]} close={null}>
        <div className="auth">
          <header className="page-head"><h1>{TITLES[page]}</h1>
            {page === 'login' ? <p>Follow your quotations, samples, orders and shipments</p> : null}
            {page === 'register' ? <p>Customer accounts are for clubs, distributors and brands that buy from Monolith Sports. Inquiries already sent from the same email address appear in the account once you confirm the address.</p> : null}
            {page === 'forgot' ? <p>We will send you a link to choose a new password</p> : null}
          </header>
          {sp.reset ? <p className="notice">Your password has been changed. Sign in with the new password.</p> : null}
          {page === 'login' ? <LoginForm locale={locale} /> : page === 'register' ? <RegisterForm locale={locale} /> : page === 'forgot' ? <ForgotForm locale={locale} /> : <ResetForm locale={locale} token={sp.token ?? ''} />}
          <p className="t-small">
            {page === 'login' ? <><a className="link" href={`/${locale}/account/register`}>Create an account</a> or <a className="link" href={`/${locale}/account/forgot`}>reset your password</a></> : <a className="link" href={`/${locale}/account/login`}>Back to sign in</a>}
          </p>
        </div>
      </PageShell>
    );
  }

  if (page === 'verify') {
    if (sub) {
      // A GET only shows the button: mail scanners that open links must not use up the token.
      const done = sp.done === '1', failed = sp.done === '0';
      return (
        <PageShell locale={locale} crumbs={[]} close={null}>
          <div className="auth">
            <header className="page-head"><h1>{done ? 'Email confirmed' : failed ? 'This link has expired' : 'Confirm your email'}</h1>
              <p>{done ? 'Your account is now active. Earlier requests sent from this address have been added to it.' : failed ? 'Sign in and ask for a new confirmation link' : 'Use the button below to open your customer account'}</p></header>
            {done || failed ? (
              <div className="btn-row"><a className="btn btn--primary" href={`/${locale}/account`}>{done ? 'Open your account' : 'Sign in'}</a></div>
            ) : (
              <form action={confirmEmail}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="token" value={sub} />
                <div className="btn-row"><button className="btn btn--primary" type="submit">Confirm my email</button></div>
              </form>
            )}
          </div>
        </PageShell>
      );
    }
    const user = await readSession('customer');
    if (!user) redirect(`/${locale}/account/login`);
    if (user.emailVerifiedAt) redirect(`/${locale}/account`);
    return (
      <PageShell locale={locale} crumbs={[]} close={null}>
        <div className="auth"><header className="page-head"><h1>Confirm your email</h1>
          <p>We have sent a confirmation link to {user.email}. Open it to finish setting up the account; the link is valid for 24 hours.</p></header>
          <ResendForm locale={locale} /></div>
      </PageShell>
    );
  }

  // ---- signed-in portal
  const anon = await readSession('customer');
  if (!anon) redirect(`/${locale}/account/login`);
  const user = await requireCustomer(locale);
  const db = await getDb();
  const cid = user.companyId;
  const [company] = await db.select().from(s.companies).where(eq(s.companies.id, cid)).limit(1);
  const nav = ['', 'quotations', 'samples', 'orders', 'saved', 'designs', 'documents', 'messages', 'company'];
  if (page && !nav.includes(page)) notFound();
  const current = page ?? '';

  const inquiries = await db.select().from(s.inquiries).where(eq(s.inquiries.companyId, cid)).orderBy(desc(s.inquiries.createdAt));
  const inqIds = inquiries.map((i) => i.id);
  let body: React.ReactNode = null;

  if (current === '') {
    const orders = await db.select().from(s.orders).where(eq(s.orders.companyId, cid)).orderBy(desc(s.orders.createdAt)).limit(5);
    const quotes = inqIds.length ? await db.select().from(s.quotations).where(and(inArray(s.quotations.inquiryId, inqIds), inArray(s.quotations.status, ['sent', 'accepted', 'declined']))) : [];
    body = (
      <>
        <div className="cards-3">
          <div className="stat-card"><span className="t-small muted">Open requests</span><strong>{inquiries.filter((i) => i.status !== 'completed').length}</strong><a className="link" href={`/${locale}/account/quotations`}>See requests and quotations</a></div>
          <div className="stat-card"><span className="t-small muted">Quotations received</span><strong>{quotes.length}</strong><a className="link" href={`/${locale}/account/quotations`}>Download quotations</a></div>
          <div className="stat-card"><span className="t-small muted">Orders</span><strong>{orders.length}</strong><a className="link" href={`/${locale}/account/orders`}>Follow production</a></div>
        </div>
        <section className="block"><h2>Latest requests</h2>{requestTable(inquiries.slice(0, 6))}</section>
        <div className="btn-row"><a className="btn btn--primary" href={`/${locale}/inquiry`}>Request a quotation</a><a className="btn btn--secondary" href={`/${locale}/products`}>See the catalogue</a></div>
      </>
    );
  } else if (current === 'quotations') {
    const quotes = inqIds.length ? await db.select().from(s.quotations).where(and(inArray(s.quotations.inquiryId, inqIds), inArray(s.quotations.status, ['sent', 'accepted', 'declined']))).orderBy(desc(s.quotations.createdAt)) : [];
    body = (
      <>
        <section className="block"><h2>Requests</h2>{requestTable(inquiries)}</section>
        <section className="block"><h2>Quotations</h2>
          {quotes.length ? (
            <div className="table-wrap"><table className="data"><thead><tr><th>Number</th><th>Request</th><th>Total</th><th>Valid until</th><th>Status</th><th>PDF</th></tr></thead><tbody>
              {quotes.map((q) => (<tr key={q.id}><td>{q.number}</td><td>{inquiries.find((i) => i.id === q.inquiryId)?.reference}</td><td>{q.currency} {Number(q.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td><td>{fmtDate(q.validUntil)}</td><td><span className="pill-status">{asWord(q.status)}</span></td><td><a className="link" href={`/api/portal/quotations/${q.id}`}>Download</a></td></tr>))}
            </tbody></table></div>
          ) : <p className="empty">No quotation has been sent to this account yet. Quotations appear here as soon as the sales team sends them.</p>}
        </section>
      </>
    );
  } else if (current === 'samples') {
    const samples = inquiries.filter((i) => i.type === 'sample' || i.status.startsWith('sample'));
    body = samples.length ? requestTable(samples) : <div className="empty"><p>No sample requests yet.</p><a className="btn btn--secondary" href={`/${locale}/inquiry?type=sample`}>Request a sample</a></div>;
  } else if (current === 'orders') {
    const orders = await db.select().from(s.orders).where(eq(s.orders.companyId, cid)).orderBy(desc(s.orders.createdAt));
    const ids = orders.map((o) => o.id);
    const ships = ids.length ? await db.select().from(s.shipments).where(inArray(s.shipments.orderId, ids)) : [];
    const invs = ids.length ? await db.select().from(s.invoices).where(inArray(s.invoices.orderId, ids)) : [];
    body = orders.length ? orders.map((o) => {
      const step = ORDER_STEPS.indexOf(o.status);
      return (
        <section className="form-section" key={o.id}>
          <h2>Order {o.number}</h2>
          <p className="t-small muted">{fmtDate(o.createdAt)}, {o.currency} {Number(o.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          <ol className="timeline" aria-label="Production status">
            {ORDER_STEPS.map((st, i) => <li key={st} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}><span>{`${STATUS_LABEL[st]}${i === step ? ' (current stage)' : ''}`}</span></li>)}
          </ol>
          {ships.filter((x) => x.orderId === o.id).map((x) => (
            <p key={x.id}>Shipment: {[[x.method, x.carrier ? `with ${x.carrier}` : ''].filter(Boolean).join(' '), x.trackingNumber ? `tracking ${x.trackingNumber}` : '', x.eta ? `expected ${x.eta}` : ''].filter(Boolean).join(', ')} {x.trackingUrl ? <a className="link" href={x.trackingUrl} rel="noopener noreferrer" target="_blank">Track the shipment</a> : null}</p>
          ))}
          {invs.filter((x) => x.orderId === o.id).map((x) => (
            <p key={x.id}>Invoice {x.number}: {x.currency} {Number(x.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}, {x.status}. <a className="link" href={`/api/portal/invoices/${x.id}`}>Download the invoice</a></p>
          ))}
        </section>
      );
    }) : <p className="empty">No orders yet. Once you accept a quotation, the order and its production status appear here.</p>;
  } else if (current === 'saved') {
    const saved = await db.select({ p: s.products }).from(s.savedProducts).innerJoin(s.products, eq(s.products.id, s.savedProducts.productId)).where(eq(s.savedProducts.userId, user.id));
    const cats = await db.select().from(s.categories);
    body = saved.length ? (
      <div className="prod-grid">{saved.map(({ p }) => {
        const sub = cats.find((c) => c.id === p.categoryId); const fam = cats.find((c) => c.id === sub?.parentId);
        const im = pic(p.images[0]?.url, 640);
        return (<a key={p.id} className="card tile" href={`/${locale}/products/${fam?.slug}/${p.slug}`}><div className="tile__media">{im ? <img src={im.src} alt={p.images[0]?.alt ?? p.name} width={im.width} height={im.height} loading="lazy" /> : null}</div><div className="tile__head"><h2 className="t-card">{p.name}</h2></div><p className="sku">{p.sku}</p></a>);
      })}</div>
    ) : <p className="empty">No saved products. Use “Save product” on any product page.</p>;
  } else if (current === 'designs') {
    const designs = await db.select().from(s.customisations).where(eq(s.customisations.companyId, cid)).orderBy(desc(s.customisations.createdAt));
    body = designs.length ? (
      <div className="table-wrap"><table className="data"><thead><tr><th>Design</th><th>Saved</th><th>Details</th></tr></thead><tbody>
        {designs.map((d) => <tr key={d.id}><td>{d.name}</td><td>{fmtDate(d.createdAt)}</td><td>{Object.entries(d.config).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}</td></tr>)}
      </tbody></table></div>
    ) : <div className="empty"><p>No saved designs yet.</p><a className="btn btn--secondary" href={`/${locale}/studio`}>Open the customisation studio</a></div>;
  } else if (current === 'documents') {
    const docs = await db.select().from(s.documents).where(or(eq(s.documents.companyId, cid), eq(s.documents.visibility, 'customers'), eq(s.documents.visibility, 'public'))).orderBy(desc(s.documents.createdAt));
    body = docs.length ? (
      <div className="table-wrap"><table className="data"><thead><tr><th>Document</th><th>Type</th><th>Added</th><th>File</th></tr></thead><tbody>
        {docs.map((d) => <tr key={d.id}><td>{d.title}</td><td>{asWord(d.kind)}</td><td>{fmtDate(d.createdAt)}</td><td><a className="link" href={`/media/${d.attachmentId}`}>Download</a></td></tr>)}
      </tbody></table></div>
    ) : <p className="empty">Technical documents, datasheets and certificates shared with your company appear here.</p>;
  } else if (current === 'messages') {
    const msgs = await db.select().from(s.messages).where(eq(s.messages.companyId, cid)).orderBy(desc(s.messages.createdAt)).limit(100);
    body = (
      <>
        <section className="form-section"><h2>Contact the sales team</h2><MessageForm locale={locale} inquiries={inquiries.map((i) => ({ id: i.id, reference: i.reference }))} /></section>
        <section className="block" aria-label="Message history">
          {msgs.length ? msgs.map((m) => (
            <div key={m.id} className={`msg${m.fromStaff ? ' msg--staff' : ''}`}>
              <p className="msg__meta">{m.fromStaff ? 'Monolith Sports' : 'You'}, {fmtDate(m.createdAt)}{m.inquiryId ? `, ${inquiries.find((i) => i.id === m.inquiryId)?.reference ?? ''}` : ''}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
            </div>
          )) : <p className="empty">No messages yet.</p>}
        </section>
      </>
    );
  } else if (current === 'company') {
    body = <CompanyForm locale={locale} company={{ name: company.name, country: company.country, website: company.website, address: company.address, phone: company.phone, preferredCurrency: company.preferredCurrency }} />;
  }

  function requestTable(list: typeof inquiries) {
    if (!list.length) return <div className="empty"><p>No requests yet.</p><a className="btn btn--secondary" href={`/${locale}/inquiry`}>Request a quotation</a></div>;
    return (
      <div className="table-wrap"><table className="data"><thead><tr><th>Reference</th><th>Type</th><th>Sent</th><th>Status</th></tr></thead><tbody>
        {list.map((i) => <tr key={i.id}><td>{i.reference}</td><td>{TYPE_LABEL[i.type] ?? asWord(i.type)}</td><td>{fmtDate(i.createdAt)}</td><td><span className="pill-status">{STATUS_LABEL[i.status] ?? i.status}</span></td></tr>)}
      </tbody></table></div>
    );
  }

  return (
    <PageShell locale={locale} crumbs={[{ name: 'Account', path: '/account' }, ...(current ? [{ name: TITLES[current], path: `/account/${current}` }] : [])]} close={null}>
      <div className="portal">
        <nav className="portal__nav" aria-label="Account">
          {nav.map((n) => <a key={n} href={`/${locale}/account${n ? '/' + n : ''}`} aria-current={n === current ? 'page' : undefined}>{n ? TITLES[n] : 'Overview'}</a>)}
          <form action={logout}><input type="hidden" name="locale" value={locale} /><button className="btn-text" type="submit">Sign out</button></form>
        </nav>
        <div className="block">
          <header className="page-head"><h1>{TITLES[current]}</h1><p>{company.name}, {user.email}</p></header>
          {body}
        </div>
      </div>
    </PageShell>
  );
}
