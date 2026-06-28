# komyo Roadmap

Working notes — **open items only**, not an order. Per-game feel/balance polish is continuous and
not tracked here. Shipped history lives in the in-page changelog / git.
Design docs live in `~/` (not in the repo): mobile-rotation, gamedev-skills, challenges, tv-controller.

## 🔴 Critical (before more games)

- **Per-game mobile + rotation pass.** The `gamekit.layout` helper is shipped and every game is routed
  through it (rotation now triggers relayout), but each game still needs its **own layout work** —
  distinct portrait/landscape arrangement, redraw, HUD placement — per the fix table in
  **`~/komyo-mobile-rotation-design.md`** (aim-trainer HUD caching, snake HUD, flappy bird-Y, stacker
  banner, breakout redraw…). Decide each game's **dual vs locked** orientation; where a second
  orientation isn't viable, **lock it + "↻ rotate to play" hint + tile marker + min-playable-size**.
  *Verified: Flappy rotation + offline; other games still need a real-device check.*

- **Verify every existing game against the game design knobs** (`@game-design-knobs.md`). One pass over
  all games, checking each against our distilled per-genre knobs + failure modes — **includes the old
  "TD self-audit"** (Keep Defender vs the 7 tower-defense systems + the DPS sanity formula). Output =
  concrete polish items per game; fix the cheap ones inline, log the rest. Review-then-fix, not a rewrite.

## Coming-soon games (queue)

Ship **lots** of games, each **polished with real depth** — added slowly, in small batches. Every new
game follows the dev-process gate in CLAUDE.md (design+mock → POC → MVP → 2–3 iterations) and the
design knobs (`@game-design-knobs.md`).

### Single player

