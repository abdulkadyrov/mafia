export type VideoConnectionState =
  | "idle"
  | "requesting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

export type MediaDeviceChoice = {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
};

export type VideoParticipant = {
  userId: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  isSpeaking: boolean;
  audioAllowed: boolean;
};

export type VideoSignal = {
  id: number;
  room_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  signal_type: "offer" | "answer" | "ice" | "renegotiate" | "leave";
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, never>;
  created_at: string;
};

export interface VideoProvider {
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(): Promise<void>;
  enableCamera(): Promise<void>;
  disableCamera(): Promise<void>;
  enableMicrophone(): Promise<void>;
  disableMicrophone(): Promise<void>;
  selectCameraDevice(deviceId: string): Promise<void>;
  selectMicrophoneDevice(deviceId: string): Promise<void>;
  selectOutputDevice(deviceId: string): Promise<void>;
  setPlayerAudioPermission(playerId: string, allowed: boolean): Promise<void>;
}
