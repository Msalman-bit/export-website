'use client';
import { useEffect, useId, useRef, useState } from 'react';

export type PickedProduct = { id: string; name: string; sku: string; type: string; image: string | null; href: string };

/* The inquiry form's "Add a product": a buyer who knows what they want types a name or a product code, picks one of
   up to six matches and it joins the list right here, without the trip to the catalogue. A combobox: the arrow keys
   move through the matches, Enter adds the one marked (and never sends the form), Escape closes the list. The box has
   no name, so the words typed are not sent with the inquiry. */
export function ProductPicker({ locale, onPick }: { locale: string; onPick: (p: PickedProduct) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PickedProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<'idle' | 'none' | 'error'>('idle');
  const [said, setSaid] = useState('');
  const box = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const term = q.trim();

  // one request a pause in typing (200ms), the one before it cancelled
  useEffect(() => {
    if (term.length < 2) { setHits([]); setState('idle'); return; }
    const ctrl = new AbortController();
    const wait = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}&locale=${encodeURIComponent(locale)}`, { signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        const list: PickedProduct[] = Array.isArray(data.results) ? data.results : [];
        setHits(list); setActive(list.length ? 0 : -1); setState(res.ok ? (list.length ? 'idle' : 'none') : 'error');
        setSaid(!res.ok ? '' : list.length ? `${list.length} ${list.length === 1 ? 'product' : 'products'} found.` : 'No product matches.');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setHits([]); setState('error'); }
      }
    }, 200);
    return () => { clearTimeout(wait); ctrl.abort(); };
  }, [term, locale]);

  const pick = (p: PickedProduct) => {
    onPick(p);
    setQ(''); setHits([]); setOpen(false); setActive(-1); setState('idle');
    setSaid(`${p.name} is on your list.`);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); setOpen(true); setActive((a) => (a <= 0 ? hits.length - 1 : a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && hits[active]) pick(hits[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  const shown = open && term.length >= 2 && (hits.length > 0 || state !== 'idle');

  return (
    <div className="field picker">
      <label htmlFor={`${id}-q`}>Add a product <span className="hint">(name or product code)</span></label>
      <div className="picker__box">
        {/* the menu's own magnifier, so the box reads as a search, not one more field to fill in */}
        <svg className="picker__icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11.6 11.6 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <input ref={box} id={`${id}-q`} type="search" role="combobox" autoComplete="off" spellCheck={false} enterKeyHint="search" maxLength={60}
          placeholder="Match football or MS-FB"
          aria-expanded={shown} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={shown && active >= 0 ? `${id}-o${active}` : undefined}
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey}
          onFocus={() => { if (hits.length) setOpen(true); }} onBlur={() => setOpen(false)} />
        {/* the site's own clear button in place of the browser's blue one; a press keeps the cursor in the box */}
        {q ? (
          <button type="button" className="picker__clear" aria-label="Clear the search" onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQ(''); setHits([]); setOpen(false); setState('idle'); box.current?.focus(); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        ) : null}
        {shown ? (
          <ul className="picker__list" id={listId} role="listbox" aria-label="Matching products">
            {hits.map((h, n) => (
              <li key={h.id} id={`${id}-o${n}`} role="option" aria-selected={n === active} className={n === active ? 'is-active' : undefined}
                // a press keeps the focus in the box (so the list stays until the click lands)
                onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)} onMouseEnter={() => setActive(n)}>
                {h.image ? <img src={h.image} alt="" width={40} height={40} /> : <span className="picker__ph" />}
                <span className="picker__text"><span className="picker__name">{h.name}</span><span className="picker__meta">{h.type} · {h.sku}</span></span>
              </li>
            ))}
            {!hits.length ? (
              <li className="picker__none" role="presentation">
                {state === 'error' ? 'The search is not answering right now: see the catalogue instead.' : 'No product matches. Describe it in the message below.'}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <p className="sr-only" role="status">{said}</p>
    </div>
  );
}
