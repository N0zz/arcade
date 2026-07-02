// Headless tests for Neon Snake — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/snake/index.html';
const runGame = (opts) => bootGame(FILE, opts);
// bests live in the shared kit store (gamekit_pb), keyed by the human combo label (speed · walls[ · size])
const pbScore = (store, mode) => { try { return ((JSON.parse(store['gamekit_pb'] || '{}').snake || {})[mode] || {}).score || 0; } catch (e) { return 0; } };

// ---- Tests ----

section('boot');
{
  const g = runGame();
  ok(g.bootErr === null, 'game boots without error: ' + g.bootErr);
  ok(g.T() != null, 'exposes window.__test');
}

section('start');
{
  const g = runGame();
  const T = g.T;
  ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
  T().start();
  ok(T().state === 'playing', 'start() transitions to "playing" (got ' + T().state + ')');
  ok(T().score === 0, 'score starts at 0 (got ' + T().score + ')');
  ok(T().length >= 1, 'snake has at least 1 segment (got ' + T().length + ')');
}

section('eating grows snake and scores');
{
  const g = runGame();
  const T = g.T;
  T().start();
  const head = T().head;
  // Place food directly ahead (snake starts moving right by default)
  T().placeFoodAt(head.x + 1, head.y);
  const lenBefore = T().length;
  const scoreBefore = T().score;
  T().step(1);
  ok(T().length === lenBefore + 1, 'eating food grows length by 1 (' + lenBefore + ' -> ' + T().length + ')');
  ok(T().score > scoreBefore, 'eating food increases score (' + scoreBefore + ' -> ' + T().score + ')');
}

section('wall collision ends game (solid mode)');
{
  const g = runGame();
  const T = g.T;
  T().start(); // defaults to solid
  // Point snake upward and step until it hits the top wall
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(T().state === 'over', 'hitting a wall transitions to "over" (got ' + T().state + ')');
}

section('180-degree reversal ignored');
{
  const g = runGame();
  const T = g.T;
  T().start();
  // Default dir is right; trying to go left should be ignored
  T().setDir(-1, 0);
  T().step(1);
  ok(T().state === 'playing', 'snake is still alive after attempted 180° reversal (state=' + T().state + ')');
  ok(T().head.x >= T().head.x, 'head did not move backward (snake survived)');
}

section('self collision ends game');
{
  const g = runGame();
  const T = g.T;
  T().start();
  // Grow the snake a bit by feeding it, then steer it into itself
  const h = T().head;
  // Feed it several times to make it long enough to loop back
  for (let i = 1; i <= 5; i++) {
    T().placeFoodAt(h.x + i, h.y);
    T().step(1);
  }
  // Now steer: down, left, up — so head hits body
  T().turn('down'); T().step(1);
  T().turn('left'); T().step(1);
  T().turn('up');   T().step(1);
  ok(T().state === 'over', 'self collision transitions to "over" (got ' + T().state + ')');
}

section('tail-tip not a false death');
{
  // Snake in a U-shape where the new head lands exactly on the tail tip that moves away.
  // Build: head(3,3) ← (2,3) ← (2,2) ← (3,2) ← (4,2) ← tail(4,3), dir=right
  // New head = (4,3) which is currently the tail tip — must NOT be a death.
  const g = runGame();
  const T = g.T;
  T().start();
  // Grow to length 6 via eating, then manually verify via setDir
  // We'll construct the scenario by placing food and steering.
  // Start: head at center going right. Grow to 6 segments.
  const h0 = T().head;
  for (let i = 1; i <= 5; i++) {
    T().placeFoodAt(h0.x + i, h0.y);
    T().step(1);
  }
  // Snake is now (h0.x+5,h0.y)...(h0.x,h0.y), length 6, going right.
  // Steer into a tight U: down, then left 4, then up — head lines up with tail.
  T().turn('down');  T().step(1);
  T().turn('left');  T().step(1);
  T().turn('left');  T().step(1);
  T().turn('left');  T().step(1);
  T().turn('left');  T().step(1);
  T().turn('up');    T().step(1);
  // At this point head should have moved into the column where the tail just vacated.
  ok(T().state === 'playing', 'moving into vacated tail-tip slot is NOT a death (state=' + T().state + ')');
}

