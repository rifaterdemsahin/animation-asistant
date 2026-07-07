(function () {
  'use strict';

  const MAX = 100;
  let entries = [];
  let visible = false;

  function now() { return new Date().toUTCString(); }

  function add(entry) {
    entries.unshift(entry);
    if (entries.length > MAX) entries.length = MAX;
    if (visible) render();
    updateBadge();
  }

  function render() {
    const body = document.getElementById('debug-body');
    if (!body) return;
    body.innerHTML = entries.map(function (e) {
      var icon = e.type === 'action' ? (e.status < 400 ? '&#x2705;' : '&#x274C;') : '&#x26A0;&#xFE0F;';
      var cls = e.type === 'action' ? (e.status < 400 ? 'db-ok' : 'db-err') : 'db-err';
      var copy = JSON.stringify({ timestamp: e.timestamp, type: e.type, method: e.method,
        url: e.url, status: e.status, message: e.message, body: e.body }, null, 2);
      return '<div class="db-entry ' + cls + '">' +
        '<button class="db-copy" data-copy="' + escAttr(copy) + '">Copy</button>' +
        '<span class="db-icon">' + icon + '</span> ' +
        '<span class="db-time">' + escHtml(e.timestamp) + '</span> ' +
        '<code class="db-method">' + escHtml(e.method || '') + '</code> ' +
        '<span class="db-url">' + escHtml(e.url || '') + '</span> ' +
        '<span class="db-status">' + (e.status || '') + '</span> ' +
        '<div class="db-msg">' + escHtml(e.message) + '</div>' +
        '</div>';
    }).join('') || '<div class="db-empty muted">No entries yet.</div>';

    body.querySelectorAll('.db-copy').forEach(function (b) {
      b.addEventListener('click', function () {
        navigator.clipboard.writeText(b.dataset.copy).then(function () {
          b.textContent = 'Copied!';
          setTimeout(function () { b.textContent = 'Copy'; }, 1500);
        });
      });
    });
  }

  function updateBadge() {
    var errs = entries.filter(function (e) { return e.type !== 'action' || e.status >= 400; });
    var btn = document.getElementById('debug-toggle');
    if (btn) btn.textContent = '[Debug' + (errs.length ? ' ' + errs.length : '') + ']';
  }

  function escHtml(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function escAttr(s) { return String(s || '').replace(/[&"']/g, function (c) { return ({ '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  window.__debug_add = add;
  window.__debug_entries = function () { return entries; };

  var _fetch = window.fetch;
  window.fetch = function (url, opts) {
    var method = (opts && opts.method) || 'GET';
    var start = performance.now();
    return _fetch.apply(this, arguments).then(function (r) {
      return r.clone().text().then(function (body) {
        var duration = Math.round(performance.now() - start);
        add({
          type: 'action',
          timestamp: now(),
          method: method,
          url: (typeof url === 'string' ? url : (url && url.url || '')),
          status: r.status,
          duration: duration + 'ms',
          message: (r.ok ? '' : 'HTTP ' + r.status),
          body: (body && body.length < 2000 ? body : (body ? body.substring(0, 2000) + '...' : ''))
        });
        return r;
      });
    }, function (err) {
      add({
        type: 'error',
        timestamp: now(),
        method: method,
        url: (typeof url === 'string' ? url : (url && url.url || '')),
        status: 0,
        message: 'Network error: ' + (err.message || String(err)),
        body: ''
      });
      throw err;
    });
  };

  window.addEventListener('error', function (e) {
    add({
      type: 'error',
      timestamp: now(),
      method: 'JS',
      url: location.href,
      status: 0,
      message: e.message || String(e.error),
      body: (e.error && e.error.stack || '')
    });
  });

  window.addEventListener('unhandledrejection', function (e) {
    add({
      type: 'error',
      timestamp: now(),
      method: 'PROMISE',
      url: location.href,
      status: 0,
      message: e.reason && e.reason.message || String(e.reason),
      body: (e.reason && e.reason.stack || '')
    });
  });

  function injectBar() {
    var existing = document.getElementById('debug-bar');
    if (existing) return;

    var bar = document.createElement('div');
    bar.id = 'debug-bar';
    bar.className = 'hidden';
    bar.innerHTML =
      '<div class="db-header">' +
        '<span class="db-title">Debug Console</span>' +
        '<button id="db-clear">Clear</button>' +
        '<button id="db-pull-server">Pull server errors</button>' +
        '<button id="db-close">Close</button>' +
      '</div>' +
      '<div id="debug-body" class="db-body"></div>';

    var footer = document.getElementById('app-footer');
    if (!footer) return;
    footer.parentNode.insertBefore(bar, footer.nextSibling);

    var toggle = document.createElement('button');
    toggle.id = 'debug-toggle';
    toggle.className = 'debug-toggle';
    toggle.textContent = '[Debug]';
    footer.querySelector('.footer').appendChild(toggle);

    toggle.addEventListener('click', function () {
      visible = !visible;
      bar.classList.toggle('hidden', !visible);
      toggle.classList.toggle('active', visible);
      if (visible) render();
    });

    document.getElementById('db-close').addEventListener('click', function () {
      visible = false;
      bar.classList.add('hidden');
      toggle.classList.remove('active');
    });

    document.getElementById('db-clear').addEventListener('click', function () {
      entries = [];
      render();
      updateBadge();
    });

    document.getElementById('db-pull-server').addEventListener('click', function () {
      _fetch('/api/errors', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.errors) {
            data.errors.forEach(function (e) {
              add({
                type: 'server',
                timestamp: e.timestamp,
                method: e.method,
                url: e.path,
                status: e.code,
                message: e.message,
                body: e.stack || ''
              });
            });
          }
        })
        .catch(function (err) {
          add({ type: 'error', timestamp: now(), method: 'DEBUG', url: '/api/errors', status: 0, message: 'Failed to pull server errors: ' + err.message, body: '' });
        });
    });
  }

  document.addEventListener('layout:ready', injectBar);
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(injectBar, 100);
  });
})();
