/**
 * `[!code ...]` notation comments (src/expressive-code/notation-markers.ts),
 * rendered through the real Expressive Code engine with its text-markers
 * plugin, exactly as ec.config.mjs wires it.
 */
import { ExpressiveCode } from 'astro-expressive-code';
import { toHtml } from 'hast-util-to-html';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { notationMarkers } from '@/expressive-code/notation-markers';

// Engine defaults (built-in themes): only the marker classes are asserted.
const ec = new ExpressiveCode({ plugins: [notationMarkers()] });

interface Line {
  text: string;
  marker: 'mark' | 'ins' | 'del' | undefined;
  /** Text of the inline `<mark>` elements on the line. */
  marks: string[];
}

async function render(code: string, language = 'js', meta = ''): Promise<Line[]> {
  const { renderedGroupAst } = await ec.render({ code, language, meta });
  // node-html-parser keeps <pre> as raw text by default; the EC line markup
  // lives inside <pre>, so it must be parsed as elements here.
  const root = parse(toHtml(renderedGroupAst), {
    blockTextElements: { script: true, noscript: true, style: true },
  });
  return root.querySelectorAll('.ec-line').map((line) => ({
    text: line.textContent,
    marker: (['mark', 'ins', 'del'] as const).find((m) => line.classList.contains(m)),
    marks: line.querySelectorAll('mark').map((m) => m.textContent),
  }));
}

describe('notation markers', () => {
  it('marks a line by a trailing [!code highlight] and strips the comment', async () => {
    const lines = await render('const a = 1 // [!code highlight]\nconst b = 2');
    expect(lines.map((l) => l.text)).toEqual(['const a = 1', 'const b = 2']);
    expect(lines.map((l) => l.marker)).toEqual(['mark', undefined]);
  });

  it('renders [!code ++] and [!code --] as inserted / deleted lines', async () => {
    const lines = await render('old // [!code --]\nnew // [!code ++]\nsame');
    expect(lines.map((l) => l.text)).toEqual(['old', 'new', 'same']);
    expect(lines.map((l) => l.marker)).toEqual(['del', 'ins', undefined]);
  });

  it('applies a notation alone on its line to the following lines and drops that line', async () => {
    const lines = await render('a\n// [!code highlight:2]\nb\nc\nd');
    expect(lines.map((l) => l.text)).toEqual(['a', 'b', 'c', 'd']);
    expect(lines.map((l) => l.marker)).toEqual([undefined, 'mark', 'mark', undefined]);
  });

  it('extends a trailing notation with :N to the next lines', async () => {
    const lines = await render('a // [!code ++:2]\nb\nc');
    expect(lines.map((l) => l.text)).toEqual(['a', 'b', 'c']);
    expect(lines.map((l) => l.marker)).toEqual(['ins', 'ins', undefined]);
  });

  it('marks every occurrence of a [!code word:...] term in the block', async () => {
    const lines = await render(
      "// [!code word:Hello]\nconst msg = 'Hello World'\nlog(msg) // Hello",
    );
    expect(lines.map((l) => l.text)).toEqual(["const msg = 'Hello World'", 'log(msg) // Hello']);
    expect(lines.map((l) => l.marks)).toEqual([['Hello'], ['Hello']]);
    expect(lines.every((l) => l.marker === undefined)).toBe(true);
  });

  it('accepts other comment prefixes (#, <!-- -->, /* */)', async () => {
    const sh = await render('echo hi # [!code highlight]\necho bye', 'sh');
    expect(sh.map((l) => [l.text, l.marker])).toEqual([
      ['echo hi', 'mark'],
      ['echo bye', undefined],
    ]);
    const html = await render('<p>a</p> <!-- [!code ++] -->\n<p>b</p>', 'html');
    expect(html.map((l) => [l.text, l.marker])).toEqual([
      ['<p>a</p>', 'ins'],
      ['<p>b</p>', undefined],
    ]);
    const css = await render('a { color: red; } /* [!code --] */\nb {}', 'css');
    expect(css.map((l) => [l.text, l.marker])).toEqual([
      ['a { color: red; }', 'del'],
      ['b {}', undefined],
    ]);
  });

  it('keeps the fence meta syntax working next to the notation', async () => {
    // Meta line numbers count the lines of the fence, notation-only lines included.
    const lines = await render('a\n// [!code word:b]\nb // [!code highlight]\nc', 'js', '{4} "a"');
    expect(lines.map((l) => l.text)).toEqual(['a', 'b', 'c']);
    expect(lines.map((l) => l.marker)).toEqual([undefined, 'mark', 'mark']);
    expect(lines.map((l) => l.marks)).toEqual([['a'], ['b'], []]);
  });

  it('leaves notations it does not implement in the code', async () => {
    const lines = await render('a // [!code focus]\nb');
    expect(lines.map((l) => l.text)).toEqual(['a // [!code focus]', 'b']);
    expect(lines.every((l) => l.marker === undefined)).toBe(true);
  });

  it('does not touch code without notations', async () => {
    const lines = await render('const x = "[!code highlight]"\n// not a notation [!code ++] here');
    expect(lines.map((l) => l.text)).toEqual([
      'const x = "[!code highlight]"',
      '// not a notation [!code ++] here',
    ]);
    expect(lines.every((l) => l.marker === undefined)).toBe(true);
  });
});
