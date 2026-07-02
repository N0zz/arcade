// Headless tests for the arcade: catalogue wiring + Tower Defense logic + every live game's
// boot + the shared game-kit — all through the shared harness (test-harness.mjs).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { bootGame, makeSandbox, ok, section, summary, KIT, ROOT } from './test-harness.mjs';

const DIR = ROOT;

// ---------------- Catalogue ----------------
function testCatalogue() {
  section('index.html (catalogue)');
  const games = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const challenges = fs.readFileSync(path.join(DIR, 'challenges.js'), 'utf8');
  const g = bootGame('index.html', { preCode: [games, challenges] });
  ok(g.bootErr === null, 'catalogue boots: ' + g.bootErr);
  ok(typeof g.win.__renderChallenges === 'function', 'challenges panel render is wired');
  let cerr = null; try { g.win.__renderChallenges(); } catch (e) { cerr = e.message; }
  ok(cerr === null, 'rendering challenges does not throw: ' + cerr);
  const eb = g.getEl('embedBtn'); let ebErr = null; try { eb.fire('click'); } catch (e) { ebErr = e.message; }
  ok(ebErr === null, 'Embed-a-game menu opens without throwing: ' + ebErr);
  // Settings → Version row: update button wired to gamekit.updates, greyed when current, headless-safe
  ok(g.getEl('setVersion').textContent === 'dev', 'Settings shows the running version (dev locally, got "' + g.getEl('setVersion').textContent + '")');
  ok(String(g.getEl('setUpdate').textContent).indexOf('Up to date') >= 0 && g.getEl('setUpdate').disabled === true,
    'Settings update button is greyed "✓ Up to date" when no update is known (got "' + g.getEl('setUpdate').textContent + '")');
  let drErr = null; try { g.getEl('setUpdate').fire('click'); } catch (e) { drErr = e.message; }
  ok(drErr === null, 'Settings update button runs headless without throwing: ' + drErr);
  // density toggle: cozy ⇄ compact
  const db = g.getEl('densityBtn'); db.fire('click');
  ok(g.getEl('grid').classList.contains('compact'), 'density toggle → compact');
  db.fire('click');
  ok(!g.getEl('grid').classList.contains('compact'), 'density toggle → back to cozy');
  const GAMES = g.win.GAMES;
  ok(Array.isArray(GAMES) && GAMES.length >= 2, 'games.js exposes games (got ' + (GAMES && GAMES.length) + ')');
  const grid = g.getEl('grid');
  // #grid now also holds full-width section dividers, so count only the tiles.
  const tiles = () => grid.children.filter(c => c.className && String(c.className).includes('tile'));
  ok(tiles().length === GAMES.length, 'one tile per game (got ' + tiles().length + ')');
  ok(tiles()[0] && tiles()[0].href === 'games/' + GAMES[0].slug + '/', 'first tile links to games/<slug>/ (got ' + (tiles()[0] && tiles()[0].href) + ')');
  // favorites: starring the 2nd playable game sorts it to the top of its section
  const star = tiles()[1] && tiles()[1].children[0]; // 2nd tile's ★ button
  ok(star, 'playable tile has a favorite star');
  if (star) {
    star.fire('click');
    ok(tiles()[0].href === 'games/' + GAMES[1].slug + '/', 'favoriting sorts that game first (got ' + tiles()[0].href + ')');
    // unfavorite restores original order
    tiles()[0].children[0].fire('click');
    ok(tiles()[0].href === 'games/' + GAMES[0].slug + '/', 'unfavoriting restores order');
  }

  // challenge history back-fill: a completion is recorded even when detected on a later catalogue
  // load (the old code only awarded "today's" goal lazily, so in-game completions were lost).
  {
    const K = g.win.gamekit, C = g.win.CHALLENGES;
    if (K && C && C.daily && C.daily.length) {
      const day = K.utcDayNumber(), dStr = K.utcDateStr(), len = C.daily.length;
      const id = C.daily[((day % len) + len) % len], goal = C.goals[id];
      if (goal && goal.scope === 'cross') {
        const slugs = GAMES.filter(x => !x.soon).slice(0, 5).map(x => x.slug);
        g.store['gamekit_played_' + dStr] = JSON.stringify({ slugs, totalScore: 1e9, count: 99, goodRuns: 99 });
      } else if (goal && goal.scope === 'random') {
        const playable = GAMES.filter(x => x && x.slug && !x.soon).map(x => x.slug);
        const slug = C.randomSlug(day, playable); // today's deterministic pick
        g.store['gamekit_played_' + dStr] = JSON.stringify({ slugs: [slug], totalScore: 1, count: 1 });
      } else if (goal) {
        const best = {}; best[goal.slug] = { score: 1e9, time: 1e9, stats: { wave: 9999, accuracy: 100 } };
        g.store['gamekit_daybest_' + dStr] = JSON.stringify(best);
      }
      g.win.__renderChallenges();
      let hist = []; try { hist = JSON.parse(g.store['gamekit_history'] || '[]'); } catch (e) {}
      ok(hist.some(r => r && r.id === id), 'completing the daily challenge records it in history (back-fill, goal=' + id + ')');
    }
  }

  // goodRuns unification: the catalogue awards a "good runs" daily via the kit's evaluator
  // (the old duplicate catalogue evaluator had no goodRuns metric, so these could never complete)
  {
    const K = g.win.gamekit, C = g.win.CHALLENGES;
    if (K && C && C.goals && C.goals.good3) {
      const dStr = K.utcDateStr(), dailyBak = C.daily;
      C.daily = ['good3']; // force today's daily to the goodRuns goal
      g.store['gamekit_played_' + dStr] = JSON.stringify({ slugs: ['snake'], totalScore: 500, count: 3, goodRuns: 3 });
      delete g.store['gamekit_done']; delete g.store['gamekit_history'];
      g.win.__renderChallenges();
      let done = {}; try { done = JSON.parse(g.store['gamekit_done'] || '{}'); } catch (e) {}
      ok((dStr + '#good3') in done, 'a goodRuns daily completes + awards points on the catalogue (kit evaluator)');
      let hist = []; try { hist = JSON.parse(g.store['gamekit_history'] || '[]'); } catch (e) {}
      ok(hist.some(r => r && r.id === 'good3'), 'the goodRuns completion lands in history');
      C.daily = dailyBak;
    }
  }

  // ---- 🎲 random game: button pool + deterministic challenge pick ----
  {
    const C = g.win.CHALLENGES;
    const all = GAMES.filter(x => x && x.slug && !x.soon);
    // button pool: unplayed-first, all-games fallback
    if (typeof g.win.__randomPool === 'function' && all.length >= 2) {
      const played = new Set([all[0].slug]);
      const pool = g.win.__randomPool(all, played);
      ok(pool.length === all.length - 1 && !pool.some(x => x.slug === all[0].slug), 'random button prefers unplayed games (excludes the one played)');
      const allPlayed = new Set(all.map(x => x.slug));
      const fb = g.win.__randomPool(all, allPlayed);
      ok(fb.length === all.length, 'random button falls back to all games when nothing is unplayed');
    }
    // challenge pick: deterministic + always a real playable slug + differs across days
    if (C && typeof C.randomSlug === 'function' && all.length >= 2) {
      const playable = all.map(x => x.slug);
      const a = C.randomSlug(100, playable), b = C.randomSlug(100, playable);
      ok(a === b && playable.indexOf(a) >= 0, 'randomSlug is deterministic and returns a real playable slug (' + a + ')');
      let distinct = new Set(); for (let d = 0; d < playable.length; d++) distinct.add(C.randomSlug(d, playable));
      ok(distinct.size > 1, 'randomSlug varies across days (got ' + distinct.size + ' distinct over ' + playable.length + ' days)');
      ok(C.randomSlug(5, []) === '', 'randomSlug is safe with an empty pool');
    }
  }

  // ---- profile card: big numbers format + dedup + pluralization ----
  if (typeof g.win.__renderProfile === 'function') {
    const body = g.getEl('profileBody');
    // (1) huge values: comma grouping, merged "Your games" block, ×N only when >1
    for (const k of Object.keys(g.store)) if (k.indexOf('gamekit_') === 0) delete g.store[k];
    g.store['gamekit_pb'] = JSON.stringify({
      asteroids: { 'Classic': { score: 300000, time: 0, plays: 90000, stats: {} }, 'Classic+': { score: 240000, time: 0, plays: 30000, stats: {} }, 'Classic Speedrun': { score: 2500, time: 92000, plays: 500, stats: {} } }, // Speedrun = time-primary

      bubbles: { 'Endless': { score: 30000, time: 0, plays: 5, stats: {} }, 'Arcade': { score: 22000, time: 0, plays: 3, stats: {} } },          // multi → ×5 shown
      'tower-defense': { 'Ice · Hard': { score: 90000, time: 0, plays: 120000, stats: {} } }, // single → header 120,000 plays, no ×
      snake: { 'Fast · Walls': { score: 300, time: 0, plays: 7, stats: {} } },                // single, 7 plays → ×7 hidden (redundant with header)
      'aim-trainer': { 'Timed · 30s': { score: 10000, time: 0, plays: 1, stats: {} } },        // single, 1 play → no ×
    });
    g.store['gamekit_stats'] = JSON.stringify({ first: Date.UTC(2024, 0, 1), days: 920, lastDay: '2026-07-01', goodRuns: 80000 });
    g.store['gamekit_history'] = JSON.stringify(Array.from({ length: 1800 }, (_, i) => ({ id: 'x' + i, day: i })));
    let perr = null; try { g.win.__renderProfile(); } catch (e) { perr = e.message; }
    ok(perr === null, 'profile renders with huge numbers without error: ' + perr);
    const h = body.innerHTML || '';
    const grp = n => Number(n).toLocaleString(); // same runtime → locale-agnostic (matches the render's fmt)
    ok(h.includes(grp(300000)), 'big record uses fmt grouping (' + grp(300000) + ')');
    ok(h.includes(grp(120000) + '</b> play'), 'huge play total is grouped in the header (' + grp(120000) + ')');
    ok(h.includes(grp(80000)), 'good runs uses fmt grouping (' + grp(80000) + ')');
    ok(h.includes('Your games') && !h.includes('Most played') && !h.includes('Records by game'), 'sections merged into one "Your games" block');
    ok(h.includes('pf-rhead') && h.includes('>Best<'), 'each card labels its value column "Best"');
    ok(h.includes('×' + grp(5) + '</i>'), 'a multi-mode game shows per-mode ×5');
    ok(h.includes('×' + grp(90000) + '</i>'), 'a high per-mode play count is grouped too (×' + grp(90000) + ')');
    ok(h.includes('×' + grp(7)), 'a single-mode game still shows its per-mode ×N (consistency)');
    ok(!h.includes('×' + grp(1) + '</i>'), 'no ×1 noise anywhere');
    ok(h.includes('01:32.00'), 'a Speedrun mode shows its record as time (mm:ss.cs), not points');
    ok(h.includes('📅 Since'), 'playing-since is surfaced in the highlights');
    ok(h.includes('pf-titlebar'), 'the identity box is the top element (no separate header)');
    // (2) singular labels — the "1 DAYS" bug
    for (const k of Object.keys(g.store)) if (k.indexOf('gamekit_') === 0) delete g.store[k];
    g.store['gamekit_pb'] = JSON.stringify({ snake: { 'Classic': { score: 5, time: 0, plays: 1, stats: {} } } });
    g.store['gamekit_stats'] = JSON.stringify({ first: Date.UTC(2026, 6, 1), days: 1, lastDay: '2026-07-01', goodRuns: 0 });
    g.store['gamekit_history'] = '[]';
    g.win.__renderProfile();
    const h2 = body.innerHTML || '';
    ok(h2.includes('<span>Day</span>') && !h2.includes('<span>Days</span>'), 'stat label is "Day" (singular) at count 1, not "Days"');
    ok(h2.includes('<span>Game</span>') && h2.includes('<span>Play</span>'), 'Game / Play labels also singular at count 1');
  }

  // ---- earned titles: challenge points → title + tier shine ----
  {
    const C = g.win.CHALLENGES;
    if (C && typeof C.titleFor === 'function') {
      ok(C.titleFor(0).title === 'Goblin of the Gutter' && C.titleFor(0).tier === 0, 'titleFor(0) → Goblin (tier 0)');
      ok(C.titleFor(9).tier === 0 && C.titleFor(10).tier === 1, 'crossing 10 pts promotes Goblin → Peasant');
      ok(C.titleFor(250).title === 'Archmage of the Arcane', 'titleFor(250) → Archmage (highest ≤ 250)');
      ok(C.titleFor(1e9).title === 'Emperor of Eternity', 'huge points → Emperor (top title)');
    }
    if (typeof g.win.__renderProfile === 'function') {
      for (const k of Object.keys(g.store)) if (k.indexOf('gamekit_') === 0) delete g.store[k];
      g.store['gamekit_pb'] = JSON.stringify({ snake: { 'Classic': { score: 50, time: 0, plays: 3, stats: {} } } });
      g.store['gamekit_done'] = JSON.stringify({ a: 5, b: 5, c: 5, d: 5, e: 5, f: 5, gg: 5, h: 5, i: 5, j: 5 }); // 50 pts → Knight (tier 3)
      g.win.__renderProfile();
      const bh = g.getEl('profileBody').innerHTML || '';
      ok(bh.includes('Knight of the Realm') && bh.includes('pf-t3'), 'profile shows the earned title (Knight, tier 3) at 50 pts');
      ok(bh.includes('🏆 50 <span>'), 'title box surfaces the challenge-points total (🏆 50)');
      ok(bh.includes('pf-pfx'), 'a premium tier (3+) gets a particle canvas');
      ok(bh.includes('pf-tb-name') && bh.includes('pf-t3'), 'title + username share one full-width box, shined to the tier');
      ok(bh.includes('pf-name-btn') && bh.includes('Click to change your name'), 'profile name is a rename button with an instant tooltip');
      ok(bh.includes('pf-tb-info'), 'titles-ladder (i) button present in the full box');
      const card = g.getEl('profileBtn').innerHTML || '';
      ok(card.includes('pf-titlebar') && card.includes('pf-compact') && !card.includes('pf-tb-meta'),
        'drawer identity card reuses the title box (compact: no meta / no (i))');
    }
  }
}