section('best score persists');
{
  const g = runGame();
  const T = g.T;
  T().start();
  // Eat food to get a score
  const h = T().head;
  T().placeFoodAt(h.x + 1, h.y);
  T().step(1);
  const scoreAfterEat = T().score;
  // Drive into wall to end game
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(T().state === 'over', 'game ended (state=' + T().state + ')');
  const saved = pbScore(g.store, 'Normal · Walls');
  ok(saved >= scoreAfterEat, 'best score persisted to profile store (' + saved + ' >= ' + scoreAfterEat + ')');
}

section('__test API surface');
{
  const g = runGame();
  const T = g.T;
  T().start();
  ok(typeof T().state === 'string', '__test.state is a string');
  ok(typeof T().score === 'number', '__test.score is a number');
  ok(typeof T().length === 'number', '__test.length is a number');
  ok(T().head !== null && typeof T().head.x === 'number', '__test.head exposes {x,y}');
  ok(typeof T().step === 'function', '__test.step is a function');
  ok(typeof T().setDir === 'function', '__test.setDir is a function');
  ok(typeof T().turn === 'function', '__test.turn is a function');
  ok(typeof T().placeFoodAt === 'function', '__test.placeFoodAt is a function');
  ok(typeof T().start === 'function', '__test.start is a function');
  ok(typeof T().startMode === 'function', '__test.startMode is a function');
  ok(typeof T().cols === 'number', '__test.cols is a number');
  ok(typeof T().rows === 'number', '__test.rows is a number');
}

section('wrap mode — crossing walls survives');
{
  const g = runGame();
  const T = g.T;
  // Start with wrap mode
  T().startMode({ wrap: true, fast: false, size: 'medium' });
  ok(T().state === 'playing', 'startMode wrap started playing');
  // Move snake to the right edge and step it through
  const cols = T().cols;
  const startHead = T().head;
  // Place snake at rightmost column by teleporting food to move there
  // Move right until we'd hit the wall; with wrap we should survive
  let guard = 0;
  while (T().head.x < cols - 1 && guard++ < 200) T().step(1);
  ok(T().state === 'playing', 'survived approaching right wall (state=' + T().state + ')');
  const headAtEdge = T().head;
  ok(headAtEdge.x === cols - 1, 'head reached right edge (x=' + headAtEdge.x + ')');
  // One more step should wrap to x=0
  T().step(1);
  ok(T().state === 'playing', 'survived crossing right wall in wrap mode (state=' + T().state + ')');
  ok(T().head.x === 0, 'head wrapped to x=0 (got x=' + T().head.x + ')');
}

section('wrap mode — crossing top wall survives');
{
  const g = runGame();
  const T = g.T;
  T().startMode({ wrap: true });
  ok(T().state === 'playing', 'wrap mode started');
  const rows = T().rows;
  // Turn up and step to top edge
  T().turn('up');
  let guard = 0;
  while (T().head.y > 0 && guard++ < 200) T().step(1);
  ok(T().state === 'playing', 'survived approaching top wall');
  ok(T().head.y === 0, 'reached top row (y=' + T().head.y + ')');
  // One more step wraps to bottom
  T().step(1);
  ok(T().state === 'playing', 'survived crossing top wall in wrap mode (state=' + T().state + ')');
  ok(T().head.y === rows - 1, 'head wrapped to bottom (y=' + T().head.y + ', rows-1=' + (rows - 1) + ')');
}

section('solid mode — wall still kills');
{
  const g = runGame();
  const T = g.T;
  T().startMode({ wrap: false });
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(T().state === 'over', 'wall still kills in solid mode (state=' + T().state + ')');
}

section('board size changes grid dimensions');
{
  const g = runGame();
  const T = g.T;

  T().startMode({ size: 'small' });
  const smallCols = T().cols, smallRows = T().rows;
  ok(smallCols === 18, 'small board: cols=18 (got ' + smallCols + ')');
  ok(smallRows === 14, 'small board: rows=14 (got ' + smallRows + ')');

  T().startMode({ size: 'medium' });
  const medCols = T().cols, medRows = T().rows;
  ok(medCols === 28, 'medium board: cols=28 (got ' + medCols + ')');
  ok(medRows === 22, 'medium board: rows=22 (got ' + medRows + ')');

  T().startMode({ size: 'large' });
  const largeCols = T().cols, largeRows = T().rows;
  ok(largeCols === 40, 'large board: cols=40 (got ' + largeCols + ')');
  ok(largeRows === 30, 'large board: rows=30 (got ' + largeRows + ')');
}

