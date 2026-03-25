(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.source-toggle-bar').forEach(function (bar) {
      var container = bar.parentElement;
      bar.querySelectorAll('.toggle-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var panel = btn.getAttribute('data-panel');
          bar.querySelectorAll('.toggle-btn').forEach(function (b) {
            b.classList.toggle('active', b === btn);
          });
          container.querySelectorAll('.toggle-panel').forEach(function (p) {
            p.style.display = p.getAttribute('data-panel') === panel ? '' : 'none';
          });
        });
      });
    });
  });
})();
