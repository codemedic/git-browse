import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const forced = document.documentElement.getAttribute('data-theme');
const dark = forced === 'dark' || (!forced && window.matchMedia('(prefers-color-scheme: dark)').matches);

mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default' });

document.addEventListener('DOMContentLoaded', async () => {
  const nodes = document.querySelectorAll('code.language-mermaid');

  await Promise.all(Array.from(nodes).map(async (el, i) => {
    const source = el.textContent;
    const pre = el.parentElement;
    const id = 'mermaid-diagram-' + i;

    try {
      const { svg } = await mermaid.render(id, source);
      const container = document.createElement('div');
      container.className = 'mermaid';
      container.innerHTML = svg;
      pre.parentNode.replaceChild(container, pre);
    } catch (err) {
      // Mermaid may inject an error element into <body> before throwing — clean it up.
      const leftover = document.getElementById(id);
      if (leftover) leftover.remove();

      const msg = err.message || String(err);
      if (/no diagram type detected/i.test(msg)) {
        // Block contains only class/style definitions with no diagram — leave as a code block.
        return;
      }

      const errorBox = document.createElement('div');
      errorBox.className = 'mermaid-error';
      errorBox.innerHTML =
        '<strong>Mermaid syntax error</strong>' +
        '<pre class="mermaid-error-msg">' + escapeHtml(msg) + '</pre>' +
        '<details><summary>Source</summary><pre class="mermaid-error-src">' + escapeHtml(source) + '</pre></details>';
      pre.parentNode.replaceChild(errorBox, pre);
    }
  }));
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
