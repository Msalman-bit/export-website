import { InquiryForm } from './InquiryForm';

/* The contact, distributor and partnership forms: the inquiry form without the product list. */
export function LeadForm({ locale, type }: { locale: string; type: 'contact' | 'distributor' | 'partnership' }) {
  return (
    <div className="block">
      <h2>{type === 'contact' ? 'Contact the sales team' : type === 'distributor' ? 'Distributor application' : 'Partnership inquiry'}</h2>
      <InquiryForm locale={locale} mode={type} currencies={['EUR', 'GBP', 'USD']} turnstileKey={process.env.TURNSTILE_SITE_KEY || undefined} />
    </div>
  );
}
