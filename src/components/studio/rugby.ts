import * as THREE from 'three';
import type { FlatNet } from './net';

/* The rugby ball: four panels running tip to tip (the site's "four panels, stitched"), each a long leaf a quarter of
   the way round, with a pimpled grip. The ball lies along x; a panel's place round the ball is its azimuth phi
   (from +y toward +z): panel 0 on top, 1 at the front, 2 underneath, 3 at the back. Built in code, like the
   football: no model file to download. */

export const RUGBY = { L: 1, W: 0.63, P: 0.62 }; // half-length, widest radius (a ball about 1.6 times as long as it is wide), and how full the ends are
/** the ball's radius at x along its length (pointed tips, full in the middle) */
export const rugbyRadius = (x: number) => RUGBY.W * Math.pow(Math.max(0, 1 - (x / RUGBY.L) ** 2), RUGBY.P);
const QUARTER = Math.PI / 2;
const centreOf = (k: number) => k * QUARTER;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** the logo's panels: the front one, the top one, the back one */
export const RUGBY_SPOTS = { front: 1, side: 0, back: 3 };
export const RUGBY_START = ['#c5f900', '#f4f4f2', '#c5f900', '#f4f4f2'];
const UV_LEN = 1.1; // a logo's texture spans this much of the panel (the logo itself, 300/512 of it)
const NX = 72;
// along the length, closer together toward the tips, where the curve turns fastest
const xs = Array.from({ length: NX + 1 }, (_, i) => -RUGBY.L * Math.cos((Math.PI * i) / NX));

/** one panel: a grid across its quarter, slightly inset from the seams (the dark core shows between panels) and
    lifted in the middle, as a padded panel is; uv runs along the length (u) and round the ball (v), centred on the
    panel, so a logo reads along the ball */
