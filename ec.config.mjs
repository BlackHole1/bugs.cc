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
 * Colour adjustments to Dracula for WCAG AA (4.5:1). The tokens are drawn on
 * the neutral `--code-bg` #161616 (global.css), not on Dracula's #282a36, and
 * the ratios below are on that surface and on the mark/ins/del line
 * backgrounds further down:
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
  themes: ['dracula'],
  // Inline the EC styles (~4.5 KB gzipped) instead of a `<link>` inside the
  // article body, which render-blocks everything below it on first view. This
  // also removes the stale `ec.<hash>.css` reference problem of the content
  // cache (see README).
  emitExternalStylesheet: false,
  useDarkModeMediaQuery: false,
  themeCssSelector: false,
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
    codeFontSize: '0.85rem',
    codeLineHeight: '1.6',
    codeFontWeight: '400',
    uiFontFamily: 'var(--font-sans)',
    uiFontSize: '0.8rem',
    borderRadius: '6px',
    borderColor: 'var(--border)',
    codeBackground: 'var(--code-bg)',
    frames: {
      shadowColor: 'transparent',
      // The editor tab bar is the only header left (blocks with `title=`).
      editorActiveTabIndicatorTopColor: 'var(--link)',
      editorTabBarBackground: '#0d0d0d',
    },
    // EC's default 50% tints left comments, red tokens and the +/- indicators
    // below 4.5:1 on marked lines; 33% keeps every token at or above it (the
    // accent bar on the left still marks the line clearly). On #161616 the
    // blended line backgrounds are #1b273c / #1b2b18 / #3a1f1d.
    textMarkers: {
      markBackground: '#264a8955',
      insBackground: '#26561c55',
      delBackground: '#81322b55',
      insDiffIndicatorColor: '#9fd18f',
      delDiffIndicatorColor: '#f2a196',
    },
  },
});
