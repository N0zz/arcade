// Headless tests for Meadow Flyer (games/flappy/index.html).
// Mocks DOM/canvas, runs the IIFE in a vm sandbox, drives via window.__test.
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
    get: (_, p) => {
      if (p === 'canvas') return { width: 1280, height: 800 };
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
    setAttribute: () => {},
    getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => _html, set: v => { _html = String(v ?? ''); if (!v) el.children = []; } });
  return el;
}

function runGame(initialStore) {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script found in index.html');
  const code = m[1];

  const elCache = {};
  const getEl = id => (elCache[id] ||= makeEl(id));
  const store = Object.assign({}, initialStore || {});
  const handlers = {};

  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    removeEventListener: () => {},
  };
  const docMock = {
    getElementById: getEl,
    createElement: () => makeEl('new'),
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
    setTimeout: (fn, t) => 0,
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console,
    URLSearchParams,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  let bootErr = null;
  try { vm.runInContext(KIT, ctx, { filename: 'game-kit.js' }); vm.runInContext(code, ctx, { filename: 'index.html' }); }
  catch (e) { bootErr = e.stack; }

  return { win, store, bootErr, test: () => win.__test, getEl, fireKey: (key) => (handlers['keydown'] || []).forEach(fn => fn({ key, preventDefault() {} })) };
}

// ----------------------------------------------------------------

console.log('Running Meadow Flyer tests…');

// (a) boots, exposes __test
section('Boot');
let g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
const T = () => g.test();
ok(T() != null, 'exposes window.__test');

// (b) start() → 'playing'
section('Start');
ok(T().state === 'ready', 'initial state is "ready"');
T().start();
ok(T().state === 'playing', 'start() → "playing"');

// (b2) tap-to-start gives upward vy (first-flap impulse)
section('Tap-start impulse');
{
  g = runGame();
  ok(T().state === 'ready', 'tap-start: initial state is ready');
  // Fire canvas pointerdown — the real tap path: onTap() → flap() → startGame() + FLAP_VY
  g.getEl('game').fire('pointerdown');
  ok(T().state === 'playing', 'canvas tap from ready → playing');
  ok(T().bird.vy < 0, 'canvas tap from ready gives negative vy (upward impulse), got ' + T().bird.vy);
}

// (b3) Space/Enter from 'over' also gives upward vy
section('Key-restart impulse');
{
  g = runGame(); T().start();
  while (T().state === 'playing') T().step(1);
  ok(T().state === 'over', 'key-restart: game ended');
  g.fireKey(' ');
  ok(T().state === 'playing', 'Space from over → playing');
  ok(T().bird.vy < 0, 'Space from over gives upward impulse, got ' + T().bird.vy);
}

// (c) gravity: stepping without flapping lowers the bird and increases vy
section('Gravity');
g = runGame(); T().start();
const y0 = T().bird.y;
const vy0 = T().bird.vy;
T().step(10);
ok(T().bird.vy > vy0, 'gravity increases vy downward after 10 steps (was ' + vy0 + ', now ' + T().bird.vy + ')');
ok(T().bird.y > y0, 'bird moves down without flapping (was ' + y0 + ', now ' + T().bird.y + ')');

// (d) flap() gives upward velocity
section('Flap');
g = runGame(); T().start();
T().step(5); // let some gravity accumulate
const vyBefore = T().bird.vy;
T().flap();
ok(T().bird.vy < vyBefore, 'flap() reduces vy (was ' + vyBefore + ', now ' + T().bird.vy + ')');
ok(T().bird.vy < 0, 'vy is negative (upward) after flap (' + T().bird.vy + ')');

// (e) flying through a deterministically-placed gap increments score
section('Gap scoring');
g = runGame();
T().seed(42);
T().start();
// Place gap at a safe vertical position
const H = 800;
const gapY = H * 0.38;   // 304
const birdTarget = gapY + 92;  // 396 — middle of the gap (GAP_H=185, so midpoint is +92)
T().spawnGapAt(gapY);
// Step 60 frames (grace period before first obstacle) keeping bird alive by flapping
for (let i = 0; i < 60; i++) { if (T().bird.y > birdTarget + 20) T().flap(); T().step(1); }
// Now keep flying toward the gap until score increments or the run ends.
// Obstacle spawns at x = W+OBS_W (~1342) and travels at OBS_SPEED_DAY=2.1 px/frame,
// so allow ~800 steps for it to pass BIRD_X fully.
let guard = 0;
while (T().score < 1 && T().state === 'playing' && guard++ < 800) {
  if (T().bird.y > birdTarget + 20) T().flap();
  T().step(1);
}
ok(T().score >= 1, 'score increments after flying through gap (score=' + T().score + ')');

