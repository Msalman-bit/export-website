import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { SECTIONS } from '@/lib/i18n/drafts';
import { makeTx, textKey, norm, seoTitle } from '@/lib/i18n/tx';
import { clientTx } from '@/lib/i18n/fill';
import { sourceStrings } from '@/lib/i18n/dictionaries';
import { CATALOGUE } from '@/lib/catalogue-data';
import { PAGES } from '@/lib/content/pages-data';
import { RichText } from '@/components/site/RichText';

const ALL = SECTIONS.flatMap((s) => Object.entries(s.drafts).map(([en, tr]) => ({ section: s.id, en, tr })));
const has = new Set(ALL.map((d) => norm(d.en)));
const LANGS = ['de', 'fr', 'es', 'it', 'nl'] as const;

describe('page and product drafts', () => {
  it('give every text in all five languages, once', () => {
    const seen = new Map<string, string>();
    for (const d of ALL) {
      expect(d.tr).toHaveLength(5);
      for (const t of d.tr) expect(t.trim().length, d.en).toBeGreaterThan(0);
      expect(seen.get(norm(d.en)), `"${d.en}" is in ${seen.get(norm(d.en))} and ${d.section}`).toBeUndefined();
      seen.set(norm(d.en), d.section);
    }
  });

  it('keep the placeholders, link addresses, headings and list lines of the English', () => {
    const marks = (s: string) => ({
      vars: [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      paths: [...s.matchAll(/\]\((\/[^)]*)\)|\|(\/[^\]]*)\]\]/g)].map((m) => m[1] ?? m[2]).sort(),
      headings: s.split('\n').filter((l) => l.startsWith('## ')).length,
      items: s.split('\n').filter((l) => l.startsWith('- ')).length,
    });
    for (const d of ALL) for (const t of d.tr) expect(marks(t), `${d.en} -> ${t}`).toEqual(marks(d.en));
  });

  it('follow the owner’s copy rules: no full stop the English lacks, never "family", never "under your brand"', () => {
    for (const d of ALL) {
      for (const [k, t] of d.tr.entries()) {
        if (!/[.!?:]$/.test(d.en.trim())) expect(t.trim().endsWith('.'), `${LANGS[k]}: ${t}`).toBe(false);
        expect(t, `${LANGS[k]}: ${t}`).not.toMatch(/famil/i);
        expect(t, `${LANGS[k]}: ${t}`).not.toMatch(/unter Ihrer Marke|sous votre marque|bajo su marca|sotto il vostro marchio|onder uw merk/i);
      }
    }
    for (const st of sourceStrings()) for (const l of LANGS) expect(st.drafts[l], `${st.key} ${l}`).not.toMatch(/famil|unter Ihrer Marke|sous votre marque|onder uw merk/i);
  });

  it('cover every text the data file seeds into the catalogue', () => {
    const missing: string[] = [];
    const need = (s: string | undefined) => { if (s && !has.has(norm(s))) missing.push(s); };
    for (const f of CATALOGUE) {
      [f.name, f.short, f.summary, f.body].forEach(need);
      need(`About ${/^[A-Z][a-z]/.test(f.name) ? f.name.charAt(0).toLowerCase() + f.name.slice(1) : f.name}`);
      for (const sub of f.subs) {
        const p = sub.product;
        [sub.name, p.name, p.summary, p.description, p.construction, p.materials].forEach(need);
        [...(p.sizes ?? []), ...(p.branding ?? []), ...(p.packaging ?? [])].forEach(need);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('cover About and Contact block by block, and leave the legal pages alone', () => {
    for (const slug of ['about', 'contact']) {
      const page = PAGES.find((p) => p.slug === slug)!;
      for (const text of [page.title, page.summary, ...page.body.replace(/\r/g, '').split(/\n{2,}/)]) expect(has.has(norm(text)), text).toBe(true);
    }
    for (const slug of ['privacy', 'cookies', 'terms']) expect(has.has(norm(PAGES.find((p) => p.slug === slug)!.summary))).toBe(false);
  });

  it('cover every English text the key pages hand to the translator', () => {
    const read = (f: string) => readFileSync(path.resolve(__dirname, '../../src', f), 'utf8');
    const found = new Set<string>();
    const add = (re: RegExp, src: string, group = 1) => { for (const m of src.matchAll(re)) found.add(m[group].replace(/\\'/g, '\'')); };
    const call = /\b(?:tx|T|x)\(\s*'((?:[^'\\]|\\.)*)'/g;
    const files = ['app/(site)/[locale]/page.tsx', 'app/(site)/[locale]/products/page.tsx', 'app/(site)/[locale]/products/[family]/page.tsx',
      'app/(site)/[locale]/products/[family]/[product]/page.tsx', 'app/(site)/[locale]/[...slug]/page.tsx', 'app/(site)/[locale]/inquiry/page.tsx',
      'app/(site)/[locale]/inquiry/sent/page.tsx', 'app/(site)/[locale]/search/page.tsx', 'components/site/Header.tsx', 'components/site/Footer.tsx', 'components/site/PageShell.tsx',
      'components/site/InquiryForm.tsx', 'components/site/ProductPicker.tsx', 'components/site/CatalogueFilter.tsx', 'components/site/Gallery.tsx',
      'components/site/AddToInquiry.tsx', 'components/site/ExportMap.tsx', 'components/site/LeadForm.tsx'];
    for (const f of files) add(call, read(f));
    const home = read('app/(site)/[locale]/page.tsx');
    const consts = home.slice(home.indexOf('const RANGE_TITLE'), home.indexOf('export default async function Home'));
    // every string literal of the constants that is not an object key (a slug)
    for (const m of consts.matchAll(/'((?:[^'\\\n]|\\.)*)'(\s*:)?/g)) if (!m[2]) found.add(m[1]);
    const header = read('components/site/Header.tsx');
    add(/(?:label|line|title|alt): '([^']+)'/g, header);
    add(/\bcol\('([^']+)'/g, header);
    add(/^\s+[\w'-]+: '([^']+)',?/gm, header.slice(header.indexOf('const FAMILY_LINE'), header.indexOf('const Chev')));
    add(/page\('[^']+', '([^']+)'\)/g, read('components/site/Footer.tsx'));
    const form = read('components/site/InquiryForm.tsx');
    add(/^\s+\w+: '([^']+)',/gm, form.slice(form.indexOf('const BUTTON'), form.indexOf('};', form.indexOf('const BUTTON'))));
    const slugPage = read('app/(site)/[locale]/[...slug]/page.tsx');
    add(/\['\w+', '([^']+)'\]/g, slugPage);
    add(/\w+: '([A-Z][^']+)'/g, slugPage.slice(slugPage.indexOf('const SECTION_NAME'), slugPage.indexOf('const IMAGE_ALT')));
    add(/keys\.push\('([^']+)'\)/g, read('app/(site)/[locale]/products/[family]/page.tsx'));
    for (const f of ['app/(site)/[locale]/products/[family]/page.tsx', 'app/(site)/[locale]/products/[family]/[product]/page.tsx'])
      for (const m of read(f).matchAll(/tx\.pick\(\[([^\]]*)\]/g)) for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) found.add(s[1]);
    for (const m of home.matchAll(/tx\.pick\(\[([^\]]*)\]/g)) for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) found.add(s[1]);
    // the form's interface words come from dictionaries.ts (server.ts formText)
    const fromDictionary = new Set(['Request a quotation', 'Request a sample', 'See the catalogue', 'Quantity', 'Remove', 'Notes for this product']);
    const missing = [...found].filter((s) => s.trim() && !/^[a-z-]+$/.test(s) && !fromDictionary.has(s) && !has.has(norm(s)));
    expect(missing).toEqual([]);
    expect(found.size).toBeGreaterThan(250);
  });
});

