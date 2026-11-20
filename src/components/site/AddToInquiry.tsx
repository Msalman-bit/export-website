'use client';
import { useEffect, useState } from 'react';
import { addToBasket, readBasket, readMode, writeMode } from '@/lib/basket';

/* On a product page: the quantity, "Add to inquiry" and "Request a sample". The status line under the
   buttons says what happened and links to the list. When the visitor picked "Samples first" on the inquiry
   form, the page follows it: "Request a sample" is the main button, the bulk quantity steps aside (a sample is
   one piece; the expected order is asked on the form), and one line offers the way back to a bulk quote. */
export function AddToInquiry({ product, locale, labels }: {
  product: { id: string; name: string; sku: string; image?: string; href: string };
  locale: string;
  labels: { add: string; sample: string; added: string; quantity: string; quote: string };
}) {
  const [qty, setQty] = useState('100');
  const [status, setStatus] = useState('');
  const [statusN, setStatusN] = useState(0);
  const say = (s: string) => { setStatus(s); setStatusN((x) => x + 1); };
  const [count, setCount] = useState(0);
  const [err, setErr] = useState('');
  const [samplesFirst, setSamplesFirst] = useState(false);

  useEffect(() => {
    const sync = () => { setCount(readBasket().length); setSamplesFirst(readMode() === 'sample'); };
    sync();
    window.addEventListener('ms-basket', sync);
    window.addEventListener('ms-mode', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('ms-basket', sync); window.removeEventListener('ms-mode', sync); window.removeEventListener('storage', sync); };
  }, []);

  const add = (sample: boolean) => {
    const n = Number(qty);
    // a sample needs no quantity: it is one piece, and the order expected later is asked on the inquiry form
    if (!sample && (!Number.isInteger(n) || n < 1)) { setErr('Write a quantity of 1 or more, as a whole number.'); return; }
    setErr('');
    addToBasket({ productId: product.id, name: product.name, sku: product.sku, image: product.image, href: product.href, quantity: sample ? 0 : n, notes: '', sample });
    say(sample ? `A sample of ${product.name} is on your inquiry list.` : `${n.toLocaleString('en-GB')} × ${product.name}: ${labels.added.toLowerCase()}.`);
  };

  const statusLine = (
    <p className="status-line" role="status">
      {status ? <span key={statusN} className="status-line__msg">{status}</span> : null}{status || count ? <> <a className="link" href={`/${locale}/inquiry`}>Open your inquiry list{count ? ` (${count})` : ''}</a></> : null}
    </p>
  );

  if (samplesFirst) {
    return (
      <div className="buy__actions">
        <p className="buy__mode">You are asking for samples first. <button type="button" className="btn-text" onClick={() => writeMode('quote')}>Switch to a bulk quote</button></p>
        <button type="button" className="btn btn--primary" onClick={() => add(true)}>{labels.sample}</button>
        {statusLine}
      </div>
    );
  }

  return (
    <div className="buy__actions">
      <div className="buy__row">
        <div className="field">
          <label htmlFor="qty">{labels.quantity}</label>
          <input id="qty" type="text" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} aria-invalid={err ? 'true' : undefined} aria-describedby={err ? 'qty-err' : undefined} />
        </div>
        <button type="button" className="btn btn--primary" onClick={() => add(false)}>{labels.add}</button>
      </div>
      {err ? <p className="err" id="qty-err">{err}</p> : null}
      <button type="button" className="btn btn--secondary" onClick={() => add(true)}>{labels.sample}</button>
      {statusLine}
    </div>
  );
}
