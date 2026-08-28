export const LANGS = ['en', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

/** Every UI string the templates need. Both languages must implement all keys. */
export interface UIStrings {
  /**
   * BCP 47 language tag used wherever HTML expects one: `<html lang>`,
   * `hreflang` (head links, sitemap `xhtml:link`, language switch), `<p lang>`
   * and JSON-LD `inLanguage`. `en` for English and `zh-Hans` for Simplified
   * Chinese (script subtag, so `zh-Hans` rather than `zh-CN`). Formats with
   * their own code lists do not use it: `ogLocale` and `rssLanguage` below.
   */
  htmlLang: string;
  /** `og:locale` value (Open Graph wants `language_TERRITORY`). */
  ogLocale: string;
  /** RSS 2.0 `<language>` (RSS language codes, as in the old feed). */
  rssLanguage: string;
  /**
   * The language's own name (`English` / `中文`): visible label of the
   * language switch, as W3C recommends for language selectors.
   */
  nativeName: string;
  /** Names of all languages in *this* UI language (`Chinese` / `英文`). */
  languageNames: Record<Lang, string>;

  siteTitle: string;
  siteDescription: string;
  skipToContent: string;

  nav: {
    label: string;
    home: string;
    posts: string;
    projects: string;
    search: string;
    rss: string;
    /** `title` of the language switch when the page has a translation. */
    languageSwitch: string;
    /** Name suffix and `title` of the switch when the page has no translation (the switch is inert). */
    noTranslation: string;
    /** `(opens in a new tab)` hint, also appended to external links in prose. */
    externalLink: string;
    /** Accessible names of the theme toggle: what pressing it switches to. */
    themeAuto: string;
    themeLight: string;
    themeDark: string;
  };

  home: {
    title: string;
    /** Name of the (visually hidden) heading of the bio section. */
    aboutHeading: string;
    recentPosts: string;
    allPosts: string;
    noPosts: string;
  };

  posts: {
    title: string;
    description: string;
  };

  projects: {
    title: string;
    description: string;
    /** Lead paragraph above the list. */
    intro: string;
  };

  /** Search page (`SearchPage.astro`, Pagefind). */
  search: {
    title: string;
    description: string;
    /** Accessible name of the query field. */
    label: string;
    placeholder: string;
    /** `12 results for "foo"`; `{n}` and `{q}` are filled in by the page script. */
    results: string;
    /** `No results for "foo"`; `{q}` is filled in by the page script. */
    noResults: string;
    loading: string;
    /** The index is missing or failed to load (dev server, blocked request). */
    error: string;
    needsJs: string;
  };

  tags: {
    title: string;
    description: string;
    /** `Filtering for "Web Security"` / `标签：web security` */
    filteringFor: (tag: string) => string;
    /** `3 posts` */
    postCount: (n: number) => string;
    /** Meta description of a tag page. */
    pageDescription: (tag: string, n: number) => string;
    /** Accessible name of the tag cloud below the post list. */
    cloudLabel: string;
  };

  post: {
    tableOfContents: string;
    postedOn: string;
    updatedOn: string;
    /** `5 min read` / `约 5 分钟` */
    readingTime: (minutes: number) => string;
    /** Visible text of the reply link at the end of a post (`Reply to this post on X`). */
    replyOnX: string;
    /** Visible text of the link to the post's Markdown copy next to it (`View as Markdown`). */
    viewMarkdown: string;
    /**
     * Text pre-filled in the X post: the site's handle and the post URL, then
     * an empty line and a prompt to write (`Reading @handle's <url>\n\nI think...`).
     */
    replyText: (handle: string, url: string) => string;
    previous: string;
    next: string;
    /** `aria-label` prefix of the anchor appended to headings that contain a link. */
    linkToSection: string;
    /** `aria-label` of the previous/next navigation. */
    postNav: string;
    /** Name of the (visually hidden) heading of the GFM footnotes section (`Footnotes`). */
    footnotes: string;
    /** `aria-label` of a footnote's back link; `ref` is `1` or `1-2` for a repeated reference. */
    backToReference: (ref: string) => string;
  };

  lightbox: {
    /** Accessible name of the dialog. */
    label: string;
    /** Hint added to zoomable images (`View full size`). */
    open: string;
    /** Accessible name of the close button. */
    close: string;
  };

  footer: {
    /** `Made with <Astro>` / `由 <Astro> 构建`: text before and after the link. */
    madeWith: { before: string; after: string };
    /** `title` of the `llms.txt` link (the visible text is the file name). */
    llms: string;
  };

  /** Components used from .mdx posts (`components/content/*`). */
  content: {
    /** Default accessible name of a YouTube frame. */
    youtubeVideo: string;
    /** Caption link under the frame when the post gave the video a title: `Title (YouTube)`. */
    onYouTube: (title: string) => string;
    /** Caption link under the frame for an untitled video. */
    watchOnYouTube: string;
    /** `CpuDayChart`: controls and tooltip of the CPU / Kafka day chart. */
    cpuDay: {
      /** Checkbox that shades the 600 s after every produce. */
      windows: string;
      /** Button that leaves a zoomed view. */
      reset: string;
      /** Usage line under the chart (shown only with JavaScript). */
      hint: string;
      /** Unit after a CPU value in the tooltip: `0.99 cores`. */
      unit: string;
      /** Tooltip line with `{pod}`, `{time}` and `{delta}` (seconds) placeholders. */
      lastSend: string;
      /** Tooltip line with a `{pod}` placeholder when nothing was sent yet that day. */
      noSend: string;
    };
  };

  notFound: {
    title: string;
    heading: string;
    body: string;
    backHome: string;
  };

  /** Alias redirect pages (`Redirect.astro`). */
  redirect: {
    /** `<title>` of the redirect page, given the absolute target URL. */
    title: (target: string) => string;
    /** Visible text before the target link. */
    body: string;
  };
}
