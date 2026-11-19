import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

// read at request time, so the same build can be a preview (hidden) or the live site (indexed)
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // a preview copy (SITE_NOINDEX=1, for example the free Render preview) asks every search engine to stay out
  if (process.env.SITE_NOINDEX === '1') return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/media/', '/*/account', '/*/search', '/*/inquiry/sent'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
