		} else if (isHtml) {
			msg('html', style.link(prettyPath), flags)
			getFile(filePath).then(content => {
				// Inject <base> so relative resource URLs resolve correctly inside the iframe
				const _withBase = /<head/i.test(content)
					? content.replace(/(<head[^>]*>)/i, '$1\n<base href="' + decodedUrl + '">')
					: '<base href="' + decodedUrl + '">\n' + content
				const _srcdoc = _withBase.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
				var _maxBt = 0, _btm, _btre = /`+/g
				while ((_btm = _btre.exec(content)) !== null) { if (_btm[0].length > _maxBt) _maxBt = _btm[0].length }
				const _fence = '`'.repeat(Math.max(3, _maxBt + 1))
				const _srcMd = _fence + 'html\n' + content + '\n' + _fence
				return markdownToHTML(_srcMd).then(srcHtml => {
					const _combined =
						'<div class="source-toggle-bar">' +
						'<button class="toggle-btn active" data-panel="preview">Preview</button>' +
						'<button class="toggle-btn" data-panel="source">Code</button>' +
						'</div>' +
						'<div class="toggle-panel" data-panel="preview">' +
						'<iframe class="html-preview-frame" sandbox="allow-scripts allow-same-origin allow-forms" srcdoc="' + _srcdoc + '"></iframe>' +
						'</div>' +
						'<div class="toggle-panel" data-panel="source" style="display:none">' +
						srcHtml +
						'</div>'
					const templateUrl = path.join(__dirname, 'templates/markdown.html')
					const handlebarData = {
						title: path.parse(filePath).base,
						content: _combined,
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
			})