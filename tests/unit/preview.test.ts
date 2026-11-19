import { describe, it, expect, afterEach } from 'vitest';
import robots from '@/app/robots';
import { siteUrl } from '@/lib/seo';

const keep = { SITE_NOINDEX: process.env.SITE_NOINDEX, SITE_URL: process.env.SITE_URL, RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL };
afterEach(() => { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe('a preview copy (SITE_NOINDEX=1)', () => {
  it('asks every search engine to stay out', () => {
    process.env.SITE_NOINDEX = '1';
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(r.sitemap).toBeUndefined();
  });
  it('the live site keeps its normal rules and sitemap', () => {
    delete process.env.SITE_NOINDEX;
    process.env.SITE_URL = 'https://www.example.com';
    const r = robots();
    expect(JSON.stringify(r.rules)).toContain('"allow":"/"');
    expect(r.sitemap).toBe('https://www.example.com/sitemap.xml');
  });
});

describe('the site address', () => {
  it('uses SITE_URL first, then the address Render gives the service', () => {
    delete process.env.SITE_URL;
    process.env.RENDER_EXTERNAL_URL = 'https://monolith-sports.onrender.com/';
    expect(siteUrl()).toBe('https://monolith-sports.onrender.com');
    process.env.SITE_URL = 'https://www.example.com';
    expect(siteUrl()).toBe('https://www.example.com');
  });
});
