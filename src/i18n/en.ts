import type { UIStrings } from './types';

export const en: UIStrings = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  rssLanguage: 'en-US',
  nativeName: 'English',
  languageNames: { en: 'English', zh: 'Chinese' },

  siteTitle: "Kevin Cui's Blog",
  siteDescription: "Kevin Cui's Blog",
  skipToContent: 'Skip to content',

  nav: {
    label: 'Main',
    home: 'Home',
    posts: 'Posts',
    projects: 'Projects',
    rss: 'RSS',
    languageSwitch: 'Switch language',
    noTranslation: 'No Chinese version of this page',
    externalLink: 'opens in a new tab',
  },

  home: {
    title: 'Home',
    aboutHeading: 'About',
    recentPosts: 'Recent posts',
    allPosts: 'All posts',
    noPosts: 'No posts yet.',
  },

  posts: {
    title: 'Posts',
    description: "All posts on Kevin Cui's Blog.",
  },

  projects: {
    title: 'Projects',
    description: 'Open source projects Kevin Cui builds and maintains.',
    intro: 'Open source projects I build and maintain.',
  },

  tags: {
    title: 'Tags',
    description: "All tags on Kevin Cui's Blog.",
    filteringFor: (tag) => `Filtering for "${tag}"`,
    postCount: (n) => (n === 1 ? '1 post' : `${n} posts`),
    pageDescription: (tag, n) =>
      `${n === 1 ? '1 post' : `${n} posts`} tagged "${tag}" on Kevin Cui's Blog.`,
    cloudLabel: 'All tags',
  },

  post: {
    tableOfContents: 'Table of contents',
    postedOn: 'Posted on',
    updatedOn: 'Updated on',
    readingTime: (minutes) => `${minutes} min read`,
    replyOnX: 'Reply to this post on X',
    viewMarkdown: 'View as Markdown',
    replyText: (handle, url) => `Reading @${handle}'s ${url}\n\nI think...`,
    previous: 'Previous',
    next: 'Next',
    linkToSection: 'Link to this section',
    postNav: 'Previous and next post',
    footnotes: 'Footnotes',
    backToReference: (ref) => `Back to reference ${ref}`,
  },

  lightbox: {
    label: 'Image viewer',
    open: 'View full size image',
    close: 'Close image viewer',
  },

  footer: {
    madeWith: { before: 'Made with', after: '' },
    llms: 'Site index for AI agents and LLMs',
  },

  content: {
    youtubeVideo: 'YouTube video',
    onYouTube: (title) => `${title} (YouTube)`,
    watchOnYouTube: 'Watch on YouTube',
    cpuDay: {
      windows: 'Shade 600 s after each produce',
      reset: 'Reset zoom',
      hint: 'Drag to zoom, double-click to reset. Keyboard: arrow keys move the cursor, + and - zoom, Esc resets.',
      unit: 'cores',
      lastSend: 'pod {pod}: last produce {time}, {delta} s ago',
      noSend: 'pod {pod}: no produce yet',
    },
  },

  notFound: {
    title: 'Page not found',
    heading: '404',
    body: 'The page you are looking for does not exist.',
    backHome: 'Back to home',
  },

  redirect: {
    title: (target) => `Redirecting to ${target}`,
    body: 'This page has moved to',
  },
};
