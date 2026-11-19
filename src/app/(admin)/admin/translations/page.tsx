import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config';
import { sourceStrings } from '@/lib/i18n/dictionaries';
import { getSettings } from '@/lib/data';
import { Flash, type SP } from '../ui';
import { saveTranslations } from '../actions';

/* Interface translations. The drafts shipped with the site are machine-assisted: a native speaker
   reviews each string here; reviewed strings override the drafts. A language becomes indexable in
   search (hreflang, sitemap) only when Settings marks it so. */
export default async function Translations({ searchParams }: { searchParams: SP }) {
  await requireStaff('translations.write');
  const sp = await searchParams;
  const locale = (LOCALES.includes(sp.locale as Locale) && sp.locale !== 'en' ? sp.locale : 'de') as Locale;
  const db = await getDb();
  const [rows, settings] = await Promise.all([db.select().from(s.translations).where(and(eq(s.translations.locale, locale))), getSettings()]);
  const reviewed = new Map(rows.filter((r) => r.status === 'reviewed').map((r) => [r.key, r.value]));
  const strings = sourceStrings();
  return (
    <>
      <div className="admin-head"><h1>Translations</h1></div>
      <Flash sp={sp} />
      <nav className="btn-row" aria-label="Language">{LOCALES.filter((l) => l !== 'en').map((l) => <a key={l} className={`btn ${l === locale ? 'btn--primary' : 'btn--secondary'}`} href={`/admin/translations?locale=${l}`}>{LOCALE_NAMES[l]}</a>)}</nav>
      <p className="t-small">{reviewed.size} of {strings.length} interface strings reviewed in {LOCALE_NAMES[locale]}. {settings.locales.indexed.includes(locale) ? 'This language is indexed in search.' : 'This language is not indexed in search yet (Settings).'} Page and product text stays English until translated versions are reviewed.</p>
      <form action={saveTranslations} className="panel-box">
        <input type="hidden" name="locale" value={locale} />
        <div className="table-wrap"><table className="data"><thead><tr><th>English</th><th>{LOCALE_NAMES[locale]}</th><th>Reviewed</th></tr></thead><tbody>
          {strings.map((st) => (
            <tr key={st.key}><td><label htmlFor={`t_${st.key}`}>{st.en}</label></td>
              <td><input id={`t_${st.key}`} name={`t_${st.key}`} defaultValue={reviewed.get(st.key) ?? st.drafts[locale]} lang={locale} /></td>
              <td><input type="checkbox" name={`r_${st.key}`} defaultChecked={reviewed.has(st.key)} aria-label={`Mark “${st.en}” reviewed`} /></td></tr>
          ))}
        </tbody></table></div>
        <div><button className="btn btn--primary" type="submit">Save the ticked strings as reviewed</button></div>
      </form>
    </>
  );
}
