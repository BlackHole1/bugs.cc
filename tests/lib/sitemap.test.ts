/**
 * Sitemap allowlist: `sitemapHooks().filter` admits exactly the real pages
 * computed from the content (home, lists, posts, tag pages) and rejects the
 * alias redirects, including the old Chinese post URLs whose path looks like
 * a post, so the sitemap never lists a redirect page.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sitemapHooks } from '@/lib/sitemap';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SITE = 'https://bugs.cc';
const hooks = sitemapHooks(path.join(ROOT, 'src/content/posts'), SITE);

describe('sitemapHooks().filter', () => {
  it('accepts home, lists, projects, posts, tag index and tag pages in both languages', () => {
    const urls = [
      '/',
      '/zh/',
      '/posts/',
      '/zh/posts/',
      '/projects/',
      '/zh/projects/',
      '/tags/',
      '/zh/tags/',
      '/posts/troubleshooting-bun-kafkajs-cpu-spin/',
      '/zh/posts/company-wifi-security/',
      '/zh/tags/electron/',
      '/zh/tags/ci/cd/',
    ].map((p) => SITE + p);
    expect(urls.filter((u) => !hooks.filter(u))).toEqual([]);
  });

  it('rejects alias redirects (old Chinese post URLs included), /en/, sitemaps, 404 and feeds', () => {
    const urls = [
      '/en/',
      '/sitemap.xml',
      '/sitemap-index.xml',
      '/404/',
      '/index.xml',
      '/zh/index.xml',
      '/zh/p/company-wifi-security/',
      '/p/company-wifi-security/',
      '/zh/2016/12/13/company-wifi-security/',
      '/zh/posts/公司wifi安全/',
      encodeURI('/zh/posts/公司wifi安全/'),
      '/posts/公司wifi安全/',
      '/zh/posts/no-such-post/',
      '/zh/tags/no-such-tag/',
    ].map((p) => SITE + p);
    expect(urls.filter((u) => hooks.filter(u))).toEqual([]);
  });

  it('serialize adds alternates and lastmod only to known pages', () => {
    const post = hooks.serialize({ url: SITE + '/zh/posts/troubleshooting-bun-kafkajs-cpu-spin/' });
    expect(post.lastmod).toBeDefined();
    expect(post.links?.map((l) => l.lang)).toEqual(['en', 'zh-Hans', 'x-default']);
    const alias = { url: SITE + '/zh/posts/公司wifi安全/' };
    expect(hooks.serialize(alias)).toEqual(alias);
  });
});
