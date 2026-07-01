// Headless tests for Range (aim-trainer).
// Mocks DOM/canvas, runs the inline IIFE in a vm sandbox, drives via window.__test.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const KIT = fs.readFileSync(path.join(DIR, '../../game-kit.js'), 'utf8'); // shared kit, loaded before the game
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
    id, textContent: '', value: '', dataset: {}, children: [],
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
    fire: (type, ev = {}) => (el._l[type] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {}, ...ev })),
    appendChild: (c) => { el.children.push(c); return c; },
    _attrs: {},
    setAttribute: (k, v) => { el._attrs[k] = String(v); },
    getAttribute: (k) => (k in el._attrs ? el._attrs[k] : null),
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => makeCtx2d(),
    focus: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => _html, set: v => { _html = String(v ?? ''); if (!v) el.children = []; } });
  return el;
}

function makeModeBtns() {
  const modes = ['10', '30', '20', '60', 'sprint'];
  return modes.map(m => {
    const btn = makeEl('btn-' + m);
    btn.dataset = { mode: m };
    btn.className = m === '30' ? 'mode-btn selected' : 'mode-btn';
    btn.classList.contains = c => btn.className.includes(c);
    return btn;
  });
}

function runGame(file, dims) {
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in ' + file);
  const code = m[1];

  const elCache = {};
  const modeBtns = makeModeBtns();

  const getEl = (id) => {
    if (!elCache[id]) elCache[id] = makeEl(id);
    return elCache[id];
  };
  const store = {};
  const handlers = {};

  const win = {
    innerWidth: (dims && dims.w) || 1280, innerHeight: (dims && dims.h) || 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    __test: undefined,
  };

  const docMock = {
    getElementById: getEl,
    createElement: (tag) => makeEl('new-' + tag),
    addEventListener: () => {},
    querySelectorAll: (sel) => {
      if (sel === '.mode-btn') return modeBtns;
      return [];
    },
    body: makeEl('body'),
  };

  const sandbox = {
    window: win, document: docMock,
    location: { search: '' },
    navigator: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: (fn, ms) => 0,
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console,
    URLSearchParams,
  };
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  let bootErr = null;
  try { vm.runInContext(KIT, ctx, { filename: 'game-kit.js' }); vm.runInContext(code, ctx, { filename: file }); }
  catch (e) { bootErr = e.stack; }

  function resize(w, h) { if (win.gamekit && win.gamekit.layout && win.gamekit.layout.__emit) win.gamekit.layout.__emit(w, h); else { win.innerWidth = w; win.innerHeight = h; } }
  return { getEl, win, store, bootErr, resize, test: () => win.__test };
}

console.log('Running Range (aim-trainer) headless tests…');

section('boot');
const g = runGame('index.html');
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
const T = () => g.test();
ok(T() != null, 'exposes window.__test');

section('__test API surface');
ok(typeof T().state === 'string', 'state is a string');
ok(typeof T().score === 'number', 'score is a number');
ok(typeof T().hits === 'number', 'hits is a number');
ok(typeof T().misses === 'number', 'misses is a number');
ok(typeof T().accuracy === 'number', 'accuracy is a number');
ok(typeof T().timeLeft === 'number', 'timeLeft is a number');
ok(Array.isArray(T().targets), 'targets is an array');
ok(typeof T().start === 'function', 'start() exposed');
ok(typeof T().startMode === 'function', 'startMode() exposed');
ok(typeof T().shootAt === 'function', 'shootAt() exposed');
ok(typeof T().step === 'function', 'step() exposed');
ok(typeof T().setSeed === 'function', 'setSeed() exposed');
ok(typeof T().elapsed === 'number', 'elapsed getter exposed');
ok(typeof T().bestTime === 'number', 'bestTime getter exposed');
ok(typeof T().mode === 'string', 'mode getter exposed');

section('seeded RNG');
{
  function seededPositions(seed) {
    const gi = runGame('index.html');
    const Ti = () => gi.test();
    Ti().start();
    Ti().setSeed(seed);
    Ti().step(5);
    const first = Ti().targets[0];
    if (first) Ti().shootAt(first.x, first.y);
    Ti().step(1);
    return Ti().targets.map(t => t.x + ',' + t.y);
  }
  const run1 = seededPositions(7);
  const run2 = seededPositions(7);
  ok(JSON.stringify(run1) === JSON.stringify(run2), 'seeded RNG produces deterministic spawns (run1=' + run1 + ')');

  const gBounds = runGame('index.html');
  const Tb = () => gBounds.test();
  Tb().start();
  Tb().setSeed(0xffffffff);
  const firstTgt = Tb().targets[0];
  if (firstTgt) Tb().shootAt(firstTgt.x, firstTgt.y);
  Tb().step(1);
  const seededTgt = Tb().targets[0];
  if (seededTgt) {
    ok(seededTgt.x <= 1200 && seededTgt.x >= 80, 'seeded target x within spawn bounds (got ' + seededTgt.x + ')');
    ok(seededTgt.y <= 720 && seededTgt.y >= 128, 'seeded target y within spawn bounds (got ' + seededTgt.y + ')');
  }
}

