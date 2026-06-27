/* game-kit — shared shell for Komyo Games games: audio (SFX + Music channels) with a top-right
   sound menu + per-channel mute & volume, top-left nav (‹ Menu · Komyo Games ›), end-screen share
   row, PWA auto-update, and a standard center-top HUD style (see game-kit.css).
   Loaded via <script src="../../game-kit.js"></script> in <head> (before the game's inline
   script). Exposes window.gamekit / global `gamekit`. Headless-safe: every browser API is guarded. */
(function () {
  'use strict';

  // ---------- persistence helpers ----------
  function lsGet(k) { try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (e) {} }
  function clamp01(v, d) { v = parseFloat(v); return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : d; }

  // ---------- audio state (two channels: SFX kit-played, Music settings-only) ----------
  var SFX_M = 'gamekit_sfx_muted', SFX_V = 'gamekit_sfx_vol', MUS_M = 'gamekit_music_muted', MUS_V = 'gamekit_music_vol';
  var sfxMuted = lsGet(SFX_M) === '1';
  var musMuted = lsGet(MUS_M) === '1';
  var sfxVol = clamp01(lsGet(SFX_V), 0.8);
  var musVol = clamp01(lsGet(MUS_V), 0.6);

  var ac, defs = {}, audioUIs = [], musicListeners = [];
  function ensureAC() {
    if (ac !== undefined) return;
    var AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
             (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
    ac = AC ? (function () { try { return new AC(); } catch (e) { return null; } })() : null;
  }
  function tone(f, d, type, g) {
    if (sfxMuted) return; ensureAC(); if (!ac) return;
    try {
      var o = ac.createOscillator(), v = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      v.gain.value = (g || 0.1) * sfxVol;
      v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(v); v.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }
  function noise(d, g) {
    if (sfxMuted) return; ensureAC(); if (!ac) return;
    try {
      var n = ac.createBufferSource(), b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d), ac.sampleRate);
      var dt = b.getChannelData(0);
      for (var i = 0; i < dt.length; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / dt.length);
      n.buffer = b;
      var v = ac.createGain(); v.gain.value = (g || 0.2) * sfxVol;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      n.connect(lp); lp.connect(v); v.connect(ac.destination); n.start();
    } catch (e) {}
  }
  function syncAudioUI() {
    for (var i = 0; i < audioUIs.length; i++) {
      var u = audioUIs[i];
      try {
        if (u.sfxBtn) u.sfxBtn.textContent = sfxMuted ? '🔇' : '🔊';
        if (u.sfxSlider) u.sfxSlider.value = Math.round(sfxVol * 100);
        if (u.musBtn) u.musBtn.textContent = musMuted ? '🔕' : '🎵';
        if (u.musSlider) u.musSlider.value = Math.round(musVol * 100);
        if (u.mainBtn) u.mainBtn.textContent = (sfxMuted && musMuted) ? '🔇' : '🔊';
      } catch (e) {}
    }
  }
  function notifyMusic() { var st = { muted: musMuted, volume: musVol, gain: musMuted ? 0 : musVol }; for (var i = 0; i < musicListeners.length; i++) { try { musicListeners[i](st); } catch (e) {} } }

  var sound = {
    tone: tone, noise: noise,
    define: function (map) { if (map) for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) defs[k] = map[k]; return sound; },
    play: function (name) {
      if (sfxMuted) return; ensureAC();
      if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
      var fn = defs[name]; if (fn) { try { fn({ tone: tone, noise: noise }); } catch (e) {} }
    },
    isMuted: function () { return sfxMuted; },
    setMuted: function (m) { sfxMuted = !!m; lsSet(SFX_M, sfxMuted ? '1' : '0'); syncAudioUI(); },
    toggle: function () { sfxMuted = !sfxMuted; lsSet(SFX_M, sfxMuted ? '1' : '0'); syncAudioUI(); return sfxMuted; },
    volume: function (v) { if (v === undefined) return sfxVol; sfxVol = clamp01(v, sfxVol); lsSet(SFX_V, String(sfxVol)); syncAudioUI(); },
  };
  // Music: kit owns the SETTINGS + UI; a game with music subscribes and applies gain()/muted to its own audio.
  var music = {
    isMuted: function () { return musMuted; },
    volume: function (v) { if (v === undefined) return musVol; musVol = clamp01(v, musVol); lsSet(MUS_V, String(musVol)); syncAudioUI(); notifyMusic(); },
    gain: function () { return musMuted ? 0 : musVol; },
    setMuted: function (m) { musMuted = !!m; lsSet(MUS_M, musMuted ? '1' : '0'); syncAudioUI(); notifyMusic(); },
    toggle: function () { musMuted = !musMuted; lsSet(MUS_M, musMuted ? '1' : '0'); syncAudioUI(); notifyMusic(); return musMuted; },
    subscribe: function (cb) { if (typeof cb === 'function') { musicListeners.push(cb); try { cb({ muted: musMuted, volume: musVol, gain: musMuted ? 0 : musVol }); } catch (e) {} } },
  };

  // ---------- in-page confirm dialog (replaces the browser confirm()) ----------
  function confirmDialog(msg, onYes) {
    if (typeof document === 'undefined' || !document.body) { if (onYes) onYes(); return; }
    var ov = document.createElement('div'); ov.className = 'gamekit-confirm';
    ov.innerHTML = '<div class="gamekit-confirm-box"><p>' + msg + '</p><div class="gamekit-confirm-btns">'
      + '<button class="gamekit-cf-no" type="button">Cancel</button>'
      + '<button class="gamekit-cf-yes" type="button">Reset</button></div></div>';
    document.body.appendChild(ov);
    var close = function () { try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} };
    var no = ov.querySelector ? ov.querySelector('.gamekit-cf-no') : null;
    var yes = ov.querySelector ? ov.querySelector('.gamekit-cf-yes') : null;
    if (no) no.addEventListener('click', close);
    if (yes) yes.addEventListener('click', function () { close(); if (onYes) onYes(); });
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
  }

  // ---------- reset scores (per-game; clears only keys starting with `prefix`) ----------
  function resetScores(prefix) {
    if (!prefix || typeof localStorage === 'undefined' || typeof localStorage.key !== 'function') return;
    try {
      var keys = [], i;
      for (i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(prefix) === 0) keys.push(k); }
      for (i = 0; i < keys.length; i++) { try { localStorage.removeItem(keys[i]); } catch (e) {} }
    } catch (e) {}
  }

  // ---------- player display name (optional; used for Discord score posts) ----------
  var NAME = 'gamekit_name';
  function player() { var n = lsGet(NAME); return (n && n.replace(/\s+/g, '')) ? n : 'anonymous'; }
  function setName(n) { n = (n == null ? '' : String(n)).replace(/\s+/g, ' ').trim().slice(0, 24); lsSet(NAME, n || 'anonymous'); return n || 'anonymous'; }

  // ---------- post a score to the public Komyo Games Discord (webhook, intentional/button only) ----------
  var DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1520515996933296378/YlXg2W8ypFcQGMHRf0BvWxp10-m7Z7DggStKrBZfusWo8e_emNF6gLpiVjfb0YIExL24';
  function postDiscord(text) {
    try {
      if (typeof fetch !== 'function' || typeof FormData === 'undefined') return;
      var fd = new FormData();
      // fixed username (no impersonation via override) + no pings (player name/text can't @everyone)
      fd.append('payload_json', JSON.stringify({ username: 'Komyo Games', content: String(text).slice(0, 1800), allowed_mentions: { parse: [] } }));
      fetch(DISCORD_WEBHOOK, { method: 'POST', body: fd })['catch'](function () {}); // multipart = no CORS preflight; fire-and-forget
    } catch (e) {}
  }

  // ---------- top-right sound menu (+ optional per-game "reset scores") ----------
  function audioMenu(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var wrap = document.createElement('div'); wrap.className = 'gamekit-audio';
    var rows = '<div class="gamekit-au-row"><button class="gamekit-au-toggle" id="gamekitSfxM" type="button" aria-label="Mute sound effects">🔊</button>'
      + '<input class="gamekit-au-slider" id="gamekitSfxV" type="range" min="0" max="100" aria-label="Sound effects volume"></div>';
    if (opts.music) rows += '<div class="gamekit-au-row"><button class="gamekit-au-toggle" id="gamekitMusM" type="button" aria-label="Mute music">🎵</button>'
      + '<input class="gamekit-au-slider" id="gamekitMusV" type="range" min="0" max="100" aria-label="Music volume"></div>';
    wrap.innerHTML = '<button class="gamekit-au-btn" id="gamekitAudioBtn" type="button" aria-label="Sound settings" title="Sound settings">🔊</button>'
      + '<div class="gamekit-au-panel" id="gamekitAudioPanel">' + rows + '</div>'
      + (opts.reset ? '<button class="gamekit-au-resetbtn" id="gamekitReset" type="button" aria-label="Reset scores" title="Reset scores">↺</button>' : '');
    document.body.appendChild(wrap);
    var btn = document.getElementById('gamekitAudioBtn'), panel = document.getElementById('gamekitAudioPanel');
    if (btn && panel) btn.addEventListener('click', function () { if (panel.classList) panel.classList.toggle('open'); });
    var u = { mainBtn: btn };
    u.sfxBtn = document.getElementById('gamekitSfxM'); u.sfxSlider = document.getElementById('gamekitSfxV');
    if (u.sfxBtn) u.sfxBtn.addEventListener('click', function () { sound.toggle(); });
    if (u.sfxSlider) u.sfxSlider.addEventListener('input', function (e) { var t = e && e.target; sound.volume(((t ? t.value : u.sfxSlider.value) || 0) / 100); });
    if (opts.music) {
      u.musBtn = document.getElementById('gamekitMusM'); u.musSlider = document.getElementById('gamekitMusV');
      if (u.musBtn) u.musBtn.addEventListener('click', function () { music.toggle(); });
      if (u.musSlider) u.musSlider.addEventListener('input', function (e) { var t = e && e.target; music.volume(((t ? t.value : u.musSlider.value) || 0) / 100); });
    }
    if (opts.reset) {
      var rb = document.getElementById('gamekitReset');
      if (rb) rb.addEventListener('click', function () {
        confirmDialog('Reset your saved scores for this game?', function () { resetScores(opts.reset); try { location.reload(); } catch (e) {} });
      });
    }
    audioUIs.push(u); syncAudioUI();
  }

  // ---------- top-left nav: ‹ Menu · Komyo Games › (+ injects the top-right sound menu) ----------
  function nav(opts) {
    opts = opts || {};
    if (typeof document !== 'undefined' && document.body) {
      var wrap = document.createElement('div'); wrap.className = 'gamekit-nav';
      wrap.innerHTML = '<button class="gamekit-back" id="gamekitMenu" type="button">&#x2039; Menu</button>'
        + '<a class="gamekit-back" id="gamekitHome" target="_top" href="' + (opts.home || '../../') + '">Komyo Games &#x203A;</a>';
      document.body.appendChild(wrap);
      var menu = document.getElementById('gamekitMenu');
      if (menu) menu.addEventListener('click', function () {
        if (typeof opts.onMenu === 'function') { try { opts.onMenu(); } catch (e) {} }
        else { try { location.reload(); } catch (e) {} }
      });
    }
    audioMenu({ music: !!opts.music, reset: opts.reset });
    // block the browser context menu on game canvases (no "save image…" popping mid-play)
    if (typeof document !== 'undefined' && document.querySelectorAll) {
      try {
        var cvs = document.querySelectorAll('canvas');
        for (var i = 0; i < cvs.length; i++) cvs[i].addEventListener('contextmenu', function (e) { if (e && e.preventDefault) e.preventDefault(); });
      } catch (e) {}
    }
  }

  // ---------- end-screen share row ----------
  var SVG = {
    native: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12c-.688 0-1.25.561-1.25 1.25 0 .687.562 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.71 1.39-.97 2.01a18.3 18.3 0 0 0-5.02 0 12.6 12.6 0 0 0-.98-2.01.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 8.02.943 11.58 1.51 15.09a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.349-1.225.645-1.873.892a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-4.06-.838-7.59-3.549-10.695a.06.06 0 0 0-.031-.028zM8.02 12.95c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z"/></svg>',
  };
  function enc(s) { return (typeof encodeURIComponent === 'function') ? encodeURIComponent(s) : String(s); }
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
    var url = o.url || ('https://komyo.online/games/' + (o.slug || '') + '/');
    var title = o.title || 'Komyo Games';
    var getMsg = (typeof o.message === 'function') ? o.message : function () { return o.message || ''; };
    if (el.classList) el.classList.add('gamekit-share');
    el.innerHTML =
      '<a class="sbtn" data-act="native" href="#" style="display:none" aria-label="Share" title="Share">' + SVG.native + '</a>' +
      '<a class="sbtn" data-act="x" target="_blank" rel="noopener" aria-label="Share on X" title="Share on X">' + SVG.x + '</a>' +
      '<a class="sbtn" data-act="reddit" target="_blank" rel="noopener" aria-label="Share on Reddit" title="Share on Reddit">' + SVG.reddit + '</a>' +
      '<button class="sbtn" data-act="copy" type="button" aria-label="Copy" title="Copy">' + SVG.copy + '</button>' +
      '<button class="sbtn" data-act="discord" type="button" aria-label="Post score to the Komyo Games Discord" title="Post your score to Discord">' + SVG.discord + '</button>';
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
    var discordBtn = q('[data-act="discord"]');
    if (discordBtn) discordBtn.addEventListener('click', function () {
      var who = (player() || 'anonymous').replace(/[@`]/g, '').slice(0, 24) || 'anonymous';
      postDiscord('**' + who + '** — ' + getMsg() + '\n' + url);
      try { discordBtn.disabled = true; } catch (e) {}      // one post per end-screen (don't let a click-spammer flood the channel)
      if (discordBtn.classList) discordBtn.classList.add('ok');
      discordBtn.title = 'Posted to Discord ✓';
    });
    if (native && typeof navigator !== 'undefined' && navigator.share) {
      if (native.style) native.style.display = '';
      native.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        try { navigator.share({ title: title, text: getMsg(), url: url }).catch(function () {}); } catch (_) {}
      });
    }
  }

  // ---------- PWA auto-update ----------
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

  var api = { sound: sound, music: music, nav: nav, audioMenu: audioMenu, resetScores: resetScores, confirm: confirmDialog, shareRow: shareRow, shareUrls: shareUrls, pwa: pwa, player: player, setName: setName, postDiscord: postDiscord };
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  g.gamekit = api;
  if (typeof window !== 'undefined') window.gamekit = api;
})();
