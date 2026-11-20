/* Staff workflow against a running local server, without a browser: sign in (credentials read from
   .env.local, never printed), two-factor (enrolled on first run, the TOTP computed here), then an inquiry
   from quotation to shipped order. Forms are posted the way a browser without JavaScript posts them,
   using the hidden Server Action fields Next.js renders.
     BASE_URL=http://localhost:3000 node --test tests/e2e/2-admin-flow.test.mjs
   It needs at least one inquiry (run 1-journey.test.mjs first). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
function keep(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';'); const [k, ...v] = pair.split('=');
    if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k); else jar.set(k.trim(), v.join('='));
  }
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: { cookie: cookieHeader() }, redirect: 'manual' });
  keep(r);
  return { status: r.status, location: r.headers.get('location'), html: r.status === 200 ? await r.text() : '' };
}
/** Posts the form whose submit button text matches, with the given fields, as a no-JS browser would. */
async function submit(path, html, buttonText, fields) {
  const forms = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)];
  const form = forms.find((f) => f[1].replace(/<!-- -->/g, "").includes(buttonText));
  assert.ok(form, `form with "${buttonText}" on ${path}`);
  const fd = new FormData();
  for (const m of form[1].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1]; const value = m[0].match(/value="([^"]*)"/)?.[1] ?? '';
    if (name) fd.append(name, value.replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
  }
  for (const [k, v] of Object.entries(fields)) { if (Array.isArray(v)) { fd.delete(k); v.forEach((x) => fd.append(k, x)); } else fd.set(k, v); }
  const r = await fetch(BASE + path, { method: 'POST', body: fd, headers: { cookie: cookieHeader(), Origin: BASE }, redirect: 'manual' });
  keep(r);
  return { status: r.status, location: r.headers.get('location') ?? r.headers.get('x-action-redirect'), body: await r.text() };
}
const b32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret) => { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac('sha1', b32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
const MFA_FILE = '.taste-skill/admin-mfa-test.txt';

test('staff sign-in with two-factor, then quotation, order, production and shipment', async () => {
  let page = await get('/admin/login');
  let r = await submit('/admin/login', page.html, 'Continue', { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  assert.ok(jar.has('ms_staff'), 'a staff session cookie after the password');

  page = await get('/admin/mfa/setup');
  let secret;
  if (page.status === 200) {
    secret = page.html.match(/class="mono">([A-Z2-7 ]+)</)?.[1].replace(/\s/g, '');
    assert.ok(secret, 'the setup page shows the key');
    fs.mkdirSync('.taste-skill', { recursive: true }); // a fresh copy has no such folder yet
    fs.writeFileSync(MFA_FILE, secret);
    r = await submit('/admin/mfa/setup', page.html, 'Turn on two-factor sign-in', { code: totp(secret) });
  } else {
    secret = fs.readFileSync(MFA_FILE, 'utf8').trim();
    page = await get('/admin/mfa');
    r = await submit('/admin/mfa', page.html, 'Sign in', { code: totp(secret) });
  }
  const dash = await get('/admin');
  assert.equal(dash.status, 200, 'the dashboard opens after two-factor');
  assert.match(dash.html, /Latest inquiries/);

  const list = await get('/admin/inquiries');
  const id = list.html.match(/href="\/admin\/inquiries\/([0-9a-f-]{36})"/)?.[1];
  assert.ok(id, 'an inquiry to work on');
  let inq = await get(`/admin/inquiries/${id}`);

  r = await submit(`/admin/inquiries/${id}`, inq.html, 'Update the status', { status: 'under_review', note: 'Checking materials' });
  inq = await get(`/admin/inquiries/${id}`);
  assert.match(inq.html, /Under review/);

  if (!/Open the customer/.test(inq.html)) {
    await submit(`/admin/inquiries/${id}`, inq.html, 'Create the customer company', {});
    inq = await get(`/admin/inquiries/${id}`);
  }
  const lines = [...inq.html.matchAll(/name="l_desc" value="([^"]*)"/g)].length;
  await submit(`/admin/inquiries/${id}`, inq.html, 'Save the draft', {
    l_desc: ['Match football, thermally bonded', 'Training bibs'], l_sku: ['MS-FB-MAT-001', 'MS-AC-BIB-001'], l_qty: ['500', '100'], l_price: ['11.40', '2.10'],
    shippingCost: '380', paymentTerms: '30% with order, 70% before shipment', incoterm: 'FOB Karachi', leadTime: '45 days from sample approval',
  });
  inq = await get(`/admin/inquiries/${id}`);
  assert.match(inq.html, /Q-\d{4}-\d{4} \(draft\)/, `a draft quotation (lines before: ${lines})`);
  const qid = inq.html.match(/\/api\/portal\/quotations\/([0-9a-f-]{36})/)?.[1];
  const pdf = await fetch(`${BASE}/api/portal/quotations/${qid}`, { headers: { cookie: cookieHeader() } });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');

  await submit(`/admin/inquiries/${id}`, inq.html, 'Send Q-', {});
  inq = await get(`/admin/inquiries/${id}`);
  assert.match(inq.html, /Quotation sent/);
  r = await submit(`/admin/inquiries/${id}`, inq.html, 'Accepted: create the order', {});
  const orderPath = r.location?.match(/\/admin\/orders\/[0-9a-f-]{36}/)?.[0];
  assert.ok(orderPath, 'the order page after creating the order');
  let order = await get(orderPath);
  await submit(orderPath, order.html, 'Update the stage', { status: 'in_production', note: 'Panels cut', notify: 'on' });
  order = await get(orderPath);
  await submit(orderPath, order.html, 'Add the shipment', { method: 'Sea freight', carrier: 'Test Line', trackingNumber: 'TL123456', trackingUrl: 'https://example.org/track/TL123456' });
  order = await get(orderPath);
  await submit(orderPath, order.html, 'Issue the invoice', { amount: '6290.00' });
  order = await get(orderPath);
  assert.match(order.html, /TL123456/);
  assert.match(order.html, /INV-\d{4}-\d{4}/);
  assert.match(order.html, /In production/);

  const outbox = await get('/admin/outbox');
  assert.match(outbox.html, /Quotation Q-\d{4}-\d{4}/, 'the quotation email is in the outbox');
  const audit = await get('/admin/audit');
  assert.match(audit.html, /order\.create/);
  const csv = await fetch(`${BASE}/api/admin/export?table=orders`, { headers: { cookie: cookieHeader() } });
  assert.match(await csv.text(), /^﻿?id,number/);
});
