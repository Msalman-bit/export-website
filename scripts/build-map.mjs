#!/usr/bin/env node
/* Projects the Natural Earth 1:110m countries (public domain, via the world-atlas package) into SVG path
   data for the export map, cropped to Europe and North America. Output: src/lib/world-map.json.
   Run once (npm run map:build); the page itself ships only the paths, no map library. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));
const countries = feature(topo, topo.objects.countries).features;

const W = 1000;
const projection = geoEqualEarth().rotate([40, 0]).scale(330).translate([W / 2, 300]);
const gp = geoPath(projection);

// the window: from Alaska's east to the Urals, from the Sahara to the Arctic
const [x0, y0] = projection([-135, 74]);
const [x1, y1] = projection([42, 18]);
const box = { x: Math.floor(Math.min(x0, x1)), y: Math.floor(y0), w: Math.ceil(Math.abs(x1 - x0)), h: Math.ceil(y1 - y0) };

// whole units: the map is drawn about 1 px per unit, so decimals add weight and nothing visible
const round = (d) => d.replace(/(-?\d+)\.\d+/g, '$1');
const out = [];
for (const f of countries) {
  if (f.id === '010') continue; // Antarctica
  const d = gp(f);
  if (!d) continue;
  const b = gp.bounds(f);
  if (b[1][0] < box.x || b[0][0] > box.x + box.w || b[1][1] < box.y || b[0][1] > box.y + box.h) continue;
  out.push({ id: String(f.id ?? ''), name: f.properties?.name ?? '', d: round(d) });
}
const [e0x, e0y] = projection([-26, 71.5]);
const [e1x, e1y] = projection([34, 34]);
const europe = `${Math.floor(e0x)} ${Math.floor(e0y)} ${Math.ceil(e1x - e0x)} ${Math.ceil(e1y - e0y)}`;
fs.writeFileSync(path.join(ROOT, 'src/lib/world-map.json'), JSON.stringify({ viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, europe, countries: out }));
console.log(`map: ${out.length} countries, viewBox ${box.x} ${box.y} ${box.w} ${box.h}`);
