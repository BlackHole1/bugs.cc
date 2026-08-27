/**
 * Tag helpers. Tags are compared case-insensitively; the display form is the
 * lowercase original (`#web security`), the URL form replaces whitespace runs
 * with `-` and keeps `/` (so `ci/cd` becomes the nested path `/tags/ci/cd/`).
 */

export interface TagInfo {
  /** Canonical (trimmed, lowercase) tag text. */
  tag: string;
  /** URL segment(s), see {@link tagSlug}. */
  slug: string;
  count: number;
}

/** Canonical comparison form. */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** URL slug: trimmed, lowercase, whitespace -> `-`, `/` preserved. */
export function tagSlug(tag: string): string {
  return normalizeTag(tag).replace(/\s+/g, '-');
}

/** Case-insensitive equality of two tags. */
export function sameTag(a: string, b: string): boolean {
  return normalizeTag(a) === normalizeTag(b);
}

/** Dedupe a list of tags case-insensitively, keeping the canonical form. */
export function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Count tags over a list of items, sorted by count desc then name asc. */
export function countTags(items: ReadonlyArray<{ data: { tags: readonly string[] } }>): TagInfo[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of uniqueTags(item.data.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
    .toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Title-cased tag for the English tag page heading (`web security` ->
 * `Web Security`, as the old site did).
 */
export function titleCaseTag(tag: string): string {
  return normalizeTag(tag).replace(/(^|[\s/-])(\p{L})/gu, (_, sep: string, ch: string) => {
    return sep + ch.toUpperCase();
  });
}
