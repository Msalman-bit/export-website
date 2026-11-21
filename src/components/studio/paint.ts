import * as THREE from 'three';

/* Free paint: strokes drawn on the ball itself, across the seams (on a real ball, printed artwork). A stroke keeps
   its points as directions from the ball's centre in the ball's own frame (the frame of footballPanels()), so it
   turns with the ball and lands in the same place in the 3D view, where it is stamped onto a cube of six canvases
   that every panel reads its paint from, and in the Flat drawing. */

export type BrushSize = 's' | 'm' | 'l';
export type BrushKind = 'brush' | 'spray';
export type Brush = { colour: string; size: BrushSize; kind: BrushKind };
export type Stroke = Brush & { seed: number; pts: number[] };
export type Tool = 'turn' | 'panel' | 'free';

/** the brush's radius as an angle on the ball, in radians (the ball is 2 wide, so medium is about 3.5% of it) */
export const RADIUS: Record<BrushSize, number> = { s: 0.035, m: 0.07, l: 0.13 };
const SPRAY_DOTS: Record<BrushSize, number> = { s: 14, m: 26, l: 44 };

/** a small seeded random sequence, so a spray stroke redraws dot for dot */
export function rng(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3();
const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), UP = new THREE.Vector3();

/** Calls `out(x, y, z, r, a)` for every mark of the stroke from point `from` on: a round dab every 30% of the brush
    radius along the line (brush), or, every 60% (spray), a faint mist with a scatter of fine dots over it. `a` is the
    mark's opacity. Points are on the unit
    sphere and `r` is an angle. With the same `rnd`, a stroke drawn in one go or point by point makes the same marks. */
export function marks(st: Stroke, from: number, rnd: () => number, out: (x: number, y: number, z: number, r: number, a: number) => void) {
  const r = RADIUS[st.size];
  const n = st.pts.length / 3;
  const dab = (d: THREE.Vector3) => {
    if (st.kind === 'brush') { out(d.x, d.y, d.z, r, 1); return; }
    out(d.x, d.y, d.z, r * 0.8, 0.1);
    UP.set(0, 1, 0);
    if (Math.abs(d.y) > 0.9) UP.set(1, 0, 0);
    T1.crossVectors(d, UP).normalize();
    T2.crossVectors(d, T1);
    for (let k = 0; k < SPRAY_DOTS[st.size]; k++) {
      const th = rnd() * Math.PI * 2, rho = r * Math.sqrt(rnd());
      P.copy(d).addScaledVector(T1, Math.cos(th) * rho).addScaledVector(T2, Math.sin(th) * rho).normalize();
      out(P.x, P.y, P.z, r * (0.025 + rnd() * 0.045), 0.9);
    }
  };
  for (let i = from; i < n; i++) {
    B.fromArray(st.pts, i * 3);
    if (i === 0) { dab(C.copy(B)); continue; }
    A.fromArray(st.pts, (i - 1) * 3);
    const steps = Math.max(1, Math.ceil(A.angleTo(B) / (r * (st.kind === 'brush' ? 0.3 : 0.6))));
    for (let k = 1; k <= steps; k++) dab(C.copy(A).lerp(B, k / steps).normalize());
  }
}

/** adds a point to a stroke (rounded, so the stored stroke stays small) unless it is too close to the last one;
    returns the index of the new point, or -1 */
export function addPoint(st: Stroke, d: THREE.Vector3): number {
  const n = st.pts.length / 3;
  if (n) {
    A.fromArray(st.pts, (n - 1) * 3);
    if (A.angleTo(d) < RADIUS[st.size] * 0.25) return -1;
  }
  st.pts.push(Math.round(d.x * 1e4) / 1e4, Math.round(d.y * 1e4) / 1e4, Math.round(d.z * 1e4) / 1e4);
  return n;
}

export const newStroke = (b: Brush): Stroke => ({ ...b, seed: 1 + Math.floor(Math.random() * 2147483000), pts: [] });

/* ---------- the paint cube (3D) ---------- */

/** each face of the paint cube is a square canvas this many pixels wide */
export const FACE = 512;

/** where a direction lands on a face of the cube, in WebGL's cube-map layout (+x, -x, +y, -y, +z, -z):
    [how squarely it faces it, across, down] */
function onFace(f: number, x: number, y: number, z: number): [number, number, number] {
  switch (f) {
    case 0: return [x, -z, -y];
    case 1: return [-x, z, -y];
    case 2: return [y, x, z];
    case 3: return [-y, x, -z];
    case 4: return [z, x, -y];
    default: return [-z, -x, -y];
  }
}

/** a round mark on every face it reaches (a mark near a cube edge lands on both faces, so strokes run on unbroken) */
export function stampCube(ctxs: CanvasRenderingContext2D[], colour: string, x: number, y: number, z: number, r: number, a = 1) {
  for (let f = 0; f < 6; f++) {
    const [ma, sc, tc] = onFace(f, x, y, z);
    if (ma < 0.3) continue;
    const rad = (r / Math.pow(ma, 1.5)) * (FACE / 2);
    const px = ((sc / ma + 1) / 2) * FACE, py = ((tc / ma + 1) / 2) * FACE;
    if (px < -rad || py < -rad || px > FACE + rad || py > FACE + rad) continue;
    const g = ctxs[f];
    g.fillStyle = colour;
    g.globalAlpha = a;
    g.beginPath(); g.arc(px, py, Math.max(0.6, rad), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
}

/** clears the cube and draws every stroke again (after Undo, Start again or Clear) */
export function paintCube(ctxs: CanvasRenderingContext2D[], strokes: Stroke[]) {
  ctxs.forEach((g) => g.clearRect(0, 0, FACE, FACE));
  for (const st of strokes) marks(st, 0, rng(st.seed), (x, y, z, r, a) => stampCube(ctxs, st.colour, x, y, z, r, a));
}

/** a short description of the free paint for the inquiry, e.g. "3 strokes: Crimson brush, Navy spray" */
export function describeStrokes(strokes: Stroke[], name: (hex: string) => string): string {
  if (!strokes.length) return '';
  const kinds = [...new Set(strokes.map((s) => `${name(s.colour)} ${s.kind}`))];
  const list = kinds.length > 6 ? `${kinds.slice(0, 6).join(', ')} and ${kinds.length - 6} more` : kinds.join(', ');
  return `${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}: ${list}`;
}
