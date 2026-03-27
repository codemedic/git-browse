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
      var img = pictures[i].querySelector('img');
      var activeSrcset = null;

      for (var j = 0; j < sources.length; j++) {
        var src = sources[j];

        // Stash originals on first encounter so auto-mode can restore them.
        if (!src.hasAttribute('data-original-media')) {
          src.setAttribute('data-original-media', src.getAttribute('media'));
        }
        if (!src.hasAttribute('data-original-srcset')) {
          src.setAttribute('data-original-srcset', src.getAttribute('srcset') || '');
        }

        var originalMedia   = src.getAttribute('data-original-media');
        var originalSrcset  = src.getAttribute('data-original-srcset');

        if (!theme) {
          // Auto — restore originals and let the browser decide.
          src.setAttribute('media',  originalMedia);
          src.setAttribute('srcset', originalSrcset);
        } else {
          var isDark  = DARK_MQ.test(originalMedia);
          var isLight = LIGHT_MQ.test(originalMedia);
          if (isDark || isLight) {
            var show = (theme === 'dark' && isDark) || (theme === 'light' && isLight);
            
            // Force the media query to be active or inactive
            src.setAttribute('media', show ? 'all' : 'not all');
            src.setAttribute('srcset', originalSrcset);
            
            if (show) activeSrcset = originalSrcset;
          }
        }
      }

      // Belt-and-suspenders: also update <img> src directly
      if (img) {
        if (!img.hasAttribute('data-original-src')) {
          img.setAttribute('data-original-src', img.getAttribute('src') || '');
        }
        var targetSrc = activeSrcset || (!theme ? img.getAttribute('data-original-src') : null);
        if (targetSrc && img.getAttribute('src') !== targetSrc) {
          img.setAttribute('src', targetSrc);
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
