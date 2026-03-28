# AI Agent Guide: GitBrowse Architecture

This document explains the codebase for AI agents.

## 🏗️ Architecture

GitBrowse is a standalone Node.js server built with **Express**. It serves as a
markdown and directory browser with deep Git integration.

### Core Components

- **Server (`src/server.js`):** The main entry point. Handles:
    - CLI flag parsing (port, directory, etc.)
    - Markdown rendering (using `markdown-it` and plugins)
    - Handlebars templating with `implant` support for recursive inclusions
    - Virtual Git routes (`/_git/*`) for repository state, logs, and diffs
    - Virtual File routes (`/_files/*`) for git-aware search and exploration
    - LiveReload with `.gitignore` filtering
- **Templates (`src/templates/`):** Handlebars templates for the UI chrome.
- **Client Scripts (`src/*.js`):** Vanilla JS scripts served to the browser. These
  provide the interactive features like the command palette, file tree, and git
  dashboard.
- **Styles (`src/dark.css`):** The primary stylesheet.

## 🗣️ Target Userbase

The target users are **experienced developers** who use modern IDEs (like VS Code) and AI coding agents daily. They expect a high baseline of functionality (e.g., syntax highlighting, markdown rendering, responsive UI) as a given.

### README updates

@~/.claude/docs/readme-style.md

## 🛠️ Development Workflow

### Server-side changes
Edit `src/server.js` directly. The server uses standard Express patterns.
If adding new dependencies, update `package.json`.

### Client-side changes
Client scripts are located in `src/`. They are served as-is to the browser.
They use vanilla JS and DOM APIs for maximum compatibility and zero build step.

## 🧪 Testing

Tests are located in `test/` and use Node's built-in test runner.
Run tests with: `npm test`

The primary integration test is `test/server.test.js`, which uses `supertest`
to verify server routes and rendering logic.

## 📦 Docker

The `Dockerfile` builds a lightweight image that:
1. Installs Node.js dependencies
2. Copies the source code
3. Runs `src/server.js` as the entry point

The server is configured to serve the `/var/www` directory by default.
