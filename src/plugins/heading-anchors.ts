import type { Element, Text } from 'hast';
import GithubSlugger, { slug as slugify } from 'github-slugger';
import { defineHastPlugin, type HastPluginDefinition } from 'satteri';
import { useTranslations } from '../i18n';
import { langOfFile } from './lang';

/**
 * Sätteri HAST plugin: stable ASCII heading ids plus an anchor link.
 *
 * - Ids are ASCII only, so a fragment URL stays short (`#intro` rather than
 *   `#%E5%89%8D%E8%A8%80`). A heading names its own id with a trailing
 *   `{#custom-id}` marker (`\{#custom-id\}` in MDX, where a bare `{` starts an
 *   expression); the marker is removed from the heading text, so the TOC, the
 *   accessible name and the feeds never show it. Without a marker the id is the
 *   github-slugger slug of the text (the algorithm Astro uses) with every
 *   non-ASCII character dropped (`使用 breakpad` -> `breakpad`); a heading left
 *   with nothing (`## 前言`, `## ???`) gets `section-<n>`. That fallback
 *   renumbers whenever a heading is inserted, so tests/content.test.ts requires
 *   an explicit id for every heading whose slug is not ASCII already.
 * - A fresh slugger is created per document, which keeps duplicate ids unique
 *   (`foo`, `foo-1`, ...); explicit and pre-existing ids are registered with it
 *   too. Astro's own heading-ids plugin runs later and respects the id we set,
 *   so `render()` reports the same slugs (and the text without the marker).
 * - An empty `<a class="heading-anchor" href="#id" aria-label="...">` is
 *   appended after the heading text (bun.com/blog style). The heading text
 *   itself is not a link, so the heading keeps its own accessible name and a
 *   heading that already contains a link never nests interactive content. The
 *   visible `#` is CSS content (typography.css), shown while the heading is
 *   hovered or the link focused, so feed readers and the TOC see no `#`. The
 *   `aria-label` (`Link to this section: <text>`) comes from the UI strings of
 *   the document's language (`/en/` or `/zh/` segment of `ctx.fileURL`,
 *   default en).
 */

export interface HeadingAnchorsOptions {
  /** Heading tags to process. Defaults to h1..h6. */
  tags?: string[];
  /** Class name for the anchor element. */
  className?: string;
  /** `aria-label` prefix of the anchor (overrides i18n). */
  label?: string;
}

const DEFAULT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

/** Trailing `{#id}` marker of a heading text (`\{#id\}` in MDX arrives as `{#id}`). */
export const EXPLICIT_ID_RE = /\s*\{#([A-Za-z0-9][\w-]*)\}\s*$/;

/** github-slugger slug with non-ASCII characters dropped and `-` runs collapsed. */
export function asciiSlug(text: string): string {
  return slugify(text)
    .replace(/[^\x20-\x7e]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function headingAnchors(options: HeadingAnchorsOptions = {}) {
  const tags = options.tags ?? DEFAULT_TAGS;
  const className = options.className ?? 'heading-anchor';

  // A factory so every document gets its own slugger instance.
  return (): HastPluginDefinition => {
    const slugger = new GithubSlugger();
    let unnamed = 0;
    return defineHastPlugin({
      name: 'blog-heading-anchors',
      element: {
        filter: tags,
        visit(node, ctx) {
          let text = ctx.textContent(node);

          // The `{#id}` marker sits in the trailing text children of the
          // heading (MDX may split the escaped braces over several text nodes,
          // hence the join). They are replaced by one text node without it.
          const trailing: Text[] = [];
          for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i]!;
            if (child.type !== 'text') break;
            trailing.unshift(child);
          }
          const joined = trailing.map((t) => t.value).join('');
          const marker = EXPLICIT_ID_RE.exec(joined);
          const explicit = marker?.[1] ?? '';
          if (marker) {
            text = text.replace(EXPLICIT_ID_RE, '');
            for (const t of trailing) ctx.removeNode(t);
            const rest = joined.slice(0, marker.index);
            if (rest) ctx.appendChild(node, { type: 'text', value: rest });
          }
          text = text.trim();

          const existing = node.properties.id;
          let id: string;
          if (typeof existing === 'string' && existing.length > 0) {
            id = existing;
            slugger.slug(existing);
          } else {
            id = slugger.slug(explicit || asciiSlug(text) || `section-${++unnamed}`);
            ctx.setProperty(node, 'id', id);
          }

          const label =
            options.label ?? useTranslations(langOfFile(ctx.fileURL)).post.linkToSection;
          const link: Element = {
            type: 'element',
            tagName: 'a',
            properties: { className: [className], href: `#${id}`, ariaLabel: `${label}: ${text}` },
            children: [],
          };
          ctx.appendChild(node, link);
        },
      },
    });
  };
}
