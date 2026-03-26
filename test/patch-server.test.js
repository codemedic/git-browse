// Unit tests for patch-server.js logic and patch fragment correctness.
// Uses Node's built-in test runner and assert — no npm install required.
'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..')
const FIXTURE = path.join(__dirname, 'fixtures', 'server-original.js')
const PATCHES_DIR = path.join(ROOT, 'src', 'patches')

// ---------------------------------------------------------------------------
// Helpers: reproduce patch logic inline so tests don't require side-effects
// ---------------------------------------------------------------------------

function evalOldConst (src, name) {
	// Extract the template literal string for an OLD_* or NEW_* const from
	// patch-server.js source text and evaluate it into a plain string.
	const re = new RegExp('const ' + name + ' = `([\\s\\S]*?)`\\n')
	const m = src.match(re)
	if (!m) throw new Error('Could not find ' + name + ' in patch-server.js')
	// eslint-disable-next-line no-eval
	return eval('`' + m[1] + '`')
}

function applyPatches (snapshot, patchSrc) {
	const OLD_FILE     = evalOldConst(patchSrc, 'OLD_FILE')
	const OLD_DIR      = evalOldConst(patchSrc, 'OLD_DIR')
	const OLD_HTML     = evalOldConst(patchSrc, 'OLD_HTML')
	const OLD_MARKDOWN = evalOldConst(patchSrc, 'OLD_MARKDOWN')
	const OLD_GIT      = evalOldConst(patchSrc, 'OLD_GIT')
	const OLD_HLJS     = evalOldConst(patchSrc, 'OLD_HLJS')

	const NEW_FILE     = fs.readFileSync(path.join(PATCHES_DIR, 'other.js'),    'utf8').trimEnd()
	const NEW_DIR      = fs.readFileSync(path.join(PATCHES_DIR, 'dir.js'),      'utf8').trimEnd()
	const NEW_HTML     = fs.readFileSync(path.join(PATCHES_DIR, 'html.js'),     'utf8').trimEnd()
	const NEW_MARKDOWN = fs.readFileSync(path.join(PATCHES_DIR, 'markdown.js'), 'utf8').trimEnd()
	const gitFragment  = fs.readFileSync(path.join(PATCHES_DIR, 'git-state.js'), 'utf8').trimEnd()
	const NEW_GIT      = gitFragment + '\n\n\t\tconst prettyPath = filePath'
	const NEW_HLJS     = evalOldConst(patchSrc, 'NEW_HLJS')

	let content = snapshot
	content = content.replace(OLD_FILE, NEW_FILE)
	content = content.replace(OLD_DIR, NEW_DIR)
	content = content.replace(OLD_HTML, NEW_HTML)
	content = content.replace(OLD_MARKDOWN, NEW_MARKDOWN)
	content = content.replace(OLD_GIT, NEW_GIT)
	content = content.replace(OLD_HLJS, NEW_HLJS)
	return content
}

// ---------------------------------------------------------------------------
// Test 1: Patched server.js is syntactically valid JavaScript
// ---------------------------------------------------------------------------

test('patched server.js is syntactically valid', () => {
	const snapshot   = fs.readFileSync(FIXTURE, 'utf8')
	const patchSrc   = fs.readFileSync(path.join(ROOT, 'src', 'patch-server.js'), 'utf8')
	const patched    = applyPatches(snapshot, patchSrc)

	// compileFunction validates syntax without executing the code
	assert.doesNotThrow(() => {
		new vm.Script(patched)
	}, 'patched server.js must be valid JS')
})

// ---------------------------------------------------------------------------
// Test 2: Each OLD_* string is present in the snapshot (version drift guard)
// ---------------------------------------------------------------------------

