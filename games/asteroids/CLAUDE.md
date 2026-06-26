# CLAUDE.md — Asteroids project

Guidance for working in this repo. Read before editing.

## What this is

A set of **self-contained** HTML5 Canvas games + a launcher. No build step, no
dependencies, no external assets — every game is one `.html` file with inline CSS/JS.
Open `index.html` to play; run `node test.mjs` to test.

## Core conventions

- **Versions are living, not frozen.** We fix and improve existing version files in
  place — there's no freeze. **Git history is the record of iterations**, so we do
  *not* keep every past iteration as a separate file in the menu. The menu lists the
  current set of *distinct* versions/modes, each kept in good shape.
- **Add a new file only for a genuinely distinct version/mode** (a new concept worth
  its own menu entry) — not for an iteration of an existing one. To trace how a
  version evolved, read the commit history, not extra files.
- **`levels.js` is the single source of truth** for the launcher menu. Add a version
  by adding a file and one `{ file, title, desc, tag, goal }` entry. `tag` is
  `CLASSIC` or `ROGUELITE` and decides which menu row it appears in.
- **Always run `node test.mjs` after changes and keep it green** — it's the safety net
  that lets us edit versions in place with confidence.
- **No external resources.** Keep everything inline and offline. No CDNs, fonts, or
  image assets — the retro look is all canvas vector drawing + CSS.

## The roguelite trio is generated — edit the base, then regenerate

All playable builds live in **`levels/`** (root keeps `index.html`, `levels.js`,
`favicon.svg`, `test.mjs`, and the docs).

`levels/roguelite-milestones.html` and `levels/roguelite-shop.html` are **generated
copies** of `levels/roguelite-levelup.html`. They differ only by the `PROGRESSION`
constant near the top of the script (`'levelup' | 'milestones' | 'shop'`) and the `<title>`.

**Always edit `levels/roguelite-levelup.html`, then regenerate the other two (run from `levels/`):**

```bash
cd levels
sed -e "s/const PROGRESSION = 'levelup';/const PROGRESSION = 'milestones';/" \
    -e "s|<title>Roguelite: Auto Level-Up</title>|<title>Roguelite: Score Milestones</title>|" \
    roguelite-levelup.html > roguelite-milestones.html
sed -e "s/const PROGRESSION = 'levelup';/const PROGRESSION = 'shop';/" \
    -e "s|<title>Roguelite: Auto Level-Up</title>|<title>Roguelite: Wave Shop</title>|" \
    roguelite-levelup.html > roguelite-shop.html
```

Never hand-edit the two generated files — changes will be overwritten.

## Testing

- `node test.mjs` — headless harness (mocks DOM/canvas, steps the game loop, simulates
  input, asserts state transitions). It must stay green; add assertions for new behavior.
- Each game exposes a small `window.__test` hook (getters + helpers like `start`,
  `gotoWave`, `forcePick`, `giveUpgrade`, `clearEnemies`). It's harmless in normal play
  and exists only so the harness can drive state. Keep it in sync when adding mechanics.
- There is no browser automation available here; the harness is the regression net.
  Always run it after changes, and syntax-check inline scripts if unsure.

## Conventions that matter

- The game loop reschedules `requestAnimationFrame` **first**, then runs update/render
  in a `try/catch` — a single bad frame must never permanently freeze the game.
- Speedrun is opt-in via `?speedrun=1` (the launcher appends it). The timer advances
  only while `state === 'playing'`.
- The in-game **Quit to menu** button posts `window.parent.postMessage('asteroids:menu')`;
  the launcher listens and returns to version select.
- **Audio engine (`SND`) is inlined** in each game (full version) and in the launcher
  (music-only, for menu music). It's procedural Web Audio — no asset files — and is
  inert when `AudioContext` is absent (so the harness is unaffected). When you change
  it, update the roguelite base (then regenerate), both classic files, and the launcher.
- **WASD mirrors the arrow keys** for steering *and* menu navigation: keydown maps
  `w/a/s/d → Arrow Up/Left/Down/Right` and the picker/shop branches use the mapped key.
- **`localStorage` keys** (all suffixed with the file **basename**):
  `asteroids_best_<file>` (speedrun time), `asteroids_score_<file>` / `asteroids_wave_<file>`
  (normal-mode bests), `asteroids_sfx` / `asteroids_music` (on/off),
  `asteroids_sfxvol` / `asteroids_musvol` (0–1). The launcher's menu reads these for the
  card "BEST …" lines and the **RESET BEST SCORES** button clears the per-version bests.
- `.nojekyll` (repo root) disables GitHub Pages' Jekyll build so files serve as-is.
- Match the existing terse, single-line code style in the game files. Comment sparingly.
