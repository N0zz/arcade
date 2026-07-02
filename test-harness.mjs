// test-harness.mjs — the ONE headless harness every komyo suite boots through.
// Mocks DOM/canvas/localStorage, preloads the shared game-kit, extracts each page's
// inline script (greedy: the LAST attribute-less <script> before </body>, so <head>
// scripts never confuse it), and runs it in a vm sandbox driven via window.__test.
// Per-game suites import { bootGame, ok, section, summary, runLayoutSuite } and keep
// only their game-specific asserts (~30 lines of scaffold saved per suite).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

export const ROOT = path.dirname(new URL(import.meta.url).pathname);
export const KIT = fs.readFileSync(path.join(ROOT, 'game-kit.js'), 'utf8');

// ---- reporter (shared pass/fail counters + exit-code summary) ----
let pass = 0, fail = 0;
const fails = [];
export function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
export function section(t) { console.log('\n=== ' + t + ' ==='); }
export function summary() {
  console.log('\n----------------------------------------');
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('All tests passed ✓');
}

// Deterministic Math for a sandbox so a run is reproducible (games use Math.random for
// spawns/collisions/pickups; unseeded, rare RNG lines make asserts flaky).
export function makeSeededMath(seed) {
  let s = (seed >>> 0) || 0x2545f491;
  const m = Object.create(Math);
  m.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return m;
}

export function makeCtx2d(el) {
  return new Proxy({}, {
    get: (_, p) => (p === 'canvas' ? (el || { width: 1280, height: 800 }) : () => {}),
    set: () => true,
  });
}

export function makeEl(id) {
  const classes = new Set();
  const el = {
    id, _id: id, textContent: '', value: '', checked: false, dataset: {}, children: [],
    width: 1280, height: 800,
    style: new Proxy({}, { get: (t, p) => (p === 'setProperty' ? ((k, v) => { t[k] = v; }) : (t[p] ?? '')), set: (t, p, v) => { t[p] = v; return true; } }),
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, f) => { const w = f === undefined ? !classes.has(c) : !!f; if (w) classes.add(c); else classes.delete(c); return w; },
      contains: c => classes.has(c),
    },
    _l: {},
    addEventListener: (type, fn) => { (el._l[type] ||= []).push(fn); },
    removeEventListener: () => {},
    fire: (type, ev = {}) => (el._l[type] || []).slice().forEach(fn => fn({ preventDefault() {}, stopPropagation() {}, ...ev })),
    appendChild: c => { el.children.push(c); return c; },
    removeChild: c => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
    remove: () => {},
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => makeCtx2d(el),
    focus: () => {}, setAttribute() {}, getAttribute() { return null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    showModal() {}, close() {},
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => _html, set: v => { _html = String(v ?? ''); if (!v) el.children = []; } });
  return el;
}

// makeSandbox({w,h,store,seed,search,extra}) → a ready vm context + the hooks tests drive.
// rAF is a queue drained by step()/fireRaf() (never auto-ticks — headless-safe by design);
// performance.now() is a manual clock step() advances by 1000/60 per frame.
export function makeSandbox(opts = {}) {
  const { w = 1280, h = 800, store = {}, seed, search = '', extra = {} } = opts;
  const elCache = {};
  const getEl = id => (elCache[id] ||= makeEl(id));
  const handlers = {}; // window + document listeners (games attach keys to either)
  let rafQ = [];
  let clock = 1000;
  const errors = [];
  const posted = [];
  const win = {
    innerWidth: w, innerHeight: h,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    performance: { now: () => clock },
    __test: undefined,
  };
  win.parent = { postMessage: m => posted.push(m) };
  const doc = {
    getElementById: getEl,
    createElement: tag => makeEl('new-' + tag),
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    querySelectorAll: () => [],
    body: makeEl('body'),
  };
  const sandbox = Object.assign({
    window: win, document: doc,
    location: { search },
    navigator: { userAgent: 'test' },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    performance: win.performance,
    requestAnimationFrame: cb => { rafQ.push(cb); return rafQ.length; },
    cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    URLSearchParams, Math: seed != null ? makeSeededMath(seed) : Math,
    JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, Promise,
    encodeURIComponent, decodeURIComponent, console,
  }, extra);
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  const fireRaf = t => { const q = rafQ; rafQ = []; q.forEach(cb => { try { cb(t); } catch (e) { errors.push('frame: ' + e.stack); } }); };
  return {
    sandbox, ctx, win, doc, getEl, el: getEl, elCache, store, errors, posted,
    get rafPending() { return rafQ.length; },
    get bootErr() { return errors.length ? errors[0] : null; },
    T: () => win.__test, test: () => win.__test,
    run(code, filename) { try { vm.runInContext(code, ctx, { filename }); } catch (e) { errors.push((filename || 'script') + ': ' + e.stack); } },
    key(type, key) { (handlers[type] || []).slice().forEach(fn => { try { fn({ key, preventDefault() {}, stopPropagation() {} }); } catch (e) { errors.push(type + ' ' + key + ': ' + e.stack); } }); },
    down(k) { this.key('keydown', k); }, up(k) { this.key('keyup', k); },
    // step(): one display frame for rAF-driven (bespoke) games — advances the clock, drains the queue.
    step(n = 1) { for (let i = 0; i < n; i++) { clock += 1000 / 60; fireRaf(clock); } },
    fireRaf, // explicit-timestamp frames (the kit-loop accumulator tests)
    get clock() { return clock; },
    // drive a viewport change: the kit's __emit sets window dims + fires layout callbacks synchronously
    resize(w2, h2) { if (win.gamekit && win.gamekit.layout && win.gamekit.layout.__emit) win.gamekit.layout.__emit(w2, h2); else { win.innerWidth = w2; win.innerHeight = h2; } },
  };
}

