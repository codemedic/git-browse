(function () {
  'use strict';

  if (window.self !== window.top) return;

  const agent = {
    connected: false,
    agentName: null,
    pending: new Map(),

    async approve(id) {
      console.log(`[AGENT] Approving diff ${id}...`);
      try {
        const res = await fetch('/_agent/respond/' + id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' })
        });
        if (res.ok) {
          console.log(`[AGENT] Diff ${id} approved successfully`);
          this.removeDiff(id);
        } else {
          const err = await res.json();
          console.error(`[AGENT] Failed to approve diff ${id}:`, err.error || res.statusText);
          alert('Failed to approve diff: ' + (err.error || res.statusText));
        }
      } catch (err) {
        console.error('[AGENT] Error approving diff', err);
      }
    },

    async reject(id) {
      console.log(`[AGENT] Rejecting diff ${id}...`);
      try {
        const res = await fetch('/_agent/respond/' + id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' })
        });
        if (res.ok) {
          console.log(`[AGENT] Diff ${id} rejected successfully`);
          this.removeDiff(id);
        } else {
          const err = await res.json();
          console.error(`[AGENT] Failed to reject diff ${id}:`, err.error || res.statusText);
          alert('Failed to reject diff: ' + (err.error || res.statusText));
        }
      } catch (err) {
        console.error('[AGENT] Error rejecting diff', err);
      }
    },

    removeDiff(id) {
      this.pending.delete(id);
      const toast = document.getElementById('agent-toast-' + id);
      if (toast) {
        toast.classList.remove('agent-toast-visible');
        setTimeout(() => toast.remove(), 300);
      }
      this.updateBadge();
      
      // If we are on the diff page for this ID, go to home
      if (window.location.pathname === '/_agent/diff/' + id) {
        window.location.href = '/';
      }
    },

    updateBadge() {
      const badge = document.getElementById('toolbar-agent-badge');
      if (!badge) return;
      
      badge.classList.toggle('agent-connected', this.connected);
      badge.classList.toggle('agent-active', this.pending.size > 0);
      
      if (this.connected) {
        badge.title = 'Connected to ' + (this.agentName || 'agent');
      } else {
        badge.title = 'Agent not connected';
      }

      const count = badge.querySelector('.agent-badge-count');
      if (count) {
        count.textContent = this.pending.size > 0 ? this.pending.size : '';
      }
    }
  };

  window.__gitBrowseAgent = agent;

  function createToast(id, data) {
    if (document.getElementById('agent-toast-' + id)) return;

    let container = document.getElementById('agent-toasts');
    if (!container) {
      container = document.createElement('div');
      container.id = 'agent-toasts';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.id = 'agent-toast-' + id;
    toast.className = 'agent-toast';
    
    const filePath = data.path || '';
    const fileName = filePath.split('/').pop() || 'unknown file';
    
    toast.innerHTML = `
      <div class="agent-toast-header">
        <span class="agent-toast-badge">agent</span>
        <span class="agent-toast-title">Diff Review</span>
      </div>
      <div class="agent-toast-body">
        <a href="/_agent/diff/${id}" class="agent-toast-file" title="${filePath}">${fileName}</a>
      </div>
      <div class="agent-toast-footer">
        <button class="agent-btn agent-btn-reject" data-id="${id}">Reject</button>
        <button class="agent-btn agent-btn-approve" data-id="${id}">Approve</button>
      </div>
    `;

    toast.querySelector('.agent-btn-reject').onclick = () => agent.reject(id);
    toast.querySelector('.agent-btn-approve').onclick = () => agent.approve(id);

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('agent-toast-visible'), 10);
  }

  function initSSE() {
    const es = new EventSource('/_agent/events');

    es.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      agent.connected = data.connected;
      agent.agentName = data.agentName;
      data.pendingDiffs.forEach(d => {
        agent.pending.set(d.id, d);
        createToast(d.id, d);
      });
      agent.updateBadge();
    });

    es.addEventListener('diff:new', (e) => {
      const data = JSON.parse(e.data);
      agent.pending.set(data.id, data);
      createToast(data.id, data);
      agent.updateBadge();
    });

    es.addEventListener('diff:resolved', (e) => {
      const data = JSON.parse(e.data);
      agent.removeDiff(data.id);
    });

    es.addEventListener('agent:connected', (e) => {
      const data = JSON.parse(e.data);
      agent.connected = true;
      agent.agentName = data.name;
      agent.updateBadge();
    });

    es.addEventListener('agent:disconnected', () => {
      agent.connected = false;
      agent.agentName = null;
      agent.updateBadge();
    });

    es.addEventListener('file:open', (e) => {
      const data = JSON.parse(e.data);
      if (data.path) {
        // Translate /var/www to root
        const relPath = data.path.replace(/^\/var\/www/, '') || '/';
        window.location.href = relPath;
      }
    });

    es.onerror = () => {
      agent.connected = false;
      agent.updateBadge();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Add badge to toolbar
    const toolbarActions = document.querySelector('.toolbar-actions');
    if (toolbarActions) {
      const badge = document.createElement('div');
      badge.id = 'toolbar-agent-badge';
      badge.className = 'toolbar-btn agent-badge-btn';
      badge.innerHTML = '<span class="toolbar-btn-icon"><i data-lucide="bot"></i></span><span class="agent-badge-count"></span>';
      toolbarActions.insertBefore(badge, toolbarActions.firstChild);
      if (window.__gitBrowseIcons) window.__gitBrowseIcons.create(badge);
    }

    initSSE();
  }

})();
