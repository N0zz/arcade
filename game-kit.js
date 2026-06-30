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
  // confirmDialog(msg, onYes[, yesLabel][, onCancel]) — yesLabel defaults to 'OK'; onCancel fires on
  // Cancel / overlay-click / Esc. Fully keyboard-steerable: ←/→ (or Tab) move between Cancel/Leave,
  // Enter/Space activate the focused button (default = Cancel, the safe choice), Esc cancels. It's a
  // MODAL — while open it owns the keyboard (_modalOpen gates the menu engine; events are stopped so
  // nothing behind it reacts).
  var _modalOpen = 0;
  function confirmDialog(msg, onYes, yesLabel, onCancel) {
    if (typeof document === 'undefined' || !document.body) { if (onYes) onYes(); return; }
    var ov = document.createElement('div'); ov.className = 'gamekit-confirm';
    ov.innerHTML = '<div class="gamekit-confirm-box"><p>' + msg + '</p><div class="gamekit-confirm-btns">'
      + '<button class="gamekit-cf-no" type="button">Cancel</button>'
      + '<button class="gamekit-cf-yes" type="button">' + (yesLabel || 'OK') + '</button></div></div>';
    document.body.appendChild(ov);
    var no = ov.querySelector ? ov.querySelector('.gamekit-cf-no') : null;
    var yes = ov.querySelector ? ov.querySelector('.gamekit-cf-yes') : null;
    var btns = [no, yes], fi = 0; // 0 = Cancel (default focus), 1 = yes/Leave
    function paint() { for (var i = 0; i < btns.length; i++) if (btns[i] && btns[i].classList) btns[i].classList.toggle('gkm-cf-focus', i === fi); }
    var done = false;
    function finish(cb) {
      if (done) return; done = true; _modalOpen = Math.max(0, _modalOpen - 1);
      try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
      try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
      if (cb) try { cb(); } catch (e) {}
    }
    function onKey(e) {
      if (!e || done) return;
      if (e.preventDefault) e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation(); else if (e.stopPropagation) e.stopPropagation();
      var k = e.key;
      if (k === 'Escape' || k === 'Esc') finish(onCancel);
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') finish(fi === 1 ? onYes : onCancel);
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'a' || k === 'A' || k === 'w' || k === 'W') { fi = 0; paint(); }
      else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'd' || k === 'D' || k === 's' || k === 'S' || k === 'Tab') { fi = (fi + 1) % 2; paint(); }
    }
    if (no) { no.addEventListener('click', function () { finish(onCancel); }); no.addEventListener('mouseenter', function () { fi = 0; paint(); }); }
    if (yes) { yes.addEventListener('click', function () { finish(onYes); }); yes.addEventListener('mouseenter', function () { fi = 1; paint(); }); }
    ov.addEventListener('click', function (e) { if (e && e.target === ov) finish(onCancel); });
    paint();
    _modalOpen++;
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
  }

  // ---------- embed modal (iframe snippet) — used by the per-game nav button + catalogue menu ----------
  function embedSnippet(slug, title) {
    var t = String(title || 'Komyo Games').replace(/"/g, '&quot;');
    // slug '' (or falsy) → embed the whole arcade catalogue; otherwise a single game
    var src = slug ? ('https://komyo.online/games/' + slug + '/') : 'https://komyo.online/';
    return '<iframe src="' + src + '" width="480" height="720" loading="lazy" style="max-width:100%;border:0;border-radius:12px" title="' + t + ' — Komyo Games"></iframe>';
  }
  // opts: { slug, title } for one game, OR { games: [{slug,title}, …] } for a picker.
  function embedModal(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var games = opts.games || (opts.slug ? [{ slug: opts.slug, title: opts.title || (typeof document !== 'undefined' && document.title) || opts.slug }] : []);
    if (!games.length) return;
    var ov = document.createElement('div'); ov.className = 'gamekit-embed';
    var picker = games.length > 1 ? '<select class="gamekit-embed-sel" aria-label="Pick a game">' + games.map(function (g, i) { return '<option value="' + i + '">' + (g.title || g.slug) + '</option>'; }).join('') + '</select>' : '';
    ov.innerHTML = '<div class="gamekit-embed-box"><button class="gamekit-embed-x" type="button" aria-label="Close">✕</button>'
      + '<h3>Embed ' + (games.length > 1 ? 'a game' : 'this game') + '</h3>'
      + '<p>Paste this where you want the game on your site or blog — it runs right there, free, no account, no ads.</p>'
      + picker
      + '<textarea class="gamekit-embed-code" readonly rows="4"></textarea>'
      + '<button class="gamekit-embed-copy" type="button">Copy code</button></div>';
    document.body.appendChild(ov);
    _modalOpen++; // open overlay → halts the game underneath
    var sel = ov.querySelector ? ov.querySelector('.gamekit-embed-sel') : null;
    var code = ov.querySelector ? ov.querySelector('.gamekit-embed-code') : null;
    var copy = ov.querySelector ? ov.querySelector('.gamekit-embed-copy') : null;
    var setCode = function () { var g = games[(sel ? (sel.value | 0) : 0)] || games[0]; if (code) code.value = embedSnippet(g.slug, g.title); };
    setCode();
    if (sel) sel.addEventListener('change', setCode);
    var closed = false;
    var close = function () { if (closed) return; closed = true; _modalOpen = Math.max(0, _modalOpen - 1); try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} };
    var xb = ov.querySelector ? ov.querySelector('.gamekit-embed-x') : null; if (xb) xb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (copy) copy.addEventListener('click', function () {
      try {
        if (code && code.select) code.select();
        if (navigator.clipboard) navigator.clipboard.writeText(code ? code.value : '').then(function () { copy.textContent = 'Copied!'; setTimeout(function () { copy.textContent = 'Copy code'; }, 1500); })['catch'](function () {});
      } catch (e) {}
    });
  }

  // ---------- controls board (top-bar 🎮 button → modal) ----------
  // controlsModal(cfg[, theme]): cfg.title?, cfg.note?, and rows in cfg.keyboard / cfg.touch — each row is
  // [keys, action]. Renders a per-section list; scrolls for games with lots of controls. Modal (gates the
  // menu engine + Esc-closes). Available on the menu AND mid-play, so it's the in-game reference too.
  function controlsModal(cfg, theme) {
    cfg = cfg || {};
    if (typeof document === 'undefined' || !document.body) return;
    var sec = function (label, rows) {
      if (!rows || !rows.length) return '';
      return '<div class="gkctl-sec">' + label + '</div>' + rows.map(function (r) {
        return '<div class="gkctl-row"><span class="gkctl-keys">' + r[0] + '</span><span class="gkctl-act">' + r[1] + '</span></div>';
      }).join('');
    };
    var ov = document.createElement('div'); ov.className = 'gamekit-controls';
    ov.innerHTML = '<div class="gkctl-box"><button class="gkctl-x" type="button" aria-label="Close">&#x2715;</button>'
      + '<h3>' + (cfg.title || 'Controls') + '</h3>'
      + sec('⌨️ Keyboard', cfg.keyboard) + sec('🖱️ Mouse', cfg.mouse) + sec('👆 Touch', cfg.touch)
      + (cfg.note ? '<p class="gkctl-note">' + cfg.note + '</p>' : '') + '</div>';
    if (theme) applyMenuTheme(ov, theme);
    document.body.appendChild(ov);
    _modalOpen++; // counts as an open overlay → isPaused() halts the game underneath
    var done = false;
    function close() { if (done) return; done = true; _modalOpen = Math.max(0, _modalOpen - 1); try { document.removeEventListener('keydown', onKey, true); } catch (e) {} try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} }
    function onKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); } }
    var x = ov.querySelector ? ov.querySelector('.gkctl-x') : null; if (x) x.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e && e.target === ov) close(); });
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', onKey, true);
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
  function postDiscord(text, url) {
    try {
      if (typeof fetch !== 'function' || typeof FormData === 'undefined') return;
      var fd = new FormData();
      // fixed username (no impersonation via override) + no pings (player name/text can't @everyone)
      // play link as a masked markdown link in the message text (webhook content renders these) →
      // a tidy "▶ Play this game on Komyo" instead of a raw ?query URL, and no embed box.
      var content = String(text);
      if (url) content += '\n[▶ Play this game on Komyo](' + String(url) + ')';
      var payload = { username: 'Komyo Games', content: content.slice(0, 1800), allowed_mentions: { parse: [] } };
      fd.append('payload_json', JSON.stringify(payload));
      fetch(DISCORD_WEBHOOK, { method: 'POST', body: fd })['catch'](function () {}); // multipart = no CORS preflight; fire-and-forget
    } catch (e) {}
  }

  // ---------- per-game results + per-day activity log (powers challenges + score cards) ----------
  function nowMs() { try { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; } catch (e) { return 0; } }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function utcDateStr(ms) { try { var d = (ms != null) ? new Date(ms) : new Date(); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); } catch (e) { return '1970-01-01'; } }
  // whole UTC days since epoch — the stable, timezone-independent key for "same challenge for everyone".
  function utcDayNumber(ms) { try { var d = (ms != null) ? new Date(ms) : new Date(); return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000); } catch (e) { return 0; } }
  function emptyLog() { return { slugs: [], totalScore: 0, count: 0 }; }
  function pruneOldLogs() {
    if (typeof localStorage === 'undefined' || typeof localStorage.key !== 'function') return;
    try {
      var today = utcDayNumber(), kill = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var pfx = (k && k.indexOf('gamekit_played_') === 0) ? 'gamekit_played_' : (k && k.indexOf('gamekit_daybest_') === 0) ? 'gamekit_daybest_' : null;
        if (pfx) {
          var n = utcDayNumber(Date.parse(k.slice(pfx.length) + 'T00:00:00Z'));
          if (today - n > 8) kill.push(k); // keep ~a week of activity + per-day bests
        }
      }
      for (var j = 0; j < kill.length; j++) { try { localStorage.removeItem(kill[j]); } catch (e) {} }
    } catch (e) {}
  }
  // recordResult(slug, {mode, score, time, stats}) — called by each game on game-over. Stores the
  // latest result + appends to today's UTC activity log (for cross-game "play N games" challenges).
  function recordResult(slug, data) {
    if (!slug) return null;
    data = data || {};
    var rec = { mode: (data.mode != null ? String(data.mode) : ''), score: (+data.score || 0), time: (+data.time || 0), stats: (data.stats || {}), ts: nowMs() };
    lsSet('gamekit_result_' + slug, JSON.stringify(rec));
    try {
      var key = 'gamekit_played_' + utcDateStr();
      var log = JSON.parse(lsGet(key) || 'null') || emptyLog();
      if (log.slugs.indexOf(slug) < 0) log.slugs.push(slug);
      log.totalScore += rec.score; log.count += 1;
      lsSet(key, JSON.stringify(log));
      // per-day BEST per slug (max of each numeric metric) — lets the catalogue detect a daily-challenge
      // completion for the day it happened, even if you never reopened the catalogue that day or later
      // replayed with a lower score. (No daily goal uses 'time' as a ≥-target, so max is fine here.)
      var bkey = 'gamekit_daybest_' + utcDateStr();
      var best = JSON.parse(lsGet(bkey) || 'null') || {};
      var cur = best[slug] || { score: 0, time: 0, stats: {} };
      if (rec.score > (cur.score || 0)) cur.score = rec.score;
      if (rec.time > (cur.time || 0)) cur.time = rec.time;
      cur.stats = cur.stats || {};
      for (var sk in rec.stats) { if (Object.prototype.hasOwnProperty.call(rec.stats, sk)) { var sv = +rec.stats[sk] || 0; if (sv > (cur.stats[sk] || 0)) cur.stats[sk] = sv; } }
      best[slug] = cur;
      lsSet(bkey, JSON.stringify(best));
      pruneOldLogs();
    } catch (e) {}
    return rec;
  }
  function lastResult(slug) { try { return JSON.parse(lsGet('gamekit_result_' + slug) || 'null'); } catch (e) { return null; } }
  function playedToday() { try { return JSON.parse(lsGet('gamekit_played_' + utcDateStr()) || 'null') || emptyLog(); } catch (e) { return emptyLog(); } }

  // ---------- universal pause (button in the top-right cluster + overlay; games skip update when isPaused) ----------
  var _paused = false, _pauseOv = null, _pauseBtns = [];
  function pauseOverlay() {
    if (_pauseOv) return _pauseOv;
    if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
    var ov = document.createElement('div'); ov.className = 'gamekit-pause';
    ov.innerHTML = '<div class="gamekit-pause-box"><div class="gamekit-pause-ico">⏸</div><div>Paused</div><button class="gamekit-pause-resume" type="button">Resume</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var t = e && e.target;
      if (t === ov || (t && t.closest && t.closest('.gamekit-pause-resume'))) setPaused(false);
    });
    _pauseOv = ov; return ov;
  }
  function syncPauseUI() {
    var ov = _paused ? pauseOverlay() : _pauseOv;
    if (ov && ov.classList) ov.classList.toggle('show', _paused);
    for (var i = 0; i < _pauseBtns.length; i++) { try { _pauseBtns[i].textContent = _paused ? '▶' : '⏸'; _pauseBtns[i].setAttribute('aria-pressed', _paused ? 'true' : 'false'); _pauseBtns[i].title = _paused ? 'Resume' : 'Pause'; } catch (e) {} }
  }
  function setPaused(p) { _paused = !!p; syncPauseUI(); }
  function togglePause() { setPaused(!_paused); }
  // quiet pause: freezes the game loop (isPaused → true) WITHOUT showing the universal pause overlay.
  // Used while a leave-confirm is up so the game stops underneath but no second pause UI appears.
  var _frozen = false;
  function freeze(on) { _frozen = !!on; }
  // paused when: the game set it, a quiet freeze is on, OR any kit overlay is open (confirm / controls /
  // embed / sound panel) — so opening any top-bar control halts the game underneath until it's closed.
  function isPaused() { return _paused || _frozen || _modalOpen > 0; }

  // ---------- top-right sound menu (+ optional per-game "reset scores") ----------
  function audioMenu(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return;
    var wrap = document.createElement('div'); wrap.className = 'gamekit-audio';
    var rows = '<div class="gamekit-au-row"><button class="gamekit-au-toggle" id="gamekitSfxM" type="button" aria-label="Mute sound effects">🔊</button>'
      + '<input class="gamekit-au-slider" id="gamekitSfxV" type="range" min="0" max="100" aria-label="Sound effects volume"></div>';
    if (opts.music) rows += '<div class="gamekit-au-row"><button class="gamekit-au-toggle" id="gamekitMusM" type="button" aria-label="Mute music">🎵</button>'
      + '<input class="gamekit-au-slider" id="gamekitMusV" type="range" min="0" max="100" aria-label="Music volume"></div>';
    wrap.innerHTML = '<button class="gamekit-au-btn gamekit-au-pausebtn" id="gamekitPause" type="button" aria-pressed="false" aria-label="Pause" title="Pause">⏸</button>'
      + '<button class="gamekit-au-btn" id="gamekitAudioBtn" type="button" aria-label="Sound settings" title="Sound settings">🔊</button>'
      + '<div class="gamekit-au-panel" id="gamekitAudioPanel">' + rows + '</div>'
      + (opts.controls ? '<button class="gamekit-au-btn gamekit-au-ctlbtn" id="gamekitControls" type="button" aria-label="Controls" title="How to play — controls">🎮</button>' : '')
      + '<button class="gamekit-au-btn gamekit-au-embedbtn" id="gamekitEmbed" type="button" aria-label="Embed this game" title="Embed this game on your website or blog">&#x29C9;</button>'
      + (opts.reset ? '<button class="gamekit-au-resetbtn" id="gamekitReset" type="button" aria-label="Reset this game’s scores" title="Reset this game’s saved scores">↺</button>' : '');
    document.body.appendChild(wrap);
    _audioEl = wrap;
    var btn = document.getElementById('gamekitAudioBtn'), panel = document.getElementById('gamekitAudioPanel');
    // open/close the sound panel idempotently; an open panel counts as an overlay (halts the game)
    var panelOpen = false;
    function setPanel(open) { if (!panel || !panel.classList) return; open = !!open; if (open === panelOpen) return; panelOpen = open; panel.classList.toggle('open', open); _modalOpen += open ? 1 : -1; }
    if (btn && panel) btn.addEventListener('click', function () { setPanel(!panelOpen); });
    // click anywhere outside the sound menu closes the open panel
    if (panel && typeof document.addEventListener === 'function') document.addEventListener('click', function (e) {
      if (!panelOpen) return;
      var t = e && e.target;
      if (t === btn || (t && t.closest && (t.closest('#gamekitAudioBtn') || t.closest('#gamekitAudioPanel')))) return;
      setPanel(false);
    });
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
        confirmDialog('Reset your saved scores for this game?', function () { resetScores(opts.reset); try { location.reload(); } catch (e) {} }, 'Reset');
      });
    }
    var eb = document.getElementById('gamekitEmbed');
    if (eb) eb.addEventListener('click', function () {
      var m = ((typeof location !== 'undefined' && location.pathname) ? location.pathname : '').match(/games\/([^\/?#]+)/);
      embedModal({ slug: m ? m[1] : '', title: (typeof document !== 'undefined' ? document.title : '') });
    });
    if (opts.controls) { var ctlb = document.getElementById('gamekitControls'); if (ctlb) ctlb.addEventListener('click', function () { controlsModal(opts.controls, opts.theme); }); }
    var pb = document.getElementById('gamekitPause'); _pauseBtnEl = pb;
    if (pb) {
      // a game with its own (menu-based) pause passes onPause → the ⏸ button drives THAT, so there's a
      // single pause UI; otherwise the button toggles the kit's universal pause overlay.
      if (typeof opts.onPause === 'function') pb.addEventListener('click', function () { try { opts.onPause(); } catch (e) {} });
      else { _pauseBtns.push(pb); pb.addEventListener('click', togglePause); }
    }
    syncPauseUI();
    audioUIs.push(u); syncAudioUI();
  }

  // ---------- top-left nav: ‹ Menu · Komyo Games › (+ injects the top-right sound menu) ----------
  // The ‹ Menu button (go to the game's own menu) is only meaningful DURING play — on the game's menu
  // it confuses people who expect it to go back to the site (that's the "Komyo Games ›" link). Games
  // call showMenuButton(true) when play starts and (false) on their menu screen.
  var _menuBtn = null, _navEl = null, _audioEl = null, _pauseBtnEl = null;
  function showMenuButton(show) { if (_menuBtn && _menuBtn.style) _menuBtn.style.display = show ? '' : 'none'; }
  function showPauseButton(show) { if (_pauseBtnEl && _pauseBtnEl.style) _pauseBtnEl.style.display = show ? '' : 'none'; }
  // Collapse the "Komyo ›" label to just "›" ONLY when the left nav would actually overlap the
  // right sound/pause cluster — measured, not a hardcoded breakpoint (so portrait phones with room
  // keep the full label).
  function fitNav() {
    if (!_navEl || !_audioEl || !_navEl.classList || !_navEl.getBoundingClientRect) return;
    _navEl.classList.remove('gamekit-nav-tight'); // measure at full width first
    try {
      var nr = _navEl.getBoundingClientRect(), ar = _audioEl.getBoundingClientRect();
      if (nr.right + 12 > ar.left) _navEl.classList.add('gamekit-nav-tight');
    } catch (e) {}
  }
  // bottom-left build stamp (the short commit SHA from version.js) — tiny, 50% opacity, no link,
  // there only so it's legible in a screenshot. Hidden on local/dev (no real SHA).
  function versionTag() {
    try {
      if (typeof document === 'undefined' || !document.body || !document.createElement) return;
      var v = (typeof window !== 'undefined') ? window.KOMYO_VERSION : null;
      if (!v || !v.sha || v.sha === 'dev') return;
      var el = document.getElementById('gamekitVersion');
      if (!el) { el = document.createElement('div'); el.id = 'gamekitVersion'; document.body.appendChild(el); }
      el.textContent = v.sha;
    } catch (e) {}
  }

  function nav(opts) {
    opts = opts || {};
    if (typeof document !== 'undefined' && document.body) {
      var wrap = document.createElement('div'); wrap.className = 'gamekit-nav';
      wrap.innerHTML = '<button class="gamekit-back" id="gamekitMenu" type="button">&#x2039; Menu</button>'
        + '<a class="gamekit-back" id="gamekitHome" target="_top" href="' + (opts.home || '../../') + '"><span class="gamekit-home-label">Komyo </span>&#x203A;</a>';
      document.body.appendChild(wrap);
      _navEl = wrap;
      var menu = document.getElementById('gamekitMenu');
      _menuBtn = menu || null;
      // confirmLeave: true | 'message' | function()->(message|false). Evaluated at click time, so a
      // game can return false on its start screen (no run to lose) and a message while mid-run. Pauses
      // the game while the confirm is up so you can't die mid-decision; Cancel resumes.
      var cl = opts.confirmLeave;
      var leaveMsg = function () {
        if (!cl) return false;
        if (typeof cl === 'function') { try { return cl(); } catch (e) { return false; } }
        return cl === true ? "Leave this run? You'll lose your progress." : cl;
      };
      var guarded = function (doLeave) {
        var msg = leaveMsg();
        // confirmDialog opens an overlay (isPaused → game halts under it); cancel resumes automatically
        if (msg) confirmDialog(msg, doLeave, 'Leave', null);
        else doLeave();
      };
      if (menu) menu.addEventListener('click', function () {
        guarded(function () {
          if (typeof opts.onMenu === 'function') { try { opts.onMenu(); } catch (e) {} }
          else { try { location.reload(); } catch (e) {} }
        });
      });
      var homeA = document.getElementById('gamekitHome');
      if (homeA) homeA.addEventListener('click', function (e) {
        if (!leaveMsg()) return; // no run → let the link navigate normally
        if (e && e.preventDefault) e.preventDefault();
        var href = homeA.getAttribute('href');
        guarded(function () { try { (window.top || window).location.href = href; } catch (err) { try { location.href = href; } catch (e2) {} } });
      });
    }
    audioMenu({ music: !!opts.music, reset: opts.reset, onPause: opts.onPause, controls: opts.controls, theme: opts.theme });
    versionTag();
    if (typeof layout !== 'undefined' && layout && layout.on) layout.on(fitNav);
    fitNav();
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
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.71 1.39-.97 2.01a18.3 18.3 0 0 0-5.02 0 12.6 12.6 0 0 0-.98-2.01.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 8.02.943 11.58 1.51 15.09a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.349-1.225.645-1.873.892a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-4.06-.838-7.59-3.549-10.695a.06.06 0 0 0-.031-.028zM8.02 12.95c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z"/></svg>',
  };
  // build a consistent share sentence from structured parts (so every game reads the same):
  //   "{verb} {score} {unit} in {game} {emoji} — {mode}, {extra…}"
  function shareText(o) {
    o = o || {};
    var s = (o.verb || 'I scored') + ' ' + o.score + (o.unit ? ' ' + o.unit : '') + ' in ' + o.game + (o.emoji ? ' ' + o.emoji : '');
    var tail = [o.mode].concat(o.extra || []).filter(function (x) { return x != null && x !== ''; });
    if (tail.length) s += ' — ' + tail.join(', ');
    return s;
  }

  // read a deep-link query param (so a shared link can preselect a game mode)
  function param(k, d) {
    try { var v = (typeof location !== 'undefined') ? new URLSearchParams(location.search).get(k) : null; return (v == null) ? d : v; }
    catch (e) { return d; }
  }

  function enc(s) { return (typeof encodeURIComponent === 'function') ? encodeURIComponent(s) : String(s); }
  function shareUrls(url, message) {
    return {
      x: 'https://twitter.com/intent/tweet?text=' + enc(message) + '&url=' + enc(url),
      reddit: 'https://www.reddit.com/submit?url=' + enc(url) + '&title=' + enc(message),
      copy: message + '\n' + url,
    };
  }
  // ---------- score card (Level 2): a branded PNG the player shares ----------
  // Draws a 1200×630 card (brand bg + mascot + big score + game title + komyo.online) on an
  // offscreen canvas and resolves a PNG Blob. Mascot = the in-repo favicon.svg (placeholder until
  // real art); falls back to a 🦊 glyph if it can't load. Headless-safe → resolves null.
  function buildScoreCard(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      try {
        if (typeof document === 'undefined' || !document.createElement) return resolve(null);
        var c = document.createElement('canvas'); c.width = 1200; c.height = 630;
        var x = c.getContext && c.getContext('2d'); if (!x) return resolve(null);
        var W = 1200, H = 630, accent = opts.accent || '#9fe8ff';
        var who = opts.player || (typeof player === 'function' ? player() : 'anonymous');
        var rr = function (X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
        // base + diagonal sheen
        var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0f17'); g.addColorStop(1, '#121a28');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        // accent glow, top-right
        try { var rg = x.createRadialGradient(W - 200, 150, 40, W - 200, 150, 620); rg.addColorStop(0, accent); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.16; x.fillStyle = rg; x.fillRect(0, 0, W, H); x.globalAlpha = 1; } catch (e) {}
        // inner panel
        x.fillStyle = 'rgba(255,255,255,0.02)'; rr(36, 36, W - 72, H - 72, 28); x.fill();
        x.strokeStyle = accent; x.globalAlpha = 0.55; x.lineWidth = 2; rr(36, 36, W - 72, H - 72, 28); x.stroke(); x.globalAlpha = 1;
        // accent rail
        x.fillStyle = accent; rr(36, 36, 12, H - 72, 6); x.fill();
        x.textAlign = 'left';
        // wordmark + game title
        x.fillStyle = accent; x.font = '800 30px system-ui, sans-serif'; x.fillText('KOMYO GAMES', 92, 118);
        x.fillStyle = '#eef4fc'; x.font = '600 58px system-ui, sans-serif'; x.fillText(String(opts.title || 'Komyo Games'), 90, 210);
        // score label + big number
        x.fillStyle = '#8aa0ba'; x.font = '600 26px ui-monospace, monospace'; x.fillText('SCORE', 92, 290);
        x.fillStyle = accent; x.font = '800 190px system-ui, sans-serif';
        x.fillText(String(opts.scoreText != null ? opts.scoreText : (opts.score || 0)), 88, 470);
        // sub (mode/stats) + player + footer
        if (opts.sub) { x.fillStyle = '#9fb2c8'; x.font = '400 34px system-ui, sans-serif'; x.fillText(String(opts.sub), 92, 524); }
        x.fillStyle = '#cdd9e8'; x.font = '600 30px system-ui, sans-serif'; x.fillText('— ' + who, 92, opts.sub ? 566 : 540);
        x.textAlign = 'right'; x.fillStyle = '#7a8aa0'; x.font = '600 30px ui-monospace, monospace'; x.fillText('komyo.online', W - 92, 566); x.textAlign = 'left';
        var finish = function () { try { if (c.toBlob) c.toBlob(function (b) { resolve(b || null); }, 'image/png'); else resolve(null); } catch (e) { resolve(null); } };
        var drawMascot = function (img) { try { x.globalAlpha = 0.97; x.drawImage(img, W - 430, 120, 320, 320); x.globalAlpha = 1; } catch (e) {} finish(); };
        try {
          var im = new Image(); var done = false;
          im.onload = function () { if (done) return; done = true; drawMascot(im); };
          im.onerror = function () { if (done) return; done = true; try { x.textAlign = 'center'; x.font = '230px system-ui, sans-serif'; x.fillText('🦊', W - 270, 400); x.textAlign = 'left'; } catch (e) {} finish(); };
          im.src = opts.mascot || '../../favicon.svg';
        } catch (e) { finish(); }
      } catch (e) { resolve(null); }
    });
  }
  function downloadBlob(blob, name) {
    try {
      var u = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = u; a.download = name; (document.body || document.documentElement).appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); } catch (e) {} }, 1000);
    } catch (e) {}
  }
  // share the card: native file-share on mobile → copy-as-image → download. Returns nothing.
  function shareCardBlob(blob, opts) {
    if (!blob) return;
    opts = opts || {};
    var name = (opts.slug || 'komyo') + '-score.png';
    try {
      var file = (typeof File !== 'undefined') ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: opts.title || 'Komyo Games' })['catch'](function () {}); return;
      }
    } catch (e) {}
    try {
      if (typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {}, function () { downloadBlob(blob, name); }); return;
      }
    } catch (e) {}
    downloadBlob(blob, name);
  }

  function shareRow(el, o) {
    if (!el) return;
    o = o || {};
    var base = o.url || ('https://komyo.online/games/' + (o.slug || '') + '/');
    // optional o.params (object or fn) → appended as a query string so a shared link
    // deep-links back to the same mode (the game preselects it on load).
    function getUrl() {
      if (!o.params) return base;
      try {
        var p = (typeof o.params === 'function') ? o.params() : o.params;
        var qs = (typeof URLSearchParams !== 'undefined') ? new URLSearchParams(p || {}).toString() : '';
        return qs ? base.replace(/\/+$/, '') + '?' + qs : base; // drop trailing slash before query for a cleaner link
      } catch (e) { return base; }
    }
    var title = o.title || 'Komyo Games';
    var getMsg = (typeof o.message === 'function') ? o.message : function () { return o.message || ''; };
    if (el.classList) el.classList.add('gamekit-share');
    el.innerHTML =
      '<a class="sbtn" data-act="native" href="#" style="display:none" aria-label="Share" title="Share">' + SVG.native + '</a>' +
      '<a class="sbtn" data-act="x" target="_blank" rel="noopener" aria-label="Share on X" title="Share on X">' + SVG.x + '</a>' +
      '<a class="sbtn" data-act="reddit" target="_blank" rel="noopener" aria-label="Share on Reddit" title="Share on Reddit">' + SVG.reddit + '</a>' +
      '<button class="sbtn" data-act="copy" type="button" aria-label="Copy" title="Copy">' + SVG.copy + '</button>' +
      '<button class="sbtn" data-act="card" type="button" aria-label="Score card image" title="Score card image">' + SVG.card + '</button>';
    var q = function (sel) { try { return el.querySelector ? el.querySelector(sel) : null; } catch (e) { return null; } };
    var x = q('[data-act="x"]'), reddit = q('[data-act="reddit"]'), copy = q('[data-act="copy"]'), native = q('[data-act="native"]'), cardBtn = q('[data-act="card"]');
    var refresh = function () { var u = shareUrls(getUrl(), getMsg()); if (x) x.href = u.x; if (reddit) reddit.href = u.reddit; };
    if (x) x.addEventListener('click', refresh);
    if (reddit) reddit.addEventListener('click', refresh);
    refresh();
    if (copy) copy.addEventListener('click', function () {
      var u = shareUrls(getUrl(), getMsg());
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(u.copy).then(function () {
          if (copy.classList) copy.classList.add('ok');
          var prev = copy.title; copy.title = 'Copied!';
          setTimeout(function () { if (copy.classList) copy.classList.remove('ok'); copy.title = prev; }, 1500);
        }).catch(function () {});
      } catch (e) {}
    });
    // 📷 score card (Level 2): render a branded PNG and share/copy/download it. Score/mode come
    // from the game's last recorded result (recordResult), so no per-game wiring is needed; a game
    // may still pass o.card ({score, sub, accent, mascot} or a fn) to customise.
    if (cardBtn) cardBtn.addEventListener('click', function () {
      var lr = lastResult(o.slug) || {};
      var extra = (typeof o.card === 'function') ? (o.card() || {}) : (o.card || {});
      var score = (extra.score != null) ? extra.score : (lr.score || 0);
      var opts = {
        title: o.title || 'Komyo Games', slug: o.slug,
        accent: extra.accent || o.accent, mascot: extra.mascot || o.mascot,
        score: score, scoreText: (typeof score === 'number' && score.toLocaleString) ? score.toLocaleString() : String(score),
        sub: (extra.sub != null) ? extra.sub : (lr.mode || ''),
      };
      buildScoreCard(opts).then(function (b) { shareCardBlob(b, opts); });
    });
    // auto-post the score to the Komyo Games Discord when the end-screen share row is on-screen.
    // Handles BOTH patterns: built once at init (hidden → shown later) AND rebuilt at game-over
    // (already visible). Dedupe + 3s throttle; replaces any prior observer on this el.
    (function () {
      var lastMsg = '', lastAt = 0;
      var visible = function () { try { return !!(el.getClientRects && el.getClientRects().length); } catch (e) { return false; } };
      var maybePost = function () {
        if (!visible()) return;
        var msg = getMsg(), now = (typeof Date !== 'undefined' ? Date.now() : 0);
        if (!msg || msg === lastMsg || now - lastAt <= 3000) return;
        var who = (player() || 'anonymous').replace(/[@`]/g, '').slice(0, 24) || 'anonymous';
        postDiscord('**' + who + '** — ' + msg, getUrl());
        lastMsg = msg; lastAt = now;
      };
      if (typeof setTimeout === 'function') setTimeout(maybePost, 0);   // already-visible (built at game-over)
      if (typeof IntersectionObserver !== 'undefined') {               // hidden → shown later (built at init)
        try {
          if (el._gkIO) el._gkIO.disconnect();
          var io = new IntersectionObserver(function (es) { for (var k = 0; k < es.length; k++) if (es[k].isIntersecting) maybePost(); }, { threshold: 0.5 });
          el._gkIO = io; io.observe(el);
        } catch (e) {}
      }
    })();
    if (native && typeof navigator !== 'undefined' && navigator.share) {
      if (native.style) native.style.display = '';
      native.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        try { navigator.share({ title: title, text: getMsg(), url: getUrl() }).catch(function () {}); } catch (_) {}
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

  // ---------- layout: orientation + debounced relayout (resize / orientationchange / visualViewport) ----------
  // Games register a relayout callback with gamekit.layout.on(fn); the kit fires it (coalesced into
  // one rAF) on resize, orientationchange AND visualViewport changes — so rotation actually re-lays-
  // out (most games previously listened only for `resize`, which fires late/stale on rotate). It does
  // NOT fire on registration: every game already calls its own resize() at boot, so this is purely
  // additive. `hudTop()` is the one source for the center HUD headroom (clears nav + sound menu).
  var layoutCbs = [], layoutWired = false, layoutRaf = 0;
  function vw() { try { return (typeof window !== 'undefined' && window.innerWidth) || 0; } catch (e) { return 0; } }
  function vh() { try { return (typeof window !== 'undefined' && window.innerHeight) || 0; } catch (e) { return 0; } }
  function isPortrait() { return vh() > vw(); }
  function isNarrow() { var w = vw(); return isPortrait() || (w > 0 && w <= 560); }
  function layoutState() { return { w: vw(), h: vh(), portrait: isPortrait(), landscape: !isPortrait(), narrow: isNarrow(), hudTop: isNarrow() ? 92 : 48 }; }
  function fireLayout() { var st = layoutState(); for (var i = 0; i < layoutCbs.length; i++) { try { layoutCbs[i](st); } catch (e) {} } }
  function scheduleLayout() {
    if (typeof requestAnimationFrame === 'function') { if (layoutRaf) return; layoutRaf = requestAnimationFrame(function () { layoutRaf = 0; fireLayout(); }); }
    else fireLayout();
  }
  function wireLayout() {
    if (layoutWired || typeof window === 'undefined' || !window.addEventListener) return;
    layoutWired = true;
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);
    try { var vv = window.visualViewport; if (vv && vv.addEventListener) { vv.addEventListener('resize', scheduleLayout); vv.addEventListener('scroll', scheduleLayout); } } catch (e) {}
  }
  var layout = {
    get w() { return vw(); }, get h() { return vh(); },
    get portrait() { return isPortrait(); }, get landscape() { return !isPortrait(); }, get narrow() { return isNarrow(); },
    hudTop: function () { return isNarrow() ? 92 : 48; },
    state: layoutState,
    on: function (cb) { if (typeof cb === 'function') { layoutCbs.push(cb); wireLayout(); } return layout; },
    // Lock-and-inform: show a "rotate your phone" overlay when the orientation isn't what the game
    // needs (for the few games that can't do both). Returns true when the wanted orientation is met.
    requireOrientation: function (want) {
      if (!want || typeof document === 'undefined' || !document.body) return true;
      var ok = (want === 'portrait') ? isPortrait() : !isPortrait();
      var el = document.getElementById('gamekitRotate');
      if (!ok && !el && document.createElement) {
        el = document.createElement('div'); el.id = 'gamekitRotate'; el.className = 'gamekit-rotate';
        el.innerHTML = '<div class="gamekit-rotate-box"><div class="gamekit-rotate-ico">↻</div><div>Rotate your phone to play</div></div>';
        document.body.appendChild(el);
      }
      if (el && el.classList) el.classList.toggle('show', !ok);
      return ok;
    },
    // test hook: set mocked dims (guarded — innerWidth is read-only in real browsers) + relayout now.
    __emit: function (w, h) { try { if (typeof window !== 'undefined') { if (w != null) window.innerWidth = w; if (h != null) window.innerHeight = h; } } catch (e) {} fireLayout(); },
  };

  // Unlock/resume the AudioContext on the first user gesture — browsers block (and warn about)
  // audio that starts without one. After the first tap/key, sounds play cleanly.
  (function () {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    var unlock = function () {
      ensureAC();
      if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    };
    var evs = ['pointerdown', 'touchstart', 'keydown'];
    for (var i = 0; i < evs.length; i++) {
      try { document.addEventListener(evs[i], unlock, { once: true }); }
      catch (e) { try { document.addEventListener(evs[i], unlock); } catch (_) {} }
    }
  })();

  // ---------- shared menu engine (declarative overlays: start / pause / end) ----------
  // ONE structure + behaviour for every game's menus; the LOOK is fully per-game via CSS custom
  // properties (--gkm-accent / --gkm-bg / --gkm-glow / --gkm-shadow / --gkm-border / --gkm-text /
  // --gkm-overlay / --gkm-radius / --gkm-font). A game themes them in its own CSS, or passes a
  // `theme` object to menu.show() (short keys → those vars) for per-screen tweaks.
  var _menuEl = null, _menuKey = null, _menuHandle = null;
  function stampUrl(params) {
    try {
      if (typeof history === 'undefined' || !history.replaceState || typeof location === 'undefined') return;
      var qs = (typeof URLSearchParams !== 'undefined') ? new URLSearchParams(params || {}).toString() : '';
      history.replaceState(null, '', qs ? location.pathname + '?' + qs : location.pathname);
    } catch (e) {}
  }
  function menuHide() {
    if (_menuKey) { try { document.removeEventListener('keydown', _menuKey, true); } catch (e) {} _menuKey = null; }
    if (_menuEl) { try { if (_menuEl.parentNode) _menuEl.parentNode.removeChild(_menuEl); } catch (e) {} _menuEl = null; }
    _menuHandle = null;
  }
  function applyMenuTheme(el, theme) {
    if (!el || !el.style || !theme) return;
    for (var k in theme) {
      if (!Object.prototype.hasOwnProperty.call(theme, k)) continue;
      var v = theme[k]; if (v == null) continue;
      try { el.style.setProperty(k.indexOf('--') === 0 ? k : '--gkm-' + k, String(v)); } catch (e) {}
    }
  }
  function fmtScore(n) { return (typeof n === 'number' && n.toLocaleString) ? n.toLocaleString() : String(n); }
  function mkEl(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) { try { e.innerHTML = html; } catch (x) { e.textContent = String(html); } }
    return e;
  }
  function evalVal(v, st) { return (typeof v === 'function') ? v(st) : v; }
  function drawPreview(cv, fn, st) {
    if (!cv || !cv.getContext || typeof fn !== 'function') return;
    try { var g = cv.getContext('2d'); var w = cv.width || 0, h = cv.height || 0; if (g.clearRect) g.clearRect(0, 0, w, h); fn(g, w, h, st); } catch (e) {}
  }
  // menu.show(cfg): cfg.kind 'start'|'pause'|'end'; title; score/scoreText/best/newBest/lines:[…];
  //   groups:[{id,label,default,style?:'cards',choices:[…]}] — a plain group's choices are {id,label,desc?}
  //     buttons; a style:'cards' group's choices are rich cards {id,label,tag?,desc,mech,best,preview} where
  //     desc/mech/best may be a value OR a fn(state) (re-evaluated on every change), mech entries are a string
  //     or {label,hot}, and preview is fn(ctx,w,h,state) drawn into the card's canvas.
  //   toggles:[{id,label,caption?,default?}] — boolean checkboxes (rendered after the groups).
  //   hint(state)->string; share:{slug,title,message,…} (→ shareRow + Discord); record:{slug,mode,score,time,stats}
  //     (→ recordResult); actions:[{id,label,primary?,danger?,confirm?:msg|fn,confirmYes?}];
  //   onPlay(state); onAction(id,state); onChange(state) (fires on every selection/toggle change — e.g.
  //   to live-stamp the URL); onEsc; theme. `state` = selections merged with toggle booleans.
  // ONE structure + behaviour; the look is per-game via --gkm-* (theme object or the game's own CSS).
  // Built with createElement + direct refs (no querySelectorAll), so it drives the same headless + live.
  function menuShow(cfg) {
    cfg = cfg || {};
    var noop = function () {};
    if (typeof document === 'undefined' || !document.body || !document.createElement) return { hide: noop, el: null, selection: function () { return {}; }, select: noop, toggle: noop, activate: noop };
    menuHide();
    var kind = cfg.kind || 'start';
    var groups = cfg.groups || [];
    var toggles = cfg.toggles || [];
    var actions = cfg.actions || [];
    var hasCards = false;
    var sel = {}, tog = {};
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    groups.forEach(function (g2) { sel[g2.id] = (g2['default'] != null ? g2['default'] : (g2.choices && g2.choices[0] ? g2.choices[0].id : null)); if (g2.style === 'cards') hasCards = true; });
    toggles.forEach(function (t) { tog[t.id] = !!t['default']; });
    function state() { var o = {}, k; for (k in sel) if (has(sel, k)) o[k] = sel[k]; for (k in tog) if (has(tog, k)) o[k] = tog[k]; return o; }

    var ov = document.createElement('div'); ov.className = 'gamekit-menu gamekit-menu-' + kind + (hasCards ? ' gkm-wide' : '');
    var box = mkEl('div', 'gkm-box'); ov.appendChild(box);

    if (cfg.title != null) box.appendChild(mkEl('h1', 'gkm-title', cfg.title));
    var scroll = mkEl('div', 'gkm-scroll'); box.appendChild(scroll); // content scrolls; title + actions stay pinned
    if (cfg.score != null) {
      scroll.appendChild(mkEl('div', 'gkm-score', cfg.scoreText != null ? cfg.scoreText : fmtScore(cfg.score)));
      if (cfg.best != null) scroll.appendChild(mkEl('p', 'gkm-best', 'Best: ' + fmtScore(cfg.best) + (cfg.newBest ? ' <span class="gkm-new">★ New best!</span>' : '')));
    }

    var choiceRefs = [], dynamic = []; // dynamic[]: per-card updater(state), re-run on any change
    groups.forEach(function (g2) {
      if (g2.label != null) scroll.appendChild(mkEl('div', 'gkm-sec', g2.label));
      if (g2.style === 'cards') {
        var list = mkEl('div', 'gkm-cards');
        (g2.choices || []).forEach(function (c) {
          var card = mkEl('div', 'gkm-card');
          var pv = mkEl('canvas', 'gkm-card-pv'); try { pv.width = c.pvW || 120; pv.height = c.pvH || 120; } catch (e) {}
          var nm = mkEl('div', 'gkm-card-nm', c.label + (c.tag ? ' <span class="gkm-tag">' + c.tag + '</span>' : ''));
          var best = mkEl('div', 'gkm-card-best');
          var head = mkEl('div', 'gkm-card-head'); head.appendChild(nm); head.appendChild(best);
          var desc = mkEl('div', 'gkm-card-desc');
          var mech = mkEl('div', 'gkm-card-mech');
          var body = mkEl('div', 'gkm-card-body'); body.appendChild(head); body.appendChild(desc); body.appendChild(mech);
          card.appendChild(pv); card.appendChild(body);
          var ref = { el: card, kind: 'choice', grp: g2.id, choice: c.id };
          card.addEventListener('click', function () { selectChoice(ref); setFocusEl(card); });
          card.addEventListener('mouseenter', function () { setFocusEl(card); });
          choiceRefs.push(ref); list.appendChild(card);
          dynamic.push(function (st) {
            drawPreview(pv, c.preview, st);
            best.innerHTML = (c.best != null) ? ('<span class="l">BEST</span>' + fmtScore(evalVal(c.best, st))) : '';
            var chips = (typeof c.mech === 'function') ? c.mech(st) : (c.mech || []);
            mech.innerHTML = (chips || []).filter(function (x) { return x != null && x !== ''; }).map(function (x) {
              var s = (typeof x === 'object') ? x : { label: x };
              return '<span' + (s.hot ? ' class="hot"' : '') + '>' + s.label + '</span>';
            }).join('');
            desc.textContent = evalVal(c.desc, st) || '';
          });
        });
        scroll.appendChild(list);
      } else {
        var row = mkEl('div', 'gkm-row');
        (g2.choices || []).forEach(function (c) {
          var b = mkEl('button', 'gkm-choice', c.label + (c.desc ? '<span class="gkm-desc">' + c.desc + '</span>' : ''));
          try { b.type = 'button'; } catch (e) {}
          var ref = { el: b, kind: 'choice', grp: g2.id, choice: c.id };
          b.addEventListener('click', function () { selectChoice(ref); setFocusEl(b); });
          b.addEventListener('mouseenter', function () { setFocusEl(b); });
          choiceRefs.push(ref); row.appendChild(b);
        });
        scroll.appendChild(row);
      }
    });

    var toggleRefs = [];
    toggles.forEach(function (t) {
      var rowT = mkEl('div', 'gkm-checkrow');
      var lab = mkEl('label', 'gkm-check');
      lab.appendChild(mkEl('span', 'gkm-check-box'));
      lab.appendChild(mkEl('span', 'gkm-check-txt', t.label + (t.caption ? ' <span class="cap">' + t.caption + '</span>' : '')));
      rowT.appendChild(lab); scroll.appendChild(rowT);
      var ref = { el: lab, kind: 'toggle', id: t.id };
      lab.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); toggleOne(ref); setFocusEl(lab); });
      lab.addEventListener('mouseenter', function () { setFocusEl(lab); });
      toggleRefs.push(ref);
    });

    (cfg.lines || []).forEach(function (ln) { scroll.appendChild(mkEl('p', 'gkm-line', ln)); });
    var hintEl = cfg.hint ? mkEl('p', 'gkm-hint') : null; if (hintEl) scroll.appendChild(hintEl);
    var shareHost = cfg.share ? mkEl('div', 'gkm-share-host') : null; if (shareHost) scroll.appendChild(shareHost);
    var actionRefs = [];
    if (actions.length) {
      var arow = mkEl('div', 'gkm-actions');
      actions.forEach(function (a) {
        var b = mkEl('button', 'gkm-action' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), a.label);
        try { b.type = 'button'; } catch (e) {}
        var ref = { el: b, kind: 'action', action: a };
        b.addEventListener('click', function () { setFocusEl(b); fireAction(a); });
        b.addEventListener('mouseenter', function () { setFocusEl(b); });
        actionRefs.push(ref); arow.appendChild(b);
      });
      box.appendChild(arow);
    }

    applyMenuTheme(ov, cfg.theme);
    document.body.appendChild(ov);
    _menuEl = ov;
    if (cfg.record) { try { recordResult(cfg.record.slug || (cfg.share && cfg.share.slug), cfg.record); } catch (e) {} }
    if (shareHost) { try { shareRow(shareHost, cfg.share); } catch (e) {} }

    var focusables = choiceRefs.concat(toggleRefs).concat(actionRefs);
    var fi = 0;
    function setFocus(i) { if (!focusables.length) return; fi = (i % focusables.length + focusables.length) % focusables.length; for (var k = 0; k < focusables.length; k++) { if (focusables[k].el.classList) focusables[k].el.classList.toggle('gkm-focus', k === fi); } }
    function setFocusEl(el) { for (var k = 0; k < focusables.length; k++) if (focusables[k].el === el) { setFocus(k); return; } }
    function paintChoices() { for (var k = 0; k < choiceRefs.length; k++) { var r = choiceRefs[k]; if (r.el.classList) r.el.classList.toggle('gkm-on', sel[r.grp] === r.choice); } }
    function paintToggles() { for (var k = 0; k < toggleRefs.length; k++) { var r = toggleRefs[k]; if (r.el.classList) r.el.classList.toggle('gkm-on', !!tog[r.id]); } }
    function renderDynamic() { var st = state(); for (var k = 0; k < dynamic.length; k++) try { dynamic[k](st); } catch (e) {} }
    function renderHint() { if (hintEl) { try { hintEl.textContent = cfg.hint(state()); } catch (e) {} } }
    function refresh() { paintChoices(); paintToggles(); renderDynamic(); renderHint(); }
    function changed() { refresh(); if (typeof cfg.onChange === 'function') { try { cfg.onChange(state()); } catch (e) {} } }
    function selectChoice(ref) { sel[ref.grp] = ref.choice; changed(); }
    function toggleOne(ref) { tog[ref.id] = !tog[ref.id]; changed(); }
    function fireAction(a) {
      var go = function () { if (a.id === 'play' && typeof cfg.onPlay === 'function') cfg.onPlay(state()); else if (typeof cfg.onAction === 'function') cfg.onAction(a.id, state()); };
      var cm = a.confirm ? (typeof a.confirm === 'function' ? a.confirm() : a.confirm) : null;
      if (cm) confirmDialog(cm, go, a.confirmYes || 'Leave', null); else go();
    }
    function activate(ref) { if (!ref) return; if (ref.kind === 'choice') selectChoice(ref); else if (ref.kind === 'toggle') toggleOne(ref); else fireAction(ref.action); }
    function stop(ev) { if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); }

    refresh();
    var primIdx = 0; for (var p = 0; p < actionRefs.length; p++) { if (actionRefs[p].action.primary) { primIdx = choiceRefs.length + toggleRefs.length + p; break; } }
    setFocus(primIdx);

    var keyFn = function (e) {
      if (_menuKey !== keyFn || !_menuEl || !e || _modalOpen) return; // stale, or a confirm owns the keyboard
      var k = e.key;
      if (k === 'a' || k === 'A') k = 'ArrowLeft'; else if (k === 'd' || k === 'D') k = 'ArrowRight';
      else if (k === 'w' || k === 'W') k = 'ArrowUp'; else if (k === 's' || k === 'S') k = 'ArrowDown';
      if (k === 'ArrowLeft' || k === 'ArrowUp') { stop(e); setFocus(fi - 1); }
      else if (k === 'ArrowRight' || k === 'ArrowDown') { stop(e); setFocus(fi + 1); }
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') { stop(e); activate(focusables[fi]); }
      else if ((k === 'Escape' || k === 'Esc') && typeof cfg.onEsc === 'function') { stop(e); cfg.onEsc(); }
    };
    _menuKey = keyFn;
    if (typeof document.addEventListener === 'function') document.addEventListener('keydown', keyFn, true);

    var handle = {
      hide: menuHide, el: ov, selection: state, focus: setFocus,
      // programmatic affordances (used by the headless harness + available to games):
      select: function (grp, choice) { for (var k = 0; k < choiceRefs.length; k++) if (choiceRefs[k].grp === grp && choiceRefs[k].choice === choice) { selectChoice(choiceRefs[k]); return true; } return false; },
      toggle: function (id, on) { for (var k = 0; k < toggleRefs.length; k++) if (toggleRefs[k].id === id) { tog[id] = (on == null ? !tog[id] : !!on); refresh(); return true; } return false; },
      activate: function (actionId) { for (var k = 0; k < actionRefs.length; k++) if (actionRefs[k].action.id === actionId) { fireAction(actionRefs[k].action); return true; } return false; },
      focusedId: function () { var f = focusables[fi]; return f ? (f.kind === 'action' ? f.action.id : f.kind === 'toggle' ? f.id : f.choice) : null; },
    };
    _menuHandle = handle;
    return handle;
  }
  var menu = { show: menuShow, hide: menuHide, current: function () { return _menuHandle; } };

  var api = { sound: sound, music: music, nav: nav, audioMenu: audioMenu, resetScores: resetScores, confirm: confirmDialog, menu: menu, stampUrl: stampUrl, shareRow: shareRow, shareUrls: shareUrls, shareText: shareText, param: param, pwa: pwa, player: player, setName: setName, postDiscord: postDiscord, layout: layout, recordResult: recordResult, lastResult: lastResult, playedToday: playedToday, utcDateStr: utcDateStr, utcDayNumber: utcDayNumber, scoreCard: buildScoreCard, embedModal: embedModal, isPaused: isPaused, setPaused: setPaused, togglePause: togglePause, showMenuButton: showMenuButton, showPauseButton: showPauseButton, controls: controlsModal, versionTag: versionTag };
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  g.gamekit = api;
  if (typeof window !== 'undefined') window.gamekit = api;
})();
