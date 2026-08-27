import rss, { type RSSFeedItem } from '@astrojs/rss';
import type { APIContext } from 'astro';
import { defineHastPlugin, markdownToHtml } from 'satteri';
import { useTranslations, type Lang } from '@/i18n';
import { mdxToMarkdown } from './mdx';
import { footnotes } from '@/plugins/footnotes';
import { descriptionOf, getPosts, langOf, pathOf, type Post } from './posts';
import { RSS_EDITOR, SITE } from './site';
import { absoluteUrl, feedUrl, homeUrl } from './url';

/** Remove characters that are illegal in XML 1.0 (except tab, LF, CR). */
// oxlint-disable-next-line no-control-regex -- matching control characters is the point
const XML_ILLEGAL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]', 'g');

export function stripControlChars(s: string): string {
  return s.replace(XML_ILLEGAL, '');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Channel-level custom XML, emitted before the first `<item>`. */
export function channelCustomData(lang: Lang, site: string): string {
  const t = useTranslations(lang);
  const self = absoluteUrl(feedUrl(lang), site);
  return [
    `<language>${t.rssLanguage}</language>`,
    `<copyright>${escapeXml(SITE.copyright)}</copyright>`,
    `<managingEditor>${escapeXml(RSS_EDITOR)}</managingEditor>`,
    `<webMaster>${escapeXml(RSS_EDITOR)}</webMaster>`,
    `<atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml"/>`,
    `<follow_challenge><feedId>${SITE.follow.feedIds[lang]}</feedId><userId>${SITE.follow.userId}</userId></follow_challenge>`,
  ].join('');
}

/** Attributes that may carry a root-relative URL and must become absolute in a feed. */
const URL_ATTRIBUTES = ['href', 'src', 'poster'] as const;

/**
 * Sätteri HAST plugin: rewrite root-relative `href`/`src` (`/images/x.png`)
 * to absolute URLs so feed readers resolve them, and in-page fragment links
 * (`#section`) to `<pagePath>#section` when `pagePath` is given (feeds have
 * no `xml:base`, so readers would otherwise resolve them against the feed
 * URL). Protocol-relative (`//`) and absolute URLs are left alone.
 */
export function absoluteUrls(site: string, pagePath?: string) {
  return defineHastPlugin({
    name: 'feed-absolute-urls',
    element: {
      filter: ['a', 'img', 'source', 'video', 'audio', 'iframe'],
      visit(node, ctx) {
        for (const name of URL_ATTRIBUTES) {
          const value = node.properties[name];
          if (typeof value !== 'string') continue;
          if (value.startsWith('/') && !value.startsWith('//')) {
            ctx.setProperty(node, name, absoluteUrl(value, site));
          } else if (pagePath && value.startsWith('#')) {
            ctx.setProperty(node, name, `${absoluteUrl(pagePath, site)}${value}`);
          }
        }
      },
    },
  });
}

/**
 * Render a post body to standalone HTML for `<content:encoded>`: Sätteri with
 * GFM and smart punctuation like the site, but without Expressive Code (plain
 * `<pre><code>` blocks), with every root-relative URL made absolute, the
 * footnotes section labelled in the post's language and XML control
 * characters removed.
 */
export async function renderFeedHtml(
  post: Pick<Post, 'id' | 'body' | 'filePath'>,
  site: string,
): Promise<string> {
  const isMdx = post.filePath?.endsWith('.mdx') ?? false;
  const source = isMdx ? mdxToMarkdown(post.body ?? '') : (post.body ?? '');
  const { html } = await markdownToHtml(source, {
    hastPlugins: [absoluteUrls(site, pathOf(post)), footnotes({ lang: langOf(post) })],
    features: { gfm: true, smartPunctuation: true, frontmatter: false },
  });
  return stripControlChars(html);
}

/** Build the RSS 2.0 feed for one language, items with full content. */
export async function buildFeed(lang: Lang, context: APIContext): Promise<Response> {
  const site = (context.site ?? new URL(SITE.url)).href;
  const posts = await getPosts(lang);
  const items: RSSFeedItem[] = await Promise.all(
    posts.map(async (post) => ({
      title: stripControlChars(post.data.title),
      link: pathOf(post),
      pubDate: post.data.date,
      description: stripControlChars(descriptionOf(post)),
      content: await renderFeedHtml(post, site),
      categories: post.data.tags.map((tag) => tag.toLowerCase()),
      author: RSS_EDITOR,
    })),
  );

  return rss({
    title: SITE.title,
    description: SITE.description,
    // Channel <link> is the language home (`https://bugs.cc/zh/`), as in the old feed.
    site: absoluteUrl(homeUrl(lang), site),
    trailingSlash: true,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: channelCustomData(lang, site),
    items,
  });
}
