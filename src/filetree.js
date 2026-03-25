(function () {
  'use strict';

  var STORAGE_KEY = 'git-browse-filetree-v1';

  function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
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
      // Resolve relative hrefs against the directory being listed
      if (!href.startsWith('/')) href = basePath + href;
      var name = a.textContent.trim().replace(/\/$/, '');
      if (!name) return;
      var isDir = a.closest('li').classList.contains('isfolder');
      items.push({ name: name, href: href, isDir: isDir });
    });
    return items;
  }

  function loadChildren(dirPath, container) {
    var spinner = document.createElement('li');
    spinner.className = 'ft-spinner';
    spinner.textContent = '…';
    container.appendChild(spinner);

    fetch(dirPath)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        spinner.remove();
        var items = parseListing(html, dirPath);
        var s = getState();
        items.forEach(function (item) {
          container.appendChild(createNode(item, s));
        });
      })
      .catch(function () {
        spinner.textContent = 'Error loading';
      });
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

      // Arrow / label click: toggle expand
      row.addEventListener('click', function (e) {
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

    loadChildren('/', rootUl);

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
