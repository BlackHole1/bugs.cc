import type { HastPluginEntry } from 'satteri';
import { externalLinks } from './external-links';
import { footnotes } from './footnotes';
import { headingAnchors } from './heading-anchors';
import { imageDimensions } from './image-dimensions';
import { langOfFile } from './lang';
import { readingTime } from './reading-time';

export { externalLinks, footnotes, headingAnchors, imageDimensions, langOfFile, readingTime };

/** The full HAST plugin chain used by astro.config.ts, in run order. */
export function blogHastPlugins(publicDir: string): HastPluginEntry[] {
  return [
    headingAnchors(),
    externalLinks(),
    imageDimensions({ publicDir }),
    readingTime(),
    // After heading-anchors: it removes the anchor from the hidden footnotes heading.
    footnotes(),
  ];
}
