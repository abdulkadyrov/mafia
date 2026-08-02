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
        <span>{microphoneEnabled ? "●" : "○"}</span> Микрофон
      </button>
      <button className={cameraEnabled ? "active" : ""} disabled={!joined} onClick={() => void (cameraEnabled ? provider.disableCamera() : provider.enableCamera())}>
        <span>{cameraEnabled ? "●" : "○"}</span> Камера
      </button>
      <button onClick={onSettings}>⚙ Устройства</button>
    </div>
  );
}
