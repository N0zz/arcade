// Headless test harness for the Asteroids games.
// Mocks the DOM + canvas, runs each game's IIFE in a vm sandbox, steps the
// requestAnimationFrame loop manually, simulates input, and asserts behavior.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function section(t) { console.log('\n=== ' + t + ' ==='); }
// bests now live in the shared kit store (gamekit_pb): normal keeps score, speedrun keeps time (per progression)
const pbG = (store) => { try { return JSON.parse(store['gamekit_pb'] || '{}')['asteroids-plus'] || {}; } catch (e) { return {}; } };
const plabel = (prog, sr) => { const b = { levelup: 'Level-up', milestones: 'Milestones', shop: 'Wave Shop' }[prog] || 'Level-up'; return sr ? b + ' Speedrun' : b; };
const pbScore = (store, mode) => (pbG(store)[mode] || {}).score || 0;
const pbTime = (store, mode) => (pbG(store)[mode] || {}).time || 0;

function makeCtx2d() {
  return new Proxy({}, {
    get: (_, p) => { if (p === 'canvas') return { width: 1280, height: 800 }; return () => {}; },
    set: () => true,
  });
}

function makeEl(id) {
  const classes = new Set();
  const el = {
    id, _id: id, textContent: '', value: '',
    dataset: {}, children: [],
    style: new Proxy({}, { get: (t, p) => t[p] ?? '', set: (t, p, v) => { t[p] = v; return true; } }),
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, f) => { const has = classes.has(c); const want = f === undefined ? !has : !!f; if (want) classes.add(c); else classes.delete(c); return want; },
      contains: c => classes.has(c),
    },
    _l: {},
    addEventListener: (type, fn) => { (el._l[type] ||= []).push(fn); },
    removeEventListener: () => {},
    fire: (type, ev = {}) => (el._l[type] || []).forEach(fn => fn({ preventDefault() {}, ...ev })),
    appendChild: (c) => { el.children.push(c); return c; },
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => makeCtx2d(),
    focus: () => {},
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => _html, set: v => { _html = String(v ?? ''); if (v === '' || v == null) el.children = []; } });
  return el;
}

