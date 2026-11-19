/* The buyer's side, after journey.test.mjs and admin-flow.test.mjs: register with the email the inquiry
   was sent from, confirm it with the link from the outbox (read through a staff session), and find the
   quotation, the order with its production stage and tracking, the quotation and invoice PDFs, while
   another company's documents stay closed. Run against a local server. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

function client() {
  const jar = new Map();
  const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const keep = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [pair] = c.split(';'); const i = pair.indexOf('='); jar.set(pair.slice(0, i).trim(), pair.slice(i + 1)); } };
  return {
    async get(path) { const r = await fetch(BASE + path, { headers: { cookie: header() }, redirect: 'manual' }); keep(r); return { status: r.status, html: r.status === 200 ? (await r.text()).replace(/<!-- -->/g, '') : '', location: r.headers.get('location'), type: r.headers.get('content-type') }; },
    async submit(path, html, buttonText, fields) {
      const form = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].find((f) => f[1].replace(/<!-- -->/g, '').includes(buttonText));
      assert.ok(form, `form "${buttonText}" on ${path}`);
      const fd = new FormData();
      for (const m of form[1].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) { const n = m[0].match(/name="([^"]*)"/)?.[1]; if (n) fd.append(n, (m[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')); }
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const r = await fetch(BASE + path, { method: 'POST', body: fd, headers: { cookie: header(), Origin: BASE }, redirect: 'manual' }); keep(r);
      return { status: r.status, body: await r.text() };
    },
    has: (k) => jar.has(k),
  };
}
const b32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = []; for (const ch of s) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret) => { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac('sha1', b32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };

test('a buyer registers, confirms the email and follows the order', async () => {
  const buyer = client();
  let page = await buyer.get('/en/account/register');
  await buyer.submit('/en/account/register', page.html, 'Create the account', {
    company: 'E2E Test Club', name: 'Test Buyer', email: 'buyer@e2e.example', country: 'IE', password: 'e2e-portal-pass-2026', terms: 'on',
  });
  assert.ok(buyer.has('ms_session'), 'signed in after registering');
  const unverified = await buyer.get('/en/account/orders');
  assert.equal(unverified.status, 307, 'portal closed until the email is confirmed');

  // the confirmation link, from the outbox, through a staff session
  const staff = client();
  page = await staff.get('/admin/login');
  await staff.submit('/admin/login', page.html, 'Continue', { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  page = await staff.get('/admin/mfa');
  await staff.submit('/admin/mfa', page.html, 'Sign in', { code: totp(fs.readFileSync('.taste-skill/admin-mfa-test.txt', 'utf8').trim()) });
  const outbox = await staff.get('/admin/outbox');
  const mailId = outbox.html.match(/href="\/admin\/outbox\?id=([0-9a-f-]{36})">Confirm your email address/)?.[1];
  assert.ok(mailId, 'the confirmation email is in the outbox');
  const mail = await staff.get(`/admin/outbox?id=${mailId}`);
  const link = mail.html.replace(/&amp;/g, '&').match(/\/en\/account\/verify\/([A-Za-z0-9_-]{20,})/)?.[0];
  assert.ok(link, 'the email holds a confirmation link');

  const landing = await buyer.get(link);
  assert.match(landing.html, /Confirm your email/, 'opening the link alone changes nothing');
  await buyer.submit(link, landing.html, 'Confirm my email', {});
  const verified = await buyer.get(`${link}?done=1`);
  assert.match(verified.html, /Email confirmed/);
  const quotes = await buyer.get('/en/account/quotations');
  assert.equal(quotes.status, 200);
  assert.match(quotes.html, /Q-\d{4}-\d{4}/, 'the quotation sent by sales is listed');
  const qid = quotes.html.match(/\/api\/portal\/quotations\/([0-9a-f-]{36})/)?.[1];
  const pdf = await buyer.get(`/api/portal/quotations/${qid}`);
  assert.equal(pdf.type, 'application/pdf');

  const orders = await buyer.get('/en/account/orders');
  assert.match(orders.html, /O-\d{4}-\d{4}/);
  assert.match(orders.html, /In production \(current stage\)/);
  assert.match(orders.html, /TL123456/);
  const inv = orders.html.match(/\/api\/portal\/invoices\/([0-9a-f-]{36})/)?.[1];
  assert.equal((await buyer.get(`/api/portal/invoices/${inv}`)).type, 'application/pdf');

  // another company cannot open them
  const other = client();
  page = await other.get('/en/account/register');
  await other.submit('/en/account/register', page.html, 'Create the account', { company: 'Other Club', name: 'Other Buyer', email: `other-${Date.now()}@e2e.example`, country: 'DE', password: 'another-pass-2026', terms: 'on' });
  assert.equal((await other.get(`/api/portal/quotations/${qid}`)).status, 404);
  assert.equal((await other.get(`/api/portal/invoices/${inv}`)).status, 404);
});
