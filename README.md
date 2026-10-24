# bugs.cc

Kevin Cui's personal blog. An Astro 7 static site, English and Chinese, light and dark themes (OS preference plus a toggle), hosted on GitHub Pages (`bugs.cc`).

## Setup

- [Vite+](https://viteplus.dev/) (`vp`, global CLI) for the toolchain: format, lint, type-aware lint, tests, and the task runner.
- Node 26 (`.node-version`) and bun 1.4.4 (`devEngines.packageManager` in `package.json`), both resolved by `vp env`. bun is only the package manager. Do not use `bun --bun astro`.

```sh
vp install
```

## Commands

`vp dev` / `vp build` / `vp preview` are Vite+ built-ins that run plain Vite, not Astro. Run this project's scripts with `vp run <script>` (or `vpr <script>`).

| Command                          | What it does                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vpr dev`                        | Dev server                                                                                                                                                                           |
| `vpr build`                      | Build to `dist/` (always `--force`; see AGENTS.md for why), then index it for search (`pagefind --site dist`)                                                                        |
| `vpr preview`                    | Preview `dist/`                                                                                                                                                                      |
| `vpr check`                      | `astro check`: typechecks `.astro` files and generates the `.astro/` content types that `vp check` needs                                                                             |
| `vp check` / `vp check --fix`    | Format check, lint, and type-aware lint with type checks in one pass. Config: the `fmt` and `lint` blocks in `vite.config.ts`. `.astro` files are formatted by oxfmt's Astro support |
| `vpr lint` / `fmt` / `fmt:check` | `vp lint --deny-warnings` plus markdownlint; `vp fmt`                                                                                                                                |
| `vpr lint:md` / `lint:md:fix`    | markdownlint on every `.md` / `.mdx` (README, posts, pages); `:fix` rewrites what is fixable. Config: `.markdownlint-cli2.jsonc`                                                     |
| `vp test run`                    | Vitest (`vitest.config.ts`): source-level content checks plus unit tests, no prior build needed. `vp test watch` (or `vpr test:watch`) for watch mode                                |
| `vpr img`                        | Compress PNGs and JPEGs under `public/images/`; `--check` only checks, used as a CI gate                                                                                             |
| `vpr og` / `favicon` / `font`    | Regenerate the OG image, favicon, and code-font subset. Only needed when those assets change.                                                                                        |
| `vpr lh`                         | After a build, run Lighthouse on the main pages (desktop + mobile). Reports go to `.lh/`.                                                                                            |

Scripts under `scripts/` run with `vpx` (Node with TypeScript support).

CI on pull requests and on pushes outside `main` sets up Node and bun with `voidzero-dev/setup-vp`, then runs `vpr check`, `vp check --deny-warnings`, `vpr lint:md`, `vp test run`, `vpr img --check`, and `vpr build` in that order. On a push to `main`, `deploy.yml` runs the same steps and publishes to GitHub Pages only if they all pass.

## Search

`/search/` and `/zh/search/` are full-text search over the posts, built on [Pagefind](https://pagefind.app/). `vpr build` runs `pagefind --site dist` after `astro build`, which indexes every `<article data-pagefind-body>` (post pages only; the table of contents, byline extras and the reply links are `data-pagefind-ignore`) per language from `<html lang>` and writes the index to `dist/pagefind/`. The search page (`src/components/pages/SearchPage.astro`) loads `pagefind.js` and the index chunks only after the reader types, so no other page pays for it. `vpr dev` has no index: the page reports search as unavailable there.

## Analytics

PostHog (EU Cloud, project `bugs.cc`) through the Cloudflare Worker at `t.bugs.cc`, so the browser never contacts a posthog.com host. A small inline loader (`src/components/Analytics.astro`) appends the hosted `array.js` only after the `load` event, in an idle slot, and once a prerendered page is actually shown, so it cannot delay the page. Config: `SITE.posthog` in `src/lib/site.ts`. Worker source: `cloudflare/posthog-proxy.worker.js`, deployed with `CLOUDFLARE_API_TOKEN=... vp dlx wrangler@latest deploy -c cloudflare/wrangler.toml` (the custom domain `t.bugs.cc` is a route in `cloudflare/wrangler.toml`). Not loaded by `vpr dev`; `vpr preview` reports as an internal user.

## Writing posts

Create `src/content/posts/<lang>/<slug>.md` (use `.mdx` when the post needs a component). The file name is the URL: `/posts/<slug>/` or `/zh/posts/<slug>/`.

```yaml
---
title: Post title
date: 2026-08-25T22:10:00+08:00 # timezone offset required
updated: 2026-08-26T10:00:00+08:00 # optional
description: optional; defaults to the first 160 characters of the opening paragraph
tags: [astro, web security] # lowercase
draft: false
translationKey: my-post # same value on both language versions to link them
aliases: [/zh/p/old-url/] # old URL, full path (language prefix and trailing slash)
---
```

- Slugs are lowercase letters, digits, and `-` only (a `.` is allowed in version numbers).
- Start the body at `##`. If a heading contains Chinese, add `{#id}` at the end of the line for an ASCII anchor (write `\{#id\}` in `.mdx`).
- Put images in `public/images/<slug>/` and reference them as `/images/<slug>/x.png`. Do not hotlink off-site images. Run `vpr img` before committing.
- Images get `width`/`height` and lazy loading automatically. The first image of a post is loaded eagerly (`fetchpriority="high"`) when it sits near the top, since it is then the page's LCP element; an explicit `loading=` attribute on an `<img>` is kept as written.
- Code blocks support Expressive Code `title=` / `{1,3-5}` / `ins=` / `del=` / `collapse=`, and comment markers `// [!code highlight]`, `// [!code ++]`, `// [!code --]`, `// [!code word:foo]`.
- Adjacent code blocks tagged `group` (for example ` ```cpp title="a.h" group `) render as one block with tabs; the `title` is the tab label.

Full conventions, routes, and implementation decisions are in [AGENTS.md](AGENTS.md).
