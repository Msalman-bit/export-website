'use client';
import { forwardRef, useId, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { footballPanels, logoSpots } from './football';
import { footballNet, type FlatNet } from './net';
import { RUGBY_SPOTS, rugbyNet } from './rugby';
import type { BallLook } from './Ball3D';
import { addPoint, marks, newStroke, rng, type Brush, type Stroke, type Tool } from './paint';

/* The 2D views: the football laid flat, all 32 panels as they are cut (the Flat view, and the fallback when WebGL
   is missing), a goalkeeper glove, a boxing glove and a shirt. The gloves and the shirt are lit the same way (a key
   light from the top left, rounded shading on every padded or curved part, seams and stitching), so the colours
   read as a real product, not a flat icon. Pure SVG, so it also prints and downloads. */

type Props = {
  model: 'football' | 'rugby' | 'glove' | 'jersey'; variant?: 'boxing'; look: BallLook; label: string;
  onPaint?: (panel: number, n: number) => void; onStroke?: (stroke: Stroke) => void; tool?: Tool; brush?: Brush;
};

export const Flat = forwardRef<SVGSVGElement, Props>(function Flat({ model, variant, look, label, onPaint, onStroke, tool = 'turn', brush }, ref) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const brushing = (model === 'football' || model === 'rugby') && !!onPaint && tool !== 'turn';
  return (
    <svg ref={ref} viewBox="0 0 600 600" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg" style={brushing ? { touchAction: 'none' } : undefined}>
      <defs>
        <radialGradient id={`${id}-room`} cx="0.5" cy="0.42" r="0.7">
          <stop offset="0" stopColor="#1d2025" />
          <stop offset="1" stopColor="#0b0c0e" />
        </radialGradient>
        <filter id={`${id}-floor`} x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="10" /></filter>
        {/* shared light for the gloves and the shirt */}
        <linearGradient id={`${id}-side`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".2" />
          <stop offset=".38" stopColor="#fff" stopOpacity=".03" />
          <stop offset=".62" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${id}-cyl`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".34" />
          <stop offset=".24" stopColor="#000" stopOpacity="0" />
          <stop offset=".4" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".36" />
        </linearGradient>
        <radialGradient id={`${id}-dome`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset=".35" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".7" stopColor="#000" stopOpacity=".08" />
          <stop offset="1" stopColor="#000" stopOpacity=".5" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect width="600" height="600" fill={`url(#${id}-room)`} />
      {model === 'football' || model === 'rugby' ? null : <ellipse cx="300" cy={model === 'jersey' ? 538 : 552} rx="180" ry="16" fill="#000" opacity=".6" filter={`url(#${id}-floor)`} />}
      {model === 'football' ? <NetBall net={footballNet()} spots={SPOTS} fallback={footballFill} look={look} onPaint={onPaint} onStroke={onStroke} tool={tool} brush={brush} />
        : model === 'rugby' ? <NetBall net={rugbyNet()} spots={RUGBY_SPOTS} fallback={(i, l) => (i % 2 ? l.primary : l.accent)} look={look} onPaint={onPaint} onStroke={onStroke} tool={tool} brush={brush} />
        : model === 'glove' ? (variant === 'boxing' ? <BoxingGlove look={look} id={id} /> : <KeeperGlove look={look} id={id} />)
        : <Jersey look={look} id={id} />}
    </svg>
  );
});

/* seams: every piece gets the same dark edge, so overlapping pieces read as stitched together */
const EDGE = { stroke: '#000', strokeOpacity: 0.55, strokeWidth: 2.5, strokeLinejoin: 'round' as const };
const STITCH = { fill: 'none', stroke: '#8a8a8a', strokeOpacity: 0.7, strokeWidth: 1.6, strokeDasharray: '5 4', strokeLinecap: 'round' as const };

/* A ball laid flat: its panels as they are cut (the football's 32, see net.ts; the rugby ball's four leaves, see
   rugby.ts), each in its colour with a soft padded shading,
   a stitch line inside every edge and the seams in dark, as the pieces lie on the table before they are joined. The
   logo sits upright on its panel as it does on the ball, and free paint lands on every panel it crosses, cut at
   the panel's edge, so the pattern shows the whole design at once. With `onPaint` (the Colours step) the hand paints
   on the pattern too: a tap paints a panel; the panel brush paints every panel a drag crosses; free paint draws on
   whichever panel is under the finger (a stroke that leaves the pattern ends there, and the next panel starts a new
   one), mapped back onto the ball, so the 3D view shows it in the same place. */
const SPOTS = logoSpots(footballPanels());
const KINDS = footballPanels().map((p) => p.kind);
const footballFill = (i: number, l: BallLook) => (KINDS[i] === 'pent' ? l.secondary : i % 7 === 3 ? l.accent : l.primary);
const V = new THREE.Vector3();
const circle = (x: number, y: number, r: number) => {
  const s = r.toFixed(2), w = (2 * r).toFixed(2);
  return `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${s} ${s} 0 1 0 ${w} 0a${s} ${s} 0 1 0 -${w} 0`;
};

/** the strokes' marks, panel by panel (each panel's marks are cut at its edge), in the order they were painted */
function paintByPanel(net: FlatNet, strokes: Stroke[]): Map<number, React.ReactNode[]> {
  const by = new Map<number, React.ReactNode[]>();
  strokes.forEach((st, k) => {
    const solid = new Map<number, string[]>(), mist = new Map<number, string[]>();
    marks(st, 0, rng(st.seed), (x, y, z, r, a) => net.place(V.set(x, y, z), r, (i, px, py, pr) => {
      const m = a < 0.5 ? mist : solid;
      if (!m.has(i)) m.set(i, []);
      m.get(i)!.push(circle(px, py, pr));
    }));
    for (const i of new Set([...mist.keys(), ...solid.keys()])) {
      if (!by.has(i)) by.set(i, []);
      by.get(i)!.push(
        <g key={`${k}-${st.seed}`} fill={st.colour}>
          {(mist.get(i) ?? []).map((d, j) => <path key={j} d={d} fillOpacity=".1" />)}
          {solid.has(i) ? <path d={solid.get(i)!.join('')} fillOpacity={st.kind === 'spray' ? 0.9 : 1} /> : null}
        </g>,
      );
    }
  });
  return by;
}

function NetBall({ net, spots, fallback, look, onPaint, onStroke, tool, brush }: {
  net: FlatNet; spots: { front: number; side: number; back: number }; fallback: (i: number, look: BallLook) => string;
  look: BallLook; onPaint?: (panel: number, n: number) => void; onStroke?: (stroke: Stroke) => void; tool: Tool; brush?: Brush;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const shapes = useMemo(() => net.polys.map((p) => `M${p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`), [net]);
  // a stitch line just inside every edge
  const stitches = useMemo(() => net.polys.map((p, i) => {
    // about 5 units in from every edge, however long or round the piece (a rugby leaf or a hexagon)
    const [cx, cy] = net.centres[i];
    const w = Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
    const h = Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]));
    const sx = Math.max(0.5, 1 - 10 / w), sy = Math.max(0.5, 1 - 10 / h);
    return `M${p.map(([x, y]) => `${(cx + (x - cx) * sx).toFixed(1)} ${(cy + (y - cy) * sy).toFixed(1)}`).join('L')}Z`;
  }), [net]);
  const fill = (i: number) => look.panels?.[i] ?? fallback(i, look);
  const painted = useMemo(() => paintByPanel(net, look.strokes ?? []), [net, look.strokes]);
  const logoOn = look.logo ? (look.logoPlace === 'front' ? [spots.front] : look.logoPlace === 'side' ? [spots.side] : [spots.front, spots.back]) : [];
  const logoPx = net.logo;

  // the hand: one finger at a time; the stroke being drawn shows as it grows
  const drag = useRef<{ id: number; n: number; last: number; stroke: Stroke | null; panel: number } | null>(null);
  const [live, setLive] = useState<{ st: Stroke; n: number } | null>(null);
  const brushing = !!onPaint && tool !== 'turn';
  const panelAt = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest(`[data-net="${id}"] [data-panel]`);
    return el ? Number(el.getAttribute('data-panel')) : -1;
  };
  const end = () => {
    const g = drag.current;
    if (g?.stroke?.pts.length) onStroke?.(g.stroke);
    if (g) g.stroke = null;
    setLive(null);
  };
  const paintAt = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const i = panelAt(e);
    if (tool === 'panel') {
      if (i >= 0 && i !== g.last) { g.last = i; onPaint?.(i, g.n++); }
      return;
    }
    // off the pattern, or onto a panel that is not this one's neighbour in the pattern: the stroke ends there
    if (i < 0) { if (g.stroke) end(); g.panel = -1; return; }
    const m = (e.currentTarget as SVGGraphicsElement).ownerSVGElement?.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const d = net.fromNet(i, pt.x, pt.y);
    if (g.stroke && g.panel >= 0 && g.panel !== i) {
      const last = new THREE.Vector3().fromArray(g.stroke.pts, g.stroke.pts.length - 3);
      if (last.angleTo(d) > 0.25) end();
    }
    g.panel = i;
    if (!g.stroke) g.stroke = newStroke(brush ?? { colour: '#1b2a4a', size: 'm', kind: 'brush' });
    if (addPoint(g.stroke, d) >= 0) setLive({ st: g.stroke, n: g.stroke.pts.length });
  };
  const release = (e: React.PointerEvent, last: boolean) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    if (last) paintAt(e); // where the finger lifted is part of the stroke
    end();
    drag.current = null;
  };
  const handlers = brushing ? {
    onPointerDown: (e: React.PointerEvent) => {
      if (drag.current) return;
      e.preventDefault();
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* the drag still paints on the pattern */ }
      drag.current = { id: e.pointerId, n: 0, last: -1, stroke: null, panel: -1 };
      paintAt(e);
    },
    onPointerMove: (e: React.PointerEvent) => { if (drag.current?.id === e.pointerId) paintAt(e); },
    onPointerUp: (e: React.PointerEvent) => release(e, true),
    onPointerCancel: (e: React.PointerEvent) => release(e, false),
  } : {};
  const livePaint = live ? paintByPanel(net, [live.st]) : null;

  return (
    <g data-net={id} {...handlers} style={brushing ? { cursor: tool === 'free' ? 'crosshair' : 'pointer' } : undefined}>
      <defs>
        {shapes.map((d, i) => <clipPath key={i} id={`${id}-p${i}`}><path d={d} /></clipPath>)}
        {/* each panel padded: a little lighter in the middle, darker toward its seams */}
        <radialGradient id={`${id}-pad`} cx="0.42" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </radialGradient>
        <filter id={`${id}-lift`} x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity=".55" /></filter>
      </defs>
      {/* the pieces, lifted a little off the table */}
      <g filter={`url(#${id}-lift)`}>
        {shapes.map((d, i) => (
          <path key={i} d={d} fill={fill(i)} data-panel={i} onClick={onPaint && !brushing ? () => onPaint(i, 0) : undefined}
            style={onPaint ? { cursor: brushing ? undefined : 'pointer', transition: 'fill 150ms' } : undefined} />
        ))}
      </g>
      <g style={{ pointerEvents: 'none' }}>
        {logoOn.map((i) => {
          const [cx, cy] = net.centres[i];
          return <image key={i} href={look.logo!} x={cx - logoPx / 2} y={cy - logoPx / 2} width={logoPx} height={logoPx} preserveAspectRatio="xMidYMid meet" transform={`rotate(${net.up[i].toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`} />;
        })}
        {shapes.map((_, i) => {
          const marks = [...(painted.get(i) ?? []), ...(livePaint?.get(i) ?? [])];
          return marks.length ? <g key={i} clipPath={`url(#${id}-p${i})`}>{marks}</g> : null;
        })}
        {shapes.map((d, i) => <path key={i} d={d} fill={`url(#${id}-pad)`} />)}
        <g fill="none" stroke="#8a8a8a" strokeOpacity=".55" strokeWidth="1" strokeDasharray="3 3">
          {stitches.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g fill="none" stroke="#050505" strokeOpacity=".9" strokeWidth="1.6" strokeLinejoin="round">
          {shapes.map((d, i) => <path key={i} d={d} />)}
        </g>
      </g>
    </g>
  );
}

