# funyo Roadmap

Working notes for what to build / improve next. Open items only — not a promise of order.

## Per-game polish (feel / balance)

- **Stack** — speed up the base loop; on landscape, narrow/center the play column so the block
  doesn't crawl across the full width.
- **Brick Breaker** — denser bricks, more/earlier power-ups (pairs with the "faster from start" fix).
- **Meadow Flyer** — gentler defaults (bigger gaps, slower scroll, forgiving hitbox) + speed-up over
  time so a run builds tension.
- **Range** — add a Sprint mode (time to reach 100 points) alongside the timed modes.

## Coming-soon games (queue)

Effort tiers: trivial / low / med / high — each a self-contained single file with a `__test` hook.

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

### Local multiplayer (single-screen)

One self-contained file, shared input on one device. Desktop = split keyboard; mobile = each player
owns a screen half. **Favorites: Light Cycles, Air Hockey, Slime Volleyball** (already coming-soon
tiles). More ideas: Sumo Arena, Spacewar Duel, Joust-lite, Snake Battle, Button-Mash Race.

## Product & growth (the return loop)

### Growth levers (highest impact)

1. **Daily Challenge** 🏆 — one seeded run per day (same board for everyone), personal best saved
   locally. The Wordle effect: a reason to come back daily. Start with one game, then go cross-game.
2. **Shareable score cards** *(deferred — staying with plain text+link share for now)* — upgrade
   the share to a per-result visual that proves the score and stops the scroll (a link just unfurls
   the same generic OG image for everyone). Two levels:
   - **Level 1 — "Wordle block" (text-only, structured):** a multi-line block that reads like a card
     anywhere (X / Discord / WhatsApp / SMS), e.g. `🐍 funyo · Neon Snake` / `SCORE 4,210 · best 5,120`
     / a 🟩🟩🟩⬜ progress bar / `▶ funyo.online/games/snake`. ~1h, universal, no image hosting.
   - **Level 2 — rendered image card:** on game-over draw a branded PNG on an offscreen canvas (accent
     bg, game icon, big score, title, mascot, `funyo.online`), then `canvas.toBlob()` → `File` →
     `navigator.share({files})` on mobile (shares the actual image to IG/Snap/WhatsApp); desktop
     fallback = copy-as-image (`ClipboardItem`) / download. Zero infra, fully self-contained — fits
     the no-external-assets rule. Best done **after** the real mascot art exists.
   - Distinct from the OG image (that's the static server-side link-unfurl preview); the score card is
     a live, per-play image the user actively shares. Rec: ship Level 1 first, then Level 2.
3. **Personal bests on the tiles** — `your best: 42` under each playable tile (localStorage, zero
   infra). Turns the catalogue into a trophy shelf.
4. **Real mascot art** — the chibi fox-girl (Holo-ish, red/orange hair, fox ears) to replace the
   header placeholder; reuse on social, stickers, 404, newsletter, empty states.

### Catalogue UX

- **Control-bar / button layout redesign** — the header/footer already hold several controls and
  more are coming: Install, Feedback, Subscribe, share, Buy-me-a-coffee, GitHub, genre tags/filters/
  search, changelog, embed instructions, Discord, merch/store. Give every control a deliberate home —
  likely a compact top utility bar + an overflow/hamburger for secondary actions + a tidy footer.
  **Design this before adding more buttons.** (NB: this is the *website* control layout. "Chrome"
  elsewhere refers to the **Dino Jump** game's Chrome-browser visual style — a different thing.)
- **Genre filter chips** — single row (`All · Arcade · Puzzle · Reflex · Logic…`) filtering the grid.
- **Search box** — defer until ~20 games.
- **"New" badge auto-applied** to recently-added tiles (the badge system exists; drive it by date).

### Cross-device / data

- **Export / import player data** — let a player export a JSON of everything funyo keeps in
  localStorage (all per-game bests/top scores, favorites, unlocked birds, cash, settings, consent)
  and paste it on another device to import. No account/server needed. Likely a small modal on the
  catalogue: "Export" (copy/download the JSON blob) + "Import" (paste → validate → write keys back →
  reload). Namespacing is easy (our keys are already `arcade_favs`, `funyo_*`, `<slug>_*`). Consider
  a version field + merge-vs-replace choice, and guard against pasting junk.

### Distribution

- **"What's new" / changelog page** — doubles as newsletter + social content; ties the loop together.
- **Embeddable games (iframe snippet)** — "embed this game on your blog" → backlinks + free traffic.
- **List on game portals** — itch.io, free-to-play indexes.
- **Vote-on-next-game** — no DB: external poll (Tally/StrawPoll) or a Discord / GitHub Discussions
  poll; or the zero-infra proxy: track coming-soon tile clicks in GA4 as implicit demand.
- **funyo Discord server** — community hub: new-game announcements, polls, feedback, score-sharing,
  giveaways. Pairs with the newsletter. Worth it once there's a small audience.
  - **Auto-share scores to Discord** — on game over, post `player {name} finished {game} with score
    {points/time}!`. Username = a one-time local prompt at first play (localStorage, **no account**),
    reused across games; opt-in toggle; sanitize the name. A Discord **webhook** is the simplest
    sink, but its URL can't be safely embedded in client JS (public → abuse) → needs a thin relay
    (serverless fn / small bot), ideally rate-limited. Same payload could feed a "recent scores" ticker.

**If picking two things next instead of a new game: shareable score cards + personal bests on
tiles** — they compound (every play → a potential share, every visit → a reason to return).

## Marketing experiments

- **Mascot QR stickers** — in high-boredom-with-phone spots (bus stops, cafés, queues). Stickers >
  flyers. Always a tracked URL (GA4) + a reason to scan (pair with the Daily Challenge). Small, fun,
  measurable side-experiment, not a primary channel.
- **Merch** — mascot on stickers/tees/mugs/pins via print-on-demand. Brand + fun, not revenue; gate
  behind the mascot + some audience.
- **Hand-made funyo plushie** — one-off passion/brand object; giveaway / hero photo. Needs the
  mascot design first.

## Parked (someday)

- **Sort tiles by popularity (most-played first), driven by GA4** — no new DB: a scheduled GitHub
  Action reads the GA4 Data API (service-account key in a repo secret), writes a static `stats.json`,
  and `render()` sorts playable tiles by it (favorites still pinned; missing/zero → current order).
  Daily refresh, consent-sampled — sort by it but don't show raw counts. Could also drive the
  `pick`/"POPULAR" badge automatically.
