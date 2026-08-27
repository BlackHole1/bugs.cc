import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Entry id = `${lang}/${slug}` where `lang` is the first path segment
 * (`en` | `zh`) and `slug` is the frontmatter `slug` or the file name without
 * extension, used VERBATIM (no slugification; `tests/content.test.ts` requires
 * lowercase ASCII file names, old Chinese URLs are kept as `aliases`).
 */
function generateId({ entry, data }: { entry: string; data: Record<string, unknown> }): string {
  const parts = entry.split('/');
  const lang = parts[0] ?? '';
  const file = parts
    .slice(1)
    .join('/')
    .replace(/\.(md|mdx)$/i, '');
  const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : file;
  return `${lang}/${slug}`;
}

/**
 * RFC 3339 with an explicit offset (`2026-08-25T22:10:00+08:00`). Unquoted
 * YAML timestamps are already a `Date` when they reach the schema (Astro's
 * front matter parser, js-yaml, reads them; a timestamp without an offset is
 * taken as UTC there, never as machine-local time). Quoted values arrive as
 * strings and must carry an offset. `tests/content.test.ts` additionally
 * checks the raw text of every committed post.
 */
const RFC3339_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)$/;
const dateWithOffset = z.union([
  z.date(),
  z
    .string()
    .regex(RFC3339_WITH_OFFSET, 'date must be RFC 3339 with a time zone offset')
    .transform((s) => new Date(s)),
]);

const posts = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/posts',
    generateId,
  }),
  // `.strict()`: a misspelled key (`tag:`, `descripton:`) fails the build
  // instead of silently dropping the tags or the description.
  schema: z
    .object({
      title: z.string().min(1),
      date: dateWithOffset,
      updated: dateWithOffset.optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      slug: z.string().optional(),
      translationKey: z.string().optional(),
      aliases: z.array(z.string()).default([]),
    })
    .strict(),
});

const pages = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/pages',
    generateId,
  }),
  schema: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
    })
    .strict(),
});

export const collections = { posts, pages };