type Drawn = { look: BallLook; id: string };

/* a finger: straight sides, a round tip, open at the base (it runs into the back of the hand) */
const finger = (cx: number, top: number, w: number, base: number, close = true) =>
  `M${cx - w / 2} ${base}V${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${top + w / 2}V${base}${close ? 'Z' : ''}`;
const FINGERS = [
  { cx: 226, top: 136, w: 54, rot: -7 },
  { cx: 283, top: 104, w: 54, rot: -2 },
  { cx: 340, top: 118, w: 54, rot: 3 },
  { cx: 394, top: 162, w: 50, rot: 9 },
];

/* A goalkeeper glove from the back: main colour on the fingers, thumb and hand; second colour on the padded
   backhand and the cuff; accent on the finger spines and the strap tab */
function KeeperGlove({ look, id }: Drawn) {
  const back = 'M186 316Q186 300 202 300H420V424Q420 452 392 456H214Q186 452 186 424Z';
  const cuff = 'M214 440H392Q402 440 402 450V528Q402 542 388 542H218Q204 542 204 528V450Q204 440 214 440Z';
  const pad = 'M208 332Q302 312 398 332L402 414Q302 434 204 414Z';
  const thumb = { x: 176, y: 262, width: 58, height: 168, rx: 29, transform: 'rotate(-36 205 430)' };
  const fingerAt = (f: (typeof FINGERS)[number]) => `rotate(${f.rot} ${f.cx} 330)`;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-glove`}>
          <rect {...thumb} />
          <path d={back} />
          {FINGERS.map((f) => <path key={f.cx} d={finger(f.cx, f.top, f.w, 322)} transform={fingerAt(f)} />)}
          <path d={cuff} />
        </clipPath>
      </defs>
      <rect {...thumb} fill={look.primary} {...EDGE} />
      <rect {...thumb} fill={`url(#${id}-cyl)`} />
      <path d={cuff} fill={look.secondary} {...EDGE} />
      <path d={cuff} fill={`url(#${id}-cyl)`} />
      <path d={back} fill={look.primary} {...EDGE} />
      {FINGERS.map((f) => (
        <g key={f.cx} transform={fingerAt(f)}>
          <path d={finger(f.cx, f.top, f.w, 322)} fill={look.primary} />
          <path d={finger(f.cx, f.top, f.w, 322)} fill={`url(#${id}-cyl)`} />
          <rect x={f.cx - 4} y={f.top + 30} width="8" height={262 - f.top} rx="4" fill={look.accent} />
          <path d={finger(f.cx, f.top, f.w, 322, false)} fill="none" {...EDGE} />
        </g>
      ))}
      <path d={pad} fill={look.secondary} {...EDGE} />
      <path d="M218 342Q302 324 388 342L391 405Q302 423 215 405Z" {...STITCH} />
      <rect x="196" y="464" width="214" height="46" rx="10" fill={look.primary} {...EDGE} />
      <rect x="384" y="458" width="40" height="58" rx="12" fill={look.accent} {...EDGE} />
      {/* the light over the whole glove */}
      <g clipPath={`url(#${id}-glove)`} style={{ pointerEvents: 'none' }}>
        <rect x="60" y="80" width="400" height="480" fill={`url(#${id}-side)`} />
        <path d="M206 300Q302 286 418 300" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="10" filter={`url(#${id}-blur)`} />
      </g>
      <ellipse cx="303" cy="540" rx="92" ry="6" fill="#000" opacity=".45" />
      {look.logo ? (look.logoPlace === 'side'
        ? <image href={look.logo} x="232" y="469" width="140" height="36" preserveAspectRatio="xMidYMid meet" />
        : <image href={look.logo} x="242" y="340" width="120" height="68" preserveAspectRatio="xMidYMid meet" />) : null}
    </g>
  );
}

