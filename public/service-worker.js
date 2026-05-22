const CACHE_NAME = 'mafia-shell-v1'
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icon.svg', '/src/styles/index.css']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        })
      )
    )
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          // optionally cache runtime
          return response
        })
        .catch(() => {
          // fallback to offline page or icon
          return caches.match('/index.html')
        })
    })
  )
})
