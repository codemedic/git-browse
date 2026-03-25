(function () {
  'use strict';

  var pollTimer = null;

  function hideToast() {
    var toast = document.getElementById('offline-toast');
    if (!toast) return;
    toast.classList.remove('offline-toast-visible');
    // Remove from DOM after fade-out transition completes
    setTimeout(function () { toast.remove(); }, 300);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // Poll until the server responds, then dismiss the toast
  function startPolling() {
    if (pollTimer) return; // already polling
    pollTimer = setInterval(function () {
      fetch(location.href, { method: 'HEAD', cache: 'no-store' })
        .then(function () {
          stopPolling();
          hideToast();
        })
        .catch(function () {}); // still down, keep polling
    }, 2000);
  }

  function showToast() {
    var existing = document.getElementById('offline-toast');
    if (existing) return; // already showing

    var toast = document.createElement('div');
    toast.id = 'offline-toast';

    var msg = document.createElement('span');
    msg.textContent = 'Server offline — run start.sh to reconnect';

    var btn = document.createElement('button');
    btn.id = 'offline-toast-dismiss';
    btn.textContent = '✕';
    btn.setAttribute('aria-label', 'Dismiss');
    btn.addEventListener('click', function () {
      stopPolling();
      hideToast();
    });

    toast.appendChild(msg);
    toast.appendChild(btn);
    document.body.appendChild(toast);

    // Force reflow so the fade-in transition fires
    toast.getBoundingClientRect();
    toast.classList.add('offline-toast-visible');

    startPolling();
  }

  // Exposed so other scripts (e.g. filetree.js) can trigger the toast
  window.__gitBrowseOffline = showToast;

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;

    var href = a.getAttribute('href');
    // Only intercept same-origin page navigations
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      var url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
    } catch (_) { return; }

    e.preventDefault();

    fetch(href, { method: 'HEAD', cache: 'no-store' })
      .then(function () { location.href = href; })
      .catch(function () { showToast(); });
  });
})();
