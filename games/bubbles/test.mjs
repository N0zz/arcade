// Headless tests for Bubble Pop — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/bubbles/index.html';
const runGame = (opts) => bootGame(FILE, opts);
// bests live in the shared kit store (gamekit_pb), keyed by the capitalized mode label
const pbScore = (store, mode) => { try { return ((JSON.parse(store['gamekit_pb'] || '{}').bubbles || {})[mode] || {}).score || 0; } catch (e) { return 0; } };

// ---- Tests ----

section('Bubble Pop: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');

section('Bubble Pop: initial state');
const T = g.T;
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');

section('Bubble Pop: start()');
T().start();
ok(T().state === 'playing', 'start() sets state to "playing" (got ' + T().state + ')');
ok(T().score === 0, 'score starts at 0');
ok(T().bubbleCount > 0, 'grid is populated on start (got ' + T().bubbleCount + ')');
ok(T().level === 1, 'level starts at 1');
ok(T().mode === 'arcade', 'start() defaults to arcade mode');

section('Bubble Pop: startMode');
{
  const g2 = runGame();
  const T2 = g2.T;
  T2().startMode('endless');
  ok(T2().state === 'playing', 'startMode(endless) sets playing');
  ok(T2().mode === 'endless', 'mode is endless');
  T2().startMode('zen');
  ok(T2().state === 'playing', 'startMode(zen) sets playing');
  ok(T2().mode === 'zen', 'mode is zen');
  T2().startMode('arcade');
  ok(T2().mode === 'arcade', 'startMode(arcade) mode is arcade');
  // time-based descent toggle: applies to arcade/endless, ignored in zen
  T2().startMode('arcade', true);
  ok(T2().timed === true, 'startMode(arcade, timed) turns on time-based descent');
  T2().startMode('arcade', false);
  ok(T2().timed === false, 'startMode(arcade) defaults to shot-based descent');
  T2().startMode('endless', true);
  ok(T2().timed === true, 'time-based descent also applies to endless');
  T2().startMode('zen', true);
  ok(T2().timed === false, 'zen ignores the toggle (never descends)');
}

section('Bubble Pop: grid getter');
{
  T().start();
  const grid = T().grid;
  ok(Array.isArray(grid), 'grid is an array');
  ok(grid.length > 0, 'grid has rows (got ' + grid.length + ')');
  ok(Array.isArray(grid[0]), 'grid rows are arrays');
  ok(grid[0].length === T().COLS_COUNT, 'row length matches COLS_COUNT');
  // Every non-null cell is a number
  let allValid = true;
  for (const row of grid) for (const cell of row) {
    if (cell !== null && typeof cell !== 'number') allValid = false;
  }
  ok(allValid, 'all grid cells are null or a number colorIdx');
}

section('Bubble Pop: shoot + pop (matching 3-group)');
{
  const g3 = runGame();
  const T3 = g3.T;
  T3().startMode('zen'); // zen: no descent pressure, no level advance on clear

  // Build a cluster of 3 same-color near center ceiling, plus a lone different-color
  // so the board is never fully cleared (avoids level-advance in arcade).
  // Row 0, cols 5,6,7 = color 2. Row 1 col 0 = color 0 (different, isolated).
  T3().clearGrid();
  T3().setGridCell(0, 5, 2);
  T3().setGridCell(0, 6, 2);
  T3().setGridCell(0, 7, 2);
  T3().setGridCell(1, 0, 0); // anchor so grid isn't empty after pop

  const countBefore = T3().bubbleCount;
  const scoreBefore = T3().score;
  ok(countBefore === 4, 'setup: 4 bubbles in grid (got ' + countBefore + ')');

  // Shoot a color-2 bubble straight up — it lands at ceiling near cols 5-7 and completes 4-group
  T3().setShotColor(2);
  T3().aimAngle(-Math.PI / 2);
  T3().shoot();
  T3().step(150);

  const countAfter = T3().bubbleCount;
  const scoreAfter = T3().score;
  ok(scoreAfter > scoreBefore, 'popping 3-group: score increased (' + scoreBefore + ' -> ' + scoreAfter + ')');
  ok(countAfter < countBefore, 'popping 3-group: bubbleCount decreased (' + countBefore + ' -> ' + countAfter + ')');
}

