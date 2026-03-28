(function () {
  'use strict';

  if (window.self !== window.top) return;

  var THEME_KEY = 'git-browse-theme';

  var ICON_FOLDER = 'folder';
  var ICON_FILE   = 'file';

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
      var icons  = { auto: 'monitor', dark: 'moon', light: 'sun' };
      var labels = { auto: 'auto', dark: 'dark', light: 'light' };
      var iconSpan = btn.querySelector('.toolbar-btn-icon');
      var labelSpan = btn.querySelector('span:not(.toolbar-btn-icon)');
      if (iconSpan) {
        iconSpan.innerHTML = '<i data-lucide="' + icons[theme] + '"></i>';
        if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(iconSpan);
      }
      if (labelSpan) {
        labelSpan.textContent = labels[theme];
      }
    }
  }

  var BUILTINS = [
    {
      label: 'Git: Open Dashboard',
      detail: '/_git',
      icon: 'git-branch',
      action: function () { window.location.href = '/_git'; }
    },
    {
      label: 'Theme: Dark',
      icon: 'moon',
      action: function () { setTheme('dark'); closePalette(); }
    },
    {
      label: 'Theme: Light',
      icon: 'sun',
      action: function () { setTheme('light'); closePalette(); }
    },
    {
      label: 'Theme: Auto',
      icon: 'monitor',
      action: function () { setTheme('auto'); closePalette(); }
    },
    {
      label: 'Changes: Toggle File Change Tracker',
      icon: 'list-plus',
      action: function () {
        if (window.__gitBrowseChangeTracker) window.__gitBrowseChangeTracker.toggle();
        closePalette();
      }
    },
    {
      label: 'Changes: Clear All',
      icon: 'list-x',
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
        icon:   f.isDir ? ICON_FOLDER : ICON_FILE,
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
    searchIcon.innerHTML = '<i data-lucide="search"></i>';

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

    if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(modal);

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
      var iconName = cmd.icon || 'file';
      if (iconName === 'file' && !cmd.keepOpen && window.__gitBrowseIcons) {
        iconName = window.__gitBrowseIcons.getFileIcon(cmd.label);
      }
      
      iconEl.innerHTML = '<i data-lucide="' + iconName + '"></i>';

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
    
    if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(list);
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
