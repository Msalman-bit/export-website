import { notFound } from 'next/navigation';
import { dictionary, type Dict } from './dictionaries';
import { isLocale, type Locale } from './config';
import { getReviewedTranslations } from '../data';

export async function getDict(locale: Locale): Promise<Dict> {
  if (locale === 'en') return dictionary('en');
  const reviewed = await getReviewedTranslations(locale);
  return dictionary(locale, reviewed);
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
