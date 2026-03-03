/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;
declare const __BUILD_ID__: string;

// Cache version is injected at build time from vite.config.ts so every new
// deploy gets a fresh cache name and stale assets are evicted automatically.
const CACHE_VERSION = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'v1';
const CACHE_NAMES = {
  STATIC: `${CACHE_VERSION}-static`,
  DYNAMIC: `${CACHE_VERSION}-dynamic`,
};

// Files to cache on install (critical assets)
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
];

// Install: Cache critical static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      await cache.addAll(STATIC_CACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

// Activate: Clean up old cache versions
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !Object.values(CACHE_NAMES).includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: Network-first for dynamic content, cache-first for static assets
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const { url } = request;

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cache for certain URLs
  if (url.includes('/api/') || url.includes('/admin/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Asset files: Cache-first strategy
  if (url.includes('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAMES.STATIC);
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return new Response('Asset not found', { status: 404 });
        }
      })()
    );
    return;
  }

  // HTML/API: Network-first strategy
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAMES.DYNAMIC);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        return new Response('Offline - content not available', { status: 503 });
      }
    })()
  );
});
