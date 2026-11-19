'use client';
import { useEffect, useState } from 'react';
import map from '@/lib/world-map.json';

type Market = { code: string; name: string; region: string; status: 'established' | 'target' };

/* The export map: target markets in ink, markets already shipped to in lime (shown only once the owner
   marks one established in Admin > Markets), the rest in silver. The list beside it is the accessible
   version: hovering or focusing a row lights its country, and the reverse. */
export function ExportMap({ markets }: { markets: Market[] }) {
  const [on, setOn] = useState<string | null>(null);
  // a phone shows Europe large and the names as plain text (no hover there; the list is the key)
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(max-width: 639px)');
    const f = () => setPhone(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const byCode = new Map(markets.map((m) => [m.code, m]));
  const established = markets.filter((m) => m.status === 'established');
  const ORDER = ['Ireland and the UK', 'Western Europe', 'Southern Europe', 'Scandinavia and the Nordics', 'Central Europe', 'North America'];
  const regions = [...new Set(markets.map((m) => m.region))].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);
  const focus = on ? byCode.get(on) : null;

  return (
    <div className="grid grid--top export">
      <div className="span-5 export__list">
        <ul className="export__legend" aria-label="Map key">
          <li><span className="export__key export__key--target" aria-hidden="true" />Target market</li>
          {established.length ? <li><span className="export__key export__key--done" aria-hidden="true" />Shipped to</li> : null}
        </ul>
        {/* a phone folds the list into one line (the names stay in the page, a tap opens them); a wider
            screen shows it beside the map, every name lighting its country */}
        <div className="export__all">
          <dl className="export__regions">
            {regions.map((r) => (
              <div key={r}>
                <dt className="t-label">{r}</dt>
                <dd>
                  {markets.filter((m) => m.region === r).map((m, i, arr) => (
                    <span key={m.code}>
                      {phone ? <span>{m.name}{m.status === 'established' ? ' (shipped)' : ''}</span> : <button type="button" className={`export__name${on === m.code ? ' is-on' : ''}`} aria-pressed={on === m.code}
                        onMouseEnter={() => setOn(m.code)} onMouseLeave={() => setOn(null)} onFocus={() => setOn(m.code)} onBlur={() => setOn(null)}
                        onClick={() => setOn(on === m.code ? null : m.code)}>
                        {m.name}{m.status === 'established' ? ' (shipped)' : ''}
                      </button>}{i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <details className="export__more">
          <summary>See the {markets.length} markets</summary>
          <dl className="export__regions">
            {regions.map((r) => (
              <div key={r}>
                <dt className="t-label">{r}</dt>
                <dd>
                  {markets.filter((m) => m.region === r).map((m, i, arr) => (
                    <span key={m.code}>
                      <span>{m.name}{m.status === 'established' ? ' (shipped)' : ''}</span>{i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
      <figure className="span-7 start-6 export__map">
        <svg viewBox={phone ? (map as { europe?: string }).europe ?? map.viewBox : map.viewBox} role="img" aria-label={`Map of Europe and North America marking ${markets.length} target markets`}>
          {map.countries.map((c) => {
            const m = byCode.get(c.id);
            const cls = m ? (m.status === 'established' ? 'is-done' : 'is-target') : '';
            return (
              <path key={c.id + c.name} d={c.d} className={`${cls}${on === c.id ? ' is-on' : ''}`}
                onMouseEnter={m ? () => setOn(c.id) : undefined} onMouseLeave={m ? () => setOn(null) : undefined} />
            );
          })}
        </svg>
        <p className="export__readout t-small" aria-live="polite">{focus ? `${focus.name}: ${focus.status === 'established' ? 'shipped to' : 'target market'}` : ' '}</p>
      </figure>
    </div>
  );
}
