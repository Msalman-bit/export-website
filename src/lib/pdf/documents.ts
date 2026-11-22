import { Doc, money, day, M, CW, A4, INK, MUTED, LIME, WHITE, INV_MUTED } from './pdf';
import type * as S from '../db/schema';
import { countryName } from '../inquiry/countries';

type Product = typeof S.products.$inferSelect;
type Quote = typeof S.quotations.$inferSelect;
type Inquiry = typeof S.inquiries.$inferSelect;
type Invoice = typeof S.invoices.$inferSelect;
type Order = typeof S.orders.$inferSelect;
/** The sales email from Admin > Settings, printed in every footer. */
type Contact = { contact?: string };

const ON_QUOTE = 'Confirmed in your quotation';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function datasheetPdf(p: Product, familyName: string, subName: string, o: Contact = {}) {
  const d = await Doc.create(`Datasheet ${p.sku}`, { kind: 'Datasheet', ref: p.sku, contact: o.contact, watermark: true });
  d.newPage();
  const crumb = [familyName, subName].filter(Boolean).join('  /  ');
  if (crumb) { d.y -= d.label(crumb, M, d.y) + 10; }
  d.y -= d.write(p.name, M, d.y, { size: 32, display: true, lh: 34 }) + 10;
  d.text(p.summary, { size: 11, lh: 15.5, gap: 18 });

  // the picture with the key facts beside it
  const side = 228, gap = 26, fx = M + side + gap, fw = CW - side - gap;
  d.ensure(side + 20);
  const top = d.y;
  await d.picture(p.images[0]?.url, M, top, side);
  let y = top;
  for (const [k, v] of [
    ['SKU', p.sku], ['Construction', p.construction || ON_QUOTE], ['Materials', p.materials || ON_QUOTE],
    ['Sizes', p.sizes.join(', ') || ON_QUOTE], ['Minimum order', p.moq || ON_QUOTE], ['Production lead time', p.leadTime || ON_QUOTE],
  ]) {
    y -= d.label(k, fx, y) + 5;
    y -= d.write(v, fx, y, { size: 10, width: fw, lh: 13.5, max: 3 }) + 13;
  }
  d.y = Math.min(top - side, y) - 26;

  d.heading('Specification');
  d.rows([
    ['Weight', p.weight || ON_QUOTE], ['Colours', p.colours.join(', ') || 'Your colours, matched to Pantone references'],
    ['Branding you can request', p.brandingOptions.join(', ') || ON_QUOTE], ['Packaging you can request', p.packagingOptions.join(', ') || ON_QUOTE],
    ['Testing standards', p.testingStandards.join(', ') || 'Named in the quotation for your market'],
    ...p.specs.map((s) => [s.label, s.value] as [string, string]),
  ]);
  if (p.description) { d.heading('Description'); d.text(p.description, { size: 10, lh: 14.5, gap: 18 }); }
  d.note('Product pictures are visual concepts of the product type. The specification of an order is the one confirmed in its quotation and approved sample.');
  return d.save();
}

export async function quotationPdf(q: Quote, inq: Inquiry, settings: { footer: string } & Contact) {
  const d = await Doc.create(`Quotation ${q.number}`, { kind: 'Quotation', ref: q.number, contact: settings.contact, watermark: true });
  d.newPage();
  d.title('Quotation', q.number);
  d.facts([
    [{ label: 'Prepared for', value: [inq.companyName, inq.contactName, inq.email].filter(Boolean).join('\n'), strong: true }],
    [{ label: 'Date', value: day(q.sentAt ?? q.createdAt) }, { label: 'Valid until', value: q.validUntil ? day(q.validUntil) : 'On request' }],
    [{ label: 'Destination', value: countryName(inq.country) || '-' }, { label: 'Currency', value: q.currency }],
    [{ label: 'Inquiry reference', value: inq.reference }],
  ], [190, 120, 95, CW - 405]);
  d.y -= 14;

  d.table(
    [{ head: '#', width: 30 }, { head: 'Product', width: CW - 30 - 70 - 84 - 94 }, { head: 'Quantity', width: 70, right: true }, { head: 'Unit price', width: 84, right: true }, { head: 'Amount', width: 94, right: true }],
    q.lines.map((l, i) => ({
      cells: [String(i + 1).padStart(2, '0'), l.description, l.quantity.toLocaleString('en-GB'), money(Number(l.unitPrice), q.currency), money(Number(l.unitPrice) * l.quantity, q.currency)],
      sub: ['', l.sku ? `SKU ${l.sku}` : '', '', '', ''],
    })),
  );
  d.y -= 16;
  const sub = q.lines.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0);
  const ship = Number(q.shippingCost || 0);
  d.totals([['Subtotal', money(sub, q.currency)], ...(ship ? [['Shipping', money(ship, q.currency)] as [string, string]] : [])], ['Total', money(Number(q.total), q.currency)]);

  d.heading('Terms');
  d.facts([
    [{ label: 'Payment terms', value: q.paymentTerms || 'As agreed in writing' }],
    [{ label: 'Delivery terms', value: q.incoterm || 'As agreed in writing' }],
    [{ label: 'Production lead time', value: q.leadTime || 'From sample approval, as agreed' }],
  ], [CW / 3, CW / 3, CW / 3]);
  d.y -= 6;
  if (q.notes) { d.heading('Notes'); d.text(q.notes, { size: 10, lh: 14.5, gap: 14 }); }
  if (settings.footer) d.note(settings.footer);
  d.note('Production follows the approved sample. Colours shown on screen or in concept previews are not binding.');
  return d.save();
}

