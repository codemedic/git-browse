		// ---------------------------------------------------------------------------
		// Patch 5: Git repo state dashboard (/_git/* virtual routes)
		// ---------------------------------------------------------------------------
		if (decodedUrl === '/_git' || decodedUrl.startsWith('/_git/')) {
			// Use spawnSync (no shell) to avoid sh interpretation of git format %(...)
			const { spawnSync } = require('child_process')

			const gitExec = (args) => {
				const r = spawnSync('git', args, { cwd: dir, timeout: 5000, encoding: 'utf8' })
				if (r.error || r.status !== 0) return ''
				return (r.stdout || '').trim()
			}

			const jsonResponse = (statusCode, obj) => {
				res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
				res.end(JSON.stringify(obj))
			}

			// /_git/state — lightweight ref snapshot (polled every 5s)
			if (decodedUrl === '/_git/state') {
				try {
					// Falls back to rev-parse in detached HEAD
					const head = gitExec(['symbolic-ref', '--short', 'HEAD']) ||
						gitExec(['rev-parse', '--short', 'HEAD'])
					const headSha = gitExec(['rev-parse', '--short', 'HEAD'])

					const branchLines = gitExec(['for-each-ref',
						'--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)',
						'refs/heads/'])
					const branches = branchLines
						? branchLines.split('\n').filter(Boolean).map(line => {
							const parts = line.split('\t')
							const track = (parts[2] || '').replace(/^\[|\]$/g, '')
							const aheadM = track.match(/ahead (\d+)/)
							const behindM = track.match(/behind (\d+)/)
							return {
								name: parts[0] || '',
								upstream: parts[1] || '',
								ahead: aheadM ? parseInt(aheadM[1], 10) : 0,
								behind: behindM ? parseInt(behindM[1], 10) : 0,
								gone: track === 'gone'
							}
						})
						: []

					const tagLines = gitExec(['for-each-ref',
						'--count=30', '--sort=-creatordate',
						'--format=%(refname:short)\t%(objectname:short)\t%(creatordate:relative)',
						'refs/tags/'])
					const tags = tagLines
						? tagLines.split('\n').filter(Boolean).map(line => {
							const parts = line.split('\t')
							return { name: parts[0] || '', sha: parts[1] || '', date: parts[2] || '' }
						})
						: []

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

					jsonResponse(200, { head, headSha, branches, tags, worktrees, stashCount })
				} catch (e) {
					jsonResponse(500, { error: e.message })
				}
				return
			}

			// /_git/log?skip=N&count=M — paginated commit log with lane assignments
			if (decodedUrl === '/_git/log') {
				try {
					const qs = req.originalUrl.split('?')[1] || ''
					const qp = {}
					qs.split('&').forEach(p => { const kv = p.split('='); if (kv[0]) qp[kv[0]] = kv[1] || '' })
					const skip = Math.max(0, parseInt(qp.skip, 10) || 0)
					const count = Math.min(100, Math.max(1, parseInt(qp.count, 10) || 40))

					const totalStr = gitExec(['rev-list', '--all', '--count'])
					const totalCount = parseInt(totalStr, 10) || 0

					// \x1f (unit separator) delimits fields within each commit line
					const SEP = '\x1f'
					const fmtFields = '%H' + SEP + '%P' + SEP + '%s' + SEP + '%an' + SEP + '%ar' + SEP + '%D'
					const logOut = gitExec(['log', '--all', '--topo-order',
						'--format=' + fmtFields,
						'--skip=' + skip,
						'--max-count=' + count])
					let commits = []
					if (logOut) {
						commits = logOut.split('\n').filter(Boolean).map(line => {
							const parts = line.split(SEP)
							const fullSha = parts[0] || ''
							const fullParents = parts[1] ? parts[1].trim().split(' ').filter(Boolean) : []
							const refs = parts[5] ? parts[5].split(', ').filter(Boolean) : []
							return {
								sha: fullSha.slice(0, 8),
								fullSha,
								parents: fullParents.map(p => p.slice(0, 8)),
								_fullParents: fullParents,
								message: parts[2] || '',
								author: parts[3] || '',
								date: parts[4] || '',
								refs,
								lane: 0
							}
						})
					}

					// Assign lanes using full SHAs to avoid short-SHA collisions
					const lanes = []  // lanes[i] = full SHA expected at lane i, or null
					commits.forEach(commit => {
						const { fullSha, _fullParents: parents } = commit
						let laneIdx = lanes.indexOf(fullSha)
						if (laneIdx === -1) {
							laneIdx = lanes.indexOf(null)
							if (laneIdx === -1) { laneIdx = lanes.length; lanes.push(null) }
						}
						commit.lane = laneIdx
						if (parents.length === 0) {
							lanes[laneIdx] = null
						} else {
							lanes[laneIdx] = parents[0]
							for (let j = 1; j < parents.length; j++) {
								if (!lanes.includes(parents[j])) {
									const free = lanes.indexOf(null)
									if (free === -1) lanes.push(parents[j])
									else lanes[free] = parents[j]
								}
							}
						}

						// Clean up zombie lanes: when multiple lanes pointed to this commit,
						// indexOf() picks the first; null the rest so they don't leak into future rows.
						for (let k = 0; k < lanes.length; k++) {
							if (k !== laneIdx && lanes[k] === fullSha) lanes[k] = null
						}
					})

					// Strip internal fields before serialising
					commits.forEach(c => { delete c.fullSha; delete c._fullParents })

					jsonResponse(200, { commits, totalCount, hasMore: skip + commits.length < totalCount })
				} catch (e) {
					jsonResponse(500, { error: e.message })
				}
				return
			}

			// /_git/diff/<sha> — files changed in a commit
			if (decodedUrl.startsWith('/_git/diff/')) {
				try {
					// Strip any non-hex characters to prevent argument injection
					const sha = decodedUrl.slice('/_git/diff/'.length).replace(/[^a-f0-9]/gi, '').slice(0, 40)
					if (!sha) { res.writeHead(400); res.end('Bad sha'); return }
					const message = gitExec(['log', '-1', '--format=%s', sha])
					const diffOut = gitExec(['diff-tree', '-r', '--no-commit-id', '--name-status', sha])
					const files = diffOut
						? diffOut.split('\n').filter(Boolean).map(line => {
							const parts = line.split('\t')
							return { status: parts[0] || '?', path: parts[1] || '' }
						})
						: []
					jsonResponse(200, { sha, message, files })
				} catch (e) {
					jsonResponse(500, { error: e.message })
				}
				return
			}

			// /_git — dashboard HTML page (uses markdown template for consistent chrome)
			if (decodedUrl === '/_git') {
				const _gitTemplateUrl = path.join(__dirname, 'templates/markdown.html')
				const _gitData = {
					title: 'Git Dashboard',
					content: '<div class="git-dashboard" id="git-dashboard"><p class="git-loading">Loading\u2026</p></div>',
					pid: process.pid | 'N/A'
				}
				baseTemplate(_gitTemplateUrl, _gitData).then(final => {
					const lvl2Dir = path.parse(_gitTemplateUrl).dir
					const lvl2Opts = deepmerge(implantOpts, { baseDir: lvl2Dir })
					return implant(final, implantHandlers, lvl2Opts).then(output => {
						res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
						res.end(output)
					}).catch(err => console.error(err))
				})
				return
			}

			// Unrecognised /_git sub-route
			res.writeHead(404, { 'content-type': 'text/plain' })
			res.end('Not found')
			return
		}
