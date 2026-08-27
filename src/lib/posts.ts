import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { isLang, LANGS, type Lang } from '@/i18n/types';
import { langFromPath } from '@/i18n';
import { byDateDesc } from './dates';
import { excerpt } from './excerpt';
import { countTags, sameTag, type TagInfo } from './tags';
import {
  aliasParam,
  EXTRA_ALIASES,
  feedUrl,
  homeUrl,
  llmsFullUrl,
  llmsUrl,
  postMarkdownUrl,
  postsIndexUrl,
  postUrl,
  projectsIndexUrl,
  rootFormOfAlias,
  tagsIndexUrl,
  tagUrl,
  withTrailingSlash,
} from './url';

export type Post = CollectionEntry<'posts'>;
export type Page = CollectionEntry<'pages'>;

/** Language of a post, taken from the first id segment (`en/...`, `zh/...`). */
export function langOf(post: Pick<Post, 'id'>): Lang {
  const seg = post.id.split('/')[0] ?? '';
  if (!isLang(seg)) throw new Error(`Post id "${post.id}" does not start with a language`);
  return seg;
}

/** URL slug of a post: everything after the language segment, verbatim. */
export function slugOf(post: Pick<Post, 'id'>): string {
  return post.id.slice(post.id.indexOf('/') + 1);
}

/** Site path of a post: `/posts/<slug>/` or `/zh/posts/<slug>/`. */
export function pathOf(post: Pick<Post, 'id'>): string {
  return postUrl(langOf(post), slugOf(post));
}

/** Meta description: explicit `description` or an auto excerpt of the body. */
export function descriptionOf(post: Post): string {
  return post.data.description?.trim() || excerpt(post.body) || post.data.title;
}

/** Non-draft posts of one language, newest first. */
export async function getPosts(lang: Lang): Promise<Post[]> {
  const all = await getCollection(
    'posts',
    ({ id, data }) => !data.draft && id.startsWith(`${lang}/`),
  );
  return all.toSorted(byDateDesc);
}

/** All non-draft posts in both languages, newest first. */
export async function getAllPosts(): Promise<Post[]> {
  const all = await getCollection('posts', ({ data }) => !data.draft);
  return all.toSorted(byDateDesc);
}

/** The other-language version of a post (matched by `translationKey`). */
export async function getTranslation(post: Post): Promise<Post | undefined> {
  const key = post.data.translationKey;
  if (!key) return undefined;
  const other: Lang = langOf(post) === 'en' ? 'zh' : 'en';
  const matches = await getCollection(
    'posts',
    (p) => !p.data.draft && p.id.startsWith(`${other}/`) && p.data.translationKey === key,
  );
  return matches[0];
}

/** Previous (older) and next (newer) post in the same language. */
export async function getAdjacent(
  post: Post,
): Promise<{ prev?: Post | undefined; next?: Post | undefined }> {
  const posts = await getPosts(langOf(post));
  const i = posts.findIndex((p) => p.id === post.id);
  if (i === -1) return {};
  return { next: posts[i - 1], prev: posts[i + 1] };
}

/** Tags of one language with counts, most used first. */
export async function getTags(lang: Lang): Promise<TagInfo[]> {
  return countTags(await getPosts(lang));
}

/** Posts of one language carrying `tag` (case-insensitive). */
export async function getPostsByTag(lang: Lang, tag: string): Promise<Post[]> {
  const posts = await getPosts(lang);
  return posts.filter((p) => p.data.tags.some((t) => sameTag(t, tag)));
}

/** A `pages` collection entry such as `en/home`. */
export async function getPage(lang: Lang, name: string): Promise<Page | undefined> {
  return getEntry('pages', `${lang}/${name}`);
}

/** One redirect page emitted by `src/pages/[...alias].astro`. */
export interface AliasRedirect {
  /** Route param without leading/trailing slashes (`zh/p/x`). */
  param: string;
  /** Site path of the redirect target (`/zh/posts/x/`). */
  to: string;
  /** Language of the redirect page (`<html lang>`). */
  lang: Lang;
}

/**
 * Every alias redirect: each post's front matter aliases (already prefixed
 * like `/zh/p/x/`), the un-prefixed root forms of language-prefixed aliases
 * (`/p/x/`), plus the fixed extras (`/en/` -> `/`). Throws at build time when
 * an alias would overwrite a real page or when two posts claim the same alias.
 */
export async function getAliasRedirects(): Promise<AliasRedirect[]> {
  const posts = await getAllPosts();
  const real = new Set<string>();
  const tagsByLang = await Promise.all(LANGS.map((lang) => getTags(lang)));
  LANGS.forEach((lang, i) => {
    real.add(homeUrl(lang));
    real.add(postsIndexUrl(lang));
    real.add(projectsIndexUrl(lang));
    real.add(tagsIndexUrl(lang));
    real.add(feedUrl(lang));
    for (const tag of tagsByLang[i] ?? []) real.add(tagUrl(lang, tag.tag));
  });
  for (const post of posts) {
    real.add(pathOf(post));
    real.add(postMarkdownUrl(langOf(post), slugOf(post)));
  }
  for (const fixed of [
    '/robots.txt',
    llmsUrl(),
    llmsFullUrl(),
    '/404.html',
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/sitemap-0.xml',
  ]) {
    real.add(fixed);
  }

  const byParam = new Map<string, AliasRedirect>();
  const add = (from: string, to: string, lang: Lang) => {
    const param = aliasParam(from);
    if (!param) throw new Error(`Empty alias for ${to}`);
    const asPath = withTrailingSlash(`/${param}`);
    if (real.has(asPath) || real.has(`/${param}`)) {
      throw new Error(`Alias "${from}" collides with the real page ${asPath}`);
    }
    const existing = byParam.get(param);
    if (existing && existing.to !== to) {
      throw new Error(`Alias "${from}" points at both ${existing.to} and ${to}`);
    }
    byParam.set(param, { param, to, lang });
  };

  for (const post of posts) {
    const lang = langOf(post);
    for (const alias of post.data.aliases) {
      add(alias, pathOf(post), lang);
      const root = rootFormOfAlias(alias);
      if (root) add(root, pathOf(post), lang);
    }
  }
  for (const extra of EXTRA_ALIASES) add(extra.from, extra.to, langFromPath(extra.to));

  return [...byParam.values()].toSorted((a, b) => a.param.localeCompare(b.param));
}
