import { notFound } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { STATUS_LABEL, allowedNext } from '@/lib/status';
import { countryName } from '@/lib/inquiry/countries';
import { getSettings } from '@/lib/data';
import { hasPasskeyHere } from '@/lib/auth/passkey-request';
import { Flash, Status, fmt, money, type SP } from '../../ui';
import { PasskeyConfirm } from '../../forms';
import { setInquiryStatus, addInquiryNote, assignInquiry, linkCompany, saveQuotation, sendQuotationAction, setQuotationOutcome, deleteQuotation, deleteInquiry, createOrder, sendStaffMessage } from '../../actions';

export default async function InquiryDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const u = await requireStaff('inquiries.read');
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [inq] = await db.select().from(s.inquiries).where(eq(s.inquiries.id, id)).limit(1);
  if (!inq) notFound();
  const [items, files, history, quotes, staff, settings] = await Promise.all([
    db.select().from(s.inquiryItems).where(eq(s.inquiryItems.inquiryId, id)),
    db.select().from(s.attachments).where(and(eq(s.attachments.ownerType, 'inquiry'), eq(s.attachments.ownerId, id))),
    db.select().from(s.inquiryEvents).where(eq(s.inquiryEvents.inquiryId, id)).orderBy(desc(s.inquiryEvents.createdAt)),
    db.select().from(s.quotations).where(eq(s.quotations.inquiryId, id)).orderBy(asc(s.quotations.createdAt)),
    db.select({ id: s.users.id, name: s.users.name, email: s.users.email }).from(s.users).where(eq(s.users.kind, 'staff')),
    getSettings(),
  ]);
  const draft = quotes.find((q) => q.status === 'draft');
  const write = can(u.role, 'inquiries.write');
  const qw = can(u.role, 'quotations.write');
  const qd = can(u.role, 'quotations.delete');
  const del = can(u.role, 'inquiries.delete');
  const [order] = del ? await db.select({ number: s.orders.number }).from(s.orders).where(eq(s.orders.inquiryId, id)).limit(1) : [];
  const live = quotes.find((q) => q.status === 'sent' || q.status === 'accepted');
  const blocked = order ? `Order ${order.number} was made from this inquiry, so it can’t be deleted: orders and invoices stay on record.`
    : live ? `Quotation ${live.number} is ${live.status}, so this inquiry can’t be deleted${live.status === 'sent' ? '. Mark the quotation declined first' : ''}.` : '';
  const lines = draft?.lines ?? items.map((i) => ({ description: i.productName + (i.notes ? ` (${i.notes})` : ''), sku: i.sku, quantity: i.quantity, unitPrice: '' }));
  const validDefault = new Date(Date.now() + settings.quotation.validityDays * 86400_000).toISOString().slice(0, 10);
  const messages = inq.companyId ? await db.select().from(s.messages).where(eq(s.messages.companyId, inq.companyId)).orderBy(desc(s.messages.createdAt)).limit(30) : [];

  return (
    <>
      <div className="admin-head">
        <div><p className="t-small muted"><a className="link" href="/admin/inquiries">Inquiries</a></p><h1>{inq.reference}</h1></div>
        <Status value={inq.status} />
      </div>
      <Flash sp={sp} />
      <div className="cols-2">
        <div className="block">
          <section className="panel-box">
            <h2>{inq.companyName}</h2>
            <table className="spec-table"><tbody>
              <tr><th>Contact</th><td>{inq.contactName} · <a className="link" href={`mailto:${inq.email}`}>{inq.email}</a>{inq.phone ? ` · ${inq.phone}` : ''}</td></tr>
              <tr><th>Type</th><td>{inq.type}</td></tr>
              <tr><th>Destination</th><td>{countryName(inq.country)} · quote in {inq.currency}</td></tr>
              <tr><th>Delivery</th><td>{[inq.shippingMethod && `${inq.shippingMethod} freight`, inq.targetDate && `needed by ${inq.targetDate}`].filter(Boolean).join(' · ') || 'No preference given'}</td></tr>
              {inq.branding ? <tr><th>Branding</th><td style={{ whiteSpace: 'pre-wrap' }}>{inq.branding}</td></tr> : null}
              {inq.packaging ? <tr><th>Packaging</th><td style={{ whiteSpace: 'pre-wrap' }}>{inq.packaging}</td></tr> : null}
              {inq.message ? <tr><th>Message</th><td style={{ whiteSpace: 'pre-wrap' }}>{inq.message}</td></tr> : null}
              <tr><th>Received</th><td>{fmt(inq.createdAt)} · {inq.locale.toUpperCase()} · {inq.sourcePage}</td></tr>
            </tbody></table>
          </section>
          <section className="panel-box"><h2>Products ({items.length})</h2>
            <div className="table-wrap"><table className="data"><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Notes and design</th></tr></thead><tbody>
              {items.map((i) => <tr key={i.id}><td>{i.productName}</td><td>{i.sku}</td><td>{i.quantity.toLocaleString('en-GB')}</td><td>{i.notes}{i.customisation ? <><br /><span className="t-small">{Object.entries(i.customisation).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</span></> : null}</td></tr>)}
              {!items.length ? <tr><td colSpan={4}>No product lines: see the message.</td></tr> : null}
            </tbody></table></div>
            {files.length ? <><h3>Files</h3><ul>{files.map((f) => <li key={f.id}><a className="link" href={`/media/${f.id}`}>{f.filename}</a> ({Math.round(f.size / 1024)} KB)</li>)}</ul></> : null}
          </section>

          {qw ? (
            <section className="panel-box"><h2>{draft ? `Quotation ${draft.number} (draft)` : 'Prepare a quotation'}</h2>
              <form action={saveQuotation} className="block">
                <input type="hidden" name="inquiryId" value={inq.id} />{draft ? <input type="hidden" name="quotationId" value={draft.id} /> : null}
                <div className="table-wrap"><table className="data qlines"><thead><tr><th>Description</th><th>SKU</th><th>Quantity</th><th>Unit price</th></tr></thead><tbody>
                  {[...lines, { description: '', sku: '', quantity: 0, unitPrice: '' }, { description: '', sku: '', quantity: 0, unitPrice: '' }].map((l, n) => (
                    <tr key={n}>
                      <td><input aria-label={`Line ${n + 1} description`} name="l_desc" defaultValue={l.description} /></td>
                      <td><input aria-label={`Line ${n + 1} SKU`} name="l_sku" defaultValue={l.sku} style={{ width: 130 }} /></td>
                      <td><input aria-label={`Line ${n + 1} quantity`} name="l_qty" inputMode="numeric" defaultValue={l.quantity || ''} style={{ width: 90 }} /></td>
                      <td><input aria-label={`Line ${n + 1} unit price`} name="l_price" inputMode="decimal" defaultValue={l.unitPrice} style={{ width: 110 }} /></td>
                    </tr>
                  ))}
                </tbody></table></div>
                <div className="form-grid">
                  <div className="field"><label htmlFor="currency">Currency</label><select id="currency" name="currency" defaultValue={draft?.currency ?? inq.currency}>{settings.currencies.enabled.map((c) => <option key={c}>{c}</option>)}</select></div>
                  <div className="field"><label htmlFor="shippingCost">Shipping cost</label><input id="shippingCost" name="shippingCost" inputMode="decimal" defaultValue={draft?.shippingCost ?? ''} /></div>
                  <div className="field"><label htmlFor="paymentTerms">Payment terms</label><input id="paymentTerms" name="paymentTerms" defaultValue={draft?.paymentTerms ?? settings.quotation.paymentTerms} /></div>
                  <div className="field"><label htmlFor="incoterm">Delivery terms (Incoterm)</label><input id="incoterm" name="incoterm" defaultValue={draft?.incoterm ?? settings.quotation.incoterm} /></div>
                  <div className="field"><label htmlFor="leadTime">Production lead time</label><input id="leadTime" name="leadTime" defaultValue={draft?.leadTime ?? ''} /></div>
                  <div className="field"><label htmlFor="validUntil">Valid until</label><input id="validUntil" name="validUntil" type="date" defaultValue={draft?.validUntil || validDefault} /></div>
                  <div className="field field--full"><label htmlFor="qnotes">Notes on the quotation</label><textarea id="qnotes" name="notes" defaultValue={draft?.notes ?? ''} /></div>
                </div>
                <div className="btn-row"><button className="btn btn--primary" type="submit">Save the draft</button>{draft ? <a className="btn btn--secondary" href={`/api/portal/quotations/${draft.id}`}>Preview the PDF</a> : null}</div>
              </form>
              {draft ? <form action={sendQuotationAction}><input type="hidden" name="quotationId" value={draft.id} /><button className="btn btn--secondary" type="submit">Send {draft.number} to {inq.email}</button></form> : null}
              {draft && qd ? <DeleteQuotation q={draft} /> : null}
            </section>
          ) : null}

          {quotes.filter((q) => q.status !== 'draft').map((q) => (
            <section className="panel-box" key={q.id}>
              <h2>Quotation {q.number}: {q.status}</h2>
              <p>{money(q.total, q.currency)} · sent {fmt(q.sentAt)} · <a className="link" href={`/api/portal/quotations/${q.id}`}>PDF</a></p>
              {qw && q.status === 'sent' ? (
                <div className="btn-row">
                  <form action={createOrder}><input type="hidden" name="quotationId" value={q.id} /><button className="btn btn--primary" type="submit">Accepted: create the order</button></form>
                  <form action={setQuotationOutcome}><input type="hidden" name="quotationId" value={q.id} /><input type="hidden" name="outcome" value="declined" /><button className="btn btn--secondary" type="submit">Mark declined</button></form>
                </div>
              ) : null}
              {qd && q.status === 'declined' ? <DeleteQuotation q={q} /> : null}
            </section>
          ))}
        </div>

        <div className="block">
          {write ? (
            <section className="panel-box"><h2>Status</h2>
              <form action={setInquiryStatus} className="block">
                <input type="hidden" name="id" value={inq.id} />
                <div className="field"><label htmlFor="status">Move to</label><select id="status" name="status" defaultValue="">
                  <option value="" disabled>Choose the next stage</option>{allowedNext(inq.status).map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}</select></div>
                <div className="field"><label htmlFor="note">Note</label><textarea id="note" name="note" /></div>
                <label className="chk"><input type="checkbox" name="notify" /> Email the customer and show the note in their account</label>
                <button className="btn btn--primary" type="submit">Update the status</button>
              </form>
            </section>
          ) : null}
          {write ? (
            <section className="panel-box"><h2>Owner</h2>
              <form action={assignInquiry} className="inline-form"><input type="hidden" name="id" value={inq.id} />
                <label className="sr-only" htmlFor="assignedTo">Owner</label>
                <select id="assignedTo" name="assignedTo" defaultValue={inq.assignedTo ?? ''}><option value="">Nobody</option>{staff.map((st) => <option key={st.id} value={st.id}>{st.name || st.email}</option>)}</select>
                <button className="btn btn--secondary" type="submit">Assign</button></form>
              {!inq.companyId ? <form action={linkCompany}><input type="hidden" name="id" value={inq.id} /><button className="btn-text" type="submit">Create the customer company from this inquiry</button></form>
                : <p className="t-small"><a className="link" href={`/admin/customers/${inq.companyId}`}>Open the customer</a></p>}
            </section>
          ) : null}
          {inq.companyId && write ? (
            <section className="panel-box"><h2>Message the customer</h2>
              <form action={sendStaffMessage} className="block"><input type="hidden" name="companyId" value={inq.companyId} /><input type="hidden" name="inquiryId" value={inq.id} /><input type="hidden" name="return" value={`/admin/inquiries/${inq.id}`} />
                <div className="field"><label htmlFor="mbody">Message</label><textarea id="mbody" name="body" /></div><button className="btn btn--secondary" type="submit">Send</button></form>
              {messages.map((m) => <div key={m.id} className={`msg${m.fromStaff ? ' msg--staff' : ''}`}><p className="msg__meta">{m.fromStaff ? 'Monolith' : 'Customer'} · {fmt(m.createdAt)}</p><p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p></div>)}
            </section>
          ) : null}
          <section className="panel-box"><h2>History</h2>
            {write ? <form action={addInquiryNote} className="block"><input type="hidden" name="id" value={inq.id} /><div className="field"><label htmlFor="nbody">Internal note</label><textarea id="nbody" name="body" /></div><button className="btn btn--secondary" type="submit">Add the note</button></form> : null}
            <ol className="timeline">{history.map((h) => (
              <li key={h.id} className="is-done"><span><strong>{h.kind === 'status' ? `${STATUS_LABEL[h.fromStatus ?? ''] ?? h.fromStatus ?? ''} → ${STATUS_LABEL[h.toStatus ?? ''] ?? h.toStatus}` : h.kind}</strong>{h.visibleToCustomer ? ' · shown to customer' : ''}<br /><span className="t-small muted">{fmt(h.createdAt)}</span>{h.body ? <><br />{h.body}</> : null}</span></li>
            ))}</ol>
          </section>
          {del ? <DeleteInquiry inq={inq} items={items.length} files={files.length} quotes={quotes.length} blocked={blocked} passkey={await hasPasskeyHere(u.id)} /> : null}
        </div>
      </div>
    </>
  );
}

