'use client';
import { useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/* A list's search form that answers as you type: 300ms after the last key the list reloads with the new search
   (the server still does the searching, so it covers every row, not only those on screen); a drop-down applies the
   moment it changes; Enter and the Search button apply at once. The search stays in the address (?q=…), so opening
   an item, coming back or deleting keeps it. The page is not reloaded: the cursor stays in the box while the list
   changes under it. Without JavaScript it is the plain form it always was (method="get"). */
export function LiveSearch({ children, delay = 300 }: { children: React.ReactNode; delay?: number }) {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const apply = () => {
    clearTimeout(timer.current);
    const el = form.current;
    if (!el) return;
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(el)) { const s = String(v).trim(); if (s) qs.set(k, s); }
    const next = qs.toString();
    start(() => router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  };

  // the boxes follow the address when it changes from elsewhere (a delete that returns to the list), except the one
  // being typed in, which is never overwritten under the cursor
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    for (const f of Array.from(el.elements)) {
      if (!(f instanceof HTMLInputElement || f instanceof HTMLSelectElement) || !f.name || f === document.activeElement) continue;
      const v = params.get(f.name) ?? '';
      if (f.value !== v) f.value = v;
    }
  }, [params]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <form ref={form} className="filters-row panel-box" method="get" aria-busy={pending || undefined}
      onSubmit={(e) => { e.preventDefault(); apply(); }}
      onInput={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === 'SELECT' || (e.nativeEvent as InputEvent).isComposing) return; // a drop-down: onChange; mid-IME: wait
        clearTimeout(timer.current);
        timer.current = setTimeout(apply, delay);
      }}
      onChange={(e) => { if ((e.target as HTMLElement).tagName === 'SELECT') apply(); }}>
      {children}
    </form>
  );
}
