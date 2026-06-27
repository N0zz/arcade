# komyo Roadmap

Working notes for what to build / improve next. Open items only — not a promise of order.
Per-game feel/balance polish is **continuous** and not tracked here.

## Coming-soon games (queue)

Effort tiers: trivial / low / med / high — each a self-contained single file with a `__test` hook.
Aim: ship **lots** of games, but each one **polished with real depth** — added slowly, in small
batches or one at a time (not a dump of shallow POCs).

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

## Product & growth (the return loop)

### Growth levers (highest impact)

**🔴 HIGH PRIORITY right now: Daily Challenges · Score-card share · Embeddable games.**

1. **Daily & weekly Challenges** 🏆 **(HIGH PRIORITY)** — a curated **list** of concrete challenges
   ("Score 2,000 in Bubble Pop", "Survive 10 waves in Keep Defender", "Reach 30 in Meadow Flyer").
   Pick **today's by date** (`index = dayNumber % list.length`) so everyone gets the same one; plus a
   bigger **weekly** challenge picked by week-number (Mon–Sun). A collapsible **Challenges panel** on
   the catalogue lists today's + this week's with progress and a ✅ when done, tracked in the player's
   space (localStorage). Track a **streak** (consecutive days completed) — the real return hook
   (= the "Wordle loop": once-a-day, same for everyone, shareable). All client-side: games write their
   last result to a shared key (`gamekit_result_<slug>` = {mode,score,time}); the panel checks it vs the
   target. No server, honor-system (fine for casual; no leaderboard). Completing one feeds the
   score-card share ("I beat today's komyo challenge 🔥"). *(Replaces the earlier seeded-run idea —
   a challenge list is simpler to build, legible, and works across the current games immediately.)*
2. **Shareable score cards** **(HIGH PRIORITY)** *(text+link shipped; image card is the next build)* — upgrade
   the share to a per-result visual that proves the score and stops the scroll (a link just unfurls
   the same generic OG image for everyone). **Offer BOTH, not image-only:** keep the text/link share
   row (universal, clickable, works on desktop) AND add a "🖼️ Score card" button for the image;
   smart-default per platform (image where `navigator.share({files})` works, text/link otherwise) —
   image-only would break desktop file-sharing and drop the clickable link. Two levels of card:
   - **Level 1 — "Wordle block" (text-only, structured):** a multi-line block that reads like a card
     anywhere (X / Discord / WhatsApp / SMS), e.g. `🐍 komyo · Neon Snake` / `SCORE 4,210 · best 5,120`
     / a 🟩🟩🟩⬜ progress bar / `▶ komyo.online/games/snake`. ~1h, universal, no image hosting.
   - **Level 2 — rendered image card:** on game-over draw a branded PNG on an offscreen canvas (accent
     bg, game icon, big score, title, mascot, `komyo.online`), then `canvas.toBlob()` → `File` →
     `navigator.share({files})` on mobile (shares the actual image to IG/Snap/WhatsApp); desktop
     fallback = copy-as-image (`ClipboardItem`) / download. Zero infra, fully self-contained — fits
     the no-external-assets rule. Best done **after** the real mascot art exists.
   - Distinct from the OG image (that's the static server-side link-unfurl preview); the score card is
     a live, per-play image the user actively shares. Rec: ship Level 1 first, then Level 2.
3. **Real mascot art** *(in progress)* — the chibi fox-girl (Holo-ish, red/orange hair, fox ears)
   to replace the header placeholder; reuse on social, stickers, 404, newsletter, empty states.

*(Dropped: "personal bests on the tiles" — every game has many modes, so there's no single best to
show, and it would overcrowd the home page.)*

### Catalogue UX

*Essentially **done*** — the only open thread is the undecided v3 menu idea below (user-facing sort is
now **parked**).

- *(done: **control layout redesign** — floating **☰ menu + 📱 Install** (top-left) and **🏆 Challenges**
  (top-right) buttons opening full-height, drag-resizable drawers; slim footer. Replaced the earlier
  top-bar idea. "Chrome" elsewhere = the Dino Jump game's visual style, not this.)*
- *(done: **search + filters** — instant client-side search; a **Filter ▾** dropdown (genre · Single/
  Multiplayer · show-coming-soon · **Highlights** = NEW/UPDATED/POPULAR); search + filter state saved
  in the URL, so a filtered view is bookmarkable/shareable.)*
- *(done: **Changelog** modal (date-grouped releases, lazy-load, searchable) + **About komyo** modal.)*
- *(done: auto **NEW**/**UPDATED** tile badges, date-driven from `added`/`updated`, 7-day window.)*
- **Kit menu framework (v3)** *(idea — undecided; may keep what we have)* — promote the
  asteroids-style **mode tiles** + **option-group rows** into a reusable `gamekit.menu` the kit renders
  (declarative config → consistent menus everywhere, less per-game markup). Trade-off: more kit
  surface/abstraction vs. each game's current hand-rolled menu, which already works. Only worth it if
  the per-game menu boilerplate starts to hurt as games scale. Decide before the next batch of games.

### Cross-device / data **(IMPORTANT)**

- **Export / import player data** — let a player export a JSON of everything komyo keeps in
  localStorage (all per-game bests/top scores, favorites, unlocked birds, cash, settings, consent)
  and paste it on another device to import. No account/server needed. Likely a small modal on the
  catalogue: "Export" (copy/download a **base64-encoded** blob) + "Import" (paste → base64-decode →
  validate → write keys back → reload). Base64 is light obfuscation so non-tech players can't trivially
  edit their scores — *not* real security. Namespacing is easy (keys are already `arcade_favs`,
  `gamekit_*`, `<slug>_*`, `gamekit_result_*`). Add a version field + merge-vs-replace choice, and guard
  against pasting junk.

### Distribution

- *(done: **changelog** — in-page modal on the catalogue (date-grouped releases). A standalone page /
  newsletter feed off the same data can come later.)*
- **Embeddable games (iframe snippet)** **(HIGH PRIORITY)** — "embed this game on your blog" → backlinks + free traffic.
- **List on game portals** — itch.io, free-to-play indexes.
- **komyo Discord server** — community hub: new-game announcements, polls (incl. **vote-on-next-game**), feedback, score-sharing,
  giveaways. Pairs with the newsletter. Worth it once there's a small audience.
  - **Auto-share scores to Discord** — on game over, post `player {name} finished {game} with score
    {points/time}!`. Username = a one-time local prompt at first play (localStorage, **no account**),
    reused across games; opt-in toggle; sanitize the name. A Discord **webhook** is the simplest
    sink, but its URL can't be safely embedded in client JS (public → abuse) → needs a thin relay
    (serverless fn / small bot), ideally rate-limited. Same payload could feed a "recent scores" ticker.

**High-priority trio (do before more games): Daily Challenges · score-card share · embeddable games.**
They reinforce each other — challenges give a daily reason to return, score cards + challenge-beaten
posts spread it, embeds pull new players in.

### Site, legal & discoverability

- *(done: **License** — PolyForm Noncommercial 1.0.0 (`LICENSE`, free for any noncommercial use, no
  commercial use); README badge + section; About/site wording says **"source-available"**, not "open source".)*
- *(done: **robots.txt + sitemap.xml + llms.txt** — all crawlers allowed (search engines + AI/LLM bots);
  sitemap lists home + the 8 live games; llms.txt is a curated markdown map. New live games must be
  added to both.)*
- *(done: **OG image** refreshed (1200×604, `?v=3`); **favicon** now the komyo mascot.)*
- *(done: sitemap submitted to Google Search Console; OG image re-scraped.)*

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
