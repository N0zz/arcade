// Service worker — makes the game installable + playable offline.
// Network-first (so updates show up when online), falling back to cache when offline.
const CACHE = 'asteroids-v1';
const ASSETS = [
  './', './index.html', './levels.js', './favicon.svg', './manifest.json',
  '../../game-kit.js', '../../game-kit.css',
  './levels/classic.html', './levels/classic-enhanced.html',
  './levels/roguelite-levelup.html', './levels/roguelite-milestones.html', './levels/roguelite-shop.html',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
