// Minimal, conservative service worker: it never precaches hashed build assets
// (those change every deploy). Instead it caches at runtime so the app shell,
// fonts, product photos and previously-fetched lookups stay available offline.

const CACHE = "peanot-runtime-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Cross-origin (Google Fonts, OFF product images): cache-first — these are
  // immutable enough that serving a cached copy is a clear win offline.
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin (app shell, chunks, product lookups): network-first so the user
  // always gets fresh data online, with the cache as an offline fallback.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("/");
      if (shell) return shell;
    }
    return Response.error();
  }
}