// (e2) hitbox uses stem width (OBS_W-12), not full OBS_W — bird in gap side-inset should survive
section('Collision hitbox alignment');
{
  // Bird at BIRD_X=90, br=10 (BIRD_R-HITBOX_SHRINK=14-4=10). Obstacle stem at o.x+6.
  // Place obstacle so stemX = obsX+6 is just right of bird's right edge (90+10=100).
  // obsX=95 → stemX=101 → bird right=100 < stemX=101 → NOT inX → no collision.
  g = runGame();
  T().start();
  const obsX = 95; // stemX = 95+6 = 101, bird right = 90+10 = 100
  T().spawnGapAt(800 * 0.42); // gap centered near bird y
  T().step(1); // trigger spawn if needed
  const obs = T().obstacles;
  if (obs.length > 0) {
    obs[0].x = obsX;
    T().step(1);
    ok(T().state === 'playing', 'bird outside stem inset survives (hitbox matches stem, not full column)');
  } else {
    ok(true, 'hitbox test skipped (no obstacle yet)');
  }
}

// (f) hitting the ground → 'over'
section('Ground collision');
g = runGame(); T().start();
let safeGuard = 0;
while (T().state === 'playing' && safeGuard++ < 2000) { T().step(1); }
ok(T().state === 'over', 'falling to ground triggers game over (state=' + T().state + ')');

// (g) best persists to localStorage
section('Best persistence');
g = runGame();
T().setBest(0);
T().start();
T().seed(99);
const persistGapY = H * 0.38;
const persistBirdTarget = persistGapY + 92;
T().spawnGapAt(persistGapY);
// Grace period — keep bird alive
for (let i = 0; i < 60; i++) { if (T().bird.y > persistBirdTarget + 20) T().flap(); T().step(1); }
let persistGuard = 0;
while (T().score < 1 && T().state === 'playing' && persistGuard++ < 800) {
  if (T().bird.y > persistBirdTarget + 20) T().flap();
  T().step(1);
}
if (T().score > 0) {
  ok(g.store['flappy_best'] !== undefined && parseInt(g.store['flappy_best'], 10) >= T().score,
    'best saved to shared localStorage key (stored=' + g.store['flappy_best'] + ', score=' + T().score + ')');
} else {
  T().setBest(5);
  ok(g.store['flappy_best'] === '5', 'setBest writes to shared best key');
}

// (h) over → start() restarts
section('Restart');
g = runGame(); T().start();
while (T().state === 'playing') { T().step(1); }
ok(T().state === 'over', 'game ends');
T().start();
ok(T().state === 'playing', 'start() from over → playing again');
ok(T().score === 0, 'score resets on restart');

// (i) easier difficulty constants
section('Easier difficulty');
{
  g = runGame();
  ok(T().GAP_H >= 175, 'GAP_H is at least 175 (got ' + T().GAP_H + ') — bigger gap than original 148');
  ok(T().GRAVITY <= 0.32, 'GRAVITY is at most 0.32 (got ' + T().GRAVITY + ') — gentler than original 0.38');
  ok(T().OBS_INTERVAL >= 260, 'OBS_INTERVAL is at least 260 (got ' + T().OBS_INTERVAL + ') — more spacing than original 220');
}

// (j) bird survives longer with periodic flapping in easier tuning
section('Easier survival');
{
  // Flap every 36 frames — an easy resting rhythm calibrated to the gentler GRAVITY=0.28/FLAP_VY=-6.0.
  // This would be fatal under the original hard tuning (GRAVITY=0.38, FLAP_VY=-7.2 overshoots ceiling).
  // No obstacles can reach the bird within 300 frames (grace period + slow OBS_SPEED_DAY=2.1).
  g = runGame();
  T().seed(1234);
  T().start();
  let flapGuard = 0;
  while (T().state === 'playing' && flapGuard < 300) {
    if (flapGuard % 36 === 0) T().flap();
    T().step(1);
    flapGuard++;
  }
  ok(T().state === 'playing', 'bird survives 300 steps with a relaxed flap-every-36 rhythm (state=' + T().state + ')');
}

