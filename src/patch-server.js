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

const NEW_FILE = `\t\t} else {
\t\t\t// Code files: render with syntax highlighting via existing markdown-it-highlightjs pipeline
\t\t\tconst codeExts = new Set([
\t\t\t\t'.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
\t\t\t\t'.py', '.go', '.rs', '.java', '.c', '.cpp', '.cc', '.h', '.hpp',
\t\t\t\t'.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.lua',
\t\t\t\t'.css', '.scss', '.less', '.sass',
\t\t\t\t'.sh', '.bash', '.zsh', '.fish',
\t\t\t\t'.yml', '.yaml', '.json', '.toml', '.ini',
\t\t\t\t'.xml', '.sql', '.tf', '.hcl', '.proto', '.vim', '.mk'
\t\t\t])
\t\t\tconst codeNames = new Set(['dockerfile', 'makefile', 'jenkinsfile', 'vagrantfile'])
\t\t\tconst parsed = path.parse(filePath)
\t\t\tconst isCode = codeExts.has(parsed.ext.toLowerCase()) ||
\t\t\t\tcodeNames.has(parsed.base.toLowerCase())

\t\t\tif (isCode) {
\t\t\t\tmsg('code', style.link(prettyPath), flags)
\t\t\t\tgetFile(filePath).then(content => {
\t\t\t\t\tconst lang = parsed.ext ? parsed.ext.slice(1) : parsed.base.toLowerCase()
\t\t\t\t\tconst markdownContent = '\`\`\`' + lang + '\\n' + content + '\\n\`\`\`'
\t\t\t\t\treturn markdownToHTML(markdownContent).then(html => {
\t\t\t\t\t\treturn implant(html, implantHandlers, implantOpts).then(output => {
\t\t\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')
\t\t\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\t\t\ttitle: parsed.base,
\t\t\t\t\t\t\t\tcontent: output,
\t\t\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\t\t\tres.writeHead(200, {'content-type': 'text/html'})
\t\t\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t}).catch(error => {
\t\t\t\t\tconsole.error(error)
\t\t\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t\t\t})
\t\t\t} else {
\t\t\t\t// Browser-native types: show a viewer page when navigated to directly (Accept: text/html),
\t\t\t\t// but serve raw bytes when fetched as a resource (img src, video src, etc.).
\t\t\t\t// This mirrors GitHub's behaviour — same URL works for both contexts.
\t\t\t\tconst _imgExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'])
\t\t\t\tconst _vidExts = new Set(['.mp4', '.webm', '.ogv', '.mov'])
\t\t\t\tconst _audExts = new Set(['.mp3', '.wav', '.oga', '.ogg', '.flac', '.aac', '.m4a'])
\t\t\t\tconst _ext = parsed.ext.toLowerCase()
\t\t\t\tconst _isBrowserNative = _ext === '.pdf' || _imgExts.has(_ext) || _vidExts.has(_ext) || _audExts.has(_ext)
\t\t\t\tif (_isBrowserNative) {
\t\t\t\t\tconst _acceptsHtml = (req.headers['accept'] || '').includes('text/html')
\t\t\t\t\tif (!_acceptsHtml) {
\t\t\t\t\t\t// Resource request — serve raw so the embedded element can load the file
\t\t\t\t\t\tmsg('file', style.link(prettyPath), flags)
\t\t\t\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t\t\t\t\treturn
\t\t\t\t\t}
\t\t\t\t\t// Navigation request — render a viewer page using the standard template
\t\t\t\t\tmsg('view', style.link(prettyPath), flags)
\t\t\t\t\tlet _embedHtml
\t\t\t\t\tif (_imgExts.has(_ext)) {
\t\t\t\t\t\t_embedHtml = '<div class="bin-viewer image-viewer"><img src="' + decodedUrl + '" alt="' + parsed.base + '"></div>'
\t\t\t\t\t} else if (_ext === '.pdf') {
\t\t\t\t\t\t_embedHtml = '<div class="bin-viewer pdf-viewer"><embed src="' + decodedUrl + '" type="application/pdf"></div>'
\t\t\t\t\t} else if (_vidExts.has(_ext)) {
\t\t\t\t\t\t_embedHtml = '<div class="bin-viewer video-viewer"><video controls><source src="' + decodedUrl + '"></video></div>'
\t\t\t\t\t} else {
\t\t\t\t\t\t_embedHtml = '<div class="bin-viewer audio-viewer"><audio controls><source src="' + decodedUrl + '"></audio></div>'
\t\t\t\t\t}
\t\t\t\t\tmarkdownToHTML(_embedHtml).then(html => {
\t\t\t\t\t\treturn implant(html, implantHandlers, implantOpts).then(output => {
\t\t\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')
\t\t\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\t\t\ttitle: parsed.base,
\t\t\t\t\t\t\t\tcontent: output,
\t\t\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\t\t\tres.writeHead(200, {'content-type': 'text/html'})
\t\t\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})
\t\t\t\t\t}).catch(error => {
\t\t\t\t\t\tconsole.error(error)
\t\t\t\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t\t\t\t})
\t\t\t\t\treturn
\t\t\t\t}

\t\t\t\t// Unknown extension: probe first 8 kB for null bytes — same heuristic as the
\t\t\t\t// \`file\` command. Any null byte → binary (show info page). Otherwise
\t\t\t\t// treat as plain text and render in the browser.
\t\t\t\tconst _buf = Buffer.alloc(8192)
\t\t\t\tconst _fd = fs.openSync(filePath, 'r')
\t\t\t\tconst _n = fs.readSync(_fd, _buf, 0, 8192, 0)
\t\t\t\tfs.closeSync(_fd)
\t\t\t\tif (_buf.slice(0, _n).includes(0x00)) {
\t\t\t\t\t// Confirmed binary — render an info page rather than forcing a download
\t\t\t\t\tmsg('binary', style.link(prettyPath), flags)
\t\t\t\t\tconst _stat = fs.statSync(filePath)
\t\t\t\t\tconst _sz = _stat.size
\t\t\t\t\tconst _humanSize = _sz >= 1048576
\t\t\t\t\t\t? (_sz / 1048576).toFixed(1) + ' MB'
\t\t\t\t\t\t: _sz >= 1024
\t\t\t\t\t\t\t? (_sz / 1024).toFixed(1) + ' KB'
\t\t\t\t\t\t\t: _sz + ' B'
\t\t\t\t\tconst _infoMd = '## ' + parsed.base + '\\n\\n' +
\t\t\t\t\t\t'| | |\\n|---|---|\\n' +
\t\t\t\t\t\t'| **Path** | \`' + decodedUrl + '\` |\\n' +
\t\t\t\t\t\t'| **Size** | ' + _humanSize + ' |\\n\\n' +
\t\t\t\t\t\t'> Binary file — cannot be displayed in the browser.'
\t\t\t\t\tmarkdownToHTML(_infoMd).then(html => {
\t\t\t\t\t\treturn implant(html, implantHandlers, implantOpts).then(output => {
\t\t\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')
\t\t\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\t\t\ttitle: parsed.base,
\t\t\t\t\t\t\t\tcontent: output,
\t\t\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\t\t\tres.writeHead(200, {'content-type': 'text/html'})
\t\t\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})
\t\t\t\t\t}).catch(error => {
\t\t\t\t\t\tconsole.error(error)
\t\t\t\t\t\tres.writeHead(500, {'content-type': 'text/plain'})
\t\t\t\t\t\tres.end('Error rendering binary info page')
\t\t\t\t\t})
\t\t\t\t} else {
\t\t\t\t\t// Text with unrecognised extension — render as plain text
\t\t\t\t\tmsg('text', style.link(prettyPath), flags)
\t\t\t\t\tgetFile(filePath).then(content => {
\t\t\t\t\t\tconst markdownContent = '\`\`\`\\n' + content + '\\n\`\`\`'
\t\t\t\t\t\treturn markdownToHTML(markdownContent).then(html => {
\t\t\t\t\t\t\treturn implant(html, implantHandlers, implantOpts).then(output => {
\t\t\t\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')
\t\t\t\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\t\t\t\ttitle: parsed.base,
\t\t\t\t\t\t\t\t\tcontent: output,
\t\t\t\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\t\t\t\tres.writeHead(200, {'content-type': 'text/html'})
\t\t\t\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})
\t\t\t\t\t}).catch(error => {
\t\t\t\t\t\tconsole.error(error)
\t\t\t\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t\t\t\t})
\t\t\t\t}
\t\t\t}
\t\t}`

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

