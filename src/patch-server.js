// Patches markserv's server.js:
//   1. Syntax-highlight known code file extensions.
//   2. Probe unknown-extension files for binary content (null-byte heuristic);
//      render as plain text if clean, download if binary.
//   3. Render README.md (or similar) below the directory listing (GitHub-style).
//   4. HTML files: sandboxed preview with source toggle.
//   5. Markdown files: rendered preview with raw source toggle.
const fs = require('fs')

const SERVER_PATH = '/usr/local/lib/node_modules/markserv/lib/server.js'

// ---------------------------------------------------------------------------
// Patch 1: code / binary / plain-text handling for non-markdown files
// ---------------------------------------------------------------------------

const OLD_FILE = `\t\t} else {
\t\t\t// Other: Browser requests other MIME typed file (handled by 'send')
\t\t\tmsg('file', style.link(prettyPath), flags)
\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t}`

const NEW_FILE = fs.readFileSync('/tmp/patches/other.js', 'utf8').trimEnd()

// ---------------------------------------------------------------------------
// Patch 2: directory listing with README auto-render (GitHub-style)
// ---------------------------------------------------------------------------

const OLD_DIR = `\t\t} else if (isDir) {
\t\t\ttry {
\t\t\t\t// Index: Browser is requesting a Directory Index
\t\t\t\tmsg('dir', style.link(prettyPath), flags)

\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/directory.html')

\t\t\t\tconst handlebarData = {
\t\t\t\t\tdirname: path.parse(filePath).dir,
\t\t\t\t\tcontent: dirToHtml(filePath),
\t\t\t\t\ttitle: path.parse(filePath).base,
\t\t\t\t\tpid: process.pid | 'N/A',
\t\t\t\t\tbreadcrumbs: createBreadcrumbs(path.relative(dir, filePath))
\t\t\t\t}

\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\tres.writeHead(200, {
\t\t\t\t\t\t\t'content-type': 'text/html'
\t\t\t\t\t\t})
\t\t\t\t\t\tres.end(output)
\t\t\t\t\t}).catch(error => {
\t\t\t\t\t\tconsole.error(error)
\t\t\t\t\t})
\t\t\t\t})
\t\t\t} catch (error) {
\t\t\t\terrorPage(500, filePath, error)
\t\t\t}`

const NEW_DIR = fs.readFileSync('/tmp/patches/dir.js', 'utf8').trimEnd()

// ---------------------------------------------------------------------------
// Patch 3: HTML file — sandboxed preview + source toggle
// ---------------------------------------------------------------------------

const OLD_HTML = `\t\t} else if (isHtml) {
\t\t\tmsg('html', style.link(prettyPath), flags)
\t\t\tgetFile(filePath).then(html => {
\t\t\t\treturn implant(html, implantHandlers, implantOpts).then(output => {
\t\t\t\t\tres.writeHead(200, {
\t\t\t\t\t\t'content-type': 'text/html'
\t\t\t\t\t})
\t\t\t\t\tres.end(output)
\t\t\t\t})
\t\t\t}).catch(error => {
\t\t\t\tconsole.error(error)
\t\t\t})`

const NEW_HTML = fs.readFileSync('/tmp/patches/html.js', 'utf8').trimEnd()

// ---------------------------------------------------------------------------
// Patch 4: Markdown — rendered preview + raw source toggle
// ---------------------------------------------------------------------------

const OLD_MARKDOWN = `\t\tif (isMarkdown) {
\t\t\tmsg('markdown', style.link(prettyPath), flags)
\t\t\tgetFile(filePath).then(markdownToHTML).then(filePath).then(html => {
\t\t\t\treturn implant(html, implantHandlers, implantOpts).then(output => {
\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')

\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\ttitle: path.parse(filePath).base,
\t\t\t\t\t\tcontent: output,
\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t}

\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})

\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts)
\t\t\t\t\t\t\t.then(output => {
\t\t\t\t\t\t\t\tres.writeHead(200, {
\t\t\t\t\t\t\t\t\t'content-type': 'text/html'
\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t})
\t\t\t}).catch(error => {
\t\t\t\tconsole.error(error)
\t\t\t})
\t\t}`

