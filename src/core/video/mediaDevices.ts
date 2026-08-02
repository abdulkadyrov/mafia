import type { MediaDeviceChoice } from "./videoTypes";

export type DeviceInventory = {
  cameras: MediaDeviceChoice[];
  microphones: MediaDeviceChoice[];
  speakers: MediaDeviceChoice[];
};

export function mediaDevicesSupported(): boolean {
  return "mediaDevices" in navigator && "RTCPeerConnection" in window;
}

export async function listMediaDevices(): Promise<DeviceInventory> {
  if (!mediaDevicesSupported()) throw new Error("Этот браузер не поддерживает видеосвязь");
  const devices = await navigator.mediaDevices.enumerateDevices();
  const map = (kind: MediaDeviceKind): MediaDeviceChoice[] => devices
    .filter((device) => device.kind === kind)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `${fallbackLabel(kind)} ${index + 1}`,
      kind: device.kind,
    }));
  return {
    cameras: map("videoinput"),
    microphones: map("audioinput"),
    speakers: map("audiooutput"),
  };
}

export async function requestMedia(input: {
  camera: boolean;
  microphone: boolean;
  cameraDeviceId?: string;
  microphoneDeviceId?: string;
}): Promise<MediaStream> {
  if (!mediaDevicesSupported()) throw new Error("Видеосвязь не поддерживается этим браузером");
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: input.camera
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user", ...(input.cameraDeviceId ? { deviceId: { exact: input.cameraDeviceId } } : {}) }
        : false,
      audio: input.microphone
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(input.microphoneDeviceId ? { deviceId: { exact: input.microphoneDeviceId } } : {}) }
        : false,
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError") throw new Error("Разрешите доступ к камере и микрофону в настройках браузера");
    if (name === "NotFoundError") throw new Error("Камера или микрофон не найдены");
    if (name === "NotReadableError") throw new Error("Камера или микрофон уже используются другим приложением");
    throw new Error("Не удалось включить камеру или микрофон");
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function fallbackLabel(kind: MediaDeviceKind): string {
  if (kind === "videoinput") return "Камера";
  if (kind === "audioinput") return "Микрофон";
  return "Динамик";
}
