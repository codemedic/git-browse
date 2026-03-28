(function () {
  'use strict';

  if (window.self !== window.top) return;

  function copyToClipboard(text) {
    if (!navigator.clipboard) {
      // Fallback
      var textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(textArea);
      return;
    }
    navigator.clipboard.writeText(text);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var copyBtn = document.getElementById('breadcrumbs-copy-btn');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', function () {
      // Current path is the window location pathname, decoded
      var path = decodeURIComponent(window.location.pathname);
      // Remove trailing slash if it's a file path (we know this from the URL usually, 
      // but let's just copy exactly what's in the address bar minus the hostname)
      copyToClipboard(path);

      // Visual feedback
      var originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i data-lucide="check"></i>';
      copyBtn.classList.add('copied');
      if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(copyBtn);

      setTimeout(function () {
        copyBtn.innerHTML = originalHTML;
        copyBtn.classList.remove('copied');
        if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(copyBtn);
      }, 2000);
    });
  });
})();
