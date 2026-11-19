import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, type SP } from '../ui';
import { saveCategory } from '../actions';

export default async function Categories({ searchParams }: { searchParams: SP }) {
  await requireStaff('catalogue.write');
  const sp = await searchParams;
  const db = await getDb();
  const cats = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder));
  const families = cats.filter((c) => !c.parentId);
  return (
    <>
      <div className="admin-head"><h1>Categories</h1></div>
      <Flash sp={sp} />
      <p className="t-small">Publish only the product families and types Monolith Sports genuinely supplies. An unpublished family disappears from the menus, the catalogue, the home page and the sitemap.</p>
      {families.map((f) => (
        <section key={f.id} className="panel-box">
          <CatForm c={f} />
          <details><summary>{cats.filter((c) => c.parentId === f.id).length} product types</summary>
            <div className="block" style={{ marginTop: 16 }}>{cats.filter((c) => c.parentId === f.id).map((c) => <CatForm key={c.id} c={c} small />)}</div>
          </details>
        </section>
      ))}
    </>
  );
}

function CatForm({ c, small }: { c: typeof s.categories.$inferSelect; small?: boolean }) {
  return (
    <form action={saveCategory} className="form-grid">
      <input type="hidden" name="id" value={c.id} />
      <div className="field"><label htmlFor={`n-${c.id}`}>{small ? 'Type' : 'Family'}</label><input id={`n-${c.id}`} name="name" defaultValue={c.name} /></div>
      <div className="field"><label htmlFor={`o-${c.id}`}>Order</label><input id={`o-${c.id}`} name="sortOrder" inputMode="numeric" defaultValue={c.sortOrder} /></div>
      <div className="field field--full"><label htmlFor={`s-${c.id}`}>Summary</label><input id={`s-${c.id}`} name="summary" defaultValue={c.summary} /></div>
      {!small ? <div className="field field--full"><label htmlFor={`b-${c.id}`}>Landing page text</label><textarea id={`b-${c.id}`} name="body" defaultValue={c.body} /></div> : <input type="hidden" name="body" value={c.body} />}
      <div className="field"><label htmlFor={`t-${c.id}`}>Search title</label><input id={`t-${c.id}`} name="seoTitle" defaultValue={c.seoTitle} /></div>
      <div className="field"><label htmlFor={`d-${c.id}`}>Search description</label><input id={`d-${c.id}`} name="seoDescription" defaultValue={c.seoDescription} /></div>
      <label className="chk"><input type="checkbox" name="published" defaultChecked={c.published} /> Published</label>
      <div><button className="btn btn--secondary" type="submit">Save {c.name}</button></div>
    </form>
  );
}
