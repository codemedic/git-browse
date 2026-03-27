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
    assert.ok(res.text.includes('Error 404'))
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

  test('GET /docs/markserv-migration.md returns 200 (handles nested curly braces)', async () => {
    const res = await request(app).get('/docs/markserv-migration.md')
    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.text.includes('markdown-view'))
    assert.ok(res.text.includes('markserv'))
  })
})
