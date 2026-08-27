/**
 * `/llms.txt`, `/llms-full.txt` and the Markdown copy of every post
 * (`<post URL>index.md`), so agents and LLM tooling can read the site without
 * scraping HTML (https://llmstxt.org/). Endpoints: `src/pages/llms.txt.ts`,
 * `src/pages/llms-full.txt.ts`, `src/pages/{,zh/}posts/[slug]/index.md.ts`.
 *
 * The Markdown is the post source (`entry.body`), not a conversion of the
 * rendered page: `.mdx` posts first go through `mdxToMarkdown()`, the Sätteri
 * `{#id}` heading markers are removed and every root-relative URL
 * (`/images/x.png`) or in-page fragment (`#section`) is made absolute, as the
 * feed does, but leaving fenced and inline code untouched (an `href="/..."`
 * inside a code sample must stay as written).
 */
import type { Lang } from '@/i18n';
import { LANGS, otherLang, useTranslations } from '@/i18n';
import { formatDate } from './dates';
import { mdxToMarkdown } from './mdx';
import {
  descriptionOf,
  getPosts,
  getTranslation,
  langOf,
  pathOf,
  slugOf,
  type Post,
} from './posts';
import { SITE } from './site';
import {
  absoluteUrl,
  feedUrl,
  homeUrl,
  llmsFullUrl,
  llmsUrl,
  postMarkdownUrl,
  projectsIndexUrl,
} from './url';

/** The `>` summary line of both files (English; the file is one per site). */
export const LLMS_SUMMARY =
  `Personal blog of ${SITE.author} (${SITE.github}), co-founder of OOMOL: Electron, ` +
  'Node.js, Go, containers and virtualization, web security and troubleshooting notes, ' +
  'in English and Chinese.';

/** `context.site` as a string, falling back to the configured site URL. */
export function siteOf(site: URL | undefined): string {
  return (site ?? new URL(SITE.url)).href;
}

/** `text/*` response with UTF-8 charset. */
export function textResponse(body: string, type = 'text/plain'): Response {
  return new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8` } });
}

/** Everything but the leading whitespace-run or a code span; `code` spans are left verbatim. */
interface Segment {
  text: string;
  code: boolean;
}

/**
 * Split a line into inline code spans and the text between them, following
 * the CommonMark rule: a run of N backticks opens a span closed by the next
 * run of exactly N backticks; an unmatched run is literal text.
 */
export function splitCodeSpans(line: string): Segment[] {
  const out: Segment[] = [];
  let start = 0;
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') {
      i++;
      continue;
    }
    const open = i;
    let n = 0;
    while (line[open + n] === '`') n++;
    let j = open + n;
    let close = -1;
    while (j < line.length) {
      if (line[j] !== '`') {
        j++;
        continue;
      }
      let m = 0;
      while (line[j + m] === '`') m++;
      if (m === n) {
        close = j;
        break;
      }
      j += m;
    }
    if (close === -1) {
      i = open + n;
      continue;
    }
    if (open > start) out.push({ text: line.slice(start, open), code: false });
    out.push({ text: line.slice(open, close + n), code: true });
    start = i = close + n;
  }
  if (start < line.length) out.push({ text: line.slice(start), code: false });
  return out;
}

