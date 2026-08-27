import type { APIRoute } from 'astro';
import { SITE } from '@/lib/site';

/**
 * `/sitemap.xml` (the old site's path, referenced by robots.txt and old crawler
 * configs) as a real sitemap index that points at the sitemap written by
 * @astrojs/sitemap. The integration still emits its own `sitemap-index.xml`,
 * so both URLs resolve to XML with the same content.
 */
export const GET: APIRoute = ({ site }) => {
  const loc = new URL('/sitemap-0.xml', site ?? SITE.url).href;
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <sitemap><loc>${loc}</loc></sitemap>\n` +
    '</sitemapindex>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
