/**
 * Generate the favicons from the avatar (`src/assets/avatar.jpg`):
 * `public/favicon.ico` (32x32, circular, PNG-compressed ICO),
 * `public/favicon.png` (192x192, circular) and `public/apple-touch-icon.png`
 * (180x180, square and opaque; iOS rounds the corners itself).
 * Run with `bun run favicon`. Uses sharp (also Astro's image service).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src', 'assets', 'avatar.jpg');
const publicDir = path.join(root, 'public');
/** Palette PNGs: a photo at these sizes is a third of the size of a truecolour PNG. */
const PNG = { compressionLevel: 9, palette: true, quality: 90 } as const;

/** The avatar resized to `size` and cut to a circle (transparent corners). */
async function circle(size: number): Promise<Buffer> {
  const half = size / 2;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${half}" cy="${half}" r="${half}"/></svg>`,
  );
  return sharp(source)
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png(PNG)
    .toBuffer();
}

/**
 * Wrap one PNG in an ICO container (ICONDIR + ICONDIRENTRY + image). Every
 * current browser reads PNG-compressed ICO entries.
 */
function ico(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // number of images
  header.writeUInt8(size, 6); // width
  header.writeUInt8(size, 7); // height
  header.writeUInt8(0, 8); // palette size (none)
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(header.length, 18); // image offset
  return Buffer.concat([header, png]);
}

function write(name: string, data: Buffer): void {
  const out = path.join(publicDir, name);
  writeFileSync(out, data);
  console.info(`wrote ${path.relative(root, out)} (${data.length} bytes)`);
}

write('favicon.ico', ico(await circle(32), 32));
write('favicon.png', await circle(192));
write('apple-touch-icon.png', await sharp(source).resize(180, 180).png(PNG).toBuffer());