// Extract the game's main inline script: greedy lead grabs the LAST attribute-less
// <script> before </body> even when earlier bare <script>s exist (e.g. a gtag stub).
export function extractInline(html, file) {
  const m = html.match(/[\s\S]*<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script in ' + (file || 'html'));
  return m[1];
}

// bootGame('games/<slug>/index.html[?query]', opts) — kit preload + inline script, ready to drive.
// opts: everything makeSandbox takes, plus kit:false to skip the kit preload and
// preCode: string|string[] run after the kit, before the game (games.js, challenges.js, …).
export function bootGame(file, opts = {}) {
  let search = opts.search || '';
  const qi = file.indexOf('?');
  if (qi >= 0) { const fq = file.slice(qi + 1); search = search ? (search + '&' + fq) : ('?' + fq); file = file.slice(0, qi); }
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const code = extractInline(html, file);
  const g = makeSandbox({ ...opts, search });
  if (opts.kit !== false) g.run(KIT, 'game-kit.js');
  for (const pre of [].concat(opts.preCode || [])) g.run(pre, 'pre.js');
  g.run(code, file);
  return g;
}

// ---- layout suite: the standard portrait/landscape/desktop triple ----
export const VIEWPORTS = [
  { name: 'portrait phone', w: 390, h: 780 },
  { name: 'landscape phone', w: 780, h: 390 },
  { name: 'desktop', w: 1280, h: 800 },
];

// runLayoutSuite(makeGame, check): boots a fresh game per viewport (makeGame must return a
// started bootGame handle), resizes, asserts the shared invariants — layout getter present,
// canvas matches the viewport, HUD headroom clears the kit's hudTop() (the headless stand-in
// for "the score box doesn't sit under the nav") — then hands off to the game's own checks.
export function runLayoutSuite(makeGame, check, opts = {}) {
  for (const v of VIEWPORTS) {
    const g = makeGame(v);
    g.resize(v.w, v.h);
    const T = g.T();
    const L = T && T.layout;
    ok(L != null, v.name + ': __test.layout is exposed');
    if (!L) continue;
    // opts.size:false for games whose canvas is a scaled world, not the raw viewport (asteroids)
    if (opts.size !== false && L.W != null) ok(L.W === v.w && L.H === v.h, v.name + ': canvas matches viewport (' + L.W + 'x' + L.H + ' vs ' + v.w + 'x' + v.h + ')');
    const reserve = L.topReserve != null ? L.topReserve : L.topMargin;
    const hud = g.win.gamekit && g.win.gamekit.layout ? g.win.gamekit.layout.hudTop() : 0;
    ok(reserve != null && reserve >= hud, v.name + ': HUD headroom clears the kit chrome (reserve ' + reserve + ' >= hudTop ' + hud + ')');
    if (check) check(g, v, L);
  }
}
