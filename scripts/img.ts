/**
 * Optimise article images under `public/images/` in place. File names, URLs and
 * pixel dimensions never change (the build reads width/height from these files).
 *
 * Only PNG data is touched (detected by content, not extension: a few `.png`
 * files are really JPEGs and are left alone, as are GIF/JPEG). Truecolour PNGs
 * are re-encoded as 8-bit palette PNGs (libimagequant, dithered), which is
 * lossy but visually lossless for screenshots and 60-80 % smaller. Every
 * result is checked before it is written:
 *
 *   1. it must be at least 2 % (and 256 bytes) smaller than the current file,
 *      otherwise nothing is written;
 *   2. the PSNR against the current pixels must reach `IMG_MIN_PSNR` (default
 *      40 dB); a photo-like image that quantises badly falls back to a
 *      lossless re-encode (deflate only) and is written only when smaller.
 *
 * Files that are already palette PNGs only get the lossless pass (an exact
 * palette, so pixels are identical), which makes the script idempotent: a
 * second run finds nothing to write and reports 0 changed files.
 *
 *   bun run img                   all of public/images/
 *   bun run img public/images/x/  only these files or directories
 *   bun run img --check           write nothing; exit 1 when a file would change
 *
 * Env: IMG_QUALITY (libimagequant target, default 90), IMG_MIN_PSNR (default 40).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type PngOptions } from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const targets = argv.filter((a) => !a.startsWith('--'));
const roots =
  targets.length > 0
    ? targets.map((t) => path.resolve(root, t))
    : [path.join(root, 'public', 'images')];
const QUALITY = Number(process.env.IMG_QUALITY ?? 90);
const MIN_PSNR = Number(process.env.IMG_MIN_PSNR ?? 40);
const EFFORT = 10;
/** A result is written only when it saves at least this much (see `optimise`). */
const MIN_GAIN_RATIO = 0.02;
const MIN_GAIN_BYTES = 256;

/** Palette (lossy, libimagequant) and lossless (deflate only) PNG encoders. */
const PALETTE = { palette: true, quality: QUALITY, effort: EFFORT, compressionLevel: 9 } as const;
const EXACT = { palette: true, quality: 100, effort: EFFORT, compressionLevel: 9 } as const;
const LOSSLESS = {
  palette: false,
  effort: EFFORT,
  compressionLevel: 9,
  adaptiveFiltering: true,
} as const;

type Mode = 'palette' | 'exact' | 'lossless';
interface Result {
  file: string;
  before: number;
  after: number;
  mode?: Mode;
  psnr?: number | undefined;
  note?: string;
}

function walk(p: string): string[] {
  const st = statSync(p);
  if (st.isFile()) return [p];
  return readdirSync(p, { withFileTypes: true })
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .flatMap((d) => walk(path.join(p, d.name)));
}

/**
 * True for a palette PNG (IHDR colour type 3). Read from the header because
 * sharp's metadata no longer reports `paletteBitDepth` for such files.
 */
function isIndexedPng(png: Buffer): boolean {
  return png.length > 25 && png.readUInt32BE(12) === 0x49484452 /* IHDR */ && png[25] === 3;
}

/** Decoded 8-bit RGBA pixels (sRGB), the basis for PSNR. */
function pixels(input: Buffer): Promise<Buffer> {
  return sharp(input).ensureAlpha().raw().toBuffer();
}

/** Peak signal-to-noise ratio in dB over RGBA; Infinity when identical. */
function psnr(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  if (sum === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / (sum / a.length));
}

async function encode(input: Buffer, options: PngOptions): Promise<Buffer> {
  const out = await sharp(input).png(options).toBuffer();
  const [a, b] = await Promise.all([sharp(input).metadata(), sharp(out).metadata()]);
  if (a.width !== b.width || a.height !== b.height) throw new Error('dimensions changed');
  return out;
}

async function optimise(file: string): Promise<Result> {
  const rel = path.relative(root, file);
  const input = readFileSync(file);
  const before = input.length;
  const meta = await sharp(input).metadata();
  if (meta.format !== 'png') {
    const note =
      path.extname(file).toLowerCase() === '.png'
        ? `skipped: ${meta.format} data in a .png file`
        : `skipped: ${meta.format}`;
    return { file: rel, before, after: before, note };
  }

  let out: Buffer;
  let mode: Mode;
  let quality: number | undefined;
  if (isIndexedPng(input)) {
    // Already a palette PNG: an exact re-encode is lossless, so only the container can shrink.
    out = await encode(input, EXACT);
    mode = 'exact';
  } else {
    out = await encode(input, PALETTE);
    mode = 'palette';
    const [orig, next] = await Promise.all([pixels(input), pixels(out)]);
    quality = psnr(orig, next);
    if (quality < MIN_PSNR) {
      out = await encode(input, LOSSLESS);
      mode = 'lossless';
    } else {
      // Settle: an exact re-encode of the palette result sometimes packs the palette
      // tighter. Pixels are identical, and the file becomes a fixed point for later runs.
      const settled = await encode(out, EXACT);
      if (settled.length < out.length) out = settled;
    }
  }

  // A re-encode of an already optimised file can differ by a few bytes (palette order,
  // deflate); only a real gain is written so that repeated runs leave files untouched.
  if (out.length > before - Math.max(MIN_GAIN_BYTES, before * MIN_GAIN_RATIO)) {
    return { file: rel, before, after: before, mode, psnr: quality, note: 'already optimal' };
  }
  if (!check) writeFileSync(file, out);
  return { file: rel, before, after: out.length, mode, psnr: quality };
}

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
const files = roots.flatMap(walk);
const started = performance.now();
const results = await pool(files, Math.min(8, availableParallelism()), optimise);

const changed = results.filter((r) => r.after < r.before);
const skipped = results.filter((r) => r.note?.startsWith('skipped'));
for (const r of results) {
  if (r.after < r.before) {
    const pct = (((r.before - r.after) / r.before) * 100).toFixed(0).padStart(2);
    const q =
      r.psnr === undefined
        ? ''
        : r.psnr === Infinity
          ? ' (identical)'
          : ` (${r.psnr.toFixed(1)} dB)`;
    console.info(
      `${check ? 'would write' : 'wrote'}  ${r.file}: ${kb(r.before)} -> ${kb(r.after)} -${pct}% ${r.mode}${q}`,
    );
  } else if (r.note?.startsWith('skipped')) {
    console.info(`skip   ${r.file}: ${r.note}`);
  }
}
const before = results.reduce((s, r) => s + r.before, 0);
const after = results.reduce((s, r) => s + r.after, 0);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.info(
  `\n${results.length} files, ${changed.length} ${check ? 'would change' : 'changed'}, ` +
    `${skipped.length} skipped (not PNG): ${kb(before)} -> ${kb(after)} in ${seconds}s`,
);
if (check && changed.length > 0) {
  console.error('\nunoptimised images found; run `bun run img` and commit the result');
  process.exitCode = 1;
}