// ---------------- Tower Defense ----------------
function freeCell(T) { // find a buildable cell
  for (let c = 0; c < T.cols; c++) for (let r = 0; r < T.rows; r++) if (!T.roadAt(c, r)) return { c, r };
  return null;
}
function testTD() {
  section('games/tower-defense (logic)');
  const g = bootGame('games/tower-defense/index.html', { seed: 0x7D5EED });
  ok(g.bootErr === null, 'TD boots: ' + g.bootErr);
  const T = () => g.test();
  ok(T() != null, 'TD exposes __test');
  T().start();
  ok(T().state === 'build' && T().gold === 80 && T().hp === 30, 'start → build, 80 gold (medium default), 30 keep HP (got ' + T().state + '/' + T().gold + '/' + T().hp + ')');

  const cell = freeCell(T());
  const before = T().gold;
  const placed = T().place('archer', cell.c, cell.r);
  ok(placed && T().towers === 1 && T().gold === before - 18, 'place archer: built + 18 gold spent (got ' + T().towers + '/' + T().gold + ')');
  ok(!T().place('cannon', cell.c, cell.r), 'cannot build on an occupied cell');

  T().startWave();
  ok(T().state === 'wave' && T().wave === 1, 'startWave → wave 1');
  T().step(60);
  ok(T().enemies > 0, 'enemies spawn during the wave (got ' + T().enemies + ')');

  const goldBeforeKills = T().gold;
  T().killAll();
  ok(T().gold > goldBeforeKills, 'killing enemies awards gold (' + goldBeforeKills + ' -> ' + T().gold + ')');

  // upgrade the tower
  T().addGold(500);
  const gBefore = T().gold;
  T().upgradeAt(cell.c, cell.r);
  ok(T().gold < gBefore, 'upgrade spends gold');

  // leaks reduce keep HP -> game over after enough undefended waves
  const g2 = bootGame('games/tower-defense/index.html', { seed: 0x7D5EED }); const U = () => g2.test();
  U().start();
  let guard = 0; while (U().hp > 0 && guard++ < 60000) { if (U().state === 'build') U().startWave(); U().step(1); }
  ok(U().hp <= 0 && U().state === 'over', 'undefended waves drain the keep and end the run (hp=' + U().hp + ', state=' + U().state + ')');
}

