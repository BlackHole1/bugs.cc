# bugs.cc

Kevin Cui's personal blog. An Astro 7 static site, English and Chinese, dark theme only, hosted on GitHub Pages (`bugs.cc`).

## Setup

- Node 26 (`.node-version`)
- bun 1.4 (`.bun-version`), used only as the package manager and script runner. Do not use `bun --bun astro`.

```sh
bun install
```

## Commands

| Command                                        | What it does                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                                  | Dev server                                                                                                                       |
| `bun run build`                                | Build to `dist/` (always `--force`; see AGENTS.md for why)                                                                       |
| `bun run preview`                              | Preview `dist/`                                                                                                                  |
| `bun run check` / `lint` / `fmt` / `fmt:check` | Typecheck, oxlint + markdownlint, format                                                                                         |
| `bun run lint:md` / `lint:md:fix`              | markdownlint on every `.md` / `.mdx` (README, posts, pages); `:fix` rewrites what is fixable. Config: `.markdownlint-cli2.jsonc` |
| `bun run test`                                 | vitest: source-level content checks plus unit tests, no prior build needed                                                       |
| `bun run img`                                  | Compress PNGs and JPEGs under `public/images/`; `--check` only checks, used as a CI gate                                         |
| `bun run og` / `favicon` / `font`              | Regenerate the OG image, favicon, and code-font subset. Only needed when those assets change.                                    |
| `bun run lh`                                   | After a build, run Lighthouse on the main pages (desktop + mobile). Reports go to `.lh/`.                                        |

CI on pull requests and on pushes outside `main` runs lint, fmt:check, check, test, img --check, and build in that order. On a push to `main`, `deploy.yml` runs the same steps and publishes to GitHub Pages only if they all pass.

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
- Put images in `public/images/<slug>/` and reference them as `/images/<slug>/x.png`. Do not hotlink off-site images. Run `bun run img` before committing.
- Images get `width`/`height` and lazy loading automatically. The first image of a post is loaded eagerly (`fetchpriority="high"`) when it sits near the top, since it is then the page's LCP element; an explicit `loading=` attribute on an `<img>` is kept as written.
- Code blocks support Expressive Code `title=` / `{1,3-5}` / `ins=` / `del=` / `collapse=`, and comment markers `// [!code highlight]`, `// [!code ++]`, `// [!code --]`, `// [!code word:foo]`.

Full conventions, routes, and implementation decisions are in [AGENTS.md](AGENTS.md).
