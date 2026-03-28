(function () {
  'use strict';

  if (window.self !== window.top) return;

  var STORAGE_KEY = 'git-browse-theme';
  var themes = ['auto', 'dark', 'light'];
  var themeLabel = { auto: 'auto', dark: 'dark', light: 'light' };

  var themeIcon = { auto: 'monitor', dark: 'moon', light: 'sun' };

  function applyTheme(theme) {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // Apply stored theme immediately (before paint) to prevent flash
  var stored = localStorage.getItem(STORAGE_KEY) || 'auto';
  applyTheme(stored);

  document.addEventListener('DOMContentLoaded', function () {
    var current = stored;

    // -------------------------------------------------------------------------
    // Toolbar container
    // -------------------------------------------------------------------------
    var toolbar = document.createElement('div');
    toolbar.id = 'toolbar';

    // -------------------------------------------------------------------------
    // Theme cycle button
    // -------------------------------------------------------------------------
    var themeBtn = document.createElement('button');
    themeBtn.id = 'theme-toggle';
    themeBtn.className = 'toolbar-btn';
    themeBtn.title = 'Cycle theme: auto \u2192 dark \u2192 light';
    
    var themeIconSpan = document.createElement('span');
    themeIconSpan.className = 'toolbar-btn-icon';
    themeIconSpan.innerHTML = '<i data-lucide="' + themeIcon[current] + '"></i>';
    
    var themeLabelSpan = document.createElement('span');
    themeLabelSpan.textContent = themeLabel[current];

    themeBtn.appendChild(themeIconSpan);
    themeBtn.appendChild(themeLabelSpan);

    themeBtn.addEventListener('click', function () {
      var idx = themes.indexOf(current);
      current = themes[(idx + 1) % themes.length];
      localStorage.setItem(STORAGE_KEY, current);
      applyTheme(current);
      themeIconSpan.innerHTML = '<i data-lucide="' + themeIcon[current] + '"></i>';
      themeLabelSpan.textContent = themeLabel[current];
      if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(themeIconSpan);
    });

    // -------------------------------------------------------------------------
    // Git dashboard button
    // -------------------------------------------------------------------------
    var gitBtn = document.createElement('a');
    gitBtn.id = 'toolbar-git-btn';
    gitBtn.className = 'toolbar-btn toolbar-icon-btn';
    gitBtn.href = '/_git';
    gitBtn.title = 'Git dashboard';
    gitBtn.innerHTML = '<span class="toolbar-btn-icon"><i data-lucide="git-branch"></i></span>';
    if (window.location.pathname === '/_git') gitBtn.classList.add('toolbar-btn-active');

    // -------------------------------------------------------------------------
    // Command palette trigger button
    // -------------------------------------------------------------------------
    var cmdBtn = document.createElement('button');
    cmdBtn.id = 'toolbar-cmd-btn';
    cmdBtn.className = 'toolbar-btn toolbar-icon-btn';
    // Show OS-appropriate shortcut hint in the tooltip
    var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    cmdBtn.title = 'Command Palette (' + (isMac ? '\u2318' : 'Ctrl') + '+Shift+P)';
    cmdBtn.innerHTML = '<span class="toolbar-btn-icon"><i data-lucide="search"></i></span>';

    cmdBtn.addEventListener('click', function () {
      // Dispatch a synthetic Ctrl+Shift+P so command-palette.js handles it
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'P', shiftKey: true,
        ctrlKey: !isMac, metaKey: isMac,
        bubbles: true, cancelable: true
      }));
    });

    // -------------------------------------------------------------------------
    // Assemble and mount
    // -------------------------------------------------------------------------
    toolbar.appendChild(themeBtn);
    toolbar.appendChild(gitBtn);
    toolbar.appendChild(cmdBtn);
    document.body.appendChild(toolbar);

    // Initialize icons for the entire toolbar
    if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(toolbar);
  });
})();
