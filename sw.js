const CACHE_NAME = "chirurgie-tracker-pro-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./seed_data.json",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      try {
        if (req.method === "GET" && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
      } catch(e) {}
      return res;
    }).catch(() => cached))
  );
});
