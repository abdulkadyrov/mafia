export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    const baseUrl = import.meta.env.BASE_URL;
    let hasReloaded = false;

    navigator.serviceWorker
      .register(`${baseUrl}service-worker.js`)
      .then((registration) => {
        if (registration.waiting) notifyUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) notifyUpdate(worker);
          });
        });
        void registration.update().catch(() => undefined);

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hasReloaded) {
            return;
          }

          hasReloaded = true;
          window.location.reload();
        });
      })
      .catch((err) => console.warn("SW registration failed", err));
  }
}

function notifyUpdate(worker: ServiceWorker) {
  window.dispatchEvent(new CustomEvent("mafia-pwa-update", { detail: worker }));
}
