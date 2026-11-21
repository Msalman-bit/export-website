'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Flat } from './Flat';
import type { BallLook } from './Ball3D';
import { footballPanels, startColours } from './football';
import { RUGBY_START } from './rugby';
import { describeStrokes, type Brush, type BrushKind, type BrushSize, type Stroke, type Tool } from './paint';
import { addToBasket } from '@/lib/basket';

const Ball3D = dynamic(() => import('./Ball3D').then((m) => m.Ball3D), { ssr: false });

type Model = 'football' | 'rugby' | 'glove' | 'jersey';
type Shape = 'football' | 'rugby';
type StudioProduct = {
  id: string; name: string; sku: string; model: Model; image?: string; href: string;
  /** the product's own sizes, construction and packaging, as the catalogue states them */
  sizes?: string[]; construction?: string; packaging?: string[];
};

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
  // the site states a rugby ball's four stitched panels and its pimpled grip, no materials or sizes: none are offered
  rugby: {
    place: [['front', 'Front panel'], ['side', 'Top panel'], ['both', 'Front and back panels']],
    materials: [], constructions: ['Four panels, stitched'], sizes: [], packaging: ['Single polybag', 'Retail box', 'Mesh bag of 10', 'Bulk carton'],
  },
};

/** the Details step's choices for one product: its own sizes and packaging where the catalogue lists them; a ball
    offers only the constructions its product names; a handball (the 32-panel ball) chooses its grip, for play with
    or without resin, as the site says */
type Opts = (typeof OPTIONS)[Model] & { materialLabel: string };
function optionsFor(p: StudioProduct | undefined): Opts {
  const base = OPTIONS[p?.model ?? 'football'];
  const handball = p?.model === 'football' && /handball/i.test(p.name);
  let materials = base.materials, constructions = base.constructions;
  if (handball) { materials = ['For play with resin', 'For play without resin']; constructions = ['Hand-stitched', 'Machine-stitched']; }
  if (p?.model === 'football' && p.construction) {
    const named = constructions.filter((c) => new RegExp(c.split(' ')[0], 'i').test(p.construction!));
    if (named.length) constructions = named;
  }
  return {
    place: base.place, materials, materialLabel: handball ? 'Grip' : 'Material', constructions,
    sizes: p?.sizes?.length ? p.sizes : base.sizes, packaging: p?.packaging?.length ? p.packaging : base.packaging,
  };
}

const STEPS = ['Product', 'Colours', 'Logo', 'Details'] as const;

/* the paint tools for the football: turn the ball (a tap still paints one panel), sweep panels, or paint freely */
const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const TOOLS: [Tool, string, React.ReactNode][] = [
  ['turn', 'Turn', <path key="t" {...ICON} d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />],
  ['panel', 'Panels', <path key="p" {...ICON} d="M12 3.5 19.4 7.8v8.4L12 20.5l-7.4-4.3V7.8L12 3.5Z" />],
  ['free', 'Free paint', <path key="f" {...ICON} d="M14.5 5.5l4 4M4 20s.6-3.4 2.2-5l8.6-8.6a2.8 2.8 0 0 1 4 4l-8.6 8.6C8.6 20.6 4 20 4 20Z" />],
];
const TOOL_HINT: Record<Tool, string> = {
  turn: 'Drag to turn the ball. Tap a panel to paint it in the colour below.',
  panel: 'Drag across the ball: every panel you touch takes the colour. Use Turn to see the other side.',
  free: 'Draw anywhere on the ball, across the seams. Use Turn to see the other side.',
};
// the Flat view lays all 32 panels out at once: nothing to turn, so the first tool just taps
const TAP_ICON = <path key="tap" {...ICON} d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />;
const FLAT_HINT = (n: number): Record<Tool, string> => ({
  turn: `All ${n} panels, laid flat as they are cut. Tap a panel to paint it in the colour below.`,
  panel: 'Drag across the panels: every panel you touch takes the colour.',
  free: 'Draw on any panel. Switch to 3D to see the design on the ball.',
});
const SIZES: [BrushSize, string][] = [['s', 'Small brush'], ['m', 'Medium brush'], ['l', 'Large brush']];
const PANELS = footballPanels(); // 12 pentagons, then 20 hexagons
const START = startColours(PANELS);
/* each ball's panels: their kinds and names, its starting colours and its whole-ball shortcuts. The 32-panel ball is
   the football's, the futsal ball's and the handball's; the rugby ball has four panels running tip to tip. */
