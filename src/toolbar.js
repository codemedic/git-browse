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
    // Toolbar burger button (only shows when sidebar hidden)
    // -------------------------------------------------------------------------
    var burgerBtn = document.createElement('button');
    burgerBtn.id = 'toolbar-burger-btn';
    burgerBtn.className = 'toolbar-btn toolbar-icon-btn';
    burgerBtn.title = 'Show file tree';
    burgerBtn.innerHTML = '<span class="toolbar-btn-icon"><i data-lucide="menu"></i></span>';
    burgerBtn.addEventListener('click', function () {
      var ftOpenBtn = document.getElementById('filetree-open-btn');
      if (ftOpenBtn) ftOpenBtn.click();
    });

    // -------------------------------------------------------------------------
    // Breadcrumbs integration
    // -------------------------------------------------------------------------
    var breadcrumbsContainer = document.createElement('div');
    breadcrumbsContainer.id = 'toolbar-breadcrumbs';
    
    function updateBreadcrumbs() {
      breadcrumbsContainer.innerHTML = '';
      var source = document.querySelector('.breadcrumbs');
      if (!source) return;

      var crumbs = Array.from(source.querySelectorAll('a'));
      if (crumbs.length === 0) return;

      var MAX_VISIBLE = 10;
      var displayedCrumbs = crumbs;
      var hasEllipsis = false;

      if (crumbs.length > MAX_VISIBLE) {
        var root = crumbs[0];
        var tail = crumbs.slice(-4);
        displayedCrumbs = [root];
        hasEllipsis = true;
      }

      displayedCrumbs.forEach(function (crumb, idx) {
        var clone = crumb.cloneNode(true);
        breadcrumbsContainer.appendChild(clone);
        
        if (hasEllipsis && idx === 0) {
          var ellipsis = document.createElement('span');
          ellipsis.className = 'breadcrumb-ellipsis';
          ellipsis.textContent = '\u2026';
          breadcrumbsContainer.appendChild(ellipsis);
          tail.forEach(function(t) {
            breadcrumbsContainer.appendChild(t.cloneNode(true));
          });
        }
      });
      
      // Remove original breadcrumbs to avoid duplication
      source.style.display = 'none';
    }

    // -------------------------------------------------------------------------
    // Copy button
    // -------------------------------------------------------------------------
    var copyBtn = document.createElement('button');
    copyBtn.id = 'toolbar-copy-btn';
    copyBtn.className = 'toolbar-btn toolbar-icon-btn';
    copyBtn.title = 'Copy path to clipboard';
    copyBtn.innerHTML = '<span class="toolbar-btn-icon"><i data-lucide="copy"></i></span>';
    
    // Copy logic (simplified version of breadcrumb-actions.js)
    copyBtn.addEventListener('click', function () {
      var path = decodeURIComponent(window.location.pathname);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(path);
      } else {
        var textArea = document.createElement("textarea");
        textArea.value = path;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(textArea);
      }

      var iconSpan = copyBtn.querySelector('.toolbar-btn-icon');
      var originalHTML = iconSpan.innerHTML;
      iconSpan.innerHTML = '<i data-lucide="check"></i>';
      copyBtn.classList.add('toolbar-btn-active');
      if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(iconSpan);

      setTimeout(function () {
        iconSpan.innerHTML = originalHTML;
        copyBtn.classList.remove('toolbar-btn-active');
        if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(iconSpan);
      }, 2000);
    });

    // -------------------------------------------------------------------------
    // Assemble and mount
    // -------------------------------------------------------------------------
    toolbar.appendChild(burgerBtn);
    toolbar.appendChild(breadcrumbsContainer);
    toolbar.appendChild(copyBtn);
    
    var actionsContainer = document.createElement('div');
    actionsContainer.className = 'toolbar-actions';
    actionsContainer.appendChild(themeBtn);
    actionsContainer.appendChild(gitBtn);
    actionsContainer.appendChild(cmdBtn);
    
    toolbar.appendChild(actionsContainer);
    document.body.appendChild(toolbar);

    updateBreadcrumbs();

    // Initialize icons for the entire toolbar
    if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(toolbar);
  });
})();
