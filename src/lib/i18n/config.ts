export const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'nl'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', nl: 'Nederlands',
};

/* hreflang values: English is written for Ireland and the UK first, so it stays a language tag. */
export const HREFLANG: Record<Locale, string> = { en: 'en', de: 'de', fr: 'fr', es: 'es', it: 'it', nl: 'nl' };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** The path with its locale prefix swapped: /de/products/football -> /fr/products/football */
export function swapLocale(pathname: string, to: Locale): string {
  const parts = pathname.split('/');
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join('/') || `/${to}`;
}

/** Pick the best locale from an Accept-Language header. */
export function negotiate(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header.split(',').map((part) => {
    const [tag, q] = part.trim().split(';q=');
    return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
  }).sort((a, b) => b.q - a.q);
  for (const r of ranked) if (isLocale(r.lang)) return r.lang;
  return DEFAULT_LOCALE;
}
