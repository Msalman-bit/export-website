/* The small half of tx.ts that client components import (tx.ts itself carries every draft, which stays on the
   server): placeholders, and a lookup over the strings the server handed a component. */

/** "{name} is on your list" with { name: 'Match football' }. A name with no value stays as it is. */
export function fill(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** For a client component: the strings it was handed (English text -> this language), English where none was. */
export function clientTx(text: Record<string, string> = {}) {
  return (en: string, vars?: Record<string, string | number>) => fill(text[en] ?? en, vars);
}
