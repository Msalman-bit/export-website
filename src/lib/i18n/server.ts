import { cache } from 'react';
import { notFound } from 'next/navigation';
import { dictionary, type Dict } from './dictionaries';
import { isLocale, type Locale } from './config';
import { makeTx, countryIn, type Tx } from './tx';
import { FORM } from './drafts/form';
import { COUNTRIES } from '../inquiry/countries';
import { getReviewedTranslations } from '../data';

// one read of the reviewed wordings per language and request (the layout, the page and its frame all ask)
const reviewedFor = cache((locale: Locale) => getReviewedTranslations(locale));

export async function getDict(locale: Locale): Promise<Dict> {
  if (locale === 'en') return dictionary('en');
  const reviewed = await reviewedFor(locale);
  return dictionary(locale, reviewed);
}

/** Page and product text in this language (tx.ts): drafts, with the reviewed wordings over them. */
export async function getText(locale: Locale): Promise<Tx> {
  if (locale === 'en') return makeTx('en');
  return makeTx(locale, await reviewedFor(locale));
}

/** The quotation form's words for this language, handed to the client component as English -> this language.
    Its buttons and list words are the interface's own (dictionaries.ts), so each is reviewed in one place. */
export function formText(t: Dict, tx: Tx): Record<string, string> {
  if (tx.locale === 'en') return {};
  return {
    ...tx.pick(Object.keys(FORM.drafts)),
    'Clear the search': tx('Clear the search'),
    'Request a quotation': t['cta.quote'], 'Request a sample': t['cta.sample'], 'See the catalogue': t['cta.catalogue'],
    'Quantity': t['basket.quantity'], 'Remove': t['basket.remove'], 'Notes for this product': t['basket.notes'],
  };
}

/** The forms' destination countries, in their usual order, named in the page's language. */
export function formCountries(tx: Tx): { code: string; name: string }[] {
  return COUNTRIES.map((c) => ({ code: c.code, name: c.code === 'OTHER' ? tx(c.name) : countryIn(tx.locale, c.code, c.name) }));
}

export async function localeFrom(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

/** A site path with the locale prefix: href(l, '/products') -> '/de/products'. */
export function href(locale: Locale, path: string): string {
  if (/^(https?:|mailto:|#)/.test(path)) return path;
  if (path.startsWith('/#')) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path === '/' ? '' : path}`;
}