const BALL: Record<Shape, { kinds: string[]; start: string[]; words: Record<string, [string, string, string, string]>; whole: [string, (i: number) => boolean][] }> = {
  football: {
    kinds: PANELS.map((p) => p.kind), start: START,
    words: { hex: ['hexagon', 'hexagons', 'hex', 'hex'], pent: ['pentagon', 'pentagons', 'pent', 'pent'] },
    whole: [['All hexagons', (i) => PANELS[i].kind === 'hex'], ['All pentagons', (i) => PANELS[i].kind === 'pent'], ['Whole ball', () => true]],
  },
  rugby: {
    kinds: RUGBY_START.map(() => 'panel'), start: RUGBY_START,
    words: { panel: ['panel', 'panels', 'panel', 'panels'] },
    whole: [['Every other panel', (i) => i % 2 === 0], ['Whole ball', () => true]],
  },
};
const colourName = (hex: string) => COLOURS.find(([, h]) => h === hex)?.[0] ?? hex.toUpperCase();

/* The customisation studio, in four steps beside a product that never leaves the screen: the ball (or the glove or
   the shirt) stays in view, on a phone pinned under the header while the steps scroll beneath it, and the main action
   stays in reach in a bar at the foot of the steps. A football is painted the way it is made: one colour per panel,
   picked from the palette and laid on with a tap or a sweep of the panel brush (12 pentagons, 20 hexagons), with
   whole-ball shortcuts, Undo and Start again; or freely, with a brush or a spray across the seams, which on a real
   ball is printed artwork (said so beside the tool, and the quotation confirms it). A glove or a shirt takes a main,
   a second and an accent colour. On a phone or a tablet the paint controls sit in one compact block under the ball:
   the tools and Undo in a row, the colours in one row that swipes sideways. The design goes into the inquiry with
   its picture and the logo attached; every preview is labelled as a visual concept. */
