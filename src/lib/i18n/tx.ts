import type { Locale } from './config';
import { SECTIONS } from './drafts';
import { fill } from './fill';

/* Page and product text in the five other languages, looked up by the English itself.

   The drafts live in ./drafts (one file per part of the site); a reviewer's wording, saved in Admin > Translations,
   replaces a draft. A text with no translation shows in English, and tx.lang() says so, so the page can mark it
   lang="en". Because the English is the key, a text changed later (in the code or in the admin) shows in English
   until its new wording is translated: a translation never stands beside English it no longer matches.

   Pure (no database, no Node modules): the server resolves texts and hands client components plain strings. */

const OTHER = ['de', 'fr', 'es', 'it', 'nl'] as const;

/** The English as it is compared: line endings and the outer spaces do not count. */
export const norm = (s: string) => s.replace(/\r\n?/g, '\n').trim();

/** A text's address in the translations table: "x:" and a 53-bit hash of its English (cyrb53), so a long page
    block gets a short key, and a reworded English text a new one. */
export function textKey(en: string): string {
  const str = norm(en);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `x:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

const ALL = new Map<string, readonly string[]>();
for (const sec of SECTIONS) for (const [en, tr] of Object.entries(sec.drafts)) ALL.set(norm(en), tr);

export { fill };

export type Tx = {
  (en: string | null | undefined, vars?: Record<string, string | number>): string;
  /** "en" when this text shows in English on a page in another language (no translation yet) */
  lang: (en: string | null | undefined) => 'en' | undefined;
  has: (en: string | null | undefined) => boolean;
  /** "EUR, GBP or USD" in the page's language */
  list: (items: string[], type?: 'and' | 'or') => string;
  /** the given English texts with their wording in this language, for a client component */
  pick: (texts: Iterable<string>) => Record<string, string>;
  locale: Locale;
};

/** French sets a no-break space before : ; ? ! and inside « », so the sign never starts a line on its own. */
const frenchSpaces = (s: string) => s.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ');

export function makeTx(locale: Locale, reviewed: Record<string, string> = {}): Tx {
  const i = OTHER.indexOf(locale as (typeof OTHER)[number]);
  const anyReviewed = Object.keys(reviewed).some((k) => k.startsWith('x:'));
  const find = (en: string | null | undefined): string | undefined => {
    if (i < 0 || !en) return undefined;
    const n = norm(en);
    if (!n) return undefined;
    const out = (anyReviewed ? reviewed[textKey(n)] : undefined) || ALL.get(n)?.[i] || undefined;
    return out && locale === 'fr' ? frenchSpaces(out) : out;
  };
  const tx = ((en, vars) => fill(en ? (find(en) ?? en) : '', vars)) as Tx;
  tx.lang = (en) => (i >= 0 && en && norm(en) && find(en) === undefined ? 'en' : undefined);
  tx.has = (en) => i < 0 || find(en) !== undefined;
  tx.list = (items, type = 'and') => {
    if (items.length < 2) return items[0] ?? '';
    try {
      return new Intl.ListFormat(locale === 'en' ? 'en-GB' : locale, { type: type === 'or' ? 'disjunction' : 'conjunction' }).format(items);
    } catch {
      return `${items.slice(0, -1).join(', ')} ${type === 'or' ? 'or' : 'and'} ${items[items.length - 1]}`;
    }
  };
  tx.pick = (texts) => {
    const out: Record<string, string> = {};
    if (i < 0) return out;
    for (const en of texts) { const v = find(en); if (v) out[en] = v; }
    return out;
  };
  tx.locale = locale;
  return tx;
}

/** A search title in the page's language. One the seed wrote from a pattern ("Football equipment manufacturer for
    private label and wholesale") is rebuilt from the translated pattern and name; one with a translation of its own
    shows that; any other (written in the admin) gives way to the translated name. English is returned as it is. */
export function seoTitle(tx: Tx, title: string, name: string, pattern: string): string {
  if (tx.locale === 'en') return title || name;
  if (title && tx.has(title)) return tx(title);
  if (title === fill(pattern, { name })) return tx(pattern, { name: tx(name) });
  return tx(name);
}

/** A country's name in the page's language (Intl, so no drafts are needed); the English name when unknown. */
export function countryIn(locale: Locale, iso2: string, english: string): string {
  if (locale === 'en' || !/^[A-Z]{2}$/.test(iso2)) return english;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(iso2) ?? english;
  } catch {
    return english;
  }
}
