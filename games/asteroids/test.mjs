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

function runGame(file, { search = '' } = {}) {
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
  let pending = null;
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
    requestAnimationFrame: (cb) => { pending = cb; return 1; },
    cancelAnimationFrame: () => {},
    URLSearchParams, Math, JSON, String, Number, Array, Object, parseInt, parseFloat,
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
    step(n = 1) { for (let i = 0; i < n; i++) { clock += 1000 / 60; const cb = pending; pending = null; if (cb) { try { cb(); } catch (e) { errors.push('frame: ' + e.stack); } } } },
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
  ok(g.el('overlay').classList.contains('hidden') === false, file + ' shows game over overlay');

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
  T().addScore(600); g.step(1); // crosses first milestone (500)
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
  const best = g.store['asteroids_best_' + file];
  ok(best != null && parseInt(best, 10) > 0, file + ' best time saved (' + best + ')');
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
  ok(T().state === 'levelup', file + ' picker open');
  ok(T().picks.length >= 2, file + ' picker has options');
  ok(T().sel === 0, file + ' selection starts at 0');
  g.down('ArrowRight'); g.step(1);
  ok(T().sel === 1, file + ' ArrowRight moves selection (got ' + T().sel + ')');
  const chosen = T().picks[1];
  g.down('Enter'); g.step(2);
  ok(T().state === 'playing', file + ' Enter confirms and resumes');
  ok((T().upgrades[chosen] || 0) >= 1, file + ' Enter applied the highlighted upgrade (' + chosen + ')');
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
  ok(T().state === 'shop', file + ' shop open');
  // SPACE buys the highlighted item (sel starts at 0)
  const credBefore = T().credits;
  g.down(' '); g.step(1); g.up(' ');
  const bought = Object.values(T().upgrades).some(v => v >= 1);
  ok(bought && T().credits < credBefore, file + ' Space buys highlighted item');
  // ENTER always continues to the next wave
  g.down('Enter'); g.step(2);
  ok(T().state === 'playing' && T().wave === 2, file + ' Enter continues to the next wave (got state=' + T().state + ' wave=' + T().wave + ')');
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
  // WASD must also navigate the upgrade picker (same as arrows)
  T().forcePick(); g.step(1);
  if (T().state === 'levelup') {
    const s0 = T().sel;
    g.down('d'); g.step(1); g.up('d');
    ok(T().sel !== s0, file + ' D navigates the upgrade picker (' + s0 + ' -> ' + T().sel + ')');
  }
}

function testSaveOnQuit(file) {
  section(file + ' (best score saved on quit)');
  const g = runGame(file);
  const T = () => g.test();
  T().start(); g.step(2);
  T().addScore(500); g.step(1);
  T().quitToMenu();                      // quit mid-run (never died)
  const sc = parseInt(g.store['asteroids_score_' + file] || '0', 10);
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
console.log('Running Asteroids headless tests…');
testLauncher();

smokeClassic('classic.html');
smokeSpeedrun('classic.html');
smokeClassic('classic-enhanced.html', { enhanced: true });
smokeSpeedrun('classic-enhanced.html');

for (const [file, prog] of [['roguelite-levelup.html', 'levelup'], ['roguelite-milestones.html', 'milestones'], ['roguelite-shop.html', 'shop']]) {
  rogueCommon(file, prog);
  if (prog !== 'shop') testWaveAdvance(file); // shop mode advances via the shop screen (see testShop)
  testUpgradesApply(file);
  testAutoWeapons(file);
  testMenuButton(file);
  testWave5BossVisible(file);
  testWave4Clearable(file);
  testBulletsClearOnWave(file);
  testSaveOnQuit(file);
  testWASD(file);
  testHealthPickup(file);
  testAutoFire(file);
  testBossScaling(file);
  testStressManyWaves(file, prog);
  testSpeedrunWin(file, prog);
}
testMagnet('roguelite-levelup.html');
testKeyboardPicker('roguelite-levelup.html');
testKeyboardPicker('roguelite-milestones.html');
testKeyboardShopNav('roguelite-shop.html');
testShop('roguelite-shop.html');
testShopProgression('roguelite-shop.html');
testTieredPricing('roguelite-shop.html');
testMilestonePick('roguelite-milestones.html');

console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