// ---------------- Live games smoke test ----------------
// Every catalogue game (except the asteroids launcher, which loads external
// level files) must boot headless and expose a window.__test hook.
function liveSlugs() {
  const src = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(src, sb);
  return (sb.window.GAMES || []).filter(g => !g.soon && g.slug !== 'asteroids').map(g => g.slug);
}
function testLiveGames() {
  section('live games (boot + __test)');
  for (const slug of liveSlugs()) {
    const g = bootGame('games/' + slug + '/index.html');
    ok(g.bootErr === null, slug + ' boots headless: ' + g.bootErr);
    ok(g.test() != null, slug + ' exposes window.__test');
    // rotation: relayout to landscape then portrait must not throw (kit fires the game's resize)
    let rerr = null;
    try { g.win.gamekit.layout.__emit(900, 500); g.win.gamekit.layout.__emit(420, 840); } catch (e) { rerr = e.message; }
    ok(rerr === null, slug + ' relayouts on rotation without throwing: ' + rerr);
  }
}

// ---------------- game-kit (shared shell) ----------------
async function testKit() {
  section('game-kit (shared shell)');
  const g = makeSandbox({});
  g.run(KIT, 'game-kit.js');
  const store = g.store, doc = g.doc, els = g.elCache;
  ok(g.bootErr === null, 'kit loads: ' + g.bootErr);
  const F = g.sandbox.gamekit;
  ok(F && F.sound && F.music && F.nav && F.audioMenu && F.resetScores && F.shareRow && F.shareUrls && F.pwa,
    'kit exposes sound/music/nav/audioMenu/resetScores/shareRow/shareUrls/pwa');
  if (!F) return;
  const u = F.shareUrls('https://komyo.online/games/snake/', 'I scored 42 in Neon Snake 🐍');
  ok(u.x.indexOf('twitter.com/intent/tweet') >= 0 && u.x.indexOf('&url=') >= 0, 'shareUrls.x is an X intent with url');
  ok(u.reddit.indexOf('reddit.com/submit') >= 0, 'shareUrls.reddit is a reddit submit');
  ok(u.copy.indexOf('I scored 42') === 0 && u.copy.indexOf('komyo.online/games/snake') >= 0, 'shareUrls.copy = message + newline + url');
  // SFX channel
  ok(F.sound.isMuted() === false, 'SFX starts unmuted');
  F.sound.toggle();
  ok(F.sound.isMuted() === true && store['gamekit_sfx_muted'] === '1', 'SFX toggle mutes + persists');
  F.sound.play('anything'); // muted + no AudioContext → must not throw
  F.sound.toggle();
  F.sound.volume(0.5);
  ok(store['gamekit_sfx_vol'] === '0.5', 'SFX volume persists (' + store['gamekit_sfx_vol'] + ')');
  // Music channel
  let musState = null; F.music.subscribe(s => { musState = s; });
  ok(musState && musState.muted === false, 'music.subscribe fires with initial state');
  F.music.setMuted(true);
  ok(F.music.isMuted() === true && store['gamekit_music_muted'] === '1' && F.music.gain() === 0, 'music mute persists + gain 0 when muted');
  F.music.setMuted(false); F.music.volume(0.4);
  ok(F.music.gain() === 0.4 && store['gamekit_music_vol'] === '0.4', 'music volume = gain when unmuted');
  // layout: orientation + hudTop + on()/__emit relayout
  ok(F.layout && typeof F.layout.on === 'function' && typeof F.layout.hudTop === 'function', 'kit exposes layout (on/hudTop)');
  let lay = null; F.layout.on(s => { lay = s; });
  F.layout.__emit(900, 500);
  ok(lay && lay.landscape === true && lay.hudTop === 48, 'landscape → hudTop 48 (' + (lay && lay.hudTop) + ')');
  F.layout.__emit(420, 840);
  ok(lay && lay.portrait === true && lay.narrow === true && lay.hudTop === 92, 'portrait → narrow, hudTop 92 (' + (lay && lay.hudTop) + ')');
  ok(F.layout.requireOrientation('') === true, 'requireOrientation falsy → satisfied (no lock)');
  // ---- fixed-timestep loop: 60 steps/sec of game-time at any frame rate ----
  {
    let steps = 0, renders = 0;
    F.loop(() => { steps++; }, () => { renders++; });
    ok(g.rafPending > 0, 'gamekit.loop schedules a rAF tick');
    const fire = t => g.fireRaf(t);
    fire(0);
    ok(steps === 0 && renders === 1, 'first frame initialises without stepping');
    fire(99); // 99ms → 5 full steps of 1000/60 (~16.67ms), remainder accumulates
    ok(steps === 5, '99ms of real time drains 5 fixed steps (got ' + steps + ')');
    fire(1099); // 1s stall → clamped to MAX_FRAME (100ms) → 6 steps, not 60
    ok(steps === 11, 'a tab stall is clamped — no catch-up spiral (got ' + steps + ')');
    F.setPaused(true);
    fire(1150);
    ok(steps === 11 && renders === 4, 'paused → renders only, no steps');
    F.setPaused(false);
    fire(1200); // dt = 50 since the paused frame kept lastT fresh → 3 steps (a stale lastT would clamp-drain 6)
    ok(steps === 14, 'resume has no dt jump (3 steps for 50ms, got ' + (steps - 11) + ')');
    let fast = 0, polled = 0;
    F.loop(() => { fast++; }, null, { mult: () => 2, frame: () => { polled++; } });
    fire(0); fire(49.5); // 49.5ms × mult 2 = 99ms of game-time = 5 steps
    ok(fast === 5, 'opts.mult scales game-time (2× → 5 steps for 49.5ms, got ' + fast + ')');
    ok(polled === 2, 'opts.frame runs once per display frame (got ' + polled + ')');
  }

  // results + per-day activity log (powers challenges)
  F.recordResult('snake', { mode: 'classic', score: 42, stats: { length: 5 } });
  const rr = F.lastResult('snake');
  ok(rr && rr.score === 42 && rr.mode === 'classic' && rr.stats.length === 5, 'recordResult/lastResult round-trips');
  F.recordResult('bubbles', { score: 100 });
  const pt = F.playedToday();
  ok(pt.slugs.indexOf('snake') >= 0 && pt.slugs.indexOf('bubbles') >= 0 && pt.count === 2 && pt.totalScore === 142, 'activity log tracks distinct games + totals');
  // score card (Level 2): headless has no canvas.toBlob → resolves null without throwing
  let cardOk = false; F.scoreCard({ title: 'Neon Snake', score: 42 }).then(b => { cardOk = (b === null); }).catch(() => {});
  ok(typeof F.scoreCard === 'function', 'kit exposes scoreCard builder');
  // embed modal (single + picker)
  let embErr = null; try { F.embedModal({ slug: 'snake', title: 'Neon Snake' }); F.embedModal({ games: [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }] }); } catch (e) { embErr = e.message; }
  ok(embErr === null && typeof F.embedModal === 'function', 'embedModal builds (single + picker) headless: ' + embErr);
  // headless-safe (incl. the audio menu + reset + music flag)
  let threw = null;
  try { F.nav({ music: true, reset: 'snake_' }); F.shareRow(doc.getElementById('sr'), { slug: 'snake', message: () => 'x' }); F.pwa(); F.resetScores('snake_'); } catch (e) { threw = e.message; }
  ok(threw === null, 'nav/audioMenu/shareRow/pwa/resetScores run headless without throwing: ' + threw);
  // version tag (bottom-left build stamp): renders the SHA when present, no-op on dev
  g.win.KOMYO_VERSION = { sha: 'abc1234', url: 'https://github.com/N0zz/komyo.online/commit/abc1234' };
  F.versionTag();
  ok(els['gamekitVersion'] && els['gamekitVersion'].textContent === 'abc1234', 'versionTag shows the commit SHA');
  g.win.KOMYO_VERSION = { sha: 'dev' };
  delete els['gamekitVersion'];
  F.versionTag();
  ok(!els['gamekitVersion'], 'versionTag is a no-op on dev (nothing rendered)');
  // ---- build info + update engine (gamekit.updates) ----
  ok(F.updates && typeof F.updates.check === 'function' && typeof F.updates.apply === 'function' && typeof F.updates.onChange === 'function' && typeof F.buildInfo === 'function',
    'kit exposes updates (check/apply/onChange/state) + buildInfo');
  g.win.KOMYO_VERSION = { sha: 'abc1234', url: 'https://x', built: '2026-07-02T16:45:00Z' };
  {
    const p2 = n => (n < 10 ? '0' : '') + n;
    const d = new Date('2026-07-02T16:45:00Z'); // buildInfo renders the stamp in local time — mirror it
    const when = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    const bi = F.buildInfo();
    ok(bi.when === when && bi.label === 'abc1234 · ' + when, 'buildInfo formats the deploy stamp as sha · local date+time (' + bi.label + ')');
    F.versionTag();
    ok(els['gamekitVersion'] && els['gamekitVersion'].textContent === 'abc1234 · ' + when, 'versionTag shows sha · built date+time');
  }
  g.win.KOMYO_VERSION = { sha: 'dev' };
  ok(F.buildInfo().label === 'dev', 'buildInfo label is plain "dev" locally');
  ok(typeof F.updates.state().available === 'boolean' && F.updates.state().available === false, 'updates.state() readable headless, no false "update available"');
  // ---- update policy: hand-over ignored / pre-interaction silent reload / in-use badge only ----
  {
    const mk = () => {
      const s = makeSandbox({});
      let reloads = 0;
      s.sandbox.location.reload = () => { reloads++; };
      const swL = {};
      s.sandbox.navigator.serviceWorker = {
        controller: { scriptURL: 'https://k/sw.js' },
        addEventListener: (t, fn) => { (swL[t] ||= []).push(fn); },
        register: () => Promise.resolve({ update() {} }),
        getRegistrations: () => Promise.resolve([]),
      };
      s.run(KIT, 'game-kit.js');
      return { s, F2: s.sandbox.gamekit, reloads: () => reloads,
        setCtl(url) { s.sandbox.navigator.serviceWorker.controller = url ? { scriptURL: url } : null; },
        fire() { (swL.controllerchange || []).forEach(fn => fn()); } };
    };
    // launch fast-path: a new build takes control before the player touches anything → silent reload
    const a = mk();
    a.F2.pwa();
    a.setCtl('https://k/sw.js'); a.fire(); // same worker URL = genuinely new build
    ok(a.reloads() === 1, 'pre-interaction new build → one silent reload (launch fast-path)');
    // scope hand-over is not an update; an in-use page only gets the badge
    const b = mk();
    b.F2.pwa();
    b.setCtl('https://k/games/x/sw.js'); b.fire(); // different worker URL = root→game hand-over
    ok(b.reloads() === 0 && b.F2.updates.state().available === false, 'scope hand-over (different worker URL) is ignored');
    b.s.key('pointerdown'); // the player touches the page
    b.fire();               // same-URL new build lands mid-session
    ok(b.reloads() === 0 && b.F2.updates.state().available === true, 'in-use page: update lights the badge, never reloads');
    b.F2.updates.apply();
    ok(b.F2.updates.state().status === 'refreshing', 'apply() enters the refreshing state');
    await Promise.resolve(); await Promise.resolve(); // flush the check→reload microtasks
    ok(b.reloads() === 1, 'apply() with the new worker already in control reloads straight away');
  }
  // ---- menu engine (gamekit.menu.show) ----
  ok(F.menu && typeof F.menu.show === 'function' && typeof F.menu.hide === 'function' && typeof F.stampUrl === 'function',
    'kit exposes menu.show/hide + stampUrl');
  let played = null;
  const hm = F.menu.show({
    kind: 'start', title: 'Asteroids',
    groups: [
      { id: 'run', label: '1 · RUN', default: 'normal', choices: [{ id: 'normal', label: 'Normal' }, { id: 'speedrun', label: 'Speedrun' }] },
      { id: 'mode', label: '2 · MODE', default: 'classic', choices: [{ id: 'classic', label: 'Classic' }, { id: 'enh', label: 'Classic+' }] },
    ],
    hint: s => s.run === 'speedrun' ? 'fast' : 'endless',
    actions: [{ id: 'play', label: 'Play ▶', primary: true }],
    onPlay: s => { played = s; },
    theme: { accent: '#ff7ab6' },
  });
  ok(hm && hm.selection().run === 'normal' && hm.selection().mode === 'classic', 'menu start defaults applied');
  ok(F.menu.current() === hm, 'menu.current() returns the active handle');
  hm.select('mode', 'enh'); hm.select('run', 'speedrun');
  ok(hm.selection().mode === 'enh' && hm.selection().run === 'speedrun', 'menu.select changes the selection');
  hm.activate('play');
  ok(played && played.mode === 'enh' && played.run === 'speedrun', 'menu Play fires onPlay with the live selection');
  hm.hide();
  ok(F.menu.current() === null, 'menu.hide clears current');
  // pause: onAction fires by id
  let acted = null;
  const hp = F.menu.show({ kind: 'pause', title: 'Paused', lines: ['score 10'], actions: [{ id: 'resume', label: 'Resume', primary: true }, { id: 'quit', label: 'Quit', danger: true }], onAction: id => { acted = id; } });
  hp.activate('resume');
  ok(acted === 'resume', 'pause action fires onAction(id)');
  hp.hide();
  // end: records the result (so card + day-best work) and is headless-safe with a share row
  let endErr = null;
  try {
    F.menu.show({ kind: 'end', title: 'Game Over', score: 1234, best: 1000, newBest: true, lines: ['reached wave 7'],
      share: { slug: 'asteroids', title: 'Asteroids', message: () => 'I scored 1234' },
      record: { slug: 'asteroids', mode: 'classic', score: 1234, stats: { wave: 7 } },
      actions: [{ id: 'again', label: 'Play again', primary: true }], onAction: () => {} });
  } catch (e) { endErr = e.message; }
  ok(endErr === null, 'end-screen menu builds headless (share row + record): ' + endErr);
  const er = F.lastResult('asteroids');
  ok(er && er.score === 1234 && er.stats.wave === 7, 'end-screen menu records the result via recordResult');
  // record idempotency: rebuilding the same end screen (no new run) must not double-count
  const cnt0 = F.playedToday().count;
  F.menu.show({ kind: 'end', title: 'Game Over', record: { slug: 'asteroids', mode: 'classic', score: 1234, stats: { wave: 7 } }, actions: [] });
  ok(F.playedToday().count === cnt0, 're-shown end menu (same run) does not record again');
  F.menu.hide(); // a new run starts (game dismisses the menu)
  F.menu.show({ kind: 'end', title: 'Game Over', record: { slug: 'asteroids', mode: 'classic', score: 999 }, actions: [] });
  ok(F.playedToday().count === cnt0 + 1, 'after menu.hide (new run) the next end menu records once');
  F.menu.hide();
  // confirm dialog back-compat + new args are headless-safe
  let cfErr = null;
  try { F.confirm('Leave?', () => {}, 'Leave', () => {}); } catch (e) { cfErr = e.message; }
  ok(cfErr === null, 'confirm(msg,onYes,yesLabel,onCancel) runs headless: ' + cfErr);
  // controls board: nav exposes a controls button + the modal builds headless
  let ctlErr = null;
  try { F.controls({ title: 'Controls', keyboard: [['Space', 'Shoot'], ['Esc', 'Pause']], touch: [['Tap', 'Shoot']] }); } catch (e) { ctlErr = e.message; }
  ok(ctlErr === null && typeof F.controls === 'function', 'controls board builds headless: ' + ctlErr);
  // challenges: activeChallenge(slug) + the in-game panel (reads window.CHALLENGES + kit storage)
  g.win.CHALLENGES = { goals: { tg: { slug: 'testgame', title: 'Score 10 in Test', metric: 'score', target: 10 } }, daily: ['tg'], weekly: [] };
  ok(F.activeChallenge('testgame') === true, 'activeChallenge true when this game is today’s pick');
  ok(F.activeChallenge('other') === false, 'activeChallenge false for a game with no active challenge');
  let chpErr = null; try { F.challengesPanel({ slug: 'testgame' }); } catch (e) { chpErr = e.message; }
  ok(chpErr === null && typeof F.challengesPanel === 'function', 'challenges panel builds headless: ' + chpErr);
  // challengeEval — the ONE evaluator (catalogue routes through it): goodRuns day/week + random picks
  ok(typeof F.challengeEval === 'function', 'kit exposes challengeEval');
  const gr0 = F.challengeEval({ title: 'g', scope: 'cross', range: 'day', metric: 'goodRuns', target: 2 }, {});
  ok(gr0 && gr0.done === false, 'challengeEval: goodRuns daily incomplete before par-clearing runs');
  F.recordResult('snake', { mode: 'classic', score: 150 });   // ≥ snake's good-run bar (100)
  F.recordResult('breakout', { score: 600 });                 // ≥ breakout's bar (500)
  const gr1 = F.challengeEval({ title: 'g', scope: 'cross', range: 'day', metric: 'goodRuns', target: 2 }, {});
  ok(gr1 && gr1.val === 2 && gr1.done === true, 'challengeEval: two par-clearing runs complete a goodRuns daily (got ' + (gr1 && gr1.val) + ')');
  const grw = F.challengeEval({ title: 'g', scope: 'cross', range: 'week', metric: 'goodRuns', target: 2 }, {});
  ok(grw && grw.done === true, 'challengeEval: weekly goodRuns aggregates the week');
  g.win.CHALLENGES.randomSlug = (idx, pl) => pl[0] || '';
  const rnd = F.challengeEval({ scope: 'random', range: 'day', title: 'x' }, { playable: ['snake'], titles: { snake: 'Neon Snake' } });
  ok(rnd && rnd.done === true && rnd.slug === 'snake' && rnd.title === 'Play Neon Snake today', 'challengeEval resolves a random pick (title + played)');
  const rnd2 = F.challengeEval({ scope: 'random', range: 'day', title: 'Mystery pick' }, {});
  ok(rnd2 && rnd2.done === false && rnd2.target === 1 && rnd2.title === 'Mystery pick', 'random goal without a playable list reports honestly (no false Done)');
  // Discord auto-post gate: no consent → off; consent → anonymous; Settings opt-in → named
  delete store['gamekit_consent']; delete store['gamekit_discord_name'];
  ok(F.discordTier() === 'off', 'discordTier: no cookie consent → off (nothing is sent)');
  store['gamekit_consent'] = 'denied';
  ok(F.discordTier() === 'off', 'discordTier: declined consent → off');
  store['gamekit_consent'] = 'granted';
  ok(F.discordTier() === 'anon', 'discordTier: consent alone → anonymous posts');
  store['gamekit_discord_name'] = '1';
  ok(F.discordTier() === 'named', 'discordTier: consent + Settings opt-in → named posts');
  store['gamekit_discord_name'] = '0';
  ok(F.discordTier() === 'anon', 'discordTier: opt-in toggled back off → anonymous again');
  delete store['gamekit_consent']; delete store['gamekit_discord_name'];
  // ---- cards group + boolean toggle: state merges selection + toggles; dynamic best/mech are fns ----
  let played2 = null, cardErr = null, hc = null;
  try {
    hc = F.menu.show({
      kind: 'start', title: 'A',
      groups: [{ id: 'mode', label: 'MODE', style: 'cards', default: 'classic', choices: [
        { id: 'classic', label: 'CLASSIC', preview: function () {}, desc: st => st.speedrun ? 'race' : 'endless',
          mech: st => ['1 weapon', st.speedrun ? { label: 'Goal 2,000', hot: true } : null], best: st => st.speedrun ? '01:00.0' : 12340 },
        { id: 'enh', label: 'CLASSIC+', tag: 'UPGRADES', preview: function () {}, desc: 'tiers', mech: ['weapon tiers'], best: 9 },
      ] }],
      toggles: [{ id: 'speedrun', label: 'SPEEDRUN', caption: '— race', default: false, disabled: s => s.mode === 'enh' }],
      actions: [{ id: 'play', label: 'Play', primary: true }],
      onPlay: s => { played2 = s; },
    });
  } catch (e) { cardErr = e.message; }
  ok(cardErr === null && hc, 'cards+toggle menu builds headless: ' + cardErr);
  ok(hc && hc.selection().mode === 'classic' && hc.selection().speedrun === false, 'cards+toggle initial state (selection + bool)');
  if (hc) { hc.toggle('speedrun'); ok(hc.selection().speedrun === true, 'toggle() flips the boolean'); }
  if (hc) { hc.select('mode', 'enh'); hc.activate('play'); }
  ok(played2 && played2.mode === 'enh' && played2.speedrun === true, 'onPlay gets the merged selection + toggle state');
  if (hc) hc.hide();
}

