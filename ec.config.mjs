// @ts-check
import {
  pluginCollapsibleSections,
  pluginCollapsibleSectionsTexts,
} from '@expressive-code/plugin-collapsible-sections';
import { defineEcConfig } from 'astro-expressive-code';
import { notationMarkers } from './src/expressive-code/notation-markers.ts';

/**
 * Every code block looks the same: a plain "code" frame (no terminal window,
 * no editor tab bar), no line numbers and no copy button, whatever the
 * language. A header is rendered only when the fence carries an explicit
 * `title="..."`; titles are never extracted from file-name comments
 * (`extractFileNameFromCode: false`). See README "Writing posts".
 */

/**
 * Two themes, GitHub Light (base) and Dracula, switched the way the page is
 * (global.css): `<html data-theme="light|dark">` from the theme script, and
 * `prefers-color-scheme` when there is no attribute (EC emits
 * `:root:not([data-theme='light'])` inside the media query, so the no-JS page
 * and the JS page agree). The tokens are drawn on the neutral `--code-bg`
 * (#f5f5f5 / #161616), not on the themes' own backgrounds.
 *
 * Colour adjustments to Dracula for WCAG AA (4.5:1). The ratios below are on
 * #161616 and on the mark/ins/del line backgrounds further down:
 * - comments #6272A4 are 3.9:1 plain and 3.2:1 on marked lines; #91a0d3 is
 *   7.0:1 plain and 5.8:1 on marked lines;
 * - red #FF5555 is 5.8:1 plain but 4.8:1 on marked lines; #ff7575 is 6.9:1
 *   plain and 5.7:1 on marked lines.
 * Every other Dracula token is at or above 6.2:1 on marked lines.
 */
const DRACULA_COMMENT = '#6272a4';
const ACCESSIBLE_COMMENT = '#91a0d3';
const DRACULA_RED = '#ff5555';
const ACCESSIBLE_RED = '#ff7575';

/**
 * UI texts of Chinese posts (`src/content/posts/zh/**`). Locales are resolved
 * by language, so `zh` covers `zh-CN`. The only EC text still rendered is the
 * collapsed-section label: there is no copy button (`showCopyToClipboardButton:
 * false`) and no terminal frame (`defaultProps.frame: 'code'`), so the copy
 * button and terminal texts are not overridden.
 */
pluginCollapsibleSectionsTexts.overrideTexts('zh', {
  collapsedLines: '已折叠 {lineCount} 行',
});
const ZH_DOCUMENT = /[\\/]zh[\\/]/;

export default defineEcConfig({
  themes: ['github-light', 'dracula'],
  // Inline the EC styles (~4.5 KB gzipped) instead of a `<link>` inside the
  // article body, which render-blocks everything below it on first view. This
  // also removes the stale `ec.<hash>.css` reference problem of the content
  // cache (see README).
  emitExternalStylesheet: false,
  useDarkModeMediaQuery: true,
  themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
  // `notationMarkers` adds the `[!code highlight]` comment syntax on top of the
  // built-in text-markers plugin (see the file header for the syntax).
  plugins: [pluginCollapsibleSections(), notationMarkers()],
  // Chinese posts get Chinese UI texts (see the overrides above).
  getBlockLocale: ({ file }) =>
    ZH_DOCUMENT.test(file.url?.pathname ?? file.path) ? 'zh-CN' : 'en-US',
  customizeTheme: (theme) => {
    for (const entry of theme.settings) {
      const fg = entry.settings?.foreground;
      if (typeof fg !== 'string') continue;
      if (fg.toLowerCase() === DRACULA_COMMENT) entry.settings.foreground = ACCESSIBLE_COMMENT;
      if (fg.toLowerCase() === DRACULA_RED) entry.settings.foreground = ACCESSIBLE_RED;
    }
    return theme;
  },
  defaultProps: {
    // `frame: 'code'` for every language: EC's default `auto` turns shell
    // languages (sh, bash, zsh, ...) into terminal windows with an empty
    // title bar, so headers appeared on some blocks and not on others.
    frame: 'code',
    // No word wrap: long lines scroll inside the frame (EC's base styles give
    // the <pre> `overflow-x: auto`; EC's own script makes a scrollable block
    // focusable, so it can be scrolled with the keyboard too).
    wrap: false,
    collapseStyle: 'collapsible-auto',
  },
  frames: {
    // No copy-to-clipboard button on any block (this also drops the copy
    // button script from EC's `/_astro/ec.<hash>.js`).
    showCopyToClipboardButton: false,
    // Only an explicit `title="..."` in the fence produces a header; a file
    // name written as the first comment of the code is left in the code.
    extractFileNameFromCode: false,
  },
  styleOverrides: {
    codeFontFamily: 'var(--font-mono)',
    // 13.5px: three quarters of the 18px body (Tufte, sive.rs), and 80
    // columns (648px) plus the 20px inline padding fit the 700px reading
    // column without scrolling.
    codeFontSize: '0.84375rem',
    codeLineHeight: '1.6',
    codeFontWeight: '400',
    codePaddingInline: '1.25rem',
    uiFontFamily: 'var(--font-sans)',
    uiFontSize: '0.8125rem',
    borderRadius: '6px',
    borderColor: 'var(--border)',
    codeBackground: 'var(--code-bg)',
    frames: {
      shadowColor: 'transparent',
      // The editor tab bar is the only header left (blocks with `title=`).
      editorActiveTabIndicatorTopColor: 'var(--link)',
      editorTabBarBackground: ({ theme }) => (theme.type === 'dark' ? '#0d0d0d' : '#ececec'),
    },
    // EC's default 50% tints left comments, red tokens and the +/- indicators
    // below 4.5:1 on marked lines; 33% keeps every token at or above it (the
    // accent bar on the left still marks the line clearly). On #161616 the
    // blended dark line backgrounds are #1b273c / #1b2b18 / #3a1f1d; the light
    // tints are the same hues at 16% on #f5f5f5.
    textMarkers: {
      markBackground: ({ theme }) => (theme.type === 'dark' ? '#264a8955' : '#2b6cb029'),
      insBackground: ({ theme }) => (theme.type === 'dark' ? '#26561c55' : '#2f855a29'),
      delBackground: ({ theme }) => (theme.type === 'dark' ? '#81322b55' : '#c5303029'),
      insDiffIndicatorColor: ({ theme }) => (theme.type === 'dark' ? '#9fd18f' : '#1a7f37'),
      delDiffIndicatorColor: ({ theme }) => (theme.type === 'dark' ? '#f2a196' : '#cf222e'),
    },
  },
});
