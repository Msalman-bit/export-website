import { InquiryForm } from './InquiryForm';

/* The contact, distributor and partnership forms: the inquiry form without the product list. */
export function LeadForm({ locale, type }: { locale: string; type: 'contact' | 'distributor' | 'partnership' }) {
  return (
    <div className="block">
      <h2>{type === 'contact' ? 'Write to the sales team' : type === 'distributor' ? 'Apply as a distributor' : 'Tell us about your business'}</h2>
      <InquiryForm locale={locale} mode={type} currencies={['EUR', 'GBP', 'USD']} turnstileKey={process.env.TURNSTILE_SITE_KEY || undefined} />
    </div>
  );
}
