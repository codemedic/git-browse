(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var blocks = document.querySelectorAll('pre code:not(.language-mermaid)');
    for (var i = 0; i < blocks.length; i++) {
      addLineNumbers(blocks[i]);
    }
  });

  function addLineNumbers(block) {
    var pre = block.parentElement;
    var html = block.innerHTML;
    // Strip trailing newline added by fenced code block rendering
    if (html.slice(-1) === '\n') html = html.slice(0, -1);
    var res = splitIntoLines(html);
    block.innerHTML = res.html;
    pre.classList.add('has-line-numbers');
    
    // Set gutter width dynamically: max digits + 1
    var digits = res.count.toString().length;
    pre.style.setProperty('--gutter-width', (digits + 1) + 'ch');

    // Default line-wrapping to ON
    pre.classList.add('line-wrapping');

    addToolbar(pre);
  }

  function addToolbar(pre) {
    var toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    
    var toggle = document.createElement('button');
    toggle.className = 'code-toolbar-btn' + (pre.classList.contains('line-wrapping') ? ' active' : '');
    toggle.title = 'Toggle Line Wrap';
    toggle.innerHTML = '<i data-lucide="text-wrap"></i>';
    
    toggle.onclick = function() {
      var isWrapping = pre.classList.toggle('line-wrapping');
      toggle.classList.toggle('active', isWrapping);
    };
    
    toolbar.appendChild(toggle);
    pre.appendChild(toolbar);
    
    if (window.__gitBrowseIcons) {
      window.__gitBrowseIcons.create(toolbar);
    }
  }

  // Splits an HTML string into <span class="code-line">…</span> elements.
  // Injects an explicit <span class="code-ln">N</span> at the start of each
  // line so that position:sticky can be applied to the real DOM node.
  // Handles multi-line highlight.js spans correctly: open tags are closed at
  // each newline and reopened on the next line so the DOM stays well-formed
  // and no span becomes an unintended block-level ancestor.
  function splitIntoLines(html) {
    var lineNum = 1;
    var result = '<span class="code-line">' + ln(lineNum) + '<span class="code-content">';
    var openTags = [];  // stack of opening tag strings currently in scope
    var i = 0;

    while (i < html.length) {
      if (html[i] === '<') {
        var end = html.indexOf('>', i);
        if (end === -1) { result += html.slice(i); break; }
        var tag = html.slice(i, end + 1);

        if (tag[1] === '/') {
          openTags.pop();
          result += tag;
        } else if (tag.slice(-2) === '/>' || isVoid(tag)) {
          result += tag;  // self-closing / void element — no stack change
        } else {
          openTags.push(tag);
          result += tag;
        }
        i = end + 1;

      } else if (html[i] === '\n') {
        // Close open tags in reverse, end this line's span, start the next,
        // then reopen the tags so inline highlighting continues unbroken.
        for (var j = openTags.length - 1; j >= 0; j--) {
          result += '</' + tagName(openTags[j]) + '>';
        }
        lineNum++;
        result += '</span></span><span class="code-line">' + ln(lineNum) + '<span class="code-content">';
        for (var k = 0; k < openTags.length; k++) {
          result += openTags[k];
        }
        i++;

      } else {
        result += html[i];
        i++;
      }
    }

    // Close any still-open tags and the final code-line span
    for (var j = openTags.length - 1; j >= 0; j--) {
      result += '</' + tagName(openTags[j]) + '>';
    }
    result += '</span></span>';
    return { html: result, count: lineNum };
  }

  // Returns the gutter span HTML for a given line number.
  function ln(n) {
    return '<span class="code-ln" aria-hidden="true">' + n + '</span>';
  }

  function tagName(openTag) {
    var m = openTag.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
    return m ? m[1] : '';
  }

  var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1,
               img: 1, input: 1, link: 1, meta: 1, param: 1,
               source: 1, track: 1, wbr: 1 };
  function isVoid(tag) { return VOID[tagName(tag).toLowerCase()] === 1; }
})();