/* Deleting a quotation takes two steps: "Delete…" opens the warning, and only its own button deletes. The form
   carries the quotation's number as the confirmation the server checks (deleteQuotation in ../../actions). It is a
   native disclosure, so it works without script and closes again with the same button. */
function DeleteQuotation({ q }: { q: { id: string; number: string; status: string } }) {
  return (
    <details className="danger-zone">
      <summary className="btn btn--quiet-danger">Delete…</summary>
      <div className="danger-zone__body" role="group" aria-label={`Delete quotation ${q.number}`}>
        <p><strong>Delete quotation {q.number}? This can’t be undone.</strong></p>
        <p className="t-small">
          {q.status === 'draft' ? 'The draft has not been sent.' : 'The buyer was sent this quotation and declined it; it will disappear from their portal.'}
          {' '}The audit log keeps a record of who deleted it and when, with its number and total.
        </p>
        <form action={deleteQuotation} className="btn-row">
          <input type="hidden" name="quotationId" value={q.id} />
          <input type="hidden" name="confirm" value={q.number} />
          <button className="btn btn--danger" type="submit">Delete {q.number}</button>
        </form>
      </div>
    </details>
  );
}

/* Deleting an inquiry (administrators only) takes two steps: "Delete…" opens the warning, and its button deletes
   only with the six-digit code the administrator's authenticator app shows now. The server checks the code, the
   inquiry's own reference as the confirmation, and that no order or live quotation depends on it (deleteInquiry in
   ../../actions). A native disclosure: it works without script and closes again with the same button. */
