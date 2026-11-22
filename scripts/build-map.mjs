#!/usr/bin/env node
/* Projects the Natural Earth 1:50m countries (public domain, via the world-atlas package) into SVG path
   data for the export map, cropped to Europe. Output: src/lib/world-map.json.
   Run once (npm run map:build); the page itself ships only the paths, no map library. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-atlas/countries-50m.json'), 'utf8'));
const countries = feature(topo, topo.objects.countries).features;

// Equal Earth turned to Europe's middle, scaled so the window is 740 units wide: about a pixel a unit on a computer
const projection = geoEqualEarth().rotate([-9, 0]).scale(1).translate([0, 0]);
const WEST = -26, EAST = 40, NORTH = 71.5, SOUTH = 35.7; // Iceland to Finland, the North Cape to Sicily
const left = Math.min(projection([WEST, 64])[0], projection([-10.6, 37])[0]), right = projection([EAST, 45])[0];
projection.scale(740 / (right - left));
const x0 = Math.min(projection([WEST, 64])[0], projection([-10.6, 37])[0]), y0 = projection([10, NORTH])[1], y1 = projection([10, SOUTH])[1];
projection.translate([-x0, -y0]);
const box = { w: 740, h: Math.round(y1 - y0) };
projection.clipExtent([[-12, -12], [box.w + 12, box.h + 12]]); // only what the window shows is kept
const gp = geoPath(projection);

/* the outlines at the size they are drawn: points closer than 0.6 units to the line between their neighbours go
   (Douglas-Peucker), and so do islets too small to see; a country always keeps its largest outline */
const area = (r) => Math.abs(r.reduce((a, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return a + x * v - u * y; }, 0)) / 2;
function simplify(r, tol) {
  if (r.length < 4) return r;
  const keep = new Uint8Array(r.length); keep[0] = keep[r.length - 1] = 1;
  const stack = [[0, r.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); const [ax, ay] = r[a], [bx, by] = r[b]; const L = Math.hypot(bx - ax, by - ay) || 1e-9;
    let far = 0, at = 0;
    for (let i = a + 1; i < b; i++) {
      const d = bx === ax && by === ay ? Math.hypot(r[i][0] - ax, r[i][1] - ay) : Math.abs((by - ay) * r[i][0] - (bx - ax) * r[i][1] + bx * ay - by * ax) / L;
      if (d > far) { far = d; at = i; }
    }
    if (far > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return r.filter((_, i) => keep[i]);
}
const num = (n) => String(Math.round(n * 2) / 2); // half units
function outline(d) {
  const rings = d.split('M').filter(Boolean).map((part) => part.replace('Z', '').split('L').map((p) => p.split(',').map(Number))).sort((a, b) => area(b) - area(a));
  return rings.filter((r, i) => i === 0 || area(r) > 3).map((r) => simplify(r, 0.6)).filter((r, i) => i === 0 || r.length > 3)
    .map((r) => `M${r.map(([x, y]) => `${num(x)},${num(y)}`).filter((p, i, a) => p !== a[i - 1]).join(' ')}Z`).join('');
}

const out = [];
for (const f of countries) {
  if (f.id === '010' || f.id === '304') continue; // Antarctica; Greenland, whose corner would show above Iceland
  const d = gp(f);
  if (!d) continue;
  const o = outline(d);
  if (o) out.push({ id: String(f.id ?? ''), name: f.properties?.name ?? '', d: o });
}
fs.writeFileSync(path.join(ROOT, 'src/lib/world-map.json'), JSON.stringify({ viewBox: `0 0 ${box.w} ${box.h}`, countries: out }));
console.log(`map: ${out.length} countries, viewBox 0 0 ${box.w} ${box.h}`);
