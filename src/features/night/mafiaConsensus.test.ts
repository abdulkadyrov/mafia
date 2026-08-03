import { describe, expect, it } from "vitest";
import type { MafiaEvent } from "../../core/room/mafiaRoomTypes";
import { getLatestMafiaChoices } from "./mafiaConsensus";

describe("mafia consensus", () => {
  it("keeps the latest target selected by every mafia player in the current round", () => {
    const events = [
      event(1, "m1", "c1"),
      event(2, "m2", "c2"),
      event(3, "m1", "c2"),
      event(4, "m3", "c1", 2),
    ];

    expect(getLatestMafiaChoices(events, 1, "game")).toEqual([
      { eventId: 3, actorId: "m1", targetId: "c2" },
      { eventId: 2, actorId: "m2", targetId: "c2" },
    ]);
  });

  it("does not reuse a choice from an earlier game with the same round number", () => {
    const previous = event(1, "m1", "c1");
    previous.game_id = "previous-game";
    expect(getLatestMafiaChoices([previous], 1, "game")).toEqual([]);
  });
});

function event(id: number, actorId: string, targetId: string, round = 1): MafiaEvent {
  return {
    id,
    room_id: "room",
    game_id: "game",
    round_number: round,
    phase: "night_mafia",
    event_type: "night_action_submitted",
    visibility: "mafia",
    target_user_id: null,
    payload: { actorId, targetId, actionType: "mafia_kill" },
    created_at: new Date(id * 1000).toISOString(),
  };
}
