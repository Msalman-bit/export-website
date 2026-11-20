'use client';
import { useEffect, useRef, useState } from 'react';
import { readBasket, writeBasket, clearBasket, type BasketItem } from '@/lib/basket';
import { COUNTRIES } from '@/lib/inquiry/countries';

type Mode = 'quote' | 'sample' | 'contact' | 'distributor' | 'partnership';

const BUTTON: Record<Mode, string> = {
  quote: 'Request a quote', sample: 'Request a sample', contact: 'Send the message',
  distributor: 'Send the distributor application', partnership: 'Send the partnership inquiry',
};

/* The consolidated inquiry: the list of products (quantity and notes per line), the company and
   delivery details, branding, packaging and files, sent as one request. Errors show under each field;
   the first one takes the focus; nothing typed is lost when sending fails. */
export function InquiryForm({ locale, mode: initialMode, currencies, user, turnstileKey }: {
  locale: string; mode: Mode; currencies: string[];
  user?: { company: string; name: string; email: string; country: string } | null;
  turnstileKey?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const withProducts = mode === 'quote' || mode === 'sample';

  useEffect(() => {
    const sync = () => { setItems(readBasket()); setLoaded(true); };
    sync();
    window.addEventListener('ms-basket', sync);
    return () => window.removeEventListener('ms-basket', sync);
  }, []);

  const update = (key: string, patch: Partial<BasketItem>) => {
    const next = items.map((i) => (i.key === key ? { ...i, ...patch } : i));
    setItems(next); writeBasket(next);
  };
  // a removed product fades and its row closes up first (CSS .is-leaving, 200ms); then it leaves the list and the
  // stored basket (which fires ms-basket and re-reads the list)
  const [leaving, setLeaving] = useState<string[]>([]);
  const remove = (key: string) => {
    if (leaving.includes(key)) return;
    setLeaving((l) => [...l, key]);
    setTimeout(() => {
      setItems((cur) => { const next = cur.filter((i) => i.key !== key); writeBasket(next); return next; });
      setLeaving((l) => l.filter((k) => k !== key));
    }, 200);
  };

  const err = (name: string) => (errors[name] ? { 'aria-invalid': 'true' as const, 'aria-describedby': `${name}-err` } : {});
  const errLine = (name: string) => (errors[name] ? <p className="err" id={`${name}-err`}>{errors[name]}</p> : null);

  const validate = (fd: FormData): Record<string, string> => {
    const e: Record<string, string> = {};
    if (String(fd.get('companyName') || '').trim().length < 2) e.companyName = 'Write your company name.';
    if (String(fd.get('contactName') || '').trim().length < 2) e.contactName = 'Write the name we should reply to.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fd.get('email') || '').trim())) e.email = 'Write a business email with an @, like name@club.com.';
    if (!fd.get('country')) e.country = 'Choose the destination country.';
    const msg = String(fd.get('message') || '').trim();
    if (withProducts && items.length === 0 && msg.length < 10) e.message = 'Add products to your list, or describe what you need in a sentence or two.';
    if (!withProducts && msg.length < 10) e.message = 'Write your message in a sentence or two.';
    items.forEach((i, n) => { if (!Number.isInteger(i.quantity) || i.quantity < 1) e[`items.${n}.quantity`] = 'Write a quantity of 1 or more.'; });
    const files = fd.getAll('files').filter((f) => f instanceof File && f.size > 0) as File[];
    if (files.length > 5) e.files = 'Attach at most 5 files.';
    if (files.some((f) => f.size > 10 * 1024 * 1024)) e.files = 'Each file must be 10 MB or smaller.';
    return e;
  };

  /* Inline checks (not only on send): a field is checked as the visitor leaves it, once they have typed in it
     or changed it, and a shown error updates or clears the moment it is fixed. A field that was only passed
     through is never marked, so an empty form is not scolded before anyone has started. */
  const touched = useRef(new Set<string>());
  const recheck = (also: string[] = []) => {
    if (!formRef.current) return;
    const e = validate(new FormData(formRef.current));
    const next: Record<string, string> = {};
    for (const k of [...Object.keys(errors), ...also]) if (e[k]) next[k] = e[k];
    setErrors(next);
    // the count under the form follows the fixes ("3 fields to fix.", then nothing once all are right)
    const n = Object.keys(next).length;
    if (/to fix|needs a change/.test(status)) setStatus(n === 0 ? '' : n === 1 ? '1 field to fix.' : `${n} fields to fix.`);
  };
  const leave = (ev: React.FocusEvent<HTMLFormElement>) => {
    const name = (ev.target as unknown as HTMLInputElement).name;
    if (name && name !== 'mode' && touched.current.has(name)) recheck([name]);
  };
  const edit = (ev: React.FormEvent<HTMLFormElement>) => {
    const name = (ev.target as unknown as HTMLInputElement).name;
    if (!name || name === 'mode') return;
    touched.current.add(name);
    if (Object.keys(errors).length) recheck();
  };
  // a product quantity changes the list (state), not a form field: an error on it is rechecked once it has
  useEffect(() => { if (Object.keys(errors).some((k) => k.startsWith('items.'))) recheck(); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusFirst = (e: Record<string, string>) => {
    const first = Object.keys(e)[0];
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"], #${CSS.escape(first.replace(/\./g, '-'))}`);
    el?.focus();
  };

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (busy) return;
    const fd = new FormData(ev.currentTarget);
    const e = validate(fd);
    setErrors(e);
    if (Object.keys(e).length) {
      setStatus(Object.keys(e).length === 1 ? '1 field to fix.' : `${Object.keys(e).length} fields to fix.`);
      focusFirst(e);
      return;
    }
    fd.set('type', mode);
    fd.set('locale', locale);
    fd.set('sourcePage', location.pathname);
    fd.set('elapsed', String(Math.max(0, Date.now() - started.current))); // timed on this computer's clock only
    fd.set('items', JSON.stringify(withProducts ? items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, notes: i.notes, sample: mode === 'sample' || !!i.sample, customisation: i.customisation ?? null })) : []));
    // logos placed in the studio travel with their design as PNG attachments
    if (withProducts) {
      for (const i of items) {
        try {
          const data = localStorage.getItem(`ms_logo_${i.key}`);
          if (data && fd.getAll('files').filter((x) => x instanceof File && x.size > 0).length < 5) {
            const blob = await (await fetch(data)).blob();
            fd.append('files', new File([blob], `logo-${(i.sku || 'design').toLowerCase()}.png`, { type: 'image/png' }));
          }
        } catch { /* the logo can still be attached by hand */ }
      }
    }
    setBusy(true);
    const wait = setTimeout(() => setStatus('Sending'), 300);
    try {
      const res = await fetch('/api/inquiries', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      clearTimeout(wait);
      if (res.ok && data.reference) {
        if (withProducts) { items.forEach((i) => { try { localStorage.removeItem(`ms_logo_${i.key}`); } catch { /* none */ } }); clearBasket(); }
        location.assign(`/${locale}/inquiry/sent?ref=${encodeURIComponent(data.reference)}&type=${encodeURIComponent(data.type || mode)}`);
        return;
      }
      if (data.errors) { setErrors(data.errors); setStatus('The form needs a change before it can be sent.'); focusFirst(data.errors); }
      else setStatus(data.error || 'Not sent: the server did not answer. Your words are still here; try again.');
    } catch {
      clearTimeout(wait);
      setStatus('Not sent: the connection failed. Your words are still here; try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} className="block" onSubmit={submit} onBlur={leave} onInput={edit} noValidate>
      {initialMode === 'quote' || initialMode === 'sample' ? (
        <fieldset className="seg" aria-label="Request type">
          <label><input type="radio" name="mode" value="quote" checked={mode === 'quote'} onChange={() => setMode('quote')} /><span>Quotation for a bulk order</span></label>
          <label><input type="radio" name="mode" value="sample" checked={mode === 'sample'} onChange={() => setMode('sample')} /><span>Samples first</span></label>
        </fieldset>
      ) : null}

      {withProducts ? (
        <section className="form-section" aria-labelledby="list-h">
          <h2 id="list-h">Products</h2>
          {!loaded ? null : items.length === 0 ? (
            <div className="empty">
              <p>Your inquiry list is empty. Add products from the catalogue, or describe what you need in the message below.</p>
              <a className="btn btn--secondary" href={`/${locale}/products`}>See the catalogue</a>
            </div>
          ) : (
            <ul className="basket">
              {items.map((i, n) => (
                <li key={i.key} className={leaving.includes(i.key) ? 'is-leaving' : undefined}>
                  {i.image ? <img src={i.image} alt="" width={88} height={88} /> : <span />}
                  <div>
                    <p className="basket__name">{i.href ? <a href={i.href}>{i.name}</a> : i.name}</p>
                    <p className="basket__meta">{[i.sku, i.sample ? 'Sample first' : '', i.customisation ? 'Studio design attached' : ''].filter(Boolean).join(' · ')}</p>
                    <div className="field">
                      <label htmlFor={`items-${n}-notes`}>Notes for this product</label>
                      <input id={`items-${n}-notes`} type="text" value={i.notes} maxLength={500} onChange={(e) => update(i.key, { notes: e.target.value })} />
                    </div>
                  </div>
                  <div className="field basket__qty">
                    <label htmlFor={`items-${n}-quantity`}>Quantity</label>
                    <input id={`items-${n}-quantity`} type="text" inputMode="numeric" value={String(i.quantity || '')}
                      onChange={(e) => update(i.key, { quantity: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} {...err(`items.${n}.quantity`)} />
                    {errLine(`items.${n}.quantity`)}
                  </div>
                  <button type="button" className="btn-text basket__rm" onClick={() => remove(i.key)}>Remove<span className="sr-only"> {i.name}</span></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="form-section" aria-labelledby="who-h">
        <h2 id="who-h">Your company</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="companyName">Company name</label>
            <input id="companyName" name="companyName" type="text" autoComplete="organization" defaultValue={user?.company} required {...err('companyName')} />{errLine('companyName')}</div>
          <div className="field"><label htmlFor="contactName">Contact name</label>
            <input id="contactName" name="contactName" type="text" autoComplete="name" defaultValue={user?.name} required {...err('contactName')} />{errLine('contactName')}</div>
          <div className="field"><label htmlFor="email">Business email</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={user?.email} required {...err('email')} />{errLine('email')}</div>
          <div className="field"><label htmlFor="phone">Phone number <span className="hint">(optional)</span></label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" {...err('phone')} />{errLine('phone')}</div>
          <div className="field"><label htmlFor="country">{withProducts ? 'Destination country' : 'Country'}</label>
            <select id="country" name="country" defaultValue={user?.country ?? ''} required {...err('country')}>
              <option value="" disabled>Choose a country</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>{errLine('country')}</div>
          {withProducts ? (
            <div className="field"><label htmlFor="currency">Quotation currency</label>
              <select id="currency" name="currency" defaultValue={currencies[0]}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          ) : null}
        </div>
      </section>

      {withProducts ? (
        <section className="form-section" aria-labelledby="spec-h">
          <h2 id="spec-h">Branding, packing and delivery</h2>
          <div className="form-grid">
            <div className="field field--full"><label htmlFor="branding">Custom branding <span className="hint">(logo placement, methods, colours)</span></label>
              <textarea id="branding" name="branding" maxLength={2000} /></div>
            <div className="field field--full"><label htmlFor="packaging">Packaging <span className="hint">(polybag, retail box, bulk carton, barcodes)</span></label>
              <textarea id="packaging" name="packaging" maxLength={2000} /></div>
            <div className="field"><label htmlFor="targetDate">Target delivery date <span className="hint">(optional)</span></label>
              <input id="targetDate" name="targetDate" type="date" {...err('targetDate')} />{errLine('targetDate')}</div>
            <div className="field"><label htmlFor="shippingMethod">Preferred shipping</label>
              <select id="shippingMethod" name="shippingMethod" defaultValue="">
                <option value="">No preference</option><option value="sea">Sea freight</option><option value="air">Air freight</option><option value="courier">Courier</option>
              </select></div>
            <div className="field field--full"><label htmlFor="files">Logo, artwork or brief <span className="hint">(PDF, AI, EPS, PNG, JPG or WEBP; up to 5 files of 10 MB)</span></label>
              <input id="files" name="files" type="file" multiple accept=".pdf,.ai,.eps,.png,.jpg,.jpeg,.webp" {...err('files')} />{errLine('files')}</div>
          </div>
        </section>
      ) : null}

      <section className="form-section" aria-labelledby="msg-h">
        <h2 id="msg-h">{withProducts ? 'Anything else' : 'Your message'}</h2>
        <div className="field field--full"><label htmlFor="message">{withProducts ? 'Additional requirements' : mode === 'distributor' ? 'Your region, customers and the products you want to carry' : 'Message'}</label>
          <textarea id="message" name="message" maxLength={5000} rows={6} {...err('message')} />{errLine('message')}</div>
        <div className="newsletter__trap" aria-hidden="true"><label htmlFor="company_website">Website</label><input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" /></div>
        {turnstileKey ? <div className="cf-turnstile" data-sitekey={turnstileKey} /> : null}
        {errors.form ? <p className="err">{errors.form}</p> : null}
        <div className="btn-row"><button className="btn btn--primary" type="submit" aria-busy={busy || undefined} disabled={busy}>{BUTTON[mode]}</button></div>
        <p className="status-line" role="status">{status}</p>
        <p className="t-small muted">You get a reference number at once and a copy by email. We use these details only to answer this request (<a className="link" href={`/${locale}/privacy`}>privacy policy</a>).</p>
      </section>
    </form>
  );
}