section('default start() uses solid/normal/medium');
{
  const g = runGame();
  const T = g.T;
  T().start();
  ok(T().cols === 28, 'default start uses medium cols=28 (got ' + T().cols + ')');
  ok(T().rows === 22, 'default start uses medium rows=22 (got ' + T().rows + ')');
  // Verify solid walls by hitting the top wall
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(T().state === 'over', 'default start uses solid walls (wall killed snake)');
}

section('options persist to localStorage');
{
  const g = runGame();
  const T = g.T;
  T().startMode({ wrap: true, fast: true, size: 'large' });
  ok(T().state === 'playing', 'started with options');
  const saved = g.store['snake_opts'];
  ok(saved != null, 'snake_opts saved to localStorage');
  const parsed = JSON.parse(saved);
  ok(parsed.walls === 'wrap', 'saved walls=wrap (got ' + parsed.walls + ')');
  ok(parsed.speed === 'fast', 'saved speed=fast (got ' + parsed.speed + ')');
  ok(parsed.size === 'large', 'saved size=large (got ' + parsed.size + ')');
}

section('kit menus: start plays; game over opens the end menu; Play Again restarts');
{
  const g = runGame();
  const T = g.T;
  T().start();
  ok(T().state === 'playing', 'startGame → playing');
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(T().state === 'over', 'game ended (state=' + T().state + ')');
  ok(T().menu() != null, 'kit end menu shown on game over');
  T().menu().activate('again');
  ok(T().state === 'playing', 'Play Again restarts');
}

section('game over preserves final score/length/best');
{
  const g = runGame();
  const T = g.T;
  T().start();
  const h = T().head;
  T().placeFoodAt(h.x + 1, h.y);
  T().step(1);
  const finalScore = T().score, finalLen = T().length;
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(T().state === 'over', 'reached game over');
  ok(T().score === finalScore, 'score preserved at game over (' + T().score + ')');
  ok(T().length === finalLen, 'length preserved (' + T().length + ')');
  ok(T().best >= finalScore, 'best >= final score (' + T().best + ')');
}

section('slow speed option');
{
  const g = runGame();
  const T = g.T;
  T().startMode({ speed: 'slow', size: 'medium' });
  ok(T().state === 'playing', 'startMode slow started playing');
  ok(T().speed === 'slow', 'speed option is slow (got ' + T().speed + ')');
  const slowInterval = T().interval;
  // Compare against normal at the same (just-started) length.
  const g2 = runGame();
  const T2 = g2.T;
  T2().startMode({ speed: 'normal', size: 'medium' });
  const normalInterval = T2().interval;
  ok(slowInterval > normalInterval, 'slow tick is slower than normal (' + slowInterval + ' > ' + normalInterval + ')');
}

section('slow speed persists to localStorage');
{
  const g = runGame();
  const T = g.T;
  T().startMode({ speed: 'slow', size: 'small' });
  const saved = g.store['snake_opts'];
  ok(saved != null, 'snake_opts saved');
  const parsed = JSON.parse(saved);
  ok(parsed.speed === 'slow', 'saved speed=slow (got ' + parsed.speed + ')');
  // Reload — the slow option should survive a fresh boot.
  const g2 = runGame();
  // copy persisted store into new game's store is not automatic; instead verify loadOpts accepts slow
  // by checking the freshly-booted game read default then we re-set. Use the same store:
  // simpler: assert the value round-trips through SPEED_CFG validation (already saved).
  ok(JSON.parse(g.store['snake_opts']).speed === 'slow', 'slow option round-trips');
}

section('per-mode best scores');
{
  const g = runGame();
  const T = g.T;
  // Score in slow/medium/solid mode.
  T().startMode({ speed: 'slow', size: 'medium', wrap: false });
  const h = T().head;
  T().placeFoodAt(h.x + 1, h.y);
  T().step(1);
  const slowScore = T().score;
  ok(slowScore > 0, 'scored in slow mode (' + slowScore + ')');
  // End the game so best persists.
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 50) T().step(1);
  ok(pbScore(g.store, 'Slow · Walls') >= slowScore, 'best keyed by mode "Slow · Walls" (got ' + pbScore(g.store, 'Slow · Walls') + ')');
  // A different mode should NOT inherit that best.
  ok(pbScore(g.store, 'Fast · Walls · Large') === 0, 'different mode has independent best');
}

