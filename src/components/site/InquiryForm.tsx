'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { readBasket, writeBasket, clearBasket, readMode, writeMode, addToBasket, type BasketItem } from '@/lib/basket';
import { ProductPicker, type PickedProduct } from '@/components/site/ProductPicker';
import { COUNTRIES, isOfferedCountry } from '@/lib/inquiry/countries';
import { QuoteIcon } from '@/components/site/QuoteIcon';
import { clientTx } from '@/lib/i18n/fill';

type Mode = 'quote' | 'sample' | 'contact' | 'distributor' | 'partnership';

const BUTTON: Record<Mode, string> = {
  quote: 'Request a quotation', sample: 'Request a sample', contact: 'Send the message',
  distributor: 'Send the distributor application', partnership: 'Send the partnership inquiry',
};

/* The consolidated inquiry: the list of products (quantity and notes per line), the company and
   delivery details, branding, packaging and files, sent as one request. Errors show under each field;
   the first one takes the focus; nothing typed is lost when sending fails. */
export function InquiryForm({ locale, mode: initialMode, pickSaved = false, currencies, user, turnstileKey, text, countries = COUNTRIES }: {
  locale: string; mode: Mode; currencies: string[];
  /* the form's words in the page's language (English -> translation, from the server's formText); none in English */
  text?: Record<string, string>;
  /* the destination countries with their names in the page's language, in the same order */
  countries?: { code: string; name: string }[];
  /* the address named no type (/inquiry): the form opens on the type this browser last picked */
  pickSaved?: boolean;
  user?: { company: string; name: string; email: string; country: string } | null;
  turnstileKey?: string;
}) {
  const x = clientTx(text);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const withProducts = mode === 'quote' || mode === 'sample';
  // a line asks for a sample (one piece now; its quantity is the order expected later, optional) when the whole
  // request is "Samples first" or the product was added with "Request a sample"
  const asSample = (i: BasketItem) => mode === 'sample' || !!i.sample;

  useEffect(() => {
    const sync = () => { setItems(readBasket()); setLoaded(true); };
    sync();
    window.addEventListener('ms-basket', sync);
    return () => window.removeEventListener('ms-basket', sync);
  }, []);

  // the request type travels with the list: a link that names it (?type=sample) sets it; /inquiry alone reopens
  // the type picked last, so "Samples first" survives a trip to the catalogue and back
  useEffect(() => {
    if (initialMode !== 'quote' && initialMode !== 'sample') return;
    if (!pickSaved) { writeMode(initialMode); return; }
    const saved = readMode();
    if (saved) setMode(saved);
  }, [initialMode, pickSaved]);
  const pick = (m: 'quote' | 'sample') => { setMode(m); writeMode(m); };

  // a product found with "Add a product" joins the list here; its quantity starts empty (the buyer's own number, not
  // a guess) and the cursor goes to it. A product already on the list is not added twice: the cursor goes to its line
  const addPicked = (p: PickedProduct) => {
    if (!readBasket().some((i) => i.key === p.id)) {
      addToBasket({ productId: p.id, name: p.name, sku: p.sku, image: p.image ?? undefined, href: p.href, quantity: 0, notes: '' });
    }
    setTimeout(() => {
      const n = readBasket().findIndex((i) => i.key === p.id);
      if (n >= 0) document.getElementById(`items-${n}-quantity`)?.focus();
    }, 60);
  };

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
    if (String(fd.get('companyName') || '').trim().length < 2) e.companyName = x('Enter your company name.');
    if (String(fd.get('contactName') || '').trim().length < 2) e.contactName = x('Enter a contact name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fd.get('email') || '').trim())) e.email = x('Enter a business email address, for example name@club.com.');
    if (!fd.get('country')) e.country = x('Select the destination country.');
    const msg = String(fd.get('message') || '').trim();
    if (withProducts && items.length === 0 && msg.length < 10) e.message = x('Add products to your list, or describe your requirements in one or two sentences.');
    if (!withProducts && msg.length < 10) e.message = x('Describe your request in one or two sentences.');
    items.forEach((i, n) => { if (!asSample(i) && (!Number.isInteger(i.quantity) || i.quantity < 1)) e[`items.${n}.quantity`] = x('Enter a quantity of 1 or more.'); });
    const files = fd.getAll('files').filter((f) => f instanceof File && f.size > 0) as File[];
    if (files.length > 5) e.files = x('Attach at most 5 files.');
    if (files.some((f) => f.size > 10 * 1024 * 1024)) e.files = x('Each file must be 10 MB or smaller.');
    return e;
  };

  /* Inline checks (not only on send): a field is checked as the visitor leaves it, once they have typed in it
     or changed it, and a shown error updates or clears the moment it is fixed. A field that was only passed
     through is never marked, so an empty form is not scolded before anyone has started. */
  const touched = useRef(new Set<string>());
  // the status line is the count of fields to correct ("Please correct 3 fields.") while this is set
  const counting = useRef(false);
  const correct = (n: number) => (n === 1 ? x('Please correct 1 field.') : x('Please correct {n} fields.', { n }));
  const recheck = (also: string[] = []) => {
    if (!formRef.current) return;
    const e = validate(new FormData(formRef.current));
    const next: Record<string, string> = {};
    for (const k of [...Object.keys(errors), ...also]) if (e[k]) next[k] = e[k];
    setErrors(next);
    // the count under the form follows the fixes ("Please correct 3 fields.", then nothing once all are right)
    const n = Object.keys(next).length;
    if (counting.current) { setStatus(n === 0 ? '' : correct(n)); if (n === 0) counting.current = false; }
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
      setStatus(correct(Object.keys(e).length));
      counting.current = true;
      focusFirst(e);
      return;
    }
    fd.set('type', mode);
    fd.set('locale', locale);
    fd.set('sourcePage', location.pathname);
    fd.set('elapsed', String(Math.max(0, Date.now() - started.current))); // timed on this computer's clock only
    // a sample is one piece; the order the buyer expects later (if given) travels in the line's notes, so staff,
    // the e-mails and the documents read "1 pcs · Sample first · Expected order: 500 pcs"
    fd.set('items', JSON.stringify(withProducts ? items.map((i) => {
      const sample = asSample(i);
      const expected = sample && i.quantity > 0 ? `Expected order: ${i.quantity.toLocaleString('en-GB')} pcs` : '';
      return { productId: i.productId, name: i.name, quantity: sample ? 1 : i.quantity, notes: [expected, i.notes].filter(Boolean).join(' · ').slice(0, 500), sample, customisation: i.customisation ?? null };
    }) : []));
    // a studio design travels with its picture (JPEG) and its logo (PNG) as attachments, within the five files
    if (withProducts) {
      const room = () => fd.getAll('files').filter((x) => x instanceof File && x.size > 0).length < 5;
      for (const i of items) {
        const sku = (i.sku || 'design').toLowerCase();
        for (const [k, name, type] of [[`ms_preview_${i.key}`, `design-${sku}.jpg`, 'image/jpeg'], [`ms_logo_${i.key}`, `logo-${sku}.png`, 'image/png'], [`ms_net_${i.key}`, `pattern-${sku}.jpg`, 'image/jpeg']] as const) {
          try {
            const data = localStorage.getItem(k);
            if (data && room()) {
              const blob = await (await fetch(data)).blob();
              fd.append('files', new File([blob], name, { type }));
            }
          } catch { /* it can still be attached by hand */ }
        }
      }
    }
    setBusy(true);
    counting.current = false;
    const wait = setTimeout(() => setStatus(x('Sending')), 300);
    try {
      const res = await fetch('/api/inquiries', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      clearTimeout(wait);
      if (res.ok && data.reference) {
        if (withProducts) { items.forEach((i) => { try { localStorage.removeItem(`ms_logo_${i.key}`); localStorage.removeItem(`ms_preview_${i.key}`); localStorage.removeItem(`ms_net_${i.key}`); } catch { /* none */ } }); clearBasket(); writeMode(null); }
        location.assign(`/${locale}/inquiry/sent?ref=${encodeURIComponent(data.reference)}&type=${encodeURIComponent(data.type || mode)}`);
        return;
      }
      // the server's own lines (it checks again) are shown in the page's language where the form knows them
      if (data.errors) {
        const shown = Object.fromEntries(Object.entries(data.errors as Record<string, string>).map(([k, v]) => [k, x(String(v))]));
        setErrors(shown); setStatus(x('Please correct the marked fields before sending the form.')); counting.current = true; focusFirst(shown);
      }
      else setStatus(data.error ? x(String(data.error)) : x('Your request was not sent because the server did not respond. Your entries have been kept; please try again.'));
    } catch {
      clearTimeout(wait);
      setStatus(x('Your request was not sent because the connection failed. Your entries have been kept; please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} className="block" onSubmit={submit} onBlur={leave} onInput={edit} noValidate>
      {initialMode === 'quote' || initialMode === 'sample' ? (
        <fieldset className="seg" aria-label={x('Request type')}>
          <label><input type="radio" name="mode" value="quote" checked={mode === 'quote'} onChange={() => pick('quote')} /><span>{x('Quotation for a bulk order')}</span></label>
          <label><input type="radio" name="mode" value="sample" checked={mode === 'sample'} onChange={() => pick('sample')} /><span>{x('Samples first')}</span></label>
        </fieldset>
      ) : null}

      {withProducts ? (
        <section className="form-section" aria-labelledby="list-h">
          <h2 id="list-h">{x('Products')}</h2>
          <ProductPicker locale={locale} onPick={addPicked} text={text} />
          {!loaded ? null : items.length === 0 ? (
            <div className="basket__none">
              <p>{x('Your list is empty. Search above, or describe your requirements in the message below.')}</p>
              <a className="link" href={`/${locale}/products`}>{x('See the catalogue')}</a>
            </div>
          ) : (
            <ul className="basket">
              {items.map((i, n) => (
                <li key={i.key} className={leaving.includes(i.key) ? 'is-leaving' : undefined}>
                  {i.image ? <img src={i.image} alt="" width={88} height={88} /> : <span />}
                  <div>
                    <p className="basket__name">{i.href ? <a href={i.href}>{i.name}</a> : i.name}</p>
                    <p className="basket__meta">{[i.sku, asSample(i) ? x('Sample first') : '', i.customisation ? x('Studio design attached') : ''].filter(Boolean).join(', ')}</p>
                    <div className="field">
                      <label htmlFor={`items-${n}-notes`}>{x('Notes for this product')}</label>
                      <input id={`items-${n}-notes`} type="text" value={i.notes} maxLength={500} onChange={(e) => update(i.key, { notes: e.target.value })} />
                    </div>
                  </div>
                  <div className="field basket__qty">
                    <label htmlFor={`items-${n}-quantity`}>{asSample(i) ? <>{x('Expected order quantity')} <span className="hint">{x('(optional)')}</span></> : x('Quantity')}</label>
                    <input id={`items-${n}-quantity`} type="text" inputMode="numeric" value={String(i.quantity || '')}
                      onChange={(e) => update(i.key, { quantity: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} {...err(`items.${n}.quantity`)} />
                    {errLine(`items.${n}.quantity`)}
                  </div>
                  <button type="button" className="btn-text basket__rm" onClick={() => remove(i.key)}>{x('Remove')}<span className="sr-only"> {i.name}</span></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="form-section" aria-labelledby="who-h">
        <h2 id="who-h">{x('Your company')}</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="companyName">{x('Company name')}</label>
            <input id="companyName" name="companyName" type="text" autoComplete="organization" defaultValue={user?.company} required {...err('companyName')} />{errLine('companyName')}</div>
          <div className="field"><label htmlFor="contactName">{x('Contact name')}</label>
            <input id="contactName" name="contactName" type="text" autoComplete="name" defaultValue={user?.name} required {...err('contactName')} />{errLine('contactName')}</div>
          <div className="field"><label htmlFor="email">{x('Business email')}</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={user?.email} required {...err('email')} />{errLine('email')}</div>
          <div className="field"><label htmlFor="phone">{x('Phone number')} <span className="hint">{x('(optional)')}</span></label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" {...err('phone')} />{errLine('phone')}</div>
          <div className="field"><label htmlFor="country">{withProducts ? x('Destination country') : x('Country')}</label>
            <select id="country" name="country" defaultValue={user && isOfferedCountry(user.country) ? user.country : ''} required {...err('country')}>
              <option value="" disabled>{x('Select a country')}</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>{errLine('country')}</div>
          {withProducts ? (
            <div className="field"><label htmlFor="currency">{x('Quotation currency')}</label>
              <select id="currency" name="currency" defaultValue={currencies[0]}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          ) : null}
        </div>
      </section>

      {withProducts ? (
        <section className="form-section" aria-labelledby="spec-h">
          <h2 id="spec-h">{x('Branding, packaging and delivery')}</h2>
          <div className="form-grid">
            <div className="field field--full"><label htmlFor="branding">{x('Custom branding')} <span className="hint">{x('(logo placement, methods, colours)')}</span></label>
              <textarea id="branding" name="branding" maxLength={2000} /></div>
            <div className="field field--full"><label htmlFor="packaging">{x('Packaging')} <span className="hint">{x('(polybag, retail box, bulk carton, barcodes)')}</span></label>
              <textarea id="packaging" name="packaging" maxLength={2000} /></div>
            <div className="field"><label htmlFor="targetDate">{x('Target delivery date')} <span className="hint">{x('(optional)')}</span></label>
              <input id="targetDate" name="targetDate" type="date" {...err('targetDate')} />{errLine('targetDate')}</div>
            <div className="field"><label htmlFor="shippingMethod">{x('Preferred shipping method')}</label>
              <select id="shippingMethod" name="shippingMethod" defaultValue="">
                <option value="">{x('No preference')}</option><option value="sea">{x('Sea freight')}</option><option value="air">{x('Air freight')}</option><option value="courier">{x('Courier')}</option>
              </select></div>
            <div className="field field--full"><label htmlFor="files">{x('Logo, artwork or brief')} <span className="hint">{x('(PDF, AI, EPS, PNG, JPG or WEBP; up to 5 files, 10 MB each)')}</span></label>
              <input id="files" name="files" type="file" multiple accept=".pdf,.ai,.eps,.png,.jpg,.jpeg,.webp" {...err('files')} />{errLine('files')}</div>
          </div>
        </section>
      ) : null}

      <section className="form-section" aria-labelledby="msg-h">
        <h2 id="msg-h">{withProducts ? x('Additional information') : x('Your message')}</h2>
        <div className="field field--full"><label htmlFor="message">{withProducts ? x('Additional requirements') : mode === 'distributor' ? x('Your region, customers and the products you want to carry') : x('Message')}</label>
          <textarea id="message" name="message" maxLength={5000} rows={6} {...err('message')} />{errLine('message')}</div>
        <div className="newsletter__trap" aria-hidden="true"><label htmlFor="company_website">{x('Website')}</label><input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" /></div>
        {turnstileKey ? <div className="cf-turnstile" data-sitekey={turnstileKey} /> : null}
        {errors.form ? <p className="err">{errors.form}</p> : null}
        <div className="btn-row"><button className="btn btn--primary" type="submit" aria-busy={busy || undefined} disabled={busy}>{x(BUTTON[mode])}{mode === 'quote' ? <QuoteIcon /> : null}</button></div>
        {/* keyed by its words: a new message arrives (fades in and rises 6px), the same one repeated while a field is
            being fixed stays still */}
        <p className="status-line" role="status">{status ? <span key={status} className="status-line__msg">{status}</span> : null}</p>
        <p className="t-small muted">{x('You receive a reference number immediately and a copy by email. We use these details only to answer this request ({link}).').split('{link}').map((part, k) => (
          k === 0 ? part : <Fragment key={k}><a className="link" href={`/${locale}/privacy`}>{x('privacy policy')}</a>{part}</Fragment>
        ))}</p>
      </section>
    </form>
  );
}
