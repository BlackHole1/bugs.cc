import { describe, expect, it } from 'vitest';
import { mdxToMarkdown } from '@/lib/mdx';

describe('mdxToMarkdown', () => {
  it('drops import lines and brace comments', () => {
    const src = `import YouTube from "../../../components/content/YouTube.astro";\n\n{/* note */}\n## Hi\n`;
    expect(mdxToMarkdown(src)).toBe('\n\n## Hi\n');
  });

  it('turns <YouTube> into a link', () => {
    expect(mdxToMarkdown('<YouTube id="abc" />')).toBe(
      '[YouTube: https://www.youtube.com/watch?v=abc](https://www.youtube.com/watch?v=abc)',
    );
  });

  it('turns <CpuDayChart> into its static image', () => {
    expect(mdxToMarkdown('<CpuDayChart image="/images/x/cpu-day.png" alt="CPU" />')).toBe(
      '![CPU](/images/x/cpu-day.png)',
    );
    expect(mdxToMarkdown('<CpuDayChart alt="no image" />')).toBe('');
  });
});