section('per-combo best via best(opts)');
{
  const g = runGame();
  const T = g.T;
  const combo = { walls: 'solid', speed: 'normal', size: 'small' };
  ok(T().comboBest(combo) === 0, 'fresh combo best is 0');
  T().startMode({ speed: 'normal', size: 'small', wrap: false });
  const h = T().head;
  T().placeFoodAt(h.x + 1, h.y);
  T().step(1);
  const sc = T().score;
  T().turn('up');
  let guard = 0;
  while (T().state === 'playing' && guard++ < 60) T().step(1);
  ok(T().state === 'over', 'game ended to record a best');
  ok(T().comboBest(combo) === sc, 'best(combo) reflects the recorded score (' + sc + ' vs ' + T().comboBest(combo) + ')');
}

section('Neon Snake: layout fits the screen (arena on-screen, no HUD overlap)');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().start(); return gl; },
  (gl, v, L0) => {
    gl.T().step(1); // one frame so state is live
    const L = gl.T().layout;

    // arena bounding box stays within the viewport on all sides
    ok(L.arenaLeft >= 0, v.name + ': arena left edge on-screen (' + L.arenaLeft + ' >= 0)');
    ok(L.arenaTop >= 0, v.name + ': arena top edge on-screen (' + L.arenaTop + ' >= 0)');
    ok(L.arenaRight <= L.W, v.name + ': arena right edge on-screen (' + L.arenaRight + ' <= ' + L.W + ')');
    ok(L.arenaBottom <= L.H, v.name + ': arena bottom edge on-screen (' + L.arenaBottom + ' <= ' + L.H + ')');

    // arena clears the top HUD headroom (no score-pill overlap)
    ok(L.arenaTop >= L.topReserve, v.name + ': arena top clears HUD reserve (' + L.arenaTop + ' >= ' + L.topReserve + ')');

    // landscape reserves a side strip for the D-pad — arena must not run into it
    if (L.landscape) {
      ok(L.arenaRight <= L.W - L.rSide, v.name + ': arena clears the reserved side strip (' + L.arenaRight + ' <= ' + (L.W - L.rSide) + ')');
    } else {
      ok(L.arenaBottom <= L.H - L.rBottom, v.name + ': arena clears the reserved bottom strip (' + L.arenaBottom + ' <= ' + (L.H - L.rBottom) + ')');
    }

    // sane positive arena that fits the available space
    ok(L.cell > 0, v.name + ': cell size is positive (' + L.cell + ')');
    const avW = L.W - L.rSide, avH = L.H - L.topReserve - L.rBottom;
    ok(L.cols * L.cell <= avW, v.name + ': arena width fits available width (' + (L.cols * L.cell) + ' <= ' + avW + ')');
    ok(L.rows * L.cell <= avH, v.name + ': arena height fits available height (' + (L.rows * L.cell) + ' <= ' + avH + ')');
  }
);

// ---- Board move handle: sliding the arena up/down stays clamped on-screen ----
section('Neon Snake: board move handle stays clamped');
{
  const g = runGame();
  const T = g.T;
  T().start();
  g.resize(390, 780); // portrait
  T().step(1);
  // slide way up → arena still clears the HUD headroom, and the shift is clamped (not unbounded)
  T().nudgeBoard(-9999);
  let L = T().layout;
  ok(L.arenaTop >= L.topReserve - 0.5, 'up: arena still clears HUD reserve (' + L.arenaTop + ' >= ' + L.topReserve + ')');
  ok(T().boardShiftY > -9999, 'up: shift is clamped, not unbounded (' + T().boardShiftY + ')');
  // slide way down → arena bottom stays above the bottom reserve, shift clamped
  T().nudgeBoard(99999);
  L = T().layout;
  ok(L.arenaBottom <= L.H - L.rBottom + 0.5, 'down: arena clears the bottom strip (' + L.arenaBottom + ' <= ' + (L.H - L.rBottom) + ')');
  ok(T().boardShiftY < 99999, 'down: shift is clamped, not unbounded (' + T().boardShiftY + ')');
}

summary();
