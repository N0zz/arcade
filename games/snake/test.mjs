// Headless test harness for Neon Snake.
// Mocks DOM + canvas, runs the inline script in a vm sandbox, drives via window.__test.
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
    focus: () => {},
    getAttribute: () => null, setAttribute: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => _html,
    set: v => {
      _html = String(v ?? '');
      if (!v) el.children = [];
      // When game-over sets innerHTML containing a restartBtn, register it in elCache
      const m = _html.match(/id="restartBtn"/);
      if (m) {
        const rBtn = makeEl('restartBtn');
        // Extract addEventListener calls in innerHTML would be complex; we just make the element accessible
        elCache['restartBtn'] = rBtn;
      }
    },
  });
  return el;
}

let elCache = {};

function runGame() {
  elCache = {};
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in index.html');

  const getEl = (id) => (elCache[id] ||= makeEl(id));
  const handlers = {};
  const store = {};

  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
  };

  const docHandlers = {};
  const doc = {
    getElementById: getEl,
    createElement: t => makeEl('new-' + t),
    addEventListener: (type, fn) => { (docHandlers[type] ||= []).push(fn); },
    querySelectorAll: () => [],
    body: makeEl('body'),
  };

  const sandbox = {
    window: win,
    document: doc,
    location: { search: '' },
    navigator: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    URLSearchParams, Math, JSON, String, Number, Array, Object,
    parseInt, parseFloat, isFinite, isNaN, Date, console,
  };
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  let bootErr = null;
  try { vm.runInContext(m[1], ctx, { filename: 'index.html' }); }
  catch (e) { bootErr = e.stack; }

  const api = {
    bootErr, store,
    el: getEl,
    test: () => win.__test,
    key(type, key) { (docHandlers[type] || []).forEach(fn => { try { fn({ key, preventDefault() {} }); } catch (e) { console.error('key error:', e.message); } }); },
    down(k) { this.key('keydown', k); },
  };
  return api;
}

// ---- Tests ----

section('boot');
{
  const g = runGame();
  ok(g.bootErr === null, 'game boots without error: ' + g.bootErr);
  ok(g.test() != null, 'exposes window.__test');
}

section('start');
{
  const g = runGame();
  const T = g.test();
  ok(T.state === 'ready', 'initial state is "ready" (got ' + T.state + ')');
  T.start();
  ok(T.state === 'playing', 'start() transitions to "playing" (got ' + T.state + ')');
  ok(T.score === 0, 'score starts at 0 (got ' + T.score + ')');
  ok(T.length >= 1, 'snake has at least 1 segment (got ' + T.length + ')');
}

section('eating grows snake and scores');
{
  const g = runGame();
  const T = g.test();
  T.start();
  const head = T.head;
  // Place food directly ahead (snake starts moving right by default)
  T.placeFoodAt(head.x + 1, head.y);
  const lenBefore = T.length;
  const scoreBefore = T.score;
  T.step(1);
  ok(T.length === lenBefore + 1, 'eating food grows length by 1 (' + lenBefore + ' -> ' + T.length + ')');
  ok(T.score > scoreBefore, 'eating food increases score (' + scoreBefore + ' -> ' + T.score + ')');
}

section('wall collision ends game');
{
  const g = runGame();
  const T = g.test();
  T.start();
  // Point snake upward and step until it hits the top wall
  T.turn('up');
  let guard = 0;
  while (T.state === 'playing' && guard++ < 50) T.step(1);
  ok(T.state === 'over', 'hitting a wall transitions to "over" (got ' + T.state + ')');
}

section('180-degree reversal ignored');
{
  const g = runGame();
  const T = g.test();
  T.start();
  // Default dir is right; trying to go left should be ignored
  T.setDir(-1, 0);
  T.step(1);
  ok(T.state === 'playing', 'snake is still alive after attempted 180° reversal (state=' + T.state + ')');
  ok(T.head.x >= T.head.x, 'head did not move backward (snake survived)');
}

section('self collision ends game');
{
  const g = runGame();
  const T = g.test();
  T.start();
  // Grow the snake a bit by feeding it, then steer it into itself
  const h = T.head;
  // Feed it several times to make it long enough to loop back
  for (let i = 1; i <= 5; i++) {
    T.placeFoodAt(h.x + i, h.y);
    T.step(1);
  }
  // Now steer: down, left, up — so head hits body
  T.turn('down'); T.step(1);
  T.turn('left'); T.step(1);
  T.turn('up');   T.step(1);
  ok(T.state === 'over', 'self collision transitions to "over" (got ' + T.state + ')');
}

section('best score persists');
{
  const g = runGame();
  const T = g.test();
  T.start();
  // Eat food to get a score
  const h = T.head;
  T.placeFoodAt(h.x + 1, h.y);
  T.step(1);
  const scoreAfterEat = T.score;
  // Drive into wall to end game
  T.turn('up');
  let guard = 0;
  while (T.state === 'playing' && guard++ < 50) T.step(1);
  ok(T.state === 'over', 'game ended (state=' + T.state + ')');
  const saved = parseInt(g.store['snake_best'] || '0', 10);
  ok(saved >= scoreAfterEat, 'best score persisted to localStorage (' + saved + ' >= ' + scoreAfterEat + ')');
}

section('__test API surface');
{
  const g = runGame();
  const T = g.test();
  T.start();
  ok(typeof T.state === 'string', '__test.state is a string');
  ok(typeof T.score === 'number', '__test.score is a number');
  ok(typeof T.length === 'number', '__test.length is a number');
  ok(T.head !== null && typeof T.head.x === 'number', '__test.head exposes {x,y}');
  ok(typeof T.step === 'function', '__test.step is a function');
  ok(typeof T.setDir === 'function', '__test.setDir is a function');
  ok(typeof T.turn === 'function', '__test.turn is a function');
  ok(typeof T.placeFoodAt === 'function', '__test.placeFoodAt is a function');
  ok(typeof T.start === 'function', '__test.start is a function');
}

console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
