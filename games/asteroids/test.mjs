// Headless test harness for Classic Asteroids (games/asteroids/index.html — Classic +
// Classic-Enhanced behind the ?v= flag, plus ?speedrun=1). Mocks the DOM + canvas, runs the
// game's IIFE in a vm sandbox, steps the requestAnimationFrame loop manually, simulates input,
// and asserts behavior. (The roguelite variant is a separate game — see
// games/asteroids-plus/test.mjs.)
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
  // a file token may carry its own query (e.g. 'index.html?v=enh') — split it off and merge
  // into the mocked location.search.
  const qi = file.indexOf('?');
  if (qi >= 0) { const fq = file.slice(qi + 1); file = file.slice(0, qi); search = search ? (search + '&' + fq) : ('?' + fq); }
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
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
  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
    performance: { now: () => clock },
    __test: undefined,
  };
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
    file, errors, store,
    el: getEl,
    test: () => win.__test,
    key(type, key) { (handlers[type] || []).slice().forEach(fn => { try { fn({ key, preventDefault() {}, stopPropagation() {} }); } catch (e) { errors.push(type + ' ' + key + ': ' + e.stack); } }); },
    down(k) { this.key('keydown', k); }, up(k) { this.key('keyup', k); },
    step(n = 1) { for (let i = 0; i < n; i++) { clock += 1000 / 60; const q = rafQ; rafQ = []; q.forEach(cb => { try { cb(); } catch (e) { errors.push('frame: ' + e.stack); } }); } },
    // drive a viewport change: the kit's __emit sets window dims + fires the relayout callbacks synchronously
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
  // start via the kit start menu (Enter activates the focused Play button)
  ok(g.test().menu() != null, file + ' opens the kit start menu on boot');
  g.down('Enter');
  g.step(2);
  ok(g.el('game') != null, file + ' has canvas');
  ok(g.test().state === 'playing' && g.test().menu() == null, file + ' Play starts the game (menu closes)');
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
    // pause via Esc → kit pause menu; Resume closes it and resumes play
    g.down('Escape'); g.step(1);
    ok(g.test().menu() != null && g.test().state === 'paused', file + ' ESC opens the kit pause menu');
    g.test().menu().activate('resume'); g.step(1);
    ok(g.test().state === 'playing' && g.test().menu() == null, file + ' Resume closes the pause menu and resumes');
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
  // in speedrun the share/Discord result is the TIME, not score/level → mode-aware message, never the Classic one
  const sm = g.test().shareMsg();
  ok(/Speedrun/.test(sm) && !/Classic|level /.test(sm) && /\d\d:\d\d\.\d\d/.test(sm),
    file + ' speedrun share leads with time, not score/level (got "' + sm + '")');
}

// ---------------- Run ----------------
// Asteroids = Classic + Enhanced (one engine, index.html, variant via ?v=classic|enh). The
// roguelite progressions moved to their own game — see games/asteroids-plus/test.mjs.
console.log('Running Asteroids headless tests…');

smokeClassic('index.html?v=classic');
smokeSpeedrun('index.html?v=classic');
smokeClassic('index.html?v=enh', { enhanced: true });
smokeSpeedrun('index.html?v=enh');

// ---------------- Layout regression: fits the screen, clears the top HUD ----------------
function layoutFits(file) {
  section(file + ': layout fits the screen (no off-screen / HUD overlap)');
  const VIEWPORTS = [
    { name: 'portrait phone', w: 390, h: 780 },
    { name: 'landscape phone', w: 780, h: 390 },
    { name: 'desktop', w: 1280, h: 800 },
  ];
  for (const v of VIEWPORTS) {
    const g = runGame(file);
    const T = () => g.test();
    T().start();          // start a real play session
    g.resize(v.w, v.h);   // rotate / resize the viewport
    g.step(1);            // one frame so positions settle to the new viewport, as happens live
    ok(g.errors.length === 0, file + ' [' + v.name + '] no error on resize: ' + (g.errors[0] || ''));
    const L = T().layout;
    // canvas is scaled (S) on small screens, so it won't equal the viewport — assert the scale model instead
    const m = Math.min(v.w, v.h), S = m < 640 ? Math.min(2.6, 900 / m) : 1;
    ok(L.W === Math.round(v.w * S) && L.H === Math.round(v.h * S),
      file + ' [' + v.name + '] canvas matches scaled viewport (W=' + L.W + ' H=' + L.H + ' S=' + L.S.toFixed(2) + ')');
    ok(L.W > 0 && L.H > 0, file + ' [' + v.name + '] canvas has positive size');
    // the ship (the only JS-positioned on-canvas actor) must be fully within 0..W / 0..H
    ok(L.shipLeft >= 0 && L.shipRight <= L.W, file + ' [' + v.name + '] ship within horizontal bounds (' + L.shipLeft.toFixed(0) + '..' + L.shipRight.toFixed(0) + ' / ' + L.W + ')');
    ok(L.shipTop >= 0 && L.shipBottom <= L.H, file + ' [' + v.name + '] ship within vertical bounds (' + L.shipTop.toFixed(0) + '..' + L.shipBottom.toFixed(0) + ' / ' + L.H + ')');
    // the ship must not sit under the top score HUD (its reserved headroom, in canvas px)
    ok(L.topReserve > 0, file + ' [' + v.name + '] HUD reserves top headroom (' + L.topReserve.toFixed(0) + 'px canvas)');
    ok(L.shipTop >= L.topReserve, file + ' [' + v.name + '] ship clears the top HUD (top=' + L.shipTop.toFixed(0) + ' >= reserve=' + L.topReserve.toFixed(0) + ')');
  }
}
layoutFits('index.html?v=classic');

console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
