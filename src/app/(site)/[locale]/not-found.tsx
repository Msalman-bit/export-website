import { headers } from 'next/headers';

export default async function NotFound() {
  const path = (await headers()).get('x-pathname') ?? '/en';
  const locale = path.split('/')[1] || 'en';
  return (
    <main id="top" className="page">
      <div className="wrap">
        <div className="page-head">
          <h1>Page not found</h1>
          <p>This address has no page. It may have moved when the catalogue changed.</p>
          <div className="btn-row">
            <a className="btn btn--primary" href={`/${locale}/products`}>See the catalogue</a>
            <a className="btn btn--secondary" href={`/${locale}`}>Go to the home page</a>
          </div>
        </div>
      </div>
    </main>
  );
}
