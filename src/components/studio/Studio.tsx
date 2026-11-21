'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Flat } from './Flat';
import type { BallLook } from './Ball3D';
import { footballPanels, startColours } from './football';
import { addToBasket } from '@/lib/basket';

const Ball3D = dynamic(() => import('./Ball3D').then((m) => m.Ball3D), { ssr: false });

type Model = 'football' | 'glove' | 'jersey';
type StudioProduct = { id: string; name: string; sku: string; model: Model; image?: string; href: string };

const COLOURS = [
  ['Obsidian', '#141414'], ['White', '#f4f4f2'], ['Silver', '#b8bdc5'], ['Lime', '#c5f900'], ['Navy', '#1b2a4a'],
  ['Crimson', '#a3162f'], ['Royal blue', '#1f4fbf'], ['Forest green', '#1f5a3a'], ['Orange', '#e8641c'], ['Sky blue', '#6fb6e8'],
] as const;

const OPTIONS: Record<Model, { place: [BallLook['logoPlace'], string][]; materials: string[]; constructions: string[]; sizes: string[]; packaging: string[] }> = {
  football: {
    place: [['front', 'Front panel'], ['side', 'Side panel'], ['both', 'Front and back panels']],
    materials: ['PU', 'PVC', 'TPU', 'Recommend one'], constructions: ['Thermally bonded', 'Hand-stitched', 'Machine-stitched', 'Hybrid'],
    sizes: ['Size 5', 'Size 4', 'Size 3', 'Size 1'], packaging: ['Single polybag', 'Retail box', 'Mesh bag of 10', 'Bulk carton'],
  },
  glove: {
    place: [['front', 'Backhand'], ['side', 'Wrist strap']],
    materials: ['Leather', 'Synthetic leather', 'Latex palm'], constructions: ['Hook-and-loop closure', 'Lace-up closure', 'Roll finger cut', 'Flat cut'],
    sizes: ['Junior run', 'Adult run', 'Mixed run'], packaging: ['Pair in polybag', 'Retail box', 'Header card', 'Bulk carton'],
  },
  jersey: {
    place: [['front', 'Chest centre'], ['side', 'Chest left']],
    materials: ['Polyester mesh', 'Recycled polyester', 'Cotton blend'], constructions: ['Sublimated', 'Cut and sewn panels'],
    sizes: ['Youth run', 'Adult run', 'Mixed run'], packaging: ['Individual polybag', 'Packed by player', 'Packed by size', 'Bulk carton'],
  },
};

const STEPS = ['Product', 'Colours', 'Logo', 'Details'] as const;
const PANELS = footballPanels(); // 12 pentagons, then 20 hexagons
const START = startColours(PANELS);
const colourName = (hex: string) => COLOURS.find(([, h]) => h === hex)?.[0] ?? hex.toUpperCase();

/* The customisation studio, in four steps beside a product that never leaves the screen: the ball (or the glove or
   the shirt) stays in view, on a phone pinned under the header while the steps scroll beneath it, and the main action
   stays in reach in a bar at the foot of the steps. A football is painted the way it is made: one colour per panel,
   picked from the palette and laid on with a tap (12 pentagons, 20 hexagons), with whole-ball shortcuts, Undo and
   Start again; a glove or a shirt takes a main, a second and an accent colour. The design goes into the inquiry with
   its picture and the logo attached; every preview is labelled as a visual concept. */
