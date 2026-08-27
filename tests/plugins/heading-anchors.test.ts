import { describe, expect, it } from 'vitest';
import { headingAnchors } from '@/plugins/heading-anchors';
import { compile } from '../helpers/satteri';

describe('heading-anchors', () => {
  it('adds github-slugger ids and appends an empty labelled anchor after the text', async () => {
    const { html } = await compile('## Hello World\n\ntext', [headingAnchors()]);
    expect(html).toContain(
      '<h2 id="hello-world">Hello World<a class="heading-anchor" href="#hello-world" aria-label="Link to this section: Hello World"></a></h2>',
    );
  });

  it('uses a trailing {#id} marker as the id and strips it from the text', async () => {
    const { html } = await compile('## 第一节 测试 {#first}\n\ntext', [headingAnchors()]);
    expect(html).toContain(
      '<h2 id="first">第一节 测试<a class="heading-anchor" href="#first" aria-label="Link to this section: 第一节 测试"></a></h2>',
    );
  });

  it('strips the marker after inline code and lowercases the id', async () => {
    const { html } = await compile('## 使用 `lldb` {#Use-LLDB}', [headingAnchors()]);
    expect(html).toContain(
      '<h2 id="use-lldb">使用 <code>lldb</code><a class="heading-anchor" href="#use-lldb" aria-label="Link to this section: 使用 lldb"></a></h2>',
    );
  });

  it('never emits non-ASCII ids: drops CJK from the slug, falls back to section-<n>', async () => {
    const { html } = await compile('## 使用 `breakpad`\n\n## 第一节 测试\n\n## Electron集成', [
      headingAnchors(),
    ]);
    expect(html).toContain('<h2 id="breakpad">');
    expect(html).toContain('<h2 id="section-1">第一节 测试');
    expect(html).toContain('<h2 id="electron">Electron集成');
    expect(html).not.toMatch(/id="[^"]*[^\x20-\x7e][^"]*"/);
  });

  it('registers explicit ids with the per-document slugger', async () => {
    const { html } = await compile('## 前言 {#intro}\n\n## Intro\n\n## 简介 {#intro}', [
      headingAnchors(),
    ]);
    expect(html).toContain('<h2 id="intro">前言');
    expect(html).toContain('<h2 id="intro-1">Intro');
    expect(html).toContain('<h2 id="intro-2">简介');
  });

  it('ignores a marker that is not at the end of the heading', async () => {
    const { html } = await compile('## {#nope} Title', [headingAnchors()]);
    expect(html).toContain('<h2 id="nope-title">{#nope} Title');
  });

  it('dedupes duplicate headings per document', async () => {
    const md = '## Same\n\n## Same\n\n### Same';
    const { html } = await compile(md, [headingAnchors()]);
    expect(html).toContain('id="same"');
    expect(html).toContain('id="same-1"');
    expect(html).toContain('id="same-2"');
  });

  it('starts a fresh slugger for each document', async () => {
    const plugin = headingAnchors();
    const a = await compile('## Same', [plugin]);
    const b = await compile('## Same', [plugin]);
    expect(a.html).toContain('id="same"');
    expect(b.html).toContain('id="same"');
    expect(b.html).not.toContain('same-1');
  });

  it('never nests links: the anchor follows a link inside the heading', async () => {
    const { html } = await compile('## See [docs](https://example.com)', [headingAnchors()]);
    expect(html).toContain('<h2 id="see-docs">');
    expect(html).toContain(
      '<a href="https://example.com">docs</a><a class="heading-anchor" href="#see-docs" aria-label="Link to this section: See docs"></a>',
    );
    // no <a> nested in another <a>
    expect(html).not.toMatch(/<a[^>]*>[^<]*<a /);
  });

  it('labels the anchor in the language of the document path', async () => {
    const zh = await compile(
      '## 第一节',
      [headingAnchors()],
      new URL('file:///site/src/content/posts/zh/a.md'),
    );
    expect(zh.html).toContain('aria-label="本节链接: 第一节"');
    const en = await compile(
      '## Section',
      [headingAnchors()],
      new URL('file:///site/src/content/posts/en/a.md'),
    );
    expect(en.html).toContain('aria-label="Link to this section: Section"');
    const custom = await compile('## Section', [headingAnchors({ label: 'Anchor' })]);
    expect(custom.html).toContain('aria-label="Anchor: Section"');
  });

  it('falls back to section-<n> when the text slugs to nothing', async () => {
    const { html } = await compile('## ???\n\n## !!!\n\n## section-1', [headingAnchors()]);
    expect(html).toContain('<h2 id="section-1">???<a class="heading-anchor" href="#section-1"');
    expect(html).toContain('<h2 id="section-2">!!!<a class="heading-anchor" href="#section-2"');
    // a real heading that collides with the fallback is still deduped
    expect(html).toContain('<h2 id="section-1-1">');
    expect(html).not.toContain('id="-1"');
  });

  it('keeps an existing id', async () => {
    const { html } = await compile('<h2 id="custom">Custom</h2>', [headingAnchors()]);
    expect(html).toContain('id="custom"');
  });
});