describe('tx', () => {
  it('shows a translation, and English with lang="en" where there is none', () => {
    const de = makeTx('de');
    expect(de('Product range')).toBe('Produktsortiment');
    expect(de.lang('Product range')).toBeUndefined();
    expect(de('A sentence nobody translated')).toBe('A sentence nobody translated');
    expect(de.lang('A sentence nobody translated')).toBe('en');
    expect(de('')).toBe('');
    const en = makeTx('en');
    expect(en('Product range')).toBe('Product range');
    expect(en.lang('A sentence nobody translated')).toBeUndefined();
    expect(en.has('anything')).toBe(true);
  });

  it('puts a reviewer’s wording over the draft, and ignores line endings', () => {
    const block = '## Order process\n- You send an inquiry with the products, quantities and branding you need.\n- We reply with a quotation in EUR, GBP or USD.\n- We make a sample; production starts after you approve it.\n- The bulk order is made and inspected against that sample, then packed and shipped.';
    const de = makeTx('de', { [textKey(block)]: '## Ablauf\n- Geprüft' });
    expect(de(block.replace(/\n/g, '\r\n'))).toBe('## Ablauf\n- Geprüft');
    expect(textKey(block)).toBe(textKey(block.replace(/\n/g, '\r\n') + '\n'));
    expect(textKey(block)).toMatch(/^x:[0-9a-z]+$/);
    expect(textKey('a')).not.toBe(textKey('b'));
  });

  it('fills placeholders, lists in the language, and keeps French signs off the start of a line', () => {
    const fr = makeTx('fr');
    expect(fr('{name}: target market', { name: 'Irlande' })).toBe('Irlande : marché cible');
    expect(makeTx('en').list(['EUR', 'GBP', 'USD'], 'or')).toBe('EUR, GBP or USD');
    expect(makeTx('de').list(['EUR', 'GBP', 'USD'], 'or')).toBe('EUR, GBP oder USD');
    expect(clientTx({ 'Filter ({n} selected)': 'Filter ({n} ausgewählt)' })('Filter ({n} selected)', { n: 2 })).toBe('Filter (2 ausgewählt)');
    expect(clientTx()('Filter ({n} selected)', { n: 2 })).toBe('Filter (2 selected)');
  });

  it('rebuilds the seeded search titles in the language and leaves English as it was', () => {
    const pattern = '{name}: custom and private-label manufacturing';
    expect(seoTitle(makeTx('en'), 'Match football: custom and private-label manufacturing', 'Match football', pattern)).toBe('Match football: custom and private-label manufacturing');
    expect(seoTitle(makeTx('de'), 'Match football: custom and private-label manufacturing', 'Match football', pattern)).toBe('Spielball: individuelle Fertigung und Private Label');
    expect(seoTitle(makeTx('de'), 'An owner’s own title', 'Match football', pattern)).toBe('Spielball');
  });

  it('turns a page body into the language block by block, marking an untranslated block English', () => {
    const about = PAGES.find((p) => p.slug === 'about')!;
    const html = renderToStaticMarkup(RichText({ body: `${about.body}\n\nA new paragraph the owner added.`, locale: 'de', tx: makeTx('de') }));
    expect(html).toContain('<h2>Bestellablauf</h2>');
    expect(html).toContain('href="/de/products">Katalog</a>');
    expect(html).toContain('href="/de/inquiry">Angebot anfragen');
    expect(html).toContain('<p lang="en">A new paragraph the owner added.</p>');
    expect(renderToStaticMarkup(RichText({ body: about.body, locale: 'en', tx: makeTx('en') }))).not.toContain('lang=');
  });
});
