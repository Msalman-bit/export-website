import { requireStaff } from '@/lib/auth/session';
import { getSettings } from '@/lib/data';
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config';
import { Flash, type SP } from '../ui';
import { saveSettings } from '../actions';

export default async function Settings({ searchParams }: { searchParams: SP }) {
  await requireStaff('settings.write');
  const sp = await searchParams;
  const st = await getSettings();
  return (
    <>
      <div className="admin-head"><h1>Settings</h1></div>
      <Flash sp={sp} />
      <form action={saveSettings} className="block">
        <section className="panel-box"><h2>Company</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="name">Company name</label><input id="name" name="name" defaultValue={st.company.name} /></div>
            <div className="field"><label htmlFor="salesEmail">Sales email (shown as “Email us”)</label><input id="salesEmail" name="salesEmail" type="email" defaultValue={st.company.salesEmail} /></div>
            <div className="field field--full"><label htmlFor="replyNote">Reply-time promise (leave empty unless you can keep it)</label><input id="replyNote" name="replyNote" defaultValue={st.company.replyNote} /></div>
          </div>
        </section>
        <section className="panel-box"><h2>Quotations</h2>
          <fieldset className="filters-row" style={{ border: 0, padding: 0 }}><legend>Currencies offered</legend>
            {['EUR', 'GBP', 'USD'].map((c) => <label key={c} className="chk"><input type="checkbox" name={`cur_${c}`} defaultChecked={st.currencies.enabled.includes(c)} /> {c}</label>)}</fieldset>
          <div className="form-grid">
            <div className="field"><label htmlFor="defaultCurrency">Default currency</label><select id="defaultCurrency" name="defaultCurrency" defaultValue={st.currencies.default}><option>EUR</option><option>GBP</option><option>USD</option></select></div>
            <div className="field"><label htmlFor="validityDays">Quotations valid for (days)</label><input id="validityDays" name="validityDays" inputMode="numeric" defaultValue={st.quotation.validityDays} /></div>
            <div className="field"><label htmlFor="paymentTerms">Default payment terms</label><input id="paymentTerms" name="paymentTerms" defaultValue={st.quotation.paymentTerms} /></div>
            <div className="field"><label htmlFor="incoterm">Default delivery terms (Incoterm)</label><input id="incoterm" name="incoterm" defaultValue={st.quotation.incoterm} /></div>
            <div className="field field--full"><label htmlFor="footer">Small print on every quotation</label><textarea id="footer" name="footer" defaultValue={st.quotation.footer} /></div>
          </div>
        </section>
        <section className="panel-box"><h2>Languages</h2>
          <p className="t-small">Enabled: the language appears in the selector. Indexed: search engines may list it (hreflang and sitemap). Index a language only after its texts are reviewed.</p>
          <table className="data"><thead><tr><th>Language</th><th>Enabled</th><th>Indexed</th></tr></thead><tbody>
            {LOCALES.map((l) => <tr key={l}><td>{LOCALE_NAMES[l]}</td>
              <td>{l === 'en' ? 'Always' : <input type="checkbox" name={`loc_${l}`} defaultChecked={st.locales.enabled.includes(l)} aria-label={`${LOCALE_NAMES[l]} enabled`} />}</td>
              <td>{l === 'en' ? 'Always' : <input type="checkbox" name={`idx_${l}`} defaultChecked={st.locales.indexed.includes(l)} aria-label={`${LOCALE_NAMES[l]} indexed`} />}</td></tr>)}
          </tbody></table>
        </section>
        <section className="panel-box"><h2>Analytics</h2>
          <div className="field"><label htmlFor="ga4">Google Analytics 4 measurement ID (loads only after a visitor accepts analytics)</label><input id="ga4" name="ga4" defaultValue={st.analytics.ga4} placeholder="" /></div>
          <p className="t-small">Search Console: set GOOGLE_SITE_VERIFICATION in the environment, then submit /sitemap.xml.</p>
        </section>
        <div><button className="btn btn--primary" type="submit">Save settings</button></div>
      </form>
    </>
  );
}