const NEW_MARKDOWN = fs.readFileSync('/tmp/patches/markdown.js', 'utf8').trimEnd()

// ---------------------------------------------------------------------------
// Patch 5: Git repo state dashboard (/_git/* virtual routes)
// ---------------------------------------------------------------------------

const OLD_GIT = `\t\tconst prettyPath = filePath`

const NEW_GIT = fs.readFileSync('/tmp/patches/git-state.js', 'utf8').trimEnd() +
    '\n\n\t\tconst prettyPath = filePath'

// ---------------------------------------------------------------------------
// Patch 7: File search API (/_files/* virtual routes)
// ---------------------------------------------------------------------------

const OLD_FILES = `\t\tconst prettyPath = filePath`

const NEW_FILES = fs.readFileSync('/tmp/patches/files.js', 'utf8').trimEnd() +
    '\n\n\t\tconst prettyPath = filePath'

// ---------------------------------------------------------------------------
// Patch 6: Register 'mermaid' as a no-op hljs language to suppress the
// "Could not find the language 'mermaid'" warning on every rendered page.
// markdown-it-highlightjs uses the shared highlight.js module instance, so
// registering here at startup reaches the same object.
// ---------------------------------------------------------------------------

const OLD_HLJS = `const mdItHLJS = require('markdown-it-highlightjs')`

const NEW_HLJS = `const mdItHLJS = require('markdown-it-highlightjs')
require('highlight.js').registerLanguage('mermaid', function() { return { contains: [] } })`

// ---------------------------------------------------------------------------
// Patch 8: livereload — watch all files, filter via .gitignore + .git/info/exclude
// ---------------------------------------------------------------------------

const OLD_LIVERELOAD = `const startLiveReloadServer = (liveReloadPort, flags) => {
\tlet {dir} = flags
\tconst isDir = fs.statSync(dir).isDirectory()
\tif (!isDir) {
\t\tdir = path.parse(flags.dir).dir
\t}

\tconst exts = fileTypes.watch.map(type => type.slice(1))
\tconst exclusions = fileTypes.exclusions.map(exPath => {
\t\treturn path.join(dir, exPath)
\t})

\treturn liveReload.createServer({
\t\texts,
\t\texclusions,
\t\tport: liveReloadPort
\t}).watch(path.resolve(dir))
}`

const NEW_LIVERELOAD = fs.readFileSync('/tmp/patches/livereload.js', 'utf8').trimEnd()

// ---------------------------------------------------------------------------

let content = fs.readFileSync(SERVER_PATH, 'utf8')

if (!content.includes(OLD_FILE)) {
  console.error('Patch 1 target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_FILE, NEW_FILE)

if (!content.includes(OLD_DIR)) {
  console.error('Patch 2 target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_DIR, NEW_DIR)

if (!content.includes(OLD_HTML)) {
  console.error('Patch 3 (isHtml) target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_HTML, NEW_HTML)

if (!content.includes(OLD_MARKDOWN)) {
  console.error('Patch 4 (isMarkdown) target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_MARKDOWN, NEW_MARKDOWN)

if (!content.includes(OLD_GIT)) {
  console.error('Patch 5 (/_git routes) target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_GIT, NEW_GIT)

if (!content.includes(OLD_HLJS)) {
  console.error('Patch 6 (hljs mermaid language) target not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_HLJS, NEW_HLJS)

// Patch 5 (NEW_GIT) already consumed the original target and left a fresh copy at
// the end of its block, so OLD_FILES still exists and can be matched here.
if (!content.includes(OLD_FILES)) {
  console.error('Patch 7 (/_files routes) target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_FILES, NEW_FILES)

if (!content.includes(OLD_LIVERELOAD)) {
  console.error('Patch 8 (livereload gitignore filter) target block not found — server.js may have changed')
  process.exit(1)
}
content = content.replace(OLD_LIVERELOAD, NEW_LIVERELOAD)

fs.writeFileSync(SERVER_PATH, content, 'utf8')
console.log('server.js patched successfully (8 patches applied)')
