const CACHE_NAME = 'jeu-v2'; // <-- Passer de v1 à v2
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './data.json',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
