		} else if (isDir) {
			try {
				// Index: Browser is requesting a Directory Index
				msg('dir', style.link(prettyPath), flags)

				// ?listing — return bare directory listing HTML (used by the filetree sidebar)
				if (req.originalUrl && req.originalUrl.includes('listing')) {
					res.writeHead(200, { 'content-type': 'text/html' })
					res.end(dirToHtml(filePath))
					return
				}

				const templateUrl = path.join(__dirname, 'templates/directory.html')

				// If a README exists render it instead of the directory listing; listing is fallback only
				const _entries = fs.readdirSync(filePath)
				const _readme = _entries.find(f => /^readme(\.md|\.markdown|\.txt)?$/i.test(f))
				const _readmePath = _readme ? path.join(filePath, _readme) : null
				const _renderReadme = _readmePath
					? getFile(_readmePath).then(markdownToHTML).catch(() => '')
					: Promise.resolve('')

				return _renderReadme.then(_readmeHtml => {
					const _useReadme = !!_readmeHtml
					const _templateUrl = _useReadme
						? path.join(__dirname, 'templates/markdown.html')
						: templateUrl
					const handlebarData = {
						dirname: path.parse(filePath).dir,
						content: _useReadme
							? '<div class="readme-body markdown-body">' + _readmeHtml + '</div>'
							: dirToHtml(filePath),
						title: path.parse(filePath).base,
						pid: process.pid | 'N/A',
						breadcrumbs: createBreadcrumbs(path.relative(dir, filePath))
					}

					return baseTemplate(_templateUrl, handlebarData).then(final => {
						const lvl2Dir = path.parse(_templateUrl).dir
						const lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
						return implant(final, implantHandlers, lvl2Opts).then(output => {
							res.writeHead(200, {
								'content-type': 'text/html'
							})
							res.end(output)
						}).catch(error => {
							console.error(error)
						})
					})
				})
			} catch (error) {
				errorPage(500, filePath, error)
			}