// Service worker — installable + offline. Network-first (updates when online, cache fallback offline).
const CACHE = 'asteroids-plus-v1';
const ASSETS = [
  './', './index.html', './favicon.svg', './manifest.json',
  '../../game-kit.js', '../../game-kit.css','../../version.js', './icon-192.png','./icon-512.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(resp => { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return resp; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
