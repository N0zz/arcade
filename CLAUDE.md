# CLAUDE.md — komyo

Guidance for working in this repo. Read before editing.

## What this is

**komyo** — a small catalogue of **self-contained** browser games. Live at
**https://komyo.online** (GitHub Pages, repo `N0zz/komyo.online`, cloned at `~/arcade`).
`index.html` is the catalogue; each game is one folder under `games/`. No build step.

## Layout

```text
index.html      catalogue (renders tiles from games.js) + PWA install + share + feedback + newsletter
games.js        catalogue manifest — window.GAMES = [{slug,title,blurb,icon,accent,tag,soon?}]
analytics.js    GA4 loader, consent-gated (see "Analytics")
game-kit.js    SHARED game shell — sound engine + mute, top nav, share row, PWA auto-update
game-kit.css   shared shell styles (nav buttons, share row)
test.mjs        top-level harness: catalogue + Keep Defender + live-games boot + game-kit test
manifest.json sw.js favicon.svg og-image.png logo-*.png   CNAME .nojekyll
games/<slug>/   each game: index.html (+ test.mjs, manifest.json, sw.js, icon-192/512.png)
```

## Game conventions (the rules that matter)

- **No external dependencies / assets.** No build, no CDNs/fonts/images — visuals are canvas
  vector + system fonts + emoji-as-text. Games DO load two **in-repo, same-origin** shared files
  (`../../game-kit.js` + `../../game-kit.css`) plus `analytics.js`; these ship with the site and are
  cached offline (each game's `sw.js` SHELL), so they're not external "dependencies." All
  game-specific logic stays inline in the one `index.html`.
- **One inline `<script>` (IIFE) before `</body>`** that sets `window.__test`.
- **`window.__test` hook** — getters for state + a `step(n)` that drives the core `update()`
  **directly** (never relies on `requestAnimationFrame`, which is a no-op in tests). Must be
  deterministic so the headless harness can drive it. Harmless in normal play.
- **Headless-safe:** guard `AudioContext` (lazy, inert if absent), `navigator.vibrate` (only
  if present), `matchMedia`; `ctx.roundRect` fallback. Must boot in a mocked DOM without throwing.
- **Shell comes from game-kit** (see "Shared kit"): the top-left nav (‹ Menu · komyo ›), the
  top-right **sound menu** (SFX + Music + reset-scores), the sound engine, the end-screen share row,
  and PWA registration are all `gamekit.*` calls — do NOT re-implement them per game. Put the score/best
  HUD in a **`.gamekit-hud`** container (center-top; clears the left nav and right sound menu).
- **Three-screen schema (every game):** (1) MENU — title + mode/options selection with a
  CLEAR selected-state indicator on the active choice; (2) GAME; (3) SCOREBOARD/END — final
  score + best (persisted in `localStorage`) + a "Play again" action + the kit **share row**.
- **Each game is its own installable PWA:** `manifest.json` + `sw.js` + `icon-192/512.png`
  (distinct color-emoji icon) + apple/theme meta in `<head>`.
- **Distinct visual theme per game.** (asteroids=space, keep-defender=castle/parchment,
  bubbles=candy/aqua, snake=neon, breakout=synthwave, flappy=meadow, stacker=pastel, range=tactical.)
- **Responsive:** size the playfield from the viewport (don't hardcode px) so it fits narrow /
  zoomed screens — see the Bubble Pop fit fix.

## Shared kit (`game-kit.js` + `game-kit.css`)

Load in `<head>` (NOT `defer`, so `window.gamekit` exists before the inline script):
`<link rel="stylesheet" href="../../game-kit.css">` then `<script src="../../game-kit.js"></script>`.
API on `window.gamekit`:

- `gamekit.sound` — **SFX** channel: AudioContext engine + per-channel mute & volume
  (`gamekit_sfx_muted`/`gamekit_sfx_vol`). Register sounds with `gamekit.sound.define({ name: ({tone,noise}) => {…} })`;
  play with `gamekit.sound.play('name')` (no-ops when muted/headless). Per-game pattern:
  `const SND = window.gamekit.sound; SND.define({…});` then keep every `SND.play('…')` call.
- `gamekit.music` — **Music** channel (settings + UI only; `gamekit_music_muted`/`gamekit_music_vol`). A game
  with music keeps its own music engine and does `gamekit.music.subscribe(s => applyGain(s.gain))`
  (`s.gain` is 0 when muted). Only asteroids uses this today.
- `gamekit.nav({ music, reset, onMenu })` — injects the top-left `‹ Menu · komyo ›` bar **and** the
  top-right **sound menu** (🔊 SFX mute+slider, ♪ Music mute+slider when `music:true`). `reset` is a
  localStorage **prefix** (e.g. `'snake_'`) → adds a scoped "↺ Reset scores" entry. `onMenu` overrides
  the Menu button's default `location.reload()` (asteroids levels post to the parent instead).
- `gamekit.shareRow(el, { slug, title, message })` — builds + wires Native/X/Reddit/Copy into `el`;
  `message` is a function → a standalone sentence (no url), evaluated at click time. (Its `.sbtn`
  visual props are `!important` so a game's broad `#overlay button {…}` rule can't clobber the icons.)
- `gamekit.pwa()` — auto-update SW registration (reload once when a new worker takes control).
- `gamekit.resetScores(prefix)` — clears only the localStorage keys starting with `prefix`.
- `gamekit.shareUrls(url, msg)` — pure helper the kit test asserts.
- **`.gamekit-hud`** (CSS) — the standard **center-top** HUD (translucent pill, wraps; clears the left
  nav and the right sound menu). Games put their score/best/etc. items in a `.gamekit-hud` container and
  reserve ~48px (landscape) / ~92px (portrait) top headroom.

Each game's `sw.js` SHELL must include `'../../game-kit.js','../../game-kit.css'` (offline). The kit
is fully headless-safe (every browser API guarded). **Asteroids is now on the kit too** (launcher +
generated levels; SFX via `gamekit.sound`, music gain via `gamekit.music.subscribe`, Menu via `onMenu` →
`postMessage`); still mind its generated-trio workflow.

## Adding / changing a game

1. `games/<slug>/index.html` — load game-kit in `<head>`; use `gamekit.nav`/`gamekit.sound`/`gamekit.shareRow`/
   `gamekit.pwa` for the shell; keep game logic inline with the `__test` hook.
2. `games/<slug>/test.mjs` — dependency-free harness; **preload the kit** (read `../../game-kit.js`,
   run it in the sandbox before the inline script), then drive via `__test`.
3. Icon: render a 512 color-emoji PNG via Chrome headless, downscale to 192 (`sips`).
4. `manifest.json` + `sw.js` (network-first; SHELL = the HTML + icons + the two `../../game-kit.*` files).
5. Add an entry to `games.js` (`soon: true` = greyed "coming soon" tile). Set **`added: "YYYY-MM-DD"`**
   on a new game (drives the auto **NEW** badge for 7 days). **Whenever you ship a notable update to a
   game (new mode/feature — not every bugfix), bump that game's `updated: "YYYY-MM-DD"`** (drives the
   **UPDATED** badge for 7 days). Keep these dates accurate — they're the only source for those badges.
   Also **add a `CHANGELOG` bullet** in `index.html` for the change (see Catalogue specifics).
   When a game goes **live** (not `soon`), add its `https://komyo.online/games/<slug>/` URL to
   both `sitemap.xml` and `llms.txt`. `robots.txt` allows all crawlers (search + AI/LLM) and points
   at the sitemap; `llms.txt` is a curated markdown map of the site for LLMs.
6. Run **all** the suites and keep them green.

## Testing

- `node test.mjs` — top-level: catalogue + Keep Defender + boots every live game (kit preloaded) +
  a **game-kit** test section.
- `node games/<slug>/test.mjs` — each game's own suite (each preloads `../../game-kit.js` before the
  game script). `node games/asteroids/test.mjs` too (asteroids is bespoke — no kit).
