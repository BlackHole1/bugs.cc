import { markdownToHtml, type HastPluginList } from 'satteri';

export interface AstroData {
  frontmatter: Record<string, unknown>;
  headings: { depth: number; slug: string; text: string }[];
  localImagePaths: Set<string>;
  remoteImagePaths: Set<string>;
}

/** Compile markdown through Sätteri with the same `data.astro` bag Astro seeds. */
export async function compile(source: string, hastPlugins: HastPluginList, fileURL?: URL) {
  const astro: AstroData = {
    frontmatter: {},
    headings: [],
    localImagePaths: new Set(),
    remoteImagePaths: new Set(),
  };
  const result = await markdownToHtml(source, {
    hastPlugins,
    features: { gfm: true, smartPunctuation: true },
    ...(fileURL ? { fileURL } : {}),
    data: { astro },
  });
  return { html: result.html, astro };
}
