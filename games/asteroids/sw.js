// asteroids — installable PWA + offline via the shared sw-core (stale-while-revalidate, versioned cache).
self.SCOPE = 'asteroids';
self.VERSION = 'dev'; // stamped with the commit SHA at deploy
self.SHELL = ['./','./index.html','./manifest.json','./favicon.svg','./icon-192.png','./icon-512.png','../../analytics.js','../../game-kit.js','../../game-kit.css','../../version.js','../../challenges.js'];
importScripts('../../sw-core.js');
