// Headless tests for the arcade: catalogue wiring + Tower Defense logic.
// Mocks DOM/canvas, runs each inline script in a vm sandbox, drives via window.__test.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const KIT = fs.readFileSync(path.join(DIR, 'game-kit.js'), 'utf8'); // shared kit, preloaded for game pages
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); console.log('  ✗ ' + m); } };
const section = t => console.log('\n=== ' + t + ' ===');

function ctx2d() { return new Proxy({}, { get: (_, p) => (p === 'canvas' ? { width: 1280, height: 800 } : () => {}), set: () => true }); }
function makeEl() {
  const cl = new Set(); const el = {
    textContent: '', value: '', dataset: {}, children: [],
    style: new Proxy({}, { get: (t, p) => p === 'setProperty' ? ((k, v) => { t[k] = v; }) : (t[p] ?? ''), set: (t, p, v) => (t[p] = v, true) }),
    classList: { add:(...c)=>c.forEach(x=>cl.add(x)), remove:(...c)=>c.forEach(x=>cl.delete(x)), toggle:(c,f)=>{const w=f===undefined?!cl.has(c):!!f; w?cl.add(c):cl.delete(c); return w;}, contains:c=>cl.has(c) },
    _l: {}, addEventListener:(t,fn)=>{(el._l[t]||=[]).push(fn);}, removeEventListener(){}, fire:(t,e={})=>(el._l[t]||[]).forEach(fn=>fn({preventDefault(){},stopPropagation(){},...e})),
    appendChild:c=>{el.children.push(c); return c;}, querySelectorAll:()=>[], querySelector:()=>null, getContext:()=>ctx2d(), focus(){}, setAttribute(){}, getAttribute(){return null;}, getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800}),
  };
  let h=''; Object.defineProperty(el,'innerHTML',{get:()=>h,set:v=>{h=String(v??''); if(!v) el.children=[];}});
  return el;
}

function runInline(file, extraSandbox = {}) {
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
  // greedy lead → grab the LAST attribute-less <script> before </body> (the game's main
  // script), even if earlier attribute-less <script>s exist (e.g. the GA4 tag in <head>).
  const m = html.match(/[\s\S]*<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script in ' + file);
  const cache = {}; const getEl = id => (cache[id] ||= makeEl());
  const handlers = {}; const store = {};
  const win = { innerWidth: 1280, innerHeight: 800, addEventListener:(t,fn)=>{(handlers[t]||=[]).push(fn);}, removeEventListener(){}, matchMedia:()=>({matches:false}) };
  const doc = { getElementById:getEl, createElement:()=>makeEl(), addEventListener(){}, querySelectorAll:()=>[], body:makeEl() };
  const sandbox = Object.assign({
    window: win, document: doc, location: { search: '' }, navigator: {},
    localStorage: { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {},
    matchMedia: () => ({ matches: false }), URLSearchParams, Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console,
  }, extraSandbox);
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  let bootErr = null;
  try {
    if (extraSandbox.__preCode) vm.runInContext(extraSandbox.__preCode, ctx, { filename: 'pre.js' });
    vm.runInContext(m[1], ctx, { filename: file });
  } catch (e) { bootErr = e.stack; }
  return { getEl, win, store, bootErr, test: () => win.__test };
}

// ---------------- Catalogue ----------------
function testCatalogue() {
  section('index.html (catalogue)');
  const games = fs.readFileSync(path.join(DIR, 'games.js'), 'utf8');
  const g = runInline('index.html', { __preCode: KIT + '\n' + games });
  ok(g.bootErr === null, 'catalogue boots: ' + g.bootErr);
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
}

// ---------------- Tower Defense ----------------
function freeCell(T) { // find a buildable cell
  for (let c = 0; c < T.cols; c++) for (let r = 0; r < T.rows; r++) if (!T.roadAt(c, r)) return { c, r };
  return null;
}
function testTD() {
  section('games/tower-defense (logic)');
  const g = runInline('games/tower-defense/index.html', { __preCode: KIT });
  ok(g.bootErr === null, 'TD boots: ' + g.bootErr);
  const T = () => g.test();
  ok(T() != null, 'TD exposes __test');
  T().start();
  ok(T().state === 'build' && T().gold === 110 && T().hp === 20, 'start → build, 110 gold, 20 keep HP (got ' + T().state + '/' + T().gold + '/' + T().hp + ')');

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
  const g2 = runInline('games/tower-defense/index.html', { __preCode: KIT }); const U = () => g2.test();
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
    const g = runInline('games/' + slug + '/index.html', { __preCode: KIT });
    ok(g.bootErr === null, slug + ' boots headless: ' + g.bootErr);
    ok(g.test() != null, slug + ' exposes window.__test');
  }
}

// ---------------- game-kit (shared shell) ----------------
function testKit() {
  section('game-kit (shared shell)');
  const store = {};
  const cl = () => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c), toggle: () => {} }; };
  const mk = () => { const e = { textContent: '', style: {}, classList: cl(), _l: {}, addEventListener: (t, fn) => { (e._l[t] ||= []).push(fn); }, appendChild: c => c, querySelector: () => null, querySelectorAll: () => [] }; let h = ''; Object.defineProperty(e, 'innerHTML', { get: () => h, set: v => { h = String(v ?? ''); } }); return e; };
  const els = {};
  const doc = { getElementById: id => (els[id] ||= mk()), createElement: () => mk(), body: mk() };
  const sandbox = {
    window: { addEventListener() {} }, document: doc, navigator: {}, location: {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    setTimeout: () => 0, setInterval: () => 0, Math, JSON, String, Number, Array, Object, encodeURIComponent, console,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  let err = null; try { vm.runInContext(KIT, ctx, { filename: 'game-kit.js' }); } catch (e) { err = e.stack; }
  ok(err === null, 'kit loads: ' + err);
  const F = sandbox.gamekit;
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
  // headless-safe (incl. the audio menu + reset + music flag)
  let threw = null;
  try { F.nav({ music: true, reset: 'snake_' }); F.shareRow(doc.getElementById('sr'), { slug: 'snake', message: () => 'x' }); F.pwa(); F.resetScores('snake_'); } catch (e) { threw = e.message; }
  ok(threw === null, 'nav/audioMenu/shareRow/pwa/resetScores run headless without throwing: ' + threw);
}

console.log('Running arcade tests…');
testCatalogue();
testTD();
testLiveGames();
testKit();
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
