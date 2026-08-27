/**
 * Generate the static default social image `public/img/og.png` (1200x630).
 * Run with `bun run og`. Uses sharp (also Astro's image service).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'img', 'og.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#101010"/>
  <rect x="80" y="80" width="1040" height="470" rx="24" fill="#171717" stroke="#2a2a2a" stroke-width="2"/>
  <text x="600" y="300" text-anchor="middle" font-family="Verdana, Geneva, DejaVu Sans, sans-serif" font-size="72" font-weight="bold" fill="#f2f2f2">Kevin Cui's Blog</text>
  <text x="600" y="390" text-anchor="middle" font-family="Verdana, Geneva, DejaVu Sans, sans-serif" font-size="36" fill="#6fbf9a">bugs.cc</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, png);
console.info(`wrote ${path.relative(root, out)} (${png.length} bytes)`);
