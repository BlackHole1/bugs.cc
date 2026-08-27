/**
 * Lighthouse helper: builds the site (unless LH_SKIP_BUILD=1), serves `dist/`
 * with a small static server on a free port (same semantics as GitHub Pages:
 * `/x/` -> `x/index.html`, unknown paths -> `404.html`), runs Lighthouse for
 * every page in both presets (desktop and the default mobile) and writes
 * `<page>-<preset>.report.{json,html}`. Finally prints a score table plus every
 * audit that scored below 1. Exit code 1 when any category is below 100.
 *
 * A built-in server is used instead of `astro preview` because Astro 7's
 * preview is a background daemon that refuses to start a second instance.
 *
 *   bun run lh                  all pages in PAGES
 *   bun run lh /zh/ /posts/     only these paths
 *
 * Env:
 *   LH_OUT         output directory (default `.lh/`)
 *   CHROME_PATH    Chrome binary (default: the macOS Google Chrome app)
 *   LH_SKIP_BUILD  `1` reuses the existing dist/
 *   LH_PRESETS     comma list, default `desktop,mobile`
 *   LH_BLOCK       comma list of URL patterns to block (`--blocked-url-patterns`).
 *                  Default: none.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.resolve(root, process.env.LH_OUT ?? '.lh');
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Pages covered by SPEC section 9 (home, lists, tag page, posts with images/code, 404). */
const PAGES = [
  '/',
  '/zh/',
  '/posts/',
  '/zh/posts/',
  '/tags/',
  '/zh/tags/electron/',
  '/posts/troubleshooting-bun-kafkajs-cpu-spin/',
  '/zh/posts/troubleshooting-bun-kafkajs-cpu-spin/',
  '/zh/posts/talk-about-how-to-bypass-waf/',
  '/zh/posts/reading-notes-from-lucene-to-elasticsearch-full-text-search/',
  '/404.html',
];
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type Preset = 'desktop' | 'mobile';

const argPaths = process.argv.slice(2).filter((a) => a.startsWith('/'));
const pages = argPaths.length > 0 ? argPaths : PAGES;
const presets = (process.env.LH_PRESETS ?? 'desktop,mobile')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is Preset => p === 'desktop' || p === 'mobile');

/** Run a command to completion without blocking the event loop (the static server must keep serving). */
function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code})`));
    });
  });
}

/** File-name-safe label for a path: `/zh/posts/x/` -> `zh-posts-x`, `/` -> `home`. */
function slugify(p: string): string {
  const s = decodeURIComponent(p)
    .replace(/^\/|\/$/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-');
  return s || 'home';
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/** Resolve a request path to a file under dist/ (directory URLs -> index.html). */
function resolveFile(urlPath: string): { file: string; status: number } {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(dist, safe);
  if (!file.startsWith(dist)) return { file: path.join(dist, '404.html'), status: 404 };
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (existsSync(file) && statSync(file).isFile()) return { file, status: 200 };
  return { file: path.join(dist, '404.html'), status: 404 };
}

const COMPRESSIBLE = /^(?:text\/|application\/(?:json|xml|javascript))/;

/** Serve dist/ on a free localhost port (gzip for text like GitHub Pages does). */
function serveDist(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      const { file, status } = resolveFile(pathname);
      let body = existsSync(file) ? readFileSync(file) : Buffer.from('Not found');
      const type = MIME[path.extname(file)] ?? 'application/octet-stream';
      const headers: Record<string, string | number> = {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        Vary: 'Accept-Encoding',
      };
      const gzip =
        (req.headers['accept-encoding'] ?? '').includes('gzip') && COMPRESSIBLE.test(type);
      if (gzip) {
        body = gzipSync(body, { level: 6 });
        headers['Content-Encoding'] = 'gzip';
      }
      headers['Content-Length'] = body.length;
      res.writeHead(status, headers);
      res.end(body);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      if (port) resolve({ server, port });
      else reject(new Error('could not bind a port'));
    });
  });
}

interface LhrAudit {
  id: string;
  title: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
}
interface Lhr {
  categories: Record<string, { score: number | null; auditRefs: { id: string; weight: number }[] }>;
  audits: Record<string, LhrAudit>;
}
interface Result {
  page: string;
  preset: Preset;
  scores: Record<(typeof CATEGORIES)[number], number>;
  failing: string[];
}

function summarize(page: string, preset: Preset, lhr: Lhr): Result {
  const scores = {} as Result['scores'];
  const failing = new Set<string>();
  for (const cat of CATEGORIES) {
    const category = lhr.categories[cat];
    scores[cat] = Math.round((category?.score ?? 0) * 100);
    for (const ref of category?.auditRefs ?? []) {
      const audit = lhr.audits[ref.id];
      if (!audit || audit.score === null || audit.score >= 1) continue;
      if (audit.scoreDisplayMode === 'informative' || audit.scoreDisplayMode === 'manual') continue;
      const value = audit.displayValue ? ` (${audit.displayValue})` : '';
      failing.add(`${cat}/${audit.id}: score ${audit.score}${value} - ${audit.title}`);
    }
  }
  return { page, preset, scores, failing: [...failing] };
}

if (process.env.LH_SKIP_BUILD !== '1' || !existsSync(path.join(root, 'dist/index.html'))) {
  await run('bun', ['run', 'build']);
}
mkdirSync(outDir, { recursive: true });

const blocked = (process.env.LH_BLOCK ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

const { server, port } = await serveDist();
const base = `http://127.0.0.1:${port}`;
const results: Result[] = [];
try {
  for (const page of pages) {
    for (const preset of presets) {
      const name = `${slugify(page)}-${preset}`;
      const outPath = path.join(outDir, name);
      const args = [
        'lighthouse',
        base + encodeURI(page),
        '--output=json',
        '--output=html',
        `--output-path=${outPath}`,
        '--chrome-flags=--headless=new --no-sandbox',
        ...(process.env.LH_VERBOSE ? [] : ['--quiet']),
      ];
      if (preset === 'desktop') args.push('--preset=desktop');
      if (blocked.length > 0) args.push(`--blocked-url-patterns=${blocked.join(',')}`);
      console.info(`\nlighthouse ${page} [${preset}]`);
      await run('bunx', args, { CHROME_PATH: chrome });
      const lhr = JSON.parse(readFileSync(`${outPath}.report.json`, 'utf8')) as Lhr;
      results.push(summarize(page, preset, lhr));
    }
  }
} finally {
  server.close();
}

const header = ['page', 'preset', ...CATEGORIES.map((c) => c.slice(0, 4))];
const rows = results.map((r) => [r.page, r.preset, ...CATEGORIES.map((c) => String(r.scores[c]))]);
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
console.info('\n' + line(header));
console.info(line(widths.map((w) => '-'.repeat(w))));
for (const r of rows) console.info(line(r));

let allPerfect = true;
for (const r of results) {
  if (r.failing.length === 0) continue;
  console.info(`\n${r.page} [${r.preset}] audits below 1:`);
  for (const f of r.failing) console.info(`  ${f}`);
  if (CATEGORIES.some((c) => r.scores[c] < 100)) allPerfect = false;
}
console.info(`\nreports: ${outDir}`);
process.exitCode = allPerfect ? 0 : 1;
