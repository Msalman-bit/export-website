import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pic } from '../media';

/* Branded A4 documents: an obsidian band with the wordmark, a lime rule, Helvetica (built into every
   PDF reader), tables with hairlines. Used for datasheets, quotations, invoices and the catalogue. */

export const INK = rgb(0.031, 0.031, 0.031);
export const MUTED = rgb(0.36, 0.37, 0.39);
export const LINE = rgb(0.86, 0.87, 0.88);
export const LIME = rgb(0.77, 0.976, 0);
const A4: [number, number] = [595.28, 841.89];
const M = 48;

/** WinAnsi-safe text: the standard fonts cannot draw every Unicode letter. */
export function safe(text: string): string {
  return String(text ?? '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
    .replace(/[ŁłØøĐđŒœıĦħŦŧ]/g, (c) => ({ Ł: 'L', ł: 'l', Ø: 'O', ø: 'o', Đ: 'D', đ: 'd', Œ: 'OE', œ: 'oe', ı: 'i', Ħ: 'H', ħ: 'h', Ŧ: 'T', ŧ: 't' })[c] ?? c)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E -ÿ€–—·×]/g, '');
}

export class Doc {
  pdf!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; y = 0; title = ''; pageNo = 0;

  static async create(title: string) {
    const d = new Doc();
    d.pdf = await PDFDocument.create();
    d.pdf.setTitle(title); d.pdf.setAuthor('Monolith Sports'); d.pdf.setCreator('Monolith Sports website');
    d.font = await d.pdf.embedFont(StandardFonts.Helvetica);
    d.bold = await d.pdf.embedFont(StandardFonts.HelveticaBold);
    d.title = title;
    d.newPage();
    return d;
  }

  newPage() {
    this.page = this.pdf.addPage(A4);
    this.pageNo++;
    const [w, h] = A4;
    this.page.drawRectangle({ x: 0, y: h - 64, width: w, height: 64, color: INK });
    this.page.drawRectangle({ x: 0, y: h - 67, width: w, height: 3, color: LIME });
    this.page.drawText('Monolith Sports', { x: M, y: h - 40, size: 16, font: this.bold, color: rgb(1, 1, 1) });
    this.page.drawText(safe(this.title), { x: w - M - this.font.widthOfTextAtSize(safe(this.title), 9), y: h - 38, size: 9, font: this.font, color: rgb(0.8, 0.8, 0.8) });
    this.page.drawText(`Page ${this.pageNo}`, { x: w - M - 30, y: 28, size: 8, font: this.font, color: MUTED });
    this.y = h - 100;
  }

  ensure(space: number) { if (this.y - space < 60) this.newPage(); }

  text(t: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = o.size ?? 10, font = o.bold ? this.bold : this.font, x = o.x ?? M, width = o.width ?? A4[0] - M * 2;
    for (const para of safe(t).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > width && line) {
          this.ensure(size * 1.5); this.page.drawText(line, { x, y: this.y, size, font, color: o.color ?? INK }); this.y -= size * 1.45; line = w;
        } else line = test;
      }
      this.ensure(size * 1.5); this.page.drawText(line, { x, y: this.y, size, font, color: o.color ?? INK }); this.y -= size * 1.45;
    }
    this.y -= o.gap ?? 4;
  }

  heading(t: string, size = 18) { this.ensure(size * 2.4); this.y -= 6; this.text(t, { size, bold: true, gap: 8 }); }

  rule() { this.page.drawLine({ start: { x: M, y: this.y + 4 }, end: { x: A4[0] - M, y: this.y + 4 }, thickness: 0.6, color: LINE }); this.y -= 8; }

  /** label/value rows */
  rows(rows: [string, string][], labelWidth = 170) {
    for (const [k, v] of rows) {
      this.ensure(30);
      const top = this.y;
      this.text(k, { size: 9.5, color: MUTED, width: labelWidth - 10, gap: 0 });
      const after = this.y; this.y = top;
      this.text(v, { size: 9.5, x: M + labelWidth, width: A4[0] - M * 2 - labelWidth, gap: 0 });
      this.y = Math.min(this.y, after) - 4; this.rule();
    }
  }

  /** a table with given column widths; the last columns right-aligned when `right` is set */
  table(head: string[], body: string[][], widths: number[], right: number[] = []) {
    const draw = (cells: string[], bold: boolean) => {
      this.ensure(26);
      let x = M; const y = this.y;
      let lowest = y;
      cells.forEach((c, i) => {
        const w = widths[i];
        const t = safe(c);
        const f = bold ? this.bold : this.font;
        if (right.includes(i)) { this.page.drawText(t, { x: x + w - f.widthOfTextAtSize(t, 9.5) - 4, y, size: 9.5, font: f, color: bold ? MUTED : INK }); }
        else { this.y = y; this.text(t, { size: 9.5, x, width: w - 8, bold, color: bold ? MUTED : INK, gap: 0 }); lowest = Math.min(lowest, this.y + 13); }
        x += w;
      });
      this.y = Math.min(lowest, y) - 14; this.rule();
    };
    draw(head, true);
    body.forEach((r) => draw(r, false));
  }

  async image(url: string | undefined | null, w: number, h: number) {
    const im = await loadImage(this.pdf, url);
    if (!im) return false;
    this.ensure(h + 10);
    const scale = Math.min(w / im.width, h / im.height);
    this.page.drawImage(im, { x: M, y: this.y - im.height * scale, width: im.width * scale, height: im.height * scale });
    this.y -= im.height * scale + 16;
    return true;
  }

  async save() { return Buffer.from(await this.pdf.save()); }
}

/** pdf-lib embeds JPEG and PNG only; process-media.py writes a 600px JPEG of each product concept for documents. */
async function loadImage(pdf: PDFDocument, url: string | undefined | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    if (url.startsWith('gen:')) {
      const id = url.slice(4);
      const file = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'assets', 'img', 'gen', `${id}-pdf.jpg`);
      try { return await pdf.embedJpg(await fs.readFile(file)); } catch { return null; }
    }
    void pic;
    return null;
  } catch {
    return null;
  }
}

export const money = (n: number, currency: string) => {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
