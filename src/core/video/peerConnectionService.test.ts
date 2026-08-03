import { afterEach, describe, expect, it, vi } from "vitest";
import { createPeerConnection, syncLocalTracks, waitForIceGatheringComplete } from "./peerConnectionService";

describe("WebRTC ICE gathering", () => {
  it("waits until local candidates are embedded in the session description", async () => {
    const target = new EventTarget() as EventTarget & { iceGatheringState: RTCIceGatheringState };
    target.iceGatheringState = "gathering";
    const waiting = waitForIceGatheringComplete(target as unknown as RTCPeerConnection, 1_000);
    target.iceGatheringState = "complete";
    target.dispatchEvent(new Event("icegatheringstatechange"));
    await expect(waiting).resolves.toBeUndefined();
  });
});

describe("WebRTC media negotiation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("advertises audio and video even when the player joins before enabling devices", () => {
    const addTransceiver = vi.fn();
    class PeerConnectionMock {
      addTransceiver = addTransceiver;
    }
    vi.stubGlobal("RTCPeerConnection", PeerConnectionMock);

    createPeerConnection({
      localStream: null,
      onIceCandidate: vi.fn(),
      onTrack: vi.fn(),
      onStateChange: vi.fn(),
      onNegotiationNeeded: vi.fn(),
    });

    expect(addTransceiver).toHaveBeenCalledTimes(2);
    expect(addTransceiver).toHaveBeenNthCalledWith(1, "audio", { direction: "recvonly" });
    expect(addTransceiver).toHaveBeenNthCalledWith(2, "video", { direction: "recvonly" });
  });

  it("changes receiving transceivers to sending when camera and microphone are enabled", () => {
    const audioTrack = { id: "audio-1", kind: "audio" } as MediaStreamTrack;
    const videoTrack = { id: "video-1", kind: "video" } as MediaStreamTrack;
    const audioReplace = vi.fn().mockResolvedValue(undefined);
    const videoReplace = vi.fn().mockResolvedValue(undefined);
    const audio = transceiver("audio", audioReplace);
    const video = transceiver("video", videoReplace);
    const peer = { getTransceivers: () => [audio, video] } as unknown as RTCPeerConnection;
    const stream = { getTracks: () => [audioTrack, videoTrack] } as unknown as MediaStream;

    syncLocalTracks(peer, stream);

    expect(audio.direction).toBe("sendrecv");
    expect(video.direction).toBe("sendrecv");
    expect(audioReplace).toHaveBeenCalledWith(audioTrack);
    expect(videoReplace).toHaveBeenCalledWith(videoTrack);
  });
});

function transceiver(kind: "audio" | "video", replaceTrack: ReturnType<typeof vi.fn>) {
  return {
    direction: "recvonly" as RTCRtpTransceiverDirection,
    receiver: { track: { kind } },
    sender: { track: null, replaceTrack },
  };
}
