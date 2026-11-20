'use client';
import { useEffect, useRef, useState } from 'react';

/* The admin's menu on a phone, a tablet or a small laptop (up to 1100px, where the sidebar used to stack above every
   page, 20 links deep): a slim bar with "Menu" and the page's name, and the menu sliding in from the left over the
   page. A link, the close button, a tap beside it or Escape closes it; while it is open the keyboard stays in it and
   the page behind does not scroll. From 1101px the sidebar stands on the left as before, and none of this shows.
   The menu itself (logo, groups, account) is rendered by the layout on the server and passed in as children. */
export function AdminDrawer({ current, children }: { current: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const side = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const narrow = matchMedia('(max-width: 1100px)');
    const before = document.body.style.overflow;
    if (narrow.matches) document.body.style.overflow = 'hidden';
    closer.current?.focus();
    // a window widened past 1100px while the menu is open: the sidebar takes over, so the drawer simply closes
    const wide = () => { if (!narrow.matches) setOpen(false); };
    narrow.addEventListener('change', wide);
    return () => { document.body.style.overflow = before; narrow.removeEventListener('change', wide); };
  }, [open]);

  const close = (refocus = true) => { setOpen(false); if (refocus) opener.current?.focus(); };

  // Escape closes; Tab and Shift+Tab go round the menu's own links and buttons
  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab' || !side.current) return;
    const f = [...side.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <>
      <header className="admin__bar">
        <button ref={opener} type="button" className="admin__burger" aria-expanded={open} aria-controls="admin-side" onClick={() => setOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          Menu
        </button>
        <span className="admin__bar-page">{current}</span>
      </header>
      <div className={`admin__scrim${open ? ' is-open' : ''}`} aria-hidden="true" onClick={() => close()} />
      <aside ref={side} id="admin-side" className={`admin__side${open ? ' is-open' : ''}`} aria-label="Admin menu" onKeyDown={onKey}
        // a link clicked in the open menu: it closes on the way (the page it opens loads in its place)
        onClick={(e) => { if (open && (e.target as HTMLElement).closest('a[href]')) close(false); }}>
        <button ref={closer} type="button" className="admin__close" aria-label="Close the menu" onClick={() => close()}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        {children}
      </aside>
    </>
  );
}
