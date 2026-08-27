/**
 * Subset the code font. The full Fira Code VF (Latin, Greek, Cyrillic, all
 * weights) is 113 KB and is charged against LCP on slow mobile connections.
 * Code on this site only needs Latin plus punctuation, arrows and box drawing,
 * and only weight 400 (`codeFontWeight` in ec.config.mjs), so the weight axis
 * is pinned at 400: 29 KB. The `calt`/`liga` ligatures survive (harfbuzz keeps
 * every glyph reachable through the layout tables).
 *
 *   bun run font           # writes src/assets/fonts/FiraCode-latin-400.woff2
 *
 * Re-run after replacing `FiraCode-VF.woff2`; the output is committed so a
 * normal build never needs this script.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'src/assets/fonts/FiraCode-VF.woff2');
const output = path.join(root, 'src/assets/fonts/FiraCode-latin-400.woff2');

/** Inclusive code point ranges kept in the subset. */
const RANGES: [number, number][] = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1 Supplement
  [0x2000, 0x206f], // General punctuation (dashes, quotes, ellipsis, ZW*)
  [0x2190, 0x21ff], // Arrows
  [0x2500, 0x257f], // Box drawing
  [0x2580, 0x259f], // Block elements
];

let text = '';
for (const [from, to] of RANGES)
  for (let cp = from; cp <= to; cp++) text += String.fromCodePoint(cp);

const source = readFileSync(input);
const result = await subsetFont(source, text, {
  targetFormat: 'woff2',
  variationAxes: { wght: 400 },
});
writeFileSync(output, result);
console.info(
  `${path.relative(root, input)} (${source.length} B) -> ${path.relative(root, output)} (${result.length} B)`,
);
