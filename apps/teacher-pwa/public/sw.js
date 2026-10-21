/*
 * Kora Teacher service worker (U8): lets the app open without a connection.
 * Pages are fetched from the network first and the last good copy is kept
 * for offline use; built assets are served from cache. API calls are never
 * cached; attendance made offline is queued by the app and sent later.
 */
const VERSION = "v1";
const PAGES = `kora-pages-${VERSION}`;
const ASSETS = `kora-assets-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PAGES && k !== ASSETS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The login page asks for this, so a signed-out phone keeps no class lists.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  /\.(?:png|ico|svg|woff2?)$/.test(url.pathname) ||
  url.pathname === "/manifest.json";

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only real pages, not redirects to the login page.
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request, { ignoreSearch: false })) ||
            (await caches.match("/"));
          return (
            cached ||
            new Response(
              "<!doctype html><meta name=viewport content='width=device-width'><body style='font-family:sans-serif;padding:2rem;text-align:center'><h1>You're offline</h1><p>Open Kora once while online, and it will work offline after that.</p></body>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } },
            )
          );
        }),
    );
  }
});