/* A boxing glove from the side, knuckles to the right, the way boxing gloves are usually shown: main colour on
   the fist and the thumb (which runs along the palm and joins the fist under the knuckles), second colour on the
   cuff, accent on the strap and the piping where the fist meets the cuff */
function BoxingGlove({ look, id }: Drawn) {
  const fist = 'M212 432C190 362 178 272 200 202C222 134 300 104 370 116C440 130 472 194 464 262C458 320 426 352 386 362C400 390 402 418 394 432Z';
  const thumb = 'M290 428C272 386 300 338 352 320C392 306 432 314 436 340C440 364 406 374 372 382C338 390 320 404 320 428Z';
  const cuff = 'M214 428H396L388 546Q387 556 376 556H228Q218 556 217 546Z';
  const strap = 'M212 458H398L395 512H215Z';
  return (
    <g>
      <defs>
        <clipPath id={`${id}-fist`}><path d={fist} /></clipPath>
        <clipPath id={`${id}-cuff`}><path d={cuff} /></clipPath>
      </defs>
      <path d={cuff} fill={look.secondary} {...EDGE} />
      <path d={strap} fill={look.accent} {...EDGE} />
      <path d="M222 466H390M224 504H388" {...STITCH} />
      <g clipPath={`url(#${id}-cuff)`} style={{ pointerEvents: 'none' }}>
        <rect x="214" y="428" width="182" height="128" fill={`url(#${id}-cyl)`} />
      </g>
      <path d={fist} fill={look.primary} {...EDGE} />
      <g clipPath={`url(#${id}-fist)`} style={{ pointerEvents: 'none' }}>
        <rect x="170" y="100" width="310" height="340" fill={`url(#${id}-dome)`} />
        {/* the soft dip where the fingers fold over into the knuckles */}
        <path d="M262 150C320 170 360 220 372 300" fill="none" stroke="#000" strokeOpacity=".14" strokeWidth="16" filter={`url(#${id}-blur)`} />
        <path d="M206 420C260 400 340 396 400 420" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth="18" filter={`url(#${id}-blur)`} />
      </g>
      <path d="M222 248C244 168 300 136 362 140" {...STITCH} />
      <path d={thumb} fill={look.primary} {...EDGE} />
      <path d={thumb} fill={`url(#${id}-cyl)`} style={{ pointerEvents: 'none' }} />
      <path d="M306 418C296 384 318 350 356 336C384 326 414 328 422 340" {...STITCH} />
      <path d="M212 432Q304 446 394 432" fill="none" stroke={look.accent} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="302" cy="554" rx="76" ry="5" fill="#000" opacity=".45" />
      {look.logo ? (look.logoPlace === 'side'
        ? <image href={look.logo} x="238" y="468" width="132" height="34" preserveAspectRatio="xMidYMid meet" />
        : <image href={look.logo} x="226" y="190" width="140" height="100" preserveAspectRatio="xMidYMid meet" />) : null}
    </g>
  );
}

