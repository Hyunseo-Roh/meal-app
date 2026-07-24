// Offline cold-boot worker (minimal tier). It caches NOTHING of the app bundle
// on purpose: every screen's content comes from Supabase, so a bundle booted
// offline would be an all-error shell — worse than one honest holding page. So
// the only cached thing is offline.html, shown only when a navigation fails.
//
// Navigations are NETWORK-FIRST: online always wins, so a new deploy lands on
// the next load (index.html + the content-hashed bundle come straight from the
// network, never from cache). Non-navigation requests (the bundle, fonts,
// Supabase) are not touched at all. VERSION is stamped per deploy at build time
// (scripts/inject-sw-version.mjs) so every deploy is a byte-different sw.js —
// the browser then installs the new worker, which skipWaiting + claims and
// purges the old cache, refreshing offline.html.
const VERSION = '__BUILD_STAMP__';
const CACHE = `sate-offline-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add('/offline.html');
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  // Only top-level navigations. Everything else goes to the network untouched.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cache = await caches.open(CACHE);
        const offline = await cache.match('/offline.html');
        return offline ?? Response.error();
      }
    })(),
  );
});