section('initial state');
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
ok(T().score === 0, 'initial score is 0');
ok(T().hits === 0, 'initial hits is 0');
ok(T().misses === 0, 'initial misses is 0');

section('start → playing with target');
T().start();
ok(T().state === 'playing', 'start() → state is "playing"');
ok(T().targets.length >= 1, 'at least one target present after start');
const tgt = T().targets[0];
ok(typeof tgt.x === 'number' && typeof tgt.y === 'number' && tgt.r > 0, 'target has x,y,r fields');

section('start() defaults to timed 30s mode');
T().start();
ok(T().mode === 'timed', 'start() uses timed mode');
ok(T().timeLeft >= 29 && T().timeLeft <= 30, 'start() sets timeLeft to ~30 (got ' + T().timeLeft + ')');

section('hit: shootAt center of target');
T().start();
const t0 = T().targets[0];
T().step(10);
const scoreBefore = T().score;
const hitsBefore = T().hits;
T().shootAt(t0.x, t0.y);
ok(T().hits > hitsBefore, 'hits incremented after shootAt target center');
ok(T().score > scoreBefore, 'score increased after hit');

section('miss: shootAt empty space');
T().start();
T().step(5);
const missesBefore = T().misses;
T().shootAt(1, 1);
ok(T().misses > missesBefore, 'misses incremented after shooting empty space');

section('accuracy calculation');
T().start();
T().step(5);
const t1 = T().targets[0];
T().shootAt(t1.x, t1.y);  // hit
T().step(5);
T().shootAt(0, 0);          // miss (top-left corner, no target)
const acc = T().accuracy;
ok(Math.abs(acc - 0.5) < 0.01, 'accuracy = hits/(hits+misses) = 0.5 (got ' + acc + ')');

section('accuracy stays 0 with no shots');
T().start();
ok(T().accuracy === 0, 'accuracy 0 when no shots fired');

section('timed mode: step past session → game over at limit');
{
  const fps = 60;
  // test with 10s timed
  const g10 = runGame('index.html');
  const T10 = () => g10.test();
  T10().startMode(10);
  ok(T10().state === 'playing', 'startMode(10) → playing');
  ok(T10().timeLeft >= 9.9 && T10().timeLeft <= 10, 'timeLeft starts at ~10 (got ' + T10().timeLeft + ')');
  // step exactly 10s + a few frames
  T10().step(10 * fps + 5);
  ok(T10().state === 'over', 'state is "over" after 10s (got ' + T10().state + ')');
  ok(T10().timeLeft <= 0, 'timeLeft ≤ 0 at end of 10s mode (got ' + T10().timeLeft + ')');

  // verify 30s mode also works
  T().start();
  const sessionFrames = 30 * fps + 5;
  T().step(sessionFrames);
  ok(T().state === 'over', 'state becomes "over" after stepping past 30s session (got ' + T().state + ')');
  ok(T().timeLeft <= 0, 'timeLeft ≤ 0 at game over (got ' + T().timeLeft + ')');
}

section('sprint mode: ends after 100 targets hit');
{
  const gsp = runGame('index.html');
  const Ts = () => gsp.test();
  Ts().startMode('sprint');
  ok(Ts().state === 'playing', 'startMode("sprint") → playing');
  ok(Ts().mode === 'sprint', 'mode is "sprint"');
  ok(Ts().timeLeft === 0, 'sprint has no timeLeft countdown (got ' + Ts().timeLeft + ')');

  // drive hits until 100 targets are hit
  let safetyIter = 0;
  while (Ts().state === 'playing' && Ts().hits < 100 && safetyIter++ < 4000) {
    Ts().step(3);
    const tgt = Ts().targets[0];
    if (tgt) Ts().shootAt(tgt.x, tgt.y);
  }
  ok(Ts().state === 'over', 'sprint ends after 100 hits (hits=' + Ts().hits + ', state=' + Ts().state + ')');
  ok(Ts().hits >= 100, 'sprint hits is >= 100 at end (got ' + Ts().hits + ')');
  ok(Ts().elapsedFrames > 0, 'elapsedFrames > 0 after sprint (got ' + Ts().elapsedFrames + ')');
  ok(Ts().elapsed > 0, 'elapsed seconds > 0 after sprint (got ' + Ts().elapsed + ')');
}

