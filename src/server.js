#!/usr/bin/env node
'use strict'

const http = require('http')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const express = require('express')
const chalk = require('chalk')
const opn = require('open')
const chokidar = require('chokidar')
const liveReload = require('livereload')
const connectLiveReload = require('connect-livereload')
const implant = require('implant')
const deepmerge = require('deepmerge')
const handlebars = require('handlebars')
const MarkdownIt = require('markdown-it')
const mdItAnchor = require('markdown-it-anchor')
const mdItTaskLists = require('markdown-it-task-lists')
const mdItHLJS = require('markdown-it-highlightjs')
const mdItTOC = require('markdown-it-table-of-contents')
const mdItEmoji = require('markdown-it-emoji')
const mdItMathJax = require('markdown-it-mathjax')
const emojiRegex = require('emoji-regex')()
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const mime = require('mime-types')
const ignore = require('ignore')

// ---------------------------------------------------------------------------
// CLI Configuration
// ---------------------------------------------------------------------------

const argv = yargs(hideBin(process.argv))
  .option('dir', { alias: 'd', type: 'string', default: '.', description: 'Directory to serve' })
  .option('port', { alias: 'p', type: 'number', default: 8080, description: 'Port to listen on' })
  .option('address', { alias: 'a', type: 'string', default: '0.0.0.0', description: 'Address to listen on' })
  .option('livereloadport', { alias: 'l', type: 'number', default: 35729, description: 'LiveReload port' })
  .option('browser', { alias: 'b', type: 'boolean', default: true, description: 'Open browser on start' })
  .option('silent', { alias: 's', type: 'boolean', default: false, description: 'Silent mode' })
  .option('verbose', { alias: 'v', type: 'boolean', default: false, description: 'Verbose mode' })
  .parse()

const flags = argv
const dir = path.resolve(flags.dir)

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const style = {
  link: chalk.blueBright.underline.italic,
  address: chalk.greenBright.underline.italic,
  port: chalk.reset.cyanBright
}

const log = (str, err) => {
  if (flags.silent) return
  if (str) console.log(str)
  if (err) console.error(err)
}

const msg = (type, message) => {
  log(chalk`{bgGreen.black   GitBrowse }{white  ${type}: }` + message)
}

const errormsg = (type, message, err) =>
  log(chalk`{bgRed.white   GitBrowse }{red  ${type}: }` + message, err)

// ---------------------------------------------------------------------------
// Markdown Rendering
// ---------------------------------------------------------------------------

