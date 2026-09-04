import { describe, expect, it } from 'vitest';
import {
  analyze,
  codePointLabel,
  escapeWide,
  formatBytes,
  formatCount,
  segments,
} from '@/components/content/string-memory';

describe('string-memory', () => {
  it('keeps a Latin-1 string at one byte per unit', () => {
    const a = analyze('café [x]');
    expect(a).toEqual({ units: 8, utf8: 9, wideUnits: 0, wide: [], width: 1, heap: 8 });
  });

  it('one code point above U+00FF doubles the whole string', () => {
    const a = analyze('[✓] done');
    expect(a.units).toBe(8);
    expect(a.utf8).toBe(10);
    expect(a.width).toBe(2);
    expect(a.heap).toBe(16);
    expect(a.wide).toEqual([{ char: '✓', code: 0x2713, count: 1 }]);
  });

  it('counts a surrogate pair as two units and one code point', () => {
    const a = analyze('a\u{1F600}b\u{1F600}');
    expect(a.units).toBe(6);
    expect(a.wideUnits).toBe(4);
    expect(a.wide).toEqual([{ char: '\u{1F600}', code: 0x1f600, count: 2 }]);
  });

  it('escapes wide code points and nothing else', () => {
    expect(escapeWide('[✓] café \u{1F600}')).toBe('[\\u2713] café \\uD83D\\uDE00');
    expect(analyze(escapeWide('[✓]')).width).toBe(1);
    expect(codePointLabel(0x2713)).toBe('U+2713');
    expect(codePointLabel(0x1f600)).toBe('U+1F600');
  });

  it('splits a preview into narrow runs and wide code points', () => {
    expect(segments('[✓] ok', false, 100)).toEqual({
      segments: [
        { text: '[', wide: false },
        { text: '✓', wide: true },
        { text: '] ok', wide: false },
      ],
      truncated: false,
    });
    expect(segments('[✓]', true, 100).segments[1]).toEqual({ text: '\\u2713', wide: true });
    expect(segments('abcdef', false, 3)).toEqual({
      segments: [{ text: 'abc', wide: false }],
      truncated: true,
    });
    expect(segments('a\u{1F600}b', false, 2)).toEqual({
      segments: [{ text: 'a', wide: false }],
      truncated: true,
    });
    expect(segments('a\u{1F600}b', false, 3).segments).toEqual([
      { text: 'a', wide: false },
      { text: '\u{1F600}', wide: true },
    ]);
  });

  it('formats sizes and counts like the post', () => {
    expect(formatBytes(12)).toBe('12 B');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(6_471_221)).toBe('6.47 MB');
    expect(formatBytes(15_400_000)).toBe('15.4 MB');
    expect(formatCount(6471221)).toBe('6,471,221');
  });
});
