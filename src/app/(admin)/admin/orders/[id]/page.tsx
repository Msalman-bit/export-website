import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { STATUS_LABEL, ORDER_STEPS } from '@/lib/status';
import { Flash, Status, day, money, type SP } from '../../ui';
import { setOrderStatus, addShipment, addInvoice, setInvoiceStatus } from '../../actions';

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const u = await requireStaff('orders.read');
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id)).limit(1);
  if (!o) notFound();
  const [company] = o.companyId ? await db.select().from(s.companies).where(eq(s.companies.id, o.companyId)).limit(1) : [];
  const [inq] = o.inquiryId ? await db.select().from(s.inquiries).where(eq(s.inquiries.id, o.inquiryId)).limit(1) : [];
  const ships = await db.select().from(s.shipments).where(eq(s.shipments.orderId, id));
  const invs = await db.select().from(s.invoices).where(eq(s.invoices.orderId, id));
  const step = ORDER_STEPS.indexOf(o.status);
  return (
    <>
      <div className="admin-head"><div><p className="t-small muted"><a className="link" href="/admin/orders">Orders</a></p><h1>Order {o.number}</h1></div><Status value={o.status} /></div>
      <Flash sp={sp} />
      <div className="cols-2">
        <div className="block">
          <section className="panel-box"><h2>{company?.name}</h2>
            <p>{money(o.total, o.currency)} · created {day(o.createdAt)}{inq ? <> · from <a className="link" href={`/admin/inquiries/${inq.id}`}>{inq.reference}</a></> : null}</p>
            <ol className="timeline">{ORDER_STEPS.map((st, i) => <li key={st} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}><span>{STATUS_LABEL[st]}</span></li>)}</ol>
          </section>
          <section className="panel-box"><h2>Shipments</h2>
            {ships.map((x) => <p key={x.id}>{x.method} {x.carrier} · {x.trackingNumber} · shipped {x.shippedAt || 'not yet'} · ETA {x.eta || 'unknown'} {x.trackingUrl ? <a className="link" href={x.trackingUrl} target="_blank" rel="noopener noreferrer">Track</a> : null}</p>)}
            {can(u.role, 'shipping.write') ? (
              <form action={addShipment} className="form-grid"><input type="hidden" name="orderId" value={o.id} />
                <div className="field"><label htmlFor="method">Method</label><select id="method" name="method"><option>Sea freight</option><option>Air freight</option><option>Courier</option></select></div>
                <div className="field"><label htmlFor="carrier">Carrier</label><input id="carrier" name="carrier" /></div>
                <div className="field"><label htmlFor="trackingNumber">Tracking number</label><input id="trackingNumber" name="trackingNumber" /></div>
                <div className="field"><label htmlFor="trackingUrl">Tracking link (https)</label><input id="trackingUrl" name="trackingUrl" type="url" /></div>
                <div className="field"><label htmlFor="shippedAt">Shipped on</label><input id="shippedAt" name="shippedAt" type="date" /></div>
                <div className="field"><label htmlFor="eta">Expected arrival</label><input id="eta" name="eta" type="date" /></div>
                <div className="full"><button className="btn btn--secondary" type="submit">Add the shipment</button></div>
              </form>
            ) : null}
          </section>
          <section className="panel-box"><h2>Invoices</h2>
            {invs.map((x) => (
              <div key={x.id} className="inline-form"><span>{x.number} · {money(x.amount, x.currency)} · due {x.dueAt || 'on receipt'} · <a className="link" href={`/api/portal/invoices/${x.id}`}>PDF</a></span>
                {can(u.role, 'orders.write') ? <form action={setInvoiceStatus} className="inline-form"><input type="hidden" name="id" value={x.id} /><label className="sr-only" htmlFor={`st-${x.id}`}>Invoice status</label><select id={`st-${x.id}`} name="status" defaultValue={x.status}><option>issued</option><option>paid</option><option>void</option></select><button className="btn-text" type="submit">Save</button></form> : null}</div>
            ))}
            {can(u.role, 'orders.write') ? (
              <form action={addInvoice} className="form-grid"><input type="hidden" name="orderId" value={o.id} />
                <div className="field"><label htmlFor="amount">Amount ({o.currency})</label><input id="amount" name="amount" inputMode="decimal" /></div>
                <div className="field"><label htmlFor="dueAt">Due date</label><input id="dueAt" name="dueAt" type="date" /></div>
                <div className="field field--full"><label htmlFor="inotes">Notes</label><input id="inotes" name="notes" placeholder="" /></div>
                <div className="full"><button className="btn btn--secondary" type="submit">Issue the invoice</button></div>
              </form>
            ) : null}
          </section>
        </div>
        {can(u.role, 'production.write') ? (
          <section className="panel-box"><h2>Production stage</h2>
            <form action={setOrderStatus} className="block"><input type="hidden" name="id" value={o.id} />
              <div className="field"><label htmlFor="status">Stage</label><select id="status" name="status" defaultValue={o.status}>{ORDER_STEPS.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}</select></div>
              <div className="field"><label htmlFor="note">Note for the customer</label><textarea id="note" name="note" /></div>
              <label className="chk"><input type="checkbox" name="notify" defaultChecked /> Email the customer</label>
              <button className="btn btn--primary" type="submit">Update the stage</button>
            </form>
          </section>
        ) : null}
      </div>
    </>
  );
}
