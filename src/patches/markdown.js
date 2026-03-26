		if (isMarkdown) {
			msg('markdown', style.link(prettyPath), flags)
			getFile(filePath).then(rawSource => {
				const fmMatch = rawSource.match(/^---\r?\n([\s\S]*?)\n---\r?\n/);
				const content = fmMatch ? rawSource.slice(fmMatch[0].length) : rawSource;
				const fmYaml = fmMatch ? '```yaml\n' + fmMatch[1] + '\n```' : '';

				return Promise.all([
					fmYaml ? markdownToHTML(fmYaml) : Promise.resolve(''),
					markdownToHTML(content)
				]).then(([fmHtml, renderedBody]) => {
					const frontmatter = fmHtml ? '<div class="markdown-frontmatter">\n' + fmHtml + '</div>\n' : '';
					const renderedHtml = frontmatter + renderedBody;
					return implant(renderedHtml, implantHandlers, implantOpts).then(renderedOutput => {
						var _maxBt = 0, _btm, _btre = /`+/g
						while ((_btm = _btre.exec(rawSource)) !== null) { if (_btm[0].length > _maxBt) _maxBt = _btm[0].length }
						const _fence = '`'.repeat(Math.max(3, _maxBt + 1))
						const _srcMd = _fence + 'markdown\n' + rawSource + '\n' + _fence
						return markdownToHTML(_srcMd).then(srcHtml => {
							const _combined =
								'<div class="source-toggle-bar">' +
								'<button class="toggle-btn active" data-panel="preview">Preview</button>' +
								'<button class="toggle-btn" data-panel="source">Source</button>' +
								'</div>' +
								'<div class="toggle-panel" data-panel="preview">' +
								renderedOutput +
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
					})
				})
			}).catch(error => {
				console.error(error)
			})
		}