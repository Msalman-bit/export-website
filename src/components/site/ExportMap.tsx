'use client';
import { useEffect, useState } from 'react';
import map from '@/lib/world-map.json';
import { clientTx } from '@/lib/i18n/fill';

/* name and regionName in the page's language (the page sets them); region stays the English key the order uses */
type Market = { code: string; name: string; region: string; regionName?: string; status: 'established' | 'target' };

/* The export map of Europe: target markets in ink, markets already shipped to in lime (shown only once the owner
   marks one established in Admin > Markets), the rest in silver. The list beside it is the accessible
   version: hovering or focusing a row lights its country, and the reverse. */
export function ExportMap({ markets, text }: { markets: Market[]; text?: Record<string, string> }) {
  const x = clientTx(text);
  const [on, setOn] = useState<string | null>(null);
  // a phone shows the names as plain text (no hover there; the list is the key)
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(max-width: 639px)');
    const f = () => setPhone(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const byCode = new Map(markets.map((m) => [m.code, m]));
  const established = markets.filter((m) => m.status === 'established');
  const ORDER = ['Ireland and the UK', 'Western Europe', 'Southern Europe', 'Scandinavia and the Nordics', 'Central Europe'];
  const regions = [...new Set(markets.map((m) => m.region))].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);
  const focus = on ? byCode.get(on) : null;
  const regionName = (r: string) => markets.find((m) => m.region === r)?.regionName ?? r;
  const named = (m: Market) => (m.status === 'established' ? x('{name} (shipped)', { name: m.name }) : m.name);

  return (
    <div className="grid grid--top export">
      <div className="span-5 export__list">
        <ul className="export__legend" aria-label={x('Map key')}>
          <li><span className="export__key export__key--target" aria-hidden="true" />{x('Target market')}</li>
          {established.length ? <li><span className="export__key export__key--done" aria-hidden="true" />{x('Shipped to')}</li> : null}
        </ul>
        {/* a phone folds the list into one line (the names stay in the page, a tap opens them); a wider
            screen shows it beside the map, every name lighting its country */}
        <div className="export__all">
          <dl className="export__regions">
            {regions.map((r) => (
              <div key={r}>
                <dt className="t-label">{regionName(r)}</dt>
                <dd>
                  {markets.filter((m) => m.region === r).map((m, i, arr) => (
                    <span key={m.code}>
                      {phone ? <span>{named(m)}</span> : <button type="button" className={`export__name${on === m.code ? ' is-on' : ''}`} aria-pressed={on === m.code}
                        onMouseEnter={() => setOn(m.code)} onMouseLeave={() => setOn(null)} onFocus={() => setOn(m.code)} onBlur={() => setOn(null)}
                        onClick={() => setOn(on === m.code ? null : m.code)}>
                        {named(m)}
                      </button>}{i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <details className="export__more">
          <summary>{x('See all {n} markets', { n: markets.length })}</summary>
          <dl className="export__regions">
            {regions.map((r) => (
              <div key={r}>
                <dt className="t-label">{regionName(r)}</dt>
                <dd>
                  {markets.filter((m) => m.region === r).map((m, i, arr) => (
                    <span key={m.code}>
                      <span>{named(m)}</span>{i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
      <figure className="span-7 start-6 export__map">
        <svg viewBox={map.viewBox} role="img" aria-label={x('Map of Europe marking {n} target markets', { n: markets.length })}>
          {map.countries.map((c) => {
            const m = byCode.get(c.id);
            const cls = m ? (m.status === 'established' ? 'is-done' : 'is-target') : '';
            return (
              <path key={c.id + c.name} d={c.d} className={`${cls}${on === c.id ? ' is-on' : ''}`}
                onMouseEnter={m ? () => setOn(c.id) : undefined} onMouseLeave={m ? () => setOn(null) : undefined} />
            );
          })}
        </svg>
        <p className="export__readout t-small" aria-live="polite">{focus ? x(focus.status === 'established' ? '{name}: shipped to' : '{name}: target market', { name: focus.name }) : ' '}</p>
      </figure>
    </div>
  );
}