// ---------------- Challenges ↔ games coverage ----------------
// Kit "chrome" (top nav / audio splash / analytics) — a REGRESSION GUARD, not a pixel test. The harness
// mocks getBoundingClientRect (fixed 800×600), so real top-bar overlap can't be measured headlessly (see
// bug backlog). This just asserts the responsive safeguards + hooks are present so they can't be silently
// deleted; visual overlap must still be checked on a real device.
function testKitChrome() {
  section('game-kit (responsive nav safeguards + tap-to-play + game_start)');
  const css = fs.readFileSync(path.join(DIR, 'game-kit.css'), 'utf8');
  const js = KIT;
  // nav fit: measured label-collapse + narrow-width shrink + force-collapse ≤400px (covers 360px Android)
  ok(css.includes('.gamekit-nav-tight .gamekit-home-label'), 'nav has the measured label-collapse rule');
  ok(css.includes('@media (max-width: 560px)') && /max-width: 560px[\s\S]*\.gamekit-au-btn[^}]*width:/.test(css), 'right-cluster buttons shrink at ≤560px');
  ok(css.includes('@media (max-width: 400px)') && /max-width: 400px[\s\S]*\.gamekit-home-label\s*\{\s*display:\s*none/.test(css), 'brand label force-collapses at ≤400px (fits 360px)');
  // tap-to-play audio splash
  ok(css.includes('.gamekit-tap'), 'tap-to-play splash style present');
  ok(js.includes('function tapToStart') && js.includes('tapToStart();'), 'tapToStart is defined and called from nav()');
  ok(/if \(_tapShown\) return;/.test(js) && !/if \(musMuted\) return;/.test(js), 'splash is always-on, shown once per page load (not gated on the music toggle)');
  // game_start analytics event
  ok(js.includes("'game_start'") && js.includes('function currentSlug'), 'game_start event fires with the URL slug');
  // SW update: manual button when visible (no surprise reload that re-triggered the splash)
  ok(css.includes('.gamekit-more-panel') && css.includes('.gamekit-au-morebtn'), '☰ menu panel styles present');
  ok(js.includes('ctl.scriptURL !== prevCtl.scriptURL'), 'update vs scope-hand-over told apart by worker script URL (not timing)');
  ok(js.includes('if (!interacted) { doReload(); return; }') && !js.includes('showUpdateButton'), 'new build → silent reload only pre-interaction; in-use pages get the ☰ badge, never a reload');
}

