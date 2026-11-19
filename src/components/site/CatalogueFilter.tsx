'use client';
import { useMemo, useState } from 'react';
import type { ProductImage } from '@/lib/db/schema';
import { pic } from '@/lib/media';

type Opt = { value: string; label: string };
type Item = { id: string; name: string; sku: string; summary: string; type: string; typeName: string; constructions: string[]; studio: boolean; href: string; image: ProductImage | null };

/* The family's filters: type and construction (checkboxes), "configurable in the studio" and the count.
   The state is kept in the URL, so a filtered list can be shared and the back button works. */
export function CatalogueFilter({ locale, labels, types, constructions, products, initial }: {
  locale: string;
  labels: { type: string; construction: string; studio: string; result: string; results: string; all: string };
  types: Opt[]; constructions: Opt[]; products: Item[];
  initial: { type: string[]; construction: string[]; studio: boolean };
}) {
  const [type, setType] = useState<string[]>(initial.type);
  const [construction, setConstruction] = useState<string[]>(initial.construction);
  const [studio, setStudio] = useState(initial.studio);

  const shown = useMemo(() => products.filter((p) =>
    (!type.length || type.includes(p.type)) && (!construction.length || p.constructions.some((c) => construction.includes(c))) && (!studio || p.studio)), [products, type, construction, studio]);

  const sync = (t: string[], c: string[], s: boolean) => {
    const q = new URLSearchParams();
    t.forEach((v) => q.append('type', v)); c.forEach((v) => q.append('construction', v)); if (s) q.set('studio', '1');
    history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}`);
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="cat-layout">
      <form className="filters" method="get" aria-label="Filter products" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend>{labels.type}</legend>
          {types.map((o) => (
            <label key={o.value} className="chk"><input type="checkbox" className="m-check" name="type" value={o.value} checked={type.includes(o.value)}
              onChange={() => { const n = toggle(type, o.value); setType(n); sync(n, construction, studio); }} />{o.label}</label>
          ))}
        </fieldset>
        {constructions.length > 1 ? (
          <fieldset>
            <legend>{labels.construction}</legend>
            {constructions.map((o) => (
              <label key={o.value} className="chk"><input type="checkbox" className="m-check" name="construction" value={o.value} checked={construction.includes(o.value)}
                onChange={() => { const n = toggle(construction, o.value); setConstruction(n); sync(type, n, studio); }} />{o.label}</label>
            ))}
          </fieldset>
        ) : null}
        {products.some((p) => p.studio) ? (
          <label className="chk"><input type="checkbox" className="m-check" name="studio" value="1" checked={studio}
            onChange={() => { setStudio(!studio); sync(type, construction, !studio); }} />{labels.studio}</label>
        ) : null}
        <noscript><button className="btn btn--secondary" type="submit">Apply filters</button></noscript>
        {type.length || construction.length || studio ? (
          <button type="button" className="btn-text" onClick={() => { setType([]); setConstruction([]); setStudio(false); sync([], [], false); }}>Clear filters</button>
        ) : null}
      </form>
      <div className="block">
        <p className="result-count" role="status">{shown.length} {shown.length === 1 ? labels.result : labels.results}</p>
        {shown.length ? (
          <div className="prod-grid">
            {shown.map((p) => {
              const im = pic(p.image?.url, 640);
              return (
                <a key={p.id} className="card tile" href={p.href}>
                  <div className="tile__media">{im ? <img src={im.src} srcSet={im.srcSet} sizes="(max-width: 639px) 50vw, 300px" width={im.width} height={im.height} alt={p.image?.alt ?? p.name} loading="lazy" decoding="async" data-source={im.generated ? 'stand-in' : 'client'} /> : null}</div>
                  <div className="tile__head"><h2 className="t-card">{p.name}</h2></div>
                  <p>{p.summary}</p>
                  <p className="sku">{p.typeName} · {p.sku}</p>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="empty"><p>No product matches these filters.</p><a className="btn btn--secondary" href={`/${locale}/inquiry`}>Describe what you need</a></div>
        )}
      </div>
    </div>
  );
}