const NEW_DIR = `\t\t} else if (isDir) {
\t\t\ttry {
\t\t\t\t// Index: Browser is requesting a Directory Index
\t\t\t\tmsg('dir', style.link(prettyPath), flags)

\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/directory.html')

\t\t\t\t// GitHub-style: find a README in the directory and render it below the listing
\t\t\t\tconst _entries = fs.readdirSync(filePath)
\t\t\t\tconst _readme = _entries.find(f => /^readme(\\.md|\\.markdown|\\.txt)?$/i.test(f))
\t\t\t\tconst _readmePath = _readme ? path.join(filePath, _readme) : null
\t\t\t\tconst _renderReadme = _readmePath
\t\t\t\t\t? getFile(_readmePath).then(markdownToHTML).catch(() => '')
\t\t\t\t\t: Promise.resolve('')

\t\t\t\treturn _renderReadme.then(_readmeHtml => {
\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\tdirname: path.parse(filePath).dir,
\t\t\t\t\t\tcontent: dirToHtml(filePath) + (_readmeHtml
\t\t\t\t\t\t\t? '<hr class="readme-divider"><div class="readme-body markdown-body">' + _readmeHtml + '</div>'
\t\t\t\t\t\t\t: ''),
\t\t\t\t\t\ttitle: path.parse(filePath).base,
\t\t\t\t\t\tpid: process.pid | 'N/A',
\t\t\t\t\t\tbreadcrumbs: createBreadcrumbs(path.relative(dir, filePath))
\t\t\t\t\t}

\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\tres.writeHead(200, {
\t\t\t\t\t\t\t\t'content-type': 'text/html'
\t\t\t\t\t\t\t})
\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t}).catch(error => {
\t\t\t\t\t\t\tconsole.error(error)
\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t})
\t\t\t} catch (error) {
\t\t\t\terrorPage(500, filePath, error)
\t\t\t}`

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

