import { describe, expect, it } from 'vitest';
import { countTags, sameTag, tagSlug, titleCaseTag, uniqueTags } from '@/lib/tags';

describe('tagSlug', () => {
  it('lowercases, trims and replaces whitespace with dashes', () => {
    expect(tagSlug('  Web Security ')).toBe('web-security');
    expect(tagSlug('Linux')).toBe('linux');
    expect(tagSlug('a   b\tc')).toBe('a-b-c');
  });

  it('preserves slashes (nested tag paths)', () => {
    expect(tagSlug('CI/CD')).toBe('ci/cd');
  });

  it('keeps CJK', () => {
    expect(tagSlug('杂谈')).toBe('杂谈');
  });
});

describe('tag comparison', () => {
  it('is case-insensitive', () => {
    expect(sameTag('Linux', 'linux')).toBe(true);
    expect(uniqueTags(['Linux', 'linux', ' LINUX ', 'bun'])).toEqual(['linux', 'bun']);
  });

  it('counts tags across posts, most used first', () => {
    const posts = [
      { data: { tags: ['Linux', 'bun'] } },
      { data: { tags: ['linux'] } },
      { data: { tags: ['astro'] } },
    ];
    expect(countTags(posts)).toEqual([
      { tag: 'linux', slug: 'linux', count: 2 },
      { tag: 'astro', slug: 'astro', count: 1 },
      { tag: 'bun', slug: 'bun', count: 1 },
    ]);
  });
});

describe('titleCaseTag', () => {
  it('capitalises each word for the English tag page heading', () => {
    expect(titleCaseTag('web security')).toBe('Web Security');
    expect(titleCaseTag('Linux')).toBe('Linux');
    expect(titleCaseTag('ci/cd')).toBe('Ci/Cd');
    expect(titleCaseTag('json hijacking')).toBe('Json Hijacking');
    expect(titleCaseTag('杂谈')).toBe('杂谈');
  });
});
