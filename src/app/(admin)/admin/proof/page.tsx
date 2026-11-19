import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/session';
import { Flash, type SP } from '../ui';
import { saveTestimonial, saveCertificate, deleteProof } from '../actions';

/* Testimonials and certificates: nothing is shown on the site unless it is real, verified and (for a
   testimonial) the person agreed to be quoted; a certificate needs its document. */
export default async function Proof({ searchParams }: { searchParams: SP }) {
  await requireStaff('testimonials.write');
  const sp = await searchParams;
  const db = await getDb();
  const [tests, certs] = await Promise.all([db.select().from(s.testimonials).orderBy(desc(s.testimonials.createdAt)), db.select().from(s.certificates).orderBy(desc(s.certificates.createdAt))]);
  return (
    <>
      <div className="admin-head"><h1>Testimonials and certificates</h1></div>
      <Flash sp={sp} />
      <div className="cols-even">
        <section className="panel-box"><h2>Add a testimonial</h2>
          <form action={saveTestimonial} className="block">
            <div className="field"><label htmlFor="quote">What they said</label><textarea id="quote" name="quote" /></div>
            <div className="field"><label htmlFor="personName">Name</label><input id="personName" name="personName" /></div>
            <div className="field"><label htmlFor="role">Role</label><input id="role" name="role" /></div>
            <div className="field"><label htmlFor="company">Company</label><input id="company" name="company" /></div>
            <label className="chk"><input type="checkbox" name="consent" /> The person agreed in writing to be quoted</label>
            <label className="chk"><input type="checkbox" name="verified" /> I checked that this is a real customer of Monolith Sports</label>
            <label className="chk"><input type="checkbox" name="published" /> Publish</label>
            <button className="btn btn--primary" type="submit">Save</button>
          </form>
          <ul>{tests.map((t) => <li key={t.id}>“{t.quote.slice(0, 80)}” · {t.personName} · {t.published ? 'published' : 'not published'} <form action={deleteProof} className="inline-form"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="kind" value="testimonial" /><button className="btn-text" type="submit">Delete</button></form></li>)}</ul>
        </section>
        <section className="panel-box"><h2>Add a certificate</h2>
          <form action={saveCertificate} className="block" encType="multipart/form-data">
            <div className="field"><label htmlFor="name">Certificate</label><input id="name" name="name" /></div>
            <div className="field"><label htmlFor="issuer">Issued by</label><input id="issuer" name="issuer" /></div>
            <div className="field"><label htmlFor="number">Certificate number</label><input id="number" name="number" /></div>
            <div className="field"><label htmlFor="scope">Scope (products or site)</label><input id="scope" name="scope" /></div>
            <div className="field"><label htmlFor="validUntil">Valid until</label><input id="validUntil" name="validUntil" type="date" /></div>
            <div className="field"><label htmlFor="file">The certificate document (PDF)</label><input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" /></div>
            <label className="chk"><input type="checkbox" name="verified" /> I checked the certificate with the issuing body</label>
            <label className="chk"><input type="checkbox" name="published" /> Publish on Quality control</label>
            <button className="btn btn--primary" type="submit">Save</button>
          </form>
          <ul>{certs.map((c) => <li key={c.id}>{c.name} · {c.issuer} · {c.published ? 'published' : 'not published'} <form action={deleteProof} className="inline-form"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="kind" value="certificate" /><button className="btn-text" type="submit">Delete</button></form></li>)}</ul>
        </section>
      </div>
    </>
  );
}
