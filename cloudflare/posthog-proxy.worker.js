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
 *   deploy.yml also drops them; they are simply fetched again).
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
  let response = await caches.default.match(request);
  if (!response) {
    response = await fetch(`https://${ASSET_HOST}${pathWithParams}`);
    ctx.waitUntil(caches.default.put(request, response.clone()));
  }
  return response;
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
