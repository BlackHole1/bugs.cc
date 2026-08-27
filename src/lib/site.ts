/** Site-wide constants. */

export const SITE = {
  url: 'https://bugs.cc',
  title: "Kevin Cui's Blog",
  description: "Kevin Cui's Blog",
  author: 'Kevin Cui',
  email: 'bh@bugs.cc',
  twitter: 'Free_BlackHole',
  github: 'BlackHole1',
  mastodon: '@Black_Hole',
  copyright: 'Kevin Cui (CC BY 4.0)',
  license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  /** Static default social image (1200x630). */
  ogImage: '/img/og.png',
  avatar: '/img/avatar.jpg',
  themeColor: '#101010',
  /** PostHog (EU Cloud, project "bugs.cc"); see src/components/Analytics.astro. */
  posthog: {
    token: 'phc_s2Nz4676edx9KGFf47gmxZsmLJTSeJDnTJbv8VQqGhKH',
    /**
     * The Cloudflare Worker in front of PostHog (cloudflare/posthog-proxy.worker.js);
     * the SDK and its lazy-loaded extras come from `/static/` here as well.
     */
    apiHost: 'https://t.bugs.cc',
    /** Must stay PostHog's own domain (toolbar, links into the app). */
    uiHost: 'https://eu.posthog.com',
  },
  /** Follow (follow.is) feed ownership challenge ids. Must stay exactly as-is. */
  follow: {
    userId: '67028119038586880',
    feedIds: { en: '67444163872609280', zh: '67444337223193600' },
  },
} as const;

/** `managingEditor` / `webMaster` value in RSS. */
export const RSS_EDITOR = `${SITE.email} (${SITE.author})`;
