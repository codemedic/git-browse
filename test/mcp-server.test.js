'use strict'

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const fs = require('fs')
const MCPServer = require('../src/mcp-server')
const WebSocket = require('ws')

describe('MCPServer Unit Tests', () => {
  const tmpIdeDir = path.join(__dirname, 'tmp-ide')
  const repoPath = '/home/user/project'
  const containerPath = '/var/www'
  let mcp;

  before(() => {
    if (!fs.existsSync(tmpIdeDir)) fs.mkdirSync(tmpIdeDir)
    mcp = new MCPServer({
      externalPort: 3002,
      repoPath,
      ideDir: tmpIdeDir
    })
  })

  after(() => {
    mcp.cleanup()
    if (fs.existsSync(tmpIdeDir)) {
      fs.rmSync(tmpIdeDir, { recursive: true, force: true })
    }
  })

  test('Path translation: host to container', () => {
    assert.strictEqual(
      mcp.translatePath('/home/user/project/src/main.js'),
      '/var/www/src/main.js'
    )
    assert.strictEqual(
      mcp.translatePath('src/main.js'),
      '/var/www/src/main.js'
    )
    assert.strictEqual(
      mcp.translatePath('file:///home/user/project/README.md'),
      '/var/www/README.md'
    )
  })

  test('Lock file lifecycle', () => {
    mcp.writeLockFile()
    const lockFile = path.join(tmpIdeDir, '3002.lock')
    assert.ok(fs.existsSync(lockFile), 'Lock file should exist')
    
    const data = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
    assert.strictEqual(data.ideName, 'git-browse')
    assert.strictEqual(data.authToken, mcp.authToken)
    assert.deepEqual(data.workspaceFolders, [repoPath])

    mcp.cleanup()
    assert.ok(!fs.existsSync(lockFile), 'Lock file should be removed on cleanup')
  })

  test('JSON-RPC: getWorkspaceFolders', async () => {
    const result = await mcp.server.receive({
      jsonrpc: '2.0',
      id: 1,
      method: 'getWorkspaceFolders'
    })
    assert.deepEqual(result.result, [repoPath])
  })

  test('Diff resolution flow', async () => {
    const diffParams = { path: 'src/test.js', diff: '@@ -1 +1 @@\n-old\n+new' }
    
    // Start openDiff via tools/call (it blocks)
    const diffPromise = mcp.server.receive({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'openDiff',
        arguments: diffParams
      }
    })

    // Wait a bit for it to be registered
    await new Promise(r => setTimeout(r, 50))
    
    assert.strictEqual(mcp.pendingDiffs.size, 1)
    const [id] = mcp.pendingDiffs.keys()
    
    // Resolve it
    mcp.respondToDiff(id, 'approve')
    
    const response = await diffPromise
    assert.strictEqual(response.result.status, 'FILE_SAVED')
    assert.strictEqual(mcp.pendingDiffs.size, 0)
  })

  test('Intelligent diff generation from new_file_contents', async () => {
    const testFile = path.join(__dirname, 'diff-test.txt');
    fs.writeFileSync(testFile, 'line 1\nline 2\nline 3\n');
    
    // We need to trick translatePath to return this local file
    const originalTranslate = mcp.translatePath;
    mcp.translatePath = () => testFile;

    try {
      const diffPromise = mcp.server.receive({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'openDiff',
          arguments: {
            path: 'diff-test.txt',
            new_file_contents: 'line 1\nline 2 MODIFIED\nline 3\n'
          }
        }
      });

      await new Promise(r => setTimeout(r, 50));
      
      const pending = Array.from(mcp.pendingDiffs.values())[0];
      assert.ok(pending.diffContent.includes('-line 2'));
      assert.ok(pending.diffContent.includes('+line 2 MODIFIED'));
      // Should NOT include line 1 or 3 as changes
      assert.ok(!pending.diffContent.includes('-line 1'));
      
      mcp.respondToDiff(Array.from(mcp.pendingDiffs.keys())[0], 'approve');
      await diffPromise;
    } finally {
      mcp.translatePath = originalTranslate;
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }
  })

  test('Diff rejection format', async () => {
    const diffPromise = mcp.server.receive({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'openDiff',
        arguments: { path: 'reject-test.js', diff: '@@ -1 +1 @@\n-old\n+new' }
      }
    });

    await new Promise(r => setTimeout(r, 50));
    const [id] = mcp.pendingDiffs.keys();
    mcp.respondToDiff(id, 'reject');

    const response = await diffPromise;
    assert.ok(response.result.error, 'Should return an error object on rejection');
    assert.strictEqual(response.result.error.message, 'REJECTED');
  })
})
