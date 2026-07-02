# komyo Roadmap

Working notes — mostly **open items (unordered)**; the one ordered track is **Path to launch** below.
Per-game feel/balance polish is continuous and not tracked here. Shipped history lives in the in-page
changelog / git. Design docs live in `~/` (not in the repo): mobile-rotation, gamedev-skills,
challenges, tv-controller.

## ✅ Done

- **Knobs audit pass — DONE (2026-06-29).** All 9 games reviewed vs `@game-design-knobs.md` (feel +
  balance). Keep Defender done (difficulty tiers + rebalance). Asteroids+ rebalanced (×10 scale, caps,
  expiry, kamikaze, finite 30-wave finale) — **shipped but still being playtested** (tracked in the
  `komyo-asteroids-plus-rebalance` note; difficulty tiers parked). Meadow Flyer speed-creep shipped.
  Other games were fine or got minor tweaks. Layout already locked by per-game `__test.layout` tests.
- **Sound & music — DONE (2026-07-01).** Kit-owned procedural music engine + richer SFX + shared reverb +
  stingers; music on every game's menu & in-game (Keep Defender swaps per-map biome tracks), Asteroids
  laser shot; catalogue global Settings page. See the `komyo-audio-design` note.
- **`gamekit.menu` framework — DONE (2026-07-01).** All 9 games migrated to the declarative kit menu
  (cards / sliders / grid / map-popup + animated backdrops), suites green.
- **Profile page + share card fit — DONE (2026-07-02)** *(pending a final on-phone verify)*. Title
  box = title + name full-width with a right meta column (🏆 pts / 💪 good runs / 📅 since — always shown,
  never hidden at 0); core counts in a centered divider strip; ✕ floats on the modal corner; avatar emoji
  dropped. **Shared image now matches the live modal:** crop fixed (the clone inherited `bottom:0` →
  viewport-tall canvas), particle frame composited in, and sizing props are no longer pixel-frozen so the
  export reflows instead of truncating when the rasterizer's fonts drift (Android).
