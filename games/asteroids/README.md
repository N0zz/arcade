# Asteroids

<p align="center">
  <a href="https://n0zz.github.io/asteroids-game/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20%20PLAY%20NOW-1f6feb?style=for-the-badge&logoColor=white" alt="Play Asteroids now" height="64">
  </a>
</p>

<p align="center"><b>▶ Play in your browser: <a href="https://n0zz.github.io/asteroids-game/">n0zz.github.io/asteroids-game</a></b></p>

---

A self-contained, dependency-free Asteroids game with multiple evolving versions,
each playable from a launcher. Pure HTML5 Canvas + vanilla JS — no build step,
no external assets. Just open it in a browser.

## Play

Play online at **https://n0zz.github.io/asteroids-game/**, or run it locally: open
`index.html` in any modern browser (double-click, or `open index.html` on macOS).
Pick a version from the menu. Toggle **NORMAL / SPEEDRUN** at the top before launching.

> Tip: after clicking a version, click once on the game so it has keyboard focus.

**Audio** — procedural retro SFX + a generated background music loop (synthesized via
the Web Audio API, no sound files), including menu music. Toggle SFX/music and set
**separate SFX and music volumes** from the launcher's **AUDIO** bar or any game's
**pause** screen; settings persist.

### Controls

| Key | Action |
| --- | --- |
| `←` `→` or `A` `D` | Rotate ship |
| `↑` or `W` | Thrust (momentum; screen wraps) |
| `Space` | Shoot |
| `Esc` | Pause / resume |
| `Enter` / `Space` | Start / restart |
| Arrows or `WASD` + `Enter`/`Space`, or `1`–`9` | Navigate & pick/buy upgrades (roguelite picker & shop) |

WASD mirrors the arrow keys everywhere — both steering and menu navigation.

## Versions

| Family | Name | File | Idea |
| --- | --- | --- | --- |
| Classic | Classic Asteroids | `classic.html` | The original arcade game |
| Classic | Classic Asteroids — Enhanced | `classic-enhanced.html` | Pause, Enter/Space start, weapon tiers |
| Roguelite | Auto Level-Up | `roguelite-levelup.html` | Enemies drop XP gems → level up → pick 1 of 3 upgrades |
| Roguelite | Score Milestones | `roguelite-milestones.html` | Score thresholds trigger the upgrade picks |
| Roguelite | Wave Shop | `roguelite-shop.html` | Spend credits in a between-wave shop |

The three roguelite builds share one engine and differ only by a single
`PROGRESSION` constant (see [CLAUDE.md](CLAUDE.md)). The launcher menu is data-driven
from `levels.js`.

### Roguelite features

- HP + regenerating **Shield**, escalating **waves**, a **boss every 5th wave**.
- Enemies: asteroids (split), homing **hunters**, shooting **sentries**, and bosses.
- 13 stackable upgrades: Rapid Fire, Spread, Heavy Rounds, Long Shot, Piercing,
  Shield, Hull, Thrusters, Orbital Shard, Drone, Nova Pulse, Magnet, **Auto-Fire**
  (fires for you — no holding Space).
- **Map pickups** dropped by enemies: ✛ repair (heal), ◇ shield cell, ≫ frenzy
  (temp fire-rate burst), ✸ pulse (shockwave) — so HP can be recovered mid-run.
- Endless and escalating — enemy count and HP ramp with the wave, bosses get much
  tougher past wave 10. Your run ends on death (game-over screen with score & wave).

### Speedrun mode

Launch any version with the SPEEDRUN toggle (adds `?speedrun=1`). A timer runs while
you play (frozen during pause / upgrade screens). Goal: **2000 points** (Classic) or
**clear wave 5 — the first boss** (Roguelite).

### Scores & saves

All bests are stored in `localStorage` and shown on the menu cards:

- **Normal mode** — best **score** (plus best **wave** reached, for roguelite).
- **Speedrun** — best **time**.

Your best is recorded on game-over *and* if you **quit to the menu mid-run** (so an
overpowered run you simply exit still counts). A **RESET BEST SCORES** button on the
menu clears every version's saved bests.

## Project layout

```text
index.html                launcher (version select, mode toggle, audio + reset, menu music/stars)
levels.js                 the version manifest (single source of truth for the menu)
favicon.svg               themed neon-ship icon
.nojekyll                 tells GitHub Pages to serve files as-is (no Jekyll build)
levels/                   all playable game builds (each is one standalone .html)
  classic.html              ┐
  classic-enhanced.html     │
  roguelite-levelup.html    │ the roguelite base; the two below are generated from it
  roguelite-milestones.html │
  roguelite-shop.html       ┘
test.mjs                  headless test harness (Node) — runs every game's loop
DESIGN.md                 design spec / decisions
```

## Testing

```bash
node test.mjs
```

A headless harness mocks the DOM/canvas, runs each game's `requestAnimationFrame`
loop, simulates input, and asserts behavior (start/pause/death, waves & boss,
upgrades, keyboard nav, shop economy, speedrun win, launcher wiring). It needs no
browser or dependencies.