section('sprint: best time persists to localStorage');
{
  const gsp2 = runGame('index.html');
  const Ts2 = () => gsp2.test();
  Ts2().startMode('sprint');
  let safetyIter = 0;
  while (Ts2().state === 'playing' && Ts2().hits < 100 && safetyIter++ < 4000) {
    Ts2().step(3);
    const tgt = Ts2().targets[0];
    if (tgt) Ts2().shootAt(tgt.x, tgt.y);
  }
  const savedTime = parseInt(gsp2.store['aim-trainer_sprint_100'] || '0', 10); // sprint best is now keyed per target count
  ok(savedTime > 0, 'sprint best time saved to localStorage (got ' + savedTime + ')');
  ok(Ts2().bestTime === savedTime, 'bestTime getter matches localStorage (bestTime=' + Ts2().bestTime + ', saved=' + savedTime + ')');
}

section('timed best score persists');
const g2 = runGame('index.html');
const T2 = () => g2.test();
T2().start();
T2().step(5);
const tgt2 = T2().targets[0];
for (let i = 0; i < 10; i++) {
  T2().step(3);
  const tt = T2().targets[0];
  if (tt) T2().shootAt(tt.x, tt.y);
}
const scoreAfterHits = T2().score;
T2().step(30 * 60 + 5);
ok(T2().state === 'over', 'game over in fresh instance');
const savedBest = parseInt(g2.store['aim-trainer_best_30'] || '0', 10);
ok(savedBest >= scoreAfterHits, 'best score written to localStorage (saved=' + savedBest + ', score=' + scoreAfterHits + ')');

section('new session loads saved best');
const g4 = (() => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);

  const modeBtns = makeModeBtns();
  const elCache = {};
  const getEl = (id) => (elCache[id] ||= makeEl(id));
  const store = { 'aim-trainer_best_30': '9999' };
  const win = { innerWidth: 1280, innerHeight: 800, addEventListener: () => {}, removeEventListener: () => {} };
  const sandbox = {
    window: win,
    document: {
      getElementById: getEl,
      createElement: t => makeEl(t),
      addEventListener: () => {},
      querySelectorAll: (sel) => sel === '.mode-btn' ? modeBtns : [],
      body: makeEl('body'),
    },
    location: { search: '' }, navigator: {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console, URLSearchParams,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  try { vm.runInContext(KIT, ctx, { filename: 'game-kit.js' }); vm.runInContext(m[1], ctx, { filename: 'index.html' }); } catch (e) {}
  return { test: () => win.__test };
})();
g4.test().start(); // start timed 30s so bestScore reads aim-trainer_best_30
ok(g4.test().bestScore === 9999, 'best score loaded from localStorage on boot (got ' + g4.test().bestScore + ')');

section('per-mode best isolation: different timed durations use different keys');
{
  const giso = runGame('index.html');
  const Tiso = () => giso.test();

  // play 10s mode and end it
  Tiso().startMode(10);
  for (let i = 0; i < 5; i++) {
    Tiso().step(3);
    const tt = Tiso().targets[0];
    if (tt) Tiso().shootAt(tt.x, tt.y);
  }
  Tiso().step(10 * 60 + 5);
  const score10 = parseInt(giso.store['aim-trainer_best_10'] || '0', 10);

  // play 30s mode and end it
  Tiso().startMode(30);
  for (let i = 0; i < 5; i++) {
    Tiso().step(3);
    const tt = Tiso().targets[0];
    if (tt) Tiso().shootAt(tt.x, tt.y);
  }
  Tiso().step(30 * 60 + 5);
  const score30 = parseInt(giso.store['aim-trainer_best_30'] || '0', 10);

  ok(giso.store['aim-trainer_best_10'] !== undefined, '10s mode saves to aim-trainer_best_10');
  ok(giso.store['aim-trainer_best_30'] !== undefined, '30s mode saves to aim-trainer_best_30');
  ok(!('aim-trainer_best' in giso.store), 'old key aim-trainer_best not written');
}

