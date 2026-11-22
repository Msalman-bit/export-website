'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Hit = { id: string; name: string; sku: string; type: string; image: string | null; href: string };
type Text = { label: string; short: string; all: string; none: string; result: string; results: string; catalogue: string };

/* The header's search, on a computer (a phone keeps the sheet's plain link to the search page). At rest it is a grey
   pill, with its word where the bar has room for it. Pointing at it opens it into a small field where it stands; a click (or Tab) gives it the whole row of words, which step
   aside, and opens a popup as wide as the field: the product families to start with, then up to six products as the
   buyer types, so one is found without leaving the page. The same search as the inquiry form's product box
   (/api/products/search). A combobox: the arrow keys move through the products, Enter opens the one marked (or the
   full results when none is), Escape closes. Until this has loaded, and without JavaScript, the plain link stays. */
export function HeaderSearch({ locale, searchHref, catalogueHref, families, text }: {
  locale: string; searchHref: string; catalogueHref: string; families: { name: string; href: string; image: string | null }[]; text: Text;
}) {
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<'idle' | 'found' | 'none' | 'error'>('idle');
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const term = q.trim();

  /* how far the field may run: to the right as far as the header's buttons (200px at most), and, once it is in use, to
     the left over the whole row of words. The numbers go to the CSS, which does the moving */
  const measure = useCallback(() => {
    const el = root.current;
    const item = el?.parentElement?.getBoundingClientRect();
    if (!el || !item) return;
    const next = [...document.querySelectorAll<HTMLElement>('.nav__actions > *')].find((n) => n.offsetWidth > 0);
    const room = Math.max(item.width, (next ? next.getBoundingClientRect().left : window.innerWidth) - 12 - item.left);
    // at rest: the magnifier and its word when they fit in the space before the language, else the magnifier alone
    const lang = document.querySelector('.nav__item--lang')?.getBoundingClientRect();
    const pen = document.createElement('canvas').getContext('2d');
    const free = lang ? lang.left - item.left - 4 : 0;
    let rest = item.width;
    if (pen && box.current) {
      const cs = getComputedStyle(box.current);
      pen.font = `${cs.fontWeight} ${getComputedStyle(box.current, '::placeholder').fontSize} ${cs.fontFamily}`;
      const need = Math.ceil(item.width + 4 + pen.measureText(text.short).width + 10);
      if (free >= need) rest = need;
    }
    const word = rest > item.width;
    if (!word) rest = Math.max(item.width, Math.min(40, free));   // the magnifier alone: a square button
    const small = Math.max(rest, Math.min(room, 200));
    el.toggleAttribute('data-word', word);
    el.style.setProperty('--hs-r', `${rest}px`);
    const left = Math.max(0, item.left - (document.querySelector('.nav__links')?.getBoundingClientRect().left ?? item.left));
    el.style.setProperty('--hs-i', `${word ? item.width : rest}px`);
    el.style.setProperty('--hs-w', `${left + small}px`);
    el.style.setProperty('--hs-x', `${left}px`);
  }, [text.short]);

  useEffect(() => {
    measure(); setReady(true);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer.current); };
  }, [measure]);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false); setHover(false); setActive(-1);
    box.current?.blur();
  }, []);

  // one request a pause in typing (200ms), the one before it cancelled
  useEffect(() => {
    if (term.length < 2) { setHits([]); setState('idle'); setActive(-1); return; }
    const ctrl = new AbortController();
    const wait = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}&locale=${encodeURIComponent(locale)}`, { signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        const list: Hit[] = Array.isArray(data.results) ? data.results : [];
        setHits(list); setActive(-1); setState(!res.ok ? 'error' : list.length ? 'found' : 'none');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setHits([]); setState('error'); }
      }
    }, 200);
    return () => { clearTimeout(wait); ctrl.abort(); };
  }, [term, locale]);

  const all = `${searchHref}?q=${encodeURIComponent(term)}`;
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); setActive((a) => (a <= 0 ? hits.length - 1 : a - 1)); }
  };
  const found = state === 'found' && hits.length > 0;

  return (
    <div ref={root} className="hs" data-ready={ready || undefined} data-state={open ? 'open' : hover ? 'hover' : 'rest'}
      onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; clearTimeout(timer.current); measure(); timer.current = setTimeout(() => setHover(true), 100); }}
      onPointerLeave={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setHover(false), 80); }}
      onFocus={() => { clearTimeout(timer.current); measure(); setOpen(true); }}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
      <form className="hs__field" role="search" action={searchHref} method="get"
        onSubmit={(e) => {
          if (found && active >= 0) { e.preventDefault(); window.location.assign(hits[active].href); }
          else if (term.length < 2) e.preventDefault();
        }}>
        <div className="hs__in">
          {/* the magnifier opens the field; with words in it, it runs the search like Enter */}
          <button className="hs__go" type="submit" tabIndex={-1} aria-label={text.label} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { if (document.activeElement !== box.current || term.length < 2) { e.preventDefault(); box.current?.focus(); } }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11.6 11.6 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <input ref={box} name="q" type="search" role="combobox" aria-label={text.label} placeholder={open ? text.label : text.short}
            autoComplete="off" spellCheck={false} enterKeyHint="search" maxLength={60}
            aria-autocomplete="list" aria-expanded={open && found} aria-controls={`${id}-list`}
            aria-activedescendant={open && found && active >= 0 ? `${id}-o${active}` : undefined}
            value={open ? q : ''} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          {/* empties the field; on an empty field, closes the search */}
          <button type="button" className="hs__clear" tabIndex={-1} aria-label={q ? 'Clear the search' : 'Close the search'} onMouseDown={(e) => e.preventDefault()}
            onClick={() => { if (q) { setQ(''); box.current?.focus(); } else close(); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      </form>

      {/* until it is in use only the pill itself takes the pointer: what it opens over (the language) stays reachable */}
      <span className="hs__zone" aria-hidden="true" onMouseDown={(e) => e.preventDefault()} onClick={() => box.current?.focus()} />

      {/* a press inside the popup keeps the cursor in the field, so the popup is still there for the click */}
      <div className="hs__panel" onMouseDown={(e) => e.preventDefault()}>
        <p className="hs__status" role="status">{found ? `${hits.length} ${hits.length === 1 ? text.result : text.results}` : ''}</p>
        {found ? (
          <div id={`${id}-list`} className={hits.length > 3 ? 'hs__list' : 'hs__list hs__list--one'} role="listbox" aria-label={text.label}
            style={hits.length > 3 ? { gridTemplateRows: `repeat(${Math.ceil(hits.length / 2)}, auto)` } : undefined}>
            {hits.map((h, n) => (
              <a key={h.id} id={`${id}-o${n}`} className={`hs__hit${n === active ? ' is-active' : ''}`} role="option" aria-selected={n === active} tabIndex={-1}
                href={h.href} onPointerMove={() => setActive(n)}>
                <span className="hs__pic">{h.image ? <img src={h.image} alt="" width={48} height={48} decoding="async" /> : null}</span>
                <span className="hs__words"><span className="hs__name">{h.name}</span><span className="hs__line">{h.type}, {h.sku}</span></span>
              </a>
            ))}
          </div>
        ) : state === 'none' ? (
          <div className="hs__none"><p>{text.none}</p><a className="link" href={catalogueHref}>{text.catalogue}</a></div>
        ) : (
          <div className="hs__families">
            <p className="t-label">Categories</p>
            {families.map((f) => (
              <a key={f.href} href={f.href}>
                <span className="hs__pic">{f.image ? <img src={f.image} alt="" width={48} height={48} loading="lazy" decoding="async" /> : null}</span>
                <span className="hs__name">{f.name}</span>
              </a>
            ))}
          </div>
        )}
        {state !== 'none' ? (
          <div className="hs__foot">
            {found || state === 'error' ? <a className="link" href={all}>{text.all}</a> : <a className="link" href={catalogueHref}>{text.catalogue}</a>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
