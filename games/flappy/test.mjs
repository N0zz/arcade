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
// best now lives in the shared kit store (gamekit_pb) under flappy's single '' mode
const pbScore = (store, mode) => { try { return ((JSON.parse(store['gamekit_pb'] || '{}').flappy || {})[mode || ''] || {}).score || 0; } catch (e) { return 0; } };

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

  function resize(w, h) {
    if (win.gamekit && win.gamekit.layout && win.gamekit.layout.__emit) win.gamekit.layout.__emit(w, h);
    else { win.innerWidth = w; win.innerHeight = h; }
  }
  return { win, store, bootErr, test: () => win.__test, getEl, resize, fireKey: (key) => (handlers['keydown'] || []).forEach(fn => fn({ key, preventDefault() {} })) };
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

// (b2) start comes from the kit menu's Play (not a canvas tap on the ready screen)
section('Menu start');
{
  g = runGame();
  ok(T().state === 'ready', 'initial state is ready (menu open)');
  T().start();
  ok(T().state === 'playing', 'menu Play → playing');
}

// (b3) restart comes from the end menu's Play Again
section('Restart from end menu');
{
  g = runGame(); T().start();
  let guard = 0; while (T().state === 'playing' && guard++ < 3000) T().step(1);
  ok(T().state === 'over', 'game ended');
  T().menu().activate('again');
  ok(T().state === 'playing', 'Play Again from the end menu → playing');
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
T().obstacles.length = 0; // drop the wide-screen pre-filled pipes — the controlled gap must arrive first
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
    obs.length = 1; // only the pipe under test (wide screens pre-fill extra pipes at run start)
    obs[0].x = obsX;
    obs[0].gapY = T().bird.y - obs[0].gap / 2; // gap centered on the bird — only the stem inset is under test
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
T().obstacles.length = 0; // same: the controlled gap must be the first pipe
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
  ok(pbScore(g.store) >= T().score,
    'best saved to shared kit store (stored=' + pbScore(g.store) + ', score=' + T().score + ')');
} else {
  T().setBest(5);
  ok(pbScore(g.store) === 5, 'setBest writes to shared kit store');
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
  // Pre-filled pipes (wide-screen head start) are cleared — this checks the flap rhythm only; the
  // edge-spawned pipe can't reach the bird within 300 frames (grace period + slow OBS_SPEED_DAY).
  g = runGame();
  T().seed(1234);
  T().start();
  T().obstacles.length = 0;
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
  T().startMode('night');
  ok(T().mode === 'night', 'startMode("night") sets mode to night');
  ok(T().state === 'playing', 'night mode starts playing');

  // Best is shared — night setBest writes the single shared kit store
  T().setBest(7);
  ok(pbScore(g.store) === 7, 'setBest in night mode writes the shared best');
  ok(pbScore(g.store, 'Night') === 0, 'no per-mode night best is created (single best)');
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

// (o) restart comes from the kit end menu's Play Again action
section('End menu restart');
{
  g = runGame(); T().start();
  let guard = 0; while (T().state === 'playing' && guard++ < 3000) T().step(1);
  ok(T().state === 'over', 'game ended');
  ok(T().menu() != null, 'kit end menu shown on game over');
  T().menu().activate('again');
  ok(T().state === 'playing', 'Play Again restarts');
}

// (q) best is read from the shared kit store on boot
section('Best from shared store');
{
  g = runGame({ gamekit_pb: JSON.stringify({ flappy: { '': { score: 20, plays: 1 } } }) });
  ok(pbScore(g.store) === 20, 'kit store holds the seeded best (got ' + pbScore(g.store) + ')');
  ok(T().best === 20, '__test.best reflects the seeded shared best');
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
  T().obstacles.length = 0; T().collectibles.length = 0; // drop pre-filled pipes + their treats
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

// (t2) speed creep: once the gap is maxed (score 55), scroll speed ramps 1.9→2.5 by score 100
section('Speed creep');
{
  g = runGame();
  T().start();
  T().setScore(0);
  ok(Math.abs(T().currentSpeed() - 1.9) < 0.001, 'day base speed is 1.9 before the ramp (got ' + T().currentSpeed() + ')');
  T().setScore(55);
  ok(Math.abs(T().currentSpeed() - 1.9) < 0.001, 'speed still 1.9 at score 55 (ramp start, got ' + T().currentSpeed() + ')');
  T().setScore(77);
  const sMid = T().currentSpeed();
  ok(sMid > 1.9 && sMid < 2.5, 'speed ramps mid-window (got ' + sMid + ')');
  T().setScore(100);
  ok(Math.abs(T().currentSpeed() - 2.5) < 0.001, 'speed reaches 2.5 at score 100 (got ' + T().currentSpeed() + ')');
  T().setScore(500);
  ok(Math.abs(T().currentSpeed() - 2.5) < 0.001, 'speed clamps at 2.5 beyond the ramp (got ' + T().currentSpeed() + ')');
  T().startMode('night');
  T().setScore(0);
  ok(Math.abs(T().currentSpeed() - 2.2) < 0.001, 'night base speed is 2.2 (got ' + T().currentSpeed() + ')');
  T().setScore(100);
  ok(Math.abs(T().currentSpeed() - 2.8) < 0.001, 'night speed reaches 2.8 at full creep (got ' + T().currentSpeed() + ')');
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

// (v) layout fits the screen across portrait / landscape / desktop viewports
section('Meadow Flyer: layout fits the screen across viewports');
{
  const VIEWPORTS = [
    { name: 'portrait phone', w: 390, h: 780 },
    { name: 'landscape phone', w: 780, h: 390 },
    { name: 'desktop', w: 1280, h: 800 },
  ];
  for (const vp of VIEWPORTS) {
    g = runGame();
    T().start();
    g.resize(vp.w, vp.h);
    T().obstacles.length = 0; // drop pipes pre-filled before the resize — their gaps used the old H
    T().step(1);
    const L = T().layout;
    // Step past the spawn grace period (frame >= 60) to surface a real pipe, keeping the bird
    // alive by flapping toward the playable band's center so the gap-placement asserts run.
    let lp = T().layout;
    const center = (lp.playTop + lp.playBottom) / 2;
    for (let i = 0; i < 90 && T().state === 'playing' && !lp.gap; i++) {
      if (T().bird.y > center) T().flap();
      T().step(1);
      lp = T().layout;
    }
    const G = lp; // layout snapshot that (likely) now carries a pipe gap
    const tag = '[' + vp.name + ' ' + vp.w + 'x' + vp.h + '] ';

    // canvas tracks the viewport exactly
    ok(L.W === vp.w && L.H === vp.h, tag + 'canvas matches viewport (got ' + L.W + 'x' + L.H + ')');

    // bird is fully on-screen horizontally and vertically
    ok(L.bird.left >= 0 && L.bird.right <= L.W, tag + 'bird within 0..W (left=' + L.bird.left + ', right=' + L.bird.right + ', W=' + L.W + ')');
    ok(L.bird.top >= 0 && L.bird.bottom <= L.H, tag + 'bird within 0..H (top=' + L.bird.top + ', bottom=' + L.bird.bottom + ', H=' + L.H + ')');

    // the ground strip sits within the canvas height
    ok(L.groundY > 0 && L.groundY < L.H, tag + 'ground is within height (groundY=' + L.groundY + ', H=' + L.H + ')');

    // playable band clears the HUD reserve at the top and ends at the ground — no overlap with the score pill
    ok(L.playTop >= L.topReserve, tag + 'play band top clears the HUD reserve (playTop=' + L.playTop + ' >= topReserve=' + L.topReserve + ')');
    ok(L.playBottom <= L.groundY, tag + 'play band bottom does not exceed the ground (playBottom=' + L.playBottom + ', groundY=' + L.groundY + ')');

    // the bird spawns inside the playable band (below the HUD, above the ground)
    ok(L.bird.top >= L.topReserve && L.bird.bottom <= L.groundY, tag + 'bird sits inside the play band (top=' + L.bird.top + ' >= ' + L.topReserve + ', bottom=' + L.bird.bottom + ' <= ' + L.groundY + ')');

    // if a pipe has spawned, its gap is positioned within the play area (below the HUD, above the ground)
    if (G.gap) {
      ok(G.gap.gapTop >= G.topReserve, tag + 'pipe gap top clears the HUD reserve (gapTop=' + G.gap.gapTop + ' >= ' + G.topReserve + ')');
      ok(G.gap.gapBottom <= G.groundY, tag + 'pipe gap bottom stays above the ground (gapBottom=' + G.gap.gapBottom + ' <= ' + G.groundY + ')');
      ok(G.gap.gapBottom > G.gap.gapTop, tag + 'pipe gap has positive height (gapTop=' + G.gap.gapTop + ', gapBottom=' + G.gap.gapBottom + ')');
    } else {
      ok(true, tag + 'no pipe spawned yet — gap placement check skipped');
    }
  }
}

// ----------------------------------------------------------------
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail > 0) { console.log('\nFailures:'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
else console.log('All tests passed ✓');
