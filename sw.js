/* MAQW service worker: оболочка приложения работает офлайн, обновляется сама */
const VER = "maqw-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Данные Firebase (чаты, вход) — всегда напрямую, без кэша
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseio.com") ||
      url.hostname.endsWith("firebaseapp.com") || url.hostname.endsWith("firebasestorage.app")) return;

  // Страница: сначала сеть (чтобы видеть обновления), если нет сети — кэш
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(VER).then(c => c.put("./index.html", copy));
        return r;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Свои файлы и скрипты Firebase SDK (gstatic): из кэша + тихое обновление
  if (url.origin === location.origin || url.hostname === "www.gstatic.com") {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(r => {
          if (r && (r.ok || r.type === "opaque")) {
            const copy = r.clone();
            caches.open(VER).then(c => c.put(req, copy));
          }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});

// Тап по уведомлению открывает/фокусирует приложение
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
