// Headless tests for Brick Breaker — boots via the shared harness, drives window.__test.
import { bootGame, ok, section, summary, runLayoutSuite } from '../../test-harness.mjs';

const FILE = 'games/breakout/index.html';
const runGame = (opts) => bootGame(FILE, opts);
// bests live in the shared kit store (gamekit_pb), keyed by the capitalized mode label
const pbScore = (store, mode) => { try { return ((JSON.parse(store['gamekit_pb'] || '{}').breakout || {})[mode] || {}).score || 0; } catch (e) { return 0; } };

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
const bricksBefore = T().bricks;
const scoreBefore = T().score;
// aim the ball directly into the first brick row, heading straight up fast
T().setPaddle(640);
T().setBall(640, 120, 0, -15);
T().step(30);
ok(T().bricks < bricksBefore, 'hitting bricks removes them (' + bricksBefore + ' -> ' + T().bricks + ')');
ok(T().score > scoreBefore, 'destroying bricks increases score (' + scoreBefore + ' -> ' + T().score + ')');

section('Breakout: ball falls below paddle costs a life');
T().start();
T().launch();
const livesBefore = T().lives;
T().setBall(640, 780, 0, 15); // below most paddles, heading down
T().step(20);
ok(T().lives < livesBefore, 'ball falling below paddle costs a life (' + livesBefore + ' -> ' + T().lives + ')');

section('Breakout: losing all lives -> game over');
T().start();
T().launch();
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
T2().setBall(640, 120, 0, -15);
T2().step(30);
const sc2 = T2().score;
let g2guard = 0;
while (T2().state === 'playing' && g2guard++ < 500) {
  T2().setBall(640, 790, 0, 10);
  T2().step(10);
}
ok(T2().state === 'over', 'game over before checking best');
if (sc2 > 0) {
  const stored = pbScore(g2.store, 'Classic');
  ok(stored >= sc2, 'best score persisted to profile store (score=' + sc2 + ', stored=' + stored + ')');
} else {
  ok(true, 'best score persisted (score was 0, nothing to store)');
}

section('Breakout: multiball — losing one of two balls does not cost a life');
{
  const gm = runGame();
  const Tm = gm.T;
  Tm().start();
  Tm().launch();
  const lb = Tm().lives;
  Tm().setBall(640, 300, 0, -5);   // ball[0] safe, heading up
  Tm().addBall(640, 900, 0, 10);   // injected 2nd ball, already past the paddle
  ok(Tm().ballCount === 2, 'second ball injected (got ' + Tm().ballCount + ')');
  Tm().step(10);
  ok(Tm().ballCount === 1, 'fallen ball is removed from play (got ' + Tm().ballCount + ')');
  ok(Tm().lives === lb, 'no life lost while another ball is in play (' + lb + ' -> ' + Tm().lives + ')');
}

section('Breakout: multiball — only the LAST ball lost costs a life');
{
  const gm2 = runGame();
  const Tm2 = gm2.T;
  Tm2().start();
  Tm2().launch();
  const lb2 = Tm2().lives;
  Tm2().setBall(640, 900, 0, 10);  // the only ball, already below the paddle
  Tm2().step(5);
  ok(Tm2().lives === lb2 - 1, 'single ball fall costs exactly 1 life (' + lb2 + ' -> ' + Tm2().lives + ')');
  // and with two falling balls: exactly one life for the pair (the last one out)
  const lb3 = Tm2().lives;
  Tm2().setBall(640, 900, 0, 12);
  Tm2().addBall(640, 920, 0, 12);
  Tm2().step(10);
  ok(Tm2().lives === lb3 - 1, 'two balls falling together cost 1 life total (' + lb3 + ' -> ' + Tm2().lives + ')');
}

section('Breakout: min vertical speed after brick hit');
{
  const gv = runGame();
  const Tv = gv.T;
  Tv().start();
  Tv().launch();
  // near-horizontal ball into the brick zone: vy gets flipped + clamped to MIN_VY
  Tv().setBall(640, 100, 5, -0.1);
  Tv().step(40);
  ok(Tv().state === 'playing', 'game still running after near-horizontal ball enters bricks');
}

section('Breakout: restart resets all state');
{
  const gr = runGame();
  const Tr = gr.T;
  Tr().start();
  Tr().launch();
  Tr().setBall(640, 120, 0, -15);
  Tr().step(30);
  const scoreBeforeRestart = Tr().score;
  let rg = 0;
  while (Tr().state === 'playing' && rg++ < 300) { Tr().setBall(640, 790, 0, 10); Tr().step(10); }
  ok(Tr().state === 'over', 'reached game over before restart test');
  Tr().start();
  ok(Tr().score === 0, 'score reset to 0 on restart (was ' + scoreBeforeRestart + ')');
  ok(Tr().lives === 3, 'lives reset to 3 on restart');
  ok(Tr().level === 1, 'level reset to 1 on restart');
  ok(Tr().ballStuck === true, 'ball stuck on restart');
  ok(Tr().bricks === 180, 'all 180 bricks present on restart (got ' + Tr().bricks + ')');
}

