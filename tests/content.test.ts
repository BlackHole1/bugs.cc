/**
 * Content invariants.
 *
 * Every post under src/content/posts must have an ASCII file name (the URL slug), a title, a
 * date with an explicit UTC offset, lowercase tags, no body-level h1, only images that exist in
 * public/, ASCII heading ids (an explicit `{#id}` on every heading whose slug is not ASCII),
 * resolvable `#fragment` links, and symmetric translation pairs. Runs against the source
 * files, no build needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger, { slug as slugify } from 'github-slugger';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { asciiSlug } from '@/plugins/heading-anchors';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LANGS = ['en', 'zh'] as const;

type Lang = (typeof LANGS)[number];

interface Post {
  lang: Lang;
  file: string;
  rel: string;
  frontMatter: Record<string, unknown>;
  body: string;
}

function splitFrontMatter(text: string, file: string): { yaml: string; body: string } {
  if (!text.startsWith('---\n')) throw new Error(`${file}: missing front matter`);
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) throw new Error(`${file}: unterminated front matter`);
  return { yaml: text.slice(4, end + 1), body: text.slice(end + 5) };
}

function loadPosts(): Post[] {
  const posts: Post[] = [];
  for (const lang of LANGS) {
    const dir = path.join(POSTS_DIR, lang);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).toSorted()) {
      if (name.startsWith('_') || !/\.mdx?$/.test(name)) continue;
      const file = path.join(dir, name);
      const text = fs.readFileSync(file, 'utf8');
      const { yaml, body } = splitFrontMatter(text, file);
      posts.push({
        lang,
        file,
        rel: path.relative(ROOT, file),
        frontMatter: (parseYaml(yaml) ?? {}) as Record<string, unknown>,
        body,
      });
    }
  }
  return posts;
}

/** Lines of the body that are not inside a fenced code block. */
function proseLines(body: string): string[] {
  const out: string[] = [];
  let fence: { char: string; len: number } | null = null;
  for (const line of body.split('\n')) {
    if (fence) {
      const closer = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (closer !== undefined && closer[0] === fence.char && closer.length >= fence.len)
        fence = null;
      continue;
    }
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const marker = m?.[1];
    const info = m?.[2] ?? '';
    if (marker !== undefined && !(marker[0] === '`' && info.includes('`'))) {
      fence = { char: marker.charAt(0), len: marker.length };
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Strip inline code spans (single-line approximation is enough for these checks). */
function stripInlineCode(line: string): string {
  return line.replace(/(`+)[^`]*?\1/g, '');
}

interface SourceHeading {
  line: string;
  /** Heading text without the `{#id}` marker, inline code and link syntax reduced to text. */
  text: string;
  /** Explicit id from a trailing `{#id}` (`\{#id\}` in MDX), or null. */
  explicit: string | null;
  /** Whether the marker was written in the MDX-escaped form `\{#id\}`. */
  escaped: boolean;
}

/** ATX heading, also inside a blockquote (`> ## ...`), which still renders as a heading. */
const HEADING_RE = /^ {0,3}(?:> ?)*#{1,6}[ \t]+(.*?)[ \t]*$/;
const SOURCE_ID_RE = /\s*(\\?)\{#([^}\\]*)(\\?)\}\s*$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** ATX headings of the prose (outside fences), as the heading-anchors plugin will see them. */
function sourceHeadings(body: string): SourceHeading[] {
  const out: SourceHeading[] = [];
  for (const line of proseLines(body)) {
    const raw = HEADING_RE.exec(line)?.[1];
    if (raw === undefined) continue;
    const marker = SOURCE_ID_RE.exec(raw);
    const text = (marker ? raw.slice(0, marker.index) : raw)
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .trim();
    out.push({
      line,
      text,
      explicit: marker ? (marker[2] ?? '') : null,
      escaped: marker ? marker[1] === '\\' && marker[3] === '\\' : false,
    });
  }
  return out;
}

/** Ids the heading-anchors plugin assigns, in document order (same algorithm). */
function headingIds(headings: readonly SourceHeading[]): string[] {
  const slugger = new GithubSlugger();
  let unnamed = 0;
  return headings.map((h) =>
    slugger.slug(h.explicit || asciiSlug(h.text) || `section-${++unnamed}`),
  );
}

/** Markdown image with its alt text as group 1. */
const MD_IMAGE_ALT_RE = /!\[([^\]]*)\]\(\s*<?[^\s()<>]+>?(?:\s+"[^"]*")?\s*\)/g;
const IMAGE_RE =
  /!\[[^\]]*\]\(\s*<?([^\s()<>]+)>?(?:\s+"[^"]*")?\s*\)|<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

/**
 * Remote images that are allowed to stay hot-linked (exact URLs). Empty: every
 * image lives under public/images; list a URL here only when no local copy can exist.
 */
const ALLOWED_REMOTE_IMAGES: ReadonlySet<string> = new Set<string>();

const posts = loadPosts();

describe('content invariants', () => {
  it('finds posts in both languages', () => {
    expect(posts.length).toBeGreaterThan(0);
    for (const lang of LANGS) expect(posts.some((p) => p.lang === lang)).toBe(true);
  });

  describe.each(posts.map((p) => [p.rel, p] as const))('%s', (_rel, post) => {
    const fm = post.frontMatter;

    it('has a non-empty title', () => {
      expect(typeof fm.title).toBe('string');
      expect((fm.title as string).trim().length).toBeGreaterThan(0);
    });

    it('has a date with an explicit offset', () => {
      // The yaml core schema keeps dates as strings; accept a Date only if a parser upgraded it,
      // but the raw text must still carry an offset.
      const raw = /^date:\s*(.+?)\s*$/m.exec(fs.readFileSync(post.file, 'utf8'))?.[1] ?? '';
      expect(raw).toMatch(
        /^"?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)"?$/,
      );
      expect(Number.isNaN(Date.parse(raw.replace(/"/g, '')))).toBe(false);
    });

    it('has lowercase, trimmed, unique tags', () => {
      const tags = (fm.tags ?? []) as unknown[];
      expect(Array.isArray(tags)).toBe(true);
      for (const t of tags) {
        expect(typeof t).toBe('string');
        expect(t).toBe((t as string).trim().toLowerCase());
        expect((t as string).length).toBeGreaterThan(0);
      }
      expect(new Set(tags).size).toBe(tags.length);
    });

    it('has well-formed aliases when present', () => {
      const aliases = (fm.aliases ?? []) as unknown[];
      expect(Array.isArray(aliases)).toBe(true);
      for (const a of aliases) {
        expect(typeof a).toBe('string');
        expect(a as string).toMatch(/^\/\S+$/);
      }
    });

    it('has no body-level h1 heading', () => {
      for (const line of proseLines(post.body)) {
        expect(line).not.toMatch(/^ {0,3}#(?:[ \t]|$)/);
      }
      // Setext h1 (text followed by ===) must not exist either.
      expect(post.body).not.toMatch(/^\S.*\n {0,3}=+[ \t]*$/m);
    });

    it('references only images that exist in public/', () => {
      for (const line of proseLines(post.body)) {
        for (const m of stripInlineCode(line).matchAll(IMAGE_RE)) {
          const src = m[1] ?? m[2] ?? '';
          if (/^(?:https?:)?\/\//i.test(src)) continue; // checked by "hosts no remote images" below
          expect(src, `${post.rel}: image path must be absolute`).toMatch(/^\//);
          const local = path.join(PUBLIC_DIR, decodeURIComponent(src.split(/[?#]/)[0] ?? ''));
          expect(fs.existsSync(local), `${post.rel}: missing image ${src}`).toBe(true);
        }
      }
    });

    it('hosts no remote images (imgur or any other host); only /images/... and /img/...', () => {
      const offending: string[] = [];
      for (const line of proseLines(post.body)) {
        for (const m of stripInlineCode(line).matchAll(IMAGE_RE)) {
          const src = m[1] ?? m[2] ?? '';
          if (ALLOWED_REMOTE_IMAGES.has(src)) continue;
          if (!/^\/(?:images|img)\//.test(src)) offending.push(src);
        }
      }
      expect(
        offending,
        `${post.rel}: remote or non-public image(s); copy them to public/images/<slug>/ and link the local path`,
      ).toEqual([]);
    });

    it('gives no image the meaningless alt text of its former upload host (Imgur)', () => {
      const offending: string[] = [];
      for (const line of proseLines(post.body)) {
        for (const m of stripInlineCode(line).matchAll(MD_IMAGE_ALT_RE)) {
          if (/^\s*imgur\s*$/i.test(m[1] ?? '')) offending.push(m[0]);
        }
      }
      expect(offending, `${post.rel}: alt "Imgur"; write a descriptive alt text`).toEqual([]);
    });

    it('gives every heading an ASCII id: explicit `{#id}` where the slug would not be ASCII', () => {
      const headings = sourceHeadings(post.body);
      const mdx = post.file.endsWith('.mdx');
      const ids = headingIds(headings);
      const problems: string[] = [];
      for (const [i, h] of headings.entries()) {
        if (h.explicit === null) {
          const slug = slugify(h.text);
          if (!/^[\x20-\x7e]*$/.test(slug))
            problems.push(`"${h.line}": slug "${slug}" is not ASCII; add a short English {#id}`);
          continue;
        }
        if (!ID_RE.test(h.explicit))
          problems.push(`"${h.line}": id must be lowercase a-z0-9 words joined by "-"`);
        // A bare `{` starts an expression in MDX; `.md` files take the plain form.
        if (h.escaped !== mdx)
          problems.push(`"${h.line}": write the marker as ${mdx ? '\\{#id\\}' : '{#id}'}`);
        // The slugger renames a repeated or shadowed explicit id (`intro-1`).
        if (ids[i] !== h.explicit)
          problems.push(`"${h.line}": id "${h.explicit}" collides with another heading`);
      }
      expect(problems, `${post.rel}: heading ids`).toEqual([]);
    });

    it('links only to heading ids that exist in the post', () => {
      const ids = new Set(headingIds(sourceHeadings(post.body)));
      const broken: string[] = [];
      for (const line of proseLines(post.body)) {
        for (const m of stripInlineCode(line).matchAll(/\]\(#([^)\s]+)\)/g)) {
          const target = decodeURIComponent(m[1] ?? '');
          if (!ids.has(target)) broken.push(`#${target}`);
        }
      }
      expect(broken, `${post.rel}: fragment links to missing heading ids`).toEqual([]);
    });

    // Only .mdx posts need component imports; .md posts skip this check.
    it.runIf(post.file.endsWith('.mdx'))('mdx: imports every component it uses', () => {
      const used = new Set([...post.body.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]));
      for (const name of used) {
        expect(post.body, `${post.rel}: missing import for <${name}>`).toMatch(
          new RegExp(`^import ${name} from ["'][^"']+["'];?$`, 'm'),
        );
      }
      // Autolinks are not valid MDX.
      for (const line of proseLines(post.body)) {
        expect(stripInlineCode(line)).not.toMatch(/<https?:\/\/[^\s>]+>/);
      }
    });
  });

  it('translation pairs are symmetric', () => {
    const byKey = new Map<string, Post[]>();
    for (const p of posts) {
      const key = p.frontMatter.translationKey;
      if (key === undefined) continue;
      expect(typeof key).toBe('string');
      const list = byKey.get(key as string) ?? [];
      list.push(p);
      byKey.set(key as string, list);
    }
    for (const [key, list] of byKey) {
      expect(list.length, `translationKey ${key} must be shared by exactly 2 posts`).toBe(2);
      expect(
        new Set(list.map((p) => p.lang)).size,
        `translationKey ${key} must pair different languages`,
      ).toBe(2);
    }
  });

  it('slugs (file names) are lowercase ASCII: a-z0-9 words joined by "-" or "."', () => {
    const bad = posts
      .map((p) => path.basename(p.file).replace(/\.mdx?$/, ''))
      .filter((slug) => !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(slug));
    expect(bad).toEqual([]);
  });

  it('slugs (file names) are unique per language', () => {
    for (const lang of LANGS) {
      const slugs = posts
        .filter((p) => p.lang === lang)
        .map((p) => path.basename(p.file).replace(/\.mdx?$/, ''));
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
});
