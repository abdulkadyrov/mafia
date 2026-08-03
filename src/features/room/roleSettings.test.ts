import { describe, expect, it } from "vitest";
import type { MafiaRoomSettings } from "../../core/room/mafiaRoomTypes";
import { changePlayerLimit, changeRoleCount } from "./roleSettings";

const settings: MafiaRoomSettings = {
  name: "Вечерняя мафия",
  maxPlayers: 7,
  isPrivate: true,
  videoEnabled: true,
  cameraRequired: false,
  autoPhase: false,
  chatEnabled: true,
  deadChatEnabled: true,
  deadCanObserve: true,
  deadCanReadAliveChat: false,
  nightSeconds: 45,
  discussionSeconds: 180,
  votingSeconds: 45,
  roles: { mafia: 2, doctor: 1, commissioner: 1, civilian: 2 },
  allowVoteChange: false,
  tieRule: "no_execution",
  roleAssignmentMode: "random",
};

describe("room role settings", () => {
  it("lets civilian controls change the player limit while keeping every seat assigned", () => {
    const result = changeRoleCount(settings, "civilian", 3);
    expect(result.maxPlayers).toBe(8);
    expect(result.roles.civilian).toBe(3);
  });

  it("replaces a civilian when a special role is added", () => {
    const result = changeRoleCount(settings, "doctor", 2);
    expect(result.maxPlayers).toBe(7);
    expect(result.roles.civilian).toBe(1);
  });

  it("recalculates civilians when the player limit changes", () => {
    const result = changePlayerLimit(settings, 9);
    expect(result.maxPlayers).toBe(9);
    expect(result.roles.civilian).toBe(4);
  });
});
