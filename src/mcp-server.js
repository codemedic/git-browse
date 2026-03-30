const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { JSONRPCServer } = require('json-rpc-2.0');
const crypto = require('crypto');
const EventEmitter = require('events');
const Diff = require('diff');

class MCPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = 3001; // Internal port always 3001
    this.externalPort = options.externalPort || process.env.MCP_PORT || 3001;
    this.repoPath = options.repoPath || process.env.REPO_PATH || '.';
    this.containerPath = '/var/www';
    this.ideDir = options.ideDir || '/home/node/.claude/ide';
    this.authToken = crypto.randomUUID();
    this.server = new JSONRPCServer();
    this.wss = null;
    this.pendingDiffs = new Map();
    this.connectedAgent = null;
    this.toolHandlers = {};

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.addMethod('initialize', (params) => {
      console.log(`[MCP] Handling initialize from ${params.clientInfo?.name} ${params.clientInfo?.version}`);
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
          prompts: { listChanged: false }
        },
        serverInfo: {
          name: 'git-browse',
          version: '1.0.0'
        }
      };
    });

    this.server.addMethod('notifications/initialized', () => {
      console.log(`[MCP] Notification: initialized`);
      return null;
    });

    this.server.addMethod('initialized', () => {
      console.log(`[MCP] Method: initialized`);
      return null;
    });

    this.server.addMethod('ide_connected', (params) => {
      console.log(`[MCP] Notification: ide_connected`, JSON.stringify(params));
      return null;
    });

    this.server.addMethod('tools/list', () => {
      return {
        tools: [
          {
            name: 'openFile',
            description: 'Navigate the GitBrowse browser to a specific file.',
            inputSchema: { 
              type: 'object', 
              properties: { 
                path: { type: 'string' }, 
                uri: { type: 'string' },
                file_path: { type: 'string' }
              } 
            }
          },
          {
            name: 'openDiff',
            description: 'Show a diff in the GitBrowse browser for review.',
            inputSchema: { 
              type: 'object', 
              properties: { 
                path: { type: 'string' }, 
                diff: { type: 'string' },
                new_file_path: { type: 'string' },
                new_file_contents: { type: 'string' }
              } 
            }
          }
        ]
      };
    });

    this.server.addMethod('tools/call', async (params) => {
      console.log(`[MCP] Tool Call: ${params.name}`);
      const handler = this.toolHandlers[params.name];
      if (handler) {
        try {
          return await handler(params.arguments);
        } catch (err) {
          console.error(`[MCP] Error in tool ${params.name}:`, err);
          throw err;
        }
      }
      
      console.warn(`[MCP] Tool not found: ${params.name}. Returning OK (no-op).`);
      return { status: 'OK' };
    });

    this.server.addMethod('prompts/list', () => ({ prompts: [] }));
    this.server.addMethod('resources/list', () => ({ resources: [] }));
    this.server.addMethod('getWorkspaceFolders', () => [this.repoPath]);

    // Tool Handlers
    this.toolHandlers.openFile = (params) => {
      const hostPath = params.uri || params.path || params.file_path;
      const filePath = this.translatePath(hostPath);
      this.emit('file:open', { path: filePath });
      return { status: 'OK' };
    };

    this.toolHandlers.openDiff = async (params) => {
      const id = crypto.randomUUID();
      const hostPath = params.path || params.uri || params.new_file_path || params.file_path;
      const filePath = this.translatePath(hostPath);
      const relPath = path.relative(this.containerPath, filePath);
      
      let diffContent = params.diff;
      
      // If we have new contents but no diff, generate a real diff against current disk
      if (!diffContent && params.new_file_contents) {
        let oldContent = '';
        try {
          if (fs.existsSync(filePath)) {
            oldContent = fs.readFileSync(filePath, 'utf8');
            diffContent = Diff.createTwoFilesPatch(relPath, relPath, oldContent, params.new_file_contents, '', '', { context: 3 });
          } else {
            // New file: show everything as additions
            const lines = params.new_file_contents.split('\n');
            diffContent = `--- /dev/null\n+++ ${relPath}\n@@ -0,0 +1,${lines.length} @@\n` + 
                          lines.map(l => '+' + l).join('\n');
          }
        } catch (e) {
          console.error('[MCP] Error generating diff against disk:', e);
        }
      }

      if (!diffContent) {
        try {
          const { spawnSync } = require('child_process');
          const r = spawnSync('git', ['diff', 'HEAD', relPath], { cwd: this.containerPath, timeout: 5000, encoding: 'utf8' });
          diffContent = r.stdout || '';
          if (!diffContent) {
             const r2 = spawnSync('git', ['diff', 'HEAD~1', 'HEAD', '--', relPath], { cwd: this.containerPath, timeout: 5000, encoding: 'utf8' });
             diffContent = r2.stdout || '';
          }
        } catch (e) {
          console.error('[MCP] Failed to generate git diff', e);
        }
      }

      const diffPromise = new Promise((resolve) => {
        this.pendingDiffs.set(id, {
          params,
          filePath,
          diffContent,
          resolve,
          status: 'pending',
          createdAt: Date.now()
        });
      });

      this.emit('diff:new', { id, path: filePath, params, diffContent });
      
      const result = await diffPromise;
      this.pendingDiffs.delete(id);
      return result;
    };

    this.toolHandlers.closeAllDiffTabs = () => {
      for (const [id, diff] of this.pendingDiffs) {
        diff.resolve({ status: 'DIFF_REJECTED' });
      }
      this.pendingDiffs.clear();
      this.emit('diff:clearAll');
      return { status: 'OK' };
    };

    // No-op handlers for optional Claude tools
    this.toolHandlers.close_tab = () => ({ status: 'OK' });
    this.toolHandlers.getDiagnostics = () => ({ diagnostics: [] });
  }

  translatePath(hostPath) {
    if (!hostPath) return hostPath;
    let cleanPath = hostPath.startsWith('file://') ? hostPath.slice(7) : hostPath;
    
    if (!path.isAbsolute(cleanPath)) {
      return path.join(this.containerPath, cleanPath);
    }

    if (cleanPath.startsWith(this.repoPath)) {
      const relative = path.relative(this.repoPath, cleanPath);
      return path.join(this.containerPath, relative);
    }

    return cleanPath;
  }

  start() {
    console.log(`[MCP] Starting WebSocket server on internal port ${this.port}...`);
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('error', (err) => {
      console.error(`[MCP] WebSocket Server Error:`, err);
    });

    this.wss.on('connection', (ws, req) => {
      const remoteAddr = req.socket.remoteAddress;
      console.log(`[MCP] Connection attempt from ${remoteAddr} to ${req.url}`);
      
      const url = new URL(req.url, 'http://localhost');
      const urlToken = url.searchParams.get('authToken');
      const authHeader = req.headers['x-claude-code-ide-authorization'] || req.headers['authorization'];
      const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;
      
      const token = headerToken || urlToken;
      
      if (token !== this.authToken) {
        console.warn(`[MCP] Unauthorized connection attempt from ${remoteAddr}. Expected token: ${this.authToken.slice(0, 4)}..., Got: ${token ? token.slice(0, 4) + '...' : 'null'}`);
        ws.close(4001, 'Unauthorized');
        return;
      }

      console.log(`[MCP] Agent connected from ${remoteAddr}`);
      this.connectedAgent = { name: 'Claude Code' };
      this.emit('agent:connected', this.connectedAgent);

      ws.on('message', async (message) => {
        try {
          const msgStr = message.toString();
          console.log(`[MCP] Raw Received: ${msgStr.slice(0, 500)}${msgStr.length > 500 ? '...' : ''}`);
          const jsonRPCRequest = JSON.parse(msgStr);
          const jsonRPCResponse = await this.server.receive(jsonRPCRequest);
          if (jsonRPCResponse) {
            ws.send(JSON.stringify(jsonRPCResponse));
          }
        } catch (err) {
          console.error(`[MCP] Error handling message:`, err.message, err.stack);
        }
      });

      ws.on('error', (err) => {
        console.error(`[MCP] WebSocket Connection Error:`, err);
      });

      ws.on('close', (code, reason) => {
        console.log(`[MCP] Connection closed: ${code} ${reason}`);
        this.connectedAgent = null;
        this.emit('agent:disconnected');
      });
    });

    this.writeLockFile();
  }

  writeLockFile() {
    if (!fs.existsSync(this.ideDir)) {
      try {
        fs.mkdirSync(this.ideDir, { recursive: true });
      } catch (err) {
        console.error(`[MCP] Failed to create IDE directory: ${this.ideDir}`, err);
        return;
      }
    }

    const lockFile = path.join(this.ideDir, `${this.externalPort}.lock`);
    const lockData = {
      pid: 999999, // Use high PID to prevent Claude from misidentifying as stale
      workspaceFolders: [this.repoPath],
      ideName: 'git-browse',
      transport: 'ws',
      authToken: this.authToken
    };

    console.log(`[MCP] Writing lock file: ${lockFile}`);
    try {
      fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));
      console.log(`[MCP] Successfully wrote lock file: ${lockFile}`);
    } catch (err) {
      console.error(`[MCP] Failed to write lock file: ${lockFile}. Permission error?`, err.message);
    }
  }

  cleanup() {
    const lockFile = path.join(this.ideDir, `${this.externalPort}.lock`);
    if (fs.existsSync(lockFile)) {
      console.log(`[MCP] Cleaning up lock file: ${lockFile}`);
      try {
        fs.unlinkSync(lockFile);
      } catch (err) {
        console.error(`[MCP] Error deleting lock file:`, err.message);
      }
    }
    if (this.wss) {
      console.log(`[MCP] Closing WebSocket server...`);
      this.wss.close();
    }
  }

  respondToDiff(id, action) {
    console.log(`[MCP] Attempting to respond to diff ${id} with action: ${action}`);
    const diff = this.pendingDiffs.get(id);
    if (diff) {
      console.log(`[MCP] Found pending diff for ${diff.filePath}. Resolving...`);
      const result = action === 'approve' ? { status: 'FILE_SAVED' } : { status: 'DIFF_REJECTED' };
      diff.resolve(result);
      this.emit('diff:resolved', { id, action });
      return true;
    }
    console.warn(`[MCP] Response failed: Diff ${id} not found in pending Map. (Total pending: ${this.pendingDiffs.size})`);
    return false;
  }
}

module.exports = MCPServer;
