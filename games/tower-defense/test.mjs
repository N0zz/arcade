// Headless tests for Keep Defender (games/tower-defense).
// Mocks DOM/canvas, runs the inline script in a vm sandbox, drives via window.__test.
// Focus: the 3-screen flow, the END-screen share row, and the resize/orientation
// reflow fix (towers + enemies must track the grid when the canvas is re-sized).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const KIT = fs.readFileSync(path.join(DIR, '../../game-kit.js'), 'utf8'); // shared kit, loaded before the game
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); console.log('  ✗ ' + m); } };
const section = t => console.log('\n=== ' + t + ' ===');

function ctx2d() { return new Proxy({}, { get: (_, p) => (p === 'canvas' ? { width: 1280, height: 800 } : () => {}), set: () => true }); }
function makeEl() {
  const cl = new Set(); const el = {
    textContent: '', value: '', dataset: {}, children: [],
    style: new Proxy({}, { get: (t, p) => p === 'setProperty' ? ((k, v) => { t[k] = v; }) : (t[p] ?? ''), set: (t, p, v) => (t[p] = v, true) }),
    classList: { add:(...c)=>c.forEach(x=>cl.add(x)), remove:(...c)=>c.forEach(x=>cl.delete(x)), toggle:(c,f)=>{const w=f===undefined?!cl.has(c):!!f; w?cl.add(c):cl.delete(c); return w;}, contains:c=>cl.has(c) },
    _l: {}, addEventListener:(t,fn)=>{(el._l[t]||=[]).push(fn);}, removeEventListener(){}, fire:(t,e={})=>(el._l[t]||[]).forEach(fn=>fn({preventDefault(){},stopPropagation(){},...e})),
    appendChild:c=>{el.children.push(c); return c;}, querySelectorAll:()=>[], querySelector:()=>null, getContext:()=>ctx2d(), focus(){}, setAttribute(){}, getAttribute(){return null;}, getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800}),
  };
  let h=''; Object.defineProperty(el,'innerHTML',{get:()=>h,set:v=>{h=String(v??''); if(!v) el.children=[];}});
  return el;
}

