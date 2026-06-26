# Asteroids — Design Spec

_Date: 2026-06-25_

> **This is the original design spec (2026-06-25), kept for history — parts are now
> superseded.** Since then the project evolved: versions are **living, not frozen**;
> all five are built; and many features were added (procedural audio + settings menus,
> map pickups, Auto-Fire, WASD controls, normal-mode best score/wave + a reset button,
> the `levels/` folder, `levels.js`, `favicon.svg`). For the **current** state and
> conventions, see **README.md** and **CLAUDE.md**. Tests now exceed 290 assertions
> (`node test.mjs`). The sections below reflect the initial plan, not every later change.

## 1. Versioning model

Each iteration is its own **frozen, fully-playable HTML file**, listed in the menu.
Older files are **never edited again**. No semantic versioning — each version has a
human-readable, edition-style name + one-line description.

```
asteroids-game/
  index.html                    launcher; reads the manifest below
  versions.js                   single source of truth: [{file, title, desc, tag}]
  classic.html                  frozen (was vanilla.html)
  classic-enhanced.html         frozen (was latest.html)
  roguelite-levelup.html        NEW this session
  roguelite-milestones.html     later session
  roguelite-shop.html           later session
  DESIGN.md                     this file
```

### Version registry

| Name | File | Tag | Description |
|---|---|---|---|
| Classic Asteroids | `classic.html` | CLASSIC | The original |
| Classic Asteroids — Enhanced | `classic-enhanced.html` | CLASSIC | Pause, weapon tiers, polish |
| Roguelite: Auto Level-Up | `roguelite-levelup.html` | ROGUELITE | XP-driven upgrade picks |
| Roguelite: Score Milestones | `roguelite-milestones.html` | ROGUELITE | Milestone-driven upgrade picks _(later)_ |
| Roguelite: Wave Shop | `roguelite-shop.html` | ROGUELITE | Shop between waves _(later)_ |

The launcher renders one card per registry entry (title + description + tag), loads
the chosen file in a fullscreen iframe, with a `‹ versions` button to return.

## 1b. Speedrun mode (all versions)

The launcher has a **NORMAL / SPEEDRUN** toggle. Launching in speedrun passes
`?speedrun=1` to the game, which then:
- shows a centered **timer** (mm:ss.cs) that advances only while actively playing
  (frozen during pause / level-up / shop screens),
- defines a **goal** — Classic & Enhanced: reach **2000 points**; Roguelite: **clear
  wave 5** (the first boss),
- on reaching the goal, shows a COMPLETE screen with the time and saves a **best time**
  to `localStorage` (`asteroids_best_<file>`), surfaced on the menu card.

Normal mode is endless (survive for the highest score), timer hidden.

## 2. Scope of this session

- Migrate launcher to the manifest-driven model; rename the two existing files.
- Build the **shared roguelite base** + the **Auto Level-Up** variant (`roguelite-levelup.html`).
- `Milestones` and `Shop` are deferred — they will be small deltas on the same base.

## 3. Shared roguelite base ("VS-flavored asteroids")

### Controls / handling
Classic manual asteroids, unchanged: `←/→` rotate, `↑` thrust (momentum), `Space`
fire main gun, screen wraps. `ESC` pauses. `Enter`/`Space` start.

### Survivability — HP + shield
- Ship has **HP**, starts at **3**. A hit costs 1 HP + ~1.5s invuln blink.
- Run ends at 0 HP (single roguelite run; score = how far you got).
- **Shield** upgrade adds a regenerating buffer absorbed before HP; recharges after
  a few seconds without taking damage.

### Structure — endless escalating waves
- Discrete waves; each adds more/faster/tougher enemies.
- **Boss every 5th wave** (5, 10, 15…).
- No win condition — survive as long as possible.

### Enemy palette
| Enemy | Behavior | Notes |
|---|---|---|
| Asteroid | Drifts; splits big→med→small | As in classic |
| Hunter | Small dart, slowly homes toward ship | No split; 1–2 hits |
| Sentry | UFO that periodically fires a slow aimed bolt | Sparse |
| Boss | Large armored hulk, high HP, sheds debris | Waves 5,10,… |

### Upgrade pool (shared; most stackable VS-style, with sane caps)
- **Offense:** Rapid Fire (−cooldown), Spread (+projectile), Heavy Rounds (+damage),
  Long Shot (+range/speed), Piercing (pass through one enemy).
- **Defense:** Shield (regenerating buffer), Hull (+1 max HP), Thrusters (+turn & accel),
  Inertia Dampers (less drift).
- **Auto-weapons (VS flavor):** Orbital (shard circling ship; stacks), Drone (auto-firing
  helper), Nova (periodic shockwave), Magnet (XP pickup radius).

### Retro / spacy look
Neon-vector aesthetic retained. Add a subtle CRT scanline overlay, chunky monospace
UI, upgrade cards styled as glowing retro terminal panels. Particles retained.

## 4. Auto Level-Up variant specifics

- Destroyed enemies drop **XP gems**; flying over them collects XP (Magnet upgrade
  widens pickup radius).
- Filling the XP bar **freezes the game** and shows **3 random upgrade cards**; pick one,
  resume. XP-to-next-level grows each level.
- HUD adds an XP bar + level indicator alongside score and HP/shield.

## 5. Deferred (later sessions, same base)

- **Roguelite: Score Milestones** — crossing escalating score thresholds triggers the
  same 3-card pick; no gem layer.
- **Roguelite: Wave Shop** — clearing a wave opens a shop to spend kill-earned credits,
  then continue.

## 6. Internal structure note

`roguelite-levelup.html` is one self-contained file but organized into clear sections:
input, entities (ship/asteroid/hunter/sentry/boss/gem/particle), spawning/waves,
upgrades (pool + apply), collision, render, HUD/overlays, loop. Shared logic is kept
factored so the two deferred variants can reuse it with a swapped progression module.

## 7. Future level/mode ideas (backlog — not yet built)

Each would be a new file in `levels/` + a `levels.js` entry.

- **Gravity Well** — a central sun/black-hole pulls the ship and asteroids; orbital-
  mechanics arcade twist on the Classic engine. _(Top pick — novel, medium effort.)_
- **Boss Rush** — back-to-back bosses with an upgrade pick between each; reuses the
  roguelite engine. _(Cheap, satisfying.)_
- **Horde / Survival** — Vampire-Survivors style: auto-fire on by default, no discrete
  waves, escalating swarm + a survival timer.
- **Twin-Stick** — mouse-aim + thrust, fire toward the cursor (new control scheme).
- **Last Stand / One-HP** — 1 HP, no shields, pure dodging sprint.
- **Color Match (Ikaruga-ish)** — tinted asteroids; switch bullet color to destroy
  matching ones (adds a puzzle layer).
- **Draft** — between waves, draft from a small hand of upgrades (deckbuilder flavor).
- **Daily Challenge** — seeded RNG so everyone's run for a given day is identical and
  scores are comparable (needs a seeded-RNG refactor).
