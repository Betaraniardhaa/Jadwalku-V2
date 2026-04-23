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

// ── Install — cache semua file statis ──────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error("Cache gagal:", err))
  );
});

// ── Activate — hapus cache lama ────────────────────────────────
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

// ── Fetch — cache-first lokal, network-first eksternal ─────────
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).catch(() => caches.match(`${BASE_URL}offline.html`));
      })
    );
  } else {
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

// ── Background Sync — kirim ulang data saat kembali online ─────
self.addEventListener("sync", event => {
  if (event.tag === "jadwalku-sync-pending") {
    event.waitUntil(kirimDataTertunda());
  }
});

async function kirimDataTertunda() {
  try {
    const db = await bukaIDB();
    const tx = db.transaction("pending", "readwrite");
    const store = tx.objectStore("pending");
    const semua = await idbGetAll(store);

    for (const item of semua) {
      try {
        await fetch(item.url, {
          method: item.method || "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        });
        await idbDelete(store, item.id);
      } catch (_) {
        // Biarkan tetap di antrian, coba lagi nanti
      }
    }
  } catch (err) {
    console.error("Background sync gagal:", err);
  }
}

// ── Periodic Sync — refresh data jadwal secara berkala ─────────
self.addEventListener("periodicsync", event => {
  if (event.tag === "jadwalku-refresh") {
    event.waitUntil(refreshDataJadwal());
  }
});

async function refreshDataJadwal() {
  try {
    // Beri tahu semua tab bahwa ada pembaruan tersedia
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(client => client.postMessage({ type: "PERIODIC_SYNC", tag: "jadwalku-refresh" }));
  } catch (err) {
    console.error("Periodic sync gagal:", err);
  }
}

// ── Push Notifications ─────────────────────────────────────────
self.addEventListener("push", event => {
  let data = {
    title: "Jadwalku",
    body: "Ada pengingat baru untukmu!",
    icon: `${BASE_URL}icons/icon-192.png`,
    badge: `${BASE_URL}icons/icon-192.png`,
    url: `${BASE_URL}index.html`,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: "jadwalku-notif",
      renotify: true,
      data: { url: data.url },
      actions: [
        { action: "buka", title: "Buka Jadwal" },
        { action: "tutup", title: "Tutup" },
      ],
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  if (event.action === "tutup") return;

  const targetUrl = event.notification.data?.url || `${BASE_URL}index.html`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url === targetUrl && "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── IndexedDB helper (tanpa library) ──────────────────────────
function bukaIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("jadwalku-idb", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pending")) {
        db.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function idbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}
