(function () {
  'use strict';

  if (window.self !== window.top) return;

  var extToIcon = {
    // JavaScript / TypeScript
    'js': 'file-code-2',
    'mjs': 'file-code-2',
    'cjs': 'file-code-2',
    'jsx': 'file-code-2',
    'ts': 'file-code-2',
    'tsx': 'file-code-2',
    // Python
    'py': 'file-code-2',
    // Systems
    'go': 'file-code-2',
    'rs': 'file-code-2',
    'c': 'file-code-2',
    'cpp': 'file-code-2',
    'cc': 'file-code-2',
    'h': 'file-code-2',
    'hpp': 'file-code-2',
    'java': 'file-code-2',
    'cs': 'file-code-2',
    'swift': 'file-code-2',
    'kt': 'file-code-2',
    'scala': 'file-code-2',
    // Scripting
    'rb': 'file-code-2',
    'php': 'file-code-2',
    'lua': 'file-code-2',
    'r': 'file-code-2',
    // Shell
    'sh': 'terminal-square',
    'bash': 'terminal-square',
    'zsh': 'terminal-square',
    'fish': 'terminal-square',
    // Styles
    'css': 'file-code',
    'scss': 'file-code',
    'less': 'file-code',
    'sass': 'file-code',
    // Data / Config
    'json': 'file-json',
    'yml': 'settings',
    'yaml': 'settings',
    'toml': 'settings',
    'ini': 'settings',
    'xml': 'file-code',
    'sql': 'database',
    // Infrastructure
    'tf': 'server',
    'hcl': 'server',
    'proto': 'network',
    // Markdown / text
    'md': 'file-text',
    'markdown': 'file-text',
    'txt': 'file-text',
    // Media
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'ico': 'image',
    'bmp': 'image',
    'avif': 'image',
    'mp4': 'video',
    'webm': 'video',
    'ogv': 'video',
    'mov': 'video',
    'mp3': 'file-audio',
    'wav': 'file-audio',
    'oga': 'file-audio',
    'ogg': 'file-audio',
    'flac': 'file-audio',
    'aac': 'file-audio',
    'm4a': 'file-audio',
    'pdf': 'file-text'
  };

  var exactToIcon = {
    'dockerfile': 'box',
    'makefile': 'settings',
    'jenkinsfile': 'settings',
    'vagrantfile': 'server'
  };

  function getIconForFile(filename) {
    if (!filename) return 'file';
    var lower = filename.toLowerCase();
    if (exactToIcon[lower]) return exactToIcon[lower];

    var parts = lower.split('.');
    if (parts.length > 1) {
      var ext = parts[parts.length - 1];
      if (extToIcon[ext]) return extToIcon[ext];
    }
    return 'file';
  }

  window.__gitBrowseIcons = {
    getFileIcon: getIconForFile,
    create: function (root) {
      if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons(root ? { root: root } : undefined);
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.__gitBrowseIcons.create();
  });
})();
