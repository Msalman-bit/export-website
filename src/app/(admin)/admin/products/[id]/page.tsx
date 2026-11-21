import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { pic } from '@/lib/media';
import { Flash, type SP } from '../../ui';
import { saveProduct, deleteProduct, addProductImage, removeProductImage } from '../../actions';

/* /admin/products/new and /admin/products/:id: every commercial and technical field of a product.
   Empty fields are shown on the site as "Confirmed in your quotation", never invented. */
export default async function ProductEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const u = await requireStaff('catalogue.write');
  const canDelete = can(u.role, 'catalogue.delete'); // administrators only
  const { id } = await params;
  const sp = await searchParams;
  // the list search the product was opened from (?q=): its back link and a delete return to that filtered list
  const q = sp.q?.slice(0, 60) ?? '';
  const listHref = q ? `/admin/products?q=${encodeURIComponent(q)}` : '/admin/products';
  // a refused deletion (wrong SKU or code) comes back with the danger section open, the message above it
  const refused = /Nothing was deleted|Too many wrong codes/.test(sp.error ?? '');
  const db = await getDb();
  const isNew = id === 'new';
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = isNew ? [null] : await db.select().from(s.products).where(eq(s.products.id, id)).limit(1);
  if (!isNew && !p) notFound();
  // product types grouped by family, so two types with the same name ("Protective accessories") are told apart,
  // and a hidden one (a new family or type not published yet) is marked
  const cats = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
  const groups = cats.filter((c) => !c.parentId).map((f) => ({ f, subs: cats.filter((c) => c.parentId === f.id) })).filter((g) => g.subs.length);
  const hidden = (c: typeof cats[number]) => (c.published ? '' : ' (hidden)');
  const v = (x: string | undefined | null) => x ?? '';
  const l = (x: string[] | undefined) => (x ?? []).join('\n');
  return (
    <>
      <div className="admin-head"><div><p className="t-small muted"><a className="link" href={listHref}>Products</a></p><h1>{isNew ? 'New product' : p!.name}</h1></div>
        {!isNew ? <a className="btn btn--secondary" href={`/api/products/${p!.id}/datasheet`}>Download the datasheet</a> : null}</div>
      <Flash sp={sp} />
      <div className="cols-2">
        <form action={saveProduct} className="panel-box">
          {!isNew ? <input type="hidden" name="id" value={p!.id} /> : null}
          <div className="form-grid">
            <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" defaultValue={v(p?.name)} required /></div>
            <div className="field"><label htmlFor="categoryId">Product type</label><select id="categoryId" name="categoryId" defaultValue={v(p?.categoryId)} required><option value="" disabled>Choose</option>{groups.map(({ f, subs }) => (
              <optgroup key={f.id} label={`${f.name}${hidden(f)}`}>{subs.map((c) => <option key={c.id} value={c.id}>{c.name}{hidden(c)}</option>)}</optgroup>
            ))}</select></div>
            <div className="field"><label htmlFor="sku">SKU</label><input id="sku" name="sku" defaultValue={v(p?.sku)} /></div>
            <div className="field"><label htmlFor="slug">Web address (slug)</label><input id="slug" name="slug" defaultValue={v(p?.slug)} /></div>
            <div className="field field--full"><label htmlFor="summary">Summary (one sentence)</label><input id="summary" name="summary" defaultValue={v(p?.summary)} /></div>
            <div className="field field--full"><label htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={v(p?.description)} /></div>
            <div className="field"><label htmlFor="construction">Construction</label><input id="construction" name="construction" defaultValue={v(p?.construction)} /></div>
            <div className="field"><label htmlFor="materials">Materials</label><input id="materials" name="materials" defaultValue={v(p?.materials)} /></div>
            <div className="field"><label htmlFor="weight">Weight</label><input id="weight" name="weight" defaultValue={v(p?.weight)} /></div>
            <div className="field"><label htmlFor="moq">Minimum order quantity</label><input id="moq" name="moq" defaultValue={v(p?.moq)} /></div>
            <div className="field"><label htmlFor="leadTime">Production lead time</label><input id="leadTime" name="leadTime" defaultValue={v(p?.leadTime)} /></div>
            <div className="field"><label htmlFor="studioModel">Customisation studio model</label><select id="studioModel" name="studioModel" defaultValue={v(p?.studioModel)}><option value="">Not in the studio</option><option value="football">32-panel ball: football, futsal or handball (3D)</option><option value="rugby">Rugby ball (3D)</option><option value="glove">Glove (2D)</option><option value="jersey">Shirt (2D)</option></select></div>
            <div className="field"><label htmlFor="sizes">Sizes (one per line)</label><textarea id="sizes" name="sizes" defaultValue={l(p?.sizes)} /></div>
            <div className="field"><label htmlFor="colours">Standard colours (one per line)</label><textarea id="colours" name="colours" defaultValue={l(p?.colours)} /></div>
            <div className="field"><label htmlFor="brandingOptions">Branding options</label><textarea id="brandingOptions" name="brandingOptions" defaultValue={l(p?.brandingOptions)} /></div>
            <div className="field"><label htmlFor="packagingOptions">Packaging options</label><textarea id="packagingOptions" name="packagingOptions" defaultValue={l(p?.packagingOptions)} /></div>
            <div className="field"><label htmlFor="testingStandards">Testing standards (only with test reports)</label><textarea id="testingStandards" name="testingStandards" defaultValue={l(p?.testingStandards)} /></div>
            <div className="field"><label htmlFor="specs">More specifications (Label: value, one per line)</label><textarea id="specs" name="specs" defaultValue={(p?.specs ?? []).map((x) => `${x.label}: ${x.value}`).join('\n')} /></div>
            <div className="field"><label htmlFor="seoTitle">Search title</label><input id="seoTitle" name="seoTitle" defaultValue={v(p?.seoTitle)} maxLength={160} /></div>
            <div className="field"><label htmlFor="seoDescription">Search description</label><input id="seoDescription" name="seoDescription" defaultValue={v(p?.seoDescription)} maxLength={300} /></div>
            <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={p?.status ?? 'draft'}><option value="draft">Draft (hidden)</option><option value="published">Published</option></select></div>
            <label className="chk"><input type="checkbox" name="featured" defaultChecked={p?.featured} /> Featured</label>
          </div>
          <div className="btn-row"><button className="btn btn--primary" type="submit">{isNew ? 'Create the product' : 'Save the product'}</button></div>
        </form>
        {!isNew ? (
          <div className="block">
            <section className="panel-box"><h2>Pictures</h2>
              <div className="thumbs">{p!.images.map((im, i) => {
                const pp = pic(im.url, 400);
                return (
                  <figure key={im.url + i}>{pp ? <img src={pp.src} alt={im.alt} /> : null}<span>{im.source === 'generated' ? 'Generated concept' : 'Photograph'}</span>
                    <form action={removeProductImage}><input type="hidden" name="id" value={p!.id} /><input type="hidden" name="index" value={i} /><button className="btn-text" type="submit">Remove</button></form></figure>
                );
              })}</div>
              <form action={addProductImage} className="block" encType="multipart/form-data"><input type="hidden" name="id" value={p!.id} />
                <div className="field"><label htmlFor="file">Add a photograph (PNG, JPG or WEBP)</label><input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp" required /></div>
                <div className="field"><label htmlFor="alt">What it shows (alt text)</label><input id="alt" name="alt" /></div>
                <button className="btn btn--secondary" type="submit">Upload</button></form>
            </section>
            <section className="panel-box"><h2>Delete the product</h2>
              {canDelete ? (
                // two steps, as for an inquiry: the SKU typed to confirm, then a fresh authenticator code
                <details className="danger-zone" open={refused || undefined}>
                  <summary className="btn btn--quiet-danger">Delete…</summary>
                  <div className="danger-zone__body" role="group" aria-label={`Delete ${p!.name}`}>
                    <p><strong>Delete {p!.name} ({p!.sku})? This can’t be undone.</strong></p>
                    <p className="t-small">
                      It leaves the catalogue and the site at once, and its page stops working: links to it, including from
                      search engines, lead nowhere. Past inquiries and quotations keep its name and SKU, and photographs
                      uploaded for it stay in the Media library. To take it off the site for now, set Status to Draft
                      (hidden) and save instead: that can be undone.
                    </p>
                    <form action={deleteProduct} className="block">
                      <input type="hidden" name="id" value={p!.id} />{q ? <input type="hidden" name="q" value={q} /> : null}
                      <div className="field">
                        <label htmlFor="delete-sku">Type the SKU, {p!.sku}, to confirm</label>
                        <input id="delete-sku" name="confirm" type="text" autoComplete="off" spellCheck={false} required />
                      </div>
                      <div className="field">
                        <label htmlFor="delete-code">Code from your authenticator app</label>
                        <input id="delete-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
                      </div>
                      <div className="btn-row"><button className="btn btn--danger" type="submit">Delete {p!.sku}</button></div>
                    </form>
                  </div>
                </details>
              ) : (
                <p className="t-small">Only an administrator can delete a product. To take it off the site, set Status to Draft (hidden) and save: that can be undone.</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}
