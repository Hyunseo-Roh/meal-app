// TOMBSTONE service worker — the kill switch, shipped BEFORE any real worker.
//
// It caches nothing. Any browser that fetches this (an update check, or a first
// registration) installs it, and on activate it wipes every cache, unregisters
// itself, and reloads open pages into a normal, worker-free, network-served
// state. Reverting the real worker to this content is how we remove a worker
// that's already installed in the wild — deleting the file would not (the SPA
// rewrite would serve index.html for /sw.js, the update would fail, and the old
// worker would linger). Served with Cache-Control: no-cache (see vercel.json).
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});
