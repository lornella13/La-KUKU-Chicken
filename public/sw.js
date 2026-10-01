// La Kuku Chicken — service worker
// Bump CACHE_VERSION whenever you want to force clients to pick up new assets.
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `lakuku-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lakuku-pages-${CACHE_VERSION}`;
const FONT_CACHE = `lakuku-fonts-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

// Minimal app-shell precache. Hashed build assets (JS/CSS from src/) are
// cached on first use instead, since their filenames change every build.
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/brand/logo.png',
  '/images/brand/logo-mark.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, PAGES_CACHE, FONT_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isGoogleFonts(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Page navigations: network-first, fall back to cache, then to offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Google Fonts: stale-while-revalidate.
  if (isGoogleFonts(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Same-origin static assets (hashed JS/CSS, images, icons): cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
  // Cross-origin, non-font requests (e.g. wa.me) are left to the network untouched.
});
