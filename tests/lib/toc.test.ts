import { describe, expect, it } from 'vitest';
import { buildToc, countToc, shouldRenderToc } from '@/lib/toc';

const h = (depth: number, slug: string) => ({ depth, slug, text: slug });

describe('buildToc', () => {
  it('nests h2..h4 and ignores h1/h5/h6', () => {
    const toc = buildToc([
      h(1, 'title'),
      h(2, 'a'),
      h(3, 'a1'),
      h(4, 'a1x'),
      h(5, 'deep'),
      h(2, 'b'),
    ]);
    expect(toc).toHaveLength(2);
    expect(toc[0]!.slug).toBe('a');
    expect(toc[0]!.children[0]!.slug).toBe('a1');
    expect(toc[0]!.children[0]!.children[0]!.slug).toBe('a1x');
    expect(toc[1]!.slug).toBe('b');
    expect(countToc(toc)).toBe(4);
  });

  it('attaches skipped levels to the nearest shallower entry', () => {
    const toc = buildToc([h(2, 'a'), h(4, 'a-deep'), h(3, 'a-mid')]);
    expect(toc[0]!.children.map((c) => c.slug)).toEqual(['a-deep', 'a-mid']);
  });

  it('starts at the root when the first heading is deep', () => {
    const toc = buildToc([h(3, 'x'), h(2, 'y')]);
    expect(toc.map((e) => e.slug)).toEqual(['x', 'y']);
  });

  it('leaves out the hidden heading of the footnotes section', () => {
    const toc = buildToc([h(2, 'a'), h(2, 'b'), h(2, 'footnote-label')]);
    expect(toc.map((e) => e.slug)).toEqual(['a', 'b']);
  });

  it('shouldRenderToc needs at least two entries', () => {
    expect(shouldRenderToc(buildToc([h(2, 'a')]))).toBe(false);
    expect(shouldRenderToc(buildToc([h(2, 'a'), h(3, 'b')]))).toBe(true);
  });
});