// Deterministic Math for the game sandbox so a run is reproducible (the game uses Math.random for
// spawns/collisions/pickups; without a seed, random asteroid hits set the same invuln window that
// absorbs the test's manual hurt() calls → the "dies after enough hits" check was flaky).
function makeSeededMath(seed) {
  let s = (seed >>> 0) || 0x2545f491;
  const m = Object.create(Math);
  m.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return m;
}
function runGame(file, { search = '' } = {}) {
  // a file token may carry its own query (e.g. 'roguelite.html?prog=shop') — the knobs that
  // used to be separate files. Split it off and merge into the mocked location.search.
  const qi = file.indexOf('?');
  if (qi >= 0) { const fq = file.slice(qi + 1); file = file.slice(0, qi); search = search ? (search + '&' + fq) : ('?' + fq); }
  // game files live in levels/; tests still pass basenames
  let p = path.join(DIR, file);
  if (!fs.existsSync(p)) p = path.join(DIR, 'levels', file);
  const html = fs.readFileSync(p, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in ' + file);
  const code = m[1];

  const elCache = {};
  const getEl = (id) => (elCache[id] ||= makeEl(id));
  // canvas needs getContext
  const handlers = {};
  let rafQ = []; // multiple concurrent rAF callbacks (game loop + menu-backdrop loop), like a real browser
  let clock = 1000;
  const errors = [];

  const store = {};
  const posted = [];
  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    performance: { now: () => clock },
    __test: undefined, LEVELS: undefined,
  };
  win.parent = { postMessage: (m) => posted.push(m) }; // simulate being inside the launcher iframe
  const documentMock = {
    getElementById: getEl,
    createElement: (tag) => makeEl('new-' + tag),
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    querySelectorAll: () => [],
    body: makeEl('body'),
  };
  const sandbox = {
    window: win, document: documentMock,
    location: { search }, localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    performance: win.performance,
    requestAnimationFrame: (cb) => { rafQ.push(cb); return rafQ.length; },
    cancelAnimationFrame: () => {},
    URLSearchParams, Math: makeSeededMath(0x1234abcd), JSON, String, Number, Array, Object, parseInt, parseFloat,
    isFinite, isNaN, Date, console,
    navigator: { userAgent: 'test' },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  // preload the shared game-kit so window.gamekit exists before the game's inline script (mirrors the <head> load order)
  try { vm.runInContext(fs.readFileSync(path.join(DIR, '..', '..', 'game-kit.js'), 'utf8'), ctx, { filename: 'game-kit.js' }); }
  catch (e) { errors.push('kit boot: ' + e.message); }

  try { vm.runInContext(code, ctx, { filename: file }); }
  catch (e) { errors.push('boot: ' + e.message); }

  const api = {
    file, errors, store, posted,
    el: getEl,
    test: () => win.__test,
    key(type, key) { (handlers[type] || []).forEach(fn => { try { fn({ key, preventDefault() {} }); } catch (e) { errors.push(type + ' ' + key + ': ' + e.stack); } }); },
    down(k) { this.key('keydown', k); }, up(k) { this.key('keyup', k); },
    step(n = 1) { for (let i = 0; i < n; i++) { clock += 1000 / 60; const q = rafQ; rafQ = []; q.forEach(cb => { try { cb(); } catch (e) { errors.push('frame: ' + e.stack); } }); } },
    // drive a viewport change: the kit's __emit sets window dims + fires the layout callbacks (the
    // game's resize()) synchronously; fall back to setting dims directly if the kit is absent.
    resize(w, h) { if (win.gamekit && win.gamekit.layout && win.gamekit.layout.__emit) win.gamekit.layout.__emit(w, h); else { win.innerWidth = w; win.innerHeight = h; } },
    get clock() { return clock; },
  };
  return api;
}

// ---------------- Classic / Enhanced smoke tests ----------------
function smokeClassic(file, { enhanced = false } = {}) {
  section(file + ' (smoke)');
  const g = runGame(file);
  ok(g.errors.length === 0, file + ' boots without error: ' + g.errors[0]);
  g.step(10);
  // start
  g.down('Enter');
  g.step(2);
  ok(g.el('game') != null, file + ' has canvas');
  // overlay should be hidden after starting
  ok(g.el('overlay').classList.contains('hidden'), file + ' overlay hides on start');
  // simulate play: rotate, thrust, shoot for a while
  g.down('ArrowUp'); g.down(' ');
  g.step(120);
  g.up(' '); g.down('ArrowLeft'); g.step(60); g.up('ArrowLeft');
  g.down('ArrowRight'); g.step(60);
  ok(g.errors.length === 0, file + ' runs 240 frames of input without error: ' + g.errors[0]);
  const score = parseInt(g.el('score').textContent, 10);
  ok(Number.isFinite(score), file + ' score is numeric (' + g.el('score').textContent + ')');
  // weapon tiers are Enhanced-only: bare Classic hides the weapon HUD and never upgrades
  ok(enhanced ? (g.el('weapon').style.display !== 'none') : (g.el('weapon').style.display === 'none'),
    file + (enhanced ? ' shows weapon HUD' : ' hides weapon HUD (no tiers)'));
  if (enhanced) {
    // pause toggle
    g.down('Escape'); g.step(1);
    ok(g.el('overlay').classList.contains('hidden') === false, file + ' ESC shows pause overlay');
    ok(/QUIT TO MENU/.test(g.el('overlay').innerHTML), file + ' pause has Quit-to-menu button');
    g.el('menuBtn').fire('click');
    ok(g.posted.includes('asteroids:menu'), file + ' pause Quit posts to parent');
    g.down('Escape'); g.step(1);
    ok(g.el('overlay').classList.contains('hidden') === true, file + ' ESC again resumes');
  }
}

function smokeSpeedrun(file) {
  section(file + ' (speedrun smoke)');
  const g = runGame(file, { search: '?speedrun=1' });
  ok(g.errors.length === 0, file + ' speedrun boots: ' + g.errors[0]);
  ok(g.el('timer').style.display === 'block', file + ' speedrun shows timer');
  g.down('Enter'); g.step(60);
  const t = g.el('timerVal').textContent;
  ok(/^\d\d:\d\d\.\d\d$/.test(t), file + ' timer formats mm:ss.cs (got ' + t + ')');
  ok(t !== '00:00.00', file + ' timer advances during play (got ' + t + ')');
}

// ---------------- Roguelite deep tests ----------------
function rogueCommon(file, prog) {
  section(file + ' (roguelite ' + prog + ')');
  const g = runGame(file);
  ok(g.errors.length === 0, file + ' boots: ' + g.errors[0]);
  const T = () => g.test();
  ok(T() != null, file + ' exposes __test');
  ok(T().progression === prog, file + ' progression=' + prog);

  T().start();
  g.step(2);
  ok(T().state === 'playing', file + ' enters playing on start');
  ok(T().wave === 1, file + ' starts wave 1');
  ok(T().enemies > 0, file + ' wave 1 spawns enemies');
  ok(T().hp === 3, file + ' starts with 3 HP');

  // run some frames with input, no error
  g.down('ArrowUp'); g.down(' '); g.step(120); g.up('ArrowUp'); g.up(' ');
  ok(g.errors.length === 0, file + ' 120 frames of combat run clean: ' + g.errors[0]);

  // damage model: hurt to death
  let guard = 0;
  while (T().state === 'playing' && guard++ < 20) { T().hurt(); g.step(130); }
  ok(T().state === 'dead', file + ' dies after enough hits');
  ok(T().menu() != null, file + ' shows the kit game-over menu');

  // restart
  g.down('Enter'); g.step(2);
  ok(T().state === 'playing', file + ' restarts from game over');
  return g;
}

function testUpgradesApply(file) {
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  // force a pick and choose option 0
  T().forcePick(); g.step(1);
  ok(T().state === 'levelup', file + ' forcePick opens picker');
  const before = T().upgrades;
  T().pick(0); g.step(2);
  ok(T().state === 'playing', file + ' picking resumes play');
  const after = T().upgrades;
  const grew = Object.keys(after).some(k => (after[k] || 0) > (before[k] || 0));
  ok(grew, file + ' chosen upgrade count increased');
}

function testAutoWeapons(file) {
  section(file + ' (auto-weapons: drone/orbital/nova)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().giveUpgrade('drone'); T().giveUpgrade('orbital'); T().giveUpgrade('nova');
  ok(T().upgrades.drone === 1 && T().upgrades.orbital === 1 && T().upgrades.nova === 1, file + ' drone/orbital/nova applied');
  // run long enough for drones to acquire targets & fire, orbitals to collide, nova to pulse
  g.step(400);
  ok(g.errors.length === 0, file + ' auto-weapons run 400 frames without error: ' + g.errors[0]);
}

function testWaveAdvance(file) {
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  ok(T().wave === 1, file + ' on wave 1');
  T().clearEnemies(); g.step(120); // wave break ~90 then next wave
  ok(T().wave === 2, file + ' advances to wave 2 after clearing (got ' + T().wave + ')');
}

function testShop(file) {
  section(file + ' (shop flow)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().addCredits(100);
  T().clearEnemies(); g.step(5);
  ok(T().state === 'shop', file + ' opens shop on wave clear (got ' + T().state + ')');
  const before = T().upgrades; const credBefore = T().credits;
  T().buy(0); g.step(1);
  const after = T().upgrades;
  const grew = Object.keys(after).some(k => (after[k] || 0) > (before[k] || 0));
  ok(grew, file + ' buying adds an upgrade');
  ok(T().credits < credBefore, file + ' buying spends credits (' + credBefore + '->' + T().credits + ')');
  T().continueShop(); g.step(2);
  ok(T().state === 'playing', file + ' continue closes shop');
  ok(T().wave === 2, file + ' shop continue advances to wave 2 (got ' + T().wave + ')');
}

function testMilestonePick(file) {
  section(file + ' (milestone pick)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().addScore(800); g.step(1); // crosses first milestone (700)
  ok(T().state === 'levelup', file + ' milestone opens picker (got ' + T().state + ')');
  T().pick(0); g.step(2);
  ok(T().state === 'playing', file + ' milestone pick resumes');
}

function testSpeedrunWin(file, prog) {
  section(file + ' (speedrun win)');
  const g = runGame(file, { search: '?speedrun=1' });
  const T = () => g.test();
  ok(T().speedrun === true, file + ' speedrun flag set');
  T().start(); g.step(30);
  T().gotoWave(5); g.step(2);
  ok(g.el('timer').style.display === 'block', file + ' timer visible');
  T().killBossNow(); g.step(2);
  ok(T().state === 'won', file + ' clearing wave-5 boss wins the speedrun (got ' + T().state + ')');
  const best = pbTime(g.store, plabel(prog, true));
  ok(best > 0, file + ' best time saved (' + best + ')');
  // a cleared speedrun shares the TIME as the result, not the score or a Roguelite/Victory line
  const sm = T().shareMsg();
  ok(/Speedrun/.test(sm) && /\d\d:\d\d\.\d\d/.test(sm) && !/VICTORY|Roguelite|Level-up/.test(sm),
    file + ' speedrun-win share leads with time (got "' + sm + '")');
}

function testMagnet(file) {
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  ok(T().magnet >= 100, file + ' default magnet range improved (got ' + T().magnet + ')');
}

function testWave5BossVisible(file) {
  section(file + ' (wave 5 boss spawns visible)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  // advance naturally 1->5 by clearing each wave (shop mode advances via the shop)
  for (let w = 0; w < 4; w++) { T().clearEnemies(); g.step(8); if (T().state === 'shop') T().continueShop(); g.step(150); }
  ok(T().wave === 5, file + ' reaches wave 5 naturally (got ' + T().wave + ')');
  ok(T().enemies === 1, file + ' wave 5 has the boss (enemies=' + T().enemies + ')');
  ok(T().bossY != null && T().bossY > 0 && T().bossY < 800, file + ' boss spawns on-screen (y=' + T().bossY + ')');
  ok(/left/.test(T().waveLabel), file + ' HUD shows remaining-enemy count ("' + T().waveLabel + '")');
}

function testWave4Clearable(file) {
  section(file + ' (wave 4 sentries stay on-screen / clearable)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().gotoWave(4); g.step(2);
  ok(T().enemies > 0, file + ' wave 4 spawns enemies');
  g.step(600); // let sentries drift; none must get stranded off-screen
  ok(T().strandedEnemies === 0, file + ' no enemy stranded off-screen at wave 4 (got ' + T().strandedEnemies + ')');
}

function testKeyboardPicker(file) {
  section(file + ' (keyboard picker)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().forcePick(); g.step(1);
  ok(T().state === 'levelup' && T().menu() != null, file + ' picker open (kit menu)');
  ok(T().picks.length >= 2, file + ' picker has options');
  const chosen = T().picks[1];
  g.down('ArrowRight'); g.step(1);   // focus starts on the 1st card; move to the 2nd
  g.down('Enter'); g.step(2);         // pick the focused card
  ok(T().state === 'playing', file + ' Enter confirms and resumes');
  ok((T().upgrades[chosen] || 0) >= 1, file + ' Enter applied the focused upgrade (' + chosen + ')');
}

function testMenuButton(file) {
  section(file + ' (quit to menu)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  g.down('Escape'); g.step(1); // pause
  ok(/QUIT TO MENU/.test(g.el('overlay').innerHTML), file + ' pause menu has a Quit-to-menu button');
  g.el('menuBtn').fire('click');
  ok(g.posted.includes('asteroids:menu'), file + ' clicking Quit posts asteroids:menu to parent');
}

function testKeyboardShopNav(file) {
  section(file + ' (keyboard shop nav)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().addCredits(200);
  T().clearEnemies(); g.step(5);
  ok(T().state === 'shop' && T().menu() != null, file + ' shop open (kit menu)');
  // focus opens on the primary Continue; move onto a shop item, then Space buys the focused item
  const credBefore = T().credits;
  g.down('ArrowLeft'); g.step(1);
  g.down(' '); g.step(1); g.up(' ');
  const bought = Object.values(T().upgrades).some(v => v >= 1);
  ok(bought && T().credits < credBefore, file + ' Space buys the focused item');
  // Continue advances to the next wave
  T().menu().activate('continue'); g.step(2);
  ok(T().state === 'playing' && T().wave === 2, file + ' Continue advances to the next wave (got state=' + T().state + ' wave=' + T().wave + ')');
}

function testPauseButton(file) {
  section(file + ' (pause button routes to the game menu — no double pause)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  ok(T().state === 'playing', file + ' playing after start');
  g.el('gamekitPause').fire('click'); g.step(1);   // the kit ⏸ button must drive the game's menu-pause…
  ok(T().state === 'paused' && T().menu() != null, file + ' ⏸ opens the game pause menu (state=' + T().state + ')');
  g.down('Escape'); g.step(1);                       // …so Esc just resumes it (no second, stacked menu)
  ok(T().state === 'playing' && T().menu() == null, file + ' Esc resumes cleanly — no stacked pause menu');
}
function testTieredPricing(file) {
  section(file + ' (tiered shop pricing)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().addCredits(99999);
  T().clearEnemies(); g.step(5);
  ok(T().state === 'shop', file + ' shop open');
  const c0 = T().shopCostOf('rapid');
  T().buy(0); g.step(1);               // buy rapid (item 0) once
  const c1 = T().shopCostOf('rapid');
  ok(c1 > c0, file + ' next tier costs more (' + c0 + ' -> ' + c1 + ')');
}

function testBulletsClearOnWave(file) {
  section(file + ' (bullets clear on new wave)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  g.down(' '); g.step(20); g.up(' ');   // fire a stream
  ok(T().bulletCount > 0, file + ' bullets present mid-wave (' + T().bulletCount + ')');
  T().gotoWave(2); g.step(1);
  ok(T().bulletCount === 0, file + ' bullets cleared at wave start (' + T().bulletCount + ')');
}

function testHealthPickup(file) {
  section(file + ' (health pickup heals)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().hurt(); g.step(2);                 // drop to 2 HP
  ok(T().hp === 2, file + ' took 1 damage (hp=' + T().hp + ')');
  T().spawnPickup('repair'); g.step(2);  // spawns at ship -> collected immediately
  ok(T().hp === 3, file + ' repair pickup restored HP (hp=' + T().hp + ')');
  ok(T().pickupCount === 0, file + ' pickup consumed');
}

function testAutoFire(file) {
  section(file + ' (auto-fire upgrade)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().giveUpgrade('auto');
  ok(T().autoFire === true, file + ' auto-fire enabled');
  g.step(30);                            // no Space held
  ok(T().bulletCount > 0, file + ' ship fires automatically without holding Space');
}

function testBossScaling(file) {
  section(file + ' (boss HP scales with wave)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().gotoWave(5); g.step(2); const hp5 = T().bossHp;
  T().gotoWave(15); g.step(2); const hp15 = T().bossHp;
  ok(hp5 > 0 && hp15 > hp5 * 2, file + ' wave-15 boss much tougher than wave-5 (' + hp5 + ' -> ' + hp15 + ')');
}

function testWASD(file) {
  section(file + ' (WASD controls)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  const a0 = T().shipAngle;
  g.down('d'); g.step(5); g.up('d');
  ok(T().shipAngle > a0, file + ' D rotates right (' + a0.toFixed(2) + ' -> ' + T().shipAngle.toFixed(2) + ')');
  const a1 = T().shipAngle;
  g.down('a'); g.step(5); g.up('a');
  ok(T().shipAngle < a1, file + ' A rotates left');
  // WASD must also navigate the kit upgrade picker (D = ArrowRight): move to the 2nd card + pick it
  T().forcePick(); g.step(1);
  if (T().state === 'levelup' && T().picks.length >= 2) {
    const chosen = T().picks[1];
    g.down('d'); g.step(1); g.up('d');
    g.down('Enter'); g.step(2);
    ok((T().upgrades[chosen] || 0) >= 1, file + ' D navigates + picks in the upgrade picker (' + chosen + ')');
  }
}

function testSaveOnQuit(file, prog) {
  section(file + ' (best score saved on quit)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().addScore(500); g.step(1);
  T().quitToMenu();                      // quit mid-run (never died)
  const sc = pbScore(g.store, plabel(prog, false));
  ok(sc >= 500, file + ' score persisted on quit (' + sc + ')');
}

function testStressManyWaves(file, prog) {
  section(file + ' (stress: all upgrades, waves 1→13)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  // max every upgrade
  for (const u of ['rapid','spread','heavy','long','pierce','shield','hull','thrust','orbital','drone','nova','magnet']) {
    for (let i = 0; i < 6; i++) T().giveUpgrade(u);
  }
  g.step(2);
  for (let w = 1; w <= 13; w++) {
    T().gotoWave(w); g.step(2);
    ok(T().enemies > 0, file + ' wave ' + w + ' has enemies (got ' + T().enemies + ')');
    g.step(200); // let everything (drones/orbitals/nova/boss) run
    ok(g.errors.length === 0, file + ' wave ' + w + ' runs 200 frames without error: ' + (g.errors[0] || ''));
    if (g.errors.length) break;
  }
}

function testShopProgression(file) {
  section(file + ' (shop: 8 waves, economy)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  let firstShopCredits = null;
  for (let w = 1; w <= 8; w++) {
    ok(T().enemies > 0 || (w % 5 === 0), file + ' wave ' + w + ' spawned enemies');
    T().clearEnemies(); g.step(5);
    ok(T().state === 'shop', file + ' shop opens after wave ' + w + ' (got ' + T().state + ')');
    if (firstShopCredits == null) firstShopCredits = T().credits;
    T().continueShop(); g.step(3);
    ok(T().state === 'playing', file + ' resumes after shop ' + w);
    ok(T().wave === w + 1, file + ' advanced to wave ' + (w + 1) + ' (got ' + T().wave + ')');
  }
  // economy sanity: clearing one full early wave should NOT bankroll a fortune
  console.log('    (credits after wave 1 clear: ' + firstShopCredits + ')');
}

function testLauncher() {
  section('index.html (launcher)');
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  ok(!!m, 'launcher has inline script');
  const verCode = fs.readFileSync(path.join(DIR, 'levels.js'), 'utf8');
  const elCache = {};
  const getEl = id => (elCache[id] ||= makeEl(id));
  const winHandlers = {};
  const win = { addEventListener: (t, fn) => { (winHandlers[t] ||= []).push(fn); }, LEVELS: undefined, innerWidth: 1280, innerHeight: 800, confirm: () => true };
  const documentMock = { getElementById: getEl, createElement: t => makeEl('new-' + t), addEventListener: () => {} };
  const store = {};
  const sandbox = { window: win, document: documentMock, location: { search: '' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
      get length() { return Object.keys(store).length; }, key: i => Object.keys(store)[i] ?? null },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setInterval: () => 0, clearInterval: () => {},
    Math, JSON, String, Number, Array, Object, parseInt, parseFloat, console, URLSearchParams };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  let bootErr = null;
  try {
    vm.runInContext(fs.readFileSync(path.join(DIR, '..', '..', 'game-kit.js'), 'utf8'), ctx, { filename: 'game-kit.js' });
    vm.runInContext(verCode, ctx, { filename: 'levels.js' }); vm.runInContext(m[1], ctx, { filename: 'index.html' });
  }
  catch (e) { bootErr = e.message; }
  ok(bootErr === null, 'launcher boots: ' + bootErr);
  ok(Array.isArray(win.LEVELS) && win.LEVELS.length === 5, 'levels.js exposes 5 versions (got ' + (win.LEVELS && win.LEVELS.length) + ')');
  const cards = getEl('cards');
  // two rows: [label, classic-row, label, roguelite-row]
  const rows = cards.children.filter(c => c.className === 'crow');
  ok(rows.length === 2, 'launcher renders two rows (got ' + rows.length + ')');
  const classicCount = (win.LEVELS || []).filter(v => v.tag === 'CLASSIC').length;
  const rogueCount = (win.LEVELS || []).filter(v => v.tag === 'ROGUELITE').length;
  ok(rows[0] && rows[0].children.length === classicCount, 'classic row has ' + classicCount + ' cards (got ' + (rows[0] && rows[0].children.length) + ')');
  ok(rows[1] && rows[1].children.length === rogueCount, 'roguelite row has ' + rogueCount + ' cards (got ' + (rows[1] && rows[1].children.length) + ')');
  const totalCards = rows.reduce((n, r) => n + r.children.length, 0);
  ok(totalCards === 5, 'launcher renders 5 cards total (got ' + totalCards + ')');
  const toggle = getEl('modeToggle');
  ok(toggle.textContent === 'NORMAL', 'mode starts NORMAL (got ' + toggle.textContent + ')');
  toggle.fire('click');
  ok(toggle.textContent === 'SPEEDRUN', 'toggle switches to SPEEDRUN');
  // launch the first card (first classic version) in speedrun mode
  const frame = getEl('frame');
  const firstVersion = (win.LEVELS || []).find(v => v.tag === 'CLASSIC');
  cards.children.filter(c => c.className === 'crow')[0].children[0].fire('click');
  ok(frame.src === firstVersion.file + '?speedrun=1', 'card launches version with speedrun param (got ' + frame.src + ')');
  ok(getEl('frameWrap').style.display === 'block', 'frame shown on launch');
  // quit to menu: the in-game pause "QUIT TO MENU" posts 'asteroids:menu'; the launcher returns to select
  (winHandlers['message'] || []).forEach(fn => fn({ data: 'asteroids:menu' }));
  ok(frame.src === 'about:blank', 'in-game Quit-to-menu clears the iframe');
  ok(getEl('select').style.display === 'flex', 'in-game Quit-to-menu returns to menu');
  // reset best scores: the bespoke reset button is gone — the launcher wires the game-kit
  // sound menu's Reset entry via gamekit.nav({ reset: 'asteroids_' }), which clears asteroids_* keys.
  const fb = (win.LEVELS[0].file).split('/').pop();
  store['asteroids_score_' + fb] = '1234';
  store['asteroids_best_' + fb] = '9999';
  store['unrelated_key'] = 'keep';
  ok(typeof win.gamekit === 'object' && typeof win.gamekit.resetScores === 'function', 'game-kit loaded with resetScores');
  win.gamekit.resetScores('asteroids_');
  ok(store['asteroids_score_' + fb] == null && store['asteroids_best_' + fb] == null, 'kit resetScores clears saved asteroids_ bests');
  ok(store['unrelated_key'] === 'keep', 'kit resetScores leaves unrelated keys');
}

// ---------------- Run ----------------
// Asteroids+ is the de-iframed roguelite game: one engine (index.html), variant via ?prog=.
// ---- bounded power: lowered caps ----
function testUpgradeCaps(file) {
  section(file + ' (upgrade caps lowered)');
  const g = runGame(file); const T = () => g.test();
  T().start(); g.step(2);
  const caps = { heavy: 5, spread: 2, rapid: 3, shield: 2, hull: 2 };
  for (const id in caps) {
    for (let i = 0; i < 6; i++) T().giveUpgrade(id);
    ok((T().upgrades[id] || 0) === caps[id], file + ' ' + id + ' caps at ' + caps[id] + ' (got ' + (T().upgrades[id] || 0) + ')');
  }
}

// ---- expiring offensive upgrades: lapse after 10 waves, refresh on re-pick ----
function testExpiry(file) {
  section(file + ' (offensive upgrades expire after 10 waves)');
  const g = runGame(file); const T = () => g.test();
  T().start(); g.step(2);                         // wave 1
  const EW = T().expireWaves;
  T().giveUpgrade('heavy');                        // picked at wave 1 → active through wave 1+EW
  ok((T().upgrades.heavy || 0) === 1, file + ' heavy applied (got ' + (T().upgrades.heavy || 0) + ')');
  T().gotoWave(1 + EW); g.step(2);
  ok((T().upgrades.heavy || 0) === 1, file + ' heavy still active at wave ' + (1 + EW) + ' (got ' + (T().upgrades.heavy || 0) + ')');
  T().gotoWave(1 + EW + 1); g.step(2);
  ok(!(T().upgrades.heavy), file + ' heavy has lapsed by wave ' + (1 + EW + 1) + ' (got ' + (T().upgrades.heavy || 0) + ')');
  // hull is permanent — never expires
  T().gotoWave(1); g.step(2); T().giveUpgrade('hull'); T().gotoWave(20); g.step(2);
  ok((T().upgrades.hull || 0) === 1, file + ' permanent hull survives to wave 20 (got ' + (T().upgrades.hull || 0) + ')');
}
function testExpiryRefresh(file) {
  section(file + ' (re-pick refreshes / renews at cap)');
  const g = runGame(file); const T = () => g.test();
  T().start(); g.step(2);
  const EW = T().expireWaves;
  for (let i = 0; i < 3; i++) T().giveUpgrade('rapid');     // wave 1: 3 stacks all lapse after 1+EW
  ok((T().upgrades.rapid || 0) === 3, file + ' rapid at cap 3');
  T().gotoWave(3); g.step(2);                                // still within the window (needs EW>=2)
  T().giveUpgrade('rapid');                                  // at cap → renews soonest stack to wave 3+EW
  const exp = T().upExpiry.rapid || [];
  ok((T().upgrades.rapid || 0) === 3, file + ' rapid stays at cap after renew (got ' + (T().upgrades.rapid || 0) + ')');
  ok(exp.indexOf(3 + EW) >= 0, file + ' a rapid stack was renewed to wave ' + (3 + EW) + ' (exp=' + JSON.stringify(exp) + ')');
}

// ---- staggered dual-boss finale + finite victory at wave 30 ----
function testFinaleStagger(file) {
  section(file + ' (wave-30 dual boss is staggered)');
  const g = runGame(file); const T = () => g.test();
  T().start(); T().gotoWave(30); g.step(2);
  ok(T().bossCount === 1, file + ' finale starts with one boss (got ' + T().bossCount + ')');
  ok(T().finalePending === true, file + ' second boss pending');
  T().setBossHp(0.4); g.step(3);                             // drop first below half → second joins
  ok(T().bossCount === 2, file + ' second boss joins below 50% (got ' + T().bossCount + ')');
  ok(T().finalePending === false, file + ' finale no longer pending');
}
function testVictory(file) {
  section(file + ' (beating wave 30 wins the run)');
  const g = runGame(file); const T = () => g.test();
  T().start(); T().gotoWave(30); g.step(2);
  T().killBossNow();                                         // kills first → spawns second → kills second
  ok(T().bossCount === 0, file + ' both finale bosses down (got ' + T().bossCount + ')');
  g.step(120);
  ok(T().state === 'won', file + ' run is won after wave 30 (got ' + T().state + ')');
}

// ---- buff-pickup cap actually holds (boss kind always drops) ----
function testPickupCap(file) {
  section(file + ' (buff-pickup cap holds)');
  const g = runGame(file); const T = () => g.test();
  T().start(); g.step(2);
  for (let i = 0; i < 30; i++) T().dropReward('boss');   // boss drops bypass the chance gate
  ok(T().pickupCount <= T().maxPickups, file + ' buff pickups never exceed ' + T().maxPickups + ' (got ' + T().pickupCount + ')');
}

// ---- kamikaze: spawns, and blast damages the ship only when close ----
function testKamikaze(file) {
  section(file + ' (kamikaze drifts in + explodes)');
  const g = runGame(file); const T = () => g.test();
  T().start(); g.step(2);
  T().gotoWave(6); g.step(2);
  ok(T().kamikazeCount > 0, file + ' kamikazes spawn on a normal wave (got ' + T().kamikazeCount + ')');
  // FAR kill: ship unharmed
  T().clearEnemies(); T().setInvuln(0);
  const hpBefore = T().hp;
  T().spawnKamikazeAt(5, 5); T().killKamikazeAt(0);
  ok(T().hp === hpBefore, file + ' killing a distant kamikaze does no damage (hp ' + hpBefore + '->' + T().hp + ')');
  // CLOSE kill: ship takes the blast
  T().setInvuln(0);
  const hp2 = T().hp;
  T().spawnKamikazeAt(T().shipX, T().shipY); T().killKamikazeAt(0);
  ok(T().hp === hp2 - 1, file + ' a point-blank kamikaze blast costs 1 HP (hp ' + hp2 + '->' + T().hp + ')');
}

// ---- bullet aim assist: a near-miss curves toward the enemy ----
function testAimAssist(file) {
  section(file + ' (bullet aim assist)');
  const g = runGame(file); const T = () => g.test();
  T().start(); T().clearEnemies();
  T().spawnAsteroidAt(300, 300, 1);                 // size-1 asteroid, r=18, at (300,300)
  const v = T().assistVel(300, 325, 8, 0);          // bullet 25px below center (inside r+12=30, outside r=18), moving +x
  ok(v.vy < 0, file + ' assist curves the near-miss toward the asteroid (vy=' + v.vy.toFixed(2) + ')');
  const v2 = T().assistVel(0, 0, 8, 0);             // far away → untouched
  ok(v2.vy === 0 && v2.vx === 8, file + ' a far bullet is not steered');
}

// testMenuButton is launcher-specific (quit now navigates in-page, not postMessage) — dropped;
// testSaveOnQuit still covers save-on-quit.
console.log('Running Asteroids+ headless tests…');

for (const [file, prog] of [['index.html?prog=levelup', 'levelup'], ['index.html?prog=milestones', 'milestones'], ['index.html?prog=shop', 'shop']]) {
  rogueCommon(file, prog);
  if (prog !== 'shop') testWaveAdvance(file); // shop mode advances via the shop screen (see testShop)
  testUpgradesApply(file);
  testAutoWeapons(file);
  testWave5BossVisible(file);
  testWave4Clearable(file);
  testBulletsClearOnWave(file);
  testSaveOnQuit(file, prog);
  testWASD(file);
  testHealthPickup(file);
  testAutoFire(file);
  testBossScaling(file);
  testStressManyWaves(file, prog);
  testSpeedrunWin(file, prog);
}
testMagnet('index.html?prog=levelup');
testKeyboardPicker('index.html?prog=levelup');
testKeyboardPicker('index.html?prog=milestones');
testKeyboardShopNav('index.html?prog=shop');
testPauseButton('index.html?prog=levelup');
testShop('index.html?prog=shop');
testShopProgression('index.html?prog=shop');
testTieredPricing('index.html?prog=shop');
testMilestonePick('index.html?prog=milestones');
testUpgradeCaps('index.html?prog=levelup');
testExpiry('index.html?prog=levelup');
testExpiryRefresh('index.html?prog=levelup');
testFinaleStagger('index.html?prog=levelup');
testVictory('index.html?prog=levelup');
testVictory('index.html?prog=shop');
testPickupCap('index.html?prog=levelup');
testPickupCap('index.html?prog=shop');
testKamikaze('index.html?prog=levelup');
testAimAssist('index.html?prog=levelup');

// ---------------- Layout: everything on-screen + clears the top HUD, in portrait / landscape / desktop ----------------
function testLayoutFits(file) {
  section(file + ' (layout fits the screen — on-screen + no HUD overlap)');
  const VIEWPORTS = [
    { name: 'portrait phone', w: 390, h: 780 },
    { name: 'landscape phone', w: 780, h: 390 },
    { name: 'desktop', w: 1280, h: 800 },
  ];
  for (const v of VIEWPORTS) {
    const g = runGame(file);
    const T = () => g.test();
    T().start(); g.step(2);
    g.resize(v.w, v.h); g.step(1); // relayout (the game's resize fires via the kit) + one frame
    // the canvas is a viewport-scaled buffer (CSS stretches it to 100vw/100vh); compute the same
    // scale the game uses so we assert canvas == viewport in this game's actual model.
    const m = Math.min(v.w, v.h), S = m < 640 ? Math.min(2.6, 900 / m) : 1;
    const expW = Math.round(v.w * S), expH = Math.round(v.h * S);
    const L = T().layout;
    ok(L.W === expW && L.H === expH, v.name + ': canvas fills viewport (' + L.W + 'x' + L.H + ' == ' + expW + 'x' + expH + ' @S=' + S.toFixed(2) + ')');
    ok(L.topReserve > 0, v.name + ': HUD reservation computed (' + L.topReserve + 'px)');
    // ship sits on-screen within the canvas
    ok(L.shipTop >= 0 && L.shipBottom <= L.H, v.name + ': ship within height (' + Math.round(L.shipTop) + '..' + Math.round(L.shipBottom) + ' in 0..' + L.H + ')');
    ok(L.shipLeft >= 0 && L.shipRight <= L.W, v.name + ': ship within width (' + Math.round(L.shipLeft) + '..' + Math.round(L.shipRight) + ' in 0..' + L.W + ')');

    // boss is the top-most JS-drawn element — it must spawn fully on-screen AND clear the top HUD pill
    T().gotoWave(5); g.step(2);
    const B = T().layout;
    ok(B.bossTop != null, v.name + ': boss present at wave 5');
    ok(B.bossTop >= 0 && B.bossBottom <= B.H, v.name + ': boss within height (' + Math.round(B.bossTop) + '..' + Math.round(B.bossBottom) + ' in 0..' + B.H + ')');
    ok(B.bossLeft >= 0 && B.bossRight <= B.W, v.name + ': boss within width (' + Math.round(B.bossLeft) + '..' + Math.round(B.bossRight) + ' in 0..' + B.W + ')');
    ok(B.bossTop >= B.topReserve, v.name + ': boss clears the top HUD (bossTop ' + Math.round(B.bossTop) + ' >= topReserve ' + B.topReserve + ')');
    // and it stays clear after it drifts (the bounce clamp must respect the reservation, not just y>80)
    g.step(400);
    const B2 = T().layout;
    if (B2.bossTop != null) ok(B2.bossTop >= B2.topReserve, v.name + ': boss stays clear of the HUD after drifting (bossTop ' + Math.round(B2.bossTop) + ' >= ' + B2.topReserve + ')');
  }
}
testLayoutFits('index.html?prog=levelup');

console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
