(function () {
  'use strict';

  var STATE_KEY  = 'git-browse-filetree-v1';
  var CACHE_KEY  = 'git-browse-filetree-cache-v1';
  var SCROLL_KEY = 'git-browse-filetree-scroll-v1';

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

  // Parse markserv directory listing HTML; hrefs are resolved to absolute paths.
  // basePath must end with '/' (e.g. '/' or '/src/').
  function parseListing(html, basePath) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var items = [];
    doc.querySelectorAll('li.isfolder a[href], li.isfile a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      if (!href.startsWith('/')) href = basePath + href;
      var name = a.textContent.trim().replace(/\/$/, '');
      if (!name) return;
      var isDir = a.closest('li').classList.contains('isfolder');
      items.push({ name: name, href: href, isDir: isDir });
    });
    return items;
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
      fetch(dirPath)
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var c = getCache();
          c[dirPath] = parseListing(html, dirPath);
          saveCache(c);
        })
        .catch(function () {});
    } else {
      var spinner = document.createElement('li');
      spinner.className = 'ft-spinner';
      spinner.textContent = '…';
      container.appendChild(spinner);

      fetch(dirPath)
        .then(function (r) { return r.text(); })
        .then(function (html) {
          spinner.remove();
          var items = parseListing(html, dirPath);
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

      var arrow = document.createElement('span');
      arrow.className = 'ft-arrow';
      arrow.textContent = isExpanded ? '▾' : '▸';

      var label = document.createElement('span');
      label.className = 'ft-label';
      label.title = item.name;
      label.textContent = item.name;

      row.appendChild(arrow);
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
          arrow.textContent = '▾';
          s.expanded[item.href] = true;
          if (!children.hasChildNodes()) loadChildren(item.href, children);
        } else {
          children.style.display = 'none';
          arrow.textContent = '▸';
          delete s.expanded[item.href];
        }
        saveState(s);
      });

    } else {
      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'ft-file-link';
      a.title = item.name;
      a.textContent = item.name;
      if (window.location.pathname === item.href) a.classList.add('ft-active');
      li.appendChild(a);
    }

    return li;
  }

  document.addEventListener('DOMContentLoaded', function () {
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

    // Toggle button — visible only when sidebar is hidden
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'filetree-open-btn';
    toggleBtn.title = 'Show file tree';
    toggleBtn.textContent = '☰';
    if (!s.hidden) toggleBtn.style.display = 'none';
    document.body.appendChild(toggleBtn);

    closeBtn.addEventListener('click', function () {
      sidebar.classList.add('ft-hidden');
      toggleBtn.style.display = '';
      document.body.classList.remove('ft-open');
      var s = getState();
      s.hidden = true;
      saveState(s);
    });

    toggleBtn.addEventListener('click', function () {
      sidebar.classList.remove('ft-hidden');
      toggleBtn.style.display = 'none';
      document.body.classList.add('ft-open');
      var s = getState();
      delete s.hidden;
      saveState(s);
    });
  });
})();
