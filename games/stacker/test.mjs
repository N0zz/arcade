// Headless test harness for Stack (stacker/index.html).
// Mocks DOM/canvas, runs the IIFE in a vm sandbox, drives via window.__test.
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
    get: (_, p) => {
      if (p === 'canvas') return { width: 640, height: 900 };
      if (p === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      return () => {};
    },
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
    appendChild: c => { el.children.push(c); return c; },
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => makeCtx2d(),
    focus: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 900 }),
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => _html,
    set: v => {
      _html = String(v ?? '');
      el.children = [];
      // Parse out buttons added via innerHTML and re-register them in el._l-accessible form
      const btnRe = /id="([^"]+)"/g; let m;
      while ((m = btnRe.exec(_html)) !== null) elCache[m[1]] = makeEl(m[1]);
    }
  });
  return el;
}

const elCache = {};
function getEl(id) { return (elCache[id] ||= makeEl(id)); }

function runStacker() {
  // Reset cache for fresh run
  Object.keys(elCache).forEach(k => delete elCache[k]);

  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in index.html');
  const code = m[1];

  const store = {};
  const handlers = {};
  const win = {
    innerWidth: 640, innerHeight: 900,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    AudioContext: undefined, webkitAudioContext: undefined,
    __test: undefined,
  };
  const docMock = {
    getElementById: getEl,
    createElement: tag => makeEl('new-' + tag),
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    querySelectorAll: () => [],
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
    setTimeout: (fn) => { /* no-op */ return 0; },
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    URLSearchParams, Math, JSON, String, Number, Array, Object,
    parseInt, parseFloat, isFinite, isNaN, Date, console,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  let bootErr = null;
  try { vm.runInContext(code, ctx, { filename: 'stacker/index.html' }); }
  catch (e) { bootErr = e.stack || e.message; }

  return {
    bootErr, store,
    test: () => win.__test,
    el: getEl,
    handlers,
  };
}

// ---- Tests ----

section('boot');
const g = runStacker();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.test() != null, 'exposes window.__test');
const T = () => g.test();
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
ok(typeof T().score === 'number', 'score is a number');
ok(typeof T().blocks === 'number', 'blocks getter is a number');

section('start / playing');
T().start();
ok(T().state === 'playing', 'start() → state "playing" (got ' + T().state + ')');
ok(T().blocks === 0, 'no blocks placed yet after start (got ' + T().blocks + ')');
ok(T().moving !== null, 'moving block exists after start');
ok(T().base !== null, 'base block exists after start');

section('step advances mover');
const beforeX = T().moving.x;
T().step(10);
ok(T().moving.x !== beforeX, 'step(10) moves the mover (before=' + beforeX + ' after=' + T().moving.x + ')');

section('dropPerfect — perfect placement');
const widthBefore = T().base.w;
const scoreB4 = T().score;
T().dropPerfect();
ok(T().state === 'playing', 'state still playing after perfect drop');
ok(T().score > scoreB4, 'score increased after perfect drop (' + scoreB4 + ' -> ' + T().score + ')');
ok(T().blocks === 1, 'blocks count is 1 after first drop (got ' + T().blocks + ')');
// Width should not shrink on perfect (may grow up to REGROW pixels)
const widthAfter = T().base.w;
ok(widthAfter >= widthBefore, 'block width does not shrink on perfect (before=' + widthBefore + ' after=' + widthAfter + ')');

section('dropPerfect multiple times — builds a tower');
for (let i = 0; i < 5; i++) T().dropPerfect();
ok(T().blocks >= 5, 'can place 5+ blocks with dropPerfect (got ' + T().blocks + ')');
ok(T().state === 'playing', 'still playing after 5 perfect drops');

section('combo tracking');
// Reset and build combo
const g2 = runStacker();
g2.test().start();
const T2 = () => g2.test();
T2().dropPerfect();
T2().dropPerfect();
ok(T2().combo >= 2, 'combo builds up with consecutive perfects (got ' + T2().combo + ')');

section('misaligned drop → game over');
const g3 = runStacker();
g3.test().start();
const T3 = () => g3.test();
// Force mover far off to one side so there's zero overlap
const b3 = T3().base;
// Place mover completely off to the right (past the base block)
const m3 = T3().moving;
// Access internal state via the test hook to simulate a fully misaligned block:
// step until mover is at edge, then we manually drive it off
// Instead, call drop() repeatedly until game over (since mover bounces edge to edge,
// some drops may hit; keep dropping until it goes off or force via 0-width overlap)
// More reliably: use the internal step to put mover in a known place then drop.
// We'll step ~1 frame to let mover move, then override via dropPerfect first to get
// a narrower base, then drop off the edge.
// Simplest approach: call T3().drop() with the mover way off to the side.
// We expose mover via T3().moving, but we can't set it from outside.
// Let's drive via step until mover is at the far right corner and drop.
// The mover bounces at W=640, base is ~352px wide centered, so gap on each side is ~144px.
// A block that's 352px wide placed at x=644-352=292, base at x=144... overlap = 144+352 - 292 = 4?
// Actually let's just rapidly drop until game over within a reasonable number of attempts.
let guard = 0;
while (T3().state === 'playing' && guard++ < 300) {
  T3().step(3);
  T3().drop();
}
ok(T3().state === 'over', 'eventually misaligned drop → state "over" (got ' + T3().state + ' after ' + guard + ' attempts)');

section('best score persistence');
const g4 = runStacker();
g4.test().start();
const T4 = () => g4.test();
// Place several perfect blocks to build up score
for (let i = 0; i < 8; i++) T4().dropPerfect();
const sc4 = T4().score;
ok(sc4 > 0, 'score > 0 after 8 perfect drops (got ' + sc4 + ')');
// Check localStorage
const stored = g4.store['stacker_best'];
ok(stored != null && parseInt(stored, 10) >= sc4, 'best score persisted to localStorage (stored=' + stored + ', score=' + sc4 + ')');

section('game over → overlay appears');
const g5 = runStacker();
g5.test().start();
const T5 = () => g5.test();
let g5Guard = 0;
while (T5().state === 'playing' && g5Guard++ < 300) { T5().step(3); T5().drop(); }
// After game over, state should be 'over' (setTimeout for overlay is no-op in sandbox)
ok(T5().state === 'over', 'state is "over" after miss (got ' + T5().state + ')');

// ---- Summary ----
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
