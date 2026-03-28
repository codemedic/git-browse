(function () {
  'use strict';

  if (window.self !== window.top) return;

  var STORAGE_KEY    = 'git-browse-changed-files';
  var MINIMIZED_KEY  = 'git-browse-change-toast-minimized';
  var MOUNT_PREFIX   = '/var/www/';
  var MAX_FILES      = 100;

  // ---------------------------------------------------------------------------
  // WebSocket interception — must run synchronously before livereload.js loads
  // ---------------------------------------------------------------------------

  var OriginalWebSocket = window.WebSocket;

  // Returns true if the changed file (absolute container path) is the file
  // currently displayed in the browser.
  // Directory views (pathname ends with '/') always allow reload — the listing
  // may have changed.  Special routes (/_git, /_files) never reload on file changes.
  // Matches server's readme lookup: readme[.md|.markdown|.txt]
  var README_RE = /^readme(\.md|\.markdown|\.txt)?$/i;

  function isCurrentFile(rawPath) {
    var pathname = window.location.pathname;
    if (pathname.startsWith('/_')) return false;      // virtual routes — never reload
    var rel = normalizePath(rawPath);
    if (pathname.endsWith('/')) {
      // Directory view: only reload if the changed file is the readme being rendered.
      var dirRel = pathname.replace(/^\//, '');       // '' for root, 'bla/' for /bla/
      if (rel.indexOf(dirRel) !== 0) return false;   // not inside this directory
      return README_RE.test(rel.slice(dirRel.length));
    }
    var current = pathname.replace(/^\//, '');
    return rel === current;
  }

  function WrappedWebSocket(url, protocols) {
    var ws = protocols !== undefined
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    // Register our listener BEFORE livereload sets ws.onmessage, so we fire first.
    // stopImmediatePropagation() will then prevent the onmessage handler from running.
    ws.addEventListener('message', function (event) {
      try {
        var data = JSON.parse(event.data);
        if (data.command === 'reload' && data.path) {
          addChangedFile(data.path);
          // Suppress the reload for files other than the one currently viewed.
          // Update the toast in place instead — DOMContentLoaded won't fire again.
          if (!isCurrentFile(data.path)) {
            event.stopImmediatePropagation();
            renderToast(loadChanges());
          }
        }
      } catch (e) { /* not JSON — let it through */ }
    });

    return ws;
  }

  // Preserve prototype chain and static constants so livereload's instanceof/readyState checks work
  WrappedWebSocket.prototype             = OriginalWebSocket.prototype;
  WrappedWebSocket.CONNECTING            = OriginalWebSocket.CONNECTING;
  WrappedWebSocket.OPEN                  = OriginalWebSocket.OPEN;
  WrappedWebSocket.CLOSING               = OriginalWebSocket.CLOSING;
  WrappedWebSocket.CLOSED                = OriginalWebSocket.CLOSED;

  window.WebSocket = WrappedWebSocket;

  // ---------------------------------------------------------------------------
  // localStorage helpers
  // ---------------------------------------------------------------------------

  function loadChanges() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && parsed.v === 1 && parsed.files) ? parsed.files : {};
    } catch (e) {
      return {};
    }
  }

  function saveChanges(files) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, files: files }));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  function normalizePath(rawPath) {
    if (rawPath.indexOf(MOUNT_PREFIX) === 0) return rawPath.slice(MOUNT_PREFIX.length);
    return rawPath.replace(/^\/+/, '');
  }

  function addChangedFile(rawPath) {
    var rel = normalizePath(rawPath);
    if (!rel) return;

    var files = loadChanges();
    files[rel] = Date.now();

    // Enforce hard cap: evict oldest entries
    var keys = Object.keys(files);
    if (keys.length > MAX_FILES) {
      keys.sort(function (a, b) { return files[a] - files[b]; });
      for (var i = 0; i < keys.length - MAX_FILES; i++) {
        delete files[keys[i]];
      }
    }

    saveChanges(files);
    // Toast will be created/updated on the next page load (livereload reloads)
  }

  function removeFile(rel) {
    var files = loadChanges();
    delete files[rel];
    saveChanges(files);
    renderToast(files);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    hideToast();
  }

  // ---------------------------------------------------------------------------
  // Tree builder
  // ---------------------------------------------------------------------------

  function buildTree(files) {
    var root = { children: {}, files: [] };
    var paths = Object.keys(files).sort();

    for (var i = 0; i < paths.length; i++) {
      var parts = paths[i].split('/');
      var node = root;
      for (var j = 0; j < parts.length - 1; j++) {
        if (!node.children[parts[j]]) {
          node.children[parts[j]] = { name: parts[j], children: {}, files: [] };
        }
        node = node.children[parts[j]];
      }
      node.files.push({ name: parts[parts.length - 1], fullPath: paths[i] });
    }

    return root;
  }

  // Collapse directory nodes that have exactly one child dir and no files
  // Returns a display label (e.g. "src/patches") and the leaf node
  function collapseNode(node) {
    var childKeys = Object.keys(node.children);
    if (node.files.length === 0 && childKeys.length === 1) {
      var child = node.children[childKeys[0]];
      var result = collapseNode(child);
      return {
        label: childKeys[0] + '/' + result.label,
        node: result.node
      };
    }
    return { label: '', node: node };
  }

  function renderTreeNode(node, parentLabel) {
    var ul = document.createElement('ul');
    ul.className = 'change-tree';

    // Directories first
    var childKeys = Object.keys(node.children).sort();
    for (var i = 0; i < childKeys.length; i++) {
      var key = childKeys[i];
      var child = node.children[key];
      var collapsed = collapseNode(child);
      var dirLabel = key + (collapsed.label ? '/' + collapsed.label : '') + '/';
      var leafNode = collapsed.node;

      var li = document.createElement('li');
      li.className = 'change-tree-dir';

      var toggle = document.createElement('span');
      toggle.className = 'change-tree-toggle';
      toggle.innerHTML = '<span class="change-tree-dir-icon"><i data-lucide="chevron-down"></i></span> ' + escapeHtml(dirLabel);
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');

      var subtree = renderTreeNode(leafNode, dirLabel);
      toggle.addEventListener('click', function (subEl) {
        return function () {
          var isHidden = subEl.style.display === 'none';
          subEl.style.display = isHidden ? '' : 'none';
          var icon = this.querySelector('.change-tree-dir-icon');
          if (icon) {
            icon.innerHTML = '<i data-lucide="' + (isHidden ? 'chevron-down' : 'chevron-right') + '"></i>';
            if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(icon);
          }
        };
      }(subtree));

      li.appendChild(toggle);
      li.appendChild(subtree);
      ul.appendChild(li);
    }

    // Files
    for (var j = 0; j < node.files.length; j++) {
      (function (fileEntry) {
        var li = document.createElement('li');
        li.className = 'change-tree-file';

        var iconName = window.__gitBrowseIcons ? window.__gitBrowseIcons.getFileIcon(fileEntry.name) : 'file';

        var link = document.createElement('a');
        link.className = 'change-tree-file-link';
        link.href = '/' + fileEntry.fullPath;
        link.title = fileEntry.fullPath;
        link.innerHTML = '<span class="change-tree-file-icon" aria-hidden="true"><i data-lucide="' + iconName + '"></i></span> <span class="change-tree-file-name">' + escapeHtml(fileEntry.name) + '</span>';

        var dismissBtn = document.createElement('button');
        dismissBtn.className = 'change-tree-dismiss-btn';
        dismissBtn.setAttribute('aria-label', 'Dismiss ' + fileEntry.name);
        dismissBtn.innerHTML = '<i data-lucide="x"></i>';
        dismissBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          removeFile(fileEntry.fullPath);
        });

        li.appendChild(link);
        li.appendChild(dismissBtn);
        ul.appendChild(li);
      }(node.files[j]));
    }

    // Initialize icons if possible
    if (window.__gitBrowseIcons) {
      setTimeout(function() { window.__gitBrowseIcons.create(ul); }, 0);
    }

    return ul;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // Toast UI
  // ---------------------------------------------------------------------------

  function hideToast() {
    var toast = document.getElementById('change-toast');
    if (!toast) return;
    toast.classList.remove('change-toast-visible');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
  }

  function fileCount(files) {
    return Object.keys(files).length;
  }

  function renderToast(files) {
    var count = fileCount(files);
    if (count === 0) { hideToast(); return; }

    var isNew   = false;
    var toast   = document.getElementById('change-toast');

    if (!toast) {
      isNew = true;
      toast = document.createElement('div');
      toast.id = 'change-toast';
    }

    // Respect persisted minimized state
    var isMinimized = localStorage.getItem(MINIMIZED_KEY) === '1';
    if (isMinimized) {
      toast.classList.add('change-toast-minimized');
    } else {
      toast.classList.remove('change-toast-minimized');
    }

    // --- Header ---
    var header = document.createElement('div');
    header.id = 'change-toast-header';

    var title = document.createElement('span');
    title.id = 'change-toast-title';
    title.textContent = count + (count === 1 ? ' file changed' : ' files changed');

    var actions = document.createElement('div');
    actions.id = 'change-toast-actions';

    var minBtn = document.createElement('button');
    minBtn.id = 'change-toast-minimize';
    minBtn.setAttribute('aria-label', isMinimized ? 'Expand' : 'Minimise');
    minBtn.textContent = isMinimized ? '+' : '−';
    minBtn.addEventListener('click', function () {
      var minimized = toast.classList.toggle('change-toast-minimized');
      localStorage.setItem(MINIMIZED_KEY, minimized ? '1' : '0');
      minBtn.textContent  = minimized ? '+' : '−';
      minBtn.setAttribute('aria-label', minimized ? 'Expand' : 'Minimise');
    });

    var clearBtn = document.createElement('button');
    clearBtn.id = 'change-toast-clear';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', clearAll);

    actions.appendChild(minBtn);
    actions.appendChild(clearBtn);
    header.appendChild(title);
    header.appendChild(actions);

    // --- Body (tree) ---
    var body = document.createElement('div');
    body.id = 'change-toast-body';

    var tree = buildTree(files);
    body.appendChild(renderTreeNode(tree, ''));

    // Rebuild from scratch each render
    toast.innerHTML = '';
    toast.appendChild(header);
    toast.appendChild(body);

    if (isNew) {
      document.body.appendChild(toast);
      // Force reflow then fade in
      toast.getBoundingClientRect();
      toast.classList.add('change-toast-visible');
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.__gitBrowseChangeTracker = {
    show: function () { renderToast(loadChanges()); },
    hide: hideToast,
    toggle: function () {
      var existing = document.getElementById('change-toast');
      if (existing) { hideToast(); } else { renderToast(loadChanges()); }
    },
    clear: clearAll
  };

  // ---------------------------------------------------------------------------
  // Initialise on page load
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    var files = loadChanges();

    // If we're on an error page (e.g. 404 because file was deleted),
    // remove the current file from the changed list.
    if (document.body.classList.contains('error-view')) {
      var pathname = window.location.pathname;
      var rel = normalizePath(pathname);
      if (files[rel]) {
        delete files[rel];
        saveChanges(files);
      }
    }

    if (fileCount(files) > 0) renderToast(files);
  });

})();