section('portrait HUD clearance: targets spawn below nav + HUD band');
{
  // Portrait viewport (taller than wide): the center-top HUD pill drops below the nav
  // to top:50px, so the playfield must clear ~92px of headroom, plus the 80px spawn pad = 172.
  const gp = runGame('index.html', { w: 400, h: 900 });
  const Tp = () => gp.test();
  ok(gp.bootErr === null, 'portrait boots without error: ' + gp.bootErr);
  Tp().start();
  Tp().setSeed(3);
  Tp().step(2);
  const ys = Tp().targets.map(t => t.y);
  ok(ys.length >= 1, 'portrait has a target after start');
  ok(ys.every(y => y >= 92 + 80), 'portrait targets clear nav + HUD (min y=' + Math.min(...ys) + ', need ≥172)');
}

section('moving targets: API surface');
ok(typeof T().movingTargets === 'boolean', 'movingTargets getter is a boolean');
ok(typeof T().setMoving === 'function', 'setMoving() exposed');

section('moving targets: off by default, targets stay put');
{
  const gm = runGame('index.html');
  const Tm = () => gm.test();
  ok(Tm().movingTargets === false, 'moving targets default off');
  Tm().start();
  Tm().setSeed(11);
  Tm().step(2);
  const before = Tm().targets[0];
  Tm().step(40);
  const after = Tm().targets[0];
  // same target (no hit fired), should not have drifted
  ok(after && before && Math.abs(after.x - before.x) < 0.001 && Math.abs(after.y - before.y) < 0.001,
    'stationary target does not move when moving disabled');
  ok(Tm().targets.every(t => t.moving === false), 'no target flagged moving when disabled');
}

