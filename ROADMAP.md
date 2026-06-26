# Arcade Roadmap

Working notes for what to build / improve next. Not a promise of order.

## Depth pass on the current games (from PC playtest, landscape)

These play but feel POC, not MVP — the base loop needs more juice + game modes.
Mobile not yet tested, so expect more issues there.

### Stack (`games/stacker/`)

- **Problem:** too slow, especially on wide/landscape screens; boring.
- Speed up the base loop; on landscape, narrow/center the play column so the
  block doesn't crawl across the full width (responsive field width).
- Modes: Classic (endless), Time Attack (most blocks in 60s), Zen (relaxed,
  forgiving tolerance).

### Brick Breaker (`games/breakout/`)

- **Problem:** only fun once you have several balls.
- Smaller / denser bricks, livelier base ball, earlier/more frequent power-ups.
- Modes: Classic, **Endless** (rows keep descending), **Survival / Wall Drop**
  (wall slowly descends toward the paddle — lose if it reaches you).

### Meadow Flyer (`games/flappy/`)

- **Problem:** too hard (flappy-hard); we want simpler, more fun.
- Easier defaults: bigger gaps, slower scroll, gentler gravity, forgiving hitbox.
- Modes: Day / Night (visual + optional difficulty tweak).

### Range (`games/aim-trainer/`)

- **Problem:** no obvious time limit / structure.
- Explicit timed modes: 10s / 20s / 30s / 60s (clicks/score in the window).
- Sprint mode: time to reach 100 points.
- Clear visible countdown + end summary per mode.

### Neon Snake (`games/snake/`)

- Roughly fine. Add modes: wall-wrap toggle, speed-up mode, board size S/M/L.

### Keep Defender (`games/tower-defense/`)

- **Problem:** features were added but not *improved* — still looks raw and is
  too easy (spam a few random towers and everything dies).
- Balance: tougher/scaling enemies, armor/resistances so tower choice matters,
  tighter economy, harsher leak penalty — placement should matter.
- **Several maps to choose from** (different paths/layouts).
- Visual polish: nicer terrain/road/towers/enemies (still shapes), range rings,
  enemy health bars, clearer feedback.

## Local multiplayer (single-screen) — pick later

Same constraint: one self-contained file, shared input on one device.
Desktop = split keyboard (WASD vs arrows); mobile/tablet = each player owns a
screen half. 2P works everywhere; 3–4P is a desktop-keyboard thing.

**User favorites: Tron / Light Cycles, Air Hockey, Slime Volleyball.**

| Idea | Players | Effort | Notes |
| --- | --- | --- | --- |
| **Light Cycles / Tron** ★ | 2 (party variant 2–6) | low | reuses Snake trail tech; neon; party = Achtung-style curving trails + pickups |
| **Air Hockey / Pong** ★ | 2 | low | best two-thumb mobile game; W/S vs ↑/↓ on desktop |
| **Slime Volleyball** ★ | 2 | med | two blobs + ball + net; huge fun-per-byte |
| Sumo Arena | 2 | med | bump opponent out of a ring; momentum physics |
| Spacewar Duel | 2 | med | reuses Asteroids movement; central gravity well |
| Joust-lite | 2 | med | reuses Meadow Flyer flap; be above opponent on contact |
| Snake Battle | 2 | low | extends Neon Snake; shared board, last alive wins |
| Button-Mash Race | 2–4 | trivial | everyone grabs a key; fill the bar |

Catalogue idea: add a small **players badge** (`2P`, `1–4P`) on tiles + maybe a
filter so local-multiplayer games are obvious.

## Single-player still queued (coming-soon tiles)

Effort tiers match the multiplayer table (trivial / low / med / high) — a "decent
MVP + 2–3 polish passes," self-contained single file with a `__test` hook.

| Idea | Effort | Workload notes |
| --- | --- | --- |
| **Sudoku** | **med** | Grid render + cell select + number pad + keyboard + pencil notes + conflict highlight + hint/undo + timer & best-time per difficulty are all **low**. The real work is the **generator**: a backtracking **solver** to build a full board, then dig out cells while verifying the puzzle keeps a **unique solution**. MVP difficulty = givens count (easy/med/hard); proper technique-based grading would push it to **high** (skip for v1). Suggested tile: 🔢 · tag `LOGIC` · accent `#7aa2ff`. |
| Invaders | med | formation movement, descending rows, shields, escalating waves |
| Road Hop (crossy) | med | lane spawns, log-riding, endless scroll |
| Trap the Cat | med | hex grid + cat BFS pathfinding to the nearest edge |
| Arcane (spellcaster) | med–high | scope-dependent: spell variety + wave AI |
| Icy Tower | high | momentum + variable jump + wall-bounce + combos + rising floor (lots of feel-tuning) |
| Pulse Dash (rhythm) | high | obstacles authored to a beat + generate/sync a track (priciest) |

See `games.js` for tags/accents.

## Parked ideas (someday)

- **Sort tiles by popularity (most-played first), driven by GA4.** No new database —
  reuse GA4: a scheduled GitHub Action reads the GA4 Data API (service-account key in
  a repo secret), writes a static `stats.json` (`{slug: plays}`), and `render()` sorts
  playable tiles by it (favorites still pinned on top; missing/zero → current order).
  Caveats: refresh is daily, not live; GA4 is **consent-sampled** (only counts visitors
  who accepted the banner), so sort by it but don't show raw counts. A live counter was
  rejected — it needs a datastore (DB / serverless KV / flaky free hit-API), so it isn't
  actually "lightweight"; reusing GA4 adds zero new infra.