test('each OLD_* string is present in the server-original.js snapshot', () => {
	const snapshot  = fs.readFileSync(FIXTURE, 'utf8')
	const patchSrc  = fs.readFileSync(path.join(ROOT, 'src', 'patch-server.js'), 'utf8')

	for (const name of ['OLD_FILE', 'OLD_DIR', 'OLD_HTML', 'OLD_MARKDOWN', 'OLD_GIT', 'OLD_HLJS']) {
		const old = evalOldConst(patchSrc, name)
		assert.ok(
			snapshot.includes(old),
			name + ' target block not found in server-original.js — markserv may have changed'
		)
	}
})

// ---------------------------------------------------------------------------
// Test 6: Patch 5 — /_git route block is present after patching
// ---------------------------------------------------------------------------

test('patched server.js contains /_git route handler', () => {
	const snapshot  = fs.readFileSync(FIXTURE, 'utf8')
	const patchSrc  = fs.readFileSync(path.join(ROOT, 'src', 'patch-server.js'), 'utf8')
	const patched   = applyPatches(snapshot, patchSrc)

	assert.ok(patched.includes('/_git/state'), 'patched server.js must contain /_git/state route')
	assert.ok(patched.includes('/_git/log'),   'patched server.js must contain /_git/log route')
	assert.ok(patched.includes('/_git/diff/'), 'patched server.js must contain /_git/diff/ route')
})

// ---------------------------------------------------------------------------
// Test 7: Patch 6 — hljs mermaid language registration is present after patching
// ---------------------------------------------------------------------------

test('patched server.js registers mermaid as a no-op hljs language', () => {
	const snapshot  = fs.readFileSync(FIXTURE, 'utf8')
	const patchSrc  = fs.readFileSync(path.join(ROOT, 'src', 'patch-server.js'), 'utf8')
	const patched   = applyPatches(snapshot, patchSrc)

	assert.ok(
		patched.includes("registerLanguage('mermaid'"),
		'patched server.js must register mermaid as an hljs language'
	)
})

// ---------------------------------------------------------------------------
// Test 3: Dynamic fence-length calculation
// ---------------------------------------------------------------------------

// Reproduce the fence logic used in both html.js and markdown.js
function calcFence (content) {
	var _maxBt = 0, _btm, _btre = /`+/g
	while ((_btm = _btre.exec(content)) !== null) {
		if (_btm[0].length > _maxBt) _maxBt = _btm[0].length
	}
	return '`'.repeat(Math.max(3, _maxBt + 1))
}

test('fence length: empty string → 3 backticks', () => {
	assert.equal(calcFence(''), '```')
})

test('fence length: single backtick run (max=1) → 3 backticks', () => {
	assert.equal(calcFence('some `code`'), '```')
})

test('fence length: triple-backtick fence in content (max=3) → 4 backticks', () => {
	assert.equal(calcFence('```js\n```'), '````')
})

test('fence length: five-backtick run (max=5) → 6 backticks', () => {
	assert.equal(calcFence('`````'), '``````')
})

// ---------------------------------------------------------------------------
// Test 4: HTML srcdoc escaping
// ---------------------------------------------------------------------------

function srcdocEscape (html) {
	return html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

test('srcdoc escaping: & and " are replaced', () => {
	assert.equal(
		srcdocEscape('<p class="x">A&B</p>'),
		'<p class=&quot;x&quot;>A&amp;B</p>'
	)
})

// ---------------------------------------------------------------------------
// Test 5: Base tag injection
// ---------------------------------------------------------------------------

function injectBase (content, href) {
	return /<head/i.test(content)
		? content.replace(/(<head[^>]*>)/i, '$1\n<base href="' + href + '">')
		: '<base href="' + href + '">\n' + content
}

test('base tag injection: <head> present → inject after opening tag', () => {
	const result = injectBase('<html><head><title>T</title></head></html>', '/foo/')
	assert.ok(result.includes('<head>\n<base href="/foo/">'))
})

test('base tag injection: no <head> → prepend base tag', () => {
	const result = injectBase('<p>hello</p>', '/foo/')
	assert.ok(result.startsWith('<base href="/foo/">\n'))
})
