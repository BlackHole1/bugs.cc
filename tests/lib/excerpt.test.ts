import { describe, expect, it } from 'vitest';
import { excerpt, firstParagraph, stripMarkdown, truncate } from '@/lib/excerpt';

describe('excerpt', () => {
  it('takes the first paragraph, skipping headings, images and code', () => {
    const body = `
## Heading

![img](/images/x.png)

\`\`\`sh
echo skipped
\`\`\`

First **real** paragraph with [a link](https://example.com) and \`code\`.
Second line of it.

Second paragraph.
`;
    expect(firstParagraph(body)).toBe(
      'First **real** paragraph with [a link](https://example.com) and `code`. Second line of it.',
    );
    expect(excerpt(body)).toBe('First real paragraph with a link and code. Second line of it.');
  });

  it('strips inline html and emphasis', () => {
    expect(stripMarkdown('a <kbd>Ctrl</kbd> _b_ *c* ~~d~~ <br>')).toBe('a Ctrl b c d');
    expect(stripMarkdown('**bold** __strong__ *em* _em_')).toBe('bold strong em em');
  });

  it('unwraps shortcut reference links and keeps snake_case identifiers', () => {
    // `[electron@39.6.0]` with a `[electron@39.6.0]: url` definition elsewhere
    expect(stripMarkdown('building the [electron@39.6.0] tag and [x][y] and [z][]')).toBe(
      'building the electron@39.6.0 tag and x and z',
    );
    expect(stripMarkdown('Use `foo_bar` and my_var_name with __init__ here')).toBe(
      'Use foo_bar and my_var_name with init here',
    );
    expect(stripMarkdown('text[^1] more[^note]')).toBe('text more');
  });

  it('truncates to 160 characters with an ellipsis', () => {
    const long = 'word '.repeat(60).trim();
    const out = truncate(long);
    expect([...out].length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
    expect(truncate('short')).toBe('short');
  });

  it('handles CJK text without spaces', () => {
    const zh = '中'.repeat(200);
    const out = excerpt(zh);
    expect([...out].length).toBe(160);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns empty for empty bodies', () => {
    expect(excerpt(undefined)).toBe('');
    expect(excerpt('')).toBe('');
  });
});
