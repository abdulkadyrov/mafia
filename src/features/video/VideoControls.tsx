import type { VideoProvider } from "../../core/video/videoTypes";

export function VideoControls({
  provider,
  cameraEnabled,
  microphoneEnabled,
  microphoneAllowed,
  joined,
  onSettings,
}: {
  provider: VideoProvider;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  microphoneAllowed: boolean;
  joined: boolean;
  onSettings: () => void;
}) {
  return (
    <div className="mafia-video-controls">
      <button className={microphoneEnabled ? "active" : ""} disabled={!joined || !microphoneAllowed} onClick={() => void (microphoneEnabled ? provider.disableMicrophone() : provider.enableMicrophone())}>
        <span>{microphoneEnabled ? "●" : "○"}</span>
        <span className="mafia-action-label--desktop">Микрофон</span>
        <span className="mafia-action-label--mobile">Мик</span>
      </button>
      <button className={cameraEnabled ? "active" : ""} disabled={!joined} onClick={() => void (cameraEnabled ? provider.disableCamera() : provider.enableCamera())}>
        <span>{cameraEnabled ? "●" : "○"}</span>
        <span className="mafia-action-label--desktop">Камера</span>
        <span className="mafia-action-label--mobile">Кам</span>
      </button>
      <button onClick={onSettings} aria-label="Настройки устройств">
        <span>⚙</span>
        <span className="mafia-action-label--desktop">Устройства</span>
        <span className="mafia-action-label--mobile">Устр.</span>
      </button>
    </div>
  );
}
