/* Deleting an inquiry, against a running local server on a fresh test database, after 1-4 (it signs in as the
   seeded admin with the two-factor key 2-admin-flow enrolled). It makes its own inquiries, so nothing else is touched.
     BASE_URL=http://localhost:3100 node --test tests/e2e/5-inquiry-delete.test.mjs
   Never run it against a database that holds real data: it creates and deletes records.
   Checks: a sample request lands in "New inquiry"; a form sent too fast is refused visibly; the warning and the code field; no deletion without the confirmation, with a wrong code or with a code
   already used; a correct authenticator code deletes the inquiry with its file and draft quotation; a sent
   quotation blocks the deletion (also when the form is forged) until it is declined; quotation numbers are not
   reused; the deletion leaves the analytics as they are (only the reset changes them); the audit log records the
   refusals and each deletion with the admin who did it. A second test resets the analytics the same way
   (it runs in this file so both share the codes already spent: a code confirms one action only). */
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
const totp = (secret, at = Date.now()) => { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(at / 30000))); const h = crypto.createHmac('sha1', b32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
const SECRET = fs.readFileSync('.taste-skill/admin-mfa-test.txt', 'utf8').trim();
const used = new Set();
/** A code the server accepts now (it allows one step of drift either way) that no step-up has spent yet. */
const freshCode = () => { const c = [0, 30_000, -30_000].map((d) => totp(SECRET, Date.now() + d)).find((x) => !used.has(x)); used.add(c); return c; };
const wrongCode = () => { const ok = new Set([-30_000, 0, 30_000].map((d) => totp(SECRET, Date.now() + d))); let c = 0; while (ok.has(String(c).padStart(6, '0'))) c++; return String(c).padStart(6, '0'); };
const seq = (n) => Number(n.split('-').pop());
const DRAFT = /<h2>Quotation (Q-\d{4}-\d{4}) \(draft\)<\/h2>/;
const draft = { l_desc: ['Match football'], l_sku: ['MS-FB-MAT-001'], l_qty: ['300'], l_price: ['10.90'], shippingCost: '90' };

async function newInquiry(company, email, withFile, { productId, sample = false } = {}) {
  const fd = new FormData();
  Object.entries({ type: 'quote', companyName: company, contactName: 'Test Buyer', email, country: 'IE', currency: 'EUR', shippingMethod: 'sea', message: 'Quote for 300 match balls.', locale: 'en', sourcePage: '/en/inquiry', elapsed: '45000' }).forEach(([k, v]) => fd.set(k, v));
  fd.set('items', JSON.stringify([{ productId, name: 'Match football', quantity: sample ? 1 : 300, notes: '', sample }]));
  if (withFile) fd.append('files', new File(['%PDF-1.4 delete test brief'], 'brief.pdf', { type: 'application/pdf' }));
  const r = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: fd, headers: { Origin: BASE } });
  assert.equal(r.status, 200, `inquiry for ${company} created`);
  const { reference } = await r.json();
  const list = await get('/admin/inquiries');
  const id = list.html.match(new RegExp(`href="/admin/inquiries/([0-9a-f-]{36})">${reference}<`))?.[1];
  assert.ok(id, `${reference} is listed`);
  return { reference, path: `/admin/inquiries/${id}` };
}
/** The analytics funnel for the last 7 days. */
async function funnel() {
  const html = (await get('/admin/analytics?days=7')).html;
  const n = (label) => Number(html.match(new RegExp(`${label}: (\\d+)<`))?.[1] ?? NaN);
  return { views: n('Product views'), adds: n('Added to an inquiry'), samples: n('Samples requested') };
}

