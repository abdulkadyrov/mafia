import { describe, expect, it } from "vitest";
import { waitForIceGatheringComplete } from "./peerConnectionService";

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
