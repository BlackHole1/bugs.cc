import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  aliasParam,
  EXTRA_ALIASES,
  feedUrl,
  homeUrl,
  postUrl,
  rootFormOfAlias,
  tagUrl,
  xIntentUrl,
} from '@/lib/url';

describe('url helpers', () => {
  it('builds locale-aware paths with trailing slashes', () => {
    expect(homeUrl('en')).toBe('/');
    expect(homeUrl('zh')).toBe('/zh/');
    expect(postUrl('en', 'hello')).toBe('/posts/hello/');
    expect(postUrl('zh', '中文')).toBe('/zh/posts/中文/');
    expect(tagUrl('zh', 'Web Security')).toBe('/zh/tags/web-security/');
    expect(tagUrl('en', 'ci/cd')).toBe('/tags/ci/cd/');
    expect(feedUrl('zh')).toBe('/zh/index.xml');
  });

  it('absolute urls percent-encode Chinese', () => {
    expect(absoluteUrl('/zh/posts/中文/')).toBe('https://bugs.cc/zh/posts/%E4%B8%AD%E6%96%87/');
  });

  it('X intent encodes the pre-filled text', () => {
    expect(xIntentUrl("Reading @Free_BlackHole's https://bugs.cc/posts/a/\n\nI think...")).toBe(
      "https://x.com/intent/post/?text=Reading%20%40Free_BlackHole's%20https%3A%2F%2Fbugs.cc%2Fposts%2Fa%2F%0A%0AI%20think...",
    );
  });

  it('X intent path does not match the AdGuard social filter that hides share links', () => {
    // `##a[href^="https://x.com/intent/post?"]` in AdGuard's "Social media" list.
    expect(xIntentUrl('x')).not.toMatch(/^https:\/\/x\.com\/intent\/post\?/);
  });
});

describe('alias helpers', () => {
  it('strips leading and trailing slashes for the rest route param', () => {
    expect(aliasParam('/zh/p/x/')).toBe('zh/p/x');
    expect(aliasParam('/zh/2016/05/30/x/')).toBe('zh/2016/05/30/x');
    expect(aliasParam(' /en/ ')).toBe('en');
  });

  it('derives the un-prefixed root form of a language-prefixed alias', () => {
    expect(rootFormOfAlias('/zh/p/x/')).toBe('/p/x/');
    expect(rootFormOfAlias('/zh/2016/05/30/x/')).toBe('/2016/05/30/x/');
    expect(rootFormOfAlias('/en/p/x/')).toBe('/p/x/');
    expect(rootFormOfAlias('/p/x/')).toBeUndefined();
    expect(rootFormOfAlias('/zh/')).toBeUndefined();
  });

  it('defines the fixed extra aliases', () => {
    expect(EXTRA_ALIASES).toEqual([{ from: '/en/', to: '/' }]);
  });
});
