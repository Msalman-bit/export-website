/* Deleting a quotation, against a running local server, after 1-3 (it signs in as the seeded admin with the
   two-factor key 2-admin-flow enrolled). It makes its own inquiry, so nothing the earlier tests built is touched.
     BASE_URL=http://localhost:3000 node --test tests/e2e/4-quotation-delete.test.mjs
   Checks: a draft is deleted only through the confirmation; a sent quotation is refused even when the form is
   forged; once declined it can be deleted; numbers of deleted quotations are never issued again; the audit log
   records each deletion with its number and the admin who did it. */
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
  return { status: r.status, location: r.headers.get('location'), html: r.status === 200 ? (await r.text()).replace(/<!-- -->/g, '') : '' };
}
/** Posts the form whose content includes `buttonText`, with its hidden fields and the given overrides. */
async function submit(path, html, buttonText, fields) {
  const form = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].find((f) => f[1].includes(buttonText));
  assert.ok(form, `form with "${buttonText}" on ${path}`);
  const fd = new FormData();
  for (const m of form[1].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1]; const value = m[0].match(/value="([^"]*)"/)?.[1] ?? '';
    if (name) fd.append(name, value.replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
  }
  for (const [k, v] of Object.entries(fields)) { if (Array.isArray(v)) { fd.delete(k); v.forEach((x) => fd.append(k, x)); } else fd.set(k, v); }
  const r = await fetch(BASE + path, { method: 'POST', body: fd, headers: { cookie: cookieHeader(), Origin: BASE }, redirect: 'manual' });
  keep(r);
  return { status: r.status, location: decodeURIComponent(r.headers.get('location') ?? r.headers.get('x-action-redirect') ?? '') };
}
const b32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret) => { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac('sha1', b32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
const seq = (n) => Number(n.split('-').pop());
const DRAFT = /<h2>Quotation (Q-\d{4}-\d{4}) \(draft\)<\/h2>/; // the draft's own box, not a timeline note about it

test('an admin deletes draft and declined quotations through the confirmation, and only those', async () => {
  // its own inquiry
  const fd = new FormData();
  Object.entries({ type: 'quote', companyName: 'Delete Test FC', contactName: 'Del Buyer', email: 'delete@e2e.example', country: 'IE', currency: 'EUR', shippingMethod: 'sea', message: 'Quote for 200 match balls.', locale: 'en', sourcePage: '/en/inquiry' }).forEach(([k, v]) => fd.set(k, v));
  fd.set('items', JSON.stringify([{ name: 'Match football', quantity: 200, notes: '' }]));
  const created = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: fd, headers: { Origin: BASE } });
  const { reference } = await created.json();
  assert.equal(created.status, 200, 'the inquiry is created');

  // the seeded admin, with two-factor
  let page = await get('/admin/login');
  await submit('/admin/login', page.html, 'Continue', { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  page = await get('/admin/mfa');
  await submit('/admin/mfa', page.html, 'Sign in', { code: totp(fs.readFileSync('.taste-skill/admin-mfa-test.txt', 'utf8').trim()) });
  const list = await get('/admin/inquiries');
  const id = list.html.match(new RegExp(`href="/admin/inquiries/([0-9a-f-]{36})">${reference}<`))?.[1];
  assert.ok(id, 'the new inquiry is listed');
  const path = `/admin/inquiries/${id}`;
  const draft = { l_desc: ['Match football'], l_sku: ['MS-FB-MAT-001'], l_qty: ['200'], l_price: ['11.40'], shippingCost: '120' };

  // 1. a draft: refused without the confirmation, deleted with it
  let inq = await get(path);
  await submit(path, inq.html, 'Save the draft', draft);
  inq = await get(path);
  const first = inq.html.match(DRAFT)?.[1];
  assert.ok(first, 'a draft quotation');
  assert.match(inq.html, new RegExp(`Delete quotation ${first}\\? This can’t be undone\\.`), 'the confirmation text');
  let r = await submit(path, inq.html, `Delete ${first}`, { confirm: '' });
  assert.match(r.location, new RegExp(`error=Confirm the deletion of ${first} first`), 'no deletion without the confirmation');
  inq = await get(path);
  assert.match(inq.html, DRAFT, 'the draft is still there');
  r = await submit(path, inq.html, `Delete ${first}`, {});
  assert.match(r.location, new RegExp(`ok=Quotation ${first} deleted`));
  inq = await get(path);
  assert.doesNotMatch(inq.html, DRAFT, 'the draft is gone');
  assert.match(inq.html, new RegExp(`Quotation ${first} \\(draft\\) deleted`), 'the inquiry timeline notes the deletion');
  assert.match(inq.html, /Prepare a quotation/);
  assert.match(inq.html, /Under review/, 'with no quotation left the inquiry is back under review');

  // 2. the next quotation takes a new number, never the deleted one
  await submit(path, inq.html, 'Save the draft', draft);
  inq = await get(path);
  const second = inq.html.match(DRAFT)?.[1];
  assert.ok(second && seq(second) > seq(first), `a fresh number (${second} after ${first})`);

  // 3. sent: no delete control, and a forged delete is refused by the server
  await submit(path, inq.html, `Send ${second}`, {});
  inq = await get(path);
  const sentId = inq.html.match(new RegExp(`Quotation ${second}: sent</h2><p>[^<]*<a class="link" href="/api/portal/quotations/([0-9a-f-]{36})"`))?.[1];
  assert.ok(sentId, 'the sent quotation');
  assert.doesNotMatch(inq.html, new RegExp(`Delete ${second}`), 'no delete control on a sent quotation');
  await submit(path, inq.html, 'Save the draft', draft); // a draft, for a delete form to forge from
  inq = await get(path);
  const third = inq.html.match(DRAFT)?.[1];
  r = await submit(path, inq.html, `Delete ${third}`, { quotationId: sentId, confirm: second });
  assert.match(r.location, new RegExp(`error=${second} is sent\\. Only a draft or a declined quotation can be deleted: mark it declined first`));

  // 4. declined: the control appears and the deletion goes through
  inq = await get(path);
  await submit(path, inq.html, 'Mark declined', {});
  inq = await get(path);
  assert.match(inq.html, new RegExp(`Quotation ${second}: declined`));
  r = await submit(path, inq.html, `Delete ${second}`, {});
  assert.match(r.location, new RegExp(`ok=Quotation ${second} deleted`));
  inq = await get(path);
  assert.doesNotMatch(inq.html, new RegExp(`Quotation ${second}: declined</h2>`), 'the declined quotation is gone');
  assert.match(inq.html, new RegExp(`Quotation ${second} \\(declined\\) deleted`), 'and noted in the timeline');
  await submit(path, inq.html, `Delete ${third}`, {}); // tidy: the forged-from draft

  // 5. the record: who deleted which quotation, and when (the audit log lists the time, the admin and the detail)
  const audit = await get('/admin/audit');
  for (const n of [first, second, third]) {
    assert.match(audit.html, new RegExp(`quotation\\.delete[\\s\\S]{0,400}?&quot;number&quot;:&quot;${n}&quot;|quotation\\.delete[\\s\\S]{0,400}?"number":"${n}"`), `audit entry for ${n}`);
  }
  assert.match(audit.html, new RegExp(env.SEED_ADMIN_EMAIL.replace(/[.@]/g, '\\$&')), 'the admin is named');
});