/* A football shirt from the front: main colour on the body, second colour on the sleeves and side panels, accent
   on the collar and the sleeve cuffs; soft folds under the arms and at the waist */
function Jersey({ look, id }: Drawn) {
  const body = 'M226 112C246 128 270 138 300 138C330 138 354 128 374 112L430 138C424 170 422 200 424 232V500Q424 516 408 516H192Q176 516 176 500V232C178 200 176 170 170 138Z';
  const left = 'M170 138L118 162C104 170 98 182 94 196L72 262L150 290L176 232C178 200 176 170 170 138Z';
  const right = 'M430 138L482 162C496 170 502 182 506 196L528 262L450 290L424 232C422 200 424 170 430 138Z';
  return (
    <g>
      <defs>
        <clipPath id={`${id}-shirt`}><path d={body} /><path d={left} /><path d={right} /></clipPath>
        <clipPath id={`${id}-body`}><path d={body} /></clipPath>
      </defs>
      {/* the inside of the back, seen through the neck */}
      <path d="M238 104C256 118 276 126 300 126C324 126 344 118 362 104C340 92 260 92 238 104Z" fill="#0a0a0a" />
      <path d={left} fill={look.secondary} {...EDGE} />
      <path d={right} fill={look.secondary} {...EDGE} />
      <path d="M76 250L154 278L150 290L72 262Z" fill={look.accent} />
      <path d="M524 250L446 278L450 290L528 262Z" fill={look.accent} />
      <path d={body} fill={look.primary} {...EDGE} />
      <g clipPath={`url(#${id}-body)`}>
        <rect x="176" y="224" width="26" height="300" fill={look.secondary} />
        <rect x="398" y="224" width="26" height="300" fill={look.secondary} />
        <path d="M202 232V516M398 232V516" stroke="#000" strokeOpacity=".35" strokeWidth="1.5" />
      </g>
      <path d="M226 112C246 128 270 138 300 138C330 138 354 128 374 112L362 104C344 118 324 126 300 126C276 126 256 118 238 104Z" fill={look.accent} {...EDGE} />
      <path d="M186 502H414" {...STITCH} />
      <path d="M84 246L156 272M516 246L444 272" {...STITCH} />
      {/* the light and the folds */}
      <g clipPath={`url(#${id}-shirt)`} style={{ pointerEvents: 'none' }}>
        <rect x="60" y="90" width="480" height="440" fill={`url(#${id}-side)`} />
        <path d="M190 250Q236 300 230 380M410 250Q364 300 370 380" fill="none" stroke="#000" strokeOpacity=".2" strokeWidth="14" filter={`url(#${id}-blur)`} />
        <path d="M200 470Q300 452 400 470" fill="none" stroke="#000" strokeOpacity=".14" strokeWidth="12" filter={`url(#${id}-blur)`} />
        <path d="M250 170Q300 190 350 170" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="16" filter={`url(#${id}-blur)`} />
      </g>
      {look.logo ? (look.logoPlace === 'side'
        ? <image href={look.logo} x="330" y="176" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
        : <image href={look.logo} x="245" y="200" width="110" height="80" preserveAspectRatio="xMidYMid meet" />) : null}
    </g>
  );
}
