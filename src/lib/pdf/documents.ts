import { Doc, money, MUTED } from './pdf';
import type * as S from '../db/schema';
import { countryName } from '../inquiry/countries';

type Product = typeof S.products.$inferSelect;
type Quote = typeof S.quotations.$inferSelect;
type Inquiry = typeof S.inquiries.$inferSelect;
type Invoice = typeof S.invoices.$inferSelect;
type Order = typeof S.orders.$inferSelect;

const ON_QUOTE = 'Confirmed in your quotation';

export async function datasheetPdf(p: Product, familyName: string, subName: string) {
  const d = await Doc.create(`Datasheet ${p.sku}`);
  d.text(`${familyName} / ${subName}`, { size: 9, color: MUTED });
  d.heading(p.name, 22);
  d.text(p.summary, { size: 11, gap: 10 });
  await d.image(p.images[0]?.url, 240, 240);
  d.heading('Specification', 13);
  d.rows([
    ['SKU', p.sku], ['Construction', p.construction || ON_QUOTE], ['Materials', p.materials || ON_QUOTE],
    ['Sizes', p.sizes.join(', ') || ON_QUOTE], ['Weight', p.weight || ON_QUOTE], ['Colours', p.colours.join(', ') || 'Your colours, matched to Pantone references'],
    ['Branding you can request', p.brandingOptions.join(', ') || ON_QUOTE], ['Packaging you can request', p.packagingOptions.join(', ') || ON_QUOTE],
    ['Minimum order', p.moq || ON_QUOTE], ['Production lead time', p.leadTime || ON_QUOTE],
    ['Testing standards', p.testingStandards.join(', ') || 'Named in the quotation for your market'],
    ...p.specs.map((s) => [s.label, s.value] as [string, string]),
  ]);
  d.heading('Description', 13);
  d.text(p.description, { size: 10 });
  d.y -= 8;
  d.text('Product pictures are visual concepts of the product type. The specification of an order is the one confirmed in its quotation and approved sample.', { size: 8.5, color: MUTED });
  return d.save();
}

export async function quotationPdf(q: Quote, inq: Inquiry, settings: { footer: string }) {
  const d = await Doc.create(`Quotation ${q.number}`);
  d.heading(`Quotation ${q.number}`, 22);
  d.rows([
    ['For', `${inq.companyName}\n${inq.contactName}\n${inq.email}`],
    ['Destination', countryName(inq.country)],
    ['Inquiry reference', inq.reference],
    ['Date', (q.sentAt ?? q.createdAt).toISOString().slice(0, 10)],
    ['Valid until', q.validUntil || 'On request'],
    ['Currency', q.currency],
  ]);
  d.y -= 8;
  const lines = q.lines.map((l) => [l.description, l.sku, l.quantity.toLocaleString('en-GB'), money(Number(l.unitPrice), q.currency), money(Number(l.unitPrice) * l.quantity, q.currency)]);
  d.table(['Product', 'SKU', 'Quantity', 'Unit price', 'Amount'], lines, [190, 90, 70, 74, 75], [2, 3, 4]);
  const sub = q.lines.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0);
  const ship = Number(q.shippingCost || 0);
  d.rows([
    ['Subtotal', money(sub, q.currency)],
    ...(ship ? [['Shipping', money(ship, q.currency)] as [string, string]] : []),
    ['Total', money(Number(q.total), q.currency)],
  ], 380);
  d.heading('Terms', 13);
  d.rows([
    ['Payment terms', q.paymentTerms || 'As agreed in writing'],
    ['Delivery terms', q.incoterm || 'As agreed in writing'],
    ['Production lead time', q.leadTime || 'From sample approval, as agreed'],
  ]);
  if (q.notes) { d.heading('Notes', 13); d.text(q.notes); }
  d.y -= 8;
  d.text(settings.footer, { size: 8.5, color: MUTED });
  d.text('Production follows the approved sample. Colours shown on screen or in concept previews are not binding.', { size: 8.5, color: MUTED });
  return d.save();
}

export async function invoicePdf(inv: Invoice, order: Order, company: { name: string; address: string; country: string }) {
  const d = await Doc.create(`Invoice ${inv.number}`);
  d.heading(`Invoice ${inv.number}`, 22);
  d.rows([
    ['Billed to', `${company.name}\n${company.address}\n${countryName(company.country)}`.trim()],
    ['Order', order.number], ['Issued', inv.issuedAt], ['Due', inv.dueAt || 'On receipt'], ['Status', inv.status],
  ]);
  d.y -= 8;
  d.rows([['Amount due', money(Number(inv.amount), inv.currency)]], 380);
  if (inv.notes) { d.heading('Notes', 13); d.text(inv.notes); }
  d.y -= 8;
  d.text('Bank details are sent separately by the sales team. Never pay to account details received from an unknown address.', { size: 8.5, color: MUTED });
  return d.save();
}

export async function cataloguePdf(families: { name: string; summary: string; products: Product[] }[]) {
  const d = await Doc.create('Product catalogue');
  d.heading('Product catalogue', 26);
  d.text('Sports equipment made in Pakistan under your brand. Every product is made to the specification, colours, branding and packaging confirmed in your quotation.', { size: 11, gap: 14 });
  for (const f of families) {
    d.newPage();
    d.heading(f.name, 20);
    d.text(f.summary, { size: 10.5, gap: 10 });
    for (const p of f.products) {
      d.ensure(150);
      const top = d.y;
      const drew = await d.image(p.images[0]?.url, 110, 110);
      const after = d.y;
      if (drew) d.y = top;
      d.text(p.name, { size: 12, bold: true, x: drew ? 48 + 126 : 48, width: 370, gap: 2 });
      d.text(`${p.sku} · ${p.construction}`, { size: 9, color: MUTED, x: drew ? 48 + 126 : 48, width: 370, gap: 2 });
      d.text(p.summary, { size: 9.5, x: drew ? 48 + 126 : 48, width: 370, gap: 2 });
      d.y = Math.min(d.y, after) - 6;
      d.rule();
    }
  }
  return d.save();
}