section('Bubble Pop: non-matching shot just attaches');
{
  const g4 = runGame();
  const T4 = g4.T;
  T4().startMode('arcade');
  T4().clearGrid();
  // Place only 2 red bubbles (color 0) at ceiling
  T4().setGridCell(0, 5, 0);
  T4().setGridCell(0, 6, 0);
  const countBefore = T4().bubbleCount;
  ok(countBefore === 2, 'setup: 2 bubbles in grid');

  // Shoot a different color (color 1) straight up — it should attach, not pop
  T4().setShotColor(1);
  T4().aimAngle(-Math.PI / 2);
  T4().shoot();
  T4().step(120);

  const countAfter = T4().bubbleCount;
  // count should be 3 (2 old + 1 new attached) — no pop occurred since 3-same color not formed
  // Or could be 2 if the shot lands somewhere isolated; but NOT less than before
  ok(countAfter >= countBefore, 'non-matching shot: count did not decrease (' + countBefore + ' -> ' + countAfter + ')');
  ok(T4().score === 0, 'non-matching shot: score stays 0 (got ' + T4().score + ')');
}

section('Bubble Pop: lose condition (bubbles below line)');
{
  const g5 = runGame();
  const T5 = g5.T;
  T5().startMode('arcade');
  T5().clearGrid();

  // Force descent until bubbles reach the lose line
  // Place bubbles in row 0, then repeatedly call forceDescend
  T5().setGridCell(0, 0, 3);
  T5().setGridCell(0, 1, 3);

  // Keep descending until game over
  let guard = 0;
  while (T5().state === 'playing' && guard++ < 200) {
    T5().forceDescend();
    T5().step(1);
  }
  ok(T5().state === 'over', 'bubbles reaching lose line triggers game over (state=' + T5().state + ')');
}

section('Bubble Pop: best persists in localStorage');
{
  const g6 = runGame();
  const T6 = g6.T;
  T6().startMode('arcade');

  // Score some points by manually setting score, then trigger game over
  T6().setScore(500);

  // Trigger lose
  T6().clearGrid();
  T6().setGridCell(0, 0, 1);
  let guard2 = 0;
  while (T6().state === 'playing' && guard2++ < 200) {
    T6().forceDescend();
    T6().step(1);
  }
  ok(T6().state === 'over', 'game over for best-persist test');
  const stored = pbScore(g6.store, 'Arcade');
  ok(stored >= 500, 'best score persisted to profile store (score=500, stored=' + stored + ')');
}

section('Bubble Pop: zen mode has no descent');
{
  const gz = runGame();
  const Tz = gz.T;
  Tz().startMode('zen');
  Tz().clearGrid();
  Tz().setGridCell(0, 0, 2);

  // Run many frames — grid should NOT descend in zen mode
  const gridYBefore = Tz().gridY(0);
  Tz().step(500);
  const gridYAfter = Tz().gridY(0);
  ok(gridYAfter === gridYBefore, 'zen mode: grid does not descend after 500 steps (' + gridYBefore + ' -> ' + gridYAfter + ')');
  ok(Tz().state === 'playing', 'zen mode: still playing after 500 steps with no pop');
}

section('Bubble Pop: endless mode adds rows');
{
  const ge = runGame();
  const Te = ge.T;
  Te().startMode('endless');
  const countBefore = Te().bubbleCount;
  const rowsBefore = Te().grid.length;
  // Step past the endless row interval (300 frames)
  Te().step(310);
  const rowsAfter = Te().grid.length;
  ok(rowsAfter >= rowsBefore, 'endless: row count does not decrease (' + rowsBefore + ' -> ' + rowsAfter + ')');
}

section('Bubble Pop: special charge fills and grants special shot');
{
  const gs = runGame();
  const Ts = gs.T;
  Ts().startMode('arcade');
  ok(Ts().chargeLevel === 0, 'charge starts at 0');
  Ts().addCharge(1.0);
  ok(Ts().specialReady === true, 'addCharge(1) grants special shot');
  ok(Ts().specialType !== null, 'specialType is set when special is ready');
}

section('Bubble Pop: per-mode bests for menu');
{
  const gb = runGame();
  const Tb = gb.T;
  // Seed distinct bests per mode and confirm bestFor reads each one back.
  Tb().startMode('arcade');
  Tb().setScore(700);
  Tb().clearGrid();
  Tb().setGridCell(0, 0, 1);
  let gb1 = 0;
  while (Tb().state === 'playing' && gb1++ < 200) { Tb().forceDescend(); Tb().step(1); }

  Tb().startMode('endless');
  Tb().setScore(1200);
  Tb().clearGrid();
  Tb().setGridCell(0, 0, 1);
  let gb2 = 0;
  while (Tb().state === 'playing' && gb2++ < 200) { Tb().forceDescend(); Tb().step(1); }

  ok(Tb().bestFor('arcade') >= 700, 'bestFor(arcade) returns persisted arcade best (got ' + Tb().bestFor('arcade') + ')');
  ok(Tb().bestFor('endless') >= 1200, 'bestFor(endless) returns persisted endless best (got ' + Tb().bestFor('endless') + ')');
  ok(Tb().bestFor('zen') === 0, 'bestFor(zen) is 0 when never played (got ' + Tb().bestFor('zen') + ')');
  // the kit start menu (mode cards): from the end screen → Menu → start menu, then a card pick + Play
  Tb().menu().activate('menu');
  const sm = Tb().menu();
  ok(sm && sm.selection().mode, 'start menu opens with a mode preselected');
  if (sm) { sm.select('mode', 'endless'); sm.activate('play'); }
  ok(Tb().state === 'playing' && Tb().mode === 'endless', 'picking a mode card + Play starts that mode (got ' + Tb().mode + '/' + Tb().state + ')');
}

