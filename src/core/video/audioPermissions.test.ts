import { describe, expect, it } from "vitest";
import { canPublishAudio, enforceAudioPermission } from "./audioPermissions";

describe("audio permissions", () => {
  it("mutes the dead and sleeping city while allowing mafia in its phase", () => {
    expect(canPublishAudio({ phase: "day_discussion", lifeStatus: "dead", team: "city", isHost: false, hostMuted: false })).toBe(false);
    expect(canPublishAudio({ phase: "night_mafia", lifeStatus: "alive", team: "city", isHost: false, hostMuted: false })).toBe(false);
    expect(canPublishAudio({ phase: "night_mafia", lifeStatus: "alive", team: "mafia", isHost: false, hostMuted: false })).toBe(true);
    expect(canPublishAudio({ phase: "night_doctor", lifeStatus: "alive", team: "mafia", isHost: false, hostMuted: false })).toBe(false);
  });

  it("lets an unmuted host speak and respects host moderation", () => {
    expect(canPublishAudio({ phase: "night_doctor", lifeStatus: "alive", team: "host", isHost: true, hostMuted: false })).toBe(true);
    expect(canPublishAudio({ phase: "day_discussion", lifeStatus: "alive", team: "city", isHost: false, hostMuted: true })).toBe(false);
  });

  it("enforces the permission on every outgoing track", () => {
    const tracks = [{ enabled: true }, { enabled: true }];
    enforceAudioPermission({ getAudioTracks: () => tracks } as unknown as MediaStream, false);
    expect(tracks.every((track) => !track.enabled)).toBe(true);
  });
});
