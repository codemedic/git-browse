(function () {
  var STORAGE_KEY = 'git-browse-theme';
  var themes = ['auto', 'dark', 'light'];
  var icons  = { auto: '🔄', dark: '🌙', light: '☀️' };
  var labels = { auto: 'auto', dark: 'dark', light: 'light' };

  function applyTheme(theme) {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // Apply immediately (before paint) to avoid flash
  var stored = localStorage.getItem(STORAGE_KEY) || 'auto';
  applyTheme(stored);

  document.addEventListener('DOMContentLoaded', function () {
    var current = stored;

    var btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.title = 'Cycle theme: auto → dark → light';
    btn.textContent = icons[current] + ' ' + labels[current];

    btn.addEventListener('click', function () {
      var idx = themes.indexOf(current);
      current = themes[(idx + 1) % themes.length];
      localStorage.setItem(STORAGE_KEY, current);
      applyTheme(current);
      btn.textContent = icons[current] + ' ' + labels[current];
    });

    document.body.appendChild(btn);
  });
})();