section('Bubble Pop: setShotColor / aimAngle API');
{
  T().startMode('arcade');
  T().setShotColor(3);
  ok(T().shotColor === 3, 'setShotColor sets shotColor (got ' + T().shotColor + ')');
  T().aimAngle(-Math.PI / 3);
  // No direct getter for aimAngle — just verify shoot() works with arbitrary angle
  T().shoot();
  ok(T().isShooting === true, 'shoot() starts a shot');
  T().step(5);
}

// ---- Layout: everything on-screen + no overlap with the HUD, in portrait / landscape / desktop ----
section('Bubble Pop: layout fits the screen (portrait / landscape / desktop)');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().startMode('arcade'); return gl; }, // fresh full grid for this viewport
  (gl, v, L0) => {
    gl.T().step(1);
    const L = gl.T().layout;
    ok(L.grid != null, `${v.name}: grid is populated`);

    // Grid bounding box stays fully on-screen
    ok(L.grid.left >= 0 && L.grid.right <= L.W,
      `${v.name}: grid within 0..W (left=${L.grid.left.toFixed(1)} right=${L.grid.right.toFixed(1)} W=${L.W})`);
    ok(L.grid.top >= 0 && L.grid.bottom <= L.H,
      `${v.name}: grid within 0..H (top=${L.grid.top.toFixed(1)} bottom=${L.grid.bottom.toFixed(1)} H=${L.H})`);

    // Grid top row clears the HUD headroom (no overlap with the score pill)
    ok(L.grid.top >= L.topReserve,
      `${v.name}: grid top clears HUD reserve (top=${L.grid.top.toFixed(1)} >= ${L.topReserve})`);

    // Walls bound the play column: grid sits inside [walls.left, walls.right], below the ceiling,
    // and the walls themselves are inset from the screen edges (room for the wall + margin).
    ok(L.walls != null, `${v.name}: walls exposed`);
    ok(L.grid.left >= L.walls.left - 0.5 && L.grid.right <= L.walls.right + 0.5,
      `${v.name}: grid within walls (grid ${L.grid.left.toFixed(1)}..${L.grid.right.toFixed(1)} vs walls ${L.walls.left.toFixed(1)}..${L.walls.right.toFixed(1)})`);
    ok(L.grid.top >= L.walls.ceiling - 0.5,
      `${v.name}: grid top below the ceiling (top=${L.grid.top.toFixed(1)} >= ceiling=${L.walls.ceiling.toFixed(1)})`);
    ok(L.walls.left - L.walls.thickness >= 0 && L.walls.right + L.walls.thickness <= L.W,
      `${v.name}: walls (incl. thickness) fit on-screen`);

    // Shooter on-screen
    ok(L.shooterX >= 0 && L.shooterX <= L.W,
      `${v.name}: shooter X within 0..W (${L.shooterX.toFixed(1)} / ${L.W})`);
    ok(L.shooterY >= 0 && L.shooterY <= L.H,
      `${v.name}: shooter Y within 0..H (${L.shooterY.toFixed(1)} / ${L.H})`);

    // Shooter sits below the grid and above the bottom edge
    ok(L.shooterY > L.grid.bottom,
      `${v.name}: shooter below grid (shooterY=${L.shooterY.toFixed(1)} > gridBottom=${L.grid.bottom.toFixed(1)})`);
    ok(L.shooterY < L.H,
      `${v.name}: shooter above bottom edge (shooterY=${L.shooterY.toFixed(1)} < H=${L.H})`);
  }
);