section('Breakout: startMode — classic defaults');
{
  const gc = runGame();
  const Tc = gc.T;
  Tc().start();
  ok(Tc().mode === 'classic', 'start() defaults to classic mode');
  ok(Tc().bricks === 180, 'classic mode has 180 bricks (10×18)');
}

section('Breakout: startMode(\'endless\')');
{
  const ge = runGame();
  const Te = ge.T;
  Te().startMode('endless');
  ok(Te().state === 'playing', 'endless mode starts playing');
  ok(Te().mode === 'endless', 'mode getter returns endless');
  Te().launch();
  const bricksAtStart = Te().bricks;
  // keep the ball in the safe zone (below bricks, above paddle) while the row timer runs
  Te().setBall(640, 500, 3, 4);
  for (let i = 0; i < 430; i++) {
    if (i % 10 === 0) Te().setBall(640, 500, 3, -4);
    Te().step(1);
  }
  ok(Te().bricks > bricksAtStart, 'endless: new bricks added after ' + bricksAtStart + ' -> ' + Te().bricks);
}

section('Breakout: startMode(\'survival\') — wall descends');
{
  const gs = runGame();
  const Ts = gs.T;
  Ts().startMode('survival');
  ok(Ts().mode === 'survival', 'mode getter returns survival');
  Ts().launch();
  Ts().step(10);
  ok(Ts().survivalOffset > 0, 'survivalOffset increases while playing (got ' + Ts().survivalOffset + ')');
}

section('Breakout: survival — wall reaching paddle causes game over');
{
  const gs2 = runGame();
  const Ts2 = gs2.T;
  Ts2().startMode('survival');
  Ts2().launch();
  // keep the ball bouncing between bricks and paddle so no bricks die + no lives are lost
  const ly1 = Ts2().lowestBrickY;
  for (let i = 0; i < 100; i++) {
    if (i % 50 === 0) Ts2().setBall(640, 500, 3, -4);
    Ts2().step(1);
  }
  const ly2 = Ts2().lowestBrickY;
  ok(ly2 > ly1, 'survival: lowestBrickY increases over time (' + ly1 + ' -> ' + ly2 + ')');
  let survSteps = 0;
  while (Ts2().state === 'playing' && survSteps < 15000) {
    if (survSteps % 50 === 0) Ts2().setBall(640, 500, 3, -4);
    Ts2().step(1);
    survSteps++;
  }
  ok(Ts2().state === 'over', 'survival: game ends when wall reaches paddle (steps: ' + survSteps + ')');
}

section('Breakout: best score per mode persists in localStorage');
{
  const gb = runGame();
  const Tb = gb.T;
  Tb().startMode('classic');
  Tb().launch();
  Tb().setBall(640, 120, 0, -15);
  Tb().step(30);
  const classicScore = Tb().score;
  let gbg = 0;
  while (Tb().state === 'playing' && gbg++ < 500) { Tb().setBall(640, 790, 0, 10); Tb().step(10); }
  ok(Tb().state === 'over', 'classic game over for best-score test');
  if (classicScore > 0) {
    const stored = pbScore(gb.store, 'Classic');
    ok(stored >= classicScore, 'classic best persisted (score=' + classicScore + ', stored=' + stored + ')');
  } else {
    ok(true, 'classic best check skipped (score=0)');
  }

  const gb2 = runGame();
  const Tb2 = gb2.T;
  Tb2().startMode('endless');
  Tb2().launch();
  Tb2().setBall(640, 120, 0, -15);
  Tb2().step(30);
  const endlessScore = Tb2().score;
  let gb2g = 0;
  while (Tb2().state === 'playing' && gb2g++ < 500) { Tb2().setBall(640, 790, 0, 10); Tb2().step(10); }
  if (endlessScore > 0) {
    const stored2 = pbScore(gb2.store, 'Endless');
    ok(stored2 >= endlessScore, 'endless best persisted (score=' + endlessScore + ', stored=' + stored2 + ')');
  } else {
    ok(true, 'endless best check skipped (score=0)');
  }
}

