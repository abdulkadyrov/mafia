import { describe, expect, it } from "vitest";
import type { MafiaPlayerView } from "./mafiaRoomTypes";
import { orderPlayersSelfFirst } from "./orderPlayersSelfFirst";

function player(id: string): MafiaPlayerView {
  return {
    id,
    room_id: "room",
    user_id: `user-${id}`,
    display_name: id,
    avatar_url: null,
    is_host: false,
    is_ready: false,
    life_status: "alive",
    camera_enabled: false,
    microphone_enabled: false,
    microphone_blocked: false,
    connection_quality: "unknown",
    last_seen_at: "2026-08-03T00:00:00.000Z",
    joined_at: "2026-08-03T00:00:00.000Z",
    gamePlayerId: null,
    role: null,
    team: null,
    deathReason: null,
    is_bot: false,
    bot_difficulty: null,
  };
}

describe("orderPlayersSelfFirst", () => {
  it("puts the current player first and preserves everyone else's order", () => {
    const players = [player("one"), player("two"), player("three")];
    expect(orderPlayersSelfFirst(players, "user-two").map((item) => item.id)).toEqual(["two", "one", "three"]);
  });

  it("returns the original list when the current player is already first", () => {
    const players = [player("one"), player("two")];
    expect(orderPlayersSelfFirst(players, "user-one")).toBe(players);
  });
});
