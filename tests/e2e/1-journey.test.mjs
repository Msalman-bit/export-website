/* End-to-end journey against a running server (npm run build && npm start, then npm run test:e2e).
   BASE_URL defaults to http://localhost:3000. It walks the buyer's path: home, catalogue, a product,
   its datasheet, an inquiry with a file and two products, the confirmation; and checks the guards:
   security headers, cross-site refusal, validation errors, staff and customer areas closed. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const get = (p, init) => fetch(BASE + p, { redirect: 'manual', ...init });
const sameOrigin = { Origin: BASE };

test('home page renders with its headline, metadata and security headers', async () => {
  const r = await get('/en');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<h1[^>]*>Custom sports equipment, made in Pakistan/);
  assert.match(html, /<link rel="canonical"/);
  assert.match(html, /hrefLang="x-default"|hreflang="x-default"/i);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
});

test('a path without a language is redirected to one', async () => {
  const r = await get('/products', { headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  assert.equal(r.status, 307);
  assert.match(r.headers.get('location'), /\/fr\/products$/);
});

let productId;
test('catalogue, family and product pages, and the datasheet PDF', async () => {
  assert.equal((await get('/en/products')).status, 200);
  const fam = await get('/en/products/football');
  assert.equal(fam.status, 200);
  const page = await (await get('/en/products/football/match-football')).text();
  assert.match(page, /MS-FB-MAT-001/);
  productId = page.match(/\/api\/products\/([0-9a-f-]{36})\/datasheet/)?.[1];
  assert.ok(productId, 'datasheet link present');
  const pdf = await get(`/api/products/${productId}/datasheet`);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
});

test('an inquiry with two products and a file gets a reference', async () => {
  const fd = new FormData();
  Object.entries({ type: 'quote', companyName: 'E2E Test Club', contactName: 'Test Buyer', email: 'buyer@e2e.example', country: 'IE', currency: 'EUR', shippingMethod: 'sea', message: '', locale: 'en', sourcePage: '/en/inquiry' }).forEach(([k, v]) => fd.set(k, v));
  fd.set('items', JSON.stringify([{ productId, quantity: 500, notes: 'Crest on two panels' }, { name: 'Training bibs', quantity: 100, notes: '' }]));
  fd.append('files', new File(['%PDF-1.4 brief'], 'brief.pdf', { type: 'application/pdf' }));
  const r = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: fd, headers: sameOrigin });
  const data = await r.json();
  assert.equal(r.status, 200, JSON.stringify(data));
  assert.match(data.reference, /^MS-\d{6}-[0-9A-HJKMNP-TV-Z]{5}$/);
  const sent = await (await get(`/en/inquiry/sent?ref=${data.reference}&type=quote`)).text();
  assert.match(sent, new RegExp(data.reference));
});

test('the inquiry API refuses bad input, bad files and other sites', async () => {
  const bad = new FormData(); bad.set('companyName', ''); bad.set('email', 'nope');
  const r1 = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: bad, headers: sameOrigin });
  assert.equal(r1.status, 400);
  const e = (await r1.json()).errors;
  assert.ok(e.companyName && e.email && e.country);

  const fake = new FormData();
  Object.entries({ companyName: 'X Club', contactName: 'X Person', email: 'x@x.example', country: 'IE', message: 'A football order, please quote.' }).forEach(([k, v]) => fake.set(k, v));
  fake.append('files', new File(['MZ binary'], 'logo.png', { type: 'image/png' }));
  const r2 = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: fake, headers: sameOrigin });
  assert.equal(r2.status, 400);

  const r3 = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: new FormData(), headers: { Origin: 'https://evil.example' } });
  assert.equal(r3.status, 403);
});

test('staff and customer areas are closed without a session', async () => {
  const a = await get('/admin/inquiries');
  assert.equal(a.status, 307);
  assert.match(a.headers.get('location'), /\/admin\/login/);
  assert.equal((await get('/api/admin/export?table=inquiries')).status, 404);
  const c = await get('/en/account/orders');
  assert.equal(c.status, 307);
  assert.equal((await get('/api/portal/quotations/00000000-0000-0000-0000-000000000000')).status, 404);
});

test('drafts and unknown pages are 404; sitemap and robots are served', async () => {
  assert.equal((await get('/en/company-history')).status, 404);
  assert.equal((await get('/en/not/a/page')).status, 404);
  const sm = await (await get('/sitemap.xml')).text();
  assert.match(sm, /<loc>[^<]+\/en\/products\/football<\/loc>/);
  assert.doesNotMatch(sm, /company-history/);
  assert.match(await (await get('/robots.txt')).text(), /Disallow: \/admin/);
});
