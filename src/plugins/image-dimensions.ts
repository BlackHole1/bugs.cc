import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Element, Node, Parent, Parents, Text } from 'hast';
import { imageSize } from 'image-size';
import { defineHastPlugin, type HastVisitorContext } from 'satteri';
import type { Lang } from '../i18n/types';
import { langOfFile } from './lang';

/**
 * Sätteri HAST plugin: for root-relative images (`<img src="/images/...">`)
 * that exist in `public/`, inject `width`/`height` (prevents layout shift),
 * `loading="lazy"` and `decoding="async"`. Remote images, data URIs and
 * relative paths (handled by Astro's own image pipeline) are skipped.
 * `alt` is never rewritten; a missing `alt` becomes an empty string so every
 * `<img>` carries the attribute.
 *
 * One exception to lazy loading: the first image of a document, when it sits
 * near the top (the text before it is within `eagerBudget`, roughly the first
 * mobile screen), is the page's likely Largest Contentful Paint element. A
 * lazy LCP image is only requested once layout has run, which on a slow
 * mobile network adds seconds to LCP (Lighthouse "LCP request discovery").
 * That image gets no `loading` attribute and `fetchpriority="high"` instead.
 * A first image further down stays lazy: eager-loading it would spend
 * bandwidth on something the reader may never scroll to.
 */

export interface ImageDimensionsOptions {
  /** Absolute path to the directory that maps to the site root. */
  publicDir: string;
  /** Set `loading="lazy"` when absent. Defaults to true. */
  lazy?: boolean;
  /**
   * Characters of text (per language, `zh` counts CJK characters) that may
   * precede the first image for it to be loaded eagerly; `false` keeps every
   * image lazy. Defaults to `{ en: 1500, zh: 600 }`.
   */
  eagerBudget?: false | Record<Lang, number>;
}

const DEFAULT_EAGER_BUDGET: Record<Lang, number> = { en: 1500, zh: 600 };
/** `ctx.data` key that marks a document whose first image has been seen. */
const FIRST_IMAGE_SEEN = 'blogFirstImageSeen';

/** Plain text of a HAST subtree (like DOM `textContent`). */
function textOf(node: Node): string {
  if (node.type === 'text') return (node as Text).value;
  if ('children' in node) return (node as Parent).children.map(textOf).join('');
  return '';
}

/**
 * Length of the text before `node` in document order, counted over the
 * root-level blocks that precede the block containing it (the text inside
 * that block is ignored: a caption paragraph does not push its image down).
 */
export function textLengthBefore(node: Element, ctx: HastVisitorContext): number {
  let top: Element | Readonly<Parents> = node;
  let parent: Readonly<Parents> | undefined = ctx.parent(top);
  while (parent && parent.type !== 'root') {
    top = parent;
    parent = ctx.parent(top);
  }
  if (!parent) return 0;
  const index = ctx.indexOf(top) ?? 0;
  let length = 0;
  for (const sibling of parent.children.slice(0, index)) length += textOf(sibling).length;
  return length;
}

export interface ImageSize {
  width: number;
  height: number;
}

const cache = new Map<string, ImageSize | null>();

/** Resolve a root-relative URL path to a file below `publicDir`, or null. */
export function resolvePublicFile(src: string, publicDir: string): string | null {
  if (!src.startsWith('/') || src.startsWith('//')) return null;
  let pathname = src.split('#')[0]?.split('?')[0] ?? '';
  try {
    pathname = decodeURI(pathname);
  } catch {
    return null;
  }
  const root = path.resolve(publicDir);
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

/** Read image dimensions from disk, memoised by path and mtime. */
export function readImageSize(file: string): ImageSize | null {
  let key = file;
  try {
    key = `${file}:${statSync(file).mtimeMs}`;
  } catch {
    return null;
  }
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let size: ImageSize | null = null;
  try {
    const { width, height } = imageSize(readFileSync(file));
    if (width && height) size = { width, height };
  } catch {
    size = null;
  }
  cache.set(key, size);
  return size;
}

export function imageDimensions(options: ImageDimensionsOptions) {
  const lazy = options.lazy ?? true;
  const eagerBudget = options.eagerBudget ?? DEFAULT_EAGER_BUDGET;
  return defineHastPlugin({
    name: 'blog-image-dimensions',
    element: {
      filter: ['img'],
      visit(node, ctx) {
        const props = node.properties;
        if (props.alt === undefined || props.alt === null) ctx.setProperty(node, 'alt', '');
        const src = props.src;
        if (typeof src !== 'string') return;
        const file = resolvePublicFile(src, options.publicDir);
        if (!file) return;
        const size = readImageSize(file);
        if (!size) return;
        if (props.width === undefined) ctx.setProperty(node, 'width', size.width);
        if (props.height === undefined) ctx.setProperty(node, 'height', size.height);
        if (lazy && props.loading === undefined) {
          // Only the document's first image can be the eager one (see the header).
          const first = ctx.data[FIRST_IMAGE_SEEN] !== true;
          ctx.data[FIRST_IMAGE_SEEN] = true;
          const eager =
            first &&
            eagerBudget !== false &&
            textLengthBefore(node, ctx) <= eagerBudget[langOfFile(ctx.fileURL)];
          if (eager) ctx.setProperty(node, 'fetchpriority', 'high');
          else ctx.setProperty(node, 'loading', 'lazy');
        }
        if (props.decoding === undefined) ctx.setProperty(node, 'decoding', 'async');
      },
    },
  });
}
