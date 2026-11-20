/* Adding to the catalogue from the admin, against a running local server, without a browser: a new family (with its
   tile picture) and a product type start hidden, take a product, appear on the site once published, change picture,
   refuse to be deleted while they hold anything, then are removed again, leaving the catalogue as it was.
   Credentials are read from .env.local (never printed); two-factor as in 2-admin-flow.test.mjs.
     BASE_URL=http://localhost:3100 node --test tests/e2e/6-categories.test.mjs */
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
async function get(path, { anon = false } = {}) {
  const r = await fetch(BASE + path, { headers: anon ? {} : { cookie: cookieHeader() }, redirect: 'manual' });
  if (!anon) keep(r);
  return { status: r.status, location: r.headers.get('location'), html: r.status === 200 ? await r.text() : '' };
}
const plain = (html) => html.replace(/<!-- -->/g, '');
/** Posts the form holding every one of the given texts (its button, a hidden id), as a browser without JavaScript posts it. */
async function submit(path, html, needles, fields) {
  const forms = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)];
  const form = forms.find((f) => needles.every((n) => plain(f[1]).includes(n)));
  assert.ok(form, `a form with ${needles.map((n) => `"${n}"`).join(' and ')} on ${path}`);
  const fd = new FormData();
  for (const m of form[1].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1]; const value = m[0].match(/value="([^"]*)"/)?.[1] ?? '';
    if (name) fd.append(name, value.replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const r = await fetch(BASE + path, { method: 'POST', body: fd, headers: { cookie: cookieHeader(), Origin: BASE }, redirect: 'manual' });
  keep(r);
  const location = r.headers.get('location') ?? r.headers.get('x-action-redirect') ?? '';
  return { status: r.status, location: decodeURIComponent(location) };
}
const b32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret) => { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac('sha1', b32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
const MFA_FILE = '.taste-skill/admin-mfa-test.txt';
// a 1 x 1 PNG: the upload check reads the file's first bytes, not only its name
const png = () => new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')], 'tile.png', { type: 'image/png' });

async function signIn() {
  const page = await get('/admin/login');
  await submit('/admin/login', page.html, ['Continue'], { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  assert.ok(jar.has('ms_staff'), 'a staff session cookie after the password');
  const setup = await get('/admin/mfa/setup');
  if (setup.status === 200) {
    const secret = setup.html.match(/class="mono">([A-Z2-7 ]+)</)?.[1].replace(/\s/g, '');
    assert.ok(secret, 'the setup page shows the key');
    fs.mkdirSync('.taste-skill', { recursive: true });
    fs.writeFileSync(MFA_FILE, secret);
    await submit('/admin/mfa/setup', setup.html, ['Turn on two-factor sign-in'], { code: totp(secret) });
  } else {
    const mfa = await get('/admin/mfa');
    await submit('/admin/mfa', mfa.html, ['Sign in'], { code: totp(fs.readFileSync(MFA_FILE, 'utf8').trim()) });
  }
  assert.equal((await get('/admin')).status, 200, 'the dashboard opens after two-factor');
}

test('a family and a product type added in the admin: hidden, filled, published, then removed', async () => {
  await signIn();
  const stamp = Date.now().toString(36);
  const family = `Kite test ${stamp} equipment`;
  const short = `Kite test ${stamp}`;
  const typeName = `Stunt kites ${stamp}`;
  const C = '/admin/categories';
  let page = await get(C);
  assert.equal(page.status, 200);
  assert.match(page.html, /Add a family/);

  // the family, with its picture: it starts hidden and the page opens on its section
  let r = await submit(C, page.html, ['Add the family'], { name: family, summary: 'Test kites for the e2e run.', alt: 'A test kite', file: png() });
  const famId = r.location.match(/at=cat-([0-9a-f-]{36})/)?.[1];
  assert.ok(famId, `back on the new family's section (${r.location})`);
  assert.match(r.location, /stays hidden/);
  page = await get(C);
  const section = (id) => plain(page.html.match(new RegExp(`<section[^>]*id="cat-${id}"[\\s\\S]*?</section>`))?.[0] ?? '');
  assert.match(section(famId), /Hidden/, 'the new family is marked hidden');
  const famPic = section(famId).match(/<img src="\/media\/([0-9a-f-]{36})"/)?.[1];
  assert.ok(famPic, 'the family shows its uploaded picture');
  assert.match(section(famId), /Delete this empty family/, 'an empty family offers to be deleted');
  // the delete form's hidden fields (the server action), kept to try deleting things that offer no button
  const delForm = [...section(famId).matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].find((f) => plain(f[1]).includes('Delete this empty'))[1];
  const tryDelete = async (id) => {
    const fd = new FormData();
    for (const m of delForm.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = m[0].match(/name="([^"]*)"/)?.[1]; const value = m[0].match(/value="([^"]*)"/)?.[1] ?? '';
      if (name) fd.append(name, name === 'id' ? id : value);
    }
    const res = await fetch(BASE + C, { method: 'POST', body: fd, headers: { cookie: cookieHeader(), Origin: BASE }, redirect: 'manual' });
    return decodeURIComponent(res.headers.get('location') ?? res.headers.get('x-action-redirect') ?? '');
  };
  const slug = `kite-test-${stamp}-equipment`;
  assert.equal((await get(`/en/products/${slug}`, { anon: true })).status, 404, 'a hidden family has no page');

  // the same name twice is refused, in the new-family section
  r = await submit(C, page.html, ['Add the family'], { name: family, summary: 'Again.', file: png() });
  assert.match(r.location, /at=new-family&error=There is already a family called/);

  // a product type inside it
  r = await submit(C, page.html, ['Add the product type', `value="${famId}"`], { name: typeName, summary: 'Test stunt kites.' });
  assert.match(r.location, new RegExp(`at=cat-${famId}&ok=Product type`));
  page = await get(C);
  const typeId = [...section(famId).matchAll(/name="id" value="([0-9a-f-]{36})"/g)].map((m) => m[1]).find((id) => id !== famId);
  assert.ok(typeId, 'the product type is listed in its family');

  // the product form lists it under its family, marked hidden
  let prod = await get('/admin/products/new');
  assert.match(plain(prod.html), new RegExp(`<optgroup label="${family} \\(hidden\\)">[\\s\\S]*?${typeName} \\(hidden\\)`));
  r = await submit('/admin/products/new', prod.html, ['Create the product'], { name: `Stunt kite ${stamp}`, categoryId: typeId, sku: `MS-E2E-${stamp}`.toUpperCase(), status: 'published', summary: 'A test kite.' });
  const productId = r.location.match(/\/admin\/products\/([0-9a-f-]{36})/)?.[1];
  assert.ok(productId, `the product is created (${r.location})`);

  // a type or family that holds something cannot be deleted
  page = await get(C);
  assert.doesNotMatch(section(famId), /Delete this empty product type/, 'no delete button on a type with a product');
  assert.match(await tryDelete(typeId), /still has a product/, 'the server refuses to delete a type with a product');
  assert.match(await tryDelete(famId), /still has a product type/, 'the server refuses to delete a family with a type');

  // published: the family page, the home page and the menu show it under its short name
  const save = async (id, name, fields) => {
    page = await get(C);
    return submit(C, page.html, ['Save ' + name, `value="${id}"`], { name, sortOrder: '99', summary: 'Test.', body: '', seoTitle: '', seoDescription: '', published: 'on', ...fields });
  };
  r = await save(typeId, typeName, {});
  assert.match(r.location, new RegExp(`at=cat-${famId}&ok=Category saved`));
  r = await save(famId, family, { summary: 'Test kites for the e2e run.' });
  let pub = await get(`/en/products/${slug}`, { anon: true });
  assert.equal(pub.status, 200, 'the published family has its page');
  assert.match(plain(pub.html), new RegExp(`Stunt kite ${stamp}`), 'its product is listed');
  const home = await get('/en', { anon: true });
  assert.match(plain(home.html), new RegExp(`href="/en/products/${slug}"[^>]*>[\\s\\S]*?${short}<`), 'the home page lists it by its short name');

  // a new picture replaces the old one, whose file is deleted
  page = await get(C);
  r = await submit(C, page.html, ['Upload the picture', `value="${famId}"`], { file: png(), alt: 'Another test kite' });
  assert.match(r.location, /ok=New picture/);
  assert.equal((await get(`/media/${famPic}`, { anon: true })).status, 404, 'the replaced picture is gone');

  // clean up: the product, then the empty type, then the empty family
  // the product list keeps its search: a searched list links to the product with ?q=, the product page links back to
  // it, and deleting the product from there returns to the same search, which the search box shows
  const list = await get(`/admin/products?q=${stamp}`);
  assert.match(list.html, new RegExp(`href="/admin/products/${productId}\\?q=${stamp}"`), 'a searched list links to the product with its search');
  assert.match(list.html, new RegExp(`name="q" value="${stamp}"`), 'the search box shows the search');
  const none = await get(`/admin/products?q=zz-none-${stamp}`);
  assert.match(plain(none.html), new RegExp(`No product name or SKU contains “zz-none-${stamp}”`), 'a search that finds nothing says so');
  prod = await get(`/admin/products/${productId}?q=${stamp}`);
  assert.match(prod.html, new RegExp(`href="/admin/products\\?q=${stamp}"`), 'the product page links back to the search');
  r = await submit(`/admin/products/${productId}`, prod.html, ['Delete this product'], {});
  assert.equal(r.location, `/admin/products?q=${stamp}&ok=Product deleted.`, 'deleting returns to the searched list');
  page = await get(C);
  assert.match(section(famId), /Delete this empty product type/, 'an empty type can be deleted');
  assert.match(await tryDelete(typeId), new RegExp(`at=cat-${famId}&ok=${typeName} deleted`));
  page = await get(C);
  assert.match(section(famId), /Delete this empty family/);
  assert.match(await tryDelete(famId), new RegExp(`ok=${family} deleted`));
  assert.equal((await get(`/en/products/${slug}`, { anon: true })).status, 404, 'the deleted family has no page');
  page = await get(C);
  assert.equal(section(famId), '', 'the family is gone from the admin');
});
