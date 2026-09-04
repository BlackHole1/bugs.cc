import type { Element, ElementContent, Parents, RootContent } from 'hast';
import { defineHastPlugin, type HastPluginDefinition } from 'satteri';

/**
 * Sätteri HAST plugin: adjacent fenced code blocks tagged `group` become one
 * tabbed block.
 *
 * Expressive Code has no code-group feature (astro-expressive-code#22 was
 * closed into discussion #388 without an implementation), so this runs before
 * its plugin and only rearranges the tree: the fences stay `pre > code` nodes
 * with their `data.meta`, and EC renders each of them as usual inside its own
 * panel. `group` itself is left in the meta: EC parses a bare word as a boolean
 * option and no EC plugin reads the key `group`.
 *
 * ```md
 * ```cpp title="v8/src/objects/string.h" group
 * ...
 * ```
 * ```cpp title="v8/src/strings/unicode.h" group
 * ...
 * ```
 * ```
 *
 * A run of two or more consecutive `group` fences (only blank lines between
 * them) is replaced by
 *
 * ```html
 * <div class="code-tabs">
 *   <div class="code-tabs-bar">
 *     <label><input type="radio" name="code-tabs-1" value="1" checked>v8/src/objects/string.h</label>
 *     <label><input type="radio" name="code-tabs-1" value="2">v8/src/strings/unicode.h</label>
 *   </div>
 *   <div class="code-tabs-panel" data-tab="1"><pre>...</pre></div>
 *   <div class="code-tabs-panel" data-tab="2"><pre>...</pre></div>
 * </div>
 * ```
 *
 * The tab label is the fence `title`, or the language when there is none. The
 * switching is CSS only: code.css hides every panel once a radio is checked,
 * and each group carries a `<style>` with one `:has` rule per tab so any
 * length of run can be selected. Radio buttons in labels are keyboard
 * reachable (arrow keys move between tabs) and need no script; a browser
 * without `:has` shows every panel. A lone `group` fence is left alone, so a
 * block can carry the tag before its sibling is written.
 */

/** Bare `group` word in a fence meta (`title="x" group`, `group {1-3}`). */
const GROUP_RE = /(?:^|\s)group(?=\s|$)/;
/** The `title` option of a fence meta: `title="x"`, `title='x'`, `title=x`. */
const TITLE_RE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/;

interface GroupedFence {
  pre: Element;
  label: string;
}

function isWhitespaceText(node: RootContent): boolean {
  return node.type === 'text' && node.value.trim() === '';
}

/** The `code` child of a fenced block and its meta, or `undefined` for other `pre`s. */
function fenceMeta(pre: Element): { code: Element; meta: string } | undefined {
  const code = pre.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
  const meta = code?.data?.meta;
  return code && typeof meta === 'string' ? { code, meta } : undefined;
}

/** `pre` that is a `group` fence, with its tab label. */
function groupedFence(node: RootContent): GroupedFence | undefined {
  if (node.type !== 'element' || node.tagName !== 'pre') return undefined;
  const fence = fenceMeta(node);
  if (!fence || !GROUP_RE.test(fence.meta)) return undefined;
  const title = TITLE_RE.exec(fence.meta);
  const lang = (fence.code.properties.className as string[] | undefined)
    ?.find((c) => c.startsWith('language-'))
    ?.slice('language-'.length);
  return { pre: node, label: title?.[1] ?? title?.[2] ?? title?.[3] ?? lang ?? '' };
}

/** Deep copy of a node: the originals are removed, and a node placed as new
 *  content must not be one the same pass also removes. `data` survives. */
function clone<T>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

/** One `:has` rule per tab, scoped to this group, so a ninth panel still shows. */
function panelShowRules(group: number, count: number): string {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return `.code-tabs[data-group='${group}']:has(input[value='${n}']:checked)>[data-tab='${n}']{display:block}`;
  }).join('');
}

function buildTabs(fences: GroupedFence[], group: number): Element {
  const name = `code-tabs-${group}`;
  const labels: ElementContent[] = fences.map(({ label }, i) => ({
    type: 'element',
    tagName: 'label',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'input',
        properties: { type: 'radio', name, value: String(i + 1), checked: i === 0 },
        children: [],
      },
      { type: 'text', value: label || `${i + 1}` },
    ],
  }));
  const panels: ElementContent[] = fences.map(({ pre }, i) => ({
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-tabs-panel'], dataTab: String(i + 1) },
    children: [clone(pre)],
  }));
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-tabs'], dataGroup: String(group) },
    children: [
      {
        type: 'element',
        tagName: 'style',
        properties: {},
        children: [{ type: 'text', value: panelShowRules(group, fences.length) }],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-tabs-bar'] },
        children: labels,
      },
      ...panels,
    ],
  };
}

export function codeTabs() {
  return (): HastPluginDefinition =>
    defineHastPlugin({
      name: 'blog-code-tabs',
      after(root, ctx) {
        let group = 0;
        const walk = (parent: Parents): void => {
          const children = parent.children as RootContent[];
          let i = 0;
          while (i < children.length) {
            const first = groupedFence(children[i]!);
            if (!first) {
              const child = children[i]!;
              if (child.type === 'element') walk(child);
              i++;
              continue;
            }
            // Collect the run: `group` fences separated only by whitespace.
            const run: GroupedFence[] = [first];
            const between: RootContent[] = [];
            let j = i + 1;
            while (j < children.length) {
              const node = children[j]!;
              if (isWhitespaceText(node)) {
                between.push(node);
                j++;
                continue;
              }
              const next = groupedFence(node);
              if (!next) break;
              run.push(next);
              j++;
            }
            if (run.length > 1) {
              // Whitespace after the last fence of the run stays in `between`
              // only when it was followed by a fence, so trailing whitespace
              // between the block and the next paragraph is kept.
              const lastPre = run[run.length - 1]!.pre;
              const lastIndex = children.indexOf(lastPre);
              ctx.replaceNode(first.pre, buildTabs(run, ++group));
              for (const { pre } of run.slice(1)) ctx.removeNode(pre);
              for (const node of between)
                if (children.indexOf(node) < lastIndex) ctx.removeNode(node);
              i = lastIndex + 1;
            } else {
              i++;
            }
          }
        };
        walk(root);
      },
    });
}