// ---- Shots bounce off the play-column wall, not the screen edge (landscape, where the column is inset) ----
section('Bubble Pop: shot bounces off the column wall');
{
  const gb = runGame();
  gb.resize(1280, 800);            // wide → column is centered, walls well inside the screen
  gb.T().startMode('arcade');
  gb.T().step(1);
  const L0 = gb.T().layout, walls = L0.walls, R = L0.R, W = L0.W;
  gb.T().aimAngle(-0.25);          // shallow rightward-up shot → reaches the right wall low, before the grid
  gb.T().shoot();
  let maxX = -Infinity, reachedWall = false;
  for (let i = 0; i < 60; i++) {
    gb.T().step(1);
    const s = gb.T().shot;
    if (!s) break;                 // landed
    maxX = Math.max(maxX, s.x);
    if (s.x >= walls.right - R - 3) reachedWall = true;
  }
  ok(reachedWall, `shot reaches the right wall (maxX=${maxX.toFixed(1)}, wall=${walls.right.toFixed(1)})`);
  ok(maxX <= walls.right + 0.5, `shot never crosses the wall (maxX=${maxX.toFixed(1)} <= ${walls.right.toFixed(1)})`);
  ok(maxX < W - R - 1, `bounces off the column, not the screen edge (maxX=${maxX.toFixed(1)} << W=${W})`);
}

// ---- Descent keeps the shape (no horizontal reshape) + landing snaps to nearest empty cell ----
section('Bubble Pop: descent shape + landing snap');
{
  // (1) inserting a row on top must move existing bubbles straight DOWN, not sideways
  const g = runGame();
  g.resize(390, 780);
  g.T().clearGrid();
  g.T().setGridCell(0, 3, 0);
  const x0 = g.T().cellX(0, 3);          // its on-screen X at row 0
  g.T().pushTopRow();                     // endless descent → bubble is now at row 1
  const x1 = g.T().cellX(1, 3);
  ok(Math.abs(x0 - x1) < 0.01, 'descend keeps each bubble’s horizontal position (no reshape): ' + x0.toFixed(2) + ' vs ' + x1.toFixed(2));
  ok(g.T().gridParity === 1, 'gridParity toggles on a top-row insert');

  // (2) a landed shot snaps to the EMPTY cell nearest the contact point — never a far/occupied one
  const g2 = runGame();
  g2.resize(390, 780);
  g2.T().clearGrid();
  for (let c = 0; c < 12; c++) g2.T().setGridCell(0, c, 0); // row 0 full, row 1 empty
  const tx = g2.T().cellX(1, 5), ty = g2.T().cellY(1);      // contact right at empty cell (1,5)
  const s = g2.T().snap(tx, ty);
  ok(s.row === 1 && s.col === 5, 'snap picks the empty cell nearest the contact point (got ' + s.row + ',' + s.col + ')');
  const occupied = !!(g2.T().grid[s.row] && g2.T().grid[s.row][s.col] != null);
  ok(!occupied, 'snap never returns an occupied cell');
}

// ---- Ceiling glue: a shot up an empty column sticks to the (descended) top row ----
// Regression for "bubbles don't glue to the ceiling": once the board has descended, the top
// ROW sits below the fixed visual ceiling. A shot into the empty gap must stop at the top row
// (gridY(0)), not fly up to the ceiling and teleport back down (which read as "disappears").
section('Bubble Pop: shot glues to the descended top row, not the fixed ceiling');
{
  const g6 = runGame();
  const T6 = g6.T;
  T6().startMode('arcade', false);
  T6().clearGrid();
  T6().setGridCell(0, 0, 0);        // a left anchor so the board isn't empty (and shot's center column stays clear)
  T6().forceDescend();
  T6().forceDescend();              // push the top row well below the ceiling
  const R = T6().layout.R;
  const ceiling = T6().layout.walls.ceiling;
  const topRowY = T6().cellY(0);    // gridY(0) — descended top-row center
  ok(topRowY > ceiling + R, 'setup: descent put the top row below the ceiling (topRowY=' + topRowY.toFixed(1) + ', ceiling=' + ceiling.toFixed(1) + ')');

  const before = T6().bubbleCount;
  T6().setShotColor(1);             // different color → attaches, no pop
  T6().aimAngle(-Math.PI / 2);      // straight up the center column (clear of the col-0 anchor)
  T6().shoot();
  let lastY = null;
  for (let i = 0; i < 250 && T6().isShooting; i++) { if (T6().shot) lastY = T6().shot.y; T6().step(1); }

  ok(T6().bubbleCount === before + 1, 'shot attached (count +1) — did not vanish (' + before + ' -> ' + T6().bubbleCount + ')');
  ok(lastY != null && lastY >= topRowY - R, 'shot stopped at the descended top row, not the fixed ceiling (lastY=' + (lastY == null ? 'null' : lastY.toFixed(1)) + ', topRowY=' + topRowY.toFixed(1) + ')');
  const inTopRow = (T6().grid[0] || []).some((ci, c) => ci === 1);
  ok(inTopRow, 'the new bubble glued into the top row (row 0)');
}

summary();
