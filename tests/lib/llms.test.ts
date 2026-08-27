import { describe, expect, it } from 'vitest';
import { bodyMarkdown, rewriteLocalUrls, splitCodeSpans } from '@/lib/llms';

const abs = (url: string) =>
  url.startsWith('#') ? `https://bugs.cc/posts/p/${url}` : `https://bugs.cc${url}`;

describe('splitCodeSpans', () => {
  it('separates inline code from text, honouring the backtick-run length', () => {
    expect(splitCodeSpans('a `b` c')).toEqual([
      { text: 'a ', code: false },
      { text: '`b`', code: true },
      { text: ' c', code: false },
    ]);
    expect(splitCodeSpans('x ``a ` b`` y')).toEqual([
      { text: 'x ', code: false },
      { text: '``a ` b``', code: true },
      { text: ' y', code: false },
    ]);
  });

  it('treats an unmatched backtick run as text', () => {
    expect(splitCodeSpans('a ` b')).toEqual([{ text: 'a ` b', code: false }]);
    expect(splitCodeSpans('`` a `')).toEqual([{ text: '`` a `', code: false }]);
  });
});

describe('rewriteLocalUrls', () => {
  it('rewrites link and image destinations, fragments and reference definitions', () => {
    const md = [
      '![a](/images/x.png) [b](/posts/y/ "t") [c](//cdn/z) [d](https://e.com/) [e](#frag)',
      '[ref]: /posts/r/',
      '[abs]: https://e.com/',
    ].join('\n');
    expect(rewriteLocalUrls(md, abs)).toBe(
      [
        '![a](https://bugs.cc/images/x.png) [b](https://bugs.cc/posts/y/ "t") [c](//cdn/z) [d](https://e.com/) [e](https://bugs.cc/posts/p/#frag)',
        '[ref]: https://bugs.cc/posts/r/',
        '[abs]: https://e.com/',
      ].join('\n'),
    );
  });

  it('rewrites raw HTML href/src/poster attributes', () => {
    const md = `<img src="/images/x.png"> <a href='/posts/y/'>y</a> <a href="#top">t</a> <script src="//cdn/x.js"></script>`;
    expect(rewriteLocalUrls(md, abs)).toBe(
      `<img src="https://bugs.cc/images/x.png"> <a href='https://bugs.cc/posts/y/'>y</a> <a href="https://bugs.cc/posts/p/#top">t</a> <script src="//cdn/x.js"></script>`,
    );
  });

  it('leaves fenced code blocks and inline code untouched', () => {
    const md = [
      'see [x](/x/) and `<a href="/y">`',
      '```html',
      '<a href="/inside">[l](/inside)</a>',
      '```',
      '~~~',
      '```',
      '<img src="/still-inside">',
      '~~~',
      '[after](/after/)',
    ].join('\n');
    expect(rewriteLocalUrls(md, abs)).toBe(
      [
        'see [x](https://bugs.cc/x/) and `<a href="/y">`',
        '```html',
        '<a href="/inside">[l](/inside)</a>',
        '```',
        '~~~',
        '```',
        '<img src="/still-inside">',
        '~~~',
        '[after](https://bugs.cc/after/)',
      ].join('\n'),
    );
  });

  it('drops explicit heading ids in both markdown and MDX-escaped form', () => {
    const md = '## 前言 {#intro}\n### 变化 \\{#changes\\}\n## Plain\n#hashtag {#not-a-heading}';
    expect(rewriteLocalUrls(md, abs)).toBe(
      '## 前言\n### 变化\n## Plain\n#hashtag {#not-a-heading}',
    );
  });
});

describe('bodyMarkdown', () => {
  it('reduces an .mdx post to markdown with absolute URLs', () => {
    const post = {
      id: 'zh/p',
      filePath: 'src/content/posts/zh/p.mdx',
      body: 'import X from "../x.astro";\n\n<CpuDayChart image="/images/p/c.png" alt="c" />\n\n[t](#top)\n',
    };
    expect(bodyMarkdown(post, 'https://bugs.cc/')).toBe(
      '![c](https://bugs.cc/images/p/c.png)\n\n[t](https://bugs.cc/zh/posts/p/#top)\n',
    );
  });

  it('keeps a .md post as written apart from the URLs', () => {
    const post = {
      id: 'en/p',
      filePath: 'src/content/posts/en/p.md',
      body: '## A {#a}\n\n![i](/images/i.png)\n',
    };
    expect(bodyMarkdown(post, 'https://bugs.cc/')).toBe(
      '## A\n\n![i](https://bugs.cc/images/i.png)\n',
    );
  });
});