export function Studio({ locale, products, initialId, signedIn }: { locale: string; products: StudioProduct[]; initialId?: string; signedIn: boolean }) {
  const [productId, setProductId] = useState(initialId && products.some((p) => p.id === initialId) ? initialId : products[0]?.id);
  const product = products.find((p) => p.id === productId) ?? products[0];
  const model = product?.model ?? 'football';
  const opts = optionsFor(product);
  const isBall = model === 'football' || model === 'rugby';
  const shape: Shape = model === 'rugby' ? 'rugby' : 'football';
  const spec = BALL[shape];
  const [step, setStep] = useState(0);
  // a ball: one colour per panel, free paint, and the steps back, kept for each kind of ball (a design on the
  // football waits while the rugby ball is painted)
  type Kept = { paint: string[]; strokes: Stroke[] };
  const [designs, setDesigns] = useState<Record<Shape, Kept>>({ football: { paint: START, strokes: [] }, rugby: { paint: RUGBY_START, strokes: [] } });
  const [histories, setHistories] = useState<Record<Shape, Kept[]>>({ football: [], rugby: [] });
  const paint = designs[shape].paint, strokes = designs[shape].strokes, history = histories[shape];
  const setPaint = (v: string[]) => setDesigns((d) => ({ ...d, [shape]: { ...d[shape], paint: v } }));
  const setStrokes = (v: Stroke[]) => setDesigns((d) => ({ ...d, [shape]: { ...d[shape], strokes: v } }));
  const setHistory = (fn: (h: Kept[]) => Kept[]) => setHistories((all) => ({ ...all, [shape]: fn(all[shape]) }));
  const [brush, setBrush] = useState<string>('#1b2a4a');
  const [tool, setTool] = useState<Tool>('panel');
  const [brushSize, setBrushSize] = useState<BrushSize>('m');
  const [brushKind, setBrushKind] = useState<BrushKind>('brush');
  // a glove or a shirt: three colours
  const [primary, setPrimary] = useState('#f4f4f2');
  const [secondary, setSecondary] = useState('#141414');
  const [accent, setAccent] = useState('#c5f900');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoName, setLogoName] = useState('');
  const [place, setPlace] = useState<BallLook['logoPlace']>('front');
  const [material, setMaterial] = useState(opts.materials[0] ?? '');
  const [size, setSize] = useState(opts.sizes[0] ?? '');
  const [construction, setConstruction] = useState(opts.constructions[0] ?? '');
  const [packaging, setPackaging] = useState(opts.packaging[0] ?? '');
  const [quantity, setQuantity] = useState('500');
  const [notes, setNotes] = useState('');
  const [gl, setGl] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [view, setView] = useState<'3d' | '2d'>('3d');
  // the side of the ball in view when the 3D ball was last shown, to come back to it (for the same kind of ball)
  const [turn, setTurn] = useState<{ shape: Shape; q: number[] } | undefined>();
  const onView = useCallback((q: number[], s: Shape) => setTurn({ shape: s, q }), []);
  const [status, setStatus] = useState('');
  const [statusN, setStatusN] = useState(0);
  const say = (s: string) => { setStatus(s); setStatusN((x) => x + 1); };
  const [err, setErr] = useState('');
  const snap = useRef<(() => string) | null>(null);
  const flatRef = useRef<SVGSVGElement>(null);
  // the football's flat pattern, drawn out of sight only while its picture is taken for the inquiry
  const netRef = useRef<SVGSVGElement>(null);
  const [netShot, setNetShot] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setGl(c.getContext('webgl2') || c.getContext('webgl') ? 'yes' : 'no');
    } catch { setGl('no'); }
  }, []);

  // each product has its own choices
  useEffect(() => {
    const o = optionsFor(product);
    setMaterial(o.materials[0] ?? ''); setSize(o.sizes[0] ?? ''); setConstruction(o.constructions[0] ?? ''); setPackaging(o.packaging[0] ?? ''); setPlace('front');
  }, [product?.id]);

  const look: BallLook = useMemo(() => ({ primary, secondary, accent, logo, logoPlace: place, panels: isBall ? paint : undefined, strokes: isBall ? strokes : undefined }),
    [primary, secondary, accent, logo, place, paint, strokes, isBall]);
  const show3d = isBall && gl === 'yes' && view === '3d';
  const onFail = useCallback(() => setGl('no'), []);
  const onReady = useCallback((fn: () => string) => { snap.current = fn; }, []);

  /* ---------- painting ---------- */
  // every change keeps the step before it (50 steps back); one drag of a brush is one step
  const paintNow = useRef(paint);
  paintNow.current = paint;
  const strokesNow = useRef(strokes);
  strokesNow.current = strokes;
  const remember = () => setHistory((h) => [...h.slice(-49), { paint: paintNow.current, strokes: strokesNow.current }]);
  const apply = (next: string[], nextStrokes = strokes) => {
    if (next.every((c, i) => c === paint[i]) && (nextStrokes === strokes || (!nextStrokes.length && !strokes.length))) return;
    remember();
    setDesigns((d) => ({ ...d, [shape]: { paint: next, strokes: nextStrokes } }));
  };
  const dragKept = useRef(false);
  const paintPanel = useCallback((i: number, n: number) => {
    if (n === 0) dragKept.current = false;
    const cur = paintNow.current;
    if (cur[i] === brush) return;
    if (!dragKept.current) { setHistory((h) => [...h.slice(-49), { paint: cur, strokes: strokesNow.current }]); dragKept.current = true; }
    const next = cur.slice(); next[i] = brush;
    paintNow.current = next; // the next panel of a sweep, or a quick second tap, builds on this one
    setPaint(next);
  }, [brush, shape]);
  const addStroke = useCallback((st: Stroke) => {
    const cur = strokesNow.current;
    setHistory((h) => [...h.slice(-49), { paint: paintNow.current, strokes: cur }]);
    const next = [...cur, st];
    strokesNow.current = next;
    setStrokes(next);
  }, [shape]);
  const undo = () => {
    const h = history[history.length - 1];
    if (!h) return;
    setDesigns((d) => ({ ...d, [shape]: h })); setHistory((all) => all.slice(0, -1));
  };
  const brushStyle: Brush = useMemo(() => ({ colour: brush, size: brushSize, kind: brushKind }), [brush, brushSize, brushKind]);
  const freeText = describeStrokes(strokes, colourName);
  const paintable = isBall && step === 1;
  // the colours on the ball, each with how many panels of each kind carry it
  const used = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    paint.forEach((c, i) => { const e = m.get(c) ?? {}; const k = spec.kinds[i]; e[k] = (e[k] ?? 0) + 1; m.set(c, e); });
    return [...m.entries()];
  }, [paint, spec]);
  const kinds = Object.keys(spec.words);
  const count = (e: Record<string, number>, short: boolean) => kinds.filter((k) => e[k]).map((k) => `${e[k]} ${spec.words[k][(short ? 2 : 0) + (e[k] === 1 ? 0 : 1)]}`);
  const usedText = used.map(([c, e]) => `${colourName(c)}: ${count(e, false).join(', ')}`).join('; ');

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
    ...(isBall ? { colours: usedText, ...(freeText ? { freePaint: `${freeText} (printed artwork, to be confirmed in the quotation)` } : {}) } : { primary: `${colourName(primary)} (${primary})`, secondary: `${colourName(secondary)} (${secondary})`, accent: `${colourName(accent)} (${accent})` }),
    logo: logo ? logoName || 'logo.png' : 'none', logoPlacement: opts.place.find(([v]) => v === place)?.[1],
    ...(material ? { [opts.materialLabel.toLowerCase()]: material } : {}), ...(size ? { size } : {}), ...(construction ? { construction } : {}),
    packaging, quantity: Number(quantity) || 0, instructions: notes,
  });
  const summary = [product?.name, isBall ? `${used.length} ${used.length === 1 ? 'colour' : 'colours'}${strokes.length ? ' + free paint' : ''}` : colourName(primary), logo ? `logo on ${opts.place.find(([v]) => v === place)?.[1].toLowerCase()}` : 'no logo yet'].filter(Boolean).join(' · ');

  const svgPicture = async (svg: SVGSVGElement | null): Promise<string> => {
    if (!svg) return '';
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = c.height = 1200;
    c.getContext('2d')!.drawImage(img, 0, 0, 1200, 1200); URL.revokeObjectURL(url);
    return c.toDataURL('image/png');
  };
  const picture = async (): Promise<string> => (show3d && snap.current ? snap.current() : svgPicture(flatRef.current));
  // the picture that travels with the inquiry: on the stage's dark ground, at most 900px, as JPEG
  const smallPicture = async (from: () => Promise<string> = picture): Promise<string> => {
    const src = await from().catch(() => '');
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
    const freeLine = freeText ? `Free paint: ${freeText}` : '';
    const build = [material, construction, size].filter(Boolean).join(' · ');
    const lines = [colourLine.length > 78 ? `${colourLine.slice(0, 77)}…` : colourLine, ...(freeLine ? [freeLine.length > 78 ? `${freeLine.slice(0, 77)}…` : freeLine] : []), `Logo: ${cf.logo} (${cf.logoPlacement})`, ...(build ? [build] : []), `Quantity: ${cf.quantity} · ${cf.packaging}`];
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
      // a ball also sends its flat pattern: every panel with its colour, the logo and the free paint
      if (isBall) {
        setNetShot(true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const pattern = await smallPicture(() => svgPicture(netRef.current));
        setNetShot(false);
        if (pattern) { try { localStorage.setItem(`ms_net_${key}`, pattern); } catch { /* the pattern can be downloaded from the Flat view */ } }
      }
    }
    navigator.sendBeacon?.('/api/events', JSON.stringify({ name: 'studio_to_inquiry', productId: product?.id, path: location.pathname }));
    const sent = ['its picture', ...(isBall ? ['its flat pattern'] : []), ...(logo ? ['the logo'] : [])];
    say(`Your design is on the inquiry list, with ${sent.length > 1 ? `${sent.slice(0, -1).join(', ')} and ${sent[sent.length - 1]}` : sent[0]} attached.`);
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
  // a choice in the Details step: several options as buttons, a single one as a plain line, none at all left out
  const choice = (legend: string, name: string, list: string[], value: string, set: (v: string) => void) =>
    list.length > 1 ? <fieldset><legend>{legend}</legend>{seg(name, list, value, set)}</fieldset>
      : list.length === 1 ? <p className="studio__fixed"><span>{legend}</span>{list[0]}</p> : null;
  const next = step < STEPS.length - 1 ? (
    <button type="button" className="btn btn--secondary studio__next" onClick={() => { setStep(step + 1); tabRefs.current[step + 1]?.focus(); }}>Continue to {STEPS[step + 1].toLowerCase()}</button>
  ) : null;

  return (
    <div className="studio">
      <div className="studio__stage">
        <div className="studio__canvas" data-paint={paintable ? '' : undefined}>
          {show3d
            ? <Ball3D look={look} onFail={onFail} onReady={onReady} onPaint={paintable ? paintPanel : undefined} onStroke={addStroke} tool={tool} brush={brushStyle}
                view={turn?.shape === shape ? turn.q : undefined} onView={onView} shape={shape} />
            : <Flat ref={flatRef} model={model} variant={/boxing/i.test(product?.name ?? '') ? 'boxing' : undefined} look={look} onPaint={paintable ? paintPanel : undefined}
                onStroke={addStroke} tool={tool} brush={brushStyle}
                label={isBall ? `${product.name}: ${usedText}${freeText ? `; free paint, ${freeText}` : ''}` : `${product.name} in ${colourName(primary)}, ${colourName(secondary)} and ${colourName(accent)}`} />}
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
              <p className="studio__lead">Choose what to design. Balls are painted panel by panel or with a free brush; gloves and kit take three colours.</p>
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
                {/* the tools, with Undo beside them: one row of big buttons, in reach of a thumb */}
                <div className="paint-tools" role="group" aria-label="Tool">
                  {TOOLS.map(([v, l, icon]) => (
                    <button key={v} type="button" aria-pressed={tool === v} onClick={() => setTool(v)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">{v === 'turn' && !show3d ? TAP_ICON : icon}</svg>{v === 'turn' && !show3d ? 'Tap' : l}
                    </button>
                  ))}
                  <button type="button" className="paint-tools__undo" disabled={!history.length} onClick={undo} aria-label="Undo" title="Undo">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
                <p className="paint-hint">{(show3d ? TOOL_HINT : FLAT_HINT(spec.kinds.length))[tool]}</p>
                <div className="paint-colours">
                  <p className="paint-colours__name">Colour <span className="studio__pick">{colourName(brush)}</span></p>
                  {swatchRow(brush, setBrush, 'Paint colour')}
                </div>
                {tool === 'free' ? (
                  <>
                    <div className="paint-brush">
                      <div className="paint-sizes" role="group" aria-label="Brush size">
                        {SIZES.map(([v, l]) => (
                          <button key={v} type="button" className={`paint-size paint-size--${v}`} aria-pressed={brushSize === v} aria-label={l} title={l} onClick={() => setBrushSize(v)}>
                            <span style={{ background: brush }} />
                          </button>
                        ))}
                      </div>
                      <div className="paint-kinds" role="group" aria-label="Brush or spray">
                        <button type="button" className="chip-btn" aria-pressed={brushKind === 'brush'} onClick={() => setBrushKind('brush')}>Brush</button>
                        <button type="button" className="chip-btn" aria-pressed={brushKind === 'spray'} onClick={() => setBrushKind('spray')}>Spray</button>
                      </div>
                    </div>
                    <p className="paint-print">Free paint is printed onto the panels as artwork. Send it with your inquiry: the quotation confirms whether your design can be printed.</p>
                  </>
                ) : (
                  <div className="studio__tools" role="group" aria-label="Paint whole parts">
                    {spec.whole.map(([label, on]) => (
                      <button key={label} type="button" className="chip-btn" onClick={() => apply(paint.map((c, i) => (on(i) ? brush : c)))}>{label}</button>
                    ))}
                  </div>
                )}
                <div className="studio__tools">
                  {strokes.length ? <button type="button" className="btn-text" onClick={() => apply(paint, [])}>Clear free paint</button> : null}
                  <button type="button" className="btn-text" onClick={() => apply(spec.start, [])}>Start again</button>
                </div>
                <div className="studio__used" aria-label="Colours on the ball">
                  {used.map(([c, e]) => (
                    <span key={c}><span className="studio__dot" style={{ background: c }} aria-hidden="true" />{colourName(c)} <span className="muted">{count(e, true).join(' · ')}</span></span>
                  ))}
                  {strokes.length ? <span><span className="studio__dot studio__dot--free" aria-hidden="true" />Free paint <span className="muted">{strokes.length} {strokes.length === 1 ? 'stroke' : 'strokes'}</span></span> : null}
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
              {choice(opts.materialLabel, 'material', opts.materials, material, setMaterial)}
              {choice('Construction', 'construction', opts.constructions, construction, setConstruction)}
              {choice('Size', 'size', opts.sizes, size, setSize)}
              {choice('Packaging', 'packaging', opts.packaging, packaging, setPackaging)}
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
        {netShot && isBall ? (
          <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 600, height: 600, pointerEvents: 'none' }}>
            <Flat ref={netRef} model={shape} look={look} label="Flat pattern" />
          </div>
        ) : null}
        <p className="studio__note">Visual concept, not a production sample. Screen colours differ from printed and dyed materials; the sample you approve is the production reference.</p>
      </form>
    </div>
  );
}