test('an admin deletes an inquiry only with the confirmation and a fresh authenticator code', async () => {
  let page = await get('/admin/login');
  await submit('/admin/login', page.html, 'Continue', { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  page = await get('/admin/mfa');
  await submit('/admin/mfa', page.html, 'Sign in', { code: totp(SECRET) });
  assert.equal((await get('/admin')).status, 200, 'signed in with two-factor');

  // a form sent under 3 seconds after it opened is refused with a message, never dropped silently
  const quick = new FormData();
  Object.entries({ type: 'quote', companyName: 'Quick FC', contactName: 'Quick Buyer', email: 'quick@e2e.example', country: 'IE', currency: 'EUR', locale: 'en', sourcePage: '/en/inquiry', elapsed: '800', items: '[{"name":"Match football","quantity":100}]' }).forEach(([k, v]) => quick.set(k, v));
  const fast = await fetch(`${BASE}/api/inquiries`, { method: 'POST', body: quick, headers: { Origin: BASE } });
  assert.equal(fast.status, 400, 'too fast: refused');
  assert.match((await fast.json()).errors?.form ?? '', /The form was submitted too quickly\. Please check it and send it again\./);

  // A: a buyer views a product, adds a sample of it and sends the request (with a file); the team drafts a quotation
  const before = await funnel();
  const product = await get('/en/products/football/match-football');
  const productId = product.html.match(/\/api\/products\/([0-9a-f-]{36})\/datasheet/)?.[1];
  assert.ok(productId, 'the product id');
  await fetch(`${BASE}/api/events`, { method: 'POST', body: JSON.stringify({ name: 'basket_add', productId, path: '/en/products/football/match-football' }), headers: { Origin: BASE, 'Content-Type': 'text/plain' } });
  const A = await newInquiry('Inquiry Delete FC', 'inqdelete@e2e.example', true, { productId, sample: true });
  const fresh = await get('/admin/inquiries?status=new');
  assert.match(fresh.html, new RegExp(`>${A.reference}<`), 'a sample request is listed under New inquiry');
  assert.match((await get(A.path)).html, /New inquiry/);
  const counted = await funnel();
  assert.deepEqual(counted, { views: before.views + 1, adds: before.adds + 1, samples: before.samples + 1 }, 'the visit and the request are counted');
  let inq = await get(A.path);
  const fileId = inq.html.match(/href="\/media\/([0-9a-f-]{36})">brief\.pdf</)?.[1];
  assert.ok(fileId, 'the uploaded file is listed');
  assert.equal((await get(`/media/${fileId}`)).status, 200, 'and downloads');
  await submit(A.path, inq.html, 'Save the draft', draft);
  inq = await get(A.path);
  const qA = inq.html.match(DRAFT)?.[1];
  assert.ok(qA, 'a draft quotation');
  assert.match(inq.html, new RegExp(`Delete inquiry ${A.reference}\\? This can’t be undone\\.`), 'the warning');
  assert.match(inq.html, /1 product line, 1 uploaded file, its timeline and 1 draft or declined quotation/, 'what goes with it');
  assert.match(inq.html, /the analytics counts stay as they are \(only Reset the analytics\s+changes them\)/, 'the warning says the counts stay');
  assert.match(inq.html, /Code from your authenticator app/, 'the code field');

  // refused: no confirmation, an empty code, a wrong code
  let r = await submit(A.path, inq.html, `Delete ${A.reference}`, { confirm: '', code: wrongCode() });
  assert.match(r.location, new RegExp(`error=Confirm the deletion of ${A.reference} first`));
  r = await submit(A.path, inq.html, `Delete ${A.reference}`, { code: '' });
  assert.match(r.location, /error=That code is not right\. .*Nothing was deleted\./);
  r = await submit(A.path, inq.html, `Delete ${A.reference}`, { code: wrongCode() });
  assert.match(r.location, /error=That code is not right\. .*Nothing was deleted\./);
  assert.equal((await get(A.path)).status, 200, 'the inquiry is still there');

  // deleted with a correct code: the page, its file and its quotation are gone
  const spent = freshCode();
  r = await submit(A.path, inq.html, `Delete ${A.reference}`, { code: spent });
  assert.match(r.location, new RegExp(`/admin/inquiries\\?ok=Inquiry ${A.reference} deleted\\.`));
  assert.equal((await get(A.path)).status, 404, 'the inquiry page is gone');
  assert.equal((await get(`/media/${fileId}`)).status, 404, 'the file is gone');
  assert.doesNotMatch((await get('/admin/inquiries')).html, new RegExp(A.reference), 'and it is off the list');
  assert.deepEqual(await funnel(), counted, 'deleting leaves the analytics as they are');

  // B: a code that deleted once cannot delete again
  const B = await newInquiry('Inquiry Delete Two FC', 'inqdelete2@e2e.example', false);
  inq = await get(B.path);
  r = await submit(B.path, inq.html, `Delete ${B.reference}`, { code: spent });
  assert.match(r.location, /error=That code was already used\. .*Nothing was deleted\./);

  // a sent quotation blocks it, also when the form is forged; the quotation number is a new one
  const forgeFrom = inq.html;
  await submit(B.path, inq.html, 'Save the draft', draft);
  inq = await get(B.path);
  const qB = inq.html.match(DRAFT)?.[1];
  assert.ok(qB && seq(qB) > seq(qA), `a fresh quotation number (${qB} after the deleted ${qA})`);
  await submit(B.path, inq.html, `Send ${qB}`, {});
  inq = await get(B.path);
  assert.match(inq.html, new RegExp(`Quotation ${qB} is sent, so this inquiry can’t be deleted\\. Mark the quotation declined first\\.`));
  assert.doesNotMatch(inq.html, new RegExp(`Delete ${B.reference}`), 'no delete control');
  r = await submit(B.path, forgeFrom, `Delete ${B.reference}`, { code: wrongCode() }); // refused before the code is read
  assert.match(r.location, new RegExp(`error=Quotation ${qB} is sent, so ${B.reference} cannot be deleted: mark the quotation declined first`));

  // declined: deleted with a fresh code
  await submit(B.path, inq.html, 'Mark declined', {});
  inq = await get(B.path);
  r = await submit(B.path, inq.html, `Delete ${B.reference}`, { code: freshCode() });
  assert.match(r.location, new RegExp(`ok=Inquiry ${B.reference} deleted`));
  assert.equal((await get(B.path)).status, 404);

  // the record: refusals and deletions, with the admin, the references and the quotation numbers
  const audit = (await get('/admin/audit')).html.replace(/&quot;/g, '"');
  const rowA = audit.split('<tr>').find((row) => row.includes('>inquiry.delete<') && row.includes(`"reference":"${A.reference}"`)) ?? '';
  assert.ok(rowA.includes(`"quotations":["${qA}"]`) && !rowA.includes('"analytics"'), 'A deleted, with its quotation');
  assert.match(audit, new RegExp(`inquiry\\.delete<[\\s\\S]{0,400}?"reference":"${B.reference}"`), 'B deleted');
  assert.match(audit, new RegExp(`inquiry\\.delete_refused<[\\s\\S]{0,400}?"reason":"wrong code"`), 'wrong codes are recorded');
  assert.match(audit, new RegExp(`inquiry\\.delete_refused<[\\s\\S]{0,400}?"reason":"code already used"`), 'a reused code is recorded');
  assert.match(audit, new RegExp(`quotation\\.delete<[\\s\\S]{0,400}?"number":"${qA}"`), 'the deleted quotation number stays reserved');
  assert.match(audit, new RegExp(env.SEED_ADMIN_EMAIL.replace(/[.@]/g, '\\$&')), 'the admin is named');
});

test('an admin resets the analytics only with the confirmation and a fresh authenticator code', async () => {
  // still signed in from the test above; a product view, so there is something to reset
  await get('/en/products/football/match-football');
  let page = await get('/admin/analytics');
  assert.match(page.html, /Reset all analytics counts\? This can’t be undone\./, 'the warning');
  assert.ok((await funnel()).views > 0, 'there are counts');
  const dash = await get('/admin');
  assert.match(dash.html, /href="\/admin\/analytics#reset">Reset the counts</, 'the dashboard points administrators to it');

  // refused: no confirmation, a wrong code; nothing is reset
  let r = await submit('/admin/analytics', page.html, 'Reset the analytics', { confirm: '', code: wrongCode() });
  assert.match(r.location, /error=Confirm the reset first\./);
  r = await submit('/admin/analytics', page.html, 'Reset the analytics', { code: wrongCode() });
  assert.match(r.location, /error=That code is not right\. .*Nothing was reset\./);
  assert.ok((await funnel()).views > 0, 'the counts are still there');

  // reset with a correct code: every count is zero, on Analytics and on the dashboard
  const resetForm = page.html;
  r = await submit('/admin/analytics', resetForm, 'Reset the analytics', { code: freshCode() });
  assert.match(r.location, /ok=Analytics reset: \d+ counts? removed\. Counting starts again from now\./);
  assert.deepEqual(await funnel(), { views: 0, adds: 0, samples: 0 });
  page = await get('/admin/analytics');
  assert.match(page.html, /Nothing to reset: every count is at zero\./);
  const after = await get('/admin');
  assert.match(after.html, /Product views, 30 days<\/span><strong>0</);
  assert.match(after.html, /Quotes requested, 30 days<\/span><strong>0</);
  // a second reset (the old form, sent again) finds nothing, before any code is read
  r = await submit('/admin/analytics', resetForm, 'Reset the analytics', { code: wrongCode() });
  assert.match(r.location, /ok=Nothing to reset: every count is already at zero\./, 'a second reset finds nothing');

  // counting starts again, and the audit log keeps who reset what and when
  await get('/en/products/football/match-football');
  assert.equal((await funnel()).views, 1, 'new views count from zero');
  const audit = (await get('/admin/audit')).html.replace(/&quot;/g, '"');
  const row = audit.split('<tr>').find((x) => x.includes('>analytics.reset<')) ?? '';
  assert.match(row, /"total":\d+/, 'the reset and its total');
  assert.match(row, /"product_view":\d+/, 'with the count of each kind');
  assert.match(row, new RegExp(env.SEED_ADMIN_EMAIL.replace(/[.@]/g, '\\$&')), 'and the admin');
  assert.match(audit, /analytics\.reset_refused<[\s\S]{0,300}?"reason":"wrong code"/, 'the wrong code is recorded');
});
