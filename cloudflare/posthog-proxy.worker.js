/**
 * Cloudflare Worker "posthog-proxy": reverse proxy for PostHog (EU Cloud) on
 * https://t.bugs.cc, so the site never contacts a posthog.com host and ad
 * blockers do not see one. Deployed with wrangler (see wrangler.toml next to
 * this file); the custom domain `t.bugs.cc` is a route there, Cloudflare
 * creates the DNS record and the certificate itself. Not part of the Astro
 * build.
 *
 * Based on https://posthog.com/docs/advanced/proxy/cloudflare:
 * - `/static/*` and `/array/*` (SDK, lazy-loaded extras, remote config) come
 *   from the assets host and are cached at the edge (the zone-wide purge in
 *   deploy.yml also drops them; they are simply fetched again). The assets
 *   host only answers `Access-Control-Allow-Origin` for `/array/*` when the
 *   request carries an `Origin`, and the edge cache ignores `Origin`, so a
 *   cached copy without the header would break the SDK's `crossorigin`
 *   script and `fetch`: every asset response gets `*` here instead, and an
 *   OPTIONS preflight is answered directly.
 * - Everything else (`/e/`, `/flags/`, `/i/v0/e/`, ...) is forwarded to the
 *   API host with the body buffered, cookies removed and the real client IP
 *   in `X-Forwarded-For` (otherwise every visitor is located at the
 *   Cloudflare data centre).
 * The site's own PostHog config lives in src/lib/analytics.ts.
 */

const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';

async function handleRequest(request, ctx) {
  const url = new URL(request.url);
  const pathWithParams = url.pathname + url.search;

  if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/array/')) {
    return retrieveAsset(request, pathWithParams, ctx);
  }
  return forwardRequest(request, pathWithParams);
}

async function retrieveAsset(request, pathWithParams, ctx) {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }));
  }
  let response = await caches.default.match(request);
  if (!response) {
    response = await fetch(`https://${ASSET_HOST}${pathWithParams}`);
    ctx.waitUntil(caches.default.put(request, response.clone()));
  }
  return withCors(response);
}

/** Public, credential-less assets: allow every origin (the SDK loads them with `crossorigin`). */
function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  // `*` is invalid together with credentials, and these assets never need them.
  headers.delete('Access-Control-Allow-Credentials');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function forwardRequest(request, pathWithParams) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const originHeaders = new Headers(request.headers);
  originHeaders.delete('cookie');
  originHeaders.set('X-Forwarded-For', ip);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const originRequest = new Request(`https://${API_HOST}${pathWithParams}`, {
    method: request.method,
    headers: originHeaders,
    body: hasBody ? await request.arrayBuffer() : null,
    redirect: request.redirect,
  });

  return fetch(originRequest);
}

export default {
  async fetch(request, _env, ctx) {
    return handleRequest(request, ctx);
  },
};