const NEW_HTML = `\t\t} else if (isHtml) {
\t\t\tmsg('html', style.link(prettyPath), flags)
\t\t\tgetFile(filePath).then(content => {
\t\t\t\t// Inject <base> so relative resource URLs resolve correctly inside the iframe
\t\t\t\tconst _withBase = /<head/i.test(content)
\t\t\t\t\t? content.replace(/(<head[^>]*>)/i, '$1\\n<base href="' + decodedUrl + '">')
\t\t\t\t\t: '<base href="' + decodedUrl + '">\\n' + content
\t\t\t\tconst _srcdoc = _withBase.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
\t\t\t\tvar _maxBt = 0, _btm, _btre = /\`+/g
\t\t\t\twhile ((_btm = _btre.exec(content)) !== null) { if (_btm[0].length > _maxBt) _maxBt = _btm[0].length }
\t\t\t\tconst _fence = '\`'.repeat(Math.max(3, _maxBt + 1))
\t\t\t\tconst _srcMd = _fence + 'html\\n' + content + '\\n' + _fence
\t\t\t\treturn markdownToHTML(_srcMd).then(srcHtml => {
\t\t\t\t\tconst _combined =
\t\t\t\t\t\t'<div class="source-toggle-bar">' +
\t\t\t\t\t\t'<button class="toggle-btn active" data-panel="preview">Preview</button>' +
\t\t\t\t\t\t'<button class="toggle-btn" data-panel="source">Code</button>' +
\t\t\t\t\t\t'</div>' +
\t\t\t\t\t\t'<div class="toggle-panel" data-panel="preview">' +
\t\t\t\t\t\t'<iframe class="html-preview-frame" sandbox="allow-scripts allow-same-origin allow-forms" srcdoc="' + _srcdoc + '"></iframe>' +
\t\t\t\t\t\t'</div>' +
\t\t\t\t\t\t'<div class="toggle-panel" data-panel="source" style="display:none">' +
\t\t\t\t\t\tsrcHtml +
\t\t\t\t\t\t'</div>'
\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')
\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\ttitle: path.parse(filePath).base,
\t\t\t\t\t\tcontent: _combined,
\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t}
\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\tres.writeHead(200, {'content-type': 'text/html'})
\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t})
\t\t\t}).catch(error => {
\t\t\t\tconsole.error(error)
\t\t\t})`

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

