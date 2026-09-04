/**
 * Logic of the "string memory" probe (`StringMemory.astro`), shared by the
 * build-time render and the client script so both show the same numbers.
 *
 * A JavaScript engine stores a string either as one byte per code unit when
 * every code unit is at most U+00FF (Latin-1), or as two bytes per code unit
 * otherwise, and the choice is made for the whole string. `analyze` reports
 * the code units, the UTF-8 size, the code points above U+00FF and the
 * resulting heap estimate (payload only, no object header); `segments` splits
 * the text for a preview that marks those code points, optionally replacing
 * each with its `\uXXXX` escape, which is what `escapeWide` does to the whole
 * text.
 */

/** Highest code unit that still fits the one-byte representation. */
export const MAX_ONE_BYTE = 0xff;

export interface WideCodePoint {
  /** The character itself (one code point, so possibly a surrogate pair). */
  char: string;
  /** Its code point value. */
  code: number;
  /** Occurrences in the text. */
  count: number;
}

export interface StringAnalysis {
  /** UTF-16 code units (`String.prototype.length`). */
  units: number;
  /** Size of the UTF-8 encoding in bytes. */
  utf8: number;
  /** Code units above U+00FF. */
  wideUnits: number;
  /** Distinct code points above U+00FF, in order of first appearance. */
  wide: WideCodePoint[];
  /** Bytes per code unit the engine would use: 1 or 2. */
  width: 1 | 2;
  /** `units * width`. */
  heap: number;
}

export interface PreviewSegment {
  text: string;
  /** The segment is (or stands for) a code point above U+00FF. */
  wide: boolean;
}

export interface Preview {
  segments: PreviewSegment[];
  /** The text was longer than the limit and was cut. */
  truncated: boolean;
}

const encoder = new TextEncoder();

export function analyze(text: string): StringAnalysis {
  const seen = new Map<number, WideCodePoint>();
  let wideUnits = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= MAX_ONE_BYTE) continue;
    wideUnits += char.length;
    const hit = seen.get(code);
    if (hit) hit.count++;
    else seen.set(code, { char, code, count: 1 });
  }
  const width = wideUnits > 0 ? 2 : 1;
  return {
    units: text.length,
    utf8: encoder.encode(text).length,
    wideUnits,
    wide: [...seen.values()],
    width,
    heap: text.length * width,
  };
}

/** `\uXXXX` of a code point: one escape per UTF-16 code unit, upper case hex. */
export function escapeCodePoint(code: number): string {
  return String.fromCodePoint(code)
    .split('')
    .map((unit) => '\\u' + unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'))
    .join('');
}

/** `U+2713` style label of a code point. */
export function codePointLabel(code: number): string {
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
}

/** The text with every code point above U+00FF replaced by its `\uXXXX` escape(s). */
export function escapeWide(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    out += code > MAX_ONE_BYTE ? escapeCodePoint(code) : char;
  }
  return out;
}

/**
 * First `limit` UTF-16 code units, never ending on a lone high surrogate so a
 * preview cut cannot split an emoji or other supplementary-plane character.
 */
function sliceUnits(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let end = limit;
  const last = text.charCodeAt(end - 1);
  const next = text.charCodeAt(end);
  if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end -= 1;
  return text.slice(0, end);
}

/**
 * Split the first `limit` code units of `text` into runs of narrow characters
 * and single wide code points; with `escape`, a wide code point's segment
 * holds its escape instead of the character.
 */
export function segments(text: string, escape: boolean, limit: number): Preview {
  const truncated = text.length > limit;
  const shown = truncated ? sliceUnits(text, limit) : text;
  const out: PreviewSegment[] = [];
  let run = '';
  for (const char of shown) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= MAX_ONE_BYTE) {
      run += char;
      continue;
    }
    if (run) out.push({ text: run, wide: false });
    run = '';
    out.push({ text: escape ? escapeCodePoint(code) : char, wide: true });
  }
  if (run) out.push({ text: run, wide: false });
  return { segments: out, truncated };
}

/** `12 B`, `1.5 KB`, `6.47 MB` (decimal units, like the post's figures). */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1e6) return `${trim(bytes / 1000)} KB`;
  return `${trim(bytes / 1e6)} MB`;
}

function trim(value: number): string {
  return String(Number(value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0)));
}

/** `1,234,567`. */
export function formatCount(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
