import type { APIRoute } from 'astro';
import { SITE } from '@/lib/site';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap.xml', site ?? SITE.url).href;
  // Content Signals (contentsignals.org): the content is CC BY 4.0 and meant
  // to be read, quoted and learned from by people and machines alike, so all
  // three signals are `yes`. A preference, not a lock.
  const body = [
    'User-agent: *',
    'Allow: /',
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
