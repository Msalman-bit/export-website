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

/* The request type a visitor picked on the inquiry form ("Quotation for a bulk order" or "Samples first"), kept
   in this browser beside the list until the request is sent, so the form and the product pages agree. Every
   change fires "ms-mode". */
export type InquiryMode = 'quote' | 'sample';
const MODE_KEY = 'ms_inquiry_mode';

export function readMode(): InquiryMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'quote' || v === 'sample' ? v : null;
  } catch {
    return null;
  }
}

export function writeMode(mode: InquiryMode | null) {
  try {
    if (mode) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
  } catch { /* private mode: the choice lasts the page */ }
  window.dispatchEvent(new CustomEvent('ms-mode', { detail: mode }));
}
