import { describe, expect, it } from 'vitest';
import { detectLang, estimateReadingTime, readingTime } from '@/plugins/reading-time';
import { compile } from '../helpers/satteri';

describe('reading-time', () => {
  it('counts words for English', () => {
    const text = Array.from({ length: 450 }, (_, i) => `w${i}`).join(' ');
    const rt = estimateReadingTime(text, 'en');
    expect(rt).toEqual({ lang: 'en', count: 450, minutes: 3 });
  });

  it('counts characters for Chinese', () => {
    const text = '中'.repeat(801);
    const rt = estimateReadingTime(text, 'zh');
    expect(rt.count).toBe(801);
    expect(rt.minutes).toBe(3);
  });

  it('never reports less than one minute', () => {
    expect(estimateReadingTime('', 'en').minutes).toBe(1);
    expect(estimateReadingTime('短', 'zh').minutes).toBe(1);
  });

  it('detects language from the file path, then from the text', () => {
    expect(detectLang('hello', new URL('file:///x/src/content/posts/zh/a.md'))).toBe('zh');
    expect(detectLang('中文', new URL('file:///x/src/content/posts/en/a.md'))).toBe('en');
    expect(detectLang('这是一段中文文本 with words')).toBe('zh');
    expect(detectLang('plain english text')).toBe('en');
  });

  it('writes readingTime into the Astro frontmatter bag', async () => {
    const words = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
    const { astro } = await compile(`# T\n\n${words}`, [readingTime()]);
    expect(astro.frontmatter.readingTime).toMatchObject({ lang: 'en', minutes: 2 });
  });
});
