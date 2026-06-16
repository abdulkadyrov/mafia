export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    const baseUrl = import.meta.env.BASE_URL;
    let hasReloaded = false;

    navigator.serviceWorker
      .register(`${baseUrl}service-worker.js`)
      .then((registration) => {
        registration.update().catch(() => undefined);

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hasReloaded) {
            return;
          }

          hasReloaded = true;
          window.location.reload();
        });

        console.log("Service Worker registered");
      })
      .catch((err) => console.warn("SW registration failed", err));
  }
}
