import { requireStaff } from '@/lib/auth/session';

const TABLES = [
  ['inquiries', 'Inquiries with their contact and delivery details'], ['inquiry_items', 'Every product line of every inquiry'],
  ['quotations', 'Quotations and totals'], ['orders', 'Orders and production stages'], ['customers', 'Customer companies'],
  ['products', 'The catalogue with every commercial field'], ['subscribers', 'Newsletter subscribers'],
] as const;

export default async function Export() {
  await requireStaff('export.data');
  return (
    <>
      <div className="admin-head"><h1>Export data</h1></div>
      <p className="t-small">CSV files open in Excel, Numbers and Google Sheets. Each export is written to the audit log. Personal data in these files falls under your privacy policy: store and share them accordingly.</p>
      <div className="cols-even">
        {TABLES.map(([t, label]) => (
          <section className="panel-box" key={t}><h2>{label}</h2><a className="btn btn--secondary" href={`/api/admin/export?table=${t}`}>Download {t}.csv</a></section>
        ))}
      </div>
    </>
  );
}
