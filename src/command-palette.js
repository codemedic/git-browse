(function () {
  'use strict';

  if (window.self !== window.top) return;

  var THEME_KEY = 'git-browse-theme';

  // SVG icons — GitHub Octicons, fill="currentColor"
  var SVG_SEARCH   = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/></svg>';
  var SVG_GIT      = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/></svg>';
  var SVG_THEME    = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm5.657-8.157a.75.75 0 0 1 0 1.061l-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97a.75.75 0 0 1 1.06-.001zM3.343 13.157a.75.75 0 0 1 0 1.06l-.97.97a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l.97-.97a.75.75 0 0 1 1.06 0zm9.9 1.03a.75.75 0 0 1-1.06 0l-.97-.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97a.75.75 0 0 1 0 1.06zM2.343 3.97a.75.75 0 0 1-1.06 0l-.97-.97a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042.018l.97.97a.75.75 0 0 1 0 1.024zM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13zM2.343 12.03a.75.75 0 0 1 0 1.06l-.97.97a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l.97-.97a.75.75 0 0 1 1.06-.001zM13.657 3.97a.75.75 0 0 1 0-1.06l.97-.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-.97.97a.75.75 0 0 1-1.06 0zM16 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8zM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8z"/></svg>';
  var SVG_FOLDER   = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/></svg>';
  var SVG_FILE     = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 10 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011z"/></svg>';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var _palette     = null;   // { overlay, input, list }
  var _commands    = [];     // current result set
  var _selectedIdx = -1;
  var _debounceT   = null;

  // ---------------------------------------------------------------------------
  // Built-in commands
  // ---------------------------------------------------------------------------

  function setTheme(theme) {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem(THEME_KEY, theme);
    // Keep theme-toggle button in sync
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var icons  = { auto: '🔄', dark: '🌙', light: '☀️' };
      var labels = { auto: 'auto', dark: 'dark', light: 'light' };
      btn.textContent = icons[theme] + ' ' + labels[theme];
    }
  }

  var BUILTINS = [
    {
      label: 'Git: Open Dashboard',
      detail: '/_git',
      icon: SVG_GIT,
      action: function () { window.location.href = '/_git'; }
    },
    {
      label: 'Theme: Dark',
      icon: SVG_THEME,
      action: function () { setTheme('dark'); closePalette(); }
    },
    {
      label: 'Theme: Light',
      icon: SVG_THEME,
      action: function () { setTheme('light'); closePalette(); }
    },
    {
      label: 'Theme: Auto',
      icon: SVG_THEME,
      action: function () { setTheme('auto'); closePalette(); }
    },
    {
      label: 'Changes: Toggle File Change Tracker',
      icon: SVG_FILE,
      action: function () {
        if (window.__gitBrowseChangeTracker) window.__gitBrowseChangeTracker.toggle();
        closePalette();
      }
    },
    {
      label: 'Changes: Clear All',
      icon: SVG_FILE,
      action: function () {
        if (window.__gitBrowseChangeTracker) window.__gitBrowseChangeTracker.clear();
        closePalette();
      }
    }
  ];

  // ---------------------------------------------------------------------------
  // Backend file search
  // ---------------------------------------------------------------------------

  function fetchFiles(query, callback) {
    var url = '/_files/search?q=' + encodeURIComponent(query);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) { callback(data.files || []); })
      .catch(function () { callback([]); });
  }

  // ---------------------------------------------------------------------------
  // Results builder
  // ---------------------------------------------------------------------------

  function builtinsMatching(query) {
    if (!query) return BUILTINS.slice();
    var lq = query.toLowerCase();
    return BUILTINS.filter(function (b) {
      return b.label.toLowerCase().indexOf(lq) !== -1;
    });
  }

  function buildResults(builtins, files) {
    var results = [];
    var i;
    for (i = 0; i < builtins.length; i++) results.push(builtins[i]);
    for (i = 0; i < files.length; i++) {
      var f = files[i];
      results.push({
        label:  f.name,
        detail: f.path,
        icon:   f.isDir ? SVG_FOLDER : SVG_FILE,
        keepOpen: f.isDir,
        action: f.isDir
          ? (function (folderPath) {
              return function () {
                var prefix = folderPath.replace(/^\//, '') + '/';
                _palette.input.value = prefix;
                refreshResults(prefix);
              };
            }(f.path))
          : (function (href) {
              return function () { window.location.href = href; };
            }(f.path))
      });
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function createPaletteDOM() {
    var overlay = document.createElement('div');
    overlay.id = 'cmd-palette-overlay';

    var modal = document.createElement('div');
    modal.id = 'cmd-palette';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Command Palette');

    var inputWrap = document.createElement('div');
    inputWrap.className = 'cmd-palette-input-wrap';

    var searchIcon = document.createElement('span');
    searchIcon.className = 'cmd-palette-search-icon';
    searchIcon.innerHTML = SVG_SEARCH;

    var input = document.createElement('input');
    input.id = 'cmd-palette-input';
    input.type = 'text';
    input.placeholder = '\u003e command \u2014 or type a file name\u2026';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'cmd-palette-list');

    var escHint = document.createElement('kbd');
    escHint.className = 'cmd-palette-esc-hint';
    escHint.textContent = 'Esc';

    inputWrap.appendChild(searchIcon);
    inputWrap.appendChild(input);
    inputWrap.appendChild(escHint);

    var list = document.createElement('ul');
    list.id = 'cmd-palette-list';
    list.setAttribute('role', 'listbox');

    modal.appendChild(inputWrap);
    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    return { overlay: overlay, input: input, list: list };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderResults(results) {
    var list = _palette.list;
    list.innerHTML = '';
    _commands    = results;
    _selectedIdx = results.length > 0 ? 0 : -1;

    if (results.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'cmd-palette-empty';
      empty.textContent = 'No results';
      list.appendChild(empty);
      return;
    }

    results.forEach(function (cmd, idx) {
      var li = document.createElement('li');
      li.className = 'cmd-palette-item' + (idx === 0 ? ' cmd-palette-item-selected' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');

      var iconEl = document.createElement('span');
      iconEl.className = 'cmd-palette-item-icon';
      iconEl.innerHTML = cmd.icon;

      var labelEl = document.createElement('span');
      labelEl.className = 'cmd-palette-item-label';
      labelEl.textContent = cmd.label;

      li.appendChild(iconEl);
      li.appendChild(labelEl);

      if (cmd.detail) {
        var detailEl = document.createElement('span');
        detailEl.className = 'cmd-palette-item-detail';
        detailEl.textContent = cmd.detail;
        li.appendChild(detailEl);
      }

      // mousedown keeps focus on input; click fires the action
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { runCommand(idx); });
      li.addEventListener('mousemove', function () { selectItem(idx); });

      list.appendChild(li);
    });
  }

  function selectItem(idx) {
    if (_selectedIdx === idx) return;
    var items = _palette.list.querySelectorAll('.cmd-palette-item');
    if (_selectedIdx >= 0 && items[_selectedIdx]) {
      items[_selectedIdx].classList.remove('cmd-palette-item-selected');
      items[_selectedIdx].setAttribute('aria-selected', 'false');
    }
    _selectedIdx = idx;
    if (idx >= 0 && items[idx]) {
      items[idx].classList.add('cmd-palette-item-selected');
      items[idx].setAttribute('aria-selected', 'true');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function runCommand(idx) {
    if (idx >= 0 && _commands[idx]) {
      var cmd = _commands[idx];
      if (!cmd.keepOpen) closePalette();
      cmd.action();
    }
  }

  // ---------------------------------------------------------------------------
  // Refresh results — debounced, merges builtins with backend file search
  // ---------------------------------------------------------------------------

  function refreshResults(query) {
    var isCommandMode = query.charAt(0) === '>';
    if (isCommandMode) {
      // Strip the '>' prefix and any leading space for matching
      var cmdQuery = query.slice(1).replace(/^\s*/, '');
      renderResults(buildResults(builtinsMatching(cmdQuery), []));
    } else {
      fetchFiles(query, function (files) {
        // Guard: ignore stale callbacks if palette was closed or query changed
        if (!_palette || !_palette.overlay.classList.contains('cmd-palette-visible')) return;
        renderResults(buildResults([], files));
      });
    }
  }

  function scheduleRefresh(query) {
    clearTimeout(_debounceT);
    _debounceT = setTimeout(function () { refreshResults(query); }, 120);
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  function openPalette() {
    if (!_palette) {
      _palette = createPaletteDOM();

      _palette.overlay.addEventListener('mousedown', function (e) {
        if (e.target === _palette.overlay) closePalette();
      });

      _palette.input.addEventListener('input', function () {
        scheduleRefresh(_palette.input.value.trim());
      });

      _palette.input.addEventListener('keydown', function (e) {
        var len = _commands.length;
        if (e.key === 'Escape') {
          e.preventDefault();
          closePalette();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (len > 0) selectItem((_selectedIdx + 1) % len);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (len > 0) selectItem((_selectedIdx - 1 + len) % len);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          runCommand(_selectedIdx);
        }
      });
    }

    _palette.input.value = '> ';
    _palette.overlay.classList.add('cmd-palette-visible');
    _palette.input.focus();
    // Position cursor at end of pre-filled '> '
    _palette.input.setSelectionRange(2, 2);
    refreshResults('> ');
  }

  function closePalette() {
    if (_palette) {
      _palette.overlay.classList.remove('cmd-palette-visible');
      clearTimeout(_debounceT);
    }
  }

  // ---------------------------------------------------------------------------
  // Global keyboard shortcut — Ctrl+Shift+P / Cmd+Shift+P (matches VS Code)
  // ---------------------------------------------------------------------------

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      if (_palette && _palette.overlay.classList.contains('cmd-palette-visible')) {
        closePalette();
      } else {
        openPalette();
      }
    }
  });

})();
