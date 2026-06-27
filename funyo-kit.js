/* funyo-kit — shared shell for funyo games: sound engine + global mute, top nav
   (‹ Menu · mute · funyo ›), end-screen share row, and PWA auto-update.
   Loaded via <script src="../../funyo-kit.js"></script> in <head> (before the game's
   inline script). Exposes window.funyo / global `funyo`. Every browser API is guarded
   so the headless test harness can load it as a pre-script without throwing. */
(function () {
  'use strict';

  // ---------- sound engine + site-wide mute ----------
  var MUTE_KEY = 'funyo_muted';
  var ac, muted = false, defs = {}, muteBtns = [];
  try { muted = (typeof localStorage !== 'undefined') && localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

  function ensureAC() {
    if (ac !== undefined) return;
    var AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
             (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
    ac = AC ? (function () { try { return new AC(); } catch (e) { return null; } })() : null;
  }
  function tone(f, d, type, g) {
    if (muted) return; ensureAC(); if (!ac) return;
    try {
      var o = ac.createOscillator(), v = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      v.gain.value = g || 0.1;
      v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(v); v.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }
  function noise(d, g) {
    if (muted) return; ensureAC(); if (!ac) return;
    try {
      var n = ac.createBufferSource(), b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d), ac.sampleRate);
      var dt = b.getChannelData(0);
      for (var i = 0; i < dt.length; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / dt.length);
      n.buffer = b;
      var v = ac.createGain(); v.gain.value = g || 0.2;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      n.connect(lp); lp.connect(v); v.connect(ac.destination); n.start();
    } catch (e) {}
  }
  function persistMute() { try { if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {} }
  function syncMuteBtns() { for (var i = 0; i < muteBtns.length; i++) { try { muteBtns[i].textContent = muted ? '🔇' : '🔊'; } catch (e) {} } }

  var sound = {
    tone: tone, noise: noise,
    // register named sounds: define({ name: ({tone,noise}) => {...} })
    define: function (map) { if (map) for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) defs[k] = map[k]; return sound; },
    play: function (name) {
      if (muted) return; ensureAC();
      if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
      var fn = defs[name]; if (fn) { try { fn({ tone: tone, noise: noise }); } catch (e) {} }
    },
    isMuted: function () { return muted; },
    setMuted: function (m) { muted = !!m; persistMute(); syncMuteBtns(); },
    toggle: function () { muted = !muted; persistMute(); syncMuteBtns(); return muted; },
  };

  // ---------- top nav: ‹ Menu · (mute) · funyo › ----------
  function nav(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var wrap = document.createElement('div');
    wrap.className = 'funyo-nav';
    var html = '<button class="funyo-back" id="funyoMenu" type="button">&#x2039; Menu</button>';
    if (opts.mute !== false) html += '<button class="funyo-back funyo-mute" id="funyoMute" type="button" aria-label="Toggle sound" title="Toggle sound">🔊</button>';
    html += '<a class="funyo-back" id="funyoHome" href="' + (opts.home || '../../') + '">funyo &#x203A;</a>';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    var menu = document.getElementById('funyoMenu');
    if (menu) menu.addEventListener('click', function () { try { location.reload(); } catch (e) {} });
    var mute = document.getElementById('funyoMute');
    if (mute) { muteBtns.push(mute); mute.addEventListener('click', function () { sound.toggle(); }); try { mute.textContent = muted ? '🔇' : '🔊'; } catch (e) {} }
  }

  // ---------- end-screen share row ----------
  var SVG = {
    native: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12c-.688 0-1.25.561-1.25 1.25 0 .687.562 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
  };
  function enc(s) { return (typeof encodeURIComponent === 'function') ? encodeURIComponent(s) : String(s); }
  // pure + testable: build the share targets from a url + message (message has NO trailing
  // preposition and NO url, so it reads correctly regardless of where a platform puts the link)
  function shareUrls(url, message) {
    return {
      x: 'https://twitter.com/intent/tweet?text=' + enc(message) + '&url=' + enc(url),
      reddit: 'https://www.reddit.com/submit?url=' + enc(url) + '&title=' + enc(message),
      copy: message + '\n' + url,
    };
  }
  function shareRow(el, o) {
    if (!el) return;
    o = o || {};
    var url = o.url || ('https://funyo.online/games/' + (o.slug || '') + '/');
    var title = o.title || 'funyo';
    var getMsg = (typeof o.message === 'function') ? o.message : function () { return o.message || ''; };
    if (el.classList) el.classList.add('funyo-share');
    el.innerHTML =
      '<span class="funyo-share-lbl">Share</span>' +
      '<a class="sbtn" data-act="native" href="#" style="display:none" aria-label="Share" title="Share">' + SVG.native + '</a>' +
      '<a class="sbtn" data-act="x" target="_blank" rel="noopener" aria-label="Share on X" title="Share on X">' + SVG.x + '</a>' +
      '<a class="sbtn" data-act="reddit" target="_blank" rel="noopener" aria-label="Share on Reddit" title="Share on Reddit">' + SVG.reddit + '</a>' +
      '<button class="sbtn" data-act="copy" type="button" aria-label="Copy" title="Copy">' + SVG.copy + '</button>';
    var q = function (sel) { try { return el.querySelector ? el.querySelector(sel) : null; } catch (e) { return null; } };
    var x = q('[data-act="x"]'), reddit = q('[data-act="reddit"]'), copy = q('[data-act="copy"]'), native = q('[data-act="native"]');
    var refresh = function () { var u = shareUrls(url, getMsg()); if (x) x.href = u.x; if (reddit) reddit.href = u.reddit; };
    if (x) x.addEventListener('click', refresh);
    if (reddit) reddit.addEventListener('click', refresh);
    refresh();
    if (copy) copy.addEventListener('click', function () {
      var u = shareUrls(url, getMsg());
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(u.copy).then(function () {
          if (copy.classList) copy.classList.add('ok');
          var prev = copy.title; copy.title = 'Copied!';
          setTimeout(function () { if (copy.classList) copy.classList.remove('ok'); copy.title = prev; }, 1500);
        }).catch(function () {});
      } catch (e) {}
    });
    if (native && typeof navigator !== 'undefined' && navigator.share) {
      if (native.style) native.style.display = '';
      native.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        try { navigator.share({ title: title, text: getMsg(), url: url }).catch(function () {}); } catch (_) {}
      });
    }
  }

  // ---------- PWA auto-update (reload once when a new worker takes control) ----------
  function pwa(file) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    var reloaded = false, had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloaded || !had) return; reloaded = true; try { location.reload(); } catch (e) {} });
    var register = function () {
      try {
        navigator.serviceWorker.register(file || 'sw.js').then(function (r) {
          try { r.update(); } catch (e) {}
          setInterval(function () { try { r.update(); } catch (e) {} }, 3600000);
        }).catch(function () {});
      } catch (e) {}
    };
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', register); else register();
  }

  var api = { sound: sound, nav: nav, shareRow: shareRow, shareUrls: shareUrls, pwa: pwa };
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  g.funyo = api;
  if (typeof window !== 'undefined') window.funyo = api;
})();
