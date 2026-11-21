import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* A real football's geometry: the truncated icosahedron (12 pentagons, 20 hexagons), each panel a
   curved patch of the sphere with a recessed seam, so colours can be set per panel and a logo laid on
   one hexagon. Built once in code, no model file to download. */

/** The colour every panel starts with: white hexagons, obsidian pentagons, two lime hexagons. */
export const START = { hex: '#f4f4f2', pent: '#141414', accent: '#c5f900' };
export const startColours = (panels: Panel[]): string[] =>
  panels.map((p, i) => (p.kind === 'pent' ? START.pent : i % 7 === 3 ? START.accent : START.hex));

export type PanelKind = 'pent' | 'hex';
export type Panel = { kind: PanelKind; center: THREE.Vector3; corners: THREE.Vector3[] };

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedronVertices(): THREE.Vector3[] {
  const v: [number, number, number][] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) { v.push([0, a, b]); v.push([a, b, 0]); v.push([b, 0, a]); }
  return v.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
}

/** The 32 panels: one pentagon per icosahedron vertex, one hexagon per face. */
export function footballPanels(): Panel[] {
  const ico = icosahedronVertices();
  const edge = ico[0].distanceTo(ico.slice(1).reduce((best, p) => (ico[0].distanceTo(p) < ico[0].distanceTo(best) ? p : best)));
  const near = (a: THREE.Vector3, b: THREE.Vector3) => Math.abs(a.distanceTo(b) - edge) < 1e-3;
  // truncation points: one third along every edge
  const cut = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().lerp(b, 1 / 3).normalize();
  const panels: Panel[] = [];
  // pentagons
  for (let i = 0; i < ico.length; i++) {
    const nb = ico.filter((p, j) => j !== i && near(ico[i], p));
    const center = ico[i].clone();
    const pts = nb.map((p) => cut(ico[i], p));
    panels.push({ kind: 'pent', center, corners: sortAround(center, pts) });
  }
  // hexagons: faces of the icosahedron
  for (let i = 0; i < ico.length; i++) for (let j = i + 1; j < ico.length; j++) for (let k = j + 1; k < ico.length; k++) {
    if (near(ico[i], ico[j]) && near(ico[j], ico[k]) && near(ico[i], ico[k])) {
      const f = [ico[i], ico[j], ico[k]];
      const center = f[0].clone().add(f[1]).add(f[2]).normalize();
      const pts = [cut(f[0], f[1]), cut(f[1], f[0]), cut(f[1], f[2]), cut(f[2], f[1]), cut(f[2], f[0]), cut(f[0], f[2])];
      panels.push({ kind: 'hex', center, corners: sortAround(center, pts) });
    }
  }
  return panels;
}

function sortAround(center: THREE.Vector3, pts: THREE.Vector3[]): THREE.Vector3[] {
  const n = center.clone().normalize();
  const ref = pts[0].clone().sub(n.clone().multiplyScalar(pts[0].dot(n))).normalize();
  const side = n.clone().cross(ref);
  return pts
    .map((p) => { const d = p.clone().sub(n.clone().multiplyScalar(p.dot(n))); return { p, a: Math.atan2(d.dot(side), d.dot(ref)) }; })
    .sort((a, b) => a.a - b.a)
    .map((x) => x.p);
}

/** One panel as a curved, slightly inset mesh (the inset leaves a dark seam line between panels):
    every edge triangle of the fan is subdivided k times and pushed onto the sphere. `puff` lifts the panel's
    middle and rolls its edge down into the seam, as a real panel is cushioned (0 gives a flat patch of the sphere);
    the shared corners are then merged so the light falls smoothly over the curve. */
export function panelGeometry(panel: Panel, radius = 1, inset = 0.035, k = 8, puff = 0): THREE.BufferGeometry {
  const c = panel.center.clone().normalize();
  const corners = panel.corners.map((p) => p.clone().lerp(c, inset).normalize());
  // the picture's "up" on this panel is the ball's up (its spin axis), so a logo stands upright as the panel turns
  // past the viewer; a panel at the top or bottom of the ball takes the ball's front as its up instead
  const worldUp = Math.abs(c.y) > 0.9 ? new THREE.Vector3(0, 0, -Math.sign(c.y)) : new THREE.Vector3(0, 1, 0);
  const bitangent = worldUp.sub(c.clone().multiplyScalar(worldUp.dot(c))).normalize();
  const tangent = bitangent.clone().cross(c);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  // t: 0 at the panel's centre, 1 at its edge; the cushion is flat on top and falls away near the seam
  const add = (v: THREE.Vector3, t: number) => {
    const u = v.clone().normalize();
    const h = radius * (1 + puff * (1 - t * t * t * t));
    positions.push(u.x * h, u.y * h, u.z * h);
    normals.push(u.x, u.y, u.z);
    const d = u.clone().sub(c);
    uvs.push(0.5 + d.dot(tangent) * 2.4, 0.5 + d.dot(bitangent) * 2.4);
  };
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % n];
    const P = (r: number, q: number) => c.clone().multiplyScalar(1 - r / k).add(a.clone().multiplyScalar((r - q) / k)).add(b.clone().multiplyScalar(q / k));
    for (let r = 0; r < k; r++) {
      const t0 = r / k, t1 = (r + 1) / k;
      for (let q = 0; q <= r; q++) {
        add(P(r, q), t0); add(P(r + 1, q), t1); add(P(r + 1, q + 1), t1);
        if (q < r) { add(P(r, q), t0); add(P(r + 1, q + 1), t1); add(P(r, q + 1), t0); }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (!puff) return g;
  const smooth = mergeVertices(g, 1e-5);
  smooth.computeVertexNormals();
  g.dispose();
  return smooth;
}
