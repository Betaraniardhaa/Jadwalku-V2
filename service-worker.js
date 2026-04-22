const CACHE_NAME = "jadwalku-v2";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}assets/style.css`,
  `${BASE_URL}assets/app.js`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/icon-192.png`,
  `${BASE_URL}icons/icon-512.png`,
];

// Install — cache semua file statis
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error("Cache gagal:", err))
  );
});

// Activate — hapus cache lama
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Hapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch — cache-first untuk lokal, network-first untuk eksternal
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  if (url.origin === self.location.origin) {
    // File lokal: cache-first
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).catch(() => caches.match(`${BASE_URL}offline.html`));
      })
    );
  } else {
    // Eksternal (Google Fonts, dll): network-first
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