function testChallenges() {
  section('challenges.js (coverage vs games.js)');
  const games = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const challenges = fs.readFileSync(path.join(DIR, 'challenges.js'), 'utf8');
  const sb = { window: {}, console }; sb.globalThis = sb;
  let derr = null;
  try { vm.runInContext(games + '\n' + challenges, vm.createContext(sb), { filename: 'catalogue-data.js' }); } catch (e) { derr = e.message; }
  ok(derr === null, 'games.js + challenges.js load: ' + derr);
  const GAMES = sb.window.GAMES || [], C = sb.window.CHALLENGES || {};
  const goals = C.goals || {};
  const activeSlugs = new Set(GAMES.filter(g => !g.soon).map(g => g.slug));
  const allSlugs = new Set(GAMES.map(g => g.slug));
  const goalEntries = Object.entries(goals);
  const singleGoals = goalEntries.filter(([, gl]) => gl.slug);          // single-game goals carry a slug
  const crossGoals = goalEntries.filter(([, gl]) => gl.scope === 'cross');
  const slugsWithChallenge = new Set(singleGoals.map(([, gl]) => gl.slug));

  // A) every ACTIVE (playable, non-soon) game has at least one challenge
  for (const slug of activeSlugs) ok(slugsWithChallenge.has(slug), 'active game "' + slug + '" has ≥1 challenge defined');
  // B) every single-game challenge points at an existing + active game (none orphaned to a soon/removed game)
  for (const [id, gl] of singleGoals) {
    ok(allSlugs.has(gl.slug), 'challenge "' + id + '" → game "' + gl.slug + '" exists in games.js');
    ok(activeSlugs.has(gl.slug), 'challenge "' + id + '" → game "' + gl.slug + '" is active (not soon)');
  }
  // C) cross goals are well-formed (no stray slug; a recognized metric)
  const crossMetrics = new Set(['distinctGames', 'totalGames', 'totalScore', 'distinctGenres', 'goodRuns']);
  for (const [id, gl] of crossGoals) {
    ok(!gl.slug, 'cross goal "' + id + '" carries no game slug');
    ok(crossMetrics.has(gl.metric), 'cross goal "' + id + '" uses a known metric (' + gl.metric + ')');
  }
  // D) referential integrity: every id in the daily/weekly rotations resolves to a defined goal
  for (const id of (C.daily || [])) ok(!!goals[id], 'daily rotation id "' + id + '" is a defined goal');
  for (const id of (C.weekly || [])) ok(!!goals[id], 'weekly rotation id "' + id + '" is a defined goal');
}

