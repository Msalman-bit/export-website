'use client';

/* The inquiry list lives in the browser (localStorage) until it is sent: no account needed, nothing
   reaches the server before the visitor submits. Every change fires "ms-basket" so all islands update. */

export type BasketItem = {
  productId: string | null;
  name: string;
  sku: string;
  image?: string;
  href?: string;
  quantity: number;
  notes: string;
  sample?: boolean;
  customisation?: Record<string, unknown> | null;
  key: string;
};

const KEY = 'ms_basket';

export function readBasket(): BasketItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as BasketItem[]) : [];
    return Array.isArray(list) ? list.filter((i) => i && typeof i.name === 'string') : [];
  } catch {
    return [];
  }
}

export function writeBasket(items: BasketItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50))); } catch { /* private mode: the list lasts the page */ }
  window.dispatchEvent(new CustomEvent('ms-basket', { detail: items }));
}

export function addToBasket(item: Omit<BasketItem, 'key'>) {
  const items = readBasket();
  const key = item.customisation ? `${item.productId}:${Date.now().toString(36)}` : `${item.productId ?? item.name}${item.sample ? ':sample' : ''}`;
  const existing = items.find((i) => i.key === key);
  if (existing) existing.quantity += item.quantity;
  else items.push({ ...item, key });
  writeBasket(items);
  // first-party count, no identifiers
  navigator.sendBeacon?.('/api/events', JSON.stringify({ name: 'basket_add', productId: item.productId, path: location.pathname }));
  return items;
}

export function clearBasket() {
  writeBasket([]);
}