const slugify = text => {
  return text.toLowerCase().replace(/\s/g, '-')
    .replace(/[`~!@#$%^&*()+=<>?,./:;"'|{}[\]\\\u2000-\u206F\u2E00-\u2E7F]/g, '')
    .replace(emojiRegex, '')
    .replace(/[\u3000。？！，、；：“”【】（）〔〕［］﹃﹄“”‘’﹁﹂—…－～《》〈〉「」]/g, '')
}

const md = new MarkdownIt({
  linkify: false,
  html: true
})
  .use(mdItAnchor, { slugify })
  .use(mdItTaskLists)
  .use(mdItHLJS)
  .use(mdItEmoji)
  .use(mdItMathJax())
  .use(mdItTOC, {
    includeLevel: [1, 2, 3, 4, 5, 6],
    slugify
  })

// Register mermaid as a no-op hljs language to suppress warnings
require('highlight.js').registerLanguage('mermaid', function () { return { contains: [] } })

const markdownToHTML = markdownText => {
  try {
    return Promise.resolve(md.render(markdownText))
  } catch (error) {
    return Promise.reject(error)
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const getFile = filePath => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

const baseTemplate = (templateUrl, handlebarData) => {
  return getFile(templateUrl).then(source => {
    const template = handlebars.compile(source)
    return template(handlebarData)
  })
}

handlebars.registerHelper('eq', function (a, b) {
  return a === b
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fileTypes = {
  markdown: ['.markdown', '.mdown', '.mkdn', '.md', '.mkd', '.mdwn', '.mdtxt', '.mdtext', '.text'],
  html: ['.html', '.htm']
}

const isType = (exts, filePath) => {
  const fileExt = path.parse(filePath).ext.toLowerCase()
  return exts.includes(fileExt)
}

const createBreadcrumbs = relPath => {
  const crumbs = [{ href: '/', text: './' }]
  if (!relPath || relPath === '/') return crumbs

  const dirParts = relPath.replace(/(^\/+|\/+$)/g, '').split('/')
  let collectPath = '/'

  dirParts.forEach((dirName) => {
    if (!dirName) return
    const fullLink = collectPath + encodeURIComponent(dirName) + '/'
    crumbs.push({ href: fullLink, text: dirName + '/' })
    collectPath = fullLink
  })

  return crumbs
}

const dirToHtml = (absPath, relPath) => {
  const urls = fs.readdirSync(absPath)
  let list = '<ul>\n'

  urls.forEach(subPath => {
    if (subPath.charAt(0) === '.') return

    const isDir = fs.statSync(path.join(absPath, subPath)).isDirectory()
    const href = isDir ? subPath + '/' : subPath
    const iconClass = isDir ? 'folder' : 'file' // Simplified for now
    list += `\t<li class="icon ${iconClass} ${isDir ? 'isfolder' : 'isfile'}"><a href="${href}">${href}</a></li> \n`
  })

  list += '</ul>\n'
  return list
}

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express()

// LiveReload middleware
if (flags.livereloadport) {
  app.use(connectLiveReload({ port: flags.livereloadport }))
}

// Static assets virtual route
app.get('/_static/*', (req, res) => {
  const file = req.params[0]
  let filePath
  if (file === 'style.css') {
    filePath = path.join(__dirname, 'dark.css')
  } else {
    filePath = path.join(__dirname, file)
  }

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath)
  } else {
    res.status(404).send('Not found')
  }
})

// Implant support
const implantOpts = { maxDepth: 10 }
const implantHandlers = {
  file: (url, opts) => {
    const absUrl = path.join(opts.baseDir, url)
    return getFile(absUrl).catch(() => false)
  },
  markdown: (url, opts) => {
    const absUrl = path.join(opts.baseDir, url)
    return getFile(absUrl).then(markdownToHTML).catch(() => false)
  },
  html: (url, opts) => {
    const absUrl = path.join(opts.baseDir, url)
    return getFile(absUrl).catch(() => false)
  }
}

const renderWithLayout = (templateName, data, baseDir) => {
  const templateUrl = path.join(__dirname, 'templates', templateName)
  return baseTemplate(templateUrl, data).then(html => {
    const opts = deepmerge(implantOpts, { baseDir })
    // Replace __ASSETS__ in HTML before implant
    const replaced = html.replace(/__ASSETS__/g, '/_static/')
    return implant(replaced, implantHandlers, opts).catch(err => {
      // Fallback for any implant parsing error (e.g. curly braces in file content)
      // or "No implant name-spaces" error. Returning the original string
      // ensures we don't 500 or mangle the output.
      return replaced
    })
  })
}

// Error Page helper
const sendError = (req, res, code, filePath, err, decodedUrl) => {
  errormsg(code, filePath, err)
  const data = {
    code,
    fileName: path.parse(filePath).base,
    filePath,
    errorMsg: err.message,
    errorStack: err.stack,
    referer: req.headers.referer || '/'
  }
  return renderWithLayout('error.html', data, path.dirname(filePath)).then(output => {
    res.status(code).send(output)
  }).catch(e => {
    res.status(500).send('Critical Error: ' + e.message)
  })
}

// Git Routes (/_git/*)
app.use('/_git', (req, res, next) => {
  const decodedUrl = decodeURIComponent(req.path)
  const gitExec = (args) => {
    const r = spawnSync('git', args, { cwd: dir, timeout: 5000, encoding: 'utf8' })
    if (r.error || r.status !== 0) return ''
    return (r.stdout || '').trim()
  }

  const jsonResponse = (obj) => res.json(obj)

  if (decodedUrl === '/state' || decodedUrl === 'state') {
    try {
      const head = gitExec(['symbolic-ref', '--short', 'HEAD']) || gitExec(['rev-parse', '--short', 'HEAD'])
      const headSha = gitExec(['rev-parse', '--short', 'HEAD'])
      const branchLines = gitExec(['for-each-ref', '--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)', 'refs/heads/'])
      const branches = branchLines ? branchLines.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t')
        const track = (parts[2] || '').replace(/^\[|\]$/g, '')
        const aheadM = track.match(/ahead (\d+)/)
        const behindM = track.match(/behind (\d+)/)
        return { name: parts[0] || '', upstream: parts[1] || '', ahead: aheadM ? parseInt(aheadM[1], 10) : 0, behind: behindM ? parseInt(behindM[1], 10) : 0, gone: track === 'gone' }
      }) : []
      const tagLines = gitExec(['for-each-ref', '--count=30', '--sort=-creatordate', '--format=%(refname:short)\t%(objectname:short)\t%(creatordate:relative)', 'refs/tags/'])
      const tags = tagLines ? tagLines.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t')
        return { name: parts[0] || '', sha: parts[1] || '', date: parts[2] || '' }
      }) : []
      const worktreeRaw = gitExec(['worktree', 'list', '--porcelain'])
      const worktrees = []
      if (worktreeRaw) {
        worktreeRaw.split('\n\n').filter(Boolean).forEach(block => {
          let wtPath = '', wtBranch = '', wtSha = ''
          block.split('\n').forEach(line => {
            if (line.startsWith('worktree ')) wtPath = line.slice(9)
            else if (line.startsWith('HEAD ')) wtSha = line.slice(5, 12)
            else if (line.startsWith('branch refs/heads/')) wtBranch = line.slice(18)
            else if (line === 'detached') wtBranch = '(detached)'
          })
          worktrees.push({ path: wtPath, branch: wtBranch, sha: wtSha })
        })
      }
      const stashOut = gitExec(['stash', 'list', '--format=%H'])
      const stashCount = stashOut ? stashOut.split('\n').filter(Boolean).length : 0
      return jsonResponse({ head, headSha, branches, tags, worktrees, stashCount })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (decodedUrl === '/log' || decodedUrl === 'log') {
    try {
      const skip = Math.max(0, parseInt(req.query.skip, 10) || 0)
      const count = Math.min(100, Math.max(1, parseInt(req.query.count, 10) || 40))
      const totalCount = parseInt(gitExec(['rev-list', '--all', '--count']), 10) || 0
      const SEP = '\x1f'
      const logOut = gitExec(['log', '--all', '--topo-order', '--format=%H' + SEP + '%P' + SEP + '%s' + SEP + '%an' + SEP + '%ar' + SEP + '%D', '--skip=' + skip, '--max-count=' + count])
      let commits = logOut ? logOut.split('\n').filter(Boolean).map(line => {
        const parts = line.split(SEP)
        const fullSha = parts[0] || ''
        const fullParents = parts[1] ? parts[1].trim().split(' ').filter(Boolean) : []
        const refs = parts[5] ? parts[5].split(', ').filter(Boolean) : []
        return { sha: fullSha.slice(0, 8), fullSha, parents: fullParents.map(p => p.slice(0, 8)), _fullParents: fullParents, message: parts[2] || '', author: parts[3] || '', date: parts[4] || '', refs, lane: 0 }
      }) : []
      const lanes = []
      commits.forEach(commit => {
        const { fullSha, _fullParents: parents } = commit
        let laneIdx = lanes.indexOf(fullSha)
        if (laneIdx === -1) { laneIdx = lanes.indexOf(null); if (laneIdx === -1) { laneIdx = lanes.length; lanes.push(null) } }
        commit.lane = laneIdx
        if (parents.length === 0) lanes[laneIdx] = null
        else {
          lanes[laneIdx] = parents[0]
          for (let j = 1; j < parents.length; j++) { if (!lanes.includes(parents[j])) { const free = lanes.indexOf(null); if (free === -1) lanes.push(parents[j]); else lanes[free] = parents[j] } }
        }
        for (let k = 0; k < lanes.length; k++) { if (k !== laneIdx && lanes[k] === fullSha) lanes[k] = null }
      })
      commits.forEach(c => { delete c.fullSha; delete c._fullParents })
      return jsonResponse({ commits, totalCount, hasMore: skip + commits.length < totalCount })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (decodedUrl.startsWith('/diff/')) {
    try {
      const sha = decodedUrl.slice(6).replace(/[^a-f0-9]/gi, '').slice(0, 40)
      if (!sha) return res.status(400).send('Bad sha')
      const message = gitExec(['log', '-1', '--format=%s', sha])
      const diffOut = gitExec(['diff-tree', '-r', '--no-commit-id', '--name-status', '-m', sha])
      const seen = new Set()
      const files = diffOut ? diffOut.split('\n').filter(Boolean).reduce((acc, line) => {
        const parts = line.split('\t')
        const filePath = parts[1] || ''
        if (filePath && !seen.has(filePath)) { seen.add(filePath); acc.push({ status: parts[0] || '?', path: filePath }) }
        return acc
      }, []) : []
      return jsonResponse({ sha, message, files })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (decodedUrl === '/' || decodedUrl === '') {
    const data = { title: 'Git Dashboard', content: '<div class="git-dashboard" id="git-dashboard"><p class="git-loading">Loading\u2026</p></div>' }
    return renderWithLayout('markdown.html', data, dir).then(output => res.send(output)).catch(next)
  }

  next()
})

// File Search Routes (/_files/*)
app.use('/_files', (req, res, next) => {
  const decodedUrl = decodeURIComponent(req.path)
  const getGitFiles = () => {
    const gitExec = (args) => {
      const r = spawnSync('git', args, { cwd: dir, timeout: 5000, encoding: 'utf8' })
      if (r.error || r.status !== 0) return ''
      return r.stdout || ''
    }
    const tracked = gitExec(['ls-files']).split('\n').filter(Boolean)
    const untracked = gitExec(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
    const seen = new Set(tracked)
    untracked.forEach(f => seen.add(f))
    return Array.from(seen).sort()
  }

  if (decodedUrl === '/listing') {
    try {
      const reqPath = (req.query.path || '/').replace(/\/+$/, '') || '/'
      const relReq = reqPath.replace(/^\/+/, '')
      const absReq = path.resolve(dir, relReq)
      if (absReq !== dir && !absReq.startsWith(dir + '/')) return res.status(403).send('Forbidden')
      const allFiles = getGitFiles()
      const prefix = relReq ? relReq + '/' : ''
      const childSeen = new Set()
      const entries = []
      allFiles.forEach(f => {
        if (!f.startsWith(prefix)) return
        const rest = f.slice(prefix.length)
        const slash = rest.indexOf('/')
        if (slash === -1) {
          if (!childSeen.has(rest)) { childSeen.add(rest); entries.push({ name: rest, path: '/' + prefix + rest, isDir: false }) }
        } else {
          const dirName = rest.slice(0, slash)
          if (!childSeen.has(dirName)) { childSeen.add(dirName); entries.push({ name: dirName, path: '/' + prefix + dirName, isDir: true }) }
        }
      })
      return res.json({ entries })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (decodedUrl === '/search') {
    try {
      const query = (req.query.q || '').trim().slice(0, 200).replace(/[^\x20-\x7e]/g, '')
      const allFiles = getGitFiles()
      const MAX_RESULTS = 50
      let files
      if (!query) {
        const topSeen = new Set()
        files = []
        allFiles.forEach(f => {
          const slash = f.indexOf('/')
          const top = slash === -1 ? f : f.slice(0, slash)
          if (!topSeen.has(top)) { topSeen.add(top); files.push({ name: top, path: '/' + top, isDir: slash !== -1 }) }
        })
      } else {
        const lq = query.toLowerCase()
        files = allFiles.filter(f => f.toLowerCase().includes(lq)).slice(0, MAX_RESULTS).map(f => ({ name: f, path: '/' + f, isDir: false }))
      }
      return res.json({ files })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  next()
})

// Main File Handler
app.get('*', async (req, res, next) => {
  const decodedUrl = decodeURIComponent(req.path)
  const filePath = path.join(dir, decodedUrl)

  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (e) {
    if (decodedUrl === '/favicon.ico') return res.status(404).end()
    return sendError(req, res, 404, filePath, e, decodedUrl)
  }

  try {
    if (stat.isDirectory()) {
      // ?listing - bare directory listing
      if (req.query.listing !== undefined) {
        return res.send(dirToHtml(filePath, decodedUrl))
      }

      const entries = fs.readdirSync(filePath)
      const readme = entries.find(f => /^readme(\.md|\.markdown|\.txt)?$/i.test(f))
      const readmePath = readme ? path.join(filePath, readme) : null

      const readmeHtml = readmePath ? await getFile(readmePath).then(markdownToHTML).catch(() => '') : ''

      const useReadme = !!readmeHtml
      const template = useReadme ? 'markdown.html' : 'directory.html'
      const data = {
        dirname: path.dirname(decodedUrl),
        content: useReadme ? '<div class="readme-body markdown-body">' + readmeHtml + '</div>' : dirToHtml(filePath, decodedUrl),
        title: path.basename(filePath) || path.basename(dir),
        breadcrumbs: createBreadcrumbs(decodedUrl)
      }
      const output = await renderWithLayout(template, data, filePath)
      res.send(output)
    } else {
      const ext = path.extname(filePath).toLowerCase()
      const isMarkdown = fileTypes.markdown.includes(ext)
      const isHtml = fileTypes.html.includes(ext)

      if (isMarkdown) {
        const rawSource = await getFile(filePath)
        const fmMatch = rawSource.match(/^---\r?\n([\s\S]*?)\n---\r?\n/)
        const content = fmMatch ? rawSource.slice(fmMatch[0].length) : rawSource
        const fmYaml = fmMatch ? '```yaml\n' + fmMatch[1] + '\n```' : ''

        const [fmHtml, renderedBody] = await Promise.all([
          fmYaml ? markdownToHTML(fmYaml) : Promise.resolve(''),
          markdownToHTML(content)
        ])
        const frontmatter = fmHtml ? '<div class="markdown-frontmatter">\n' + fmHtml + '</div>\n' : ''
        const renderedHtml = frontmatter + renderedBody

        // Source toggle logic
        const _maxBt = (rawSource.match(/`+/g) || []).reduce((max, m) => Math.max(max, m.length), 0)
        const _fence = '`'.repeat(Math.max(3, _maxBt + 1))
        const _srcMd = _fence + 'markdown\n' + rawSource + '\n' + _fence

        const srcHtml = await markdownToHTML(_srcMd)
        const combined = `
          <div class="source-toggle-bar">
            <button class="toggle-btn active" data-panel="preview">Preview</button>
            <button class="toggle-btn" data-panel="source">Source</button>
          </div>
          <div class="toggle-panel" data-panel="preview">${renderedHtml}</div>
          <div class="toggle-panel" data-panel="source" style="display:none">${srcHtml}</div>
        `
        const data = { title: path.basename(filePath), content: combined }
        const output = await renderWithLayout('markdown.html', data, path.dirname(filePath))
        res.send(output)
      } else if (isHtml) {
        const content = await getFile(filePath)
        const withBase = /<head/i.test(content)
          ? content.replace(/(<head[^>]*>)/i, '$1\n<base href="' + decodedUrl + '">')
          : '<base href="' + decodedUrl + '">\n' + content
        const srcdoc = withBase.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        const _maxBt = (content.match(/`+/g) || []).reduce((max, m) => Math.max(max, m.length), 0)
        const _fence = '`'.repeat(Math.max(3, _maxBt + 1))
        const _srcMd = _fence + 'html\n' + content + '\n' + _fence

        const srcHtml = await markdownToHTML(_srcMd)
        const combined = `
          <div class="source-toggle-bar">
            <button class="toggle-btn active" data-panel="preview">Preview</button>
            <button class="toggle-btn" data-panel="source">Code</button>
          </div>
          <div class="toggle-panel" data-panel="preview">
            <iframe class="html-preview-frame" sandbox="allow-scripts allow-same-origin allow-forms" srcdoc="${srcdoc}"></iframe>
          </div>
          <div class="toggle-panel" data-panel="source" style="display:none">${srcHtml}</div>
        `
        const data = { title: path.basename(filePath), content: combined }
        const output = await renderWithLayout('markdown.html', data, path.dirname(filePath))
        res.send(output)
      } else {
        // Code / Binary / Other
        const codeExts = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.lua', '.css', '.scss', '.less', '.sass', '.sh', '.bash', '.zsh', '.fish', '.yml', '.yaml', '.json', '.toml', '.ini', '.xml', '.sql', '.tf', '.hcl', '.proto', '.vim', '.mk'])
        const codeNames = new Set(['dockerfile', 'makefile', 'jenkinsfile', 'vagrantfile'])
        const isCode = codeExts.has(ext) || codeNames.has(path.basename(filePath).toLowerCase())

        if (isCode) {
          const content = await getFile(filePath)
          const lang = ext ? ext.slice(1) : path.basename(filePath).toLowerCase()
          const html = await markdownToHTML('```' + lang + '\n' + content + '\n```')
          const data = { title: path.basename(filePath), content: html }
          const output = await renderWithLayout('markdown.html', data, path.dirname(filePath))
          res.send(output)
        } else {
          const imgExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'])
          const vidExts = new Set(['.mp4', '.webm', '.ogv', '.mov'])
          const audExts = new Set(['.mp3', '.wav', '.oga', '.ogg', '.flac', '.aac', '.m4a'])
          const isBrowserNative = ext === '.pdf' || imgExts.has(ext) || vidExts.has(ext) || audExts.has(ext)

          if (isBrowserNative) {
            if (!(req.headers['accept'] || '').includes('text/html')) return res.sendFile(filePath)
            let embedHtml
            if (imgExts.has(ext)) embedHtml = '<div class="bin-viewer image-viewer"><img src="' + decodedUrl + '" alt="' + path.basename(filePath) + '"></div>'
            else if (ext === '.pdf') embedHtml = '<div class="bin-viewer pdf-viewer"><embed src="' + decodedUrl + '" type="application/pdf"></div>'
            else if (vidExts.has(ext)) embedHtml = '<div class="bin-viewer video-viewer"><video controls><source src="' + decodedUrl + '"></video></div>'
            else embedHtml = '<div class="bin-viewer audio-viewer"><audio controls><source src="' + decodedUrl + '"></audio></div>'
            const html = await markdownToHTML(embedHtml)
            const data = { title: path.basename(filePath), content: html }
            const output = await renderWithLayout('markdown.html', data, path.dirname(filePath))
            res.send(output)
          } else {
            // Probe binary
            const buf = Buffer.alloc(8192)
            const fd = fs.openSync(filePath, 'r')
            const n = fs.readSync(fd, buf, 0, 8192, 0)
            fs.closeSync(fd)
            if (buf.slice(0, n).includes(0x00)) {
              const stat = fs.statSync(filePath)
              const sz = stat.size
              const humanSize = sz >= 1048576 ? (sz / 1048576).toFixed(1) + ' MB' : sz >= 1024 ? (sz / 1024).toFixed(1) + ' KB' : sz + ' B'
              const infoMd = `## ${path.basename(filePath)}\n\n| | |\n|---|---|\n| **Path** | \`${decodedUrl}\` |\n| **Size** | ${humanSize} |\n\n> Binary file — cannot be displayed in the browser.`
              const html = await markdownToHTML(infoMd)
              const data = { title: path.basename(filePath), content: html }
              const output = await renderWithLayout('markdown.html', data, path.dirname(filePath))
              res.send(output)
            } else {
              const content = await getFile(filePath)
              const html = await markdownToHTML('```\n' + content + '\n```')
              const data = { title: path.basename(filePath), content: html }
              const output = await renderWithLayout('markdown.html', data, path.dirname(filePath))
              res.send(output)
            }
          }
        }
      }
    }
  } catch (e) {
    return sendError(req, res, 500, filePath, e, decodedUrl)
  }
})

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

if (require.main === module) {
  const server = app.listen(flags.port, flags.address, () => {
    const serveURL = `http://${flags.address}:${flags.port}`
    msg('address', style.address(serveURL))
    msg('path', chalk`{grey ${style.address(dir)}}`)

    if (flags.livereloadport) {
      const ig = ignore().add(['.git/', 'node_modules/'])
      for (const f of ['.gitignore', '.git/info/exclude']) {
        const full = path.join(dir, f)
        if (fs.existsSync(full)) ig.add(fs.readFileSync(full, 'utf8'))
      }

      const lrServer = liveReload.createServer({ port: flags.livereloadport })
      lrServer.filterRefresh = function (filepath) {
        const rel = path.relative(dir, filepath)
        if (!rel || rel.startsWith('..')) return
        if (!ig.ignores(rel)) lrServer.refresh(filepath)
      }
      lrServer.watch(dir)
      msg('livereload', chalk`{grey communicating on port: ${style.port(flags.livereloadport)}}`)
    }

    if (flags.browser) {
      opn(serveURL)
    }
  })
}

module.exports = app