section('Breakout: game over shows the kit end menu; Play Again restarts');
{
  const ge = runGame();
  const Te = ge.T;
  Te().start();
  Te().launch();
  Te().setBall(640, 120, 0, -15);
  Te().step(30);
  const sc = Te().score;
  let eg = 0;
  while (Te().state === 'playing' && eg++ < 500) { Te().setBall(640, 790, 0, 10); Te().step(10); }
  ok(Te().state === 'over', 'reached game over');
  ok(Te().menu() != null, 'kit end menu is shown on game over');
  ok(pbScore(ge.store, 'Classic') >= sc, 'best persisted >= final score (' + pbScore(ge.store, 'Classic') + ' >= ' + sc + ')');
  Te().menu().activate('again');
  ok(Te().state === 'playing', 'Play Again starts a new game');
  ok(Te().score === 0, 'Play Again resets score');
}

section('Breakout: 2× speed toggle defaults off, persists, applies');
{
  const gd = runGame();
  ok(gd.T().speedMult === 1, 'speedMult defaults to 1 (got ' + gd.T().speedMult + ')');
  gd.T().setSpeed(true); // mirrors the menu's 2× toggle
  ok(gd.T().speedMult === 2, 'enabling 2× speed sets speedMult to 2 (got ' + gd.T().speedMult + ')');
  ok(gd.store['breakout_speed2x'] === '1', 'speed pref persisted as "1" (got ' + gd.store['breakout_speed2x'] + ')');
  gd.T().setSpeed(false);
  ok(gd.T().speedMult === 1, 'disabling 2× speed resets speedMult to 1');
  ok(gd.store['breakout_speed2x'] === '0', 'speed pref persisted as "0"');
}

section('Breakout: 2× speed sub-steps collisions cleanly (no tunnelling)');
{
  const ga = runGame();
  const Ta = ga.T;
  Ta().setSpeed(true);
  ok(Ta().speedMult === 2, '2× enabled for sub-step test');
  Ta().start(); Ta().launch(); Ta().setPaddle(640);
  const before = Ta().bricks;
  Ta().setBall(640, 120, 0, -15);
  // emulate the loop's 2× sub-stepping: two update() calls per frame for 30 frames
  Ta().step(60);
  ok(Ta().bricks < before, '2× ball still destroys bricks (' + before + ' -> ' + Ta().bricks + ')');
  ok(Ta().state === 'playing', '2× run stays in a valid playing state');
}

section('Breakout: best(mode) reflects stored per-mode bests');
{
  const gm = runGame({ store: { gamekit_pb: JSON.stringify({ breakout: { 'Classic': { score: 250, plays: 1 }, 'Endless': { score: 99, plays: 1 }, 'Survival': { score: 7, plays: 1 } } }) } });
  ok(gm.T().best('classic') === 250, 'classic best 250 (got ' + gm.T().best('classic') + ')');
  ok(gm.T().best('endless') === 99, 'endless best 99 (got ' + gm.T().best('endless') + ')');
  ok(gm.T().best('survival') === 7, 'survival best 7 (got ' + gm.T().best('survival') + ')');
}

section('Breakout: 2× speed pref restored at boot from storage');
{
  const gp = runGame({ store: { breakout_speed2x: '1' } });
  ok(gp.T().speedMult === 2, 'speedMult restored to 2 from stored pref (got ' + gp.T().speedMult + ')');
}

// ---- Layout: everything on-screen + no overlap with the HUD, in portrait / landscape / desktop ----
section('Breakout: layout fits the screen (no off-screen / score-box overlap)');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().start(); return gl; },
  (gl, v, L0) => {
    gl.T().step(1); // one frame so the paddle re-centers/clamps to the new width (as it does live)
    const L = gl.T().layout;
    // bricks clear the top HUD pill (this is the "score box overlap" class of bug)
    ok(L.brickTop >= L.topMargin, v.name + ': top bricks clear the HUD (brickTop ' + L.brickTop + ' >= topMargin ' + L.topMargin + ')');
    ok(L.brickLeft >= 0 && L.brickRight <= L.W, v.name + ': bricks within width (' + Math.round(L.brickLeft) + '..' + Math.round(L.brickRight) + ' in 0..' + L.W + ')');
    ok(L.brickBottom < L.paddleY, v.name + ': bricks sit above the paddle (' + Math.round(L.brickBottom) + ' < ' + L.paddleY + ')');
    ok(L.paddleLeft >= 0 && L.paddleRight <= L.W, v.name + ': paddle within width (' + Math.round(L.paddleLeft) + '..' + Math.round(L.paddleRight) + ')');
    ok(L.paddleY > 0 && L.paddleY < L.H, v.name + ': paddle within height (paddleY ' + L.paddleY + ' in 0..' + L.H + ')');
  }
);

summary();