function runInline(file) {
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
  const m = html.match(/[\s\S]*<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('no inline script in ' + file);
  const cache = {}; const getEl = id => (cache[id] ||= makeEl());
  const handlers = {}; const store = {};
  const win = { innerWidth: 1280, innerHeight: 800, addEventListener:(t,fn)=>{(handlers[t]||=[]).push(fn);}, removeEventListener(){}, matchMedia:()=>({matches:false}) };
  const doc = { getElementById:getEl, createElement:()=>makeEl(), addEventListener(){}, querySelectorAll:()=>[], body:makeEl() };
  const sandbox = {
    window: win, document: doc, location: { search: '' }, navigator: {},
    localStorage: { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, matchMedia: () => ({ matches: false }), URLSearchParams, Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN, Date, console,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  let bootErr = null;
  try { vm.runInContext(KIT, ctx, { filename: 'game-kit.js' }); vm.runInContext(m[1], ctx, { filename: file }); } catch (e) { bootErr = e.stack; }
  return { getEl, win, store, bootErr, test: () => win.__test };
}

function freeCell(T) {
  for (let c = 0; c < T.cols; c++) for (let r = 0; r < T.rows; r++) if (!T.roadAt(c, r)) return { c, r };
  return null;
}

function run() {
  section('boot + 3-screen flow');
  const g = runInline('index.html');
  ok(g.bootErr === null, 'boots headless: ' + g.bootErr);
  const T = () => g.test();
  ok(T() != null, 'exposes __test');
  ok(T().state === 'menu', 'starts on the MENU screen (got ' + T().state + ')');

  // map selection on the menu
  T().selectMap(2);
  ok(T().mapIdx === 2, 'menu map selection sticks (got ' + T().mapIdx + ')');
  T().selectMap(0);

  T().start();
  ok(T().state === 'build' && T().gold === 80 && T().hp === 30, 'start → GAME (build, 80g medium default, 30hp)');

  section('resize / orientation reflow (the bug)');
  const cell = freeCell(T());
  T().place('archer', cell.c, cell.r);
  ok(T().towers === 1, 'placed a tower');

  // tower pixel position must match its grid cell under the current geometry
  let tp = T().towerPx(0), cp = T().cellPx(cell.c, cell.r);
  ok(Math.abs(tp.x - cp.x) < 0.5 && Math.abs(tp.y - cp.y) < 0.5, 'tower aligned to grid before resize');

  // spawn enemies, advance, capture an enemy + the geometry
  T().startWave();
  T().step(60);
  ok(T().enemies > 0, 'enemies spawned (got ' + T().enemies + ')');
  const e0 = T().enemyPx(0);
  const geomBefore = T().geom;

  // rotate to portrait — canvas resizes, geometry changes
  T().resizeTo(420, 900);
  const geomAfter = T().geom;
  ok(geomAfter.W === 420 && geomAfter.H === 900, 'canvas resized to portrait');
  ok(geomAfter.ts !== geomBefore.ts || geomAfter.ox !== geomBefore.ox || geomAfter.oy !== geomBefore.oy, 'grid geometry recomputed on resize');

  // tower must STILL sit on its grid cell after the resize (this was the bug)
  tp = T().towerPx(0); cp = T().cellPx(cell.c, cell.r);
  ok(Math.abs(tp.x - cp.x) < 0.5 && Math.abs(tp.y - cp.y) < 0.5, 'tower tracks the grid after resize');

  // enemy must have moved to NEW pixel coords matching the new geometry (not stuck on old px)
  const e1 = T().enemyPx(0);
  ok(e1 && (e1.x !== e0.x || e1.y !== e0.y), 'enemy repositioned to new geometry after resize');
  // and it must be inside the new playfield bounds
  const inX = e1.x >= geomAfter.ox - geomAfter.ts && e1.x <= geomAfter.ox + T().cols * geomAfter.ts + geomAfter.ts;
  ok(inX, 'enemy stays within the resized board');

  // rotate back to landscape — towers realign again
  T().resizeTo(1280, 800);
  tp = T().towerPx(0); cp = T().cellPx(cell.c, cell.r);
  ok(Math.abs(tp.x - cp.x) < 0.5 && Math.abs(tp.y - cp.y) < 0.5, 'tower realigns after rotating back');

  section('upgrade button greys out when unaffordable');
  T().addGold(-T().gold);              // drain to 0
  T().selectTowerAt(cell.c, cell.r);
  ok(T().upBtnDisabled() === true, "upgrade button disabled when you can't afford it");
  T().addGold(1000);                   // refund → refreshToolbar re-enables it live
  ok(T().upBtnDisabled() === false, 'upgrade button pops in once affordable');

  section('END (kit menu) + share');
  const g2 = runInline('index.html'); const U = () => g2.test();
  U().start();
  let guard = 0; while (U().hp > 0 && guard++ < 60000) { if (U().state === 'build') U().startWave(); U().step(1); }
  ok(U().hp <= 0 && U().state === 'over', 'undefended waves end the run');
  ok(U().menu() != null, 'kit end menu is shown on game over');
  U().menu().activate('again');
  ok(U().state === 'build', 'Play again starts a fresh run (state=' + U().state + ')');
  const su = g2.win.gamekit.shareUrls('https://komyo.online/games/tower-defense/', 'I survived 3 waves in Keep Defender 🏰');
  ok(/komyo\.online(%2F|\/)games(%2F|\/)tower-defense/.test(su.x) && /tower-defense/.test(su.copy), 'share links point at the game URL');

  section('maps (≥5 distinct layouts)');
  const g3 = runInline('index.html'); const M = () => g3.test();
  // every map index 0..4 must select and produce a working road grid
  const layouts = [];
  for (let i = 0; i < 5; i++) {
    M().selectMap(i);
    ok(M().mapIdx === i, 'selectMap(' + i + ') sticks');
    let roadCells = 0, sig = '';
    for (let c = 0; c < M().cols; c++) for (let r = 0; r < M().rows; r++) if (M().roadAt(c, r)) { roadCells++; sig += c + ',' + r + ';'; }
    ok(roadCells > 0, 'map ' + i + ' has a road');
    layouts.push(sig);
  }
  ok(new Set(layouts).size === 5, 'all 5 map layouts are distinct (got ' + new Set(layouts).size + ')');
  M().selectMap(0);

  section('buff tower (Bard aura)');
  const g4 = runInline('index.html'); const B = () => g4.test();
  B().selectMap(0); B().start(); B().addGold(500);
  // find two adjacent free cells
  function twoFree(T) {
    for (let c = 0; c < T.cols - 1; c++) for (let r = 0; r < T.rows; r++)
      if (!T.roadAt(c, r) && !T.roadAt(c + 1, r)) return [{ c, r }, { c: c + 1, r }];
    return null;
  }
  const [a, b] = twoFree(B());
  ok(B().place('archer', a.c, a.r), 'placed archer');
  const dmgBefore = B().towerDmg(0);
  ok(B().place('bard', b.c, b.r), 'placed bard next to it');
  const dmgAfter = B().towerDmg(0);
  ok(dmgAfter > dmgBefore, 'bard aura boosts neighbour damage (' + dmgBefore + ' -> ' + dmgAfter + ')');
  ok(B().towers === 2, 'both towers stand');

  section('map drops (clickable bonus)');
  const g5 = runInline('index.html'); const D = () => g5.test();
  D().start();
  const gd = D().spawnDrop('gold');
  ok(D().drops === 1, 'gold drop spawned');
  const goldBefore = D().gold;
  ok(D().collectDrop(0) === true, 'collectDrop succeeds');
  ok(D().gold > goldBefore, 'gold drop awards gold (' + goldBefore + ' -> ' + D().gold + ')');
  ok(D().drops === 0, 'drop removed after collect');
  D().spawnDrop('haste');
  D().collectDrop(0);
  ok(D().haste > 0, 'haste drop grants a temporary buff');

  section('per-map × per-difficulty best persists');
  // game-over on map 1 writes a record keyed by map AND difficulty; the menu should read it back
  const g6 = runInline('index.html'); const P = () => g6.test();
  P().selectMap(1); P().start();
  let guard6 = 0; while (P().hp > 0 && guard6++ < 60000) { if (P().state === 'build') P().startWave(); P().step(1); }
  ok(P().state === 'over', 'ran a map-1 game to game over');
  const tdPb = () => { try { return JSON.parse(g6.store['gamekit_pb'] || '{}')['tower-defense'] || {}; } catch (e) { return {}; } };
  ok(Object.keys(tdPb()).some(k => k.startsWith('Ice · ')), 'per-map/difficulty best written for map 1 (Ice) (got ' + Object.keys(tdPb()).join(',') + ')');

  section('tower icons + tooltips (TASK 1/2)');
  const g7 = runInline('index.html'); const I = () => g7.test();
  // build toolbar buttons carry an icon glyph + name (checked against raw html)
  const rawHtml = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  ok(/data-t="archer"[\s\S]*?🏹/.test(rawHtml), 'archer build button shows its icon');
  ok(/data-t="cannon"[\s\S]*?💣/.test(rawHtml), 'cannon build button shows its icon');
  ok(/data-t="frost"[\s\S]*?❄️/.test(rawHtml), 'frost build button shows its icon');
  // tooltip html for a build button reports stats + special
  I().start();
  const tip = I().tipHtml('cannon');
  ok(/Cannon/.test(tip) && /Damage/.test(tip) && /Rate/.test(tip) && /Range/.test(tip) && /Cost/.test(tip), 'build tooltip lists damage/rate/range/cost');
  ok(/[Ss]plash/.test(tip) && /armor/i.test(tip), 'cannon tooltip notes its special (splash / armor-pierce)');
  // placed tower info (mobile select panel) reports live stats
  function freeCell2(T) { for (let c=0;c<T.cols;c++) for (let r=0;r<T.rows;r++) if(!T.roadAt(c,r)) return {c,r}; }
  const fc = freeCell2(I()); I().place('archer', fc.c, fc.r);
  const info = I().towerInfo(0);
  ok(/Dmg/.test(info) && /Range/.test(info), 'placed-tower info reports dmg + range');

  section('effective range == drawn ring (TASK 3)');
  const g8 = runInline('index.html'); const R = () => g8.test();
  R().selectMap(0); R().start(); R().addGold(500);
  function twoAdj(T){ for(let c=0;c<T.cols-1;c++) for(let r=0;r<T.rows;r++) if(!T.roadAt(c,r)&&!T.roadAt(c+1,r)) return [{c,r},{c:c+1,r}]; }
  const [pa, pb] = twoAdj(R());
  R().place('archer', pa.c, pa.r);
  const baseRange = R().towerRange(0);
  R().place('bard', pb.c, pb.r);
  const buffedRange = R().towerRange(0);
  ok(buffedRange > baseRange, 'bard buff raises the EFFECTIVE range the ring draws (' + baseRange.toFixed(2) + ' -> ' + buffedRange.toFixed(2) + ')');

  section('map mechanics (TASK 5)');
  const g9 = runInline('index.html'); const Mp = () => g9.test();
  Mp().selectMap(1); // Ice
  ok(Mp().surface > 1, 'Ice surface speeds enemies up (' + Mp().surface + ')');
  ok(Mp().towerMapMod('frost') > 1, 'Frost is stronger on Ice');
  ok(Mp().mapEvent === 'freeze', 'Ice signature event is freeze');
  Mp().selectMap(5); // Marsh
  ok(Mp().surface < 1, 'Marsh mud slows enemies (' + Mp().surface + ')');
  ok(Mp().towerMapMod('cannon') !== undefined, 'towerMapMod returns a value');
  Mp().selectMap(2); // Lava
  ok(Mp().towerMapMod('frost') < 1 && Mp().towerMapMod('cannon') > 1, 'Lava weakens Frost, boosts Cannon');
  // map event drop spawns and is collectible
  Mp().selectMap(2); Mp().start();
  Mp().spawnMapEvent();
  ok(Mp().drops === 1, 'map event drop spawned');
  const goldB = Mp().gold;
  ok(Mp().collectDrop(0) === true, 'map event collected');
  ok(Mp().gold > goldB, 'meteor event awards gold (' + goldB + ' -> ' + Mp().gold + ')');
  // TASK 3: the meteor is a devastating, map-spanning, KILLING blast.
  const g9c = runInline('index.html'); const Mt = () => g9c.test();
  Mt().selectMap(2); Mt().start(); Mt().startWave(); Mt().step(120);
  ok(Mt().enemies > 0, 'lava wave has live enemies to nuke (' + Mt().enemies + ')');
  // spawn the meteor; its blast covers ≥2/3 of the board, so it reaches enemies anywhere
  Mt().spawnMapEvent();
  const drops = Mt().drops;
  // find the meteor drop index (it was just spawned) and collect it
  ok(drops >= 1, 'meteor drop present');
  Mt().collectDrop(drops - 1);
  ok(Mt().enemies === 0, 'meteor blast KILLS every enemy on the board (left ' + Mt().enemies + ')');
  // Marsh bog event rouses an extra enemy
  const g9b = runInline('index.html'); const Mq = () => g9b.test();
  Mq().selectMap(5); Mq().start();
  Mq().spawnMapEvent();
  const enemB = Mq().enemies;
  Mq().collectDrop(0);
  ok(Mq().enemies > enemB, 'Marsh bog event spawns a mud-beast (' + enemB + ' -> ' + Mq().enemies + ')');

  section('threat rubber-band — between rounds, can go DOWN (TASK 4)');
  const g10 = runInline('index.html'); const Df = () => g10.test();
  Df().selectMap(0); Df().start();
  ok(Df().difficulty === 1, 'difficulty starts at 1');
  ok(Df().checkpoints.length >= 3, 'path checkpoints exposed (' + Df().checkpoints.length + ')');
  // threat is adjusted ONCE per wave, at WAVE END — NOT continuously mid-wave.
  // Dominated wave: blanket the board, run a full wave; enemies die early → threat rises.
  Df().addGold(100000);
  for (let c=0;c<Df().cols;c++) for (let r=0;r<Df().rows;r++) if(!Df().roadAt(c,r)) Df().place('mage', c, r);
  Df().startWave();
  const midWave = Df().difficulty;
  for (let i=0;i<60;i++) Df().step(1);
  ok(Df().difficulty === midWave, 'threat does NOT change mid-wave (still ' + Df().difficulty.toFixed(2) + ')');
  let gw = 0; while (Df().state === 'wave' && gw++ < 60000) Df().step(1);
  ok(Df().state === 'build', 'dominated wave completed');
  ok(Df().difficulty > 1, 'threat rose at wave end after dominating (' + Df().difficulty.toFixed(2) + ')');
  const afterDominate = Df().difficulty;

  // Now a STRUGGLE: sell nothing but simulate a leak by running an undefended-ish wave.
  // Easiest deterministic path: drive a leaked wave on a fresh game and confirm threat drops.
  const g10b = runInline('index.html'); const Dl = () => g10b.test();
  Dl().selectMap(0); Dl().start();
  Dl().setDifficulty(2.0); // start elevated so we can watch it come DOWN
  Dl().startWave();
  // no towers → enemies leak; run the wave to completion (or keep falls)
  let gl = 0; while (Dl().state === 'wave' && Dl().hp > 0 && gl++ < 60000) Dl().step(1);
  ok(Dl().waveLeaked === true || Dl().state === 'over', 'undefended wave registered a leak');
  if (Dl().state === 'build') ok(Dl().difficulty < 2.0, 'threat fell after a leaked wave (' + Dl().difficulty.toFixed(2) + ')');
  else ok(true, 'keep fell during the leaked wave (still losable)');

  // Direct unit check of the rubber-band via the adjustThreat hook:
  const g10c = runInline('index.html'); const Da = () => g10c.test();
  Da().selectMap(0); Da().start();
  Da().setDifficulty(2.0);
  // simulate a clean dominated wave end (no leak, nothing reached the early checkpoint)
  Da().startWave(); for (let i=0;i<3;i++) Da().step(1); // a couple enemies near the start
  // force the signals via fresh wave state then call adjustThreat with a dominated profile
  const g10d = runInline('index.html'); const Dd = () => g10d.test();
  Dd().selectMap(0); Dd().start(); Dd().setDifficulty(1.5);
  Dd().startWave(); // waveLeaked=false, waveMaxFrac starts 0
  const beforeUp = Dd().difficulty;
  Dd().adjustThreat();
  ok(Dd().difficulty > beforeUp, 'adjustThreat() raises threat on a dominated profile (' + beforeUp + ' -> ' + Dd().difficulty.toFixed(2) + ')');

  // clamp: threat never exceeds 5.0 nor drops below 1.0
  const g10e = runInline('index.html'); const Dc = () => g10e.test();
  Dc().selectMap(0); Dc().start();
  Dc().setDifficulty(4.95); Dc().startWave(); Dc().adjustThreat();
  ok(Dc().difficulty <= 5.0 + 1e-9, 'threat clamps at 5.0 (' + Dc().difficulty.toFixed(2) + ')');

  // undefended still ends the run; threat is forgiving (drops), never pinned high
  const g11 = runInline('index.html'); const Un = () => g11.test();
  Un().selectMap(0); Un().start();
  let gu = 0; while (Un().hp > 0 && gu++ < 60000) { if (Un().state === 'build') Un().startWave(); Un().step(1); }
  ok(Un().state === 'over', 'undefended run still ends (keep falls)');
  ok(Un().difficulty <= 1.0 + 1e-9, 'threat never rose during a losing run (' + Un().difficulty.toFixed(2) + ')');

  section('difficulty levels (start gold + HP scaling)');
  const gD = runInline('index.html'); const Dm = () => gD.test();
  Dm().selectMap(0);
  Dm().setDifficultyLevel('easy'); Dm().start();
  ok(Dm().diffLevel === 'easy', 'difficulty level set to easy');
  const easyGold = Dm().gold;
  ok(easyGold === 90, 'easy starts with 90 gold (got ' + easyGold + ')');
  Dm().setDifficultyLevel('hard'); Dm().start();
  const hardGold = Dm().gold;
  ok(hardGold === 70, 'hard starts with 70 gold (got ' + hardGold + ')');
  ok(easyGold > hardGold, 'switching difficulty changes start gold (easy ' + easyGold + ' > hard ' + hardGold + ')');
  Dm().setDifficultyLevel('medium'); Dm().start();
  ok(Dm().gold === 80, 'medium starts with 80 gold (got ' + Dm().gold + ')');
  // geometric HP scaling: harder hpBase/hpGrow → tankier foes at the same wave
  const gDh = runInline('index.html'); const Dh = () => gDh.test();
  Dh().selectMap(0); Dh().setDifficultyLevel('easy'); Dh().start(); Dh().startWave(); Dh().step(30);
  const easyMaxHp = Dh().diffConfig.hpBase; // base factor (wave 1 → hpBase only)
  const gDh2 = runInline('index.html'); const Dh2 = () => gDh2.test();
  Dh2().selectMap(0); Dh2().setDifficultyLevel('hard'); Dh2().start(); Dh2().startWave(); Dh2().step(30);
  ok(Dh2().diffConfig.hpBase > easyMaxHp, 'hard hpBase exceeds easy hpBase (' + Dh2().diffConfig.hpBase + ' > ' + easyMaxHp + ')');
  ok(Math.abs(Dh().waveHpK() - Dh().diffConfig.hpBase) < 1e-9, 'waveHpK at wave 1 equals hpBase (geometric, ' + Dh().waveHpK().toFixed(3) + ')');

  section('score rewards difficulty (scoreMul, decoupled from gold)');
  const gS = runInline('index.html'); const Sc = () => gS.test();
  Sc().selectMap(0); Sc().setDifficultyLevel('hard'); Sc().start(); Sc().startWave(); Sc().step(120);
  ok(Sc().enemies > 0, 'wave 1 spawned enemies for the score test');
  let rewH = 0; for (let i = 0; i < Sc().enemies; i++) rewH += Sc().enemyInfo(i).reward;
  const sH0 = Sc().score, gH0 = Sc().gold;
  Sc().killAll();
  ok(Sc().score - sH0 === rewH * 2, 'hard kills score 2× their gold reward (' + (Sc().score - sH0) + ' = 2×' + rewH + ')');
  ok(Sc().gold - gH0 === rewH, 'gold economy is untouched by scoreMul (+' + (Sc().gold - gH0) + 'g)');
  const gSe = runInline('index.html'); const Se = () => gSe.test();
  Se().selectMap(0); Se().setDifficultyLevel('easy'); Se().start(); Se().startWave(); Se().step(120);
  let rewE = 0; for (let i = 0; i < Se().enemies; i++) rewE += Se().enemyInfo(i).reward;
  const sE0 = Se().score;
  Se().killAll();
  ok(Se().score - sE0 === rewE, 'easy kills score 1× (scoreMul 1.0, got +' + (Se().score - sE0) + ')');

  section('boss rebalance (half HP base, slower, no threat speed nudge)');
  const gB = runInline('index.html'); const Bs = () => gB.test();
  Bs().selectMap(0); Bs().setDifficultyLevel('hard'); Bs().start();
  for (let w = 1; w <= 4; w++) { Bs().startWave(); let gd = 0; while (Bs().state === 'wave' && gd++ < 3000) { Bs().step(10); Bs().killAll(); } }
  ok(Bs().state === 'build' && Bs().wave === 4, 'cleared waves 1–4 (state ' + Bs().state + ', wave ' + Bs().wave + ')');
  Bs().setDifficulty(3.0); // pin the adaptive threat high so the boss speed exemption is observable
  Bs().startWave();
  let boss = null, bGuard = 0;
  while (!boss && bGuard++ < 2000) {
    Bs().step(5);
    for (let i = 0; i < Bs().enemies; i++) { const e = Bs().enemyInfo(i); if (e && e.type === 'boss') { boss = e; break; } }
  }
  ok(!!boss, 'wave 5 spawns a boss');
  if (boss) {
    const expHp = Math.round(200 * Bs().waveHpK() * 3.0); // map 0 diff = 1.0
    ok(boss.maxHp === expHp, 'boss HP uses the halved 200 base (got ' + boss.maxHp + ', expected ' + expHp + ')');
    ok(Math.abs(boss.speed - 0.4) < 1e-9, 'boss walks at 0.4 and ignores the threat speed nudge (got ' + boss.speed + ')');
    let other = null;
    for (let i = 0; i < Bs().enemies; i++) { const e = Bs().enemyInfo(i); if (e && e.type !== 'boss') { other = e; break; } }
    if (other) ok(other.speed > boss.speed, 'non-boss enemies in the same wave keep the threat speed nudge (' + other.speed.toFixed(2) + ' > 0.4)');
  }

  section('targeting priority (per-tower mode)');
  const gT = runInline('index.html'); const Tg = () => gT.test();
  Tg().selectMap(0); Tg().start(); Tg().addGold(500);
  const tcell = freeCell(Tg());
  Tg().place('archer', tcell.c, tcell.r);
  ok(Tg().targetMode(0) === 'first', 'tower defaults to "first" targeting');
  const cycled = Tg().cycleTargetAt(tcell.c, tcell.r);
  ok(cycled === 'last', 'cycling target advances first → last (got ' + cycled + ')');
  ok(Tg().setTargetMode(0, 'strongest') === true, 'setTargetMode accepts a valid mode');
  ok(Tg().targetMode(0) === 'strongest', 'target mode is now strongest');
  ok(Tg().setTargetMode(0, 'bogus') === false, 'setTargetMode rejects an unknown mode');
  // the button label/control wiring exists in the panel
  const tdRaw = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  ok(/id="targetBtn"/.test(tdRaw) && /Target: First/.test(tdRaw), 'panel has a Target cycle button labelled "Target: First ▸"');

  section('Keep Defender: layout fits the screen (portrait / landscape / desktop)');
  const VIEWPORTS = [
    { name: 'portrait phone',  w: 390, h: 780 },
    { name: 'landscape phone', w: 780, h: 390 },
    { name: 'desktop',         w: 1280, h: 800 },
  ];
  for (const v of VIEWPORTS) {
    const gv = runInline('index.html'); const V = () => gv.test();
    V().selectMap(0); V().start();
    V().resizeTo(v.w, v.h);
    V().step(1);
    const L = V().layout;
    const tag = '[' + v.name + '] ';
    // canvas exactly tracks the viewport
    ok(L.W === v.w && L.H === v.h, tag + 'canvas == viewport (' + L.W + 'x' + L.H + ')');
    // path bounding box stays fully on-screen
    ok(L.path.left >= 0 && L.path.right <= L.W, tag + 'path within 0..W (' + L.path.left.toFixed(1) + '..' + L.path.right.toFixed(1) + ' / W=' + L.W + ')');
    ok(L.path.top >= 0 && L.path.bottom <= L.H, tag + 'path within 0..H (' + L.path.top.toFixed(1) + '..' + L.path.bottom.toFixed(1) + ' / H=' + L.H + ')');
    // keep sprite (incl. flag spire) stays fully on-screen
    ok(L.keep.left >= 0 && L.keep.right <= L.W, tag + 'keep within 0..W (' + L.keep.left.toFixed(1) + '..' + L.keep.right.toFixed(1) + ' / W=' + L.W + ')');
    ok(L.keep.top >= 0 && L.keep.bottom <= L.H, tag + 'keep within 0..H (' + L.keep.top.toFixed(1) + '..' + L.keep.bottom.toFixed(1) + ' / H=' + L.H + ')');
    // playable grid stays on-screen
    ok(L.grid.left >= 0 && L.grid.right <= L.W && L.grid.top >= 0 && L.grid.bottom <= L.H, tag + 'grid within the canvas');
    // topmost board content clears the score HUD (no overlap with the center-top pill)
    const topMost = Math.min(L.path.top, L.keep.top, L.grid.top);
    ok(topMost >= L.topReserve, tag + 'board content clears the top HUD (top=' + topMost.toFixed(1) + ' >= reserve=' + L.topReserve + ')');
  }

  console.log('\n----------------------------------------');
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  else console.log('All tests passed ✓');
}

run();
