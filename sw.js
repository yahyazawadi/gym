const CACHE_NAME = 'iron-log-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './colors.css',
  './app.js',
  './manifest.json',
  './dumbbell.svg',
  './exercises_dataset.json'
];

// Install: Cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge old cache iterations
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for static local assets, Network-first for Cloudflare API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If calling Cloudflare Worker API: Network-first
  if (url.origin.includes('workers.dev')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'OFFLINE_MODE' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Static files: Cache-first fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === 'GET' &&
          !url.protocol.startsWith('chrome-extension')
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
