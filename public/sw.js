// Minimal offline-capable service worker for the Voltway PWA.
// Network-first for navigations (always get fresh app shell when online),
// cache-first for same-origin static assets, offline fallback to the cached shell.
const CACHE = 'voltway-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never cache API traffic — always hit the network.
  if (url.pathname.startsWith('/emsp/')) return;

  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }),
      ),
    );
  }
});
