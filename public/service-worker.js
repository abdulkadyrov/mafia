const CACHE_NAME = 'mafia-shell-v4'
const APP_SHELL = ['.', 'index.html', 'manifest.json', 'icon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? undefined : caches.delete(key)))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseCopy = networkResponse.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put('index.html', responseCopy)
          })

          return networkResponse
        })
        .catch(() => caches.match('index.html'))
    )

    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(event.request)
        .then((networkResponse) => {
          const responseCopy = networkResponse.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy)
          })

          return networkResponse
        })
        .catch(() => caches.match('index.html'))
    })
  )
})
