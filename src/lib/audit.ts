import { getDb } from './db/client';
import * as s from './db/schema';

/** Append-only record of who changed what. Every staff write and every sign-in calls it. */
export async function audit(
  actor: { id: string; email: string } | null,
  action: string,
  entity = '',
  entityId = '',
  detail: Record<string, unknown> = {},
) {
  try {
    const db = await getDb();
    await db.insert(s.auditLog).values({ actorId: actor?.id ?? null, actorEmail: actor?.email ?? '', action, entity, entityId, detail });
  } catch (err) {
    console.error('[audit] failed', action, err);
  }
}

/** First-party, cookieless event counts for Admin > Analytics: no IP, no identifier, only a name and a path. */
export async function track(name: string, data: { path?: string; productId?: string | null; country?: string; locale?: string } = {}) {
  try {
    const db = await getDb();
    await db.insert(s.events).values({
      name: name.slice(0, 40), path: (data.path || '').slice(0, 200), productId: data.productId ?? null,
      country: (data.country || '').slice(0, 2), locale: (data.locale || '').slice(0, 5),
    });
  } catch (err) {
    console.error('[track] failed', name, err);
  }
}
