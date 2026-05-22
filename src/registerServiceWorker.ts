export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const baseUrl = import.meta.env.BASE_URL

    navigator.serviceWorker
      .register(`${baseUrl}service-worker.js`)
      .then(() => console.log('Service Worker registered'))
      .catch((err) => console.warn('SW registration failed', err))
  }
}
