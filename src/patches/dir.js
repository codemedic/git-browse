		} else if (isDir) {
			try {
				// Index: Browser is requesting a Directory Index
				msg('dir', style.link(prettyPath), flags)

				const templateUrl = path.join(__dirname, 'templates/directory.html')

				// GitHub-style: find a README in the directory and render it below the listing
				const _entries = fs.readdirSync(filePath)
				const _readme = _entries.find(f => /^readme(\.md|\.markdown|\.txt)?$/i.test(f))
				const _readmePath = _readme ? path.join(filePath, _readme) : null
				const _renderReadme = _readmePath
					? getFile(_readmePath).then(markdownToHTML).catch(() => '')
					: Promise.resolve('')

				return _renderReadme.then(_readmeHtml => {
					const handlebarData = {
						dirname: path.parse(filePath).dir,
						content: dirToHtml(filePath) + (_readmeHtml
							? '<hr class="readme-divider"><div class="readme-body markdown-body">' + _readmeHtml + '</div>'
							: ''),
						title: path.parse(filePath).base,
						pid: process.pid | 'N/A',
						breadcrumbs: createBreadcrumbs(path.relative(dir, filePath))
					}

					return baseTemplate(templateUrl, handlebarData).then(final => {
						const lvl2Dir = path.parse(templateUrl).dir
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