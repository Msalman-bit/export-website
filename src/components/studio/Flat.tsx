'use client';
import { forwardRef, useId, useMemo } from 'react';
import * as THREE from 'three';
import { footballPanels } from './football';
import type { BallLook } from './Ball3D';

/* The 2D views: the football as a drawing of the same 32 panels (the fallback when WebGL is missing, and the
   Flat view), a goalkeeper glove, a boxing glove and a shirt. Each is lit the same way (a key light from the top
   left, rounded shading on every padded or curved part, seams and stitching), so the colours read as a real
   product, not a flat icon. Pure SVG, so it also prints and downloads. */

type Props = { model: 'football' | 'glove' | 'jersey'; variant?: 'boxing'; look: BallLook; label: string; onPaint?: (panel: number) => void };

export const Flat = forwardRef<SVGSVGElement, Props>(function Flat({ model, variant, look, label, onPaint }, ref) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg ref={ref} viewBox="0 0 600 600" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
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
      <ellipse cx="300" cy={model === 'football' ? 516 : model === 'jersey' ? 538 : 552} rx={model === 'football' ? 160 : 180} ry="16" fill="#000" opacity=".6" filter={`url(#${id}-floor)`} />
      {model === 'football' ? <Ball look={look} onPaint={onPaint} />
        : model === 'glove' ? (variant === 'boxing' ? <BoxingGlove look={look} id={id} /> : <KeeperGlove look={look} id={id} />)
        : <Jersey look={look} id={id} />}
    </svg>
  );
});

/* seams: every piece gets the same dark edge, so overlapping pieces read as stitched together */
const EDGE = { stroke: '#000', strokeOpacity: 0.55, strokeWidth: 2.5, strokeLinejoin: 'round' as const };
const STITCH = { fill: 'none', stroke: '#8a8a8a', strokeOpacity: 0.7, strokeWidth: 1.6, strokeDasharray: '5 4', strokeLinecap: 'round' as const };

/* The ball's visible half, drawn as a lit sphere: every panel edge follows the ball's curve (sampled along the
   sphere, not a straight line), the part of a panel that turns away is folded onto the outline, and three layers
   of light sit over the colours: a soft groove along every seam (the panels look padded), a key light from the
   top left and a darker rim. With `onPaint`, a click or tap on a panel paints it (the same panel numbers as the
   3D ball). */
const R = 202, CX = 300, CY = 282;

function Ball({ look, onPaint }: { look: BallLook; onPaint?: (panel: number) => void }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const shapes = useMemo(() => {
    const panels = footballPanels();
    // turn the ball so one of the starting design's accent hexagons faces the viewer, a little right of the middle
    const accent = panels.find((p, i) => p.kind === 'hex' && i % 7 === 3) ?? panels[0];
    const q = new THREE.Quaternion().setFromUnitVectors(accent.center.clone().normalize(), new THREE.Vector3(0.24, 0.1, 1).normalize());
    const at = (v: THREE.Vector3) => {
      const p = v.clone().normalize().applyQuaternion(q);
      if (p.z >= 0) return { x: CX + p.x * R, y: CY - p.y * R, z: p.z };
      const l = Math.hypot(p.x, p.y) || 1; // behind the ball: folded onto its outline
      return { x: CX + (p.x / l) * R, y: CY - (p.y / l) * R, z: p.z };
    };
    return panels.map((p, i) => {
      const pts: { x: number; y: number; z: number }[] = [];
      p.corners.forEach((a, k) => {
        const b = p.corners[(k + 1) % p.corners.length];
        for (let s = 0; s < 10; s++) pts.push(at(a.clone().lerp(b, s / 10)));
      });
      if (pts.every((v) => v.z < 0.01)) return null; // wholly on the far side
      // rounded, so the server's drawing and the browser's agree to the digit (no hydration mismatch)
      const d = pts.map((v, k) => `${k ? 'L' : 'M'}${v.x.toFixed(1)} ${v.y.toFixed(1)}`).join(' ') + 'Z';
      const c = at(p.center);
      return { d, kind: p.kind, i, z: Math.round(c.z * 1000) / 1000, cx: Math.round(c.x), cy: Math.round(c.y) };
    }).filter(Boolean) as { d: string; kind: string; i: number; z: number; cx: number; cy: number }[];
  }, []);
  const front = shapes.filter((s) => s.kind === 'hex').reduce((a, b) => (b.z > a.z ? b : a), shapes[0]);
  const fill = (s: { kind: string; i: number }) => look.panels?.[s.i] ?? (s.kind === 'pent' ? look.secondary : s.i % 7 === 3 ? look.accent : look.primary);
  return (
    <g>
      <defs>
        <clipPath id={`${id}-ball`}><circle cx={CX} cy={CY} r={R} /></clipPath>
        <radialGradient id={`${id}-key`} cx="0.34" cy="0.28" r="0.72">
          <stop offset="0" stopColor="#fff" stopOpacity=".34" />
          <stop offset=".38" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".62" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-rim`} cx="0.42" cy="0.38" r="0.66">
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset=".86" stopColor="#000" stopOpacity=".32" />
          <stop offset="1" stopColor="#000" stopOpacity=".62" />
        </radialGradient>
        <radialGradient id={`${id}-shine`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <g clipPath={`url(#${id}-ball)`}>
        <circle cx={CX} cy={CY} r={R} fill="#111" />
        {shapes.map((s) => (
          <path key={s.i} d={s.d} fill={fill(s)} onClick={onPaint ? () => onPaint(s.i) : undefined}
            style={onPaint ? { cursor: 'pointer', transition: 'fill 150ms' } : undefined} />
        ))}
        {look.logo ? <image href={look.logo} x={front.cx - 46} y={front.cy - 46} width="92" height="92" preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none' }} /> : null}
        {/* the light, laid over the colours; none of it catches a tap */}
        <g style={{ pointerEvents: 'none' }}>
          <g filter={`url(#${id}-soft)`} fill="none" stroke="#000" strokeOpacity=".3" strokeWidth="11" strokeLinejoin="round">
            {shapes.map((s) => <path key={s.i} d={s.d} />)}
          </g>
          <g fill="none" stroke="#0a0a0a" strokeOpacity=".85" strokeWidth="2.4" strokeLinejoin="round">
            {shapes.map((s) => <path key={s.i} d={s.d} />)}
          </g>
          <circle cx={CX} cy={CY} r={R} fill={`url(#${id}-key)`} />
          <circle cx={CX} cy={CY} r={R} fill={`url(#${id}-rim)`} />
          <ellipse cx={CX - R * 0.36} cy={CY - R * 0.44} rx={R * 0.2} ry={R * 0.11} fill={`url(#${id}-shine)`} transform={`rotate(-32 ${CX - R * 0.36} ${CY - R * 0.44})`} />
        </g>
      </g>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#000" strokeOpacity=".5" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
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
