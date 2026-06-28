# komyo Roadmap

Working notes for what to build / improve next. **Open items only** — not a promise of order.
Per-game feel/balance polish is **continuous** and not tracked here. (Shipped history lives in
the in-page changelog / git, not here.)

## 🔴 Critical (fix before more games)

- **Mobile layouts + screen rotation break the UI in most games** — games largely assume one
  orientation; on rotate (and on narrow portrait) the layout overflows/misplaces controls. Need a
  **proper per-orientation layout** (distinct landscape vs portrait arrangement) and a **re-layout +
  redraw on every orientation/resize change**. This is a cross-cutting pass over every game.
  **Full design + per-game fix table at `~/komyo-mobile-rotation-design.md`** — core solution = a
  shared `gamekit.layout` helper (orientation + debounced resize/orientationchange/visualViewport +
  unified HUD headroom + a rotation test hook); tower-defense is the reference pattern to copy.
  **Don't force dual-orientation:** aim for both everywhere, but where a second orientation isn't
  viable, **lock to the good one + show a "↻ rotate to play" hint + mark it on the tile/menu** (so
  nobody reports "doesn't rotate") + enforce a **minimum playable size**.

## Coming-soon games (queue)

Effort tiers: trivial / low / med / high — each a self-contained single file with a `__test` hook.
Aim: ship **lots** of games, but each one **polished with real depth** — added slowly, in small
batches or one at a time (not a dump of shallow POCs). Every new game follows the dev-process gate
in CLAUDE.md (design+mock → POC → MVP → 2–3 iterations).

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
| **Spot & Recall** | med | observation/memory: random items/animals cross the screen for ~10–30s, then you **answer questions about what you saw** ("how many ducks?") — plus **trick questions** about things never mentioned (the background color, an item that wasn't there). Tests attention; replayable with new scenes. 👁️ · `LOGIC` |
| **Parking / Racing (simple)** | med | a small driving lane: **simple races, parking-space challenges**, time trials. Top-down car + basic steering/physics; modes = race vs. park-it. Could grow into a small driving set. 🚗 · `SKILL` |
| **Pipe Layer** | med | **lay & fix pipes** to connect source→drain before the water reaches the end (rotate tiles / drag segments); leak-plugging variant. Classic puzzle, scales with grid size + timer. 🚰 · `LOGIC` |

### Kids-first (ages 6–10)

Built *for* young kids: one-tap / big-target controls, no reading required, gentle or no
fail-state, celebratory feedback. All self-contained with a `__test` hook. Anchor a future **Kids
section/filter** (tag the cute-simple existing games — Stack, Bubble Pop, Snake-Slow, Meadow-gentle
— alongside these). komyo's no-ads / no-payments / no-chat / offline story is the parent pitch.

| Idea | Effort | Notes |
| --- | --- | --- |
| **Pop the Balloons** | trivial–low | tap big floating balloons; combos/colors; no fail state, pure delight. The natural kid-safe reskin target for Range's mechanic. |
| **Memory / Matching Pairs** | low | flip cards to match animal/fruit emoji; grid sizes for age scaling; classic, calming |
| **Simon (color + sound)** | low | repeat the growing color/tone sequence; teaches memory + patterns |
| **Tap-to-Paint / Coloring** | low | fill regions or pixels by tapping a palette; no fail, creative, screenshot-shareable |
| **Counting / Letters / Shapes** | low–med | early-learning taps (count the ducks, tap the letter A, match the shape) — *educational*, pairs with the Word/typing lane; a little "Learn" corner |
| **Simple Maze** | low | guide a character (swipe/arrows) to the goal; bigger tiles + no timer for the youngest |

### Local multiplayer (single-screen)

One self-contained file, shared input on one device. Desktop = split keyboard; mobile = each player
owns a screen half. **Favorites: Light Cycles, Air Hockey, Slime Volleyball** (already coming-soon
tiles). More ideas: Sumo Arena, Spacewar Duel, Joust-lite, Snake Battle, Button-Mash Race.

### Persistent / long-running games (saved-state lane) — *idea worth pursuing*

Today every game is **hop-on, play 10 min, leave; next visit you start fresh** (same levels). Worth
adding a **second category: games with saved progress** that resume where you left off — e.g. a
**cookie-clicker / idle** where you return to your 1M cookies + unlocks, an incremental/management
sim, a base/garden you grow over days. **Why:** strong **retention + total playtime** lever — a reason
to come back daily that the current arcade games don't give, and it pairs naturally with Daily
Challenges and the Discord loop. Fits our model: all state is **localStorage** (no server), so the
Export/Import data feature becomes more valuable (don't lose your save when switching devices).
Caveats to design for: localStorage is per-device/per-browser (clearing it wipes progress — flag
this, lean on Export/Import), and offline/idle accrual needs a timestamp-based "what happened while
you were away" calc, not a live timer. Bake in a **versioned save schema** from day one (from the
genre-skills analysis). **Verdict: yes — pick one (idle/clicker is the cheapest, most proven entry)
and prototype it as the first persistent game.**

## Product & growth (the return loop)

### Growth levers (highest impact)

**🔴 HIGH PRIORITY right now: Daily Challenges · Score-card image · Embeddable games.**

1. **Daily & weekly Challenges** 🏆 **(HIGH PRIORITY)** — a curated mix of single-game goals
   ("Score 2,000 in Bubble Pop") **and cross-game/meta goals** ("Play 3 different games today",
   genres, total score, try-something-new). One **daily** (same for everyone by date) + a
   **weekly** that's **more *work*, not harder** (volume/variety: "play 10 games this week", "5
   dailies", "4 genres" — never just a 5× bigger number). **Challenges panel** (the 🏆 drawer)
   shows progress + ✅ + a **friendly "🔥 N days" counter that NEVER resets** (missing a day just
   doesn't increment — streak-breaking is predatory; we want it fun). All client-side, honor-
   system; completing one feeds the score-card share; the Play button deep-links the game **in the
   challenge's mode via `?mode=` URL args**. **Full design at `~/komyo-challenges-design.md`** —
   goal catalogue (incl. `scope:'cross'` + a per-day activity log), `gamekit.recordResult`/
   `lastResult` prerequisite, a `challenges.js` data file, and a **UTC-date-driven deterministic**
   selection algo.
2. **Shareable score card — image (Level 2)** **(HIGH PRIORITY)** — *(Level 1 text+link is already
   shipped & enriched; this item is the **image card only**.)* On game-over, draw a branded PNG on an
   offscreen canvas (accent bg, game icon, big score, title, mascot, `komyo.online`), then
   `canvas.toBlob()` → `File` → `navigator.share({files})` on mobile (shares the actual image to
   IG/Snap/WhatsApp); desktop fallback = copy-as-image (`ClipboardItem`) / download. **Keep the
   existing text/link row alongside** — smart-default per platform (image where
   `navigator.share({files})` works, text/link otherwise). Zero infra, fully self-contained (fits the
   no-external-assets rule). Distinct from the OG image (that's the static link-unfurl preview); the
   score card is a live, per-play image the user actively shares. **Best done after the real mascot
   art exists.**
3. **Real mascot art** *(in progress)* — the chibi fox-girl (Holo-ish, red/orange hair, fox ears)
   to replace the header placeholder; reuse on social, stickers, 404, newsletter, empty states.

*(Decision guard — don't re-propose: "personal bests on the tiles" is dropped; every game has many
modes, so there's no single best to show, and it would overcrowd the home page.)*

**High-priority trio (do before more games): Daily Challenges · score-card image · embeddable games.**
They reinforce each other — challenges give a daily reason to return, score cards + challenge-beaten
posts spread it, embeds pull new players in.

### Catalogue UX

- **Kit menu framework (v3)** *(idea — undecided; may keep what we have)* — promote the
  asteroids-style **mode tiles** + **option-group rows** into a reusable `gamekit.menu` the kit renders
  (declarative config → consistent menus everywhere, less per-game markup). Trade-off: more kit
  surface/abstraction vs. each game's current hand-rolled menu, which already works. Only worth it if
  the per-game menu boilerplate starts to hurt as games scale. Decide before the next batch of games.

### Engineering / kit follow-ups

- **Distill the genre design-knobs** (from `~/komyo-gamedev-skills-analysis.md`) into a repo file
  `game-design-knobs.md`, referenced from CLAUDE.md via `@game-design-knobs.md` (keeps CLAUDE.md
  lean). Apply per game as we build — Sudoku/Pipe **solvable-by-construction generation**, Icy Tower
  **jump-feel** knobs, idle game **versioned save**, asteroids **per-run seed**. *(TD self-audit
  deferred to the next tower-defense touch.)*

### TV & controller support (Android/Google TV · remote · gamepad)

- **Make Komyo playable on TVs** (e.g. Sony Bravia / Google TV) with a **D-pad/remote** and an
  **Xbox-style gamepad** — but only for games that suit it; **don't force it on all**. Full research +
  design at `~/komyo-tv-controller-design.md`. Findings: TV remotes arrive as **arrow keys + Enter** (so
  menus need real focus/spatial navigation — our biggest gap); the **Gamepad API works** in Android-TV
  Chromium over HTTPS (poll in the loop, needs a user gesture); **PWA install isn't supported on Android
  TV** → target browser play, not an installed app. **Support all *viable* games** (the **a11y win**
  alone justifies it — keyboard/focus nav, previously overlooked); games that can't (pointer-
  precision) are **clearly marked Steam-style** (🎮/⌨️/📺 full/partial/none capability badges), not
  forced. Plan: (1) keyboard **focus + spatial nav** for the catalogue/menus (a11y + remote), (2) a
  kit **`gamekit.input`** layer normalizing keyboard+gamepad+touch, (3) per-game `controls`
  capability map driving badges **+ catalogue filters** (🎮 Gamepad · 📺 TV-friendly · ⌨️ Keyboard,
  reusing Filter ▾), rollout easiest-first (Snake/Stack/Flappy/Asteroids…; Range = partial), (4)
  10-foot polish (focus rings, title-safe margins, bigger TV fonts).

### Cross-device / data **(IMPORTANT)**

- **Export / import player data** — let a player export a JSON of everything komyo keeps in
  localStorage (all per-game bests/top scores, favorites, unlocked birds, cash, settings, consent)
  and paste it on another device to import. No account/server needed. Likely a small modal on the
  catalogue: "Export" (copy/download a **base64-encoded** blob) + "Import" (paste → base64-decode →
  validate → write keys back → reload). Base64 is light obfuscation so non-tech players can't trivially
  edit their scores — *not* real security. Namespacing is easy (keys are already `arcade_favs`,
  `gamekit_*`, `<slug>_*`, `gamekit_result_*`). Add a **version field + migration path** (genre-skills
  takeaway) + merge-vs-replace choice, and guard against pasting junk.

### Known bugs / polish

- **Tower Defense — grey out the upgrade button when you can't afford it**, pop it in when you can.

### Distribution

- **Embeddable games (iframe snippet)** **(HIGH PRIORITY)** — "embed this game on your blog" → backlinks + free traffic.
- **List on game portals** — itch.io, free-to-play indexes.
- **Optional next:** a "recent scores" ticker on the site; opt-in toggle for the Discord score auto-post.

## Marketing experiments

- **Mascot QR stickers** — in high-boredom-with-phone spots (bus stops, cafés, queues). Stickers >
  flyers. Always a tracked URL (GA4) + a reason to scan (pair with the Daily Challenge). Small, fun,
  measurable side-experiment, not a primary channel.
- **Merch** — mascot on stickers/tees/mugs/pins via print-on-demand. Brand + fun, not revenue; gate
  behind the mascot + some audience.
- **Hand-made komyo plushie** — one-off passion/brand object; giveaway / hero photo. Needs the
  mascot design first.

## Parked (someday)

- **User-facing sort control** — defer until ~20 games, then a small control next to Filter:
  Featured (curated, default) · Newest (`added`) · A–Z · Most played (needs the GA4 popularity sort
  below). Favorites pinned above any sort. At ~8 games, curated order + NEW badges + favorites already
  do the job.
- **Live "users online now" count (site-wide + per-game)** — *dropped for now; revisit later.* Not
  possible client-side: a static site has no backend to count connected clients, and it conflicts with
  komyo's no-server / plays-offline identity. Two routes if reconsidered: (a) **GA4 Realtime** active
  users via a thin relay or scheduled `count.json` — approximate, delayed, consent-gated (undercounts);
  (b) a **small presence backend** (e.g. Cloudflare Worker + Durable Object / WebSocket ping on load) —
  the only *accurate, truly live* option, but a real external service to maintain. Caveat: a low/zero
  count on a young site creates an empty-room effect — better paired with real traffic + the Discord
  community than shipped early.
- **Sort tiles by popularity (most-played first), driven by GA4** — no new DB: a scheduled GitHub
  Action reads the GA4 Data API (service-account key in a repo secret), writes a static `stats.json`,
  and `render()` sorts playable tiles by it (favorites still pinned; missing/zero → current order).
  Daily refresh, consent-sampled — sort by it but don't show raw counts. Could also drive the
  `pick`/"POPULAR" badge automatically.
