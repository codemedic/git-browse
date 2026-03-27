(function () {
  'use strict';

  if (window.self !== window.top) return;

  var STORAGE_KEY = 'git-browse-theme';
  var themes = ['auto', 'dark', 'light'];
  var themeLabel = { auto: 'auto', dark: 'dark', light: 'light' };

  // SVG icons — GitHub Octicons, fill="currentColor"
  var SVG_THEME_AUTO   = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13zM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.75.75 0 0 1-1.06 1.06l-1.061-1.06a.75.75 0 0 1 0-1.061zm10.607 10.607a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0zM8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM1.25 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75zm11.25 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H13a.75.75 0 0 1-.75-.75zM3.404 12.596a.75.75 0 0 1 0 1.061l-1.061 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.061a.75.75 0 0 1 1.061 0zm11.535-9.192a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0z"/></svg>';
  var SVG_THEME_DARK   = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.598 1.591a.75.75 0 0 1 .785-.175 7 7 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.5 5.5 0 1 0 7.678-7.678z"/></svg>';
  var SVG_THEME_LIGHT  = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm5.657-8.157a.75.75 0 0 1 0 1.061l-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97a.75.75 0 0 1 1.06-.001zM3.343 13.157a.75.75 0 0 1 0 1.06l-.97.97a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l.97-.97a.75.75 0 0 1 1.06 0zm9.9 1.03a.75.75 0 0 1-1.06 0l-.97-.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97a.75.75 0 0 1 0 1.06zM2.343 3.97a.75.75 0 0 1-1.06 0l-.97-.97a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042.018l.97.97a.75.75 0 0 1 0 1.024zM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13zM2.343 12.03a.75.75 0 0 1 0 1.06l-.97.97a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l.97-.97a.75.75 0 0 1 1.06-.001zM13.657 3.97a.75.75 0 0 1 0-1.06l.97-.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-.97.97a.75.75 0 0 1-1.06 0zM16 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8zM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8z"/></svg>';
  var themeIcon = { auto: SVG_THEME_AUTO, dark: SVG_THEME_DARK, light: SVG_THEME_LIGHT };

  var SVG_GIT_BRANCH = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/></svg>';
  var SVG_SEARCH     = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/></svg>';

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
    themeIconSpan.innerHTML = themeIcon[current];
    
    var themeLabelSpan = document.createElement('span');
    themeLabelSpan.textContent = themeLabel[current];

    themeBtn.appendChild(themeIconSpan);
    themeBtn.appendChild(themeLabelSpan);

    themeBtn.addEventListener('click', function () {
      var idx = themes.indexOf(current);
      current = themes[(idx + 1) % themes.length];
      localStorage.setItem(STORAGE_KEY, current);
      applyTheme(current);
      themeIconSpan.innerHTML = themeIcon[current];
      themeLabelSpan.textContent = themeLabel[current];
    });

    // -------------------------------------------------------------------------
    // Git dashboard button
    // -------------------------------------------------------------------------
    var gitBtn = document.createElement('a');
    gitBtn.id = 'toolbar-git-btn';
    gitBtn.className = 'toolbar-btn toolbar-icon-btn';
    gitBtn.href = '/_git';
    gitBtn.title = 'Git dashboard';
    gitBtn.innerHTML = SVG_GIT_BRANCH;
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
    cmdBtn.innerHTML = SVG_SEARCH;

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
  });
})();
