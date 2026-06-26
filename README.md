# Arcade

<p align="center">
  <a href="https://n0zz.github.io/arcade/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20%20OPEN%20ARCADE-1f6feb?style=for-the-badge" alt="Open the arcade" height="64">
  </a>
</p>

<p align="center">
  <a href="https://github.com/sponsors/N0zz"><img src="https://img.shields.io/badge/%E2%99%A5%20Sponsor-ff5d8f?style=for-the-badge" alt="Sponsor"></a>
  <a href="https://buymeacoffee.com/n0zz"><img src="https://img.shields.io/badge/%E2%98%95%20Buy%20me%20a%20coffee-ffce5c?style=for-the-badge&logoColor=000" alt="Buy me a coffee"></a>
</p>

<p align="center"><b>▶ Play in your browser: <a href="https://n0zz.github.io/arcade/">n0zz.github.io/arcade</a></b></p>

---

A little **neal.fun-style catalogue** of self-contained browser games. Each game is its
own folder of static HTML/Canvas + vanilla JS — no build step, no dependencies, no
external assets — and gets a tile on the home page plus a **‹ Arcade** link back.

## Games

| Game | Folder | About |
| --- | --- | --- |
| **Asteroids** | `games/asteroids/` | Fly/shoot/survive — classic arcade + roguelite modes, speedruns, mobile controls |
| **Keep Defender** | `games/tower-defense/` | Fixed-path tower defense — towers, gold, mage/fast-forward/boss telegraph (Castle & Parchment theme) |
| **Stack** | `games/stacker/` | One-tap tower stacker — slice the overhang, chain perfect drops (pastel-clean theme) |
| **Neon Snake** | `games/snake/` | Grid snake in glowing neon — arrows/WASD/swipe, deadly walls |
| **Meadow Flyer** | `games/flappy/` | One-tap flyer through a soft storybook meadow |
| **Brick Breaker** | `games/breakout/` | Paddle/ball/bricks with power-ups and level progression (synthwave neon) |
| **Range** | `games/aim-trainer/` | Timed flick-aim target practice with accuracy + combo (tactical theme) |
| **Bubble Pop** | `games/bubbles/` | Puzzle-Bobble bubble shooter — match 3+, Arcade/Endless/Zen + special shots |

More on the way (Invaders, Road Hop, Icy Tower, Trap the Cat, Pulse Dash, …).

## Install on your phone (PWA)

The arcade is a Progressive Web App — install it to play **fullscreen & offline**, no
app store:

- **Android (Chrome):** tap the **📱 Install** button on the home page, or menu **⋮ → “Add to Home screen”**.
- **iPhone (Safari):** **Share** → **“Add to Home Screen”**.
- **Desktop (Chrome/Edge):** the **Install** button, or the install icon in the address bar.

Each game also works offline once you've opened it.

## Add a game

1. Create `games/<slug>/index.html` — self-contained, with a `‹ Arcade` link to `../../`.
2. Add one entry to **`games.js`** (`slug`, `title`, `blurb`, `icon`, `accent`, `tag`).
3. (Optional) add it to `sw.js` `SHELL` if it must be cached for first-run offline.

## Testing

```bash
node test.mjs                 # arcade: catalogue wiring + Keep Defender logic
node games/asteroids/test.mjs # the asteroids game's own suite
```

Dependency-free headless harnesses (mock the DOM/canvas, drive each game via a
`window.__test` hook). Keep them green.

## Layout

```text
index.html        catalogue (tiles from games.js) + PWA install
games.js          catalogue manifest
favicon.svg       arcade icon
manifest.json     PWA manifest      sw.js   service worker (offline)
.nojekyll         serve files as-is on GitHub Pages
test.mjs          arcade test harness
games/<slug>/     each game, standalone
```

> History note: `games/asteroids/` was imported with `git subtree` so its full
> commit history is preserved — view per-game history on GitHub via the folder's
> **History** view (`/commits/main/games/asteroids`).
