import { localeFrom } from '@/lib/i18n/server';
import { getAllProducts } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { pic } from '@/lib/media';
import { readSession } from '@/lib/auth/session';
import { PageShell } from '@/components/site/PageShell';
import { Studio } from '@/components/studio/Studio';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ product?: string }> };

export async function generateMetadata({ params }: Props) {
  const locale = await localeFrom(params);
  return pageMeta({
    locale, path: '/studio', title: 'Customisation studio: design your ball, gloves or kit | Monolith Sports',
    description: 'Paint a football panel by panel, upload your logo, pick materials and packaging, then send the design with your inquiry. Previews are visual concepts.',
    image: pic('gen:studio-hero', 1200)?.src,
  });
}

export default async function StudioPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const { product } = await searchParams;
  const all = await getAllProducts();
  const user = await readSession('customer');
  const products = all.filter((p) => p.studioModel).map((p) => ({
    id: p.id, name: p.name, sku: p.sku, model: p.studioModel!, image: pic(p.images[0]?.url, 400)?.src,
    href: `/${locale}/products/${p.familySlug}/${p.slug}`,
    sizes: p.sizes, construction: p.construction, packaging: p.packagingOptions,
  }));
  return (
    <PageShell locale={locale} crumbs={[{ name: 'Customisation studio', path: '/studio' }]} mainClass="page page--tool">
      <header className="page-head">
        <h1>Customisation studio</h1>
        <p>Paint a ball panel by panel, place your logo and choose materials, construction and packaging. When the design is right, add it to your inquiry: its picture and your logo travel with it.</p>
      </header>
      <Studio locale={locale} products={products} initialId={product} signedIn={!!user?.emailVerifiedAt} />
    </PageShell>
  );
}
