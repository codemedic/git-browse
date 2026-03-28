'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const path = require('path')
const fs = require('fs')
const app = require('../src/server')

describe('Server Integration Tests', () => {
  test('GET / returns 200 and directory listing', async () => {
    const res = await request(app).get('/')
    assert.strictEqual(res.statusCode, 200)
    // Should render README.md in root, which uses markdown-view
    assert.ok(res.text.includes('markdown-view'))
    assert.ok(res.text.includes('git-browse'))
  })

  test('GET /README.md returns 200 and rendered markdown', async () => {
    const res = await request(app).get('/README.md')
    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.text.includes('markdown-view'))
    assert.ok(res.text.includes('git-browse'))
  })

  test('GET /non-existent returns 404', async () => {
    const res = await request(app).get('/non-existent')
    assert.strictEqual(res.statusCode, 404)
    assert.ok(res.text.includes('File Not Found'))
  })

  test('GET /_static/style.css returns 200', async () => {
    const res = await request(app).get('/_static/style.css')
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.type, 'text/css')
  })

  test('GET /_git/state returns JSON git state', async () => {
    const res = await request(app).get('/_git/state')
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.type, 'application/json')
    assert.ok(res.body.head)
  })

  test('GET /_files/listing?path=/ returns JSON file list', async () => {
    const res = await request(app).get('/_files/listing?path=/')
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.type, 'application/json')
    assert.ok(Array.isArray(res.body.entries))
  })

  test('GET /Dockerfile returns 200 (handles files with braces without implant error)', async () => {
    const res = await request(app).get('/Dockerfile')
    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.text.includes('markdown-view'))
    assert.ok(res.text.includes('FROM'))
  })

  test('GET /package.json returns 200 (handles files with curly braces)', async () => {
    const res = await request(app).get('/package.json')
    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.text.includes('git-browse'))
  })

  test('GET /test/frontmatter.md renders frontmatter correctly', async () => {
    const res = await request(app).get('/test/frontmatter.md')
    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.text.includes('markdown-frontmatter'))
    // Delimiters should be present in the HTML (escaped if rendered via highlight.js)
    assert.ok(res.text.includes('---'))
    assert.ok(res.text.includes('title: Frontmatter Test'))
    assert.ok(res.text.includes('status: active'))
  })

  test('GET / verifies repo name prefix in title', async () => {
    // When running tests, dir is usually the current project root.
    const expectedRepoName = path.basename(process.cwd())
    const res = await request(app).get('/')
    assert.strictEqual(res.statusCode, 200)
    // The title should be prefixed with the repo name (basename of CWD in tests)
    assert.ok(res.text.includes(`<title>${expectedRepoName}</title>`), `Title should be "${expectedRepoName}" for root, got text containing title tag: ${res.text.slice(0, 500)}`)
  })

  test('GET /README.md verifies full path in title', async () => {
    const expectedRepoName = path.basename(process.cwd())
    const res = await request(app).get('/README.md')
    assert.strictEqual(res.statusCode, 200)
    // Should be {repoName} - README.md
    assert.ok(res.text.includes(`<title>${expectedRepoName} - README.md</title>`))
  })
})