export async function invoicePdf(inv: Invoice, order: Order, company: { name: string; address: string; country: string }, o: Contact = {}) {
  const d = await Doc.create(`Invoice ${inv.number}`, { kind: 'Invoice', ref: inv.number, contact: o.contact, watermark: true });
  d.newPage();
  d.title('Invoice', inv.number);
  d.facts([
    [{ label: 'Billed to', value: [company.name, company.address, countryName(company.country)].filter((s) => s?.trim()).join('\n') || '-', strong: true }],
    [{ label: 'Issued', value: day(inv.issuedAt) }, { label: 'Order', value: order.number }],
    [{ label: 'Status', value: cap(inv.status) }],
  ], [210, 140, CW - 350]);
  d.y -= 18;

  // the amount, the one thing an invoice is opened for
  const label = inv.status === 'paid' ? 'Amount paid' : inv.status === 'void' ? 'Amount (void)' : 'Amount due';
  const h = 96;
  d.page.drawRectangle({ x: M, y: d.y - h, width: CW, height: h, color: INK });
  d.label(label, M + 22, d.y - 22, { color: INV_MUTED });
  d.write(money(Number(inv.amount), inv.currency), M + 22, d.y - 40, { size: 34, display: true, color: LIME });
  d.label(inv.status === 'issued' ? 'Due' : 'Status', A4.w - M - 22, d.y - 22, { color: INV_MUTED, right: true });
  d.write(inv.status === 'issued' ? (inv.dueAt ? day(inv.dueAt) : 'On receipt') : cap(inv.status), M, d.y - 42, { size: 12, bold: true, color: WHITE, width: CW - 22, right: true });
  d.y -= h + 34;

  if (inv.notes) { d.heading('Notes'); d.text(inv.notes, { size: 10, lh: 14.5, gap: 20 }); }
  d.note('Bank details are sent separately by the sales team. Never pay to account details received from an unknown address.');
  return d.save();
}

export async function cataloguePdf(families: { name: string; summary: string; products: Product[] }[], o: Contact = {}) {
  const d = await Doc.create('Product catalogue', { kind: 'Product catalogue', contact: o.contact });

  // cover: the brand on ink, one product big, the contents with page numbers (filled in at the end)
  d.coverPage();
  const cover = d.page;
  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  d.write(month, M, A4.h - 41.5, { size: 9, color: INV_MUTED, right: true });
  const hero = families.flatMap((f) => f.products).find((p) => p.images[0]?.url)?.images[0]?.url;
  await d.picture(hero, M, A4.h - 80, CW);
  let y = A4.h - 80 - CW - 30;
  y -= d.write('Product catalogue', M, y, { size: 44, display: true, color: WHITE }) + 14;
  d.write('Sports equipment made in Pakistan for your brand. Every product is made to the specification, colours, branding and packaging confirmed in your quotation.', M, y, { size: 10, color: INV_MUTED, lh: 14 });
  const contentsTop = y - 46;

  const starts: number[] = [];
  for (const [fi, f] of families.entries()) {
    d.newPage();
    starts.push(d.pdf.getPageCount());
    d.y -= d.label(String(fi + 1).padStart(2, '0'), M, d.y) + 8;
    d.y -= d.write(f.name, M, d.y, { size: 30, display: true, lh: 32 }) + 10;
    d.y -= d.write(f.summary, M, d.y, { size: 10, color: MUTED, width: 400, lh: 14 }) + 26;

    // three cards a row: picture, name, SKU, summary
    const gap = 14, cw = (CW - gap * 2) / 3, cardH = cw + 104;
    for (let i = 0; i < f.products.length; i += 3) {
      if (d.ensure(cardH)) {
        d.y -= d.write(`${f.name}, continued`, M, d.y, { size: 13, bold: true }) + 20;
      }
      const top = d.y;
      for (const [j, p] of f.products.slice(i, i + 3).entries()) {
        const x = M + j * (cw + gap);
        await d.picture(p.images[0]?.url, x, top, cw);
        let cy = top - cw - 12;
        cy -= d.write(p.name, x, cy, { size: 10.5, bold: true, width: cw, lh: 13, max: 2 }) + 6;
        cy -= d.label(p.sku, x, cy) + 7;
        d.write(p.summary, x, cy, { size: 8.5, width: cw, lh: 11.5, max: 4 });
      }
      d.y = top - cardH - 18;
    }
  }

  // contents on the cover, now that every family's first page is known
  const keep = d.page;
  d.page = cover;
  d.label('Contents', M, contentsTop, { color: LIME });
  const perCol = Math.ceil(families.length / 2), rowH = Math.min(17, 86 / Math.max(perCol, 1)), colW = (CW - 28) / 2;
  families.forEach((f, i) => {
    const x = M + Math.floor(i / perCol) * (colW + 28), ry = contentsTop - 18 - (i % perCol) * rowH;
    d.write(String(i + 1).padStart(2, '0'), x, ry, { size: 8.5, bold: true, color: LIME });
    d.write(f.name, x + 22, ry, { size: 9.5, color: WHITE, width: colW - 60, max: 1 });
    d.write(String(starts[i]), x, ry, { size: 9.5, color: INV_MUTED, width: colW, right: true });
  });
  d.page = keep;
  return d.save();
}
