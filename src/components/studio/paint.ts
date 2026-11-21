import * as THREE from 'three';

/* Free paint: strokes drawn on the ball itself, across the seams (on a real ball, printed artwork). A stroke keeps
   its points as directions from the ball's centre in the ball's own frame (the frame of footballPanels()), so it
   turns with the ball and lands in the same place in the 3D view, where it is stamped onto a cube of six canvases
   that every panel reads its paint from, and in the Flat drawing. */

export type BrushSize = 's' | 'm' | 'l';
export type BrushKind = 'brush' | 'spray';
/** inside: each stroke stays inside the panel it starts on (like masking tape on a real ball) */
export type Brush = { colour: string; size: BrushSize; kind: BrushKind; inside?: boolean };
/** panel: the panel an "inside" stroke is held to (it paints nowhere else) */
export type Stroke = Brush & { seed: number; pts: number[]; panel?: number };
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

/** a panel's outline on each face of the paint cube, for strokes held inside it: null where the panel is not on
    that face. A panel is given by the planes through the ball's centre that bound it (inside: n · v >= 0); on a cube
    face those planes are straight lines, so the panel is a polygon there, cut from the face's square. */
export type FaceClip = (f: number) => [number, number][] | null;
export function faceClips(planes: number[][]): FaceClip {
  const cache = new Map<number, [number, number][] | null>();
  return (f) => {
    if (cache.has(f)) return cache.get(f)!;
    const [A, B, C] = FACE_AXES[f];
    const dot3 = (n: number[], v: number[]) => n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
    let poly: [number, number][] = [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]];
    for (const n of planes) {
      const a = dot3(n, A), b = dot3(n, B), c = dot3(n, C);
      const side = (p: [number, number]) => a + b * p[0] + c * p[1];
      const next: [number, number][] = [];
      poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
        if (sp >= 0) next.push(p);
        if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); next.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
      });
      poly = next;
      if (poly.length < 3) { cache.set(f, null); return null; }
    }
    const out = poly.map(([sc, tc]) => [((sc + 1) / 2) * FACE, ((tc + 1) / 2) * FACE] as [number, number]);
    cache.set(f, out);
    return out;
  };
}

/** a round mark on every face it reaches (a mark near a cube edge lands on both faces, so strokes run on unbroken);
    with `clip`, only inside the stroke's panel */
export function stampCube(ctxs: CanvasRenderingContext2D[], colour: string, x: number, y: number, z: number, r: number, a = 1, clip?: FaceClip) {
  for (let f = 0; f < 6; f++) {
    const [ma, sc, tc] = onFace(f, x, y, z);
    if (ma < 0.3) continue;
    const rad = (r / Math.pow(ma, 1.5)) * (FACE / 2);
    const px = ((sc / ma + 1) / 2) * FACE, py = ((tc / ma + 1) / 2) * FACE;
    if (px < -rad || py < -rad || px > FACE + rad || py > FACE + rad) continue;
    const poly = clip ? clip(f) : null;
    if (clip && !poly) continue;
    const g = ctxs[f];
    if (poly) { g.save(); g.beginPath(); poly.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy))); g.closePath(); g.clip(); }
    g.fillStyle = colour;
    g.globalAlpha = a;
    g.beginPath(); g.arc(px, py, Math.max(0.6, rad), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    if (poly) g.restore();
  }
}

/* ---------- the logo, printed onto the ball ---------- */

/** a logo printed on the ball: centred on direction d, half as wide as s (on the plane touching the ball there, in
    units of the ball's radius), turned rot degrees clockwise from the ball's up */
export type Decal = { d: [number, number, number]; s: number; rot: number };
/** a logo's pixels, as a canvas holds them */
export type LogoPixels = { w: number; h: number; data: Uint8ClampedArray };

/** the print's frame on the ball: its centre, and its right and up (the ball's up there, turned by rot), so a logo
    stands upright as the ball turns past the viewer, and turns as the customer asks */
export function decalFrame(dc: Decal) {
  const d = new THREE.Vector3(...dc.d).normalize();
  const up0 = Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, -Math.sign(d.y)) : new THREE.Vector3(0, 1, 0);
  const U = up0.sub(d.clone().multiplyScalar(up0.dot(d))).normalize();
  const R = U.clone().cross(d);
  const t = (dc.rot * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return { d, R: R.clone().multiplyScalar(c).addScaledVector(U, -s), U: U.clone().multiplyScalar(c).addScaledVector(R, s) };
}
/** the logo's half-width and half-height on that plane: it keeps its own proportions */
export const decalHalf = (dc: Decal, img: { w: number; h: number }): [number, number] =>
  img.w >= img.h ? [dc.s, (dc.s * img.h) / img.w] : [(dc.s * img.w) / img.h, dc.s];

