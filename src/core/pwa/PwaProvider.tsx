import React from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = React.useState<InstallPromptEvent | null>(null);
  const [updateWorker, setUpdateWorker] = React.useState<ServiceWorker | null>(null);
  const [online, setOnline] = React.useState(() => navigator.onLine);

  React.useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleUpdate = (event: Event) => setUpdateWorker((event as CustomEvent<ServiceWorker>).detail);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", handleInstall);
    window.addEventListener("mafia-pwa-update", handleUpdate);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstall);
      window.removeEventListener("mafia-pwa-update", handleUpdate);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function update() {
    updateWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <>
      {children}
      <div className="mafia-pwa-notices" aria-live="polite">
        {!online ? <div className="mafia-network-notice"><span>Нет сети</span><p>Открытые экраны доступны, игровые команды снова заработают после подключения.</p></div> : null}
        {updateWorker ? <div className="mafia-update-notice"><span>Доступно обновление</span><button onClick={update}>Обновить</button></div> : null}
        {installPrompt ? <div className="mafia-install-notice"><span>Установить Mafia на устройство?</span><button onClick={() => void install()}>Установить</button><button aria-label="Скрыть" onClick={() => setInstallPrompt(null)}>×</button></div> : null}
      </div>
    </>
  );
}
