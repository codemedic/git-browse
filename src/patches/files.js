		// ---------------------------------------------------------------------------
		// Patch 7: File search + listing (/_files/* virtual routes)
		// ---------------------------------------------------------------------------
		if (decodedUrl.startsWith('/_files/')) {
			const { spawnSync } = require('child_process')

			const jsonResponse = (statusCode, obj) => {
				res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
				res.end(JSON.stringify(obj))
			}

			// Shared helper — returns sorted array of all repo-relevant relative paths.
			// Universe: tracked files ∪ untracked-non-ignored files.
			// Gitignored paths (e.g. .venv, node_modules) are excluded by definition.
			const getGitFiles = () => {
				const gitExec = (args) => {
					const r = spawnSync('git', args, { cwd: dir, timeout: 5000, encoding: 'utf8' })
					if (r.error || r.status !== 0) return ''
					return r.stdout || ''
				}
				const tracked   = gitExec(['ls-files']).split('\n').filter(Boolean)
				const untracked = gitExec(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
				const seen = new Set(tracked)
				untracked.forEach(f => seen.add(f))
				return Array.from(seen).sort()
			}

			// /_files/listing?path=<url-path>
			// Returns immediate children of the given directory as a JSON array,
			// using the same git-aware file universe as the search endpoint so that
			// the sidebar explorer and command palette stay consistent.
			if (decodedUrl === '/_files/listing') {
				try {
					const qs = (req.originalUrl.split('?')[1] || '')
					const qp = {}
					qs.split('&').forEach(p => {
						const kv = p.split('=')
						if (kv[0]) qp[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '')
					})

					// Sanitise and resolve the requested path; reject traversal attempts
					const reqPath = (qp.path || '/').replace(/\/+$/, '') || '/'
					const relReq  = reqPath.replace(/^\/+/, '')
					const absReq  = path.resolve(dir, relReq)
					if (absReq !== dir && !absReq.startsWith(dir + '/')) {
						res.writeHead(403, { 'content-type': 'text/plain' })
						res.end('Forbidden')
						return
					}

					const allFiles = getGitFiles()

					// Prefix of this directory within the repo (e.g. '' for root, 'src/' for /src)
					const prefix = relReq ? relReq + '/' : ''

					const childSeen = new Set()
					const entries   = []
					allFiles.forEach(f => {
						if (!f.startsWith(prefix)) return
						const rest  = f.slice(prefix.length)
						const slash = rest.indexOf('/')
						if (slash === -1) {
							// Direct file child
							if (!childSeen.has(rest)) {
								childSeen.add(rest)
								entries.push({ name: rest, path: '/' + prefix + rest, isDir: false })
							}
						} else {
							// Subdirectory — surface its top-level name only
							const dirName = rest.slice(0, slash)
							if (!childSeen.has(dirName)) {
								childSeen.add(dirName)
								entries.push({ name: dirName, path: '/' + prefix + dirName, isDir: true })
							}
						}
					})

					jsonResponse(200, { entries })
				} catch (e) {
					jsonResponse(500, { error: e.message })
				}
				return
			}

			// /_files/search?q=<query>
			if (decodedUrl === '/_files/search') {
				try {
					const qs = (req.originalUrl.split('?')[1] || '')
					const qp = {}
					qs.split('&').forEach(p => {
						const kv = p.split('=')
						if (kv[0]) qp[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '')
					})
					const query = (qp.q || '').trim().slice(0, 200).replace(/[^\x20-\x7e]/g, '')

					const allFiles = getGitFiles()
					const MAX_RESULTS = 50

					let files
					if (!query) {
						// No query — top-level entries only
						const topSeen = new Set()
						files = []
						allFiles.forEach(f => {
							const slash = f.indexOf('/')
							const top   = slash === -1 ? f : f.slice(0, slash)
							if (!topSeen.has(top)) {
								topSeen.add(top)
								files.push({ name: top, path: '/' + top, isDir: slash !== -1 })
							}
						})
					} else {
						const lq = query.toLowerCase()
						files = allFiles
							.filter(f => f.toLowerCase().includes(lq))
							.slice(0, MAX_RESULTS)
							.map(f => ({ name: f, path: '/' + f, isDir: false }))
					}

					jsonResponse(200, { files })
				} catch (e) {
					jsonResponse(500, { error: e.message })
				}
				return
			}

			res.writeHead(404, { 'content-type': 'text/plain' })
			res.end('Not found')
			return
		}

