/**
 * Turn an `.mdx` post body into plain markdown for the feed and the
 * Markdown copies (`llms.ts`): drop `import` lines and MDX brace comments,
 * turn the link-like content component (YouTube) into a link to the same
 * resource and the interactive chart (CpuDayChart) into its static image.
 */

/** Attribute value of `name` in a JSX-like tag string (`<YouTube id="x" />`). */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return m?.[1];
}

export function mdxToMarkdown(body: string): string {
  return body
    .replace(/^import\s[^\n]*\n?/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<YouTube\b([^>]*?)\/?>(?:\s*<\/YouTube>)?/g, (tag) => {
      const id = attr(tag, 'id');
      if (!id) return '';
      const url = `https://www.youtube.com/watch?v=${id}`;
      return `[YouTube: ${url}](${url})`;
    })
    .replace(/<CpuDayChart\b([^>]*?)\/?>(?:\s*<\/CpuDayChart>)?/g, (tag) => {
      const image = attr(tag, 'image');
      if (!image) return '';
      return `![${attr(tag, 'alt') ?? ''}](${image})`;
    });
}