/** A root-relative (`/x`, not `//x`) or fragment (`#x`) URL. */
const LOCAL_URL = String.raw`\/(?!\/)|#`;
/** Link or image destination: `](/x)`, `](/x "title")`, `](#x)`. */
const LINK_DEST = new RegExp(String.raw`(\]\()((?:${LOCAL_URL})[^)\s]*)(?=[\s)])`, 'g');
/** Raw HTML attribute: `href="/x"`, `src='/x'`, `href="#x"`. */
const HTML_ATTR = new RegExp(
  String.raw`(\b(?:href|src|poster)=)(["'])((?:${LOCAL_URL})[^"']*)\2`,
  'g',
);
/** Link reference definition: `[label]: /x`. */
const REF_DEF = new RegExp(String.raw`^(\s{0,3}\[[^\]]+\]:\s*)(\/(?!\/)\S+)`);
/** Fenced code block delimiter (backticks or tildes); `[1]` is the run. */
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
/** Sätteri explicit heading id, `## Title {#id}` (`\{#id\}` in MDX). */
const HEADING_ID = /^(#{1,6}\s[^\n]*?)\s*\\?\{#[^}\s]+\\?\}\s*$/;

/**
 * Rewrite every root-relative or fragment URL of a markdown document with
 * `rewrite`, skipping fenced code blocks and inline code spans. Handles link
 * and image destinations, link reference definitions and raw HTML
 * `href`/`src`/`poster` attributes; protocol-relative (`//`) and absolute
 * URLs are left alone. Also drops the `{#id}` heading markers.
 */
export function rewriteLocalUrls(markdown: string, rewrite: (url: string) => string): string {
  let fence: string | undefined;
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out = lines.map((line) => {
    const m = FENCE.exec(line);
    if (m) {
      const run = m[1]!;
      if (!fence) fence = run;
      else if (run[0] === fence[0] && run.length >= fence.length) fence = undefined;
      return line;
    }
    if (fence) return line;
    const heading = HEADING_ID.exec(line);
    if (heading) line = heading[1]!;
    const ref = REF_DEF.exec(line);
    if (ref) return `${ref[1]}${rewrite(ref[2]!)}${line.slice(ref[0].length)}`;
    return splitCodeSpans(line)
      .map((seg) =>
        seg.code
          ? seg.text
          : seg.text
              .replace(LINK_DEST, (_, pre: string, url: string) => `${pre}${rewrite(url)}`)
              .replace(
                HTML_ATTR,
                (_, pre: string, q: string, url: string) => `${pre}${q}${rewrite(url)}${q}`,
              ),
      )
      .join('');
  });
  return out.join('\n');
}

/**
 * Plain markdown of a post body for readers outside the site: MDX components
 * reduced to links/images, heading ids removed, every URL absolute.
 */
export function bodyMarkdown(post: Pick<Post, 'id' | 'body' | 'filePath'>, site: string): string {
  const isMdx = post.filePath?.endsWith('.mdx') ?? false;
  const source = isMdx ? mdxToMarkdown(post.body ?? '') : (post.body ?? '');
  const page = absoluteUrl(pathOf(post), site);
  const md = rewriteLocalUrls(source, (url) =>
    url.startsWith('#') ? `${page}${url}` : absoluteUrl(url, site),
  );
  return `${md.trim()}\n`;
}

/** One line: whitespace collapsed (titles and descriptions inside list items). */
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Double-quoted YAML scalar (JSON string syntax is valid YAML). */
function yaml(value: string | string[]): string {
  return JSON.stringify(value);
}

/** English name of a language (`English` / `Chinese`), for the all-English files. */
function langName(lang: Lang): string {
  return useTranslations('en').languageNames[lang];
}

/**
 * The Markdown copy of one post: YAML front matter (title, description, date,
 * updated, tags, BCP 47 `lang`, canonical `url`, `translation`), the title as
 * a level-1 heading, then the body.
 */
export async function postMarkdown(post: Post, site: string): Promise<string> {
  const lang = langOf(post);
  const translation = await getTranslation(post);
  const fm = [
    `title: ${yaml(post.data.title)}`,
    `description: ${yaml(oneLine(descriptionOf(post)))}`,
    `date: ${formatDate(post.data.date)}`,
  ];
  if (post.data.updated) fm.push(`updated: ${formatDate(post.data.updated)}`);
  fm.push(`tags: ${yaml(post.data.tags)}`);
  fm.push(`lang: ${useTranslations(lang).htmlLang}`);
  fm.push(`url: ${absoluteUrl(pathOf(post), site)}`);
  if (translation) fm.push(`translation: ${absoluteUrl(pathOf(translation), site)}`);
  return `---\n${fm.join('\n')}\n---\n\n# ${post.data.title}\n\n${bodyMarkdown(post, site)}`;
}

/** Header shared by `/llms.txt` and `/llms-full.txt`: H1 and the `>` summary. */
function header(): string {
  return `# ${SITE.title}\n\n> ${LLMS_SUMMARY}\n`;
}

function siteLines(site: string): string[] {
  return LANGS.map(
    (lang) =>
      `- ${langName(lang)} site: ${absoluteUrl(homeUrl(lang), site)} (RSS: ${absoluteUrl(feedUrl(lang), site)})`,
  );
}

function licenseLine(): string {
  return `- Content license: ${SITE.license.name} (${SITE.license.url})`;
}

/**
 * `/llms.txt` (https://llmstxt.org/): the site summary, one `## Posts in
 * <language>` section per language listing every post (newest first) as a
 * link to its Markdown copy with the description and date, and an
 * `## Optional` section with the projects page and `/llms-full.txt`.
 */
export async function buildLlmsIndex(site: string): Promise<string> {
  const en = useTranslations('en');
  const parts = [
    header(),
    [
      ...siteLines(site),
      '- Every post has a Markdown copy at `<post URL>index.md`; the links below point at those copies. Drop the `index.md` for the HTML page.',
      licenseLine(),
    ].join('\n') + '\n',
  ];
  const byLang = await Promise.all(LANGS.map((lang) => getPosts(lang)));
  LANGS.forEach((lang, i) => {
    const items = byLang[i]!.map((post) => {
      const url = absoluteUrl(postMarkdownUrl(lang, slugOf(post)), site);
      const desc = oneLine(descriptionOf(post));
      return `- [${oneLine(post.data.title)}](${url}): ${desc} (${formatDate(post.data.date)})`;
    });
    parts.push(`## Posts in ${langName(lang)}\n\n${items.join('\n')}\n`);
  });
  parts.push(
    [
      '## Optional',
      '',
      `- [Projects](${absoluteUrl(projectsIndexUrl('en'), site)}): ${en.projects.description}`,
      `- [Full text of every post](${absoluteUrl(llmsFullUrl(), site)}): all posts above in one Markdown file.`,
    ].join('\n') + '\n',
  );
  return parts.join('\n');
}

/**
 * `/llms-full.txt`: the same header, then every post (per language, newest
 * first) separated by `---`: level-1 title, a list with URL, language, dates,
 * tags and translation, then the body.
 */
export async function buildLlmsFull(site: string): Promise<string> {
  const parts = [
    header(),
    [
      ...siteLines(site),
      `- Index of the posts: ${absoluteUrl(llmsUrl(), site)}. Each post below starts with a level-1 heading followed by its URL, language, dates and tags.`,
      licenseLine(),
    ].join('\n') + '\n',
  ];
  const byLang = await Promise.all(LANGS.map((lang) => getPosts(lang)));
  const sections = await Promise.all(
    LANGS.flatMap((lang, i) =>
      byLang[i]!.map(async (post) => {
        const translation = await getTranslation(post);
        const meta = [
          `- URL: ${absoluteUrl(pathOf(post), site)} (Markdown: ${absoluteUrl(postMarkdownUrl(lang, slugOf(post)), site)})`,
          `- Language: ${langName(lang)}`,
          `- Published: ${formatDate(post.data.date)}`,
        ];
        if (post.data.updated) meta.push(`- Updated: ${formatDate(post.data.updated)}`);
        if (post.data.tags.length > 0) meta.push(`- Tags: ${post.data.tags.join(', ')}`);
        if (translation) {
          meta.push(
            `- Translation (${langName(otherLang(lang))}): ${absoluteUrl(pathOf(translation), site)}`,
          );
        }
        return `---\n\n# ${post.data.title}\n\n${meta.join('\n')}\n\n${bodyMarkdown(post, site)}`;
      }),
    ),
  );
  parts.push(...sections);
  return parts.join('\n');
}
