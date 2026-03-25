		} else {
			// Code files: render with syntax highlighting via existing markdown-it-highlightjs pipeline
			const codeExts = new Set([
				'.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
				'.py', '.go', '.rs', '.java', '.c', '.cpp', '.cc', '.h', '.hpp',
				'.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.lua',
				'.css', '.scss', '.less', '.sass',
				'.sh', '.bash', '.zsh', '.fish',
				'.yml', '.yaml', '.json', '.toml', '.ini',
				'.xml', '.sql', '.tf', '.hcl', '.proto', '.vim', '.mk'
			])
			const codeNames = new Set(['dockerfile', 'makefile', 'jenkinsfile', 'vagrantfile'])
			const parsed = path.parse(filePath)
			const isCode = codeExts.has(parsed.ext.toLowerCase()) ||
				codeNames.has(parsed.base.toLowerCase())

			if (isCode) {
				msg('code', style.link(prettyPath), flags)
				getFile(filePath).then(content => {
					const lang = parsed.ext ? parsed.ext.slice(1) : parsed.base.toLowerCase()
					const markdownContent = '```' + lang + '\n' + content + '\n```'
					return markdownToHTML(markdownContent).then(html => {
						return implant(html, implantHandlers, implantOpts).then(output => {
							const templateUrl = path.join(__dirname, 'templates/markdown.html')
							const handlebarData = {
								title: parsed.base,
								content: output,
								pid: process.pid | 'N/A'
							}
							return baseTemplate(templateUrl, handlebarData).then(final => {
								const lvl2Dir = path.parse(templateUrl).dir
								const lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
								return implant(final, implantHandlers, lvl2Opts).then(output => {
									res.writeHead(200, {'content-type': 'text/html'})
									res.end(output)
								})
							})
						})
					})
				}).catch(error => {
					console.error(error)
					send(req, filePath, {dotfiles: 'allow'}).pipe(res)
				})
			} else {
				// Browser-native types: show a viewer page when navigated to directly (Accept: text/html),
				// but serve raw bytes when fetched as a resource (img src, video src, etc.).
				// This mirrors GitHub's behaviour — same URL works for both contexts.
				const _imgExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'])
				const _vidExts = new Set(['.mp4', '.webm', '.ogv', '.mov'])
				const _audExts = new Set(['.mp3', '.wav', '.oga', '.ogg', '.flac', '.aac', '.m4a'])
				const _ext = parsed.ext.toLowerCase()
				const _isBrowserNative = _ext === '.pdf' || _imgExts.has(_ext) || _vidExts.has(_ext) || _audExts.has(_ext)
				if (_isBrowserNative) {
					const _acceptsHtml = (req.headers['accept'] || '').includes('text/html')
					if (!_acceptsHtml) {
						// Resource request — serve raw so the embedded element can load the file
						msg('file', style.link(prettyPath), flags)
						send(req, filePath, {dotfiles: 'allow'}).pipe(res)
						return
					}
					// Navigation request — render a viewer page using the standard template
					msg('view', style.link(prettyPath), flags)
					let _embedHtml
					if (_imgExts.has(_ext)) {
						_embedHtml = '<div class="bin-viewer image-viewer"><img src="' + decodedUrl + '" alt="' + parsed.base + '"></div>'
					} else if (_ext === '.pdf') {
						_embedHtml = '<div class="bin-viewer pdf-viewer"><embed src="' + decodedUrl + '" type="application/pdf"></div>'
					} else if (_vidExts.has(_ext)) {
						_embedHtml = '<div class="bin-viewer video-viewer"><video controls><source src="' + decodedUrl + '"></video></div>'
					} else {
						_embedHtml = '<div class="bin-viewer audio-viewer"><audio controls><source src="' + decodedUrl + '"></audio></div>'
					}
					markdownToHTML(_embedHtml).then(html => {
						return implant(html, implantHandlers, implantOpts).then(output => {
							const templateUrl = path.join(__dirname, 'templates/markdown.html')
							const handlebarData = {
								title: parsed.base,
								content: output,
								pid: process.pid | 'N/A'
							}
							return baseTemplate(templateUrl, handlebarData).then(final => {
								const lvl2Dir = path.parse(templateUrl).dir
								const lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
								return implant(final, implantHandlers, lvl2Opts).then(output => {
									res.writeHead(200, {'content-type': 'text/html'})
									res.end(output)
								})
							})
						})
					}).catch(error => {
						console.error(error)
						send(req, filePath, {dotfiles: 'allow'}).pipe(res)
					})
					return
				}

				// Unknown extension: probe first 8 kB for null bytes — same heuristic as the
				// `file` command. Any null byte → binary (show info page). Otherwise
				// treat as plain text and render in the browser.
				const _buf = Buffer.alloc(8192)
				const _fd = fs.openSync(filePath, 'r')
				const _n = fs.readSync(_fd, _buf, 0, 8192, 0)
				fs.closeSync(_fd)
				if (_buf.slice(0, _n).includes(0x00)) {
					// Confirmed binary — render an info page rather than forcing a download
					msg('binary', style.link(prettyPath), flags)
					const _stat = fs.statSync(filePath)
					const _sz = _stat.size
					const _humanSize = _sz >= 1048576
						? (_sz / 1048576).toFixed(1) + ' MB'
						: _sz >= 1024
							? (_sz / 1024).toFixed(1) + ' KB'
							: _sz + ' B'
					const _infoMd = '## ' + parsed.base + '\n\n' +
						'| | |\n|---|---|\n' +
						'| **Path** | `' + decodedUrl + '` |\n' +
						'| **Size** | ' + _humanSize + ' |\n\n' +
						'> Binary file — cannot be displayed in the browser.'
					markdownToHTML(_infoMd).then(html => {
						return implant(html, implantHandlers, implantOpts).then(output => {
							const templateUrl = path.join(__dirname, 'templates/markdown.html')
							const handlebarData = {
								title: parsed.base,
								content: output,
								pid: process.pid | 'N/A'
							}
							return baseTemplate(templateUrl, handlebarData).then(final => {
								const lvl2Dir = path.parse(templateUrl).dir
								const lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
								return implant(final, implantHandlers, lvl2Opts).then(output => {
									res.writeHead(200, {'content-type': 'text/html'})
									res.end(output)
								})
							})
						})
					}).catch(error => {
						console.error(error)
						res.writeHead(500, {'content-type': 'text/plain'})
						res.end('Error rendering binary info page')
					})
				} else {
					// Text with unrecognised extension — render as plain text
					msg('text', style.link(prettyPath), flags)
					getFile(filePath).then(content => {
						const markdownContent = '```\n' + content + '\n```'
						return markdownToHTML(markdownContent).then(html => {
							return implant(html, implantHandlers, implantOpts).then(output => {
								const templateUrl = path.join(__dirname, 'templates/markdown.html')
								const handlebarData = {
									title: parsed.base,
									content: output,
									pid: process.pid | 'N/A'
								}
								return baseTemplate(templateUrl, handlebarData).then(final => {
									const lvl2Dir = path.parse(templateUrl).dir
									const lvl2Opts = deepmerge(implantOpts, {baseDir: lvl2Dir})
									return implant(final, implantHandlers, lvl2Opts).then(output => {
										res.writeHead(200, {'content-type': 'text/html'})
										res.end(output)
									})
								})
							})
						})
					}).catch(error => {
						console.error(error)
						send(req, filePath, {dotfiles: 'allow'}).pipe(res)
					})
				}
			}
		}