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
}): RTCPeerConnection {
  const peer = new RTCPeerConnection({
    iceServers: defaultIceServers,
    iceCandidatePoolSize: 4,
  });
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
  const currentSenders = peer.getSenders();
  const desiredTracks = stream?.getTracks() ?? [];
  for (const sender of currentSenders) {
    if (sender.track && !desiredTracks.some((track) => track.id === sender.track?.id)) {
      void sender.replaceTrack(null);
    }
  }
  for (const track of desiredTracks) {
    const sameKind = currentSenders.find((sender) => sender.track?.kind === track.kind)
      ?? peer.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === track.kind)?.sender;
    if (sameKind) void sameKind.replaceTrack(track);
    else peer.addTrack(track, stream!);
  }
}

export function closePeer(peer: RTCPeerConnection): void {
  peer.onicecandidate = null;
  peer.ontrack = null;
  peer.onconnectionstatechange = null;
  peer.onnegotiationneeded = null;
  peer.close();
}
