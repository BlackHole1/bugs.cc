import type { Element } from 'hast';
import { defineHastPlugin } from 'satteri';
import { useTranslations } from '../i18n';
import { langOfFile } from './lang';

/**
 * Sätteri HAST plugin: open external `http(s)` links in a new tab with
 * `rel="noopener noreferrer"`, and tell the reader so: a visually hidden
 * `(opens in a new tab)` (in the document's language, WCAG G201) is appended
 * to the link text; typography.css adds the matching icon. Links to the site
 * itself and relative links are left untouched.
 */

export interface ExternalLinksOptions {
  /** Hostnames treated as internal (exact match, case-insensitive). */
  internalHosts?: string[];
  /** Value for `target`. Defaults to `_blank`. */
  target?: string;
  /** `rel` tokens to add. Defaults to `noopener noreferrer`. */
  rel?: string[];
  /**
   * Visually hidden hint appended to the link text; `false` for none. Defaults
   * to `(<nav.externalLink>)` of the document's language.
   */
  hint?: false | ((lang: 'en' | 'zh') => string);
}

const DEFAULT_INTERNAL_HOSTS = ['bugs.cc', 'www.bugs.cc'];
const HINT_CLASS = 'visually-hidden';

/** Returns true when `href` points outside the site (http/https only). */
export function isExternalHref(href: string, internalHosts: readonly string[]): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return !internalHosts.some((h) => h.toLowerCase() === host);
}

function toTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function defaultHint(lang: 'en' | 'zh'): string {
  return `(${useTranslations(lang).nav.externalLink})`;
}

export function externalLinks(options: ExternalLinksOptions = {}) {
  const internalHosts = options.internalHosts ?? DEFAULT_INTERNAL_HOSTS;
  const target = options.target ?? '_blank';
  const rel = options.rel ?? ['noopener', 'noreferrer'];
  const hint = options.hint ?? defaultHint;

  return defineHastPlugin({
    name: 'blog-external-links',
    element: {
      filter: ['a'],
      visit(node, ctx) {
        const href = node.properties.href;
        if (typeof href !== 'string' || !isExternalHref(href, internalHosts)) return;
        ctx.setProperty(node, 'target', target);
        const merged = new Set([...toTokens(node.properties.rel), ...rel]);
        ctx.setProperty(node, 'rel', [...merged].join(' '));
        if (hint === false) return;
        const span: Element = {
          type: 'element',
          tagName: 'span',
          properties: { className: [HINT_CLASS] },
          children: [{ type: 'text', value: ` ${hint(langOfFile(ctx.fileURL))}` }],
        };
        ctx.appendChild(node, span);
      },
    },
  });
}
