// Patches markserv's server.js to syntax-highlight code files.
const fs = require('fs')

const SERVER_PATH = '/usr/local/lib/node_modules/markserv/lib/server.js'

const OLD = `\t\t} else {
\t\t\t// Other: Browser requests other MIME typed file (handled by 'send')
\t\t\tmsg('file', style.link(prettyPath), flags)
\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t}`

const NEW = `\t\t} else {
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
\t\t\t\t// Other: Browser requests other MIME typed file (handled by 'send')
\t\t\t\tmsg('file', style.link(prettyPath), flags)
\t\t\t\tsend(req, filePath, {dotfiles: 'allow'}).pipe(res)
\t\t\t}
\t\t}`

let content = fs.readFileSync(SERVER_PATH, 'utf8')

if (!content.includes(OLD)) {
  console.error('Target block not found — server.js may have changed')
  process.exit(1)
}

fs.writeFileSync(SERVER_PATH, content.replace(OLD, NEW), 'utf8')
console.log('server.js patched successfully')
