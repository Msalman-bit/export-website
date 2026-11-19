import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { inquiryReference, documentNumber, REFERENCE_PATTERN } from '@/lib/inquiry/reference';
import { inquirySchema, fieldErrors } from '@/lib/inquiry/validation';
import { swapLocale, negotiate, isLocale } from '@/lib/i18n/config';
import { dictionary, sourceStrings } from '@/lib/i18n/dictionaries';
import { RichText } from '@/components/site/RichText';
import { allowedNext } from '@/lib/status';
import { inquiryConfirmation } from '@/lib/email/templates';
import { safe } from '@/lib/pdf/pdf';

const valid = {
  type: 'quote', companyName: 'Harbour FC', contactName: 'Sam Doyle', email: 'Sam@HarbourFC.example', country: 'IE', currency: 'EUR',
  items: [{ productId: '7f0c7d0e-3c0a-4a8e-9a43-0f3a6f3c2b11', quantity: 250, notes: 'Club crest on two panels' }],
};

describe('inquiry references', () => {
  it('uses the readable format and never the confusing letters', () => {
    for (let i = 0; i < 200; i++) {
      const r = inquiryReference(new Date('2026-11-18T10:00:00Z'));
      expect(r).toMatch(REFERENCE_PATTERN);
      expect(r.startsWith('MS-261118-')).toBe(true);
      expect(r.slice(10)).not.toMatch(/[ILOU]/);
    }
  });
  it('numbers documents per year', () => {
    expect(documentNumber('Q', 42, new Date('2026-03-01'))).toBe('Q-2026-0042');
    expect(documentNumber('INV', 7, new Date('2027-01-01'))).toBe('INV-2027-0007');
  });
});

describe('inquiry validation', () => {
  it('accepts a complete quote and normalises the email', () => {
    const r = inquirySchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('sam@harbourfc.example');
  });
  it('names each missing field in words', () => {
    const r = inquirySchema.safeParse({ ...valid, companyName: '', email: 'not-an-email', country: 'XX' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(e.companyName).toMatch(/company/i);
      expect(e.email).toMatch(/@/);
      expect(e.country).toMatch(/country/i);
    }
  });
  it('needs products or a description for a quote, and a message for contact', () => {
    expect(inquirySchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, items: [], message: 'Two hundred size 4 training balls in club colours.' }).success).toBe(true);
    expect(inquirySchema.safeParse({ ...valid, type: 'contact', items: [], message: '' }).success).toBe(false);
  });
  it('refuses absurd quantities, too many lines and oversized designs', () => {
    expect(inquirySchema.safeParse({ ...valid, items: [{ quantity: 0 }] }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, items: Array.from({ length: 51 }, () => ({ quantity: 1 })) }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, items: [{ quantity: 1, customisation: { x: 'y'.repeat(7000) } }] }).success).toBe(false);
  });
});

describe('internationalisation', () => {
  it('swaps the language in a path', () => {
    expect(swapLocale('/de/products/football', 'fr')).toBe('/fr/products/football');
    expect(swapLocale('/en', 'nl')).toBe('/nl');
  });
  it('negotiates from Accept-Language', () => {
    expect(negotiate('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
    expect(negotiate('pt-BR,pt;q=0.9')).toBe('en');
    expect(isLocale('it')).toBe(true);
    expect(isLocale('pt')).toBe(false);
  });
  it('has every interface string in all six languages, with reviewed overrides winning', () => {
    for (const s of sourceStrings()) for (const l of ['en', 'de', 'fr', 'es', 'it', 'nl'] as const) expect(s.drafts[l]?.length).toBeGreaterThan(0);
    expect(dictionary('de', { 'cta.quote': 'Angebot anfordern' })['cta.quote']).toBe('Angebot anfordern');
  });
});

describe('rich text from the CMS', () => {
  const html = (body: string) => renderToStaticMarkup(RichText({ body, locale: 'de' }));
  it('renders headings, lists, links and one button with the locale', () => {
    const out = html('## Title\n\nSome text with a [link](/faq).\n\n- one\n- two\n\n[[cta:Request a quote|/inquiry]]');
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('href="/de/faq"');
    expect(out).toContain('<li>one</li>');
    expect(out).toContain('class="btn btn--primary" href="/de/inquiry"');
  });
  it('never lets page text inject markup or scripts', () => {
    const out = html('<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('href="javascript:');
    expect(out).not.toContain('<img');
  });
});

describe('workflow, emails and documents', () => {
  it('moves an inquiry forward or one step back', () => {
    expect(allowedNext('new')).toContain('under_review');
    expect(allowedNext('quotation_sent')).toContain('quotation_prepared');
    expect(allowedNext('quotation_sent')).not.toContain('new');
  });
  it('escapes customer input in emails', () => {
    const m = inquiryConfirmation({ reference: 'MS-261118-ABCDE', contactName: '<b>Sam</b>', items: [{ name: 'Match football', sku: 'MS-FB-MAT-001', quantity: 500 }], type: 'quote', locale: 'en' });
    expect(m.html).not.toContain('<b>Sam</b>');
    expect(m.html).toContain('&lt;b&gt;Sam&lt;/b&gt;');
    expect(m.text).toContain('MS-261118-ABCDE');
  });
  it('makes text safe for PDF fonts', () => {
    expect(safe('Łódź “quoted” – €12')).toBe('Lodz "quoted" – €12');
  });
});
