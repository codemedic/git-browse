# git-browse

A Docker-based local web UI for browsing any git repository — with syntax highlighting, GitHub-flavoured markdown rendering, Mermaid diagrams, and live reload on file changes.

Powered by [markserv](https://github.com/markserv/markserv).

## Features

- **Markdown rendering** — GitHub-flavoured markdown (tables, task lists, fenced code blocks)
- **Mermaid diagrams** — rendered inline from fenced `mermaid` code blocks
- **Syntax highlighting** — for code files browsed directly (`.js`, `.py`, `.go`, `.ts`, `.yml`, and [many more](#supported-file-types))
- **Live reload** — page refreshes automatically when files change on disk; configurable via `LIVERELOAD_PORT`
- **File tree sidebar** — hideable left-hand pane showing the full directory tree from the repository root; expand/collapse state and visibility are persisted in `localStorage`; a `☰` toggle button restores it when hidden
- **README auto-render** — when browsing a directory, any `README.md` (or `readme.md`, `README.markdown`, `README.txt`, etc.) is rendered below the file listing, GitHub-style
- **Plain-text fallback** — files with unrecognised extensions are probed for binary content using a null-byte heuristic; text files render in the browser, confirmed binary files are offered as downloads
- **Dark / light / auto mode** — follows OS preference by default; toggle button to override

## Requirements

- Docker with Compose V2

## Installation

Clone this repository anywhere on your machine:

```sh
git clone https://github.com/codemedic/git-browse.git ~/git-browse
```

Optionally add an alias so it's available from any directory:

```sh
# ~/.bashrc or ~/.zshrc
alias git-browse="$HOME/git-browse/start.sh"
```

## Usage

```sh
# Serve the current directory
git-browse

# Serve a specific path
git-browse /path/to/repo
```

Then open <http://localhost:8080> (the actual port may differ if 8080 is already in use — the URL is printed at startup).

## Multiple instances

Each invocation derives a deterministic compose project name from the repository path, so different repositories run in fully isolated containers. If the default HTTP or livereload port is already taken, the next free port is selected automatically.

Running the same repository a second time attaches to the existing instance's logs rather than starting a duplicate.

## Supported file types

Code files are rendered with syntax highlighting when browsed directly:

| Category | Extensions |
|---|---|
| JavaScript / TypeScript | `.js` `.mjs` `.cjs` `.jsx` `.ts` `.tsx` |
| Python | `.py` |
| Systems | `.go` `.rs` `.c` `.cpp` `.cc` `.h` `.hpp` `.java` `.cs` `.swift` `.kt` `.scala` |
| Scripting | `.rb` `.php` `.lua` `.r` |
| Shell | `.sh` `.bash` `.zsh` `.fish` |
| Styles | `.css` `.scss` `.less` `.sass` |
| Data / Config | `.json` `.yml` `.yaml` `.toml` `.ini` `.xml` `.sql` |
| Infrastructure | `.tf` `.hcl` `.proto` |
| Misc | `.vim` `.mk` `Dockerfile` `Makefile` `Jenkinsfile` `Vagrantfile` |

Markdown files (`.md`, `.markdown`, and others) are always rendered as HTML.

Files with unrecognised extensions that are detected as binary are offered as downloads rather than rendered.

## License

MIT — see [LICENSE](LICENSE).
