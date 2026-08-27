import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { imageDimensions, resolvePublicFile } from '@/plugins/image-dimensions';
import { compile } from '../helpers/satteri';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

describe('image-dimensions', () => {
  it('injects width/height/loading/decoding for images in public/', async () => {
    const { html } = await compile('![Avatar](/img/avatar.jpg)', [imageDimensions({ publicDir })]);
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
