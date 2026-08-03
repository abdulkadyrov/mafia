import React from "react";
import type { DeviceInventory } from "../../core/video/mediaDevices";
import type { VideoProvider } from "../../core/video/videoTypes";

export function DeviceCheckModal({ open, onClose, provider, devices, joined, roomId, selectedCameraDeviceId, selectedMicrophoneDeviceId, selectedOutputDeviceId }: {
  open: boolean;
  onClose: () => void;
  provider: VideoProvider;
  devices: DeviceInventory;
  joined: boolean;
  roomId: string;
  selectedCameraDeviceId: string;
  selectedMicrophoneDeviceId: string;
  selectedOutputDeviceId: string;
}) {
  const [error, setError] = React.useState("");
  if (!open) return null;

  async function run(action: () => Promise<void>) {
    setError("");
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось применить устройство"); }
  }

  return (
    <div className="mafia-modal-backdrop mafia-device-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="mafia-modal mafia-device-modal" role="dialog" aria-modal="true" aria-labelledby="device-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="mafia-modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <span className="mafia-eyebrow">Перед игрой</span>
        <h2 id="device-title">Проверка камеры и микрофона</h2>
        <p>Браузер попросит разрешение. Вы сможете изменить устройства позднее.</p>
        <div className="mafia-device-list">
          <label><strong>Камера</strong><select value={selectedCameraDeviceId} onChange={(event) => void run(() => provider.selectCameraDevice(event.target.value))}><option value="">Системная камера</option>{devices.cameras.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label>
          <label><strong>Микрофон</strong><select value={selectedMicrophoneDeviceId} onChange={(event) => void run(() => provider.selectMicrophoneDevice(event.target.value))}><option value="">Системный микрофон</option>{devices.microphones.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label>
          <label><strong>Динамик</strong><select value={selectedOutputDeviceId} disabled={devices.speakers.length === 0} onChange={(event) => void run(() => provider.selectOutputDevice(event.target.value))}><option value="">Системный динамик</option>{devices.speakers.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select><span>{devices.speakers.length ? "Вывод звука применяется ко всем участникам" : "Выбор динамика не поддерживается браузером"}</span></label>
        </div>
        {error ? <div className="mafia-form-error" role="alert">{error}</div> : null}
        <div className="mafia-modal-actions">
          {!joined ? <button className="mafia-primary-button" onClick={() => void run(() => provider.joinRoom(roomId))}>Войти в видеокомнату</button> : null}
          <button className="mafia-secondary-button" disabled={!joined} onClick={() => void run(() => provider.enableCamera())}>Проверить камеру</button>
          <button className="mafia-secondary-button" disabled={!joined} onClick={() => void run(() => provider.enableMicrophone())}>Проверить микрофон</button>
        </div>
      </section>
    </div>
  );
}
