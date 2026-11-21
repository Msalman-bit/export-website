import {
  PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing, rectangle, clip, endPath,
  type PDFFont, type PDFPage, type PDFImage, type RGB,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';

/* Branded A4 documents in the website's look: white pages with a slim header (the dots mark and the
   name), ink #080808 text, the lime #c5f900 accent on totals and the catalogue cover, hairline tables,
   a faded mark in the corner of text pages, and "Page x of y" footers. Used for datasheets,
   quotations, invoices and the catalogue (documents.ts).
   Type: Archivo, the website's face, from public/site/fonts (static cuts of Google's variable font,
   SIL Open Font License in OFL.txt there): Regular, SemiBold, and a condensed Medium for titles like the
   site's condensed headings. If the files cannot be read, the built-in Helvetica takes over. */

export const INK = rgb(0.031, 0.031, 0.031);
export const MUTED = rgb(0.416, 0.416, 0.416);
export const LINE = rgb(0.86, 0.87, 0.88);
export const SURFACE = rgb(0.933, 0.941, 0.949);
export const LIME = rgb(0.773, 0.976, 0);
export const WHITE = rgb(1, 1, 1);
export const INV_MUTED = rgb(0.584, 0.584, 0.584);
export const A4 = { w: 595.28, h: 841.89 };
export const M = 48;
export const CW = A4.w - M * 2;
const TOP = A4.h - 102;
const BOTTOM = 64;

/** The site's "dots" mark (system.css, data-mark="dots") on a 24-unit grid. */
const MARK = 'M2 6.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM13 6.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM2 17.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM14.5 13h6a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5z';

/** WinAnsi-safe text: the standard fonts cannot draw every Unicode letter. */
export function safe(text: string): string {
  return String(text ?? '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
    .replace(/[ŁłØøĐđŒœıĦħŦŧ]/g, (c) => ({ Ł: 'L', ł: 'l', Ø: 'O', ø: 'o', Đ: 'D', đ: 'd', Œ: 'OE', œ: 'oe', ı: 'i', Ħ: 'H', ħ: 'h', Ŧ: 'T', ŧ: 't' })[c] ?? c)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E -ÿ€–—·×]/g, '');
}

