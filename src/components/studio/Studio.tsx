'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Flat } from './Flat';
import type { BallLook } from './Ball3D';
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

/* The customisation studio. Every choice is a form control (the 3D view is extra, never the only way
   to choose); the preview is labelled as a visual concept; the design goes into the inquiry list with
   the logo file attached. */
export function Studio({ locale, products, initialId, signedIn }: { locale: string; products: StudioProduct[]; initialId?: string; signedIn: boolean }) {
  const [productId, setProductId] = useState(initialId && products.some((p) => p.id === initialId) ? initialId : products[0]?.id);
  const product = products.find((p) => p.id === productId) ?? products[0];
  const model = product?.model ?? 'football';
  const opts = OPTIONS[model];
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

  const look: BallLook = useMemo(() => ({ primary, secondary, accent, logo, logoPlace: place }), [primary, secondary, accent, logo, place]);
  const show3d = model === 'football' && gl === 'yes' && view === '3d';
  const onFail = useCallback(() => setGl('no'), []);
  const onReady = useCallback((fn: () => string) => { snap.current = fn; }, []);
  const colourName = (hex: string) => COLOURS.find(([, h]) => h === hex)?.[0] ?? hex.toUpperCase();

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

  const config = () => ({
    model, product: product?.name, sku: product?.sku, primary: `${colourName(primary)} (${primary})`, secondary: `${colourName(secondary)} (${secondary})`,
    accent: `${colourName(accent)} (${accent})`, logo: logo ? logoName || 'logo.png' : 'none', logoPlacement: opts.place.find(([v]) => v === place)?.[1],
    material, size, construction, packaging, quantity: Number(quantity) || 0, instructions: notes,
  });

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
    const lines = [`Colours: ${cf.primary}, ${cf.secondary}, ${cf.accent}`, `Logo: ${cf.logo} (${cf.logoPlacement})`, `${cf.material} · ${cf.construction} · ${cf.size}`, `Quantity: ${cf.quantity} · ${cf.packaging}`];
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

  const toInquiry = () => {
    const n = Number(quantity);
    if (!Number.isInteger(n) || n < 1) { setErr('Write a quantity of 1 or more, as a whole number.'); return; }
    const items = addToBasket({ productId: product?.id ?? null, name: product?.name ?? 'Custom product', sku: product?.sku ?? '', image: product?.image, href: product?.href, quantity: n, notes, customisation: config() });
    const key = items[items.length - 1]?.key;
    if (logo && key) { try { localStorage.setItem(`ms_logo_${key}`, logo); } catch { /* the logo can be attached on the form */ } }
    navigator.sendBeacon?.('/api/events', JSON.stringify({ name: 'studio_to_inquiry', productId: product?.id, path: location.pathname }));
    say('Your design is on the inquiry list, with the logo attached.');
  };

  if (!product) return <p>No product can be customised yet.</p>;
  const swatches = (value: string, set: (v: string) => void, name: string) => (
    <div className="swatches" role="group" aria-label={name}>
      {COLOURS.map(([n, h]) => (
        <button key={h} type="button" className="swatch" style={{ '--sw': h } as React.CSSProperties} aria-label={n} aria-pressed={value === h} onClick={() => set(h)} />
      ))}
      <label className="swatch" style={{ '--sw': value, display: 'grid', placeItems: 'center' } as React.CSSProperties} title="Any colour">
        <span className="sr-only">Any {name.toLowerCase()}</span>
        <input type="color" value={value} onChange={(e) => set(e.target.value)} style={{ opacity: 0, width: 40, height: 40, cursor: 'pointer' }} />
      </label>
    </div>
  );
  const seg = (name: string, list: string[], value: string, set: (v: string) => void) => (
    <div className="seg">
      {list.map((o) => (
        <label key={o}><input type="radio" name={name} value={o} checked={value === o} onChange={() => set(o)} /><span>{o}</span></label>
      ))}
    </div>
  );

  return (
    <div className="studio">
      <div className="studio__stage">
        <div className="studio__canvas">
          {show3d ? <Ball3D look={look} onFail={onFail} onReady={onReady} /> : <Flat ref={flatRef} model={model} look={look} label={`${product.name} in ${colourName(primary)}, ${colourName(secondary)} and ${colourName(accent)}`} />}
        </div>
        {model === 'football' && gl === 'yes' ? (
          <div className="seg" role="group" aria-label="View">
            <label><input type="radio" name="view" checked={view === '3d'} onChange={() => setView('3d')} /><span>3D view</span></label>
            <label><input type="radio" name="view" checked={view === '2d'} onChange={() => setView('2d')} /><span>Flat view</span></label>
          </div>
        ) : null}
        <p className="studio__note">Visual concept, not a production sample. Screen colours differ from printed and dyed materials; the sample you approve is the production reference.{show3d ? ' Drag to turn the ball.' : ''}</p>
      </div>

      <form className="studio__panel" onSubmit={(e) => e.preventDefault()} aria-label="Design choices">
        <div className="field"><label htmlFor="st-product">Product</label>
          <select id="st-product" value={product.id} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <fieldset><legend>Main colour</legend>{swatches(primary, setPrimary, 'Main colour')}</fieldset>
        <fieldset><legend>Second colour</legend>{swatches(secondary, setSecondary, 'Second colour')}</fieldset>
        <fieldset><legend>Accent colour</legend>{swatches(accent, setAccent, 'Accent colour')}</fieldset>
        <div className="field"><label htmlFor="st-logo">Company logo <span className="hint">(PNG, JPG, WEBP or SVG, up to 5 MB)</span></label>
          <input id="st-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => readLogo(e.target.files?.[0])} aria-describedby={err ? 'st-err' : undefined} />
          {logo ? <button type="button" className="btn-text" onClick={() => { setLogo(null); setLogoName(''); }}>Remove the logo</button> : null}</div>
        <fieldset><legend>Logo position</legend>{seg('place', opts.place.map(([, l]) => l), opts.place.find(([v]) => v === place)?.[1] ?? '', (l) => setPlace(opts.place.find(([, x]) => x === l)![0]))}</fieldset>
        <fieldset><legend>Material</legend>{seg('material', opts.materials, material, setMaterial)}</fieldset>
        <fieldset><legend>Construction</legend>{seg('construction', opts.constructions, construction, setConstruction)}</fieldset>
        <fieldset><legend>Size</legend>{seg('size', opts.sizes, size, setSize)}</fieldset>
        <fieldset><legend>Packaging</legend>{seg('packaging', opts.packaging, packaging, setPackaging)}</fieldset>
        <div className="field"><label htmlFor="st-qty">Order quantity</label>
          <input id="st-qty" type="text" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))} /></div>
        <div className="field"><label htmlFor="st-notes">Manufacturing instructions <span className="hint">(optional)</span></label>
          <textarea id="st-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} /></div>
        {err ? <p className="err" id="st-err" role="alert">{err}</p> : null}
        <p className="t-small muted">These are the options you can ask to be quoted; the quotation confirms what is possible for your order.</p>
        <div className="buy__actions">
          <button type="button" className="btn btn--primary" onClick={toInquiry}>Add the design to my inquiry</button>
          <button type="button" className="btn btn--secondary" onClick={download}>Download the concept preview</button>
          <button type="button" className="btn-text" onClick={save}>Save the design</button>
        </div>
        <p className="status-line" role="status">{status ? <span key={statusN} className="status-line__msg">{status}</span> : null}{status.includes('inquiry list') ? <> <a className="link" href={`/${locale}/inquiry`}>Send the inquiry</a></> : null}</p>
      </form>
    </div>
  );
}
