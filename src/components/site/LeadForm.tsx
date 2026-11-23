import { InquiryForm } from './InquiryForm';
import { getDict, formText, formCountries } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';
import type { Tx } from '@/lib/i18n/tx';

/* The contact, distributor and partnership forms: the inquiry form without the product list. With tx (a page shown in
   another language) its words are in that language; without, English. */
export async function LeadForm({ locale, type, tx }: { locale: Locale; type: 'contact' | 'distributor' | 'partnership'; tx?: Tx }) {
  const title = type === 'contact' ? 'Contact the sales team' : type === 'distributor' ? 'Distributor application' : 'Partnership inquiry';
  const text = tx ? formText(await getDict(locale), tx) : undefined;
  return (
    <div className="block">
      <h2>{tx ? tx(title) : title}</h2>
      <InquiryForm locale={locale} mode={type} currencies={['EUR', 'GBP', 'USD']} turnstileKey={process.env.TURNSTILE_SITE_KEY || undefined}
        text={text} countries={tx ? formCountries(tx) : undefined} />
    </div>
  );
}
