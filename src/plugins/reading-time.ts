import { defineHastPlugin } from 'satteri';

/**
 * Sätteri HAST plugin: estimate reading time and expose it to Astro as
 * `remarkPluginFrontmatter.readingTime` (via `ctx.data.astro.frontmatter`).
 *
 * English text is measured in words (200 wpm), Chinese text in characters
 * (400 cpm, the usual figure for CJK). The language comes from the file path
 * (`/en/` or `/zh/` segment) with a CJK-ratio heuristic as fallback.
 */

export type ReadingLang = 'en' | 'zh';

export interface ReadingTime {
  /** Detected language the estimate was computed for. */
  lang: ReadingLang;
  /** Words (en) or characters (zh) counted. */
  count: number;
  /** Whole minutes, at least 1. */
  minutes: number;
}

export interface ReadingTimeOptions {
  wordsPerMinute?: number;
  charsPerMinute?: number;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

export function detectLang(text: string, fileURL?: URL): ReadingLang {
  const p = fileURL?.pathname ?? '';
  if (/\/zh\//.test(p)) return 'zh';
  if (/\/en\//.test(p)) return 'en';
  const cjk = text.match(CJK)?.length ?? 0;
  const letters = text.replace(/\s+/g, '').length || 1;
  return cjk / letters > 0.2 ? 'zh' : 'en';
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function countCjkChars(text: string): number {
  return text.match(CJK)?.length ?? 0;
}

export function estimateReadingTime(
  text: string,
  lang: ReadingLang,
  options: ReadingTimeOptions = {},
): ReadingTime {
  const wpm = options.wordsPerMinute ?? 200;
  const cpm = options.charsPerMinute ?? 400;
  if (lang === 'zh') {
    const cjk = countCjkChars(text);
    // Latin words mixed into Chinese text still count as words.
    const latinWords = countWords(text.replace(CJK, ' '));
    const count = cjk + latinWords;
    return { lang, count, minutes: Math.max(1, Math.ceil(cjk / cpm + latinWords / wpm)) };
  }
  const count = countWords(text);
  return { lang, count, minutes: Math.max(1, Math.ceil(count / wpm)) };
}

export function readingTime(options: ReadingTimeOptions = {}) {
  return defineHastPlugin({
    name: 'blog-reading-time',
    after(root, ctx) {
      const text = ctx.textContent(root);
      const lang = detectLang(text, ctx.fileURL);
      const astro = ctx.data.astro;
      if (!astro) return;
      astro.frontmatter.readingTime = estimateReadingTime(text, lang, options);
    },
  });
}
