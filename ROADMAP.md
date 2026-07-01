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

## 🚀 Path to launch (ordered)

The one ordered track. Everything else in this file is unordered backlog feeding into it.

- **Testers:** 3–4 active players (vote on games, test builds) + self-testing.
- **Launch content bar: 15–20 games.** Have **9** live → add **~3–5 I pick** + **~3–5 the players
  vote for** → launch.
- **External gates (not on my clock):** the **real mascot** and the **privacy policy** are owned by
  someone else; both can slip the date. Sequence around them.

1. **`gamekit.menu` framework** *(prio #1 — before new games)* — all menus kit-controlled, defined
   per game (declarative config → consistent behavior, easy to rebuild). Migrate all 9 live games onto
   it without breaking the three-screen schema / deep-links / mode preselection; suites green + manual
   pass. **~2 sessions.**
2. **Knobs audit pass** — ✅ **DONE (2026-06-29)**, see the "Done" section above. (Asteroids+ still in
   playtest; difficulty tiers parked.)
3. **Staging environment (`staging.komyo.online`)** *(nice-to-have, infra — enables online testing for
   everything below)* — a public staging site so testers hit the real thing, not just localhost.
   GitHub Pages serves one site per repo, so the two routes are **(a)** a second repo mirrored to
   `staging.komyo.online` via an Action (stays 100% GitHub-native), or **(b)** point the repo at
   Netlify / Cloudflare Pages for free per-branch deploys + the subdomain (less plumbing, adds a
   platform for staging only). **Must isolate staging's side effects:** `noindex` + robots disallow
   (keep it out of Google), **no prod GA4** (separate property or off), **no prod Discord webhook**
   (test webhook or off — don't spam real channels), **no real Kit signups** (test form or off). DNS:
   `staging` CNAME → `n0zz.github.io` in OVH; keep the two `CNAME` files straight.
4. **Build games to the bar** — ~3–5 I choose + ~3–5 player-voted, reaching 15–20; each via the
   dev-process gate (design+mock → POC → MVP → 2–3 iterations). **When picking, weigh build+tuning cost:
   bias toward low-tuning genres (puzzle / timing / arcade-skill) and AVOID balance-heavy ones (tower
   defense, roguelite shooters)** — Keep Defender and Asteroids+ each ate many tuning cycles
   (geometric HP, economy, snowball, drop rates, difficulty tiers). The queue's per-game **Effort**
   column already encodes this; treat balance-heavy as a high hidden cost. (See the
   `komyo-avoid-balance-heavy-genres` note.)
5. **Sound + music pass** — review & redesign SFX across all games for consistency; add **music** to
   the games that warrant it (only Asteroids has music today).
6. **Score-card redesign** *(gated on the real mascot)* — redesign the card art + settle the share
   affordance. My weak point — may need design help. **~1 session.**
7. **Target tuning** *(needs testing first)* — testers + self playtest (on staging), then retune
   daily/weekly challenge targets; confirm the UTC daily reset behaves. **~1 session.**
8. **Pre-launch QA** — real-device pass on staging (iPhone / Android / desktop): touch, audio unlock,
   PWA install, rotation, visuals. **Test newsletter sending** (Kit form → inbox). Confirm GA4 events +
   the in-site feedback path fire so post-launch feedback has inputs.
9. **Privacy policy signed off** *(external gate — counsel)* — hard blocker for any public launch
   (GA4 + Discord auto-post + EU visitors).
10. **Discord / community readiness** — ✅ **server set up (done)**: roles, rules, channels, verification,
    automod/anti-spam, reporting path; score auto-post + changelog flow there. **Only open item:
    moderators** — ask friends to volunteer; **if nobody bites, launch without mods** (someone will want
    the role) — *not a launch blocker.* Fine to start small with family + friends.
11. **Launch rollout (staged):** family + friends → let them share further → social media → launch
    posts (forums / portals / Reddit) → consider **paid ads** (Facebook / Google / wherever fits) →
    organic growth from shared scores + their friends joining.

**Post-launch:** watch requests/feedback, add games in free time. **TV + gamepad + a11y** lands here
(important, nice-to-have, not a launch blocker). Marketing experiments (QR stickers, merch, plushie)
also post-launch.

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
- **"My profile" modal + shareable stats card** *(idea)* — a profile the player opens from the catalogue
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
### Platforms

- **TV & controller support** (Android/Google TV · remote · gamepad) — full design at
  `~/komyo-tv-controller-design.md`. a11y + remote + gamepad for **all viable games** (the a11y/keyboard
  win alone justifies it); non-viable games **clearly marked Steam-style** (🎮/⌨️/📺 badges), not forced.
  Steps: (1) keyboard **focus + spatial nav** for catalogue/menus, (2) kit **`gamekit.input`** layer
  (keyboard+gamepad+touch), (3) per-game `controls` capability map → badges **+ catalogue filters**,
  (4) 10-foot polish. (GitHub Pages can't install as a TV app — target browser play.)

### Distribution

- **Promo video / ad montage** *(idea)* — record short clips of the menus (now with animated
  backdrops) + a few games, cut a simple montage for ad/social use, and upload it to the **Discord
  app / server** too (activity preview, announcements). Cheap marketing asset once the menus + games
  look final.
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
