const CACHE_NAME = 'health-tracker-v201';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/app.js',
  '/js/state.js',
  '/js/db.js',
  '/js/workout.js',
  '/js/programs.js',
  '/js/goals.js',
  '/js/measurements.js',
  '/js/learn.js',
  '/js/utils.js',
  '/js/ui.js',
  '/js/filters.js',
  '/js/validation.js',
  '/js/charts.js',
  '/manifest.json',
  '/data/articles.json',
  '/data/exercises.json',
  '/data/glossary.json',
  '/data/resources.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
