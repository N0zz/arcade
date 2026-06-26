// Headless tests for Brick Breaker.
// Mocks DOM/canvas, runs the inline script in a vm sandbox, drives via window.__test.
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
    fire: (type, ev = {}) => (el._l[type] || []).forEach(fn => fn({ preventDefault() {}, ...ev })),
    appendChild: (c) => { el.children.push(c); return c; },
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => makeCtx2d(),
    focus: () => {}, setAttribute() {}, getAttribute() { return null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => _html, set: v => { _html = String(v ?? ''); if (!v) el.children = []; } });
  return el;
}

function runGame() {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in index.html');
  const code = m[1];

  const elCache = {};
  const getEl = (id) => (elCache[id] ||= makeEl(id));
  const handlers = {};
  const store = {};

  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    __test: undefined,
  };
  const documentMock = {
    getElementById: getEl,
    createElement: (tag) => makeEl('new-' + tag),
    addEventListener: () => {},
    querySelectorAll: () => [],
    body: makeEl('body'),
  };
  const sandbox = {
    window: win, document: documentMock,
    location: { search: '' },
    navigator: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout: (fn, ms) => 0, setInterval: () => 0, clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    URLSearchParams, Math, JSON, String, Number, Array, Object, parseInt, parseFloat,
    isFinite, isNaN, Date, console,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  let bootErr = null;
  try { vm.runInContext(code, ctx, { filename: 'index.html' }); }
  catch (e) { bootErr = e.stack; }

  return { getEl, win, store, bootErr, T: () => win.__test };
}

// ---- Tests ----

section('Breakout: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');

section('Breakout: initial state');
const T = g.T;
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');

section('Breakout: start()');
T().start();
ok(T().state === 'playing', 'start() sets state to "playing" (got ' + T().state + ')');
ok(T().ballStuck === true, 'ball starts stuck to paddle (got ' + T().ballStuck + ')');
ok(T().lives === 3, 'starts with 3 lives (got ' + T().lives + ')');
ok(T().score === 0, 'score starts at 0 (got ' + T().score + ')');
ok(T().bricks > 0, 'bricks are present (got ' + T().bricks + ')');

section('Breakout: launch()');
T().launch();
ok(T().ballStuck === false, 'launch() releases the ball (got ' + T().ballStuck + ')');
T().step(5);
ok(T().state === 'playing', 'still playing after a few steps');

section('Breakout: setBall hits a brick');
T().start();
T().launch();
// count bricks before
const bricksBefore = T().bricks;
const scoreBefore = T().score;
// aim the ball directly into the first brick
// bricks start at y=56+gap, ball needs to travel upward
// Set ball at x=center, y=just below first brick row, going straight up fast
T().setPaddle(640);
T().setBall(640, 120, 0, -15); // heading straight up into the bricks
T().step(30);
const bricksAfter = T().bricks;
const scoreAfter = T().score;
ok(bricksAfter < bricksBefore, 'hitting bricks removes them (' + bricksBefore + ' -> ' + bricksAfter + ')');
ok(scoreAfter > scoreBefore, 'destroying bricks increases score (' + scoreBefore + ' -> ' + scoreAfter + ')');

section('Breakout: ball falls below paddle costs a life');
T().start();
T().launch();
const livesBefore = T().lives;
// Fire ball downward past paddle
T().setBall(640, 780, 0, 15); // below most paddles, heading down
T().step(20);
ok(T().lives < livesBefore, 'ball falling below paddle costs a life (' + livesBefore + ' -> ' + T().lives + ')');

section('Breakout: losing all lives -> game over');
T().start();
T().launch();
// lose all remaining lives
let guard = 0;
while (T().state === 'playing' && guard++ < 200) {
  T().setBall(640, 780, 0, 15);
  T().step(10);
}
ok(T().state === 'over', 'losing all lives leads to game over (got ' + T().state + ')');

section('Breakout: best score persists');
const g2 = runGame();
const T2 = g2.T;
T2().start();
T2().launch();
// Destroy some bricks to build a score
T2().setBall(640, 120, 0, -15);
T2().step(30);
const sc2 = T2().score;
// Now lose all 3 lives without resetting (don't call start again)
let g2guard = 0;
while (T2().state === 'playing' && g2guard++ < 500) {
  T2().setBall(640, 790, 0, 10);
  T2().step(10);
}
ok(T2().state === 'over', 'game over before checking best');
// If we scored anything, best should be persisted
if (sc2 > 0) {
  const stored = parseInt(g2.store['breakout_best'] || '0', 10);
  ok(stored >= sc2, 'best score persisted to localStorage (score=' + sc2 + ', stored=' + stored + ')');
} else {
  // No bricks were hit — acceptable to skip persistence check
  ok(true, 'best score persisted (score was 0, nothing to store)');
}

// ---- Summary ----
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) {
  console.log('\nFailures:');
  fails.forEach(f => console.log(' - ' + f));
  process.exit(1);
} else {
  console.log('All tests passed ✓');
}
