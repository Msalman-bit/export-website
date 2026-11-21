/* A sliding-window rate limiter held in memory. One server process: exact. Several instances behind a
   load balancer: each counts on its own, so put the same limits at the edge (Cloudflare rate limiting
   rules) or swap this store for Redis (docs/SECURITY.md). */

type Bucket = { hits: number[] };
const g = globalThis as unknown as { __monolithRate?: Map<string, Bucket> };
const store: Map<string, Bucket> = g.__monolithRate ?? (g.__monolithRate = new Map());

export type Limit = { limit: number; windowMs: number };

export const LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  reset: { limit: 5, windowMs: 60 * 60_000 },
  inquiry: { limit: 10, windowMs: 60 * 60_000 },
  newsletter: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 30, windowMs: 60 * 60_000 },
  event: { limit: 240, windowMs: 60 * 60_000 },
  stepUp: { limit: 5, windowMs: 15 * 60_000 }, // wrong authenticator codes (or failed passkeys) on a destructive action, per staff member
  // starting a passkey sign-in, per address: looser than `login` (which counts every passkey answered), because
  // closing the browser's passkey window and trying again is common
  passkeyStart: { limit: 20, windowMs: 15 * 60_000 },
} satisfies Record<string, Limit>;

/** True when `key` has used up its limit, without counting this call (for limits that count only failures). */
export function limited(key: string, { limit, windowMs }: Limit, now = Date.now()): boolean {
  const b = store.get(key);
  return !!b && b.hits.filter((t) => now - t < windowMs).length >= limit;
}

export function rateLimit(key: string, { limit, windowMs }: Limit, now = Date.now()): { ok: boolean; retryAfter: number } {
  const b = store.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    store.set(key, b);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - b.hits[0])) / 1000) };
  }
  b.hits.push(now);
  store.set(key, b);
  if (store.size > 50_000) for (const [k, v] of store) if (!v.hits.length || now - v.hits[v.hits.length - 1] > 3_600_000) store.delete(k);
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  store.clear();
}
