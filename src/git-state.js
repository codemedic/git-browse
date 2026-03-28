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
  var PAGE_REFS = 20; // branches/tags per page

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

  var _branches = [];
  var _branchesHasMore = true;
  var _branchesLoading = false;
  var _tags = [];
  var _tagsHasMore = true;
  var _tagsLoading = false;

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

      for (let k = 0; k < _lanes.length; k++) {
        if (k !== laneIdx && _lanes[k] === sha) _lanes[k] = null;
      }

      commit.lanesAfter = _lanes.slice();
    });
  }

  // ---------------------------------------------------------------------------
  // Single-SVG graph renderer
  // ---------------------------------------------------------------------------

  function setupGraphCanvas(graphEl) {
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.id  = 'git-graph-canvas';
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('aria-hidden', 'true');
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

      var maxLane = 0;
      _commits.forEach(function (c) {
        if (!c) return;
        if (c.lane > maxLane) maxLane = c.lane;
        var la = c.lanesAfter || [];
        for (var i = 0; i < la.length; i++) { if (la[i] && i > maxLane) maxLane = i; }
      });

      var svgW       = (maxLane + 1) * LANE_W + LANE_W;
      var paddingLeft = svgW + 8;

      graph.style.paddingLeft = paddingLeft + 'px';

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

      for (let i = 0; i < rowData.length - 1; i++) {
        const curr   = rowData[i];
        const next   = rowData[i + 1];
        const after  = curr.commit.lanesAfter  || [];
        const before = curr.commit.lanesBefore || [];

        for (let j = 0; j < after.length; j++) {
          if (!after[j]) continue;
          const x     = j * LANE_W + LANE_W / 2;
          const color = laneColor(j);
          const fromX = before[j] ? x : curr.cx;
          const toX = (after[j] === next.commit.sha && next.commit.lane !== j) ? next.cx : x;
          if (fromX === toX) {
            lines += '<line x1="' + fromX + '" y1="' + curr.cy + '" x2="' + toX   + '" y2="' + next.cy + '" stroke="' + color + '" stroke-width="2"/>';
          } else {
            const midY = (curr.cy + next.cy) / 2;
            lines += '<path d="M' + fromX + ',' + curr.cy + ' C' + fromX + ',' + midY + ' '  + toX   + ',' + midY + ' '  + toX   + ',' + next.cy + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
          }
        }
      }

      for (let i = 0; i < rowData.length; i++) {
        const d = rowData[i];
        dots += '<circle cx="' + d.cx + '" cy="' + d.cy + '" r="' + DOT_R + '" fill="' + laneColor(d.commit.lane) + '"/>';
      }

      _graphSvg.innerHTML = lines + dots;

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
  // Commit rows
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

        if (row.classList.contains('git-graph-row--expanded')) {
          row.classList.remove('git-graph-row--expanded');
          textEl.innerHTML = row._summaryHtml;
          redrawGraph();
          return;
        }

        row._summaryHtml = textEl.innerHTML;
        row.classList.add('git-graph-row--expanded');
        textEl.innerHTML = '<span class="git-meta">Loading\u2026</span>';

        fetchJson('/_git/diff/' + commit.sha, function (err, data) {
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
  // Data Fetching
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

  function loadBranches(skip, cb) {
    if (_branchesLoading) return;
    _branchesLoading = true;
    fetchJson('/_git/branches?skip=' + skip + '&count=' + PAGE_REFS, function (err, data) {
      _branchesLoading = false;
      if (err || !data) { if (cb) cb(false); return; }
      _branchesHasMore = data.hasMore;
      if (cb) cb(data.branches || []);
    });
  }

  function loadTags(skip, cb) {
    if (_tagsLoading) return;
    _tagsLoading = true;
    fetchJson('/_git/tags?skip=' + skip + '&count=' + PAGE_REFS, function (err, data) {
      _tagsLoading = false;
      if (err || !data) { if (cb) cb(false); return; }
      _tagsHasMore = data.hasMore;
      if (cb) cb(data.tags || []);
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

  function renderBranchRows(branches, tbody) {
    if (!branches || branches.length === 0) return;
    var html = branches.map(function (b) {
      var status = '';
      if (b.gone) {
        status = '<span class="git-gone">gone</span>';
      } else {
        if (b.ahead)  status += '<span class="git-ahead">+' + b.ahead + '</span>';
        if (b.behind) status += '<span class="git-behind">\u2212' + b.behind + '</span>';
      }
      return '<tr><td>' + esc(b.name) + '</td><td>' + esc(b.upstream) + '</td><td>' + (status || '<span class="git-sync">\u2713</span>') + '</td></tr>';
    }).join('');
    tbody.insertAdjacentHTML('beforeend', html);
  }

  function renderTagRows(tags, tbody) {
    if (!tags || tags.length === 0) return;
    var html = tags.map(function (t) {
      return '<tr><td><span class="git-ref-pill git-ref-tag">' + esc(t.name) + '</span></td><td><span class="git-sha">' + esc(t.sha) + '</span></td><td><span class="git-meta">' + esc(t.date) + '</span></td></tr>';
    }).join('');
    tbody.insertAdjacentHTML('beforeend', html);
  }

  function buildWorktrees(worktrees) {
    var linked = worktrees ? worktrees.slice(1) : [];
    if (!linked.length) return '<p class="git-empty" style="padding:12px">No linked worktrees found.</p>';
    var rows = linked.map(function (wt) {
      return '<tr><td class="git-wt-path">' + esc(wt.path) + '</td><td>' + esc(wt.branch) + '</td><td><span class="git-sha">' + esc(wt.sha) + '</span></td></tr>';
    }).join('');
    return '<table class="git-table git-wt-table"><thead><tr><th>Path</th><th>Branch</th><th>Commit</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // ---------------------------------------------------------------------------
  // Dashboard render
  // ---------------------------------------------------------------------------

  function updateCommitCount() {
    var el = document.getElementById('git-commit-count');
    if (!el) return;
    el.textContent = _totalCount > 0 ? '(' + _commits.length + ' / ' + _totalCount + ')' : '';
  }

  function setupTabs(dash) {
    var tabs = dash.querySelectorAll('.git-tab-btn');
    var panels = dash.querySelectorAll('.git-tab-panel');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        this.classList.add('active');
        dash.querySelector('.git-tab-panel[data-tab="' + target + '"]').classList.add('active');
      });
    });
  }

  function renderDashboard(state, commits) {
    var dash = document.getElementById('git-dashboard');
    if (!dash) return;

    dash.innerHTML =
      '<div id="git-header-bar" class="git-header-bar"></div>' +
      '<div class="git-tabs">' +
        '<div class="git-tabs-header">' +
          '<button class="git-tab-btn active" data-tab="worktrees"><i data-lucide="layers"></i> Worktrees</button>' +
          '<button class="git-tab-btn" data-tab="branches"><i data-lucide="git-branch"></i> Branches</button>' +
          '<button class="git-tab-btn" data-tab="tags"><i data-lucide="tag"></i> Tags</button>' +
        '</div>' +
        '<div class="git-tab-content">' +
          '<div class="git-tab-panel active" data-tab="worktrees">' +
            '<div id="git-worktrees">' + buildWorktrees(state.worktrees) + '</div>' +
          '</div>' +
          '<div class="git-tab-panel" data-tab="branches">' +
            '<table class="git-table"><thead><tr><th>Branch</th><th>Upstream</th><th>Status</th></tr></thead><tbody id="git-branches-body"></tbody></table>' +
            '<div id="git-branches-sentinel" class="git-scroll-sentinel"></div>' +
          '</div>' +
          '<div class="git-tab-panel" data-tab="tags">' +
            '<table class="git-table"><thead><tr><th>Tag</th><th>SHA</th><th>Date</th></tr></thead><tbody id="git-tags-body"></tbody></table>' +
            '<div id="git-tags-sentinel" class="git-scroll-sentinel"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<section class="git-section">' +
        '<h2 class="git-section-heading">Commits <span id="git-commit-count" class="git-commit-count"></span></h2>' +
        '<div id="git-graph"></div>' +
        '<div id="git-scroll-sentinel" class="git-scroll-sentinel"></div>' +
      '</section>';

    buildHeaderBar(state);
    setupTabs(dash);
    if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(dash);

    var graph = document.getElementById('git-graph');
    setupGraphCanvas(graph);
    renderCommitRows(commits, graph);
    updateCommitCount();

    // IntersectionObservers for infinite scroll
    if (window.IntersectionObserver) {
      // Commits
      var commitSentinel = document.getElementById('git-scroll-sentinel');
      var commitObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && _hasMore && !_loading) {
          loadCommits(_commits.length, function (newCommits) {
            if (!newCommits) return;
            _commits = _commits.concat(newCommits);
            renderCommitRows(newCommits, graph);
            updateCommitCount();
            if (!_hasMore) commitObserver.disconnect();
          });
        }
      }, { rootMargin: '200px' });
      commitObserver.observe(commitSentinel);

      // Branches
      var branchSentinel = document.getElementById('git-branches-sentinel');
      var branchBody = document.getElementById('git-branches-body');
      var branchObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && _branchesHasMore && !_branchesLoading) {
          loadBranches(_branches.length, function (newBranches) {
            if (!newBranches) return;
            _branches = _branches.concat(newBranches);
            renderBranchRows(newBranches, branchBody);
            if (!_branchesHasMore) branchObserver.disconnect();
          });
        }
      }, { rootMargin: '100px' });
      branchObserver.observe(branchSentinel);

      // Tags
      var tagSentinel = document.getElementById('git-tags-sentinel');
      var tagBody = document.getElementById('git-tags-body');
      var tagObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && _tagsHasMore && !_tagsLoading) {
          loadTags(_tags.length, function (newTags) {
            if (!newTags) return;
            _tags = _tags.concat(newTags);
            renderTagRows(newTags, tagBody);
            if (!_tagsHasMore) tagObserver.disconnect();
          });
        }
      }, { rootMargin: '100px' });
      tagObserver.observe(tagSentinel);
    }
  }

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  function startPolling() {
    setInterval(function () {
      fetchJson('/_git/state', function (err, newState) {
        if (err || !newState) return;
        var changed = !_state ||
          newState.headSha !== _state.headSha;
        // Branches/Tags polling removed for now to favor manual/event-based refresh
        // but we keep headSha tracking for the graph.
        _state = newState;
        buildHeaderBar(newState);
        if (changed) {
          _commits = [];
          _lanes   = [];
          loadCommits(0, function (commits) {
            if (!commits) return;
            _commits = commits;
            var graph = document.getElementById('git-graph');
            if (graph) {
              graph.querySelectorAll('.git-graph-row').forEach(function (r) { r.remove(); });
              renderCommitRows(commits, graph);
              updateCommitCount();
            }
          });
        }
      });
    }, 5000);
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
