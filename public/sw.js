// Conservative service worker: it doesn't precache hashed build assets (those
// change every deploy), but it does precache "/" on install so the very
// first offline launch after installing the PWA still finds the app shell
// instead of a blank/error page. Everything else is cached at runtime.
//
// Two caches, so product photos and lookups can never evict the app shell:
//  - SHELL_CACHE: same-origin navigations, /_next/static/ chunks, and the
//    Google Fonts stylesheet + font files — unbounded, nothing here goes
//    through putWithLimit.
//  - DATA_CACHE: cross-origin product photos and same-origin API lookups —
//    FIFO-capped so it can't grow without bound.

const SW_VERSION = "v3";
const SHELL_CACHE = `peanot-shell-${SW_VERSION}`;
const DATA_CACHE = `peanot-data-${SW_VERSION}`;
const MAX_DATA_ENTRIES = 150;

const FONT_ORIGINS = new Set([
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
]);

// Cap the data cache so it can't grow without bound (product photos and
// lookups accumulate over time). Cache keys are returned in insertion order,
// so deleting from the front evicts the oldest entries first.
async function putWithLimit(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_DATA_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}

// Precache the app shell document so a PWA installed and then opened offline
// — before ever completing a second online visit — still has something to
// show instead of offlineFallback().
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        await cache.add("/");
      } catch {
        // Install itself ran offline, or "/" briefly failed — runtime
        // caching in the fetch handler still covers the next online visit.
      }
    })(),
  );
});

// No unconditional skipWaiting: the first install (no existing controller)
// activates on its own, while an update stays "waiting" until the page asks to
// take it over via the SKIP_WAITING message below. That lets the UI prompt the
// user before swapping to new assets.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, DATA_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
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

  if (url.origin !== self.location.origin) {
    // Fonts belong with the app shell — losing them breaks legibility app-wide,
    // not just one photo — so they're protected like the shell instead of
    // sharing the evictable data cache with product photos.
    if (FONT_ORIGINS.has(url.origin)) {
      event.respondWith(cacheFirst(request, SHELL_CACHE, false));
    } else {
      event.respondWith(cacheFirst(request, DATA_CACHE, true));
    }
    return;
  }

  // Navigations and hashed chunks are the app shell: never evicted by media.
  if (request.mode === "navigate" || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(request, SHELL_CACHE, false, false));
    return;
  }

  // Same-origin API lookups (and anything else same-origin): FIFO-capped
  // data cache. Product lookups additionally get a cache-honesty stamp so an
  // offline hit never looks like a fresh check (see useProductLookup.ts).
  const isProductLookup = url.pathname.startsWith("/api/product/");
  event.respondWith(networkFirst(request, DATA_CACHE, true, isProductLookup));
});

async function cacheFirst(request, cacheName, limited) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(cacheName);
      if (limited) await putWithLimit(cache, request, res.clone());
      else await cache.put(request, res.clone());
    }
    return res;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(request, cacheName, limited, stampHonesty) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    // A transient OFF failure (app/api/product/[barcode]/route.ts) is marked
    // so it's never cached: caching it would later offline-serve a "could
    // not be checked" answer instead of a better one already cached for the
    // same barcode, and waste a cache slot doing it.
    const transient = res.headers.get("X-Peanot-Transient") === "1";
    if (res && res.ok && !transient) {
      const toStore = stampHonesty ? await withCachedAt(res.clone()) : res.clone();
      if (limited) await putWithLimit(cache, request, toStore);
      else await cache.put(request, toStore);
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return stampHonesty ? await withCacheHit(cached) : cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("/");
      if (shell) return shell;
      return offlineFallback();
    }
    return Response.error();
  }
}

// Stamp a freshly-fetched response with when it was cached, so a later
// offline hit can say how old the answer is instead of implying a live check.
async function withCachedAt(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Peanot-Cached-At", new Date().toISOString());
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Mark a served cache hit as such (on top of the X-Peanot-Cached-At stamp
// already on the stored response), so the UI never shows a cached lookup as
// a fresh one. Display-only — it never changes the verdict inside the body.
async function withCacheHit(cached) {
  const headers = new Headers(cached.headers);
  headers.set("X-Peanot-Cache", "1");
  const body = await cached.blob();
  return new Response(body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

// Last-resort page shown when a navigation fails offline and the app shell was
// never cached (e.g. install itself happened offline).
function offlineFallback() {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>peaNOT – offline</title>
<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;
background:#f3ead8;color:#16140f;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:22px;margin:0 0 8px}p{opacity:.7;line-height:1.5;max-width:32ch}</style>
</head><body><div><h1>Offline</h1><p>peaNOT ist gerade nicht erreichbar. Bitte stelle eine
Verbindung her und versuche es erneut.</p></div></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
