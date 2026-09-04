import { describe, expect, it } from 'vitest';
import { codeTabs } from '@/plugins/code-tabs';
import { compile } from '../helpers/satteri';

const F = '```';
const fence = (title: string, body: string, meta = 'group') =>
  `${F}cpp${title ? ` title="${title}"` : ''} ${meta}\n${body}\n${F}`;

describe('code-tabs', () => {
  it('turns adjacent group fences into one tabbed block', async () => {
    const md = `before\n\n${fence('a.h', 'int a;')}\n\n${fence('b.h', 'int b;')}\n\nafter`;
    const { html } = await compile(md, [codeTabs()]);
    expect(html).toBe(
      '<p>before</p>\n' +
        '<div class="code-tabs" data-group="1">' +
        "<style>.code-tabs[data-group='1']:has(input[value='1']:checked)>[data-tab='1']{display:block}.code-tabs[data-group='1']:has(input[value='2']:checked)>[data-tab='2']{display:block}</style>" +
        '<div class="code-tabs-bar">' +
        '<label><input type="radio" name="code-tabs-1" value="1" checked>a.h</label>' +
        '<label><input type="radio" name="code-tabs-1" value="2">b.h</label>' +
        '</div>' +
        '<div class="code-tabs-panel" data-tab="1"><pre><code class="language-cpp">int a;\n</code></pre></div>' +
        '<div class="code-tabs-panel" data-tab="2"><pre><code class="language-cpp">int b;\n</code></pre></div>' +
        '</div>\n' +
        '<p>after</p>\n',
    );
  });

  it('keeps the fence meta for Expressive Code', async () => {
    const md = `${fence('a.h', 'int a;', 'group {1}')}\n\n${fence('b.h', 'int b;', 'ins={1} group')}`;
    const seen: string[] = [];
    const reader = () => ({
      name: 'test-reader',
      element: {
        filter: ['code'],
        visit(node: { data?: { meta?: unknown } }) {
          seen.push(String(node.data?.meta));
        },
      },
    });
    await compile(md, [codeTabs(), reader]);
    expect(seen).toEqual(['title="a.h" group {1}', 'title="b.h" ins={1} group']);
  });

  it('numbers groups per document and separates runs', async () => {
    const md = [fence('a', '1'), fence('b', '2'), 'text', fence('c', '3'), fence('d', '4')].join(
      '\n\n',
    );
    const { html } = await compile(md, [codeTabs()]);
    expect(html.match(/name="code-tabs-1"/g)).toHaveLength(2);
    expect(html.match(/name="code-tabs-2"/g)).toHaveLength(2);
    expect(html).toContain('<p>text</p>');
  });

  it('labels a fence without a title by its language', async () => {
    const md = `${fence('', 'a')}\n\n\`\`\`js group\nb\n\`\`\``;
    const { html } = await compile(md, [codeTabs()]);
    expect(html).toContain('value="1" checked>cpp</label>');
    expect(html).toContain('value="2">js</label>');
  });

  it('leaves a lone group fence and untagged neighbours alone', async () => {
    const md = `${fence('a.h', 'int a;')}\n\n\`\`\`cpp title="b.h"\nint b;\n\`\`\``;
    const { html } = await compile(md, [codeTabs()]);
    expect(html).not.toContain('code-tabs');
    expect(html.match(/<pre>/g)).toHaveLength(2);
  });

  it('emits a show rule for a ninth tab', async () => {
    const md = Array.from({ length: 9 }, (_, i) => fence(String(i + 1), 'x')).join('\n\n');
    const { html } = await compile(md, [codeTabs()]);
    expect(html.match(/name="code-tabs-1"/g)).toHaveLength(9);
    expect(html).toContain('data-tab="9"');
    expect(html).toContain("[data-tab='9']{display:block}");
  });

  it('does not match group inside another word or value', async () => {
    const md = `\`\`\`cpp title="group.h" subgroup\na\n\`\`\`\n\n\`\`\`cpp regroup\nb\n\`\`\``;
    const { html } = await compile(md, [codeTabs()]);
    expect(html).not.toContain('code-tabs');
  });
});