const NEW_MARKDOWN = `\t\tif (isMarkdown) {
\t\t\tmsg('markdown', style.link(prettyPath), flags)
\t\t\tgetFile(filePath).then(rawSource => {
\t\t\t\treturn markdownToHTML(rawSource).then(renderedHtml => {
\t\t\t\t\treturn implant(renderedHtml, implantHandlers, implantOpts).then(renderedOutput => {
\t\t\t\t\t\tvar _maxBt = 0, _btm, _btre = /\`+/g
\t\t\t\t\t\twhile ((_btm = _btre.exec(rawSource)) !== null) { if (_btm[0].length > _maxBt) _maxBt = _btm[0].length }
\t\t\t\t\t\tconst _fence = '\`'.repeat(Math.max(3, _maxBt + 1))
\t\t\t\t\t\tconst _srcMd = _fence + 'markdown\\n' + rawSource + '\\n' + _fence
\t\t\t\t\t\treturn markdownToHTML(_srcMd).then(srcHtml => {
\t\t\t\t\t\t\tconst _combined =
\t\t\t\t\t\t\t\t'<div class="source-toggle-bar">' +
\t\t\t\t\t\t\t\t'<button class="toggle-btn active" data-panel="preview">Preview</button>' +
\t\t\t\t\t\t\t\t'<button class="toggle-btn" data-panel="source">Source</button>' +
\t\t\t\t\t\t\t\t'</div>' +
\t\t\t\t\t\t\t\t'<div class="toggle-panel" data-panel="preview">' +
\t\t\t\t\t\t\t\trenderedOutput +
\t\t\t\t\t\t\t\t'</div>' +
\t\t\t\t\t\t\t\t'<div class="toggle-panel" data-panel="source" style="display:none">' +
\t\t\t\t\t\t\t\tsrcHtml +
\t\t\t\t\t\t\t\t'</div>'
\t\t\t\t\t\t\tconst templateUrl = path.join(__dirname, 'templates/markdown.html')
\t\t\t\t\t\t\tconst handlebarData = {
\t\t\t\t\t\t\t\ttitle: path.parse(filePath).base,
\t\t\t\t\t\t\t\tcontent: _combined,
\t\t\t\t\t\t\t\tpid: process.pid | 'N/A'
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\treturn baseTemplate(templateUrl, handlebarData).then(final => {
\t\t\t\t\t\t\t\tconst lvl2Dir = path.parse(templateUrl).dir
\t\t\t\t\t\t\t\tconst lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
\t\t\t\t\t\t\t\treturn implant(final, implantHandlers, lvl2Opts).then(output => {
\t\t\t\t\t\t\t\t\tres.writeHead(200, {'content-type': 'text/html'})
\t\t\t\t\t\t\t\t\tres.end(output)
\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t})
\t\t\t}).catch(error => {
\t\t\t\tconsole.error(error)
\t\t\t})
\t\t}`

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

fs.writeFileSync(SERVER_PATH, content, 'utf8')
console.log('server.js patched successfully (4 patches applied)')
