# CLAUDE.md — Asteroids project

Guidance for working in this repo. Read before editing.

## What this is

A **self-contained** HTML5 Canvas game — **Classic Asteroids** (Classic + Classic-Enhanced) — as one
`index.html` with inline CSS/JS, running on the shared **game-kit** shell. No build step, no
dependencies, no external assets. Open `index.html` to play; run `node test.mjs` to test. (The
roguelite Asteroids is a *separate* catalogue game: `games/asteroids-plus/`.)

## Core conventions

- **Variants live behind a flag, not as separate files.** Classic and Classic-Enhanced are the *same*
  `index.html` gated by the `ENHANCED` flag (set from `?v=`); we fix/improve in place and let **git
  history be the record of iterations** — we don't keep old iterations as extra files.
- **Mode is chosen by query string.** `?v=classic` (Weapon I, original menu copy) · `?v=enh`
  (Classic-Enhanced: weapon tiers, Space-to-start). With **no `?v`**, an **in-page mode picker** is
  shown (no launcher, no iframe). `?speedrun=1` (appended by the picker) layers Speedrun on either.
- **Always run `node test.mjs` after changes and keep it green** — it's the safety net that lets us
  edit in place with confidence.
- **No external resources.** Everything inline and offline — no CDNs, fonts, or image assets; the
  retro look is all canvas vector drawing + CSS. (Plus the in-repo shared `game-kit.*` + `analytics.js`.)

## One engine file, knob-driven (no codegen)

This is **Classic only** (Classic + Classic-Enhanced). The roguelite progressions moved to their own
catalogue game — **`games/asteroids-plus/`** (its `index.html` is the roguelite engine with an in-page
mode picker). Keep the two in sync where the shared engine bits overlap (audio, touch, starfield).

`index.html` is the single engine. `?v=enh` turns on the Enhanced extras (weapon tiers, Space-to-start)
via the `ENHANCED` flag near the top; bare `?v=classic` stays Weapon I with the original Classic menu
copy. **No codegen, no `levels.js`, no separate level files.** Edit `index.html` directly — both
variants are the same code behind the flag. The test drives each variant by query, e.g.
`runGame('index.html?v=enh')`.

## Testing

- `node test.mjs` — headless harness (mocks DOM/canvas, steps the game loop, simulates
  input, asserts state transitions). It must stay green; add assertions for new behavior.
- The `window.__test` hook (harmless in normal play) lets the harness drive state. **Classic's hook:**
  `start`, `step`, `state`, `score`, `lives`, `shipAngle`, `layout`, `shareMsg`. Keep it in sync when
  adding mechanics. (asteroids-plus has its own richer hook — `gotoWave`, `giveUpgrade`, `clearEnemies`,
  `killBossNow`, … — they don't exist here.)
- There is no browser automation available here; the harness is the regression net.
  Always run it after changes, and syntax-check inline scripts if unsure.

## Conventions that matter

- The game loop reschedules `requestAnimationFrame` **first**, then runs update/render
  in a `try/catch` — a single bad frame must never permanently freeze the game.
- Speedrun is opt-in via `?speedrun=1` (appended by the in-page picker). The timer advances
  only while `state === 'playing'`. In Speedrun the shared result (share row + Discord) leads with the
  clear **time**, not score/level — see `shareMsg()`.
- The in-game **Quit to menu** button is wired through `gamekit.nav`'s `onMenu` → `quitToMenu()` →
  `location.href = location.pathname`, which drops `?v` so the in-page mode picker comes back. (No
  iframe / `postMessage` — that was the old launcher.)
- **Audio:** SFX route through the shared **`gamekit.sound`** engine; music is a local procedural
  engine whose master gain follows the kit's Music channel (`gamekit.music.subscribe`). Procedural Web
  Audio — no asset files — inert when `AudioContext` is absent (so the harness is unaffected). When you
  change it, keep `games/asteroids-plus/index.html` in sync.
- **WASD mirrors the arrow keys** for steering *and* menu navigation: keydown maps
  `w/a/s/d → Arrow Up/Left/Down/Right` and the picker/shop branches use the mapped key.
- **`localStorage` keys** (suffixed with `KEY` = `classic` or `classic-enhanced`):
  `asteroids_best_<KEY>` (speedrun best time), `asteroids_score_<KEY>` (normal-mode best score), plus
  the kit-owned `asteroids_sfx` / `asteroids_music` (on/off) and `asteroids_sfxvol` / `asteroids_musvol`
  (0–1). The kit sound-menu Reset clears all `asteroids_*` keys. (asteroids-plus owns the `roguelite-*`
  and `asteroids_wave_*` keys.)
- **Mobile/touch** controls are inlined, shown only on `pointer: coarse` devices, and never touch
  desktop. The move joystick is *aim-and-go*: it sets `ship.angle` to the stick direction every frame
  (instant aim) and only thrusts past a ~0.45 deflection. `resize()` scales the canvas up on small
  screens (min dim < 640) so the world zooms out instead of looking cramped.
- **PWA:** `manifest.json` + `sw.js` make it installable and offline-capable. `sw.js` is **stale-
  while-revalidate** via the shared **`../../sw-core.js`** (it just sets `SCOPE` / `VERSION` / `SHELL`;
  `VERSION` = `'dev'` locally, stamped with the commit SHA at deploy → a fresh cache + silent
  auto-update per build). If you add a file that must work offline, add it to **`SHELL`** in `sw.js`.
- `.nojekyll` (repo root) disables GitHub Pages' Jekyll build so files serve as-is.
- Match the existing terse, single-line code style in the game files. Comment sparingly.
