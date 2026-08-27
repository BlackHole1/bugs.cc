import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';
import { defineHastPlugin } from 'satteri';

/**
 * Sätteri HAST plugin: for root-relative images (`<img src="/images/...">`)
 * that exist in `public/`, inject `width`/`height` (prevents layout shift),
 * `loading="lazy"` and `decoding="async"`. Remote images, data URIs and
 * relative paths (handled by Astro's own image pipeline) are skipped.
 * `alt` is never rewritten; a missing `alt` becomes an empty string so every
 * `<img>` carries the attribute.
 */

export interface ImageDimensionsOptions {
  /** Absolute path to the directory that maps to the site root. */
  publicDir: string;
  /** Set `loading="lazy"` when absent. Defaults to true. */
  lazy?: boolean;
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
        if (lazy && props.loading === undefined) ctx.setProperty(node, 'loading', 'lazy');
        if (props.decoding === undefined) ctx.setProperty(node, 'decoding', 'async');
      },
    },
  });
}
