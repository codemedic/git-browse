(function () {
  'use strict';

  if (window.self !== window.top) return;

  // Bare mode: suppress all chrome for clean presentation / new-window viewing.
  // Applied synchronously so other scripts (theme-toggle etc.) never show chrome.
  var _bare = window.location.search.indexOf('bare') !== -1;
  if (_bare) document.documentElement.setAttribute('data-bare', '');

  var STATE_KEY  = 'git-browse-filetree-v1';
  var CACHE_KEY  = 'git-browse-filetree-cache-v2'; // v2: git-aware JSON listing
  var SCROLL_KEY = 'git-browse-filetree-scroll-v1';
  var WIDTH_KEY  = 'git-browse-filetree-width-v1';

  var MIN_WIDTH = 160;
  var MAX_WIDTH = 600;

  // Apply sidebar width via CSS custom property — works for both the sidebar
  // element and the body margin rule (both reference var(--ft-w) in CSS).
  function applyWidth(w) {
    document.documentElement.style.setProperty('--ft-w', w + 'px');
  }

  // Apply sidebar state synchronously (before DOMContentLoaded) so the body
  // margin is set before first render — prevents layout shift on page load.
  // document.body is not available at this point, so we drive the initial
  // margin via an attribute on documentElement which CSS can select on.
  (function () {
    var saved = parseInt(localStorage.getItem(WIDTH_KEY), 10);
    if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) applyWidth(saved);
    if (!_bare) {
      try {
        var s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
        if (!s.hidden) {
          document.documentElement.setAttribute('data-ft-open', '');
        } else {
          document.documentElement.setAttribute('data-burger-visible', '');
        }
      } catch (e) {}
    }
  }());

  function getState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveState(s) {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  }

  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }
    catch (e) {} // ignore quota errors
  }

  // Convert a /_files/listing JSON response into the item format used by the tree.
  function parseListing(data) {
    return (data.entries || []).map(function (e) {
      return { name: e.name, href: e.path, isDir: e.isDir };
    });
  }

  function listingUrl(dirPath) {
    return '/_files/listing?path=' + encodeURIComponent(dirPath);
  }

  // Render from cache synchronously (stable, no flicker), then silently refresh
  // the cache in the background so the next page load gets fresh data.
  // Falls back to a spinner + fetch when there is no cache entry yet.
  function loadChildren(dirPath, container) {
    var cached = getCache()[dirPath];

    if (cached) {
      var s = getState();
      cached.forEach(function (item) {
        container.appendChild(createNode(item, s));
      });
      // Background refresh — updates cache for the next visit, never re-renders
      fetch(listingUrl(dirPath))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var c = getCache();
          c[dirPath] = parseListing(data);
          saveCache(c);
        })
        .catch(function () {});
    } else {
      var spinner = document.createElement('li');
      spinner.className = 'ft-spinner';
      spinner.textContent = '…';
      container.appendChild(spinner);

      fetch(listingUrl(dirPath))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          spinner.remove();
          var items = parseListing(data);
          var c = getCache();
          c[dirPath] = items;
          saveCache(c);
          var s = getState();
          items.forEach(function (item) {
            container.appendChild(createNode(item, s));
          });
        })
        .catch(function () {
          spinner.remove();
          if (typeof window.__gitBrowseOffline === 'function') window.__gitBrowseOffline();
        });
    }
  }

  function createNode(item, s) {
    var li = document.createElement('li');
    li.className = 'ft-item ' + (item.isDir ? 'ft-dir' : 'ft-file');

    if (item.isDir) {
      var isExpanded = !!(s.expanded && s.expanded[item.href]);

      var row = document.createElement('div');
      row.className = 'ft-row';

      var arrowIcon = isExpanded ? 'chevron-down' : 'chevron-right';
      var arrow = document.createElement('span');
      arrow.className = 'ft-arrow';
      arrow.innerHTML = '<i data-lucide="' + arrowIcon + '"></i>';

      var folderIconName = isExpanded ? 'folder-open' : 'folder';
      var folderIcon = document.createElement('span');
      folderIcon.className = 'ft-icon ft-icon-folder';
      folderIcon.innerHTML = '<i data-lucide="' + folderIconName + '"></i>';

      var label = document.createElement('span');
      label.className = 'ft-label';
      label.title = item.name;
      label.textContent = item.name;

      row.appendChild(arrow);
      row.appendChild(folderIcon);
      row.appendChild(label);
      li.appendChild(row);

      var children = document.createElement('ul');
      children.className = 'ft-children';
      if (!isExpanded) children.style.display = 'none';
      li.appendChild(children);

      if (isExpanded) {
        loadChildren(item.href, children);
      }

      row.addEventListener('click', function () {
        var s = getState();
        if (!s.expanded) s.expanded = {};
        if (children.style.display === 'none') {
          children.style.display = '';
          arrow.innerHTML = '<i data-lucide="chevron-down"></i>';
          folderIcon.innerHTML = '<i data-lucide="folder-open"></i>';
          s.expanded[item.href] = true;
          if (!children.hasChildNodes()) loadChildren(item.href, children);
        } else {
          children.style.display = 'none';
          arrow.innerHTML = '<i data-lucide="chevron-right"></i>';
          folderIcon.innerHTML = '<i data-lucide="folder"></i>';
          delete s.expanded[item.href];
        }
        saveState(s);
        if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(row);
      });
      
      // Initialize icons for the newly created row immediately
      if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(row);

    } else {
      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'ft-file-link';
      a.title = item.name;
      if (window.location.pathname === item.href) a.classList.add('ft-active');

      var iconName = window.__gitBrowseIcons ? window.__gitBrowseIcons.getFileIcon(item.name) : 'file';
      var fileIcon = document.createElement('span');
      fileIcon.className = 'ft-icon ft-icon-file';
      fileIcon.innerHTML = '<i data-lucide="' + iconName + '"></i>';

      var fileName = document.createElement('span');
      fileName.className = 'ft-file-name';
      fileName.textContent = item.name;

      a.appendChild(fileIcon);
      a.appendChild(fileName);
      
      if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(a);


      // Shift+click: open in new window without the file-browser chrome
      a.addEventListener('click', function (e) {
        if (e.shiftKey) {
          e.preventDefault();
          window.open(item.href + '?bare', '_blank');
        }
      });
      li.appendChild(a);
    }

    return li;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (_bare) return; // no sidebar in bare mode

    var s = getState();

    // Build sidebar
    var sidebar = document.createElement('nav');
    sidebar.id = 'filetree';
    if (s.hidden) sidebar.classList.add('ft-hidden');

    var header = document.createElement('div');
    header.className = 'ft-header';
    var title = document.createElement('span');
    title.textContent = 'Files';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'ft-close-btn';
    closeBtn.title = 'Hide file tree';
    closeBtn.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeBtn);
    sidebar.appendChild(header);

    var rootUl = document.createElement('ul');
    rootUl.className = 'ft-root';
    sidebar.appendChild(rootUl);

    // Resize handle — draggable strip on the right edge of the sidebar
    var resizeHandle = document.createElement('div');
    resizeHandle.className = 'ft-resize-handle';
    sidebar.appendChild(resizeHandle);

    resizeHandle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var startX     = e.clientX;
      var startWidth = sidebar.getBoundingClientRect().width;
      document.body.classList.add('ft-resizing');

      function onMove(e) {
        var w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX));
        applyWidth(w);
      }

      function onUp() {
        document.body.classList.remove('ft-resizing');
        // Persist the final width
        var w = Math.round(sidebar.getBoundingClientRect().width);
        localStorage.setItem(WIDTH_KEY, w);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    document.body.appendChild(sidebar);
    if (!s.hidden) document.body.classList.add('ft-open');

    // Render tree — synchronous from cache if available, so the sidebar is
    // stable before the first paint and scroll can be restored immediately.
    loadChildren('/', rootUl);

    // Restore scroll after layout (rAF ensures the DOM has been painted)
    requestAnimationFrame(function () {
      var saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) sidebar.scrollTop = parseInt(saved, 10);
    });

    // Persist scroll position before the page unloads
    window.addEventListener('beforeunload', function () {
      sessionStorage.setItem(SCROLL_KEY, sidebar.scrollTop);
    });

    // Toggle button — hidden (we use the toolbar burger instead, but keep this for logic)
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'filetree-open-btn';
    toggleBtn.title = 'Show file tree';
    toggleBtn.textContent = '☰';
    toggleBtn.style.display = 'none';
    document.body.appendChild(toggleBtn);

    closeBtn.addEventListener('click', function () {
      // 1. Show the burger icon (triggers CSS transition) while sidebar is still open
      document.documentElement.setAttribute('data-burger-visible', '');
      
      // 2. Wait for user to register the burger appearance (600ms)
      setTimeout(function() {
        // 3. Now move everything else
        document.documentElement.removeAttribute('data-ft-open');
        sidebar.classList.add('ft-hidden');
        document.body.classList.remove('ft-open');
        var s = getState();
        s.hidden = true;
        saveState(s);
      }, 600);
    });

    toggleBtn.addEventListener('click', function () {
      sidebar.classList.remove('ft-hidden');
      toggleBtn.style.display = 'none';
      document.body.classList.add('ft-open');
      document.documentElement.setAttribute('data-ft-open', '');
      document.documentElement.removeAttribute('data-burger-visible');
      var s = getState();
      delete s.hidden;
      saveState(s);
    });

    // Enable CSS transitions after first paint so page navigation is instant
    // but user-initiated open/close still animates.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add('ft-loaded');
      });
    });
  });
})();
