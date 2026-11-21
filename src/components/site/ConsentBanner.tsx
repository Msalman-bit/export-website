'use client';
import { useState } from 'react';

/* Shown only when Google Analytics is configured and the visitor has not chosen yet. Analytics stays
   off until "Allow analytics" (no pre-ticked box, rejecting is one click, the choice lasts 12 months). */
export function ConsentBanner({ locale, decided }: { locale: string; decided: boolean }) {
  const [open, setOpen] = useState(!decided);
  const [closing, setClosing] = useState(false);
  if (!open) return null;
  const choose = async (choice: 'analytics' | 'essential') => {
    await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
    if (choice === 'analytics') { location.reload(); return; }
    setClosing(true);                         // slides down (200ms), then leaves the page
    setTimeout(() => setOpen(false), 220);
  };
  return (
    <section className={`consent${closing ? ' is-closing' : ''}`} aria-label="Cookie choice">
      <div className="wrap consent__row">
        <p>We use one optional analytics cookie to count visits. It stays off unless you allow it. <a className="consent__link" href={`/${locale}/cookies`}>Cookie policy</a></p>
        {/* two equal buttons: refusing is as easy and as visible as allowing */}
        <div className="consent__actions">
          <button type="button" className="chip-btn" onClick={() => choose('essential')}>Keep analytics off</button>
          <button type="button" className="chip-btn" onClick={() => choose('analytics')}>Allow analytics</button>
        </div>
      </div>
    </section>
  );
}
