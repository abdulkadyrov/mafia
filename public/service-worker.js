const VERSION = "mafia-production-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const APP_SHELL = ["./", "./index.html", "./offline.html", "./manifest.json", "./icons/mafia-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivateRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) event.respondWith(cacheFirst(request));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("./index.html", response.clone());
    }
    return response;
  } catch {
    return (await caches.match("./index.html")) ?? (await caches.match("./offline.html"));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (!response.ok || response.type === "opaque") return response;
  const cache = await caches.open(STATIC_CACHE);
  await cache.put(request, response.clone());
  return response;
}

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|png|svg|webp|avif|mp3|wav)$/i.test(url.pathname) || url.pathname.includes("/assets/");
}

function isPrivateRequest(url) {
  return ["/auth/v1/", "/rest/v1/", "/realtime/v1/", "/functions/v1/"].some((segment) => url.pathname.includes(segment));
}
