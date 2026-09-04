import type { UIStrings } from './types';

export const zh: UIStrings = {
  htmlLang: 'zh-Hans',
  ogLocale: 'zh_CN',
  rssLanguage: 'zh-CN',
  nativeName: '中文',
  languageNames: { en: '英文', zh: '中文' },

  siteTitle: "Kevin Cui's Blog",
  siteDescription: "Kevin Cui's Blog",
  skipToContent: '跳到正文',

  nav: {
    label: '主导航',
    home: '首页',
    posts: '文章',
    projects: '项目',
    search: '搜索',
    rss: 'RSS',
    languageSwitch: '切换语言',
    noTranslation: '本页没有英文版',
    externalLink: '在新标签页打开',
    themeAuto: '跟随系统主题',
    themeLight: '切换到浅色主题',
    themeDark: '切换到深色主题',
  },

  home: {
    title: '首页',
    aboutHeading: '关于我',
    recentPosts: '最近文章',
    allPosts: '全部文章',
    noPosts: '暂无文章。',
  },

  posts: {
    title: '文章',
    description: "Kevin Cui's Blog 的全部文章。",
  },

  projects: {
    title: '项目',
    description: 'Kevin Cui 编写和维护的开源项目。',
    intro: '我编写和维护的开源项目。',
  },

  search: {
    title: '搜索',
    description: "搜索 Kevin Cui's Blog 的文章。",
    label: '搜索文章',
    placeholder: '搜索文章',
    results: '「{q}」有 {n} 条结果',
    noResults: '没有找到「{q}」',
    loading: '搜索中…',
    error: '搜索暂时不可用。',
    needsJs: '搜索需要 JavaScript。',
  },

  tags: {
    title: '标签',
    description: "Kevin Cui's Blog 的全部标签。",
    filteringFor: (tag) => `标签：${tag}`,
    postCount: (n) => `${n} 篇文章`,
    pageDescription: (tag, n) => `Kevin Cui's Blog 中标签为「${tag}」的 ${n} 篇文章。`,
    cloudLabel: '全部标签',
  },

  post: {
    tableOfContents: '目录',
    postedOn: '发布于',
    updatedOn: '更新于',
    readingTime: (minutes) => `约 ${minutes} 分钟`,
    replyOnX: '通过 X 回复这篇文章',
    viewMarkdown: '查看 Markdown 版本',
    replyText: (handle, url) => `正在读 @${handle} 的 ${url}\n\n我觉得...`,
    previous: '上一篇',
    next: '下一篇',
    linkToSection: '本节链接',
    postNav: '上一篇与下一篇',
    footnotes: '脚注',
    backToReference: (ref) => `返回引用 ${ref}`,
  },

  lightbox: {
    label: '图片查看器',
    open: '查看原图',
    close: '关闭图片查看器',
  },

  footer: {
    madeWith: { before: '由', after: '构建' },
    llms: '给 AI Agent 与 LLM 的站点索引',
  },

  content: {
    youtubeVideo: 'YouTube 视频',
    onYouTube: (title) => `${title}（YouTube）`,
    watchOnYouTube: '在 YouTube 上观看',
    cpuDay: {
      windows: '标出每次发送后的 600 s',
      reset: '还原缩放',
      hint: '拖动选择时间范围放大，双击还原。键盘: 方向键移动光标，+ 和 - 缩放，Esc 还原。',
      unit: '核',
      lastSend: 'pod {pod}: 最近一次发送 {time}，{delta} s 前',
      noSend: 'pod {pod}: 当天还没有发送',
    },
    stringMemory: {
      input: '文本',
      escape: '把超出 Latin-1 的字符写成 \\uXXXX',
      units: 'UTF-16 码元',
      utf8: 'UTF-8',
      wide: '超出 Latin-1',
      none: '没有',
      wideCount: '{count} 个: ',
      width: '引擎表示',
      oneByte: '每码元 1 字节 (Latin-1)',
      twoByte: '每码元 2 字节 (UTF-16)',
      heap: '堆内存 (不含对象头)',
      truncated: '(只显示前 {limit} 个码元)',
      hint: '改一改文本，或者粘贴一段你自己的 JSON 试试。',
    },
  },

  notFound: {
    title: '页面不存在',
    heading: '404',
    body: '你访问的页面不存在。',
    backHome: '返回首页',
  },

  redirect: {
    title: (target) => `正在跳转到 ${target}`,
    body: '本页已迁移到',
  },
};
