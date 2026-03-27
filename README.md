# git-browse

A Docker-based local web UI for browsing a git repository in the browser.

*Kudos to [markserv](https://github.com/markserv/markserv) for the original inspiration and base templates.*

## Features

- **Deep Git integration** — space-efficient dashboard for worktrees, branches, and tags with a paginated commit log and branch graph at `/_git`
- **Change tracking** — persistent toast lists all files modified while browsing for quick navigation and review
- **Command palette** — `Ctrl+Shift+P` / `Cmd+Shift+P` for lightning-fast file search, navigation, and theme switching
- **GitHub-flavoured Markdown** — full support for Mermaid diagrams, YAML frontmatter, and theme-aware `<picture>` image switching
- **Live reload** — instant updates on file changes, with native respect for `.gitignore` rules
- **Bare mode** — `?bare` strips all chrome for a focused view; Shift+click file links to open them bare

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

Files with unrecognised extensions that are detected as binary show file info and are offered as downloads.

## License

MIT — see [LICENSE](LICENSE).
