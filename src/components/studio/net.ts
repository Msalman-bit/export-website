import * as THREE from 'three';
import { footballPanels } from './football';

/* The football's flat pattern: the ball cut along its seams and laid flat, every one of its 32 panels in view, the
   way the panels are cut before they are joined. The cut makes two "flowers" (each half of the ball opened out round
   its pentagon) joined at one seam; of the layouts searched, this one fills a square frame best with no panel
   overlapping another. Each panel keeps its true shape, so a point on the ball maps onto its panel in the pattern
   (and back), and the logo and free paint land on the pattern exactly where they sit on the ball. */

// how the pattern hangs together: each panel's parent in the cut (footballPanels() order; -1 is the first pentagon)
const PARENT = [-1, 13, 12, 23, 27, 15, 14, 16, 26, 31, 31, 24, 0, 0, 0, 0, 0, 12, 13, 23, 14, 26, 24, 9, 9, 27, 9, 9, 15, 16, 5, 30];
const TURN = (147 * Math.PI) / 180; // the pattern's turn on the page: fills a square best, and leaves the bottom-left corner (the 3D / Flat switch) clear
const BOX = 600, MARGIN = 26;

/** A ball's flat pattern, as the Flat view draws it (the football's here, the rugby ball's in rugby.ts). */
export type FlatNet = {
  /** each panel's outline on the page (0..600, y down) */
  polys: [number, number][][];
  centres: [number, number][];
  /** degrees to turn an upright picture so it stands as it does on the ball (the ball's up) on each panel */
  up: number[];
  /** a logo's width on its panel, on the page (as on the 3D ball) */
  logo: number;
  /** every panel a round mark reaches (a direction from the ball's centre and a radius as an angle): where it lands
      on that panel's piece and how big, also just past the piece's edge (the drawing cuts it there) */
  place: (d: THREE.Vector3, r: number, out: (i: number, x: number, y: number, pr: number) => void) => void;
  /** the direction from the ball's centre under a point of panel i's piece */
  fromNet: (i: number, x: number, y: number) => THREE.Vector3;
  /** where a direction lands on panel i's piece (also past its edge, where the drawing cuts it), or null */
  toPanel: (i: number, d: THREE.Vector3) => [number, number] | null;
  /** each panel's middle, as a direction from the ball's centre */
  dirs: THREE.Vector3[];
};

let NET: FlatNet | null = null;

export function footballNet(): FlatNet {
  if (NET) return NET;
  const panels = footballPanels();
  const n = panels.length;
  const normals = panels.map((p) => {
    const v = new THREE.Vector3().crossVectors(p.corners[1].clone().sub(p.corners[0]), p.corners[2].clone().sub(p.corners[0])).normalize();
    return v.dot(p.center) < 0 ? v.negate() : v;
  });
  const dist = panels.map((p, i) => p.corners[0].dot(normals[i]));
  const key = (v: THREE.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  // unfold: every panel turns about the seam it shares with its parent until it lies in its parent's plane
  const M: THREE.Matrix4[] = panels.map(() => new THREE.Matrix4());
  const placed = new Set([0]);
  while (placed.size < n) {
    for (let c = 0; c < n; c++) {
      const p = PARENT[c];
      if (placed.has(c) || !placed.has(p)) continue;
      const pk = new Set(panels[p].corners.map(key));
      const [a, b] = panels[c].corners.filter((v) => pk.has(key(v)));
      const axis = b.clone().sub(a).normalize();
      let ang = Math.acos(Math.max(-1, Math.min(1, normals[c].dot(normals[p]))));
      if (new THREE.Vector3().crossVectors(normals[c], normals[p]).dot(axis) < 0) ang = -ang;
      const R = new THREE.Matrix4().makeTranslation(a.x, a.y, a.z)
        .multiply(new THREE.Matrix4().makeRotationAxis(axis, ang))
        .multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
      M[c] = M[p].clone().multiply(R);
      placed.add(c);
    }
  }
  const Minv = M.map((m) => m.clone().invert());
  // the page: the first pentagon's plane seen from outside, turned, then fitted into the square with a margin
  const n0 = normals[0];
  const o = panels[0].center.clone().multiplyScalar(dist[0] / panels[0].center.dot(n0));
  const e1 = panels[0].corners[0].clone().sub(o).normalize(), e2 = n0.clone().cross(e1);
  const cos = Math.cos(TURN), sin = Math.sin(TURN);
  const flat = (y: THREE.Vector3): [number, number] => {
    const u = y.clone().sub(o).dot(e1), v = y.clone().sub(o).dot(e2);
    return [u * cos - v * sin, -(u * sin + v * cos)];
  };
  const raw = panels.map((p, i) => p.corners.map((c) => flat(c.clone().applyMatrix4(M[i]))));
  const xs = raw.flat().map((q) => q[0]), ys = raw.flat().map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const scale = (BOX - 2 * MARGIN) / Math.max(w, h);
  const ox = (BOX - w * scale) / 2, oy = (BOX - h * scale) / 2;
  const page = ([x, y]: [number, number]): [number, number] => [(x - x0) * scale + ox, (y - y0) * scale + oy];
  const toNet = (i: number, d: THREE.Vector3): [number, number] | null => {
    const k = d.dot(normals[i]);
    if (k < 0.05) return null;
    return page(flat(d.clone().multiplyScalar(dist[i] / k).applyMatrix4(M[i])));
  };
  const fromNet = (i: number, x: number, y: number) => {
    const fx = (x - ox) / scale + x0, fy = -((y - oy) / scale + y0);
    // undo the turn
    const u = fx * cos + fy * sin, v = -fx * sin + fy * cos;
    return o.clone().addScaledVector(e1, u).addScaledVector(e2, v).applyMatrix4(Minv[i]).normalize();
  };
  const polys = raw.map((p) => p.map(page));
  const centres = panels.map((p, i) => toNet(i, p.center.clone().normalize())!);
  // the ball's up on each panel, as the 3D ball lays a logo (see panelGeometry)
  const up = panels.map((p, i) => {
    const c = p.center.clone().normalize();
    const wu = Math.abs(c.y) > 0.9 ? new THREE.Vector3(0, 0, -Math.sign(c.y)) : new THREE.Vector3(0, 1, 0);
    const b = wu.sub(c.clone().multiplyScalar(wu.dot(c))).normalize();
    const p0 = toNet(i, c)!, p1 = toNet(i, c.clone().addScaledVector(b, 0.05).normalize())!;
    return (Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1])) * 180) / Math.PI;
  });
  const place = (d: THREE.Vector3, r: number, out: (i: number, x: number, y: number, pr: number) => void) => {
    for (let i = 0; i < n; i++) {
      if (d.dot(normals[i]) < Math.cos(0.43 + r)) continue; // a panel reaches about 0.43 from its middle
      const p = toNet(i, d);
      if (p) out(i, p[0], p[1], r * scale);
    }
  };
  NET = { polys, centres, up, logo: 0.244 * scale, place, fromNet, toPanel: toNet, dirs: panels.map((p) => p.center.clone().normalize()) };
  return NET;
}
