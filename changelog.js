// Player-facing changelog — newest first. Single source of truth for BOTH the in-page
// 🗒️ Changelog modal (index.html) AND the Discord changelog post: the GitHub Action posts
// only the entries ADDED in a push (diff vs the previous commit), so Discord == this file.
// One release per date: { date:'YYYY-MM-DD', title:'…', items:['New: …','Fix: …'] }.
// Keep bullets plain-language and about what a PLAYER notices — never kit/test/build/refactor.
window.CHANGELOG = [
  { date: '2026-06-28', title: 'Challenges, score cards & more', items: [
    'New: Asteroids+ — the roguelite Asteroids (XP, upgrades, bosses, a wave shop) is now its own game. Plain Asteroids is the classic arcade one. Pick your mode right inside each game.',
    'New: Daily & Weekly Challenges — tap 🏆 for today’s challenge plus a bigger weekly one. Earn points (1 per daily, 5 per weekly) that only ever go up, with a History list of everything you’ve completed (up to a year, "Load more" to go back).',
    'New: Score cards — share a picture of your score from the end screen (📷), straight to your apps.',
    'New: Embed games on your own site or blog — an Embed button in each game’s sound menu, plus "Embed a game" in the main menu.',
    'New: a ⏸ pause button in every game (top-right, next to sound).',
    'New: Export / import your data — back it up or move it between devices, no account needed (in the menu under "Your data").',
    'New: a Compact tile view (button by the filters) so more games fit on screen, plus an FAQ and a Privacy policy in the menu.',
    'Fix: games now re-fit correctly when you rotate your phone between portrait and landscape — Stack stays centered, Brick Breaker keeps room to react, Bubble Pop sticks to portrait on phones, Tower Defense’s menu and keep fit the screen, Asteroids’ end screen fits in landscape.',
    'Fix: the Filter panel now fits the screen on phones in landscape — it no longer runs off the edge, and the genre list scrolls.',
    'Fix: Range’s "race to 100" progress bar now tracks targets hit, not points.',
    'Fix: Keep Defender — the upgrade button is greyed out until you can afford it, then pops in.',
  ] },
  { date: '2026-06-27', title: 'We are now Komyo Games', items: [
    'New name & logo: funyo is now Komyo Games — same games, fresh fox mascot.',
    'New: your score auto-posts to our Discord on game-over — now with the game mode + stats (accuracy, level, wave…). Set a display name in the menu, or stay anonymous.',
  ] },
  { date: '2026-06-27', title: 'Home redesign & polish', items: [
    'New: redesigned home page — slide-out menu, instant search and genre filters (your filters now save in the link, so you can bookmark them).',
    'New: NEW and UPDATED badges on game tiles, so fresh and recently-improved games are easy to spot.',
    'New: “Reset all data” to clear your scores, progress and favorites across every game.',
    'New: this changelog 🙂',
    'Fix: Brick Breaker ran too fast on some phones — speed is now consistent everywhere.',
    'Fix: Range “Sprint” is now a proper race to 100 targets.',
  ] },
  { date: '2026-06-26', title: 'First games launch', items: [
    'Added 8 games: Asteroids, Keep Defender, Bubble Pop, Brick Breaker, Stack, Meadow Flyer, Range and Neon Snake.',
  ] },
];
