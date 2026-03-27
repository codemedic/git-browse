# Should we drop markserv?

**TL;DR: Yes. The project has outgrown it. The patch layer is the most fragile part of the
codebase and exists solely because we cannot modify markserv directly.**

---

## What markserv still provides (unpatched)

| Capability | Notes |
|---|---|
| Port binding + CLI flags | `--port`, `--address`, `--livereloadport`, `--browser` |
| `{markserv}` static asset route | Serves files from its own `templates/` dir |
| `marked` markdown → HTML | Used inside our patched route handlers |
| highlight.js syntax highlighting | Used inside our patched route handlers |
| chokidar + ws livereload | We override `filterRefresh` to apply gitignore rules |
| Base HTML templates | `markdown.html`, `directory.html` — we inject into these via `sed` |

Everything else — every route handler, every response shape, the git dashboard, file search,
binary detection, HTML preview, directory listing — is implemented in our patches.

---

## The patch layer: what it costs

```
src/patches/other.js        169 lines  — code highlighting, media, binary, plain-text fallback
src/patches/dir.js           52 lines  — directory listing + README auto-render
src/patches/html.js          41 lines  — sandboxed HTML preview + source toggle
src/patches/markdown.js      50 lines  — rendered preview + raw source toggle
src/patches/git-state.js    215 lines  — /_git virtual route (branches, worktrees, log, diff)
src/patches/files.js        131 lines  — /_files/search virtual route
src/patches/livereload.js    26 lines  — filterRefresh override for gitignore
src/patch-server.js         226 lines  — string-replacement engine that applies all of the above
                            ─────────
                            910 lines  of surgery on a package we don't own
```

### Why this hurts

- **Fragile by design.** Each patch targets an exact string in markserv's `server.js`. Any
  markserv upgrade can silently break a patch — or worse, apply it to the wrong location.
- **Test fixture debt.** `test/fixtures/server-original.js` is a snapshot of markserv's
  `server.js`. It must be manually kept in sync with whatever version is in the Dockerfile.
- **Dockerfile surgery.** 10+ client scripts are copied into markserv's `templates/` directory
  and injected into its HTML templates via `sed`. Fragile, hard to read, impossible to test.
- **No direct iteration.** To change any server behaviour you must edit a patch fragment, not
  the actual code. The indirection adds cognitive overhead to every change.

---

## What a replacement server would need

All of this is straightforward Node — no framework required, though Express would be fine.

| Capability | Library / approach |
|---|---|
| HTTP file serving | `fs` + `path`, or `serve-static` |
| Markdown → HTML | `marked` (already a transitive dep via markserv) |
| Syntax highlighting | `highlight.js` (same) |
| Directory listing | Already implemented in `src/patches/dir.js` — port directly |
| Git routes (`/_git`) | Already in `src/patches/git-state.js` — port directly |
| File search (`/_files`) | Already in `src/patches/files.js` — port directly |
| Live reload server | `chokidar` + `ws`, with our gitignore filter from `livereload.js` |
| HTML templates | Write our own — we already own all the CSS and client JS |

Estimated server size: **~300–400 lines**. The client-side code (`src/*.js`, `src/dark.css`)
carries over completely unchanged.

---

## What disappears

- `src/patches/` — entire directory gone
- `src/patch-server.js` — gone
- `test/fixtures/server-original.js` — gone
- All `sed` injection in the Dockerfile — gone
- The `ignore` npm global install in the Dockerfile — absorbed into `package.json`
- The markserv global install — replaced by our own server entry point

The Dockerfile shrinks to: install deps, copy source, expose ports, run server.

---

## What stays

- All of `src/*.js` (client scripts) — unchanged
- `src/dark.css` — unchanged
- `compose.yml`, `start.sh` — minimal changes (different entry point)
- `package.json` — add `marked`, `highlight.js`, `chokidar`, `ws` as direct deps

---

## Recommendation

Do the rewrite when you next need to touch server-side behaviour. The patch layer makes every
server-side change harder than it should be. A clean server removes the fragility, eliminates
the test fixture maintenance, and makes the Dockerfile legible.

The client-side code is the bulk of the project now. Free it from the scaffolding.
