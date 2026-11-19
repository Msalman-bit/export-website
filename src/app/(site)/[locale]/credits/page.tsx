import manifest from '../../../../../media/manifest.json';
import { localeFrom } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';
import { PageShell } from '@/components/site/PageShell';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({ locale, path: '/credits', title: 'Image and data credits | Monolith Sports', description: 'Where the pictures, the film and the map on this site come from.', noindex: true });
}

export default async function Credits({ params }: Props) {
  const locale = await localeFrom(params);
  const items = manifest.items as { id: string; prompt: string; use?: string }[];
  return (
    <PageShell locale={locale} crumbs={[{ name: 'Credits', path: '/credits' }]} enter="content">
      <header className="page-head">
        <h1>Image and data credits</h1>
        <p>The product pictures and the film on this site are generated visual concepts of each product type. They are not photographs of Monolith Sports products, staff or premises, and they are replaced with the company’s own photography as it is shot.</p>
      </header>
      <div className="prose">
        <h2>Generated concepts</h2>
        <p>Stills: Flux-2 Pro, with a few product pictures by Nano Banana Pro, via Kie AI. Hero scroll film: keyframes by GPT Image 2.5, motion by Veo 3.1, via Kie AI; two of its changes are blended from those keyframes. Art direction: one studio light setup on a charcoal backdrop, products without any brand marks.</p>
        <h2>Map data</h2>
        <p>Country shapes: Natural Earth (public domain), via the world-atlas package.</p>
        <h2>Fonts</h2>
        <p>Archivo, by Omnibus-Type, under the SIL Open Font License, via Google Fonts.</p>
        <h2>Every generated picture</h2>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th scope="col">File</th><th scope="col">Shows</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.id}><td>{i.id}</td><td>{i.prompt.split(/[.;]/)[0]}</td></tr>)}</tbody>
        </table>
      </div>
    </PageShell>
  );
}