function DeleteInquiry({ inq, items, files, quotes, blocked, passkey }: { inq: { id: string; reference: string }; items: number; files: number; quotes: number; blocked: string; passkey: boolean }) {
  const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
  const parts = [n(items, 'product line'), files ? n(files, 'uploaded file') : '', 'its timeline', quotes ? n(quotes, 'draft or declined quotation') : ''].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return (
    <section className="panel-box"><h2>Delete the inquiry</h2>
      {blocked ? <p className="t-small">{blocked}</p> : (
        <details className="danger-zone">
          <summary className="btn btn--quiet-danger">Delete…</summary>
          <div className="danger-zone__body" role="group" aria-label={`Delete inquiry ${inq.reference}`}>
            <p><strong>Delete inquiry {inq.reference}? This can’t be undone.</strong></p>
            <p className="t-small">
              It removes the inquiry with {list}, and it disappears from the buyer’s account if they have one. Emails
              already sent stay in the email outbox, and the analytics counts stay as they are (only Reset the analytics
              changes them). The audit log keeps a record of who deleted it and when.
            </p>
            <form action={deleteInquiry} className="block">
              <input type="hidden" name="id" value={inq.id} />
              <input type="hidden" name="confirm" value={inq.reference} />
              <div className="field">
                <label htmlFor="delete-code">Code from your authenticator app</label>
                <input id="delete-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
              </div>
              <div className="btn-row"><button className="btn btn--danger" type="submit">Delete {inq.reference}</button></div>
              {passkey ? <PasskeyConfirm label={`Delete ${inq.reference} with a passkey`} /> : null}
            </form>
          </div>
        </details>
      )}
    </section>
  );
}