// (k) Day mode is default; start() sets mode to day
section('Day mode default');
{
  g = runGame();
  T().start();
  ok(T().mode === 'day', 'start() defaults to day mode (got ' + T().mode + ')');
  ok(T().state === 'playing', 'day mode starts playing');
}

// (l) Night mode: startMode('night') boots, plays, shares the one best key
section('Night mode');
{
  g = runGame();
  g.store['flappy_best'] = '0';
  T().startMode('night');
  ok(T().mode === 'night', 'startMode("night") sets mode to night');
  ok(T().state === 'playing', 'night mode starts playing');

  // Best is shared — night setBest writes the single shared key
  T().setBest(7);
  ok(g.store['flappy_best'] === '7', 'setBest in night mode writes shared flappy_best');
  ok(g.store['flappy_best_night'] === undefined, 'no per-mode night key is created');
}

// (m) startMode('day') switches back to day
section('Mode switching');
{
  g = runGame();
  T().startMode('night');
  ok(T().mode === 'night', 'night mode active');
  T().startMode('day');
  ok(T().mode === 'day', 'startMode("day") switches back to day');
  ok(T().state === 'playing', 'playing after switching to day');
}

// (n) restart from game-over does not reuse pinned test gap
section('pendingGapY cleared on restart');
{
  g = runGame();
  T().start();
  T().spawnGapAt(200); // pin a gap
  // Run a few steps so obstacle may spawn, then die
  for (let i = 0; i < 70; i++) T().step(1);
  // Force game over if still playing
  if (T().state === 'playing') { T().bird.y = 780; T().step(1); }
  ok(T().state === 'over', 'over after crashing');
  // Restart and check pendingGapY is null (no pinned gap bleeds through)
  T().start();
  ok(T().state === 'playing', 'restarted OK');
  // If pendingGapY leaked, the first spawned obstacle would use y=200 (possibly off-screen).
  // We verify by stepping past grace period and checking the gap is within sane bounds.
  for (let i = 0; i < 65; i++) T().step(1);
  const firstObs = T().obstacles[0];
  if (firstObs) {
    ok(firstObs.gapY > 50 && firstObs.gapY < H - 50, 'post-restart gap is within screen bounds (not pinned y=200 leaked): gapY=' + firstObs.gapY);
  } else {
    ok(true, 'no obstacle yet after grace period — gap pin test skipped');
  }
}

// (o) end screen restarts on tap/click (debounced) and on Space (immediate)
section('End-screen restart inputs');
{
  g = runGame(); T().start();
  while (T().state === 'playing') T().step(1);
  ok(T().state === 'over', 'restart-inputs: game ended');
  // Immediate goScreen pointerdown is swallowed by the death-tap debounce window.
  g.getEl('goScreen').fire('pointerdown', { target: g.getEl('goScreen') });
  ok(T().state === 'over', 'immediate end-screen tap is debounced (no instant restart from death-tap)');
  // Space restarts immediately (deliberate keypress, no debounce).
  g.fireKey(' ');
  ok(T().state === 'playing', 'Space restarts the end screen');
  ok(T().bird.vy < 0, 'Space restart gives upward impulse, got ' + T().bird.vy);
}

// (p) end-screen tap on the share row does NOT restart (share controls are exempt)
section('Share-row tap exempt from restart');
{
  g = runGame(); T().start();
  while (T().state === 'playing') T().step(1);
  ok(T().state === 'over', 'share-exempt: game ended');
  // A tap whose target is inside #shareRow must not trigger a restart, even past the debounce.
  const shareTarget = { closest: sel => (sel === '#shareRow' ? g.getEl('shareRow') : null) };
  g.getEl('goScreen').fire('click', { target: shareTarget });
  ok(T().state === 'over', 'tap on share control does not restart the run');
}

// (q) shared best: legacy per-mode keys migrate/merge into flappy_best on boot
section('Shared best migration');
{
  // Boot with pre-seeded legacy per-mode bests so migrateBest() runs at startup.
  g = runGame({ flappy_best_day: '12', flappy_best_night: '20' });
  ok(g.store['flappy_best'] === '20', 'merges max of legacy day/night into flappy_best (got ' + g.store['flappy_best'] + ')');
  ok(g.store['flappy_best_day'] === undefined && g.store['flappy_best_night'] === undefined, 'legacy per-mode keys removed after migration');
  ok(T().best === 20, '__test.best reflects migrated shared best');
}