// ---------------- service workers (sw-core + per-scope) ----------------
function testServiceWorkers() {
  section('service workers (sw-core + per-scope)');
  const core = fs.readFileSync(path.join(DIR, 'sw-core.js'), 'utf8');
  const scopes = [['sw.js', 'root'], ['games/aim-trainer/sw.js', 'aim-trainer'], ['games/asteroids/sw.js', 'asteroids'],
    ['games/asteroids-plus/sw.js', 'asteroids-plus'], ['games/breakout/sw.js', 'breakout'], ['games/bubbles/sw.js', 'bubbles'],
    ['games/flappy/sw.js', 'flappy'], ['games/snake/sw.js', 'snake'], ['games/stacker/sw.js', 'stacker'], ['games/tower-defense/sw.js', 'tower-defense']];
  for (const [file, scope] of scopes) {
    const src = fs.readFileSync(path.join(DIR, file), 'utf8');
    const listeners = {}; let opened = null;
    const sb = {
      location: { origin: 'https://komyo.online' },
      addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: () => {}, clients: { claim: () => {} },
      caches: { open: n => { opened = n; return Promise.resolve({ add: () => Promise.resolve(), match: () => Promise.resolve(null), put: () => {} }); }, keys: () => Promise.resolve([]), delete: () => Promise.resolve() },
      fetch: () => Promise.reject(new Error('offline')), Response: { error: () => ({}) }, Promise, console, URL,
    };
    sb.self = sb; sb.globalThis = sb;
    const ctx = vm.createContext(sb);
    sb.importScripts = rel => vm.runInContext(rel.indexOf('sw-core') >= 0 ? core : '', ctx, { filename: rel });
    let err = null;
    try { vm.runInContext(src, ctx, { filename: file }); } catch (e) { err = e.message; }
    ok(err === null, file + ' loads + imports sw-core: ' + err);
    ok(typeof listeners.install === 'function' && typeof listeners.activate === 'function' && typeof listeners.fetch === 'function',
      file + ' registers install/activate/fetch');
    try { if (listeners.install) listeners.install({ waitUntil() {} }); } catch (e) {}
    ok(opened === 'komyo-' + scope + '-dev', file + ' precaches the scope-keyed cache (got ' + opened + ')');
  }
}

console.log('Running arcade tests…');
testCatalogue();
testTD();
testLiveGames();
await testKit();
testKitChrome();
testChallenges();
testServiceWorkers();
summary();
