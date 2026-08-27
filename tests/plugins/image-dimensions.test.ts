import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { imageDimensions, resolvePublicFile } from '@/plugins/image-dimensions';
import { compile } from '../helpers/satteri';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

describe('image-dimensions', () => {
  it('injects width/height/loading/decoding for images in public/', async () => {
    // Two images: the first one near the top is the eager LCP candidate (see below).
    const md = '![Avatar](/img/avatar.jpg)\n\n![Second](/img/avatar.jpg)';
    const { html } = await compile(md, [imageDimensions({ publicDir })]);
    expect(html).toContain('width="460"');
    expect(html).toContain('height="460"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('alt="Avatar"');
  });

  it('keeps an empty alt when the markdown alt is empty', async () => {
    const { html } = await compile('![](/img/avatar.jpg)', [imageDimensions({ publicDir })]);
    expect(html).toContain('alt=""');
  });

  it('loads the first image near the top eagerly with a high fetch priority', async () => {
    const md = 'Intro.\n\n![a](/img/avatar.jpg)\n\n![b](/img/avatar.jpg)';
    const { html } = await compile(md, [imageDimensions({ publicDir })]);
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toContain('fetchpriority="high"');
    expect(imgs[0]).not.toContain('loading=');
    expect(imgs[0]).toContain('decoding="async"');
    expect(imgs[1]).toContain('loading="lazy"');
    expect(imgs[1]).not.toContain('fetchpriority');
  });

  it('keeps a first image lazy when too much text precedes it', async () => {
    const md = `${'word '.repeat(400)}\n\n![a](/img/avatar.jpg)`;
    const { html } = await compile(md, [imageDimensions({ publicDir })]);
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('fetchpriority');
  });

  it('uses the smaller character budget for Chinese documents', async () => {
    const md = `${'字'.repeat(700)}\n\n![a](/img/avatar.jpg)`;
    const en = await compile(md, [imageDimensions({ publicDir })], new URL('file:///p/en/a.md'));
    const zh = await compile(md, [imageDimensions({ publicDir })], new URL('file:///p/zh/a.md'));
    expect(en.html).toContain('fetchpriority="high"');
    expect(zh.html).toContain('loading="lazy"');
  });

  it('respects eagerBudget: false and an explicit loading attribute', async () => {
    const off = await compile('![a](/img/avatar.jpg)', [
      imageDimensions({ publicDir, eagerBudget: false }),
    ]);
    expect(off.html).toContain('loading="lazy"');
    expect(off.html).not.toContain('fetchpriority');
    const explicit = await compile('<img src="/img/avatar.jpg" loading="lazy">', [
      imageDimensions({ publicDir }),
    ]);
    expect(explicit.html).toContain('loading="lazy"');
    expect(explicit.html).not.toContain('fetchpriority');
  });

  it('skips remote images and missing files', async () => {
    const md = '![r](https://example.com/a.png)\n\n![m](/img/missing.png)';
    const { html } = await compile(md, [imageDimensions({ publicDir })]);
    expect(html).not.toContain('width=');
    expect(html).not.toContain('loading=');
  });

  it('resolvePublicFile refuses traversal and non-root paths', () => {
    expect(resolvePublicFile('/img/avatar.jpg', publicDir)).toBe(
      path.join(publicDir, 'img', 'avatar.jpg'),
    );
    expect(resolvePublicFile('/../package.json', publicDir)).toBeNull();
    expect(resolvePublicFile('../img/avatar.jpg', publicDir)).toBeNull();
    expect(resolvePublicFile('//cdn.example.com/a.png', publicDir)).toBeNull();
    expect(resolvePublicFile('/img/avatar.jpg?v=1#x', publicDir)).toBe(
      path.join(publicDir, 'img', 'avatar.jpg'),
    );
  });
});
