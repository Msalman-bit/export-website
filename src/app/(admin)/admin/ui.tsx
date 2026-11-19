import { STATUS_LABEL } from '@/lib/status';

/* Small shared pieces for admin pages (server components). */

export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.error) return <p className="flash flash--error" role="alert">{sp.error}</p>;
  if (sp.ok) return <p className="flash" role="status">{sp.ok}</p>;
  if (sp.denied) return <p className="flash flash--error" role="alert">Your role does not include that area.</p>;
  return null;
}

export function Status({ value }: { value: string }) {
  return <span className="pill-status">{STATUS_LABEL[value] ?? value}</span>;
}

export const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '');
export const day = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const money = (n: string | number, c: string) => `${c} ${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type SP = Promise<Record<string, string | undefined>>;
