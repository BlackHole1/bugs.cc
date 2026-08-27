/**
 * Plain-text excerpt of a markdown body: the first real paragraph, markdown
 * syntax stripped, collapsed whitespace, at most `max` characters. Used as the
 * `meta description` fallback so every page has a non-empty description.
 */

export const EXCERPT_MAX = 160;

const SKIP_LINE = /^\s*(#{1,6}\s|!\[|<[^>]+>\s*$|\||[-*_]{3,}\s*$|import\s|export\s|:::)/;

/** Strip common inline markdown/HTML to readable text. */
export function stripMarkdown(text: string): string {
  return (
    text
      // images -> alt text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // footnote refs (before the link rules, which would keep `^1`)
      .replace(/\[\^[^\]]+\]/g, '')
      // links -> text: inline `[t](u)`, full/collapsed reference `[t][r]`,
      // shortcut reference `[t]` (defined elsewhere in the document)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      .replace(/\[([^\]]+)\]/g, '$1')
      // autolinks
      .replace(/<(https?:\/\/[^>]+)>/g, '$1')
      // inline code
      .replace(/`([^`]*)`/g, '$1')
      // emphasis / strike; `_` only at word boundaries so `snake_case` survives
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, '$1$2')
      .replace(/~~(.*?)~~/g, '$1')
      // html tags
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** First paragraph of a markdown body (code fences and block syntax skipped). */
export function firstParagraph(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const buf: string[] = [];
  let inFence = false;
  let inHtmlBlock = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^\s*<(div|figure|table|details|script|style|iframe|video|pre)\b/i.test(line)) {
      inHtmlBlock = true;
    }
    if (inHtmlBlock) {
      if (/^\s*<\/(div|figure|table|details|script|style|iframe|video|pre)>/i.test(line)) {
        inHtmlBlock = false;
      }
      continue;
    }
    if (line.trim() === '') {
      if (buf.length > 0) break;
      continue;
    }
    if (buf.length === 0 && SKIP_LINE.test(line)) continue;
    // Blockquote and list markers are stripped so the text still reads well.
    buf.push(line.replace(/^\s*(>\s?|[-*+]\s+|\d+\.\s+)/, ''));
  }
  return buf.join(' ');
}

/** Truncate on a character boundary, appending an ellipsis if cut. */
export function truncate(text: string, max = EXCERPT_MAX): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, Math.max(1, max - 1)).join('');
  // Prefer cutting at whitespace for Latin text; CJK has no spaces, keep as-is.
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

export function excerpt(body: string | undefined, max = EXCERPT_MAX): string {
  if (!body) return '';
  return truncate(stripMarkdown(firstParagraph(body)), max);
}
