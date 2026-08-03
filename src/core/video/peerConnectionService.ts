const turnUrls = (import.meta.env.VITE_MAFIA_TURN_URL ?? "").split(",").map((url: string) => url.trim()).filter(Boolean);

export const defaultIceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(turnUrls.length > 0 ? [{
    urls: turnUrls,
    username: import.meta.env.VITE_MAFIA_TURN_USERNAME || undefined,
    credential: import.meta.env.VITE_MAFIA_TURN_CREDENTIAL || undefined,
  }] : []),
];

export function createPeerConnection(input: {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onTrack: (stream: MediaStream) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  onNegotiationNeeded: () => void;
  localStream?: MediaStream | null;
}): RTCPeerConnection {
  const peer = new RTCPeerConnection({
    iceServers: defaultIceServers,
    iceCandidatePoolSize: 4,
  });
  addMediaTransceivers(peer, input.localStream ?? null);
  peer.onicecandidate = (event) => {
    if (event.candidate) input.onIceCandidate(event.candidate.toJSON());
  };
  peer.ontrack = (event) => {
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    input.onTrack(stream);
  };
  peer.onconnectionstatechange = () => input.onStateChange(peer.connectionState);
  peer.onnegotiationneeded = input.onNegotiationNeeded;
  return peer;
}

export async function waitForIceGatheringComplete(peer: RTCPeerConnection, timeoutMs = 3_000): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    peer.addEventListener("icegatheringstatechange", onStateChange);
  });
}

export function syncLocalTracks(peer: RTCPeerConnection, stream: MediaStream | null): void {
  const desiredTracks = new Map((stream?.getTracks() ?? []).map((track) => [track.kind, track]));
  for (const transceiver of peer.getTransceivers()) {
    const kind = transceiver.receiver.track.kind;
    if (kind !== "audio" && kind !== "video") continue;
    const track = desiredTracks.get(kind) ?? null;
    const nextDirection: RTCRtpTransceiverDirection = track ? "sendrecv" : "recvonly";
    if (transceiver.direction !== nextDirection) transceiver.direction = nextDirection;
    if (transceiver.sender.track?.id !== track?.id) void transceiver.sender.replaceTrack(track);
  }
}

function addMediaTransceivers(peer: RTCPeerConnection, stream: MediaStream | null): void {
  for (const kind of ["audio", "video"] as const) {
    const track = stream?.getTracks().find((candidate) => candidate.kind === kind);
    if (track && stream) peer.addTransceiver(track, { direction: "sendrecv", streams: [stream] });
    else peer.addTransceiver(kind, { direction: "recvonly" });
  }
}

export function closePeer(peer: RTCPeerConnection): void {
  peer.onicecandidate = null;
  peer.ontrack = null;
  peer.onconnectionstatechange = null;
  peer.onnegotiationneeded = null;
  peer.close();
}
