import { FOOTNOTE_LABEL_ID } from '@/plugins/footnotes';

/**
 * Build a nested table of contents from the flat `headings` list returned by
 * `render(entry)`. Only depths within [min, max] (default h2..h4) are kept;
 * skipped levels (h2 -> h4) attach to the nearest shallower entry. The
 * visually hidden `<h2>` of the GFM footnotes section (plugins/footnotes) is
 * left out: it names the section for assistive technology, not a part of the
 * prose, and a TOC entry that scrolls to a 1px hidden element is no use.
 */

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocEntry extends Heading {
  children: TocEntry[];
}

export interface TocOptions {
  minDepth?: number;
  maxDepth?: number;
}

export function buildToc(headings: readonly Heading[], options: TocOptions = {}): TocEntry[] {
  const min = options.minDepth ?? 2;
  const max = options.maxDepth ?? 4;
  const root: TocEntry[] = [];
  const stack: TocEntry[] = [];

  for (const h of headings) {
    if (h.depth < min || h.depth > max || h.slug === FOOTNOTE_LABEL_ID) continue;
    const entry: TocEntry = { depth: h.depth, slug: h.slug, text: h.text, children: [] };
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= h.depth) stack.pop();
    const parent = stack[stack.length - 1];
    (parent ? parent.children : root).push(entry);
    stack.push(entry);
  }
  return root;
}

/** Number of entries at any depth. */
export function countToc(entries: readonly TocEntry[]): number {
  let n = 0;
  for (const e of entries) n += 1 + countToc(e.children);
  return n;
}

/** Posts with fewer than `min` eligible headings render no TOC. */
export function shouldRenderToc(entries: readonly TocEntry[], min = 2): boolean {
  return countToc(entries) >= min;
}