// each cube face's directions: A + across * B + down * C (the inverse of onFace)
const FACE_AXES: [number[], number[], number[]][] = [
  [[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[-1, 0, 0], [0, 0, 1], [0, -1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, 0, 1], [1, 0, 0], [0, -1, 0]], [[0, 0, -1], [-1, 0, 0], [0, -1, 0]],
];

/** prints a logo onto the cube, pixel by pixel: every pixel looks along its direction to the plane touching the ball
    at the logo's centre, and takes the logo's colour there, so the logo runs across panels and seams as print does */
export function stampDecal(ctxs: CanvasRenderingContext2D[], img: LogoPixels, dc: Decal) {
  const { d, R, U } = decalFrame(dc);
  const [hx, hy] = decalHalf(dc, img);
  const cosMax = 1 / Math.sqrt(1 + hx * hx + hy * hy) - 0.02; // beyond the logo's corners: nothing to print
  const dot = (v: number[], w: THREE.Vector3) => v[0] * w.x + v[1] * w.y + v[2] * w.z;
  for (let f = 0; f < 6; f++) {
    const [A, B, C] = FACE_AXES[f];
    const dA = dot(A, d), dB = dot(B, d), dC = dot(C, d);
    const rA = dot(A, R), rB = dot(B, R), rC = dot(C, R);
    const uA = dot(A, U), uB = dot(B, U), uC = dot(C, U);
    // a face that looks wholly away from the logo's centre: nothing of it can be printed there
    if (dA + Math.abs(dB) + Math.abs(dC) <= 0) continue;
    let out: ImageData | null = null;
    for (let py = 0; py < FACE; py++) {
      const tc = ((py + 0.5) / FACE) * 2 - 1;
      for (let px = 0; px < FACE; px++) {
        const sc = ((px + 0.5) / FACE) * 2 - 1;
        const k = dA + sc * dB + tc * dC; // the pixel's direction against the logo's centre
        if (k <= 0) continue;
        if (k / Math.sqrt(1 + sc * sc + tc * tc) < cosMax) continue;
        const a = (rA + sc * rB + tc * rC) / k, b = (uA + sc * uB + tc * uC) / k;
        if (a < -hx || a > hx || b < -hy || b > hy) continue;
        const ix = Math.min(img.w - 1, Math.floor(((a / hx + 1) / 2) * img.w));
        const iy = Math.min(img.h - 1, Math.floor(((1 - b / hy) / 2) * img.h));
        const si = (iy * img.w + ix) * 4, sa = img.data[si + 3] / 255;
        if (sa <= 0) continue;
        if (!out) out = ctxs[f].getImageData(0, 0, FACE, FACE);
        const di = (py * FACE + px) * 4, da = out.data[di + 3] / 255, oa = sa + da * (1 - sa);
        for (let ch = 0; ch < 3; ch++) out.data[di + ch] = (img.data[si + ch] * sa + out.data[di + ch] * da * (1 - sa)) / oa;
        out.data[di + 3] = oa * 255;
      }
    }
    if (out) ctxs[f].putImageData(out, 0, 0);
  }
}

/** clears the cube and draws it again: the logo first, then every stroke (paint goes over a print) */
export function paintCube(ctxs: CanvasRenderingContext2D[], strokes: Stroke[], decals: Decal[] = [], logo: LogoPixels | null = null, clipFor?: (panel: number) => FaceClip) {
  ctxs.forEach((g) => g.clearRect(0, 0, FACE, FACE));
  if (logo) for (const dc of decals) stampDecal(ctxs, logo, dc);
  for (const st of strokes) {
    const clip = st.panel !== undefined && clipFor ? clipFor(st.panel) : undefined;
    marks(st, 0, rng(st.seed), (x, y, z, r, a) => stampCube(ctxs, st.colour, x, y, z, r, a, clip));
  }
}

/** a logo file (a data URL) as pixels, at most 512px on its longer side */
export function readLogoPixels(src: string): Promise<LogoPixels | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 512 / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * k)), h = Math.max(1, Math.round((img.height || 1) * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0, w, h);
      res({ w, h, data: g.getImageData(0, 0, w, h).data });
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** a short description of the free paint for the inquiry, e.g. "3 strokes: Crimson brush, Navy spray" */
export function describeStrokes(strokes: Stroke[], name: (hex: string) => string): string {
  if (!strokes.length) return '';
  const kinds = [...new Set(strokes.map((s) => `${name(s.colour)} ${s.kind}`))];
  const list = kinds.length > 6 ? `${kinds.slice(0, 6).join(', ')} and ${kinds.length - 6} more` : kinds.join(', ');
  return `${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}: ${list}`;
}
