(function () {
  'use strict';

  if (window.self !== window.top) return;

  // Only activate on the /_git dashboard page
  if (window.location.pathname !== '/_git') return;

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  var LANE_W = 16;   // pixels per lane column in the graph SVG
  var DOT_R  = 4;    // commit dot radius
  var PAGE   = 40;   // commits per page

  // 6 distinct lane colours — same in light and dark, adjusted for contrast
  var LANE_COLORS = ['#0969da', '#1a7f37', '#cf222e', '#8250df', '#bf8700', '#0550ae'];

  function laneColor(i) {
    return LANE_COLORS[i % LANE_COLORS.length];
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var _state      = null;
  var _commits    = [];
  var _totalCount = 0;
  var _hasMore    = true;
  var _loading    = false;
  var _graphSvg   = null;   // single SVG element spanning the whole graph
  var _lanes      = [];     // client-side lane tracking state

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fetchJson(url, cb) {
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(null, data); })
      .catch(function (err) { cb(err, null); });
  }

  // ---------------------------------------------------------------------------
  // Lane tracking — mirrors server algorithm, using short SHAs
  // ---------------------------------------------------------------------------

  function applyLaneTracking(commits) {
    commits.forEach(function (commit) {
      const parents = commit.parents || [];
      const laneIdx = commit.lane;
      const sha = commit.sha;

      commit.lanesBefore = _lanes.slice();

      if (parents.length === 0) {
        _lanes[laneIdx] = null;
      } else {
        _lanes[laneIdx] = parents[0];
        for (let j = 1; j < parents.length; j++) {
          const pSha = parents[j];
          let found = false;
          for (let k = 0; k < _lanes.length; k++) {
            if (_lanes[k] === pSha) { found = true; break; }
          }
          if (!found) {
            let free = -1;
            for (let k = 0; k < _lanes.length; k++) {
              if (_lanes[k] === null) { free = k; break; }
            }
            if (free === -1) _lanes.push(pSha);
            else _lanes[free] = pSha;
          }
        }
      }

      // Clean up zombie lanes: when multiple lanes were waiting for this commit,
      // indexOf() takes the first one; null out the rest so they don't draw ghost lines.
      for (let k = 0; k < _lanes.length; k++) {
        if (k !== laneIdx && _lanes[k] === sha) _lanes[k] = null;
      }

      commit.lanesAfter = _lanes.slice();
    });
  }

  // ---------------------------------------------------------------------------
  // Single-SVG graph renderer
  // ---------------------------------------------------------------------------

  // Create a single absolutely-positioned SVG that spans the graph container.
  // All lines and dots are drawn in this one SVG by measuring actual DOM row
  // positions — avoids gaps caused by per-row SVGs with fixed heights.
  function setupGraphCanvas(graphEl) {
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.id  = 'git-graph-canvas';
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('aria-hidden', 'true');
    // overflow:visible lets lines extend slightly past the SVG bounds during
    // layout changes without clipping.
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible';
    graphEl.style.position = 'relative';
    graphEl.insertBefore(svg, graphEl.firstChild);
    _graphSvg = svg;
  }

  function redrawGraph() {
    var graph = document.getElementById('git-graph');
    if (!graph || !_graphSvg) return;

    requestAnimationFrame(function () {
      var rows = graph.querySelectorAll('.git-graph-row');
      if (!rows.length) return;

      // Compute max active lane index across all rendered commits
      var maxLane = 0;
      _commits.forEach(function (c) {
        if (!c) return;
        if (c.lane > maxLane) maxLane = c.lane;
        var la = c.lanesAfter || [];
        for (var i = 0; i < la.length; i++) { if (la[i] && i > maxLane) maxLane = i; }
      });

      var svgW       = (maxLane + 1) * LANE_W + LANE_W;
      var paddingLeft = svgW + 8;  // 8 px gap between graph lines and commit text

      // Push text to the right so it doesn't overlap the SVG lane columns
      graph.style.paddingLeft = paddingLeft + 'px';

      // Measure each row's vertical centre (offsetTop is relative to #git-graph
      // because we set position:relative on it).
      const rowData = [];
      for (let i = 0; i < rows.length; i++) {
        const commit = _commits[i];
        if (!commit) break;
        rowData.push({
          cy: rows[i].offsetTop + rows[i].offsetHeight / 2,
          cx: commit.lane * LANE_W + LANE_W / 2,
          commit: commit
        });
      }

      _graphSvg.setAttribute('width',  svgW);
      _graphSvg.setAttribute('height', graph.offsetHeight);

      let lines = '';
      let dots  = '';

      // Draw lane lines between each consecutive pair of row centres.
      // Using measured centres removes gaps caused by variable row heights.
      for (let i = 0; i < rowData.length - 1; i++) {
        const curr   = rowData[i];
        const next   = rowData[i + 1];
        const after  = curr.commit.lanesAfter  || [];
        const before = curr.commit.lanesBefore || [];

        for (let j = 0; j < after.length; j++) {
          if (!after[j]) continue;    // lane is inactive — skip
          const x     = j * LANE_W + LANE_W / 2;
          const color = laneColor(j);
          // If the lane was absent BEFORE this commit it's a new branch opening
          // at the merge dot — draw a curve from the merge dot; otherwise straight.
          const fromX = before[j] ? x : curr.cx;
          // If this lane converges to the next commit (branch-off point) but the
          // next commit sits in a different lane, curve to that commit's dot.
          const toX = (after[j] === next.commit.sha && next.commit.lane !== j)
            ? next.cx
            : x;
          if (fromX === toX) {
            // Straight vertical — no curvature needed
            lines += '<line x1="' + fromX + '" y1="' + curr.cy +
                         '" x2="' + toX   + '" y2="' + next.cy +
                         '" stroke="' + color + '" stroke-width="2"/>';
          } else {
            // Cubic bezier: vertical tangents at both ends for a smooth S-curve
            const midY = (curr.cy + next.cy) / 2;
            lines += '<path d="M' + fromX + ',' + curr.cy +
                         ' C' + fromX + ',' + midY +
                         ' '  + toX   + ',' + midY +
                         ' '  + toX   + ',' + next.cy +
                         '" fill="none" stroke="' + color + '" stroke-width="2"/>';
          }
        }
      }

      // Dots are rendered after lines so they sit on top
      for (let i = 0; i < rowData.length; i++) {
        const d = rowData[i];
        dots += '<circle cx="' + d.cx + '" cy="' + d.cy + '" r="' + DOT_R +
                    '" fill="' + laneColor(d.commit.lane) + '"/>';
      }

      _graphSvg.innerHTML = lines + dots;

      // Hover-highlight ring — a single invisible circle that moves to whichever
      // row the mouse is over.  Re-appended after every innerHTML reset.
      var hlNs = 'http://www.w3.org/2000/svg';
      var hl = document.createElementNS(hlNs, 'circle');
      hl.id = 'git-highlight-dot';
      hl.setAttribute('r',            String(DOT_R + 3));
      hl.setAttribute('cx',           '0');
      hl.setAttribute('cy',           '0');
      hl.setAttribute('fill',         'none');
      hl.setAttribute('stroke-width', '2');
      hl.style.opacity    = '0';
      hl.style.transition = 'opacity 0.1s';
      _graphSvg.appendChild(hl);
    });
  }

  // ---------------------------------------------------------------------------
  // Ref pills
  // ---------------------------------------------------------------------------

  function renderRefs(refs) {
    if (!refs || refs.length === 0) return '';
    return refs.map(function (ref) {
      var cls = 'git-ref-pill';
      if (ref === 'HEAD' || ref.startsWith('HEAD ->')) cls += ' git-ref-head';
      else if (ref.startsWith('tag:')) cls += ' git-ref-tag';
      else cls += ' git-ref-branch';
      return '<span class="' + cls + '">' + esc(ref) + '</span>';
    }).join(' ');
  }

  // ---------------------------------------------------------------------------
  // Commit rows — text only; the SVG is drawn separately by redrawGraph()
  // ---------------------------------------------------------------------------

  function renderCommitRows(commits, container) {
    applyLaneTracking(commits);

    commits.forEach(function (commit) {
      var row = document.createElement('div');
      row.className = 'git-graph-row';
      row.setAttribute('data-sha', commit.sha);

      var refs = renderRefs(commit.refs);
      row.innerHTML =
        '<div class="git-graph-text">' +
          '<span class="git-sha">' + esc(commit.sha) + '</span>' +
          (refs ? ' ' + refs + ' ' : ' ') +
          '<span class="git-msg">' + esc(commit.message) + '</span>' +
          '<span class="git-meta">\u2014 ' + esc(commit.author) + ', ' + esc(commit.date) + '</span>' +
        '</div>';

      row.addEventListener('mouseenter', function () {
        var hl = document.getElementById('git-highlight-dot');
        if (!hl) return;
        hl.setAttribute('cx', String(commit.lane * LANE_W + LANE_W / 2));
        hl.setAttribute('cy', String(row.offsetTop + row.offsetHeight / 2));
        hl.setAttribute('stroke', laneColor(commit.lane));
        hl.style.opacity = '1';
      });
      row.addEventListener('mouseleave', function () {
        var hl = document.getElementById('git-highlight-dot');
        if (hl) hl.style.opacity = '0';
      });

      row.addEventListener('click', function () {
        var textEl = row.querySelector('.git-graph-text');
        if (!textEl) return;

        // Toggle: if already expanded, restore summary view
        if (row.classList.contains('git-graph-row--expanded')) {
          row.classList.remove('git-graph-row--expanded');
          textEl.innerHTML = row._summaryHtml;
          redrawGraph();
          return;
        }

        // Save summary HTML so we can restore it later
        row._summaryHtml = textEl.innerHTML;
        row.classList.add('git-graph-row--expanded');
        textEl.innerHTML = '<span class="git-meta">Loading\u2026</span>';

        fetchJson('/_git/diff/' + commit.sha, function (err, data) {
          // Bail if the user collapsed while loading
          if (!row.classList.contains('git-graph-row--expanded')) return;
          if (err || !data) {
            textEl.innerHTML = '<span class="git-diff-empty">Error loading diff</span>';
            return;
          }
          var filesHtml = (!data.files || data.files.length === 0)
            ? '<span class="git-diff-empty">No file changes</span>'
            : data.files.map(function (f) {
                return '<span class="git-diff-status git-diff-' + esc(f.status.toLowerCase()) + '">' + esc(f.status) + '</span>' +
                  ' <a href="/' + esc(f.path) + '" class="git-diff-path">' + esc(f.path) + '</a>';
              }).join('<br>');
          textEl.innerHTML =
            '<div class="git-diff-header">' +
              '<span class="git-sha">' + esc(commit.sha) + '</span>' +
              '<span class="git-meta"> \u2014 ' + esc(commit.author) + ', ' + esc(commit.date) + '</span>' +
            '</div>' +
            '<div class="git-diff-message">' + esc(data.message || commit.message) + '</div>' +
            '<div class="git-diff-files">' + filesHtml + '</div>';
          redrawGraph();
        });
      });

      container.appendChild(row);
    });

    redrawGraph();
  }

  // ---------------------------------------------------------------------------
  // Load a page of commits
  // ---------------------------------------------------------------------------

  function loadCommits(skip, cb) {
    if (_loading) return;
    _loading = true;
    fetchJson('/_git/log?skip=' + skip + '&count=' + PAGE, function (err, data) {
      _loading = false;
      if (err || !data) { if (cb) cb(false); return; }
      _totalCount = data.totalCount || 0;
      _hasMore    = data.hasMore;
      if (cb) cb(data.commits || []);
    });
  }

  // ---------------------------------------------------------------------------
  // Section builders
  // ---------------------------------------------------------------------------

  function buildHeaderBar(state) {
    var el = document.getElementById('git-header-bar');
    if (!el) return;
    el.innerHTML =
      '<span class="git-section-label">Branch:</span>' +
      '<span class="git-branch-badge">' + esc(state.head || '(unknown)') + '</span>' +
      '<span class="git-sha">' + esc(state.headSha || '') + '</span>' +
      (state.stashCount ? '<span class="git-stash-badge">' + state.stashCount + ' stash' + (state.stashCount > 1 ? 'es' : '') + '</span>' : '');
  }

  function buildBranches(branches) {
    if (!branches || branches.length === 0) return '<p class="git-empty">No local branches found.</p>';
    var rows = branches.map(function (b) {
      var status = '';
      if (b.gone) {
        status = '<span class="git-gone">gone</span>';
      } else {
        if (b.ahead)  status += '<span class="git-ahead">+' + b.ahead + '</span>';
        if (b.behind) status += '<span class="git-behind">\u2212' + b.behind + '</span>';
      }
      return '<tr><td>' + esc(b.name) + '</td><td>' + esc(b.upstream) + '</td><td>' + (status || '<span class="git-sync">\u2713</span>') + '</td></tr>';
    }).join('');
    return '<table class="git-table"><thead><tr><th>Branch</th><th>Upstream</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function buildTags(tags) {
    if (!tags || tags.length === 0) return '';
    var items = tags.map(function (t) {
      return '<li class="git-tag-item"><span class="git-ref-pill git-ref-tag">' + esc(t.name) + '</span> <span class="git-sha">' + esc(t.sha) + '</span> <span class="git-meta">' + esc(t.date) + '</span></li>';
    }).join('');
    return '<ul class="git-tag-list">' + items + '</ul>';
  }

  function buildWorktrees(worktrees) {
    // Index 0 is always the main worktree (/var/www inside the container) — not useful to show
    var linked = worktrees ? worktrees.slice(1) : [];
    if (!linked.length) return '';
    var rows = linked.map(function (wt) {
      return '<tr><td class="git-wt-path">' + esc(wt.path) + '</td><td>' + esc(wt.branch) + '</td><td><span class="git-sha">' + esc(wt.sha) + '</span></td></tr>';
    }).join('');
    return '<h2 class="git-section-heading">Worktrees</h2>' +
      '<table class="git-table git-wt-table"><thead><tr><th>Path</th><th>Branch</th><th>Commit</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // ---------------------------------------------------------------------------
  // Dashboard render
  // ---------------------------------------------------------------------------

  function updateCommitCount() {
    var el = document.getElementById('git-commit-count');
    if (!el) return;
    el.textContent = _totalCount > 0 ? '(' + _commits.length + ' / ' + _totalCount + ')' : '';
  }

  function renderDashboard(state, commits) {
    var dash = document.getElementById('git-dashboard');
    if (!dash) return;

    dash.innerHTML =
      '<div id="git-header-bar" class="git-header-bar"></div>' +
      '<div class="git-sections">' +
        '<section class="git-section">' +
          '<h2 class="git-section-heading">Branches</h2>' +
          '<div id="git-branches">' + buildBranches(state.branches) + '</div>' +
        '</section>' +
        (state.tags && state.tags.length > 0
          ? '<section class="git-section"><h2 class="git-section-heading">Tags</h2><div id="git-tags">' + buildTags(state.tags) + '</div></section>'
          : '') +
        '<div id="git-worktrees">' + buildWorktrees(state.worktrees) + '</div>' +
      '</div>' +
      '<section class="git-section">' +
        '<h2 class="git-section-heading">Commits <span id="git-commit-count" class="git-commit-count"></span></h2>' +
        '<div id="git-graph"></div>' +
        '<div id="git-scroll-sentinel" class="git-scroll-sentinel"></div>' +
      '</section>';

    buildHeaderBar(state);

    var graph = document.getElementById('git-graph');
    setupGraphCanvas(graph);
    renderCommitRows(commits, graph);
    updateCommitCount();

    // Infinite scroll: load more commits when the sentinel enters the viewport
    var sentinel = document.getElementById('git-scroll-sentinel');
    if (sentinel && window.IntersectionObserver) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && _hasMore && !_loading) {
          loadCommits(_commits.length, function (newCommits) {
            if (!newCommits) return;
            _commits = _commits.concat(newCommits);
            renderCommitRows(newCommits, graph);
            updateCommitCount();
            if (!_hasMore) observer.disconnect();
          });
        }
      }, { rootMargin: '200px' });
      observer.observe(sentinel);
    }
  }

  // ---------------------------------------------------------------------------
  // Polling: refresh state every 5 s; reload log if refs changed
  // ---------------------------------------------------------------------------

  function startPolling() {
    setInterval(function () {
      fetchJson('/_git/state', function (err, newState) {
        if (err || !newState) return;
        var changed = !_state ||
          newState.headSha !== _state.headSha ||
          JSON.stringify(newState.branches) !== JSON.stringify(_state.branches);
        _state = newState;
        buildHeaderBar(newState);
        var branchEl = document.getElementById('git-branches');
        if (branchEl) branchEl.innerHTML = buildBranches(newState.branches);
        if (changed) {
          _commits = [];
          _lanes   = [];
          loadCommits(0, function (commits) {
            if (!commits) return;
            _commits = commits;
            var graph = document.getElementById('git-graph');
            if (graph) {
              // Remove only commit rows; leave the SVG canvas in place
              graph.querySelectorAll('.git-graph-row').forEach(function (r) { r.remove(); });
              renderCommitRows(commits, graph);
              updateCommitCount();
            }
          });
        }
      });
    }, 5000); // 5 s polling interval
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    var stateData  = null;
    var commitData = null;
    var pending    = 2;

    function maybeRender() {
      if (--pending > 0) return;
      if (!stateData) stateData = { head: '', headSha: '', branches: [], tags: [], worktrees: [], stashCount: 0 };
      _state   = stateData;
      _commits = commitData || [];
      renderDashboard(_state, _commits);
      startPolling();
    }

    fetchJson('/_git/state', function (err, data) { stateData = data; maybeRender(); });
    loadCommits(0, function (commits) { commitData = commits || []; _commits = commitData; maybeRender(); });
  });

})();
