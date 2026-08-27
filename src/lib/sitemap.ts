/**
 * Sitemap alternates and `lastmod`, computed at build time for
 * `@astrojs/sitemap`'s `serialize` hook (astro.config.ts).
 *
 * This runs inside the Astro config, where `astro:content` is not available,
 * so the post front matter is read straight from `src/content/posts` with the
 * `yaml` package. The pairing rules are the same ones the pages use for
 * `hreflang` (`Seo.astro`): posts pair by `translationKey`, tag pages pair when
 * the tag exists in both languages, home / posts / tags lists always pair.
 * Language codes are the i18n `htmlLang` tags (`en` / `zh-Hans`) plus
 * `x-default` (the English page), exactly like the HTML `hreflang`, so both
 * signals agree page by page.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { SitemapItem } from '@astrojs/sitemap';
import { parse as parseYaml } from 'yaml';
import { otherLang, useTranslations } from '../i18n';
import { LANGS, isLang, type Lang } from '../i18n/types';
import { countTags, sameTag } from './tags';
import {
  absoluteUrl,
  homeUrl,
  postsIndexUrl,
  postUrl,
  projectsIndexUrl,
  tagsIndexUrl,
  tagUrl,
} from './url';

export interface ScannedPost {
  lang: Lang;
  /** Site path, `/zh/posts/<slug>/`. */
  path: string;
  translationKey?: string | undefined;
  tags: string[];
  date: Date;
  updated?: Date | undefined;
}

export interface PageMeta {
  /** Same page in each language, keyed by language. */
  alternates: Partial<Record<Lang, string>>;
  /** Newest change of the page content. */
  lastmod?: Date | undefined;
}

const FRONT_MATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/;

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? undefined : d;
  }
  return undefined;
}

/** Non-draft posts below `postsDir` (`<lang>/<slug>.md|mdx`, `_` files skipped). */
export function scanPosts(postsDir: string): ScannedPost[] {
  const out: ScannedPost[] = [];
  if (!fs.existsSync(postsDir)) return out;
  for (const langDir of fs.readdirSync(postsDir, { withFileTypes: true })) {
    if (!langDir.isDirectory() || !isLang(langDir.name)) continue;
    const lang = langDir.name;
    const dir = path.join(postsDir, lang);
    for (const file of fs.readdirSync(dir).toSorted()) {
      if (file.startsWith('_') || !/\.(md|mdx)$/i.test(file)) continue;
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      const raw = FRONT_MATTER.exec(source)?.[1];
      const fm = (raw ? parseYaml(raw) : {}) as Record<string, unknown>;
      if (fm.draft === true) continue;
      const date = toDate(fm.date);
      if (!date) throw new Error(`${lang}/${file}: missing or invalid date`);
      const slug =
        typeof fm.slug === 'string' && fm.slug.trim()
          ? fm.slug.trim()
          : file.replace(/\.(md|mdx)$/i, '');
      out.push({
        lang,
        path: postUrl(lang, slug),
        translationKey: typeof fm.translationKey === 'string' ? fm.translationKey : undefined,
        tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
        date,
        updated: toDate(fm.updated),
      });
    }
  }
  return out;
}

function newest(posts: readonly ScannedPost[]): Date | undefined {
  let max: Date | undefined;
  for (const p of posts) {
    const d = p.updated ?? p.date;
    if (!max || d > max) max = d;
  }
  return max;
}

/** Alternates and lastmod for every indexable page, keyed by decoded site path. */
export function buildPageMeta(posts: readonly ScannedPost[]): Map<string, PageMeta> {
  const meta = new Map<string, PageMeta>();
  const byLang = Object.fromEntries(
    LANGS.map((lang) => [lang, posts.filter((p) => p.lang === lang)]),
  ) as Record<Lang, ScannedPost[]>;

  for (const lang of LANGS) {
    const lastmod = newest(byLang[lang]);
    for (const url of [homeUrl, postsIndexUrl, projectsIndexUrl, tagsIndexUrl]) {
      meta.set(url(lang), { alternates: { en: url('en'), zh: url('zh') }, lastmod });
    }
  }

  for (const post of posts) {
    const translation = post.translationKey
      ? byLang[otherLang(post.lang)].find((p) => p.translationKey === post.translationKey)
      : undefined;
    meta.set(post.path, {
      alternates: {
        [post.lang]: post.path,
        ...(translation ? { [translation.lang]: translation.path } : {}),
      },
      lastmod: post.updated ?? post.date,
    });
  }

  const tagsByLang = Object.fromEntries(
    LANGS.map((lang) => [lang, countTags(byLang[lang].map((p) => ({ data: { tags: p.tags } })))]),
  ) as Record<Lang, ReturnType<typeof countTags>>;
  for (const lang of LANGS) {
    for (const { tag } of tagsByLang[lang]) {
      const o = otherLang(lang);
      const existsInOther = tagsByLang[o].some((t) => sameTag(t.tag, tag));
      meta.set(tagUrl(lang, tag), {
        alternates: {
          [lang]: tagUrl(lang, tag),
          ...(existsInOther ? { [o]: tagUrl(o, tag) } : {}),
        },
        lastmod: newest(byLang[lang].filter((p) => p.tags.some((t) => sameTag(t, tag)))),
      });
    }
  }
  return meta;
}

/** `xhtml:link` entries for a page, or undefined when it has no translation. */
export function alternateLinks(
  alternates: Partial<Record<Lang, string>>,
  site: string,
): { lang: string; url: string }[] | undefined {
  const present = LANGS.filter((l) => alternates[l]);
  if (present.length < 2) return undefined;
  const links = present.map((l) => ({
    lang: useTranslations(l).htmlLang,
    url: absoluteUrl(alternates[l]!, site),
  }));
  const xDefault = alternates.en ?? alternates[present[0]!]!;
  links.push({ lang: 'x-default', url: absoluteUrl(xDefault, site) });
  return links;
}

/**
 * `filter` and `serialize` callbacks for `@astrojs/sitemap`.
 *
 * `filter` keeps exactly the pages `buildPageMeta` knows (home, lists, posts,
 * tag pages): an allowlist of real pages, so alias redirect pages are out even
 * when their path looks like a post (`/zh/posts/<old Chinese slug>/`), as are
 * `/en/`, the 404 page and the feeds. `serialize` attaches `links` and
 * `lastmod`. The front matter scan is done once, on the first call (i.e. at
 * build time, not at config load).
 */
export function sitemapHooks(postsDir: string, site: string) {
  let meta: Map<string, PageMeta> | undefined;
  const pageOf = (url: string): PageMeta | undefined => {
    meta ??= buildPageMeta(scanPosts(postsDir));
    return meta.get(decodeURIComponent(new URL(url).pathname));
  };
  return {
    filter: (url: string): boolean => pageOf(url) !== undefined,
    serialize: (item: SitemapItem): SitemapItem => {
      const page = pageOf(item.url);
      if (!page) return item;
      const links = alternateLinks(page.alternates, site);
      return {
        ...item,
        ...(links ? { links } : {}),
        ...(page.lastmod ? { lastmod: page.lastmod.toISOString() } : {}),
      };
    },
  };
}
