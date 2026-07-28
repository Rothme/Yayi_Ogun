// Minimal service worker for the client-insights PWA.
// Deliberately caches ONLY static assets (icons, manifest) — never HTML or
// the /qr-stats API — so the dashboard always shows live data and never a
// stale cached page.

const CACHE_NAME = "ad-insights-static-v1";
const STATIC_ASSETS = [
  "/client-insights/manifest.json",
  "/client-insights/icon-192.png",
  "/client-insights/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
  // Everything else (HTML, /qr-stats, login) always goes to the network.
});
