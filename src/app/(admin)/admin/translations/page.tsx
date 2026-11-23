import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config';
import { sourceStrings } from '@/lib/i18n/dictionaries';
import { SECTIONS } from '@/lib/i18n/drafts';
import { textKey } from '@/lib/i18n/tx';
import { getSettings } from '@/lib/data';
import { Flash, type SP } from '../ui';
import { saveTranslations } from '../actions';

/* Translations. The drafts shipped with the site are machine-assisted: a native speaker reviews each text here, and a
   reviewed wording replaces the draft on the site. Two kinds, one screen:
   - Interface words (menus, buttons, form labels): dictionaries.ts, saved under their key ("cta.quote").
   - Page and product text (home page, catalogue, forms, About and Contact): src/lib/i18n/drafts, keyed by the English
     itself and saved under textKey(English). A text reworded in English later shows in English until it is translated
     again; the legal pages are not translated.
   A language becomes indexable in search (hreflang, sitemap) only when Settings marks it so. */
export default async function Translations({ searchParams }: { searchParams: SP }) {
  await requireStaff('translations.write');
  const sp = await searchParams;
  const locale = (LOCALES.includes(sp.locale as Locale) && sp.locale !== 'en' ? sp.locale : 'de') as Locale;
  const i = LOCALES.indexOf(locale) - 1; // the drafts hold [de, fr, es, it, nl]
  const section = SECTIONS.find((x) => x.id === sp.section) ?? null;
  const db = await getDb();
  const [rows, settings] = await Promise.all([db.select().from(s.translations).where(and(eq(s.translations.locale, locale))), getSettings()]);
  const reviewed = new Map(rows.filter((r) => r.status === 'reviewed').map((r) => [r.key, r.value]));
  const strings = sourceStrings();
  const count = (keys: string[]) => keys.filter((k) => reviewed.has(k)).length;
  const sectionKeys = (sec: (typeof SECTIONS)[number]) => Object.keys(sec.drafts).map(textKey);
  const tab = (id: string, name: string, done: number, total: number) => (
    <a key={id} className={`btn ${(section?.id ?? 'interface') === id ? 'btn--primary' : 'btn--secondary'}`}
      href={`/admin/translations?locale=${locale}${id === 'interface' ? '' : `&section=${id}`}`}>{name} ({done}/{total})</a>
  );
  return (
    <>
      <div className="admin-head"><h1>Translations</h1></div>
      <Flash sp={sp} />
      <nav className="btn-row" aria-label="Language">{LOCALES.filter((l) => l !== 'en').map((l) => <a key={l} className={`btn ${l === locale ? 'btn--primary' : 'btn--secondary'}`} href={`/admin/translations?locale=${l}${section ? `&section=${section.id}` : ''}`}>{LOCALE_NAMES[l]}</a>)}</nav>
      <nav className="btn-row" aria-label="Part of the site">
        {tab('interface', 'Interface words', count(strings.map((x) => x.key)), strings.length)}
        {SECTIONS.map((sec) => tab(sec.id, sec.name, count(sectionKeys(sec)), Object.keys(sec.drafts).length))}
      </nav>
      <p className="t-small">The site shows the drafts until a text is ticked and saved here as reviewed. {settings.locales.indexed.includes(locale) ? 'This language is indexed in search.' : 'This language is not indexed in search yet (Settings).'} {section ? 'A text changed in English later (in Products, Categories or Pages) shows in English until it is translated again. The legal pages stay in English.' : ''}</p>
      <form action={saveTranslations} className="panel-box">
        <input type="hidden" name="locale" value={locale} />
        {section ? <input type="hidden" name="section" value={section.id} /> : null}
        <div className="table-wrap"><table className="data"><thead><tr><th>English</th><th>{LOCALE_NAMES[locale]}</th><th>Reviewed</th></tr></thead><tbody>
          {section ? Object.entries(section.drafts).map(([en, drafts]) => {
            const key = textKey(en);
            const value = reviewed.get(key) ?? drafts[i];
            const long = en.length > 90 || en.includes('\n');
            return (
              <tr key={key}><td><label htmlFor={`t_${key}`} style={{ whiteSpace: 'pre-wrap' }}>{en}</label></td>
                <td>{long
                  ? <textarea id={`t_${key}`} name={`t_${key}`} defaultValue={value} lang={locale} rows={Math.min(10, Math.ceil(en.length / 70) + en.split('\n').length)} />
                  : <input id={`t_${key}`} name={`t_${key}`} defaultValue={value} lang={locale} />}</td>
                <td><input type="checkbox" name={`r_${key}`} defaultChecked={reviewed.has(key)} aria-label={`Mark “${en.slice(0, 60)}” reviewed`} /></td></tr>
            );
          }) : strings.map((st) => (
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
