import { describe, expect, it } from 'vitest';
import { footnotes } from '@/plugins/footnotes';
import { headingAnchors } from '@/plugins/heading-anchors';
import { compile } from '../helpers/satteri';

const md = 'Text[^a] and again[^a].\n\n[^a]: The note.\n';
const en = new URL('file:///posts/en/a.md');
const zh = new URL('file:///posts/zh/a.md');

describe('footnotes', () => {
  it('labels the section and the back links in the document language', async () => {
    const { html } = await compile(md, [footnotes()], zh);
    expect(html).toContain('<h2 class="visually-hidden" id="footnote-label">脚注</h2>');
    expect(html).not.toContain('sr-only');
    expect(html).toContain('aria-label="返回引用 1"');
    expect(html).toContain('aria-label="返回引用 1-2"');
    expect(html).not.toContain('Back to reference');
    // The references in the prose only gain their role.
    expect(html).toContain(
      '<sup><a href="#user-content-fn-a" id="user-content-fnref-a" data-footnote-ref',
    );
    expect(html).toContain('aria-describedby="footnote-label" role="doc-noteref">1</a></sup>');
  });

  it('adds the DPUB-ARIA roles', async () => {
    const { html } = await compile(md, [footnotes()], en);
    expect(html).toContain('<section data-footnotes class="footnotes" role="doc-endnotes">');
    expect(html.match(/role="doc-noteref"/g)).toHaveLength(2);
    expect(html.match(/role="doc-backlink"/g)).toHaveLength(2);
    expect(html).not.toContain('doc-endnote"');
  });

  it('defaults to English and accepts an explicit language', async () => {
    const { html } = await compile(md, [footnotes()], en);
    expect(html).toContain('<h2 class="visually-hidden" id="footnote-label">Footnotes</h2>');
    expect(html).toContain('aria-label="Back to reference 1"');
    const forced = await compile(md, [footnotes({ lang: 'zh' })]);
    expect(forced.html).toContain('>脚注</h2>');
  });

  it('drops the anchor heading-anchors appended to the hidden heading', async () => {
    const { html } = await compile(`## Intro\n\n${md}`, [headingAnchors(), footnotes()], zh);
    expect(html).toContain('<h2 id="intro">Intro<a class="heading-anchor" href="#intro"');
    expect(html).toContain('<h2 class="visually-hidden" id="footnote-label">脚注</h2>');
    expect(html).not.toContain('href="#footnote-label"');
  });

  it('leaves documents without footnotes alone', async () => {
    const { html } = await compile('## Intro\n\n[x](#intro)\n', [footnotes()], zh);
    expect(html).toBe('<h2>Intro</h2>\n<p><a href="#intro">x</a></p>\n');
  });
});