- **Score card — DONE (2026-07-02).** "Neon marquee" redesign, mock-transcribed: per-game accent +
  icon theme (from the share config), silhouette frame glows, gradient score with halo, sparkles, mascot
  logo + wordmark, ▶ play-on CTA; speedrun/sprint records render as TIME. 780×410 rounded-on-alpha WebP
  (~20 KB; JPEG on Safari). Share menu (Share… / Copy image / Download + preview) — Copy writes a single
  PNG flavor (fixes the Discord double-paste; cause was the OS sheet's multi-flavor Copy). The **Discord
  games-log posts the card itself** (halved) via Components V2 — bare image, clickable play link below,
  one request. *Mascot art refresh stays gated (Later).*

## 🚀 Path to launch (ordered)

Reprioritised **2026-07-01**. Foundations are done (kit menu, audio, profile/best-store, challenges, GA4,
PWA, share, Discord auto-post). We're close — the real gates are **game count** + the **two external
items** (mascot, privacy). The staged friends/family rollout is already trickling.

**External gates (not on my clock):** the **real mascot** and the **privacy policy** are owned by others —
sequence around them.

### Next ~2 days

Reordered **2026-07-02**. (Recently done: **Minor batch** — `game_start` GA4 event + kit **"Tap to play"**
audio splash + nav-fit guard, 2026-07-01. **Challenge-points titles** — 9 titles ("X of Y", Goblin→Emperor)
by lifetime points, full-width profile box with escalating shine tier 0→8, username shares the shine,
`CHALLENGES.titles`/`titleFor()`, 🏆 CHALLENGE PTS, client-only cosmetic, 2026-07-01.)

0. **Review fix sessions — `~/komyo-sessions-plan.md`** (added 2026-07-02). The full-repo review
   (`~/komyo-review-2026-07.md`) produced 9 batched work sessions: P0/P1 bugfixes (asteroids+ reset
   wipes Classic's bests, dead goodRuns challenges, 5 games frame-rate-dependent on 120 Hz, Discord
   auto-post consent gate), framework hardening (kit absorption + CLAUDE.md refresh + shared test
   harness), cleanup, and a final verification pass. Kickoff per session: *"get
   ~/komyo-sessions-plan.md, start session N"*. **Sessions 3/5/6 gate #2 (the skill)**; sessions
   1/2/7 gate a wider rollout; the rest are anytime.
1. **Translations / i18n — analysis + estimate (~2 days).** Non-English kids struggle with English game
   descriptions + UI, so multi-language support is a real reach lever. **Scope it before building:** target
   languages (a first few — PL + big EU/global?), architecture for a **no-build static site** (per-language
   JSON dictionaries loaded client-side + a kit `t(key)` helper + `navigator.language` detect + a language
   picker, choice persisted), and the true cost = **string extraction** (catalogue UI, per-game blurbs in
   `games.js`, in-game menu labels + hints inlined in each game, challenges, FAQ / About / privacy). Also:
   kid-friendly wording, SEO (`hreflang` + translated `<title>`/meta/OG per language), a GA4 language read,
   RTL if we ever add Arabic/Hebrew. **Output:** decision on languages + a concrete implementation plan +
   **effort estimate** → routes #2 vs #6.
2. **Translations / i18n — implement IF the spike says it's easy.** If the extraction + `t()` layer turns
   out small, ship it here; **if it's a big surface, it drops to Later (#6).**
3. **"Create a game" Claude skill** — capture the framework once → describe a game in ~5 min, get an
   on-framework MVP in a 20–30 min session (spec under Catalogue / kit). Big accelerator for #4.
   **Gated on plan sessions 3/5/6** (dt-loop, shared test harness, kit absorption + CLAUDE.md refresh) —
   built earlier it would faithfully reproduce the review's bug classes.
4. **Build games** — toward the content bar; each via the dev-process gate (design+mock → POC → MVP →
   iterate). **Bias low-tuning genres** (puzzle / timing / arcade-skill), **avoid balance-heavy** (tower
   defense, roguelite shooters — they ate many tuning cycles). See `komyo-avoid-balance-heavy-genres`.
   Fold in the review's flagship-vs-breadth take: slot **one original-mechanic, shareable game** into
   the queue alongside the genre remakes (see the `komyo-market-expansion-discussion` note).
5. **Staged rollout — friends / family** *(already slowly happening, ongoing)* → let them share further.

### Later

6. **Translations / i18n — implement (if the spike said it's *not* easy).** Wire the `t()` layer into the
   kit, extract + translate strings, language picker + persistence, `hreflang`/meta per language. The big-
   surface branch of #1/#2 — sequence once the spike sets the language list + plan.
- **Infra:** staging env (`staging.komyo.online`) **+ consider a Cloudflare CDN in front of GH Pages**
  (bandwidth headroom past ~100 GB/mo + the escape hatch we discussed). Staging must isolate side effects:
  `noindex` + robots disallow, **no prod GA4**, **no prod Discord webhook**, **no real Kit signups**. DNS:
  `staging` CNAME → `n0zz.github.io` in OVH; keep the two `CNAME` files straight.
- **Score card — mascot art refresh** *(gated on the real mascot; the shine + double-paste fix shipped
  2026-07-02 — see Done)* — refresh `buildScoreCard`/`buildProfileCard` art around the mascot.
  Shine/PNG/share spec the shipped card reuses: on-screen card can animate (glints/particles, like the titles); the **shared** card must be a
  **static PNG** (animation can't survive an image; a GIF/MP4 is too heavy + unsupported by share targets),
  so bake the glow/gradient/halo into the still (particles won't serialize into the DOM-snapshot + Safari
  taints → drawn-card fallback; that's fine — gradient + glow reach the bar). **Sharing = image-first, text
  only as fallback:** image works on native Web Share (files), the Discord webhook, and download/copy;
  **X / Reddit / Twitter "intent" URLs are link+text only** (you can't attach a locally-generated PNG to an
  intent) → those fall back to text + link, and better previews there need pre-generated per-game/score **OG
  images** (server-side → parked).
- **Mascot attire shop** *(deferred — gated on the real mascot)* — spend challenge points on mascot
  cosmetics (logo / score card / profile). Design when the mascot lands. (Discord roles / real anti-cheat
  stay parked — backend-gated; see Integrations → challenge-points.)
- **Privacy policy signed off** *(external gate — counsel; hard blocker for a broad public launch —
  GA4 + Discord auto-post + EU visitors)*.
- **Marketing materials** — plan + prepare: promo video / montage (full + Discord preview cuts), per-game
  OG/Twitter cards, story-format share card.
- **LAUNCH** — publish everywhere: portals (itch.io, free-to-play indexes), news, forums, subreddits,
  Discord servers, socials. Consider paid ads later.

### Post-launch

- **Target tuning** — retune daily/weekly challenge targets from real GA4 completion data; confirm UTC
  daily reset.
- **Discord Activity polish** — fix the proxied-feedback "network error" + verify webhook/GA4 in-Activity
  (bonus lane, not main audience — see bug backlog).
- Watch requests/feedback, add games in free time. **TV + gamepad + a11y**. Marketing experiments (QR
  stickers, merch, plushie).

### Dropped (not doing)

- **Pre-launch QA as a formal gate** — organic test-and-report via friends/family instead (the tester pool
  isn't big enough to staff a checklist; see Decision guards).
- **Wrapped-style profile expansion** — the profile v1 is enough for launch.

## Coming-soon games (queue)

Ship **lots** of games, each **polished with real depth** — added slowly, in small batches. Every new
game follows the dev-process gate in CLAUDE.md (design+mock → POC → MVP → 2–3 iterations) and the
design knobs (`@game-design-knobs.md`).

**All of the games below are already live as greyed "coming soon" placeholder tiles in `games.js`** —
titles, icons and genre tags here match the catalogue. This table is the build queue: effort + notes
per game. Roughly easiest → hardest within each group.

### Single player

| Game | Effort | Build notes |
| --- | --- | --- |
| **Dusk Runner** 🦖 `ARCADE`+`REFLEX` | low | Chrome offline-dino style — mono line-art, ground runner, jump/duck, obstacle spawner, speed ramp, day→night palette shift |
| **Pump Stop** ⛽ `SKILL` (+`STRATEGY` manager) | trivial–low (solo) · med (manager) | Solo: hold to pump, **stop at the target** with momentum/overrun, scored by closeness. **Tolerance is tight (~1%):** $20 off by 20¢ = fine, by 50¢ = too far under. **Manager expansion (idea, discuss later):** run **4 pumps** — cars arrive with a paid limit, stop each near its limit. Over = free-gas penalty (costs the station); tiny-under = fine; a car left under-served/unattended → patience runs out → it **blocks the pump**; **all 4 blocked = game over**. Attention is the scarce resource → triage is the game. **Open decisions:** (a) cars **auto-fill and you only tap _stop_** vs you actively **_pump_** each; (b) **one active pump at a time** vs **all at once**; (c) tolerance band (~1%? scales with difficulty?). Tension: a tight ~1% band is hard to hit while juggling 4 pumps — (a)/(b) set how forgiving it must be. |
| **Keyfall** ⌨️ `TYPING`+`SKILL` | low–med | falling words — type each before it lands; speed ramp, combos, WPM. Opens a wider WORD/TYPING lane (more later: anagram, spelling, Wordle-style guesser) |
| **Word Hunt** 🔍 `WORD`+`PUZZLE` | low–med | letter-grid word search — drag to circle, timer, themed packs; word-placement generator |
| **Sky Sling** 🎈 `SKILL`+`ARCADE` | med | bottom slingshot — drag back to aim & set power, release to fire at floating balloons; projectile physics (gravity + shifting wind), ricochets, multi-pop combos, ammo limits. Physics-aim — distinct from the kids tap-only Balloon Pop |
| **Blink** 👁️ `LOGIC`+`PUZZLE` | med | observation/memory — items cross the screen ~10–30s, then Q&A ("how many ducks?") incl. **trick questions** about things never shown (background color, an item that wasn't there) |
| **Pocket Rally** 🏎️ `RACING`+`ARCADE` | med | top-down multi-lane straight — weave the traffic, don't clip a bumper, distance + speed score |
| **Market Parking** 🅿️ `SKILL`+`RACING` | med | packed lot, too few spots — race rivals to an empty space and park before them; P1–4 (bots fill the solo game) |
| **Floodgate** 🚰 `LOGIC`+`PUZZLE` | med | pipe-routing — rotate tiles to connect source→drain before the flood; **solvable-by-construction**, leak-plug variant, grid + timer scaling |
| **Sudoku** 🔢 `LOGIC`+`PUZZLE` | med | grid + notes + hints are low; real work is the **unique-solution generator** (backtracking solver → dig cells) |
| **Invaders** 👾 `SHOOTER`+`ARCADE` | med | formation movement, descending rows, shields, escalating waves |
| **Road Hop** 🐸 `ARCADE`+`CASUAL` | med | lane spawns, log-riding, endless scroll |
| **Trap the Cat** 🐱 `PUZZLE`+`LOGIC` | med | hex grid + cat BFS pathfinding to the nearest edge |
| **Arcane** 🔮 `ACTION`+`SHOOTER` | med–high | spell variety + wave AI (scope-dependent) |
| **Icy Tower** 🧗 `PLATFORMER`+`ARCADE` | high | momentum + variable jump + wall-bounce + combos + rising floor |
| **Pulse Dash** 🔺 `RHYTHM`+`REFLEX` | high | obstacles authored to a beat + generate/sync a track |

### Kids-first (ages 6–10)

Built *for* young kids: one-tap / big-target controls, no reading required, gentle/no fail-state,
celebratory feedback. The **`KIDS` genre tag now exists** (all six carry it, so the filter is already
wired) — still want to fold the gentle existing games into it (Stack, Bubble Pop, a slow Snake,
gentle Meadow). The no-ads / no-payments / no-chat / offline story is the parent pitch.

| Game | Effort | Build notes |
| --- | --- | --- |
| **Balloon Pop** 🎈 | trivial–low | tap big floating balloons; combos/colors; no fail. Kid-safe tap game (distinct from Sky Sling) |
| **Critter Match** 🐾 | low | flip cards to match animal pairs; grid sizes scale by age |
| **Glow Says** 🟢 | low | Simon — repeat the growing color/tone sequence |
| **Color Pop** 🎨 | low | tap regions to fill color; no fail, screenshot-shareable |
| **Tap & Learn** 🔠 | low–med | early-learning taps (count the ducks, tap the letter A) — *educational*, pairs with the WORD lane |
| **Maze Pals** 🐭 | low | guide the mouse to the goal; big tiles, no timer |

### Local multiplayer (single-screen)

One file, shared input on one device (desktop = split keyboard; mobile = each player owns a screen half).

| Game | Effort | Build notes |
| --- | --- | --- |
| **Mash Dash** 🏁 `PARTY` 2–4P | trivial | button-mash race to the line |
| **Air Hockey** 🏒 `SPORT` 2P | low–med | puck physics + 2 paddles. *(favorite)* |
| **Light Cycles** 🏍️ `ARCADE` 2–4P | med | neon trail-fill arena, box rivals in. *(favorite)* |
| **Slime Volleyball** 🏐 `SPORT` 2P | med | two blobs + ball + net physics. *(favorite)* |
| **Ring Out** 🟡 `SPORT` 2–4P | med | sumo — shove rivals off the disc |
| **Gravity Duel** 🚀 `ACTION` 2P | med | gravity well + two ships orbit / aim / shoot |
| **Flap Fight** 🪶 `ARCADE` 2–4P | med | flap to ride higher and stomp — Joust on one screen |

Not yet a tile (idea): **Snake Battle** (multiplayer trail duel — overlaps Light Cycles; pick one).

### Persistent / long-running games (saved-state lane) — *idea worth pursuing*

A **second category: games with saved progress** that resume where you left off. **Foxden** 🦊 `IDLE`
(grow a fox den over days) is the shipped placeholder / flagship for this lane — idle/clicker is the
cheapest proven entry. **Why:** the strongest retention lever — a daily reason to return that the
current arcade games lack; pairs with Challenges + Discord. All `localStorage` (no server), so
Export/Import matters more. Design for: per-device storage (clearing wipes progress — lean on
Export/Import), timestamp-based offline accrual (not a live timer), and a **versioned save schema**
from day one.

## Product & growth

### In flight / near-term

- **Real mascot art** *(in progress)* — chibi fox-girl (Holo-ish, red/orange hair, fox ears); replaces
  the header + score-card placeholder; reuse on social, stickers, 404, newsletter, empty states.
- **Score-card share — settle UX, then redesign.** The image card is shipped and works, but two
  decisions are open before polishing: (a) **redesign the card art** (after the real mascot), and
  (b) **keep the 📷 button in the share row or rebuild the share affordance** entirely. Decide UX first.
- **Daily-challenge target tuning.** Challenges are live (UTC daily/weekly, points 1/5 that never reset,
  single-game + cross-game goals, plus a 1-year completion History). Targets are **provisional** —
  playtest and retune (Snake already bumped 50→250); confirm the UTC daily-reset behaves.

- **Aggregate usage insights via GA4 — v1 SHIPPED (2026-07-01).** Anonymous, consent-gated GA4 events
  via `window.gamekitTrack` (no-ops unless the cookie banner was accepted; counts only, no per-user
  data). Shipped: `audio_state` (load ping) + `audio_pref` (mute toggles, from the kit so in-game +
  Settings both count); `challenge_shown` + `challenge_done` (→ completion rates per goal);
  `feature_open` (profile/faq/changelog/settings/data/embed/challenges/newsletter/feedback/random);
  `data_export`/`data_import`; `game_play` {slug,mode}. Event categories named in `privacy.html` §3.
  **Next (read once real data flows):** if most players disable music, flip it to opt-in / lower the
  default; retune challenge targets from `challenge_done`÷`challenge_shown`. Caveat: samples only
  *consented* users → read as a trend, not a census.

- **Privacy policy — legal review** *(in progress)*. The plain-language AI draft is published at
  `komyo.online/privacy.html` (treat as v1 — accurate, not lawyer-hardened) and links from the cookie
  banner + About. **Waiting on the lawyer's response** (handoff briefs:
  `~/komyo-prawnik-brief-pl.md` PL + `~/komyo-privacy-lawyer-brief.md` EN). Open: PL-authoritative
  version + LLM convenience translations, the children/analytics question, and the Discord auto-post
  clause. Revisit `privacy.html` once counsel replies.

### Catalogue / kit

- **`gamekit.menu` framework (v3)** *(decided — launch prio #1, see Path to launch)* — promote the
  asteroids-style mode tiles + option-group rows into a reusable `gamekit.menu`: declarative config →
  one consistent menu system across all games, less per-game markup, easy to rebuild. Migrate every
  live game onto it.

- **Menu backdrops should share the real game engine** *(refactor — someday, not now)* — each menu's
  animated `cfg.backdrop` is currently a **hand-written re-derivation** of the game's look (starfield,
  meadow, neon snake, TD map…). That means any change to a game's visuals must be duplicated in its
  backdrop and **can drift** out of sync. Rework so a menu backdrop renders a **live idle frame of the
  actual game** (factor each game's scene draw into a shared `drawScene(frame)` the menu can call), so
  there's one source of truth. Bigger refactor (needs ambient-motion in a non-playing state); deferred.

- **"CHALLENGE" tile badge + filter** *(idea)* — a new badge (alongside NEW / UPDATED / POPULAR in
  the `BADGES` map) on a game tile when that game has an **active today's/weekly challenge**, and a
  matching **filter** ("has an active challenge") that lists only those games. **Must key off
  game-specific challenges only** — generic cross-game goals (e.g. "play 2 games") must NOT light up
  the badge on every tile; only a challenge scoped to that game's slug counts. Drives players toward
  games with something to chase today.
- **In-game Challenges button (🏆 top bar)** *(idea — pairs with the CHALLENGE badge)* — when you start a
  game that has an active challenge, you currently can't see the goal without going back to the catalogue.
  Add a 🏆 button to the in-game top bar that opens the **same Challenges panel** as the home page — so you
  can check (or re-check mid-run) today's daily + weekly goals and progress without leaving the game. Opens
  as a kit modal that freezes the game (like the other top-bar overlays), highlighting *this game's* active
  goal. **Always show the button** (so players learn it's always there); when the current game HAS an active
  challenge, give it a **notification state** — a subtle glow/pulse or a small dot badge — as a "there's
  something for you here" nudge (reuse `activeChallengeSlugs`). Keep it subtle (a gentle pulse/dot, NOT a
  bounce — distracting mid-game) and **reduced-motion-safe** (static dot/glow, no animation); optionally
  quiet it once opened (like a read notification). **Main lift:** the challenge logic (`CHALLENGES`, the UTC
  daily/weekly pick math, `evalGoal`, progress) lives inline in `index.html` today — it needs to move into
  `game-kit.js` (shared module) so the catalogue and the in-game button render from one source.
- **Claude skill: scaffold a new game on our framework** *(idea — dev tooling, big leverage)* — a
  `synerise`-style skill (name TBD, komyo-scoped) that captures **once** everything a new game must obey
  — repo layout, the three-screen schema, `gamekit.menu` declarative config, `gamekit.sound`/`music`
  usage, the `__test`/`__test.layout` hooks + headless-safety rules, the single-source best store
  (`gamekit.best`/`saveBest` + `modeLabel()`), PWA files (manifest/sw/icons), `games.js` + changelog +
  sitemap/llms wiring, and the design knobs (`@game-design-knobs.md`) — distilled from the existing 9
  games' patterns and this repo's CLAUDE.md. Then: **describe a game in ~5 min → get a working,
  on-framework MVP in a 20–30 min session** (POC → MVP that boots green in the suites, correct theme,
  menu, sound, tests). The skill encodes the *dev-process gate* so the output isn't a one-prompt game —
  it stops at a playable MVP for human iteration, not a "done" claim. **Build it by mining the repo once**
  (patterns are already consistent across all 9 games), store as a reusable skill, then author new games
  through it. Nice-to-have accelerator for the "build to 15–20 games" bar, not a launch blocker.
- **CI check: `updated` badge stays honest** *(idea — dev tooling)* — a GitHub Action that fails when a
  game's OWN files changed but its `updated` date in `games.js` wasn't bumped (so the UPDATED badge never
  goes stale/missing). **Crucial nuance:** shared changes (`game-kit.js/css`, `challenges.js`, etc.) affect
  every game and must NOT require bumping any game's `updated` — a minor menu/kit tweak shouldn't mark all
  9 games "updated" when the games themselves didn't change. So: "game changed" = a diff under
  `games/<slug>/` (probably excluding deploy-stamped `sw.js` VERSION churn); shared/kit diffs are exempt.
- **Custom error pages** — verify what GitHub Pages actually allows. A root **`404.html`** *is*
  supported → build a branded one (mascot + search / back-to-catalogue; ties into the mascot reuse).
  Other codes (403 / 5xx) are served by GitHub/Fastly and **aren't customizable** on a static Pages
  site — confirm the limits and document what we can/can't do.
- **"My profile" — v1 SHIPPED (2026-07-01).** Catalogue ☰ → 👤 My profile: summary (games / modes / plays /
  days), favorites (favorite game by plays, most-played mode, favorite genre, top score, good runs,
  playing-since), per-game PB tables (best + plays, only games with a PB), and a shareable stats-card
  image. Backed by the kit's **single source of truth for bests** — all 9 games read/write via
  `gamekit.best`/`gamekit.saveBest` (`gamekit_pb`, keyed by a human mode label) + `gamekit_stats` for
  lifetime rollups. No per-game best-keys, so menu & profile can't diverge; reset prunes the store; portable
  via Export/import. **Wrapped-style expansion (next):** play/longest streak, challenges completed, this-week /
  this-month / all-time toggles, "new games tried", milestone badges (played-every-game, first-10k,
  N-day-streak), night-owl/early-bird from play-hour, and a **"Your year in komyo"** multi-slide seasonal
  card. Deeper ones (total minutes played) need coarse session-time tracking in the kit. Original spec:
- **"My profile" modal + shareable stats card** *(original spec, superseded by v1 above)* — a profile the player opens from the catalogue
  (☰ menu, next to Settings) that summarizes THIS device's play: total games played + total game-modes
  played, and the best score across everything. Below the summary, per-game high-score tables/lists
  **sorted by game**, showing each mode's PB. **Only list games where the player has a PB** — if every
  mode of a game is 0/empty, hide that game entirely (so a fresh device shows little/nothing, and it
  fills in as they play). Data is already on-device: per-game `*_best*` localStorage keys + the kit's
  `recordResult`/`lastResult` history — no backend. **Key requirement: a Share button** that renders the
  *exact view shown in the modal* as a **score-card image** (reuse `gamekit.scoreCard`/`buildScoreCard`)
  and shares it (Native/X/Reddit/Copy + Discord), so the shared image matches what the user sees. Pairs
  with the global Settings page and the score-card redesign (gate the visual on the real mascot).
- **Sitemap coverage — add the static pages** *(SEO fix)* — `sitemap.xml` currently lists only the
  catalogue + each live game, not `tos.html` / `privacy.html` (nor any future standalone pages). Decide
  whether these belong in the sitemap (they're indexable, low-churn, low-priority) — likely **yes, add
  them** with a low `<priority>` so search engines can discover them; also cross-check `llms.txt` and
  `robots.txt` list what we intend. One-time audit + a note in CLAUDE.md's "when a page goes live" step
  so new standalone pages get added going forward.
- **"Play a random game" button + challenge — SHIPPED (2026-07-01).** 🎲 Random button in the toolbar
  picks a playable game, **prefers unplayed** (a `gamekit_pb` entry = played), falls back to all when
  everything's been tried. Plus a `scope:'random'` daily & weekly challenge ("play today's/this-week's
  pick") resolved from the deterministic, same-for-everyone `CHALLENGES.randomSlug(idx, playable)` — based
  on **all** games (never unplayed), lights the CHALLENGE tile badge on the pick, and stores the resolved
  game title in history. Only the *button* filters to unplayed.
### Platforms

- **TV & controller support** (Android/Google TV · remote · gamepad) — full design at
  `~/komyo-tv-controller-design.md`. a11y + remote + gamepad for **all viable games** (the a11y/keyboard
  win alone justifies it); non-viable games **clearly marked Steam-style** (🎮/⌨️/📺 badges), not forced.
  Steps: (1) keyboard **focus + spatial nav** for catalogue/menus, (2) kit **`gamekit.input`** layer
  (keyboard+gamepad+touch), (3) per-game `controls` capability map → badges **+ catalogue filters**,
  (4) 10-foot polish. (GitHub Pages can't install as a TV app — target browser play.)

### Distribution

- **Promo video / ad montage** *(idea)* — record short clips of the menus (now with animated
  backdrops) + a few games. Capture the source footage once at high quality, then export **two cuts**:
  - **Full montage (YouTube / Twitch / social)** — the good-quality version: 1080p+ (up to 1440p/4K
    source), longer, higher bitrate, with music. The main marketing asset for socials + channel trailers.
  - **Discord Activity "Video Preview"** — the tiny in-directory clip (shown on hover + on the
    click-through upsell): a brief screen-recording of the activity. Hard limits: **640×360 · 16:9 · mp4 ·
    ≤0.5 MB · 10 s** → short, low-bitrate cut; a per-activity preview if games ship as separate Discord
    activities. Downscaled from the same source footage.
  Do it once the menus + games look final.
- **List on game portals** — itch.io, free-to-play indexes.
- **Discord Activity (play inside a voice channel)** *(idea — strong architectural fit)* — register a
  Discord app with **Activities** enabled (Embedded App SDK) so people launch komyo **inside a voice
  channel** and play together right on the server. Our games are static, self-contained and
  same-origin / no external deps, which is exactly what the sandboxed Activity iframe wants (the main
  chore is routing any requests through Discord's `/.proxy/` URL mapping + the CSP). Bonus: the SDK
  exposes the Discord user, so we could **auto-set the display name** for the score post. Pairs with the
  Discord-first community plan; needs a public, approved app. Likely **post-launch** (after the server +
  mods are real), but low-friction given the architecture.
- **Discord auto-post at scale (decided).** Keep posts **client-side**, shard by **one channel + one
  webhook per game** — each game is then an independent ~30/min bucket (the ceiling is keyed to channel
  *and/or* webhook, and per-game makes both unique, so it works either way). No practical per-server
  cap; Discord's global ~50 req/s is **per origin IP**, and client posts come from each player's own
  browser, so that never bites. Gate volume with a **filter + adjustable threshold** — only post scores
  above a tunable level (records / notable runs), with a knob to dial how chatty it is. The realistic
  wall is a *single game* getting >~30 finishers/minute (a great problem, far off).
  - *Not doing — batching* (needs a server to aggregate across players; pointless per-player — see
    Decision guards). *Parked — a relay* in front of the webhook (the client-embedded webhook is an
    open spam target; a relay would hide+rate-limit it, but it's a Cloudflare-Worker route we're
    avoiding for now — see Parked).
- **Shared scores feed = Discord** (the score auto-post is the games-log). A live **on-site** feed needs
  an off-GitHub backend (Pages is static — can't host an endpoint, so no GH load risk): **(a)** scheduled
  Action scrapes Discord → static `scores.json` (stopgap, near-live, one-way, GitHub-native — preferred),
  or **(b)** Cloudflare Worker + KV (`POST /score` → capped list, `GET /recent`; truly live — *parked,
  see Parked*). Filter to **good scores / records only**; public `POST` has the same abuse surface as
  the webhook. **Defer** until real traffic (an empty live feed looks deader than none).
- **Optional:** opt-in toggle for the Discord score auto-post.

### Integrations (ideas — for later)

Filter for all of these: **does it keep the no-server / no-ads / no-accounts identity?** Most
"integrations" quietly need a backend; these are sorted by whether they do.

**Good & low-friction (fit the ethos):**

- **Twitch chat (client-side, no backend)** — *the standout.* A streamer logs in with Twitch; the game
  connects to **Twitch chat over IRC-WebSocket from the browser** (no server), and viewers affect/play
  via chat: vote the next wave, spawn a boss, names on-screen, chat-triggered events. Fits
  "self-contained"; streamer + chat is the best organic-reach lever. Suits Keep Defender / Asteroids.
  (Deeper hooks — channel-point EventSub, a published Twitch **Extension** panel — need an Extension
  Backend Service → parked.)
- **Google Play via PWA wrap** — games are already PWAs; Bubblewrap / PWABuilder wraps the catalogue (or
  a game) as a TWA → real Play Store presence, no backend, no ads. Best app-store route. (iOS needs a
  wrapper + Apple review — harder.)
- **itch.io HTML5 uploads** — zip each game; itch hosts + brings players, ad-free-friendly, embeddable.
  Concretizes "list on portals."
- **Cloud-sync the Export/import blob** *(idea — optional convenience)* — let a player connect a personal
  storage provider (Google Drive / Dropbox / OneDrive) so the base64 export auto-syncs (backup + carry
  between devices) without manual export/import. Client-side OAuth to the *user's own* drive — **no komyo
  backend, no accounts on our side** (keeps the no-server / privacy stance). Watch: OAuth needs registered
  app credentials + redirect handling on a static site, and token storage; keep it strictly opt-in. Nice
  step up from manual Export/import once profiles matter to people.
- **Challenge-points progression / economy** *(idea — big; needs a backend to do properly)* — spend the
  challenge points on rewards:
  - **Titles** — unlock cosmetic titles at point thresholds, shown on the profile page (cheap, client-only).
  - **Collectibles shop** — buy **mascot skins** with points; the mascot is the logo + shows on score cards,
    so a skin is visible and worth chasing (client-only if purchases live on-device).
  - **Discord roles/titles** — spend points for a Discord role — a real status carrot. Needs a Discord bot +
    OAuth (link account → grant role), i.e. a small backend.
  - **The hard part = anti-cheat.** Points on-device are trivially forged (export → bump → import), so any
    reward that grants *external* value (a Discord role) must verify the **whole history** — plays, records,
    and challenge-completion log — not just the number. Recompute expected points from that history; if it
    doesn't reconcile (claims 1000 but history supports ~10), reject and optionally flag (a jokey **"cheater"**
    role). Note honestly: since everything is currently client-side, a determined cheater can craft a
    *consistent* fake history offline — client verification only raises the bar (you'd have to recreate a
    plausible full history), it doesn't prevent. **True** integrity needs server-side authoritative recording
    (log each result as it happens), which is a real departure from today's **no-backend / no-accounts /
    device-only** model. So: titles + mascot-skin shop are doable client-side now; Discord-role spending and
    real anti-cheat are a separate, backend-gated project — decide if the status payoff justifies leaving the
    serverless stance.
- **More share targets + story-format card** — add WhatsApp / Telegram / Bluesky / Mastodon / Threads
  intents (just URL schemes) + a **vertical "story" score-card** for IG/TikTok Stories. Cheap; leverages
  the existing share row.
- **Per-game OG/Twitter cards** — static per-game share images so a shared *game* link looks good (not
  just the homepage). Small SEO/social win, no infra.

**Needs a server/Worker → parked** (we're avoiding that — note the benefit, don't build): dynamic
*per-score* OG images, global cross-player leaderboards, Reddit/X **auto-posting** of records, Twitch
Extensions w/ EBS, Discord channel-point hooks.

**Marketing, not integration:** YouTube / TikTok / Shorts = a *content* play (clips of satisfying
moments, a devlog, a komyo channel), no API work. (Discord **Activity** — play in a voice channel — is
the best Discord-native one; already under Distribution.)

**Honest tradeoff:** the big traffic portals (Poki, CrazyGames, GameDistribution) send real volume but
inject **their ads** + want **their SDK** — collides with the "no ads · plays offline" pitch. itch.io
and Play-via-PWA don't. Treat the ad-portals as a separate, deliberate decision later.

Ranked pick if/when we act: Twitch chat → richer share targets + story card (cheap, pre-launch) →
Play Store via PWA → itch.io. Rest are post-launch or parked.

## Marketing experiments

- **Mascot QR stickers** — high-boredom-with-phone spots (bus stops, cafés, queues); tracked URL (GA4) +
  a reason to scan (pair with the Daily Challenge). Small measurable side-experiment.
- **Merch** — mascot on stickers/tees/mugs/pins (print-on-demand). Brand + fun, not revenue; gate behind
  the mascot + some audience.
- **Hand-made komyo plushie** — one-off passion/brand object; giveaway / hero photo. Needs the mascot.
- **AI/vibecoding-channel marketing — the repo IS the ad** *(idea — risky, considerable)*. Advertise in
  AI / genAI / vibecoding communities (Show HN, r/ClaudeAI, r/vibecoding, AI-dev X/YouTube), promoting
  the **GitHub repo itself** as the artifact: a whole product built AI-first with the full development
  history public (~400 commits in the first week, CLAUDE.md-driven workflow, per-game test harnesses,
  the create-a-game skill). People check what the repo *produces* → discover komyo.online. Upside: the
  "watch a complete product get built" story is rare content, and that audience IS the HN/curator crowd
  that features browser games; it's a second acquisition lane that doesn't compete on game keywords.
  Risks to weigh before doing it: publicly brands the site "AI-made" (quality skepticism sticks to the
  brand, not just the post), audience is devs not players (traffic may not convert to play sessions),
  and it spotlights the repo for cloners (public anyway, but promotion invites it). Mitigation if tried:
  lead with the games' polish, frame AI as the *how*; do it as one deliberate launch-style post, not the
  identity.

## Parked (someday)

- **User-facing sort control** — defer to ~20 games, then a small control next to Filter (Featured ·
  Newest · A–Z · Most played). Favorites pinned above any sort.
- **Live "users online now" count** — not possible client-side on a static site; conflicts with the
  no-server identity. Routes if reconsidered: GA4 Realtime via a relay (approximate) or a small presence
  backend (Cloudflare Worker + Durable Object / WebSocket — accurate but real infra). Empty-room risk on
  a young site.
- **Sort tiles by popularity (GA4-driven)** — scheduled Action reads the GA4 Data API → static
  `stats.json`; `render()` sorts playable tiles (favorites pinned; missing/zero → current order). Could
  also drive the "POPULAR" badge.

- **Cloudflare Worker (any role)** — *avoiding for now: prefer staying GitHub-Pages-only, no extra
  platform.* Saved only for what it *would* give if ever reconsidered: (a) a truly-live on-site scores
  feed (`POST /score` → capped list, `GET /recent`); (b) a validating, rate-limiting **relay** in front
  of the Discord webhook (hides the URL → kills the client-embedded-webhook spam surface, drips under
  rate limits). Not wanted now — note the benefits, don't build it.

## Decision guards (don't re-propose)

- **No per-tile personal bests** — every game has many modes, so there's no single best to show, and it
  overcrowds the home page.
- **No on-site local "recent plays" ticker** — with no server it only shows your own plays and misreads
  as a community feed (tried + removed). The shared feed is Discord; see Distribution for the live route.
- **No formal idea→release checklist / per-game QA blocker list** — testers play what they *like* and
  report issues there; they won't grind a feature checklist over untested games, and a blocker list of
  untested games is meaningless. Organic test-and-report instead. (Revisit only if the tester pool
  grows enough to staff structured QA.)
- **No batching of Discord score posts** — batching only pays off by aggregating across many players at
  a central point, which needs a server; a single player doesn't finish games fast enough for
  per-player batching to mean anything. Use the filter + per-game channels instead.