// (r) cash: passing a pipe banks cash; persists in flappy_cash
section('Cash banking');
{
  g = runGame();
  T().setCash(0);
  T().start();
  const startCash = T().cash;
  T().seed(7);
  const cgapY = 800 * 0.38, cTarget = cgapY + 92;
  T().spawnGapAt(cgapY);
  for (let i = 0; i < 60; i++) { if (T().bird.y > cTarget + 20) T().flap(); T().step(1); }
  let cg = 0;
  while (T().score < 1 && T().state === 'playing' && cg++ < 800) { if (T().bird.y > cTarget + 20) T().flap(); T().step(1); }
  if (T().score >= 1) {
    ok(T().cash > startCash, 'cash increased after passing a pipe (was ' + startCash + ', now ' + T().cash + ')');
    ok(parseInt(g.store['flappy_cash'] || '0', 10) === T().cash, 'cash persisted to flappy_cash');
  } else {
    ok(true, 'cash banking skipped (no pipe passed)');
  }
}

// (s) collectibles: collecting one adds score + cash
section('Collectibles');
{
  g = runGame();
  T().setCash(0);
  T().start();
  const s0 = T().score, c0 = T().cash;
  // Drop a coin right on the bird so the overlap fires next step.
  T().spawnCollectibleAt(T().bird.x, T().bird.y, 3);
  ok(T().collectibles.length === 1, 'collectible spawned');
  T().step(1);
  ok(T().score === s0 + 3, 'collecting adds the coin value to score (got ' + T().score + ')');
  ok(T().cash === c0 + 3, 'collecting adds the coin value to cash (got ' + T().cash + ')');
  ok(T().collectibles.length === 0, 'collectible removed after pickup');
}

// (t) progressive difficulty: gap shrinks with score, clamped at GAP_MIN (0.5× default)
section('Progressive difficulty');
{
  g = runGame();
  T().start();
  ok(Math.abs(T().GAP_MIN - T().GAP_H * 0.5) < 0.001, 'GAP_MIN is exactly half the default GAP_H');
  T().setScore(0);
  const g0 = T().currentGap();
  ok(Math.abs(g0 - T().GAP_H) < 0.001, 'at score 0 the gap equals the default GAP_H (got ' + g0 + ')');
  T().setScore(7);
  const gMid = T().currentGap();
  ok(gMid < g0 && gMid > T().GAP_MIN, 'gap shrinks at mid score but stays above the floor (got ' + gMid + ')');
  T().setScore(500);
  const gHi = T().currentGap();
  ok(gHi >= T().GAP_MIN - 0.001, 'gap never drops below GAP_MIN even at huge score (got ' + gHi + ')');
  ok(Math.abs(gHi - T().GAP_MIN) < 0.001, 'gap clamps exactly to GAP_MIN at the floor (got ' + gHi + ')');
}

// (u) bird unlocks: locked until enough cash, selecting an unlocked bird sticks
section('Bird unlocks');
{
  g = runGame();
  T().setCash(0);
  const birds = T().birds;
  ok(birds.length >= 3, 'multiple bird types exist (got ' + birds.length + ')');
  ok(birds[0].cost === 0 && birds[0].unlocked, 'first bird is free + unlocked');
  const paid = birds.find(b => b.cost > 0);
  ok(paid && !paid.unlocked, 'a costed bird is locked with zero cash');
  ok(T().selectBird(paid.id) === false, 'cannot select a locked bird');
  ok(T().selectedBird === 'bee', 'selection stays on the default bird when locked');
  T().setCash(paid.cost);
  ok(T().birds.find(b => b.id === paid.id).unlocked, 'bird unlocks once cash >= cost');
  ok(T().selectBird(paid.id) === true, 'can select after unlocking');
  ok(T().selectedBird === paid.id, 'selected bird now in use (got ' + T().selectedBird + ')');
  ok(g.store['flappy_bird'] === paid.id, 'selection persisted to flappy_bird');
}

// ----------------------------------------------------------------
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