/** "2026-11-21" (or a Date) as "21 November 2026"; any other text is returned as it is. */
export function day(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = v instanceof Date ? v : /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T12:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

type TextOpts = { size?: number; bold?: boolean; display?: boolean; color?: RGB; width?: number; lh?: number; max?: number; right?: boolean };
export type Fact = { label: string; value: string; strong?: boolean };
export type Col = { head: string; width: number; right?: boolean };
type DocOpts = { kind: string; ref?: string; contact?: string; watermark?: boolean };

export class Doc {
  pdf!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; display!: PDFFont;
  y = 0; o!: DocOpts; covers = new Set<number>();

  static async create(title: string, o: DocOpts) {
    const d = new Doc();
    d.o = o;
    d.pdf = await PDFDocument.create();
    d.pdf.setTitle(safe(title)); d.pdf.setAuthor('Monolith Sports'); d.pdf.setCreator('Monolith Sports website');
    const files = await fontFiles();
    if (files) {
      try {
        d.pdf.registerFontkit(fontkit);
        [d.font, d.bold, d.display] = await Promise.all(files.map((f) => d.pdf.embedFont(f, { subset: true })));
      } catch { d.font = undefined as unknown as PDFFont; }
    }
    if (!d.font) {
      d.font = await d.pdf.embedFont(StandardFonts.Helvetica);
      d.bold = d.display = await d.pdf.embedFont(StandardFonts.HelveticaBold);
    }
    return d;
  }

  private face(o: { bold?: boolean; display?: boolean }) { return o.display ? this.display : o.bold ? this.bold : this.font; }

  /* ---------- pages ---------- */

  /** A white page with the header; text pages carry the faded mark in the lower right corner. */
  newPage() {
    this.page = this.pdf.addPage([A4.w, A4.h]);
    if (this.o.watermark) this.mark(A4.w - 292, 318, 392, INK, 0.04);
    this.brand(INK);
    const ref = safe(this.o.ref ?? ''), kind = safe(this.o.kind);
    const rw = this.bold.widthOfTextAtSize(ref, 8.5);
    const kw = this.font.widthOfTextAtSize(kind, 8.5) + (ref ? 6 : 0);
    this.page.drawText(kind, { x: A4.w - M - rw - kw, y: A4.h - 49.5, size: 8.5, font: this.font, color: MUTED });
    if (ref) this.page.drawText(ref, { x: A4.w - M - rw, y: A4.h - 49.5, size: 8.5, font: this.bold, color: INK });
    this.page.drawLine({ start: { x: M, y: A4.h - 68 }, end: { x: A4.w - M, y: A4.h - 68 }, thickness: 0.6, color: LINE });
    this.y = TOP;
  }

  /** A full-bleed ink page without header or footer (the catalogue cover). */
  coverPage() {
    this.page = this.pdf.addPage([A4.w, A4.h]);
    this.covers.add(this.pdf.getPageCount() - 1);
    this.page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: INK });
    this.brand(WHITE);
    this.y = A4.h - 80;
  }

  private brand(color: RGB) {
    this.mark(M, A4.h - 38, 15, color);
    this.page.drawText('Monolith Sports', { x: M + 22, y: A4.h - 50, size: 11.5, font: this.bold, color });
  }

  /** Draws the dots mark with its top left corner at (x, yTop). */
  mark(x: number, yTop: number, size: number, color: RGB, opacity = 1) {
    this.page.drawSvgPath(MARK, { x, y: yTop, scale: size / 24, color, opacity, borderWidth: 0 });
  }

  /** Starts a new page when less than `space` points are left above the footer. */
  ensure(space: number) { if (this.y - space < BOTTOM) { this.newPage(); return true; } return false; }

  /* ---------- text ---------- */

  /** Wraps text to a width; a word longer than the width is broken. */
  lines(t: string, size: number, width: number, font = this.font): string[] {
    const out: string[] = [];
    for (const para of String(t ?? '').split(/\r?\n/)) {
      let line = '';
      for (let w of safe(para).split(' ')) {
        while (w && font.widthOfTextAtSize(w, size) > width) {
          let i = w.length - 1;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        const test = line ? `${line} ${w}` : w;
        if (line && font.widthOfTextAtSize(test, size) > width) { out.push(line); line = w; } else line = test;
      }
      out.push(line);
    }
    return out;
  }

  /** Draws a text block whose first line's top sits at yTop; returns the block's height. */
  write(t: string, x: number, yTop: number, o: TextOpts = {}) {
    const size = o.size ?? 9.5, font = this.face(o), width = o.width ?? CW, lh = o.lh ?? size * 1.4;
    let ls = this.lines(t, size, width, font);
    if (o.max && ls.length > o.max) {
      ls = ls.slice(0, o.max);
      let last = ls[o.max - 1];
      while (last && font.widthOfTextAtSize(`${last}...`, size) > width) last = last.slice(0, -1);
      ls[o.max - 1] = `${last.replace(/[\s,.;:]+$/, '')}...`;
    }
    const track = o.display ? -0.015 * size : 0;
    if (track) this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(track));
    ls.forEach((l, i) => {
      const lx = o.right ? x + width - font.widthOfTextAtSize(l, size) - track * (l.length - 1) : x;
      this.page.drawText(l, { x: lx, y: yTop - size * 0.8 - i * lh, size, font, color: o.color ?? INK });
    });
    if (track) this.page.pushOperators(popGraphicsState());
    return (ls.length - 1) * lh + size * 1.05;
  }

  /** Height a text block would take. */
  measure(t: string, o: TextOpts = {}) {
    const size = o.size ?? 9.5, lh = o.lh ?? size * 1.4;
    const n = Math.min(this.lines(t, size, o.width ?? CW, this.face(o)).length, o.max ?? Infinity);
    return (n - 1) * lh + size * 1.05;
  }

  /** Flowing text at the cursor; breaks across pages line by line. */
  text(t: string, o: TextOpts & { gap?: number; x?: number } = {}) {
    const size = o.size ?? 9.5, font = this.face(o), width = o.width ?? CW, lh = o.lh ?? size * 1.4;
    for (const l of this.lines(t, size, width, font)) {
      if (this.y - lh < BOTTOM) this.newPage();
      this.page.drawText(l, { x: o.x ?? M, y: this.y - size * 0.8, size, font, color: o.color ?? INK });
      this.y -= lh;
    }
    this.y -= size * 1.05 - lh + (o.gap ?? 6);
  }

  /** Small spaced capitals: the labels above values and table columns. */
  label(t: string, x: number, yTop: number, o: { color?: RGB; right?: boolean; size?: number } = {}) {
    const s = safe(t).toUpperCase(), size = o.size ?? 6.8, sp = 0.7;
    const w = this.bold.widthOfTextAtSize(s, size) + sp * (s.length - 1);
    this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(sp));
    this.page.drawText(s, { x: o.right ? x - w : x, y: yTop - size * 0.8, size, font: this.bold, color: o.color ?? MUTED });
    this.page.pushOperators(popGraphicsState());
    return size * 1.05;
  }

  /** A document title: a large name with an optional muted line under it. */
  title(t: string, sub?: string) {
    this.y -= this.write(t, M, this.y, { size: 36, display: true, lh: 38 });
    if (sub) { this.y -= 8; this.y -= this.write(sub, M, this.y, { size: 11, color: MUTED }); }
    this.y -= 22;
  }

  heading(t: string, size = 13) {
    this.ensure(size + 46);
    this.y -= 6;
    this.y -= this.write(t, M, this.y, { size, bold: true });
    this.y -= 12;
  }

  /** Muted fine print. */
  note(t: string) { this.text(t, { size: 7.5, color: MUTED, lh: 10.5, gap: 4 }); }

  /* ---------- blocks ---------- */

  /** Columns of label/value pairs side by side (who it is for, dates, references). */
  facts(columns: Fact[][], widths: number[], gap = 18) {
    const LH = 13.5, SIZE = 9.5;
    /* a value's lines; with `strong` its first line (a company name) is bold */
    const valueLines = (f: Fact, w: number) => {
      const [first, ...rest] = String(f.value || '-').split('\n');
      return [
        ...this.lines(first, SIZE, w, f.strong ? this.bold : this.font).map((t) => ({ t, bold: !!f.strong })),
        ...(rest.length ? this.lines(rest.join('\n'), SIZE, w).map((t) => ({ t, bold: false })) : []),
      ];
    };
    const blockH = (f: Fact, w: number) => 6.8 * 1.05 + 5 + (valueLines(f, w).length - 1) * LH + SIZE * 1.05 + 14;
    const h = Math.max(...columns.map((c, i) => c.reduce((s, f) => s + blockH(f, widths[i] - gap), 0))) - 14;
    this.ensure(h);
    let x = M;
    columns.forEach((col, i) => {
      let y = this.y;
      const w = widths[i] - gap;
      for (const f of col) {
        y -= this.label(f.label, x, y) + 5;
        const ls = valueLines(f, w);
        ls.forEach((l, n) => this.page.drawText(l.t, { x, y: y - SIZE * 0.8 - n * LH, size: SIZE, font: l.bold ? this.bold : this.font, color: INK }));
        y -= (ls.length - 1) * LH + SIZE * 1.05 + 14;
      }
      x += widths[i];
    });
    this.y -= h;
  }

  /** Label/value rows with hairlines (specifications, terms). */
  rows(rows: [string, string][], labelWidth = 150) {
    for (const [k, v] of rows) {
      const vw = CW - labelWidth;
      const h = Math.max(this.measure(k, { size: 9, width: labelWidth - 14, lh: 12.5 }), this.measure(v, { size: 9.5, width: vw, lh: 13.5 })) + 16;
      this.ensure(h);
      this.write(k, M, this.y - 8, { size: 9, color: MUTED, width: labelWidth - 14, lh: 12.5 });
      this.write(v, M + labelWidth, this.y - 8, { size: 9.5, width: vw, lh: 13.5 });
      this.y -= h;
      this.hair();
    }
    this.y -= 18;
  }

  hair(x = M, w = CW) { this.page.drawLine({ start: { x, y: this.y }, end: { x: x + w, y: this.y }, thickness: 0.6, color: LINE }); }

  /** A table with a grey heading band that repeats on every page it runs onto. Each cell may carry a
      muted second line (`sub`, used for the SKU under a product name). */
  table(cols: Col[], body: { cells: string[]; sub?: string[] }[]) {
    const pad = 8;
    const head = () => {
      this.page.drawRectangle({ x: M, y: this.y - 22, width: CW, height: 22, color: SURFACE });
      let x = M;
      for (const c of cols) { this.label(c.head, c.right ? x + c.width - pad : x + pad, this.y - 8, { right: c.right }); x += c.width; }
      this.y -= 22;
    };
    this.ensure(22 + 40);
    head();
    for (const r of body) {
      const h = Math.max(...cols.map((c, i) => {
        const w = c.width - pad * 2;
        const a = this.measure(r.cells[i] ?? '', { size: 9.5, width: w, lh: 13 });
        return r.sub?.[i] ? a + 4 + this.measure(r.sub[i], { size: 7.5, width: w, lh: 10 }) : a;
      })) + pad * 2 + 2;
      if (this.y - h < BOTTOM) { this.newPage(); head(); }
      let x = M;
      cols.forEach((c, i) => {
        const w = c.width - pad * 2;
        const top = this.y - pad - 1;
        const used = this.write(r.cells[i] ?? '', x + pad, top, { size: 9.5, width: w, lh: 13, right: c.right });
        if (r.sub?.[i]) this.write(r.sub[i], x + pad, top - used - 4, { size: 7.5, width: w, lh: 10, color: MUTED, right: c.right });
        x += c.width;
      });
      this.y -= h;
      this.hair();
    }
  }

  /** Subtotal rows and the lime total bar, right-aligned under a table's last column. */
  totals(rows: [string, string][], total: [string, string], width = 250) {
    this.ensure(rows.length * 26 + 40);
    const x = M + CW - width;
    for (const [k, v] of rows) {
      this.write(k, x + 8, this.y - 9, { size: 9, color: MUTED });
      this.write(v, x + 8, this.y - 9, { size: 9.5, width: width - 16, right: true });
      this.y -= 26;
      this.hair(x, width);
    }
    this.y -= 6;
    this.page.drawRectangle({ x, y: this.y - 34, width, height: 34, color: LIME });
    this.write(total[0], x + 10, this.y - 12.5, { size: 10, bold: true });
    this.write(total[1], x + 10, this.y - 10.5, { size: 13.5, bold: true, width: width - 20, right: true });
    this.y -= 34 + 24;
  }

  /** A square picture, cropped to fill its frame (or a grey tile with the faded mark when there is none). */
  async picture(url: string | undefined | null, x: number, yTop: number, size: number) {
    const im = await loadImage(this.pdf, url);
    if (im) {
      const s = Math.max(size / im.width, size / im.height);
      const w = im.width * s, h = im.height * s;
      this.page.pushOperators(pushGraphicsState(), rectangle(x, yTop - size, size, size), clip(), endPath());
      this.page.drawImage(im, { x: x + (size - w) / 2, y: yTop - size + (size - h) / 2, width: w, height: h });
      this.page.pushOperators(popGraphicsState());
      return true;
    }
    this.page.drawRectangle({ x, y: yTop - size, width: size, height: size, color: SURFACE });
    this.mark(x + size * 0.3, yTop - size * 0.3, size * 0.4, INK, 0.08);
    return false;
  }

  /** Footers go on last, once the page count is known. */
  async save() {
    const pages = this.pdf.getPages();
    const left = safe(['Monolith Sports', this.o.contact?.trim()].filter(Boolean).join('  ·  '));
    pages.forEach((p, i) => {
      if (this.covers.has(i)) return;
      p.drawLine({ start: { x: M, y: 44 }, end: { x: A4.w - M, y: 44 }, thickness: 0.6, color: LINE });
      p.drawText(left, { x: M, y: 29, size: 7.5, font: this.font, color: MUTED });
      const r = `Page ${i + 1} of ${pages.length}`;
      p.drawText(r, { x: A4.w - M - this.font.widthOfTextAtSize(r, 7.5), y: 29, size: 7.5, font: this.font, color: MUTED });
    });
    return Buffer.from(await this.pdf.save());
  }
}

/** Regular, SemiBold and condensed Medium, read once per server process; null when missing. */
let fontCache: Promise<Buffer[] | null> | undefined;
function fontFiles() {
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'site', 'fonts');
  return (fontCache ??= Promise.all(['Archivo-Regular.ttf', 'Archivo-SemiBold.ttf', 'Archivo-CondensedMedium.ttf'].map((f) => fs.readFile(path.join(dir, f))))
    .catch(() => null));
}

/** pdf-lib embeds JPEG and PNG only; process-media.py writes a 600px JPEG of each product concept for documents. */
async function loadImage(pdf: PDFDocument, url: string | undefined | null): Promise<PDFImage | null> {
  if (!url?.startsWith('gen:')) return null;
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'assets', 'img', 'gen', `${url.slice(4)}-pdf.jpg`);
  try { return await pdf.embedJpg(await fs.readFile(file)); } catch { return null; }
}

export const money = (n: number, currency: string) => {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
