# git-browse — AI Agent Notes

## What This Project Is

A Docker-based, read-only web UI for browsing a git repo's working tree in a browser. Powered by
[markserv](https://github.com/markserv/markserv) (a Node.js markdown/directory server). All
customisation is layered on top of markserv without forking it.

## Architecture

### Customisation Strategy

markserv is installed globally inside the Docker image and then **monkey-patched at build time**.
`src/patch-server.js` applies string-replacement patches to markserv's `server.js` before the
server starts. Patch fragments live in `src/patches/`.

Current patches (in application order):

| # | Fragment | Target in `server.js` | Purpose |
|---|---|---|---|
| 1 | `src/patches/other.js` | `else { // Other: Browser requests...` | Code highlighting, media viewers, binary detection, plain-text fallback |
| 2 | `src/patches/dir.js` | `} else if (isDir) {` | Directory listing + README auto-render |
| 3 | `src/patches/html.js` | `} else if (isHtml) {` | Sandboxed HTML preview + source toggle |
| 4 | `src/patches/markdown.js` | `if (isMarkdown) {` | Rendered preview + raw source toggle |

When adding a new patch, inject it before `const prettyPath = filePath` (line ~426 in
`server.js`) — immediately after the `isMarkservUrl` early-return block. This is the cleanest
entry point for new virtual route handlers.

**Test fixture:** `test/fixtures/server-original.js` is a snapshot of the unpatched markserv
`server.js`. Tests validate patches apply cleanly against it. Keep it in sync with the installed
markserv version.

### Client-Side Scripts

All vanilla JS, ES5-style IIFEs. No framework, no bundler. Copied into markserv's templates
directory at build time and injected into HTML templates via `sed` in the Dockerfile.

| Script | Purpose |
|---|---|
| `src/filetree.js` | Resizable sidebar file tree with expand/collapse, caching, scroll persistence |
| `src/theme-toggle.js` | Dark / light / auto theme cycle button |
| `src/mermaid-init.js` | Mermaid diagram rendering (ES module, loaded from CDN) |
| `src/offline-check.js` | Offline detection, toast notification, auto-reconnect polling |
| `src/preview-toggle.js` | Preview / source panel switcher for markdown and HTML |

### CSS

`src/dark.css` is appended to markserv's `markserv.css` at build time. Follows the pattern:

1. Light-mode defaults (no selector prefix)
2. `@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) ... }` — OS dark, no override
3. `html[data-theme="dark"] ...` — user-forced dark

CSS custom properties for theming are defined on `:root` in `src/dark.css`.

### Docker / Runtime

- Image: `node:lts-alpine`
- markserv installed globally inside the container only
- Repo mounted read-only at `/var/www`
- Live reload on a separate port (default 35729), watches working tree — **excludes `.git/`**
- `start.sh` finds free ports, derives a deterministic compose project name from the repo path

## Development Rules

- **Never `npm install -g`** on the host. markserv's global install happens inside Docker only.
  All host-side Node tooling (tests etc.) must use locally installed modules.
- **No frontend framework or bundler.** Keep client scripts as plain ES5 IIFEs.
- **No CDN dependencies for critical path** — only Mermaid (non-critical, gracefully skipped if offline).
- All features are **read-only** — no write operations on the mounted repo, ever.
- **Fast startup is a priority.** Minimise Docker image size and build time. Avoid heavy
  dependencies. Prefer lazy-loading and incremental rendering over blocking on large data sets.
- **Conventional Commits** — all commit messages must use the conventional commits format:
  `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`, etc.
  Scope is optional but encouraged, e.g. `feat(git-dashboard):`, `fix(filetree):`.

## Running

```bash
# Serve the current directory
./start.sh

# Serve a specific repo
./start.sh /path/to/repo

# Run tests (no npm install needed — uses Node built-in test runner)
npm test
```

## Key Constraints to Keep in Mind

- The test fixture `test/fixtures/server-original.js` must match the markserv version in the
  Dockerfile. If markserv is upgraded, update the fixture.
- Patch target strings in `src/patch-server.js` are **exact** matches against `server.js`. Each
  patch has a guard that exits non-zero if the target is not found — a broken build beats a
  silently mis-patched server.
- `.git/` is excluded from livereload watching. Any feature that reacts to git state changes
  (e.g. the git dashboard) must use client-side polling, not livereload.
