import type { Element } from 'hast';
import { defineHastPlugin } from 'satteri';
import { useTranslations } from '../i18n';
import type { Lang } from '../i18n/types';
import { langOfFile } from './lang';

/**
 * Sätteri HAST plugin: the GFM footnotes section in the document's language.
 *
 * Sätteri renders `[^id]` footnotes the way GitHub does: `<sup><a
 * data-footnote-ref>` in the prose and, at the end of the document, `<section
 * data-footnotes class="footnotes">` with a hidden `<h2 id="footnote-label"
 * class="sr-only">Footnotes</h2>`, an `<ol>` of notes and a `↩` back link
 * (`aria-label="Back to reference 1"`) after each note. Those strings are
 * English and the class is GitHub's, so this plugin
 *
 * - sets the heading text and the back link `aria-label` from the UI strings
 *   of the document's language (`post.footnotes`, `post.backToReference`;
 *   `/en/` or `/zh/` segment of `ctx.fileURL`, or the `lang` option),
 * - swaps `sr-only` for the site's `visually-hidden`,
 * - removes the `.heading-anchor` that `heading-anchors` (earlier in the
 *   chain) appended to the hidden heading: there is nothing to hover (the
 *   TOC skips the heading by id, see lib/toc.ts),
 * - adds the DPUB-ARIA roles: `doc-noteref` on the reference, `doc-endnotes`
 *   on the section, `doc-backlink` on the back link (`doc-endnote` is
 *   deprecated in DPUB-ARIA 1.1, the `<li>` stays a plain list item).
 *
 * On wide screens Sidenotes.astro turns the section into a column of notes in
 * the right margin; the markup here is the same either way.
 *
 * Documents without footnotes are left untouched.
 */

export interface FootnotesOptions {
  /** Language of the strings; defaults to the language of `ctx.fileURL`. */
  lang?: Lang;
}

/** Id Sätteri gives the footnotes heading (`aria-describedby` of every reference). */
export const FOOTNOTE_LABEL_ID = 'footnote-label';
const GITHUB_HIDDEN_CLASS = 'sr-only';
const HIDDEN_CLASS = 'visually-hidden';
const ANCHOR_CLASS = 'heading-anchor';
/** Trailing `1` or `1-2` of the default back link label (`Back to reference 1-2`). */
const REFERENCE_RE = /(\d+(?:-\d+)?)\s*$/;

function classList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function hasData(node: Element, camel: string, kebab: string): boolean {
  return camel in node.properties || kebab in node.properties;
}

export function footnotes(options: FootnotesOptions = {}) {
  return defineHastPlugin({
    name: 'blog-footnotes',
    element: {
      filter: ['h2', 'a', 'section'],
      visit(node, ctx) {
        const t = () => useTranslations(options.lang ?? langOfFile(ctx.fileURL)).post;

        if (node.tagName === 'section') {
          if (hasData(node, 'dataFootnotes', 'data-footnotes'))
            ctx.setProperty(node, 'role', 'doc-endnotes');
          return;
        }

        if (node.tagName === 'h2') {
          if (node.properties.id !== FOOTNOTE_LABEL_ID) return;
          const classes = classList(node.properties.className).map((c) =>
            c === GITHUB_HIDDEN_CLASS ? HIDDEN_CLASS : c,
          );
          if (!classes.includes(HIDDEN_CLASS)) classes.push(HIDDEN_CLASS);
          ctx.setProperty(node, 'className', classes);
          // One text child with the localised label; the anchor goes too
          // (mutations are queued by ctx, so iterating children is safe).
          for (const child of node.children) {
            const isAnchor =
              child.type === 'element' &&
              classList(child.properties.className).includes(ANCHOR_CLASS);
            if (child.type === 'text' || isAnchor) ctx.removeNode(child);
          }
          ctx.appendChild(node, { type: 'text', value: t().footnotes });
          return;
        }

        if (hasData(node, 'dataFootnoteRef', 'data-footnote-ref')) {
          ctx.setProperty(node, 'role', 'doc-noteref');
          return;
        }
        if (!hasData(node, 'dataFootnoteBackref', 'data-footnote-backref')) return;
        ctx.setProperty(node, 'role', 'doc-backlink');
        const current = node.properties.ariaLabel;
        const ref = typeof current === 'string' ? REFERENCE_RE.exec(current)?.[1] : undefined;
        if (!ref) return;
        ctx.setProperty(node, 'ariaLabel', t().backToReference(ref));
      },
    },
  });
}
