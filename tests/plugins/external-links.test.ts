import { defineHastPlugin } from 'satteri';
import { describe, expect, it } from 'vitest';
import { externalLinks, isExternalHref } from '@/plugins/external-links';
import { compile } from '../helpers/satteri';

describe('external-links', () => {
  it('adds target and rel to external http(s) links', async () => {
    const { html } = await compile('[x](https://example.com/a)', [externalLinks()]);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('appends a visually hidden new-tab hint in the document language', async () => {
    const md = '[x](https://example.com/a)';
    const en = await compile(md, [externalLinks()], new URL('file:///posts/en/a.md'));
    expect(en.html).toContain('>x<span class="visually-hidden"> (opens in a new tab)</span></a>');
    const zh = await compile(md, [externalLinks()], new URL('file:///posts/zh/a.md'));
    expect(zh.html).toContain('<span class="visually-hidden"> (在新标签页打开)</span>');
    const custom = await compile(md, [externalLinks({ hint: () => 'new tab' })]);
    expect(custom.html).toContain('<span class="visually-hidden"> new tab</span>');
    const none = await compile(md, [externalLinks({ hint: false })]);
    expect(none.html).not.toContain('visually-hidden');
  });

  it('leaves internal and relative links alone', async () => {
    const md = '[a](/posts/x/) [b](https://bugs.cc/posts/y/) [c](#frag) [d](mailto:bh@bugs.cc)';
    const { html } = await compile(md, [externalLinks()]);
    expect(html).not.toContain('target=');
    expect(html).not.toContain('rel=');
  });

  it('merges existing rel tokens set by an earlier plugin', async () => {
    // Raw HTML is passed through as text (rawHtml is off), so the `rel` is
    // planted on the markdown link by a plugin that runs first.
    const nofollow = defineHastPlugin({
      name: 'test-nofollow',
      element: {
        filter: ['a'],
        visit(node, ctx) {
          ctx.setProperty(node, 'rel', 'nofollow noopener');
        },
      },
    });
    const { html } = await compile('[x](https://example.com/a)', [nofollow, externalLinks()]);
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('isExternalHref', () => {
    const hosts = ['bugs.cc', 'www.bugs.cc'];
    expect(isExternalHref('https://example.com', hosts)).toBe(true);
    expect(isExternalHref('http://BUGS.cc/x', hosts)).toBe(false);
    expect(isExternalHref('https://www.bugs.cc/', hosts)).toBe(false);
    expect(isExternalHref('/local/', hosts)).toBe(false);
    expect(isExternalHref('ftp://example.com', hosts)).toBe(false);
  });
});
