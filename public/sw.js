const CACHE_VERSION = "video-player-pwa-v1";
const APP_CACHE = `${CACHE_VERSION}-app`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
];

const isSameOrigin = (url) => url.origin === self.location.origin;

const shouldBypass = (request, url) => {
  if (request.method !== "GET") return true;
  if (!isSameOrigin(url)) return true;
  if (url.pathname.startsWith("/video")) return true;
  if (url.pathname.startsWith("/caption")) return true;
  return false;
};

const fetchWithCacheFallback = async (request, cacheName) => {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    if (["font", "image", "script", "style"].includes(request.destination)) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    }
    return;
  }

  if (shouldBypass(request, url)) {
    return;
  }

  if (url.pathname === "/api/videos" || url.pathname === "/api/config") {
    event.respondWith(fetchWithCacheFallback(request, DATA_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_CACHE);
        return cache.match("/") || cache.match("/index.html");
      })
    );
    return;
  }

  event.respondWith(fetchWithCacheFallback(request, APP_CACHE));
});