export function Studio({ locale, products, initialId, signedIn }: { locale: string; products: StudioProduct[]; initialId?: string; signedIn: boolean }) {
  const [productId, setProductId] = useState(initialId && products.some((p) => p.id === initialId) ? initialId : products[0]?.id);
  const product = products.find((p) => p.id === productId) ?? products[0];
  const model = product?.model ?? 'football';
  const opts = OPTIONS[model];
  const [step, setStep] = useState(0);
  // the football: one colour per panel, the brush, and the steps back
  const [paint, setPaint] = useState<string[]>(START);
  const [brush, setBrush] = useState<string>('#1b2a4a');
  const [history, setHistory] = useState<string[][]>([]);
  // a glove or a shirt: three colours
  const [primary, setPrimary] = useState('#f4f4f2');
  const [secondary, setSecondary] = useState('#141414');
  const [accent, setAccent] = useState('#c5f900');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoName, setLogoName] = useState('');
  const [place, setPlace] = useState<BallLook['logoPlace']>('front');
  const [material, setMaterial] = useState(opts.materials[0]);
  const [size, setSize] = useState(opts.sizes[0]);
  const [construction, setConstruction] = useState(opts.constructions[0]);
  const [packaging, setPackaging] = useState(opts.packaging[0]);
  const [quantity, setQuantity] = useState('500');
  const [notes, setNotes] = useState('');
  const [gl, setGl] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [status, setStatus] = useState('');
  const [statusN, setStatusN] = useState(0);
  const say = (s: string) => { setStatus(s); setStatusN((x) => x + 1); };
  const [err, setErr] = useState('');
  const snap = useRef<(() => string) | null>(null);
  const flatRef = useRef<SVGSVGElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setGl(c.getContext('webgl2') || c.getContext('webgl') ? 'yes' : 'no');
    } catch { setGl('no'); }
  }, []);

  useEffect(() => {
    const o = OPTIONS[model];
    setMaterial(o.materials[0]); setSize(o.sizes[0]); setConstruction(o.constructions[0]); setPackaging(o.packaging[0]); setPlace('front');
  }, [model]);

  const isBall = model === 'football';
  const look: BallLook = useMemo(() => ({ primary, secondary, accent, logo, logoPlace: place, panels: isBall ? paint : undefined }),
    [primary, secondary, accent, logo, place, paint, isBall]);
  const show3d = isBall && gl === 'yes' && view === '3d';
  const onFail = useCallback(() => setGl('no'), []);
  const onReady = useCallback((fn: () => string) => { snap.current = fn; }, []);

  /* ---------- painting ---------- */
  const apply = (next: string[]) => {
    if (next.every((c, i) => c === paint[i])) return;
    setHistory((h) => [...h.slice(-49), paint]);
    setPaint(next);
  };
  const paintNow = useRef(paint);
  paintNow.current = paint;
  const paintPanel = useCallback((i: number) => {
    const cur = paintNow.current;
    if (cur[i] === brush) return;
    const next = cur.slice(); next[i] = brush;
    paintNow.current = next; // a second tap before the next render builds on this one
    setHistory((h) => [...h.slice(-49), cur]);
    setPaint(next);
  }, [brush]);
  const paintable = isBall && step === 1;
  const used = useMemo(() => {
    const m = new Map<string, { pent: number; hex: number }>();
    paint.forEach((c, i) => { const e = m.get(c) ?? { pent: 0, hex: 0 }; if (PANELS[i].kind === 'pent') e.pent++; else e.hex++; m.set(c, e); });
    return [...m.entries()];
  }, [paint]);
  const usedText = used.map(([c, e]) => `${colourName(c)}: ${[e.hex ? `${e.hex} ${e.hex === 1 ? 'hexagon' : 'hexagons'}` : '', e.pent ? `${e.pent} ${e.pent === 1 ? 'pentagon' : 'pentagons'}` : ''].filter(Boolean).join(', ')}`).join('; ');

  /* ---------- the logo ---------- */
  const readLogo = (file: File | undefined) => {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { setErr('Use a PNG, JPG, WEBP or SVG logo.'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('Use a logo file of 5 MB or less.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // drawn into a canvas and kept as PNG: an SVG's scripts never run, and the file stays small
      const max = 800, s = Math.min(1, max / Math.max(img.width || max, img.height || max));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.width || max) * s)); c.height = Math.max(1, Math.round((img.height || max) * s));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setLogo(c.toDataURL('image/png')); setLogoName(file.name); URL.revokeObjectURL(url);
    };
    img.onerror = () => { setErr('This logo file could not be read.'); URL.revokeObjectURL(url); };
    img.src = url;
  };

  /* ---------- what is sent ---------- */
  const config = () => ({
    model, product: product?.name, sku: product?.sku,
    ...(isBall ? { colours: usedText } : { primary: `${colourName(primary)} (${primary})`, secondary: `${colourName(secondary)} (${secondary})`, accent: `${colourName(accent)} (${accent})` }),
    logo: logo ? logoName || 'logo.png' : 'none', logoPlacement: opts.place.find(([v]) => v === place)?.[1],
    material, size, construction, packaging, quantity: Number(quantity) || 0, instructions: notes,
  });
  const summary = [product?.name, isBall ? `${used.length} ${used.length === 1 ? 'colour' : 'colours'}` : colourName(primary), logo ? `logo on ${opts.place.find(([v]) => v === place)?.[1].toLowerCase()}` : 'no logo yet'].filter(Boolean).join(' · ');

  const picture = async (): Promise<string> => {
    if (show3d && snap.current) return snap.current();
    const svg = flatRef.current;
    if (!svg) return '';
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = c.height = 1200;
    c.getContext('2d')!.drawImage(img, 0, 0, 1200, 1200); URL.revokeObjectURL(url);
    return c.toDataURL('image/png');
  };
  // the picture that travels with the inquiry: on the stage's dark ground, at most 900px, as JPEG
  const smallPicture = async (): Promise<string> => {
    const src = await picture().catch(() => '');
    if (!src) return '';
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => {
        const s = Math.min(1, 900 / Math.max(i.width, i.height));
        const c = document.createElement('canvas'); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s);
        const g = c.getContext('2d')!; g.fillStyle = '#0d0e10'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.88));
      };
      i.onerror = () => res('');
      i.src = src;
    });
  };

  const download = async () => {
    const shot = await picture();
    const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = shot; });
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1560;
    const g = c.getContext('2d')!;
    g.fillStyle = '#080808'; g.fillRect(0, 0, 1200, 1560);
    g.drawImage(img, 0, 0, 1200, 1200);
    g.fillStyle = '#c5f900'; g.fillRect(0, 1200, 1200, 6);
    g.fillStyle = '#ffffff'; g.font = '500 40px Archivo, Arial, sans-serif'; g.fillText(`Monolith Sports · ${product?.name ?? ''}`, 56, 1270);
    g.font = '28px Archivo, Arial, sans-serif'; g.fillStyle = '#d6d8db';
    const cf = config();
    const colourLine = `Colours: ${isBall ? usedText : `${colourName(primary)}, ${colourName(secondary)}, ${colourName(accent)}`}`;
    const lines = [colourLine.length > 78 ? `${colourLine.slice(0, 77)}…` : colourLine, `Logo: ${cf.logo} (${cf.logoPlacement})`, `${cf.material} · ${cf.construction} · ${cf.size}`, `Quantity: ${cf.quantity} · ${cf.packaging}`];
    lines.forEach((l, i) => g.fillText(l, 56, 1325 + i * 42));
    g.fillStyle = '#959595'; g.font = '24px Archivo, Arial, sans-serif';
    g.fillText('Visual concept, not a production sample. The approved sample is the production reference.', 56, 1515);
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `monolith-concept-${(product?.sku ?? 'design').toLowerCase()}.png`; a.click();
    navigator.sendBeacon?.('/api/events', JSON.stringify({ name: 'studio_preview_download', productId: product?.id, path: location.pathname }));
    say('The concept preview is downloading.');
  };

  const save = async () => {
    const body = { productId: product?.id, name: `${product?.name} design`, config: config() };
    if (signedIn) {
      const res = await fetch('/api/customisations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      say(res.ok ? 'Saved to your account under Saved designs.' : 'Not saved. Sign in again and retry.');
    } else {
      try {
        const list = JSON.parse(localStorage.getItem('ms_designs') || '[]');
        list.unshift({ ...body, savedAt: new Date().toISOString() });
        localStorage.setItem('ms_designs', JSON.stringify(list.slice(0, 20)));
        say('Saved in this browser. Sign in to keep designs in your account.');
      } catch { say('This browser does not allow saving.'); }
    }
    navigator.sendBeacon?.('/api/events', JSON.stringify({ name: 'studio_saved', productId: product?.id, path: location.pathname }));
  };

  const toInquiry = async () => {
    const n = Number(quantity);
    if (!Number.isInteger(n) || n < 1) { setStep(3); setErr('Write a quantity of 1 or more, as a whole number.'); return; }
    setErr('');
    const items = addToBasket({ productId: product?.id ?? null, name: product?.name ?? 'Custom product', sku: product?.sku ?? '', image: product?.image, href: product?.href, quantity: n, notes, customisation: config() });
    const key = items[items.length - 1]?.key;
    if (key) {
      // the logo and the design's picture travel with the inquiry as attachments (InquiryForm reads them)
      if (logo) { try { localStorage.setItem(`ms_logo_${key}`, logo); } catch { /* the logo can be attached on the form */ } }
      const shot = await smallPicture();
      if (shot) { try { localStorage.setItem(`ms_preview_${key}`, shot); } catch { /* the preview can be downloaded instead */ } }
    }
    navigator.sendBeacon?.('/api/events', JSON.stringify({ name: 'studio_to_inquiry', productId: product?.id, path: location.pathname }));
    say(`Your design is on the inquiry list, with its picture${logo ? ' and the logo' : ''} attached.`);
  };

  if (!product) return <p>No product can be customised yet.</p>;

  /* ---------- pieces ---------- */
  const swatchRow = (value: string, set: (v: string) => void, name: string) => {
    const custom = !COLOURS.some(([, h]) => h === value);
    return (
      <div className="swatches" role="group" aria-label={name}>
        {COLOURS.map(([n, h]) => (
          <button key={h} type="button" className="swatch" style={{ '--sw': h } as React.CSSProperties} aria-label={n} title={n} aria-pressed={value === h} onClick={() => set(h)} />
        ))}
        <label className={`swatch swatch--custom${custom ? ' is-on' : ''}`} style={{ '--sw': custom ? value : 'transparent' } as React.CSSProperties} title="Your own colour">
          <span className="sr-only">Your own {name.toLowerCase()}</span>
          <span aria-hidden="true">{custom ? '' : '+'}</span>
          <input type="color" value={value} onChange={(e) => set(e.target.value)} />
        </label>
      </div>
    );
  };
  const seg = (name: string, list: string[], value: string, set: (v: string) => void) => (
    <div className="seg">
      {list.map((o) => (
        <label key={o}><input type="radio" name={`${uid}-${name}`} value={o} checked={value === o} onChange={() => set(o)} /><span>{o}</span></label>
      ))}
    </div>
  );
  const next = step < STEPS.length - 1 ? (
    <button type="button" className="btn btn--secondary studio__next" onClick={() => { setStep(step + 1); tabRefs.current[step + 1]?.focus(); }}>Continue to {STEPS[step + 1].toLowerCase()}</button>
  ) : null;

  return (
    <div className="studio">
      <div className="studio__stage">
        <div className="studio__canvas" data-paint={paintable ? '' : undefined}>
          {show3d
            ? <Ball3D look={look} onFail={onFail} onReady={onReady} onPaint={paintable ? paintPanel : undefined} />
            : <Flat ref={flatRef} model={model} variant={/boxing/i.test(product?.name ?? '') ? 'boxing' : undefined} look={look} onPaint={paintable ? paintPanel : undefined}
                label={isBall ? `${product.name}: ${usedText}` : `${product.name} in ${colourName(primary)}, ${colourName(secondary)} and ${colourName(accent)}`} />}
          {isBall && gl === 'yes' ? (
            <div className="seg studio__view" role="group" aria-label="View">
              <label><input type="radio" name={`${uid}-view`} checked={view === '3d'} onChange={() => setView('3d')} /><span>3D</span></label>
              <label><input type="radio" name={`${uid}-view`} checked={view === '2d'} onChange={() => setView('2d')} /><span>Flat</span></label>
            </div>
          ) : null}
        </div>
      </div>

      <form className="studio__panel" onSubmit={(e) => e.preventDefault()} aria-label="Design choices">
        {/* the four steps as a numbered list of buttons, the current one marked aria-current="step" (a plain step
            list, not tabs: the kit's script takes over every role="tablist" on the page) */}
        <ol className="studio__steps" aria-label="Design steps">
          {STEPS.map((s, n) => (
            <li key={s}>
              <button ref={(el) => { tabRefs.current[n] = el; }} type="button" aria-current={step === n ? 'step' : undefined} onClick={() => setStep(n)}>
                <span className="studio__step-n" aria-hidden="true">{n + 1}</span>{s}
              </button>
            </li>
          ))}
        </ol>

        <section className="studio__step" aria-labelledby={`${uid}-step-h`} key={step}>
          <h2 className="sr-only" id={`${uid}-step-h`}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</h2>
          {step === 0 ? (
            <>
              <p className="studio__lead">Choose what to design. Balls are painted panel by panel; gloves and kit take three colours.</p>
              <div className="studio__products" role="group" aria-label="Product">
                {products.map((p) => (
                  <button key={p.id} type="button" className="studio__product" aria-pressed={p.id === product.id} onClick={() => setProductId(p.id)}>
                    {p.image ? <img src={p.image} alt="" width={160} height={160} loading="lazy" decoding="async" /> : <span className="studio__product-ph" />}
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
              {next}
            </>
          ) : null}

          {step === 1 ? (
            isBall ? (
              <>
                <p className="studio__lead">Pick a colour, then tap a panel on the ball to paint it. Drag to turn the ball.</p>
                <fieldset>
                  <legend>Colour <span className="studio__pick">{colourName(brush)}</span></legend>
                  {swatchRow(brush, setBrush, 'Paint colour')}
                </fieldset>
                <div className="studio__tools" role="group" aria-label="Paint the ball">
                  <button type="button" className="chip-btn" onClick={() => apply(paint.map((c, i) => (PANELS[i].kind === 'hex' ? brush : c)))}>Paint all hexagons</button>
                  <button type="button" className="chip-btn" onClick={() => apply(paint.map((c, i) => (PANELS[i].kind === 'pent' ? brush : c)))}>Paint all pentagons</button>
                  <button type="button" className="chip-btn" onClick={() => apply(paint.map(() => brush))}>Paint the whole ball</button>
                </div>
                <div className="studio__tools">
                  <button type="button" className="btn-text" disabled={!history.length} onClick={() => { const h = history[history.length - 1]; if (h) { setPaint(h); setHistory(history.slice(0, -1)); } }}>Undo</button>
                  <button type="button" className="btn-text" onClick={() => apply(START)}>Start again</button>
                </div>
                <div className="studio__used" aria-label="Colours on the ball">
                  {used.map(([c, e]) => (
                    <span key={c}><span className="studio__dot" style={{ background: c }} aria-hidden="true" />{colourName(c)} <span className="muted">{[e.hex ? `${e.hex} hex` : '', e.pent ? `${e.pent} pent` : ''].filter(Boolean).join(' · ')}</span></span>
                  ))}
                </div>
                {next}
              </>
            ) : (
              <>
                <fieldset><legend>Main colour <span className="studio__pick">{colourName(primary)}</span></legend>{swatchRow(primary, setPrimary, 'Main colour')}</fieldset>
                <fieldset><legend>Second colour <span className="studio__pick">{colourName(secondary)}</span></legend>{swatchRow(secondary, setSecondary, 'Second colour')}</fieldset>
                <fieldset><legend>Accent colour <span className="studio__pick">{colourName(accent)}</span></legend>{swatchRow(accent, setAccent, 'Accent colour')}</fieldset>
                {next}
              </>
            )
          ) : null}

          {step === 2 ? (
            <>
              <div className="field">
                <span className="studio__label" id={`${uid}-logo-l`}>Company logo <span className="hint">(PNG, JPG, WEBP or SVG, up to 5 MB)</span></span>
                {logo ? (
                  <div className="studio__logo">
                    <img src={logo} alt={`Your logo: ${logoName}`} />
                    <span className="studio__logo-name">{logoName}</span>
                    <label className="btn-text studio__replace">Replace<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => readLogo(e.target.files?.[0])} /></label>
                    <button type="button" className="btn-text" onClick={() => { setLogo(null); setLogoName(''); }}>Remove</button>
                  </div>
                ) : (
                  <label className="studio__drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readLogo(e.dataTransfer.files?.[0]); }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span><strong>Upload your logo</strong><br /><span className="muted">or drop the file here</span></span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-labelledby={`${uid}-logo-l`}
                      aria-describedby={err ? `${uid}-err` : undefined} onChange={(e) => readLogo(e.target.files?.[0])} />
                  </label>
                )}
              </div>
              <fieldset><legend>Logo position</legend>{seg('place', opts.place.map(([, l]) => l), opts.place.find(([v]) => v === place)?.[1] ?? '', (l) => setPlace(opts.place.find(([, x]) => x === l)![0]))}</fieldset>
              {err && step === 2 ? <p className="err" id={`${uid}-err`} role="alert">{err}</p> : null}
              {next}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <fieldset><legend>Material</legend>{seg('material', opts.materials, material, setMaterial)}</fieldset>
              <fieldset><legend>Construction</legend>{seg('construction', opts.constructions, construction, setConstruction)}</fieldset>
              <fieldset><legend>Size</legend>{seg('size', opts.sizes, size, setSize)}</fieldset>
              <fieldset><legend>Packaging</legend>{seg('packaging', opts.packaging, packaging, setPackaging)}</fieldset>
              <div className="field"><label htmlFor={`${uid}-qty`}>Order quantity</label>
                <input id={`${uid}-qty`} type="text" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
                  aria-invalid={err && step === 3 ? 'true' : undefined} aria-describedby={err && step === 3 ? `${uid}-err` : undefined} /></div>
              {err && step === 3 ? <p className="err" id={`${uid}-err`} role="alert">{err}</p> : null}
              <div className="field"><label htmlFor={`${uid}-notes`}>Manufacturing instructions <span className="hint">(optional)</span></label>
                <textarea id={`${uid}-notes`} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} /></div>
              <p className="t-small muted">These are the options you can ask to be quoted; the quotation confirms what is possible for your order.</p>
            </>
          ) : null}
        </section>

        {/* the bar stays in reach: what is designed and the main action (and the answer to it); the two quieter
            actions follow it in the flow */}
        <div className="studio__bar">
          <p className="studio__summary">{summary}</p>
          <button type="button" className="btn btn--primary" onClick={toInquiry}>Add to my inquiry</button>
          <p className="status-line" role="status">{status ? <span key={statusN} className="status-line__msg">{status}</span> : null}{status.includes('inquiry list') ? <> <a className="link" href={`/${locale}/inquiry`}>Send the inquiry</a></> : null}</p>
        </div>
        <div className="studio__more">
          <button type="button" className="btn-text" onClick={download}>Download the preview</button>
          <button type="button" className="btn-text" onClick={save}>Save the design</button>
        </div>
        <p className="studio__note">Visual concept, not a production sample. Screen colours differ from printed and dyed materials; the sample you approve is the production reference.</p>
      </form>
    </div>
  );
}