- The inline-script extractor grabs the **last attribute-less `<script>` before `</body>`**, so
  `<script src=...>` (analytics.js, **game-kit.js**, gtag) in `<head>` don't confuse it. The kit is
  loaded as a separate sandbox pre-script (the real `game-kit.js`). Keep that pattern.
- No browser automation here — the harness is the regression net. Always run after changes.

## Git & deploy

- **Per-game commits** for clean history. End commit messages with the
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` line.
- **Batch pushes.** GitHub Pages soft-limits builds (~10/hr) and every push triggers a build +
  Action run, so commit per topic locally but **push several commits together**, not after each one.
- Hosting: **GitHub Pages from `main`** (built-in Fastly CDN — no Cloudflare). Custom domain
  `komyo.online` via the root `CNAME` file + **OVH DNS** (4 GitHub A records on the apex) + Enforce HTTPS.
  Don't delete `CNAME` (Pages would reset the domain). Edge cache can serve stale for ~minutes
  after deploy → version changed assets (e.g. `og-image.png?v=2`).

## Catalogue specifics

- **GA4** (`G-S4JQPYNDNM`) is **consent-gated**: `analytics.js` loads gtag only after the cookie
  banner's *Accept* (stored in `localStorage.gamekit_consent`, shared across the origin so per-game
  pages track too). Footer says **"no ads · no payments · plays offline."**
- **OG/Twitter** meta + `og-image.png` (1200×630, a letterboxed page screenshot). Regenerate it on
  rebrands and bump `?v=` so scrapers refetch; re-scrape via the FB Sharing Debugger.
- **Newsletter:** Kit. The inline Subscribe modal POSTs to Kit form **9615603**; sending domain
  `komyo.online` is DKIM/DMARC-verified (records in OVH), default from `news@komyo.online`.
- **Catalogue layout:** tiles render from `games.js` into two sections — **Single player** and
  **Multiplayer** (`mp: true`) — split by centered horizontal dividers; within each, order is
  favorites → available → coming-soon (`soon: true`, greyed). MP tiles show a `players` pill
  (👥 2P / 2–4P) and keep their genre tag. **Badges** (shimmer+sparkle marks, top-left, stackable
  vertically) come from the `BADGES` map in `index.html`: **NEW** (gold) and **UPDATED** (blue) are
  auto-applied from a game's `added` / `updated` date in `games.js` (within 7 days; NEW wins over
  UPDATED); **POPULAR** (purple, `badges: ["pick"]`) is manual. Add a type = one map entry + a color
  rule. Header carries a **mascot placeholder**
  (chibi fox-girl inline SVG — swap for real art later).
- **Changelog:** the `CHANGELOG` array in `index.html` (newest first) drives the 🗒️ Changelog modal
  (opened from the ☰ menu; date-grouped releases split by `<hr>`, lazy-loaded, searchable incl. by
  date). Each entry is one **release per date**:
  `{ date: 'YYYY-MM-DD', title: '…', items: ['New: …', 'Fix: …', 'Added …'] }`. **After shipping any
  player-facing change, add a bullet** — to today's release if one already exists, otherwise prepend a
  new dated release. Keep bullets plain-language and about what a *player* notices (a new game, a bug
  they'd hit, a mode/feature) — **never** internal/kit/test/build/refactor work. Write it for players,
  not as a commit log.
- Monetization is optional only: **Buy Me a Coffee** (footer) + GitHub Sponsors (README badge
  only — the footer Sponsor link was removed; footer = coffee + a GitHub-icon repo link).

## Asteroids (launcher — handle with care, but in scope)

`games/asteroids/` is a **launcher** (`index.html`) + `levels/*.html`; the roguelite trio is
**generated** from `roguelite-levelup.html` (edit the source/generator, **not** the generated
files). It is **not off-limits** — it should follow the same **menu → game → scoreboard + share**
schema as the other games. Read `games/asteroids/CLAUDE.md` first and keep its ~295-test suite green.
