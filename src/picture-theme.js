(function () {
  // Sync <picture> source selection with the data-theme attribute.
  //
  // Native prefers-color-scheme media queries only reflect OS preference.
  // When the theme toggle overrides via data-theme="dark"|"light", we force
  // the correct <source> by rewriting its media attribute to "all" or "not all",
  // then restore originals when switching back to auto (no data-theme).

  var DARK_MQ  = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i;
  var LIGHT_MQ = /\(\s*prefers-color-scheme\s*:\s*light\s*\)/i;

  function syncPictures() {
    var theme = document.documentElement.getAttribute('data-theme'); // 'dark', 'light', or null
    var pictures = document.querySelectorAll('picture');

    for (var i = 0; i < pictures.length; i++) {
      var sources = pictures[i].querySelectorAll('source[media]');
      for (var j = 0; j < sources.length; j++) {
        var src = sources[j];

        // Stash the original media value on first encounter so auto-mode can restore it.
        if (!src.hasAttribute('data-original-media')) {
          src.setAttribute('data-original-media', src.getAttribute('media'));
        }
        var original = src.getAttribute('data-original-media');

        if (!theme) {
          // Auto mode — restore the original media query and let the browser decide.
          src.setAttribute('media', original);
        } else {
          var isDark  = DARK_MQ.test(original);
          var isLight = LIGHT_MQ.test(original);
          if (isDark || isLight) {
            var show = (theme === 'dark' && isDark) || (theme === 'light' && isLight);
            // "all" forces the source active; "not all" forces it inactive.
            src.setAttribute('media', show ? 'all' : 'not all');
          }
        }
      }
    }
  }

  // Run on initial load to handle the theme already set by theme-toggle.js.
  document.addEventListener('DOMContentLoaded', syncPictures);

  // Re-run whenever data-theme is added, removed, or changed.
  new MutationObserver(syncPictures).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] }
  );
})();
