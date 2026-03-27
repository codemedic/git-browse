const startLiveReloadServer = (liveReloadPort, flags) => {
	let {dir} = flags
	const isDir = fs.statSync(dir).isDirectory()
	if (!isDir) {
		dir = path.parse(flags.dir).dir
	}

	const ig = require('ignore').default()
	for (const f of ['.gitignore', '.git/info/exclude']) {
		const full = path.join(dir, f)
		if (fs.existsSync(full)) ig.add(fs.readFileSync(full, 'utf8'))
	}

	return liveReload.createServer({
		port: liveReloadPort,
		// Pass directories through so chokidar descends into them;
		// filter files against combined gitignore rules.
		ignored: (filePath, stats) => {
			if (stats && !stats.isFile()) return false
			const rel = path.relative(dir, filePath)
			return rel.startsWith('..') ? false : ig.ignores(rel)
		}
	}).watch(path.resolve(dir))
}
