'use strict'

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const path = require('path')
const app = require('../src/server')
const MCPServer = require('../src/mcp-server')

describe('Agent Integration Integration Tests', () => {
  let mcp;

  before(() => {
    mcp = new MCPServer({
      port: 3003,
      repoPath: process.cwd(),
      ideDir: path.join(__dirname, 'tmp-ide-integration')
    })
    app.__setMCPServer(mcp)
  })

  after(() => {
    mcp.cleanup()
    const tmp = path.join(__dirname, 'tmp-ide-integration')
    if (require('fs').existsSync(tmp)) {
      require('fs').rmSync(tmp, { recursive: true, force: true })
    }
  })

  test('GET /_agent/status returns initial status', async () => {
    const res = await request(app).get('/_agent/status')
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body.connected, false)
    assert.strictEqual(res.body.pendingCount, 0)
  })

  test('GET /_agent/events handles SSE connection and init event', (t, done) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.get(`http://localhost:${port}/_agent/events`, (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'text/event-stream');
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
          if (data.includes('event: init')) {
            res.destroy(); // Close response
            req.destroy(); // Close request
            server.close(() => {
              done();
            });
          }
        });
      });
      
      req.on('error', (err) => {
        server.close(() => done(err));
      });
    });

    server.on('error', (err) => {
      done(err);
    });
  })

  test('POST /_agent/respond/:id handles resolution', async () => {
    // Add a fake diff
    const id = 'fake-diff-id'
    const resolvePromise = new Promise(resolve => {
        mcp.pendingDiffs.set(id, {
            filePath: '/var/www/README.md',
            resolve,
            status: 'pending'
        })
    })

    const res = await request(app)
        .post('/_agent/respond/' + id)
        .send({ action: 'approve' })
    
    assert.strictEqual(res.statusCode, 200)
    const resolution = await resolvePromise
    assert.strictEqual(resolution.status, 'FILE_SAVED')
  })

  test('GET /_agent/diff/:id returns 404 for missing diff', async () => {
    const res = await request(app).get('/_agent/diff/missing')
    assert.strictEqual(res.statusCode, 404)
  })

  test('GET /_agent/diff/:id returns 200 for existing diff', async () => {
    const id = 'existing-diff-id'
    mcp.pendingDiffs.set(id, {
        filePath: '/var/www/README.md',
        diffContent: '@@ -1 +1 @@\n-old\n+new',
        status: 'pending'
    })

    const res = await request(app).get('/_agent/diff/' + id)
    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.text.includes('Review: README.md'))
    assert.ok(res.text.includes('existing-diff-id'))
  })
})
