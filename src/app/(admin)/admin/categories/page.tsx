import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { pic } from '@/lib/media';
import { Flash, type SP } from '../ui';
import { saveCategory, createCategory, setCategoryPicture, deleteCategory } from '../actions';

type Cat = typeof s.categories.$inferSelect;
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp';

export default async function Categories({ searchParams }: { searchParams: SP }) {
  await requireStaff('catalogue.write');
  const sp = await searchParams;
  const db = await getDb();
  const cats = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder));
  const counts = await db.select({ id: s.products.categoryId, n: sql<number>`count(*)::int` }).from(s.products).groupBy(s.products.categoryId);
  const productsIn = new Map(counts.map((c) => [c.id, c.n]));
  // the site shows a family or type only once it holds a published product (lib/data getFamilies): say so here
  const live = await db.select({ id: s.products.categoryId, n: sql<number>`count(*)::int` }).from(s.products)
    .where(eq(s.products.status, 'published')).groupBy(s.products.categoryId);
  const liveIn = new Map(live.map((c) => [c.id, c.n]));
  const families = cats.filter((c) => !c.parentId);
  // a form's message is shown in the section it was sent from (?at=), so it is on screen where the page opens
  const at = sp.at ?? '';
  const flashIn = (section: string) => (at === section ? <Flash sp={sp} /> : null);
  return (
    <>
      <div className="admin-head"><h1>Categories</h1><a className="btn btn--secondary" href="#new-family">Add a family</a></div>
      {at ? null : <Flash sp={sp} />}
      <p className="t-small">Publish only the product families and types Monolith Sports genuinely supplies. An unpublished family disappears from the menus, the catalogue, the home page and the sitemap.</p>
      {families.map((f) => {
        const types = cats.filter((c) => c.parentId === f.id);
        const picture = pic(f.image?.url, 400);
        return (
          <section key={f.id} className="panel-box cat-family" id={`cat-${f.id}`}>
            {flashIn(`cat-${f.id}`)}
            {f.published ? null : <Hidden what="family" />}
            {f.published && !types.some((t) => t.published && liveIn.get(t.id)) ? <NoProducts what="family" /> : null}
            <CatForm c={f} />
            <div className="cat-pic">
              {picture ? <img src={picture.src} alt={f.image?.alt ?? f.name} /> : <span className="cat-pic__none t-small">No picture</span>}
              <details>
                <summary className="link">Change the picture</summary>
                <form action={setCategoryPicture} encType="multipart/form-data" className="form-grid cat-pic__form">
                  <input type="hidden" name="id" value={f.id} />
                  <div className="field"><label htmlFor={`pf-${f.id}`}>Picture (PNG, JPG or WEBP)</label><input id={`pf-${f.id}`} name="file" type="file" accept={IMAGE_TYPES} required /></div>
                  <div className="field"><label htmlFor={`pa-${f.id}`}>What it shows (alt text)</label><input id={`pa-${f.id}`} name="alt" /></div>
                  <div><button className="btn btn--secondary" type="submit">Upload the picture</button></div>
                </form>
              </details>
            </div>
            <details open={types.length === 0 || at === `cat-${f.id}` || undefined}>
              <summary>{types.length === 1 ? '1 product type' : `${types.length} product types`}</summary>
              <div className="block" style={{ marginTop: 16 }}>
                {types.map((c) => (
                  <div key={c.id} className="cat-type">
                    {c.published ? null : <Hidden what="type" />}
                    {c.published && f.published && !liveIn.get(c.id) ? <NoProducts what="type" /> : null}
                    <CatForm c={c} small />
                    {productsIn.get(c.id) ? null : <DeleteEmpty c={c} what="product type" />}
                  </div>
                ))}
                <form action={createCategory} className="form-grid cat-new">
                  <input type="hidden" name="parentId" value={f.id} />
                  <h3 className="field--full t-card">Add a product type to {f.name}</h3>
                  <div className="field"><label htmlFor={`tn-${f.id}`}>Name</label><input id={`tn-${f.id}`} name="name" required minLength={2} maxLength={120} placeholder="For example: Beach footballs" /></div>
                  <div className="field field--full"><label htmlFor={`ts-${f.id}`}>Summary (one sentence)</label><input id={`ts-${f.id}`} name="summary" maxLength={400} /></div>
                  <div><button className="btn btn--secondary" type="submit">Add the product type</button></div>
                </form>
              </div>
            </details>
            {types.length ? null : <DeleteEmpty c={f} what="family" />}
          </section>
        );
      })}
      <section className="panel-box" id="new-family" aria-labelledby="new-family-h">
        {flashIn('new-family')}
        <h2 id="new-family-h">Add a family</h2>
        <p className="t-small">A new family starts hidden. Once it is added, give it its product types (in its section, which opens), add their products under Products, then tick its Published box and save. Its web address comes from the name and does not change later.</p>
        <form action={createCategory} encType="multipart/form-data" className="form-grid">
          <input type="hidden" name="parentId" value="" />
          <div className="field"><label htmlFor="nf-name">Name</label><input id="nf-name" name="name" required minLength={2} maxLength={120} placeholder="For example: Basketball equipment" /></div>
          <div className="field field--full"><label htmlFor="nf-summary">Summary (one sentence, shown under its name on the home page and in the catalogue)</label><input id="nf-summary" name="summary" required maxLength={400} /></div>
          <div className="field field--full"><label htmlFor="nf-body">Landing page text (optional)</label><textarea id="nf-body" name="body" maxLength={3000} /></div>
          <div className="field"><label htmlFor="nf-file">Picture for its tile (PNG, JPG or WEBP)</label><input id="nf-file" name="file" type="file" accept={IMAGE_TYPES} required /></div>
          <div className="field"><label htmlFor="nf-alt">What the picture shows (alt text)</label><input id="nf-alt" name="alt" /></div>
          <div><button className="btn btn--primary" type="submit">Add the family</button></div>
        </form>
      </section>
    </>
  );
}

/** Published, but the site leaves it out: no published product in it yet (it appears as soon as one is). */
function NoProducts({ what }: { what: 'family' | 'type' }) {
  return <p className="t-small"><span className="pill-status badge-draft">Not on the site</span> No published products in this {what} yet, so the site leaves it out. It appears by itself as soon as one is published.</p>;
}

function Hidden({ what }: { what: 'family' | 'type' }) {
  return <p className="t-small"><span className="pill-status badge-draft">Hidden</span> Not on the site{what === 'family' ? '' : ' (nor its products)'} until Published is ticked and saved.</p>;
}

/** Only an empty family or type can go: the action refuses anything holding products or types. */
function DeleteEmpty({ c, what }: { c: Cat; what: 'family' | 'product type' }) {
  return (
    <form action={deleteCategory} className="cat-delete">
      <input type="hidden" name="id" value={c.id} />
      <button className="btn btn--quiet-danger" type="submit">Delete this empty {what}</button>
    </form>
  );
}

function CatForm({ c, small }: { c: Cat; small?: boolean }) {
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