| Idea | Effort | Notes |
| --- | --- | --- |
| **Word & typing games** | low–med | typing trainer (speed/accuracy/wpm), word search, anagram / Wordle-style guesser, spelling & letter puzzles — a whole `WORD` / `LOGIC` lane, good for SEO and daily-challenge fits |
| **Sudoku** | med | grid + notes + hints are low; real work is the generator (backtracking solver → dig cells keeping a unique solution). 🔢 · `LOGIC` · `#7aa2ff` |
| **Dino Jump** | low | Chrome's offline T-Rex runner in its minimalist style (mono line-art, day→night, cacti + pterodactyls, jump/duck, speed ramp) |
| Invaders | med | formation movement, descending rows, shields, escalating waves |
| Road Hop (crossy) | med | lane spawns, log-riding, endless scroll |
| Trap the Cat | med | hex grid + cat BFS pathfinding to the nearest edge |
| Arcane (spellcaster) | med–high | spell variety + wave AI (scope-dependent) |
| Icy Tower | high | momentum + variable jump + wall-bounce + combos + rising floor |
| Pulse Dash (rhythm) | high | obstacles authored to a beat + generate/sync a track |
| **Balloon Slinger** | med | bottom-center slingshot — **drag back to aim & set power, release to fire** at floating balloons; projectile **physics with gravity + shifting wind**, ricochets and multi-pop combos; levels add balloon patterns/movers and limited ammo. 🎈 · `SKILL` (a physics-aim game — distinct from the kids tap-only *Pop the Balloons*) |
| **Fill the Tank** | trivial–low | petrol-pump game: hold to pump, **stop at exactly $20.00** (or a target). Fast-flowing meter + momentum/overrun, scored by how close you land; rounds raise the target / speed up the flow. Simple, satisfying, very mobile-friendly. ⛽ · `SKILL` |
| **Spot & Recall** | med | observation/memory: random items/animals cross the screen for ~10–30s, then you **answer questions about what you saw** ("how many ducks?") — plus **trick questions** about things never mentioned (the background color, an item that wasn't there). 👁️ · `LOGIC` |
| **Parking / Racing (simple)** | med | a small driving lane: **simple races, parking-space challenges**, time trials. Top-down car + basic steering/physics; modes = race vs. park-it. Could grow into a small driving set. 🚗 · `SKILL` |
| **Pipe Layer** | med | **lay & fix pipes** to connect source→drain before the water reaches the end (rotate tiles / drag segments); leak-plugging variant. Classic puzzle, scales with grid size + timer. 🚰 · `LOGIC` |

### Kids-first (ages 6–10)

Built *for* young kids: one-tap / big-target controls, no reading required, gentle/no fail-state,
celebratory feedback. Anchor a future **Kids section/filter** (tag the cute-simple existing games —
Stack, Bubble Pop, Snake-Slow, Meadow-gentle — alongside these). The no-ads / no-payments / no-chat /
offline story is the parent pitch.

| Idea | Effort | Notes |
| --- | --- | --- |
| **Pop the Balloons** | trivial–low | tap big floating balloons; combos/colors; no fail state. The kid-safe reskin of Range's mechanic. |
| **Memory / Matching Pairs** | low | flip cards to match animal/fruit emoji; grid sizes for age scaling |
| **Simon (color + sound)** | low | repeat the growing color/tone sequence |
| **Tap-to-Paint / Coloring** | low | fill regions/pixels by tapping a palette; no fail, screenshot-shareable |
| **Counting / Letters / Shapes** | low–med | early-learning taps (count the ducks, tap the letter A) — *educational*, pairs with the Word lane |
| **Simple Maze** | low | guide a character to the goal; bigger tiles + no timer for the youngest |

### Local multiplayer (single-screen)

One file, shared input on one device (desktop = split keyboard; mobile = each player owns a screen
half). **Favorites: Light Cycles, Air Hockey, Slime Volleyball.** More: Sumo Arena, Spacewar Duel,
Joust-lite, Snake Battle, Button-Mash Race.

### Persistent / long-running games (saved-state lane) — *idea worth pursuing*

A **second category: games with saved progress** that resume where you left off (idle/clicker first —
cheapest proven entry; or an incremental sim / grow-over-days base). **Why:** the strongest retention
lever — a daily reason to return that the current arcade games lack; pairs with Challenges + Discord.
All `localStorage` (no server), so Export/Import matters more. Design for: per-device storage (clearing
wipes progress — lean on Export/Import), timestamp-based offline accrual (not a live timer), and a
**versioned save schema** from day one.

## Product & growth

### In flight / near-term

- **Real mascot art** *(in progress)* — chibi fox-girl (Holo-ish, red/orange hair, fox ears); replaces
  the header + score-card placeholder; reuse on social, stickers, 404, newsletter, empty states.
- **Score-card share — settle UX, then redesign.** The image card is shipped and works, but two
  decisions are open before polishing: (a) **redesign the card art** (after the real mascot), and
  (b) **keep the 📷 button in the share row or rebuild the share affordance** entirely. Decide UX first.
- **Daily-challenge target tuning.** Challenges are live (UTC daily/weekly, points 1/5 that never reset,
  single-game + cross-game goals). Targets are **provisional** — playtest and retune (Snake already
  bumped 50→250); confirm the UTC daily-reset behaves.

### Catalogue / kit

- **Kit menu framework (v3)** *(undecided)* — promote the asteroids-style mode tiles + option-group rows
  into a reusable `gamekit.menu` (declarative config → consistent menus, less per-game markup). Only
  worth it if per-game menu boilerplate starts to hurt as games scale. Decide before the next batch.
- **Export / import player data** *(IMPORTANT)* — export everything in `localStorage` (bests, favorites,
  unlocks, settings, consent) as a **base64 blob**, paste-to-import on another device. No server. Small
  catalogue modal; add a **version field + migration path** + merge-vs-replace + junk guard. Base64 is
  light obfuscation, not security. Also unblocks the persistent/idle lane.

### Platforms

- **TV & controller support** (Android/Google TV · remote · gamepad) — full design at
  `~/komyo-tv-controller-design.md`. a11y + remote + gamepad for **all viable games** (the a11y/keyboard
  win alone justifies it); non-viable games **clearly marked Steam-style** (🎮/⌨️/📺 badges), not forced.
  Steps: (1) keyboard **focus + spatial nav** for catalogue/menus, (2) kit **`gamekit.input`** layer
  (keyboard+gamepad+touch), (3) per-game `controls` capability map → badges **+ catalogue filters**,
  (4) 10-foot polish. (GitHub Pages can't install as a TV app — target browser play.)

### Distribution

- **List on game portals** — itch.io, free-to-play indexes.
- **Shared scores feed = Discord** (the score auto-post is the games-log). A live **on-site** feed needs
  an off-GitHub backend (Pages is static — can't host an endpoint, so no GH load risk): **(a)** scheduled
  Action scrapes Discord → static `scores.json` (stopgap, near-live, one-way), or **(b)** Cloudflare
  Worker + KV free tier (`POST /score` → capped list, `GET /recent`; truly live). Filter to **good
  scores / records only**; public `POST` has the same abuse surface as the webhook (validate +
  rate-limit). **Defer** until real traffic (an empty live feed looks deader than none).
- **Optional:** opt-in toggle for the Discord score auto-post.

## Marketing experiments

- **Mascot QR stickers** — high-boredom-with-phone spots (bus stops, cafés, queues); tracked URL (GA4) +
  a reason to scan (pair with the Daily Challenge). Small measurable side-experiment.
- **Merch** — mascot on stickers/tees/mugs/pins (print-on-demand). Brand + fun, not revenue; gate behind
  the mascot + some audience.
- **Hand-made komyo plushie** — one-off passion/brand object; giveaway / hero photo. Needs the mascot.

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

## Decision guards (don't re-propose)

- **No per-tile personal bests** — every game has many modes, so there's no single best to show, and it
  overcrowds the home page.
- **No on-site local "recent plays" ticker** — with no server it only shows your own plays and misreads
  as a community feed (tried + removed). The shared feed is Discord; see Distribution for the live route.
