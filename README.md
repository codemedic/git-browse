<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="src/assets/banner-light.svg">
    <img alt="git-browse logo" src="src/assets/banner-light.svg" width="800" height="240">
  </picture>
</p>

# git-browse

The agent wrote the code. Now you have to read it. `git-browse` is a read-only project viewer for inspecting repository state without the setup or overhead of a full IDE.

It provides a high-fidelity view of your project with rendered markdown, git context, and a live change tracker centered on reviewing what your AI agent just did. No extensions to manage and zero cold start.

## Quick start

```sh
git clone https://github.com/codemedic/git-browse.git ~/git-browse

# Add an alias to use it from anywhere
# ~/.bashrc or ~/.zshrc
alias git-browse="$HOME/git-browse/start.sh"
```

```sh
git-browse           # serve the current directory
git-browse /path     # or a specific path
```

The URL is printed at startup (default: http://localhost:8080).

## Features

- **Git dashboard** — branches, worktrees, tags, and commit graph with paginated commit log at `/_git`
- **Change tracker** — a running list of every file the agent touched while the browser's been open
- **Command palette** — `Ctrl+Shift+P` / `Cmd+Shift+P` to jump to any file
- **Rendered markdown** — GitHub-flavoured, with Mermaid, task lists, math, and theme-aware images
- **Live reload** — updates on save, respects `.gitignore`
- **Bare mode** — `?bare` strips the chrome; Shift+click any link to open it that way

## Multiple instances

Each invocation gets a project name derived from the repo path, so different repos run in isolated containers. If a port is taken, the next free one is used. Running the same repo twice attaches to the existing instance rather than starting a duplicate.

## Roadmap

The next focus is a proper review workflow — not just "file X changed" but what actually changed in it:

- [ ] **Diff view** — inline unified diff per file, staged and unstaged
- [ ] **Agent change summary** — when the change tracker fires, show a readable diff alongside the filename

## License

MIT — see [LICENSE](LICENSE).