export function rugbyPanelGeometry(k: number, seam = 0.012, puff = 0.03, nf = 14): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const c = centreOf(k);
  for (const x of xs) {
    const r = rugbyRadius(x);
    const inset = Math.min(QUARTER / 2 * 0.95, seam / Math.max(r, 1e-4));
    for (let j = 0; j <= nf; j++) {
      const f = -1 + (2 * j) / nf;
      const phi = c + f * (QUARTER / 2 - inset);
      const h = r * (1 + puff * (1 - f ** 4) * (r / RUGBY.W));
      pos.push(x, h * Math.cos(phi), h * Math.sin(phi));
      uv.push(0.5 + x / UV_LEN, 0.5 - (r * (phi - c)) / UV_LEN);
    }
  }
  const row = nf + 1;
  for (let i = 0; i < NX; i++) for (let j = 0; j < nf; j++) {
    const a = i * row + j, b = a + 1, d = a + row, e = d + 1;
    idx.push(a, b, d, b, e, d); // wound to face outward
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** the dark core under the panels (it shows in the seams) */
export function rugbyCoreGeometry(scale = 0.985, nf = 64): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (const x of xs) {
    const r = rugbyRadius(x) * scale;
    for (let j = 0; j <= nf; j++) { const phi = (2 * Math.PI * j) / nf; pos.push(x * scale, r * Math.cos(phi), r * Math.sin(phi)); }
  }
  const row = nf + 1;
  for (let i = 0; i < NX; i++) for (let j = 0; j < nf; j++) { const a = i * row + j; idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A pimpled grip for the bump map: rows of small round pimples, offset row by row (256px, tiled). */
export function pimpleGrip(): THREE.CanvasTexture {
  const n = 256, step = 16;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(118,118,118)'; g.fillRect(0, 0, n, n);
  for (let y = 0, row = 0; y < n + step; y += step * 0.866, row++) {
    for (let x = row % 2 ? step / 2 : 0; x < n + step; x += step) {
      const r = g.createRadialGradient(x - 1.5, y - 1.5, 0, x, y, step * 0.42);
      r.addColorStop(0, 'rgb(235,235,235)'); r.addColorStop(0.7, 'rgb(170,170,170)'); r.addColorStop(1, 'rgba(118,118,118,0)');
      g.fillStyle = r; g.beginPath(); g.arc(x, y, step * 0.42, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  return tex;
}

/* ---------- the flat pattern: the four leaves, one above the other, as they are cut ---------- */

// arc length along a seam from the tip at -L, at each x
const arc: number[] = (() => {
  const s = [0];
  for (let i = 1; i < xs.length; i++) s.push(s[i - 1] + Math.hypot(xs[i] - xs[i - 1], rugbyRadius(xs[i]) - rugbyRadius(xs[i - 1])));
  return s;
})();
const S = arc[arc.length - 1];
const lerpTable = (from: number[], to: number[], v: number) => {
  if (v <= from[0]) return to[0];
  for (let i = 1; i < from.length; i++) if (v <= from[i]) { const t = (v - from[i - 1]) / (from[i] - from[i - 1]); return to[i - 1] + t * (to[i] - to[i - 1]); }
  return to[to.length - 1];
};
const sOf = (x: number) => lerpTable(xs, arc, x);
const xOf = (s: number) => lerpTable(arc, xs, s);

/** where a direction from the centre meets the ball's surface: [x along the length, phi round it, distance] */
function surfaceAt(d: THREE.Vector3): [number, number, number] {
  const rho = Math.hypot(d.y, d.z);
  let lo = 0, hi = Math.abs(d.x) > 1e-6 ? RUGBY.L / Math.abs(d.x) : RUGBY.W / Math.max(rho, 1e-6);
  for (let k = 0; k < 32; k++) { const t = (lo + hi) / 2; if (t * rho < rugbyRadius(t * d.x)) lo = t; else hi = t; }
  return [lo * d.x, Math.atan2(d.z, d.y), lo];
}

let NET: FlatNet | null = null;

export function rugbyNet(): FlatNet {
  if (NET) return NET;
  const BOX = 600, MARGIN = 26, GAP = 0.09;
  const leafH = RUGBY.W * QUARTER; // a leaf at its widest
  const totalH = 4 * leafH + 3 * GAP;
  const scale = (BOX - 2 * MARGIN) / Math.max(S, totalH);
  const ox = (BOX - S * scale) / 2, oy = (BOX - totalH * scale) / 2;
  const mid = (k: number) => oy + (k * (leafH + GAP) + leafH / 2) * scale;
  // a leaf: its top edge from tip to tip, then its bottom edge back (the ball's up is the top of every leaf)
  const polys = [0, 1, 2, 3].map((k) => {
    const top = xs.map((x) => [ox + sOf(x) * scale, mid(k) - rugbyRadius(x) * (QUARTER / 2) * scale] as [number, number]);
    const bottom = xs.map((x) => [ox + sOf(x) * scale, mid(k) + rugbyRadius(x) * (QUARTER / 2) * scale] as [number, number]).reverse();
    return [...top, ...bottom.slice(1, -1)];
  });
  const centres = [0, 1, 2, 3].map((k) => [ox + (S / 2) * scale, mid(k)] as [number, number]);
  const place = (d: THREE.Vector3, r: number, out: (i: number, x: number, y: number, pr: number) => void) => {
    const [x, phi, t] = surfaceAt(d);
    const rx = Math.max(rugbyRadius(x), 0.02), rr = r * t;
    for (let k = 0; k < 4; k++) {
      const dphi = wrap(phi - centreOf(k));
      if (Math.abs(dphi) > QUARTER / 2 + rr / rx + 0.05) continue;
      out(k, ox + sOf(x) * scale, mid(k) + rx * dphi * scale, rr * scale);
    }
  };
  const fromNet = (k: number, px: number, py: number) => {
    const x = xOf((px - ox) / scale);
    const r = Math.max(rugbyRadius(x), 1e-3);
    const phi = centreOf(k) + (py - mid(k)) / scale / r;
    return new THREE.Vector3(x, r * Math.cos(phi), r * Math.sin(phi)).normalize();
  };
  NET = { polys, centres, up: [0, 0, 0, 0], logo: (300 / 512) * UV_LEN * scale, place, fromNet };
  return NET;
}
