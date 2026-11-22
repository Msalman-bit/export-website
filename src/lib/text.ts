/* Two small writing rules the public pages share. */

/** A short line under a title or on a card: a single sentence or phrase drops its final full stop; two or more keep theirs. */
export function shortLine(text: string): string {
  const t = text.trim();
  return /[.!?]\s/.test(t) ? t : t.replace(/\.$/, '');
}

/** A date in words, 18 November 2026: the day as stored (UTC). Text that is not a date is returned as it is. */
export function longDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