section('moving targets: toggle persists to localStorage');
{
  const gm = runGame('index.html');
  const Tm = () => gm.test();
  Tm().setMoving(true);
  ok(gm.store['aim-trainer_moving'] === '1', 'enabling moving writes "1" to localStorage');
  ok(Tm().movingTargets === true, 'movingTargets reflects enabled');
  Tm().setMoving(false);
  ok(gm.store['aim-trainer_moving'] === '0', 'disabling moving writes "0" to localStorage');

  // fresh instance reads the persisted value
  const gm3 = (() => {
    const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
    const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
    const modeBtns = makeModeBtns();
    const elCache = {};
    const getEl = (id) => (elCache[id] ||= makeEl(id));
    const store = { 'aim-trainer_moving': '1' };
    const win = { innerWidth: 1280, innerHeight: 800, addEventListener: () => {}, removeEventListener: () => {} };
    const sandbox = {
      window: win,
      document: { getElementById: getEl, createElement: t => makeEl(t), addEventListener: () => {}, querySelectorAll: (sel) => sel === '.mode-btn' ? modeBtns : [], body: makeEl('body') },
      location: { search: '' }, navigator: {},
      localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
      requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {},
      matchMedia: () => ({ matches: false }),
      Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console, URLSearchParams,
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    try { vm.runInContext(KIT, ctx, { filename: 'game-kit.js' }); vm.runInContext(m[1], ctx, { filename: 'index.html' }); } catch (e) {}
    return { test: () => win.__test };
  })();
  ok(gm3.test().movingTargets === true, 'persisted moving=1 loaded on fresh boot');
}

section('moving targets: ramp — more targets move and faster as score grows');
{
  const gm = runGame('index.html');
  const Tm = () => gm.test();
  Tm().setMoving(true);
  Tm().startMode('sprint'); // sprint escalates spawn so multiple targets appear
  Tm().setSeed(5);

  // low score: at/below MOVE_START_SCORE nothing should be moving
  Tm().step(20);
  ok(Tm().targets.every(t => !t.moving) || Tm().score <= 50,
    'no movement at very low score');

  // sprint ends at 100, so sample the ramp from a long timed run instead.
  const gt = runGame('index.html');
  const Tt = () => gt.test();
  Tt().setMoving(true);
  Tt().startMode(60);
  Tt().setSeed(9);
  function speedAndFractionAt(scoreTarget) {
    let safety = 0;
    while (Tt().state === 'playing' && Tt().score < scoreTarget && safety++ < 8000) {
      Tt().step(2);
      const t = Tt().targets[0];
      if (t) Tt().shootAt(t.x, t.y);
    }
    Tt().step(5); // let movement assign velocities
    const ts = Tt().targets;
    const movingFrac = ts.length ? ts.filter(t => t.moving).length / ts.length : 0;
    const maxSpeed = ts.reduce((mx, t) => Math.max(mx, Math.hypot(t.vx, t.vy)), 0);
    return { movingFrac, maxSpeed, score: Tt().score };
  }
  const low = speedAndFractionAt(80);
  const high = speedAndFractionAt(300);
  ok(high.score > low.score, 'reached a higher score for the high sample (' + low.score + ' → ' + high.score + ')');
  ok(high.movingFrac >= low.movingFrac, 'moving fraction does not decrease as score grows (' + low.movingFrac.toFixed(2) + ' → ' + high.movingFrac.toFixed(2) + ')');
  ok(high.maxSpeed >= low.maxSpeed - 0.001, 'max target speed grows (or holds) with score (' + low.maxSpeed.toFixed(2) + ' → ' + high.maxSpeed.toFixed(2) + ')');
  ok(high.maxSpeed > 0, 'targets are moving at high score (maxSpeed=' + high.maxSpeed.toFixed(2) + ')');
}

section('moving targets: stay within the playfield (bounce)');
{
  const gm = runGame('index.html');
  const Tm = () => gm.test();
  Tm().setMoving(true);
  Tm().startMode(60);
  Tm().setSeed(13);
  // push score up so plenty of targets move fast, then run many frames
  let safety = 0;
  while (Tm().state === 'playing' && Tm().score < 400 && safety++ < 8000) {
    Tm().step(2);
    const t = Tm().targets[0];
    if (t) Tm().shootAt(t.x, t.y);
  }
  let outOfBounds = false;
  for (let i = 0; i < 600 && Tm().state === 'playing'; i++) {
    Tm().step(1);
    for (const t of Tm().targets) {
      if (t.x < t.r - 1 || t.x > 1280 - t.r + 1 || t.y < 48 + t.r - 1 || t.y > 800 - 8 - t.r + 1) {
        outOfBounds = true;
      }
    }
  }
  ok(!outOfBounds, 'moving targets never leave the playfield bounds');
}

section('moving targets: flick aim still hits a moving target at its current position');
{
  const gm = runGame('index.html');
  const Tm = () => gm.test();
  Tm().setMoving(true);
  Tm().startMode(60);
  Tm().setSeed(21);
  // build up score so the first target is moving
  let safety = 0;
  while (Tm().state === 'playing' && Tm().score < 200 && safety++ < 8000) {
    Tm().step(2);
    const t = Tm().targets[0];
    if (t) Tm().shootAt(t.x, t.y);
  }
  Tm().step(10);
  const moving = Tm().targets.find(t => t.moving) || Tm().targets[0];
  const hitsBefore = Tm().hits;
  if (moving) Tm().shootAt(moving.x, moving.y);
  ok(Tm().hits === hitsBefore + 1, 'clicking a moving target at its reported position registers a hit');
}

section('Range: layout fits the screen (on-screen + no targets under the HUD)');
{
  const VIEWPORTS = [
    { name: 'portrait phone', w: 390, h: 780 },
    { name: 'landscape phone', w: 780, h: 390 },
    { name: 'desktop', w: 1280, h: 800 },
  ];
  for (const v of VIEWPORTS) {
    const gl = runGame('index.html');
    gl.resize(v.w, v.h);   // viewport is set before the player hits READY UP
    gl.test().start();     // first target spawns into the resized playfield
    gl.test().setSeed(7);
    gl.test().step(2);
    const L = gl.test().layout;
    ok(L.W === v.w && L.H === v.h, v.name + ': canvas matches viewport (' + L.W + 'x' + L.H + ')');
    // spawn region (full target disc) stays within the canvas
    ok(L.spawn.left >= 0 && L.spawn.right <= L.W, v.name + ': spawn region within width (' + Math.round(L.spawn.left) + '..' + Math.round(L.spawn.right) + ' in 0..' + L.W + ')');
    ok(L.spawn.top >= 0 && L.spawn.bottom <= L.H, v.name + ': spawn region within height (' + Math.round(L.spawn.top) + '..' + Math.round(L.spawn.bottom) + ' in 0..' + L.H + ')');
    // spawn region clears the top HUD pill (targets never spawn under the score HUD)
    ok(L.spawn.top >= L.topReserve, v.name + ': spawn clears the HUD (spawnTop ' + Math.round(L.spawn.top) + ' >= topReserve ' + L.topReserve + ')');
    // any live targets are fully on-screen (including their radius) and below the HUD
    ok(L.targetsBox != null, v.name + ': has a live target after start');
    if (L.targetsBox) {
      const b = L.targetsBox;
      ok(b.left >= 0 && b.right <= L.W, v.name + ': live targets within width (' + Math.round(b.left) + '..' + Math.round(b.right) + ' in 0..' + L.W + ')');
      ok(b.top >= L.topReserve && b.bottom <= L.H, v.name + ': live targets on-screen + below HUD (' + Math.round(b.top) + '..' + Math.round(b.bottom) + ' in ' + L.topReserve + '..' + L.H + ')');
    }
  }
}

console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
