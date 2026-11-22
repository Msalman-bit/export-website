import { z } from 'zod';
import { COUNTRIES } from './countries';

/* Server-side validation for every inquiry (quote, sample, distributor, partnership, contact).
   The browser checks the same fields for comfort; this is the check that counts. */

const text = (max: number) => z.string().trim().max(max).default('');
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export const itemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  quantity: z.coerce.number().int().min(1, 'Enter a quantity of 1 or more.').max(1_000_000),
  notes: text(500),
  sample: z.boolean().optional(),
  customisation: z.record(z.string(), z.unknown()).nullable().optional()
    .refine((v) => !v || JSON.stringify(v).length < 6000, 'Customisation is too large.'),
});

export const inquirySchema = z.object({
  type: z.enum(['quote', 'sample', 'distributor', 'partnership', 'contact']).default('quote'),
  companyName: z.string().trim().min(2, 'Enter your company name.').max(120),
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a business email address, for example name@club.com.').max(160),
  phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, 'Use digits, spaces and + only.').default(''),
  country: z.string().trim().refine((c) => COUNTRY_CODES.has(c), 'Select the destination country.'),
  currency: z.enum(['EUR', 'GBP', 'USD']).default('EUR'),
  branding: text(2000),
  packaging: text(2000),
  targetDate: z.string().trim().max(40).regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use the date picker or leave it empty.').default(''),
  shippingMethod: z.enum(['', 'sea', 'air', 'courier', 'undecided']).default(''),
  message: text(5000),
  items: z.array(itemSchema).max(50, 'Send at most 50 products in one inquiry.').default([]),
  locale: z.string().max(5).default('en'),
  sourcePage: z.string().max(200).default(''),
}).superRefine((v, ctx) => {
  if ((v.type === 'quote' || v.type === 'sample') && v.items.length === 0 && v.message.length < 10) {
    ctx.addIssue({ code: 'custom', path: ['message'], message: 'Add products to your list, or describe your requirements in one or two sentences.' });
  }
  if ((v.type === 'contact' || v.type === 'distributor' || v.type === 'partnership') && v.message.length < 10) {
    ctx.addIssue({ code: 'custom', path: ['message'], message: 'Describe your request in one or two sentences.' });
  }
});

export type InquiryInput = z.infer<typeof inquirySchema>;

/** zod issues as { field: message } for the form's error lines. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
