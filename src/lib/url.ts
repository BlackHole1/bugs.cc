import type { Lang } from '@/i18n/types';
import { SITE } from './site';
import { tagSlug } from './tags';

/** `''` for the default locale, `/zh` for Chinese. */
export function localePrefix(lang: Lang): string {
  return lang === 'en' ? '' : `/${lang}`;
}

export function withTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : `${p}/`;
}

export function homeUrl(lang: Lang): string {
  return `${localePrefix(lang)}/`;
}

export function postsIndexUrl(lang: Lang): string {
  return `${localePrefix(lang)}/posts/`;
}

export function postUrl(lang: Lang, slug: string): string {
  return `${localePrefix(lang)}/posts/${slug}/`;
}

export function projectsIndexUrl(lang: Lang): string {
  return `${localePrefix(lang)}/projects/`;
}

export function tagsIndexUrl(lang: Lang): string {
  return `${localePrefix(lang)}/tags/`;
}

export function tagUrl(lang: Lang, tag: string): string {
  return `${localePrefix(lang)}/tags/${tagSlug(tag)}/`;
}

export function feedUrl(lang: Lang): string {
  return `${localePrefix(lang)}/index.xml`;
}

/** `/llms.txt`: index of the site for LLM tooling (`lib/llms.ts`). */
export function llmsUrl(): string {
  return '/llms.txt';
}

/** `/llms-full.txt`: full text of every post, one file. */
export function llmsFullUrl(): string {
  return '/llms-full.txt';
}

/** Markdown copy of a post: `/posts/<slug>/index.md` (`lib/llms.ts`). */
export function postMarkdownUrl(lang: Lang, slug: string): string {
  return `${postUrl(lang, slug)}index.md`;
}

/** Absolute URL for a site path. Non-ASCII paths (Chinese aliases) are percent-encoded by `URL`. */
export function absoluteUrl(path: string, site: URL | string = SITE.url): string {
  return new URL(path, site).href;
}

/**
 * X "post" intent with `text` pre-filled: the "Reply to this post on X" link
 * at the end of a post (the text is `post.replyText` of the UI strings).
 *
 * The path keeps a trailing slash on purpose. AdGuard's "Social media" filter
 * (also shipped in uBlock Origin as "AdGuard Social" and bundled into AdGuard
 * Annoyances) hides every `a[href^="https://x.com/intent/post?"]` on every
 * site, which makes the link vanish in browsers running that list. X serves
 * `/intent/post/?text=` identically (compose dialog with the text filled in),
 * while the prefix rule does not match it.
 */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post/?text=${encodeURIComponent(text)}`;
}

/**
 * Fixed redirects that are not derived from post front matter (SPEC 5.1/5.3).
 * `/sitemap.xml` is not an alias: it is a real XML endpoint (`pages/sitemap.xml.ts`).
 */
export const EXTRA_ALIASES: ReadonlyArray<{ from: string; to: string }> = [
  { from: '/en/', to: '/' },
];

/**
 * Route param for an alias path: leading and trailing slashes stripped
 * (`/zh/p/x/` -> `zh/p/x`), so `[...alias].astro` emits `/zh/p/x/`.
 */
export function aliasParam(alias: string): string {
  return alias.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * The un-prefixed root form of a language-prefixed alias:
 * `/zh/p/x/` -> `/p/x/`. Returns undefined when the alias has no prefix.
 */
export function rootFormOfAlias(alias: string): string | undefined {
  const m = /^\/(en|zh)(\/.+)$/.exec(alias.trim());
  return m ? m[2] : undefined;
}
