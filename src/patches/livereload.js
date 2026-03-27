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

	// The bundled livereload version only supports `exts` + `exclusions` — it ignores
	// a custom `ignored` function. Instead, override filterRefresh (called by chokidar
	// on every change event) to apply gitignore rules rather than an extension list.
	// Must be set before .watch() since watch() binds filterRefresh immediately.
	const server = liveReload.createServer({ port: liveReloadPort })
	server.filterRefresh = function (filepath) {
		const rel = path.relative(dir, filepath)
		if (!rel || rel.startsWith('..')) return
		if (!ig.ignores(rel)) server.refresh(filepath)
	}
	server.watch(path.resolve(dir))
	return server
}
