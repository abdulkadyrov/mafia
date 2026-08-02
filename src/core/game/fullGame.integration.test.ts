import { describe, expect, it } from "vitest";
import type { DomainGamePlayer, DomainNightAction, GamePhase } from "./gameTypes";
import { resolveNight } from "./nightResolution";
import { getNextPhase } from "./phaseMachine";
import { resolveVotes } from "./voting";
import { getWinner } from "./winCondition";
import { canPublishAudio } from "../video/audioPermissions";
import { canSendChat } from "../chat/chatPermissions";

describe("full seven-player production round", () => {
  it("runs roles, night, death restrictions, voting, victory and rematch", () => {
    let phase: GamePhase = "role_reveal";
    let players: DomainGamePlayer[] = [
      player("host", "host", "host", true),
      player("don", "don", "mafia"),
      player("mafia", "mafia", "mafia"),
      player("doctor", "doctor", "city"),
      player("commissioner", "commissioner", "city"),
      player("civilian-1", "civilian", "city"),
      player("civilian-2", "civilian", "city"),
    ];

    phase = getNextPhase(phase, aliveRoles(players))!;
    expect(phase).toBe("night_intro");
    phase = getNextPhase(phase, aliveRoles(players))!;
    expect(phase).toBe("night_mafia");
    expect(canSendChat(chatActor(players, "mafia"), "mafia_chat", phase, chatPolicy)).toBe(true);

    const actions: DomainNightAction[] = [
      { actorId: "don", targetId: "civilian-1", type: "mafia_kill" },
      { actorId: "mafia", targetId: "civilian-1", type: "mafia_kill" },
      { actorId: "doctor", targetId: "civilian-2", type: "doctor_heal" },
      { actorId: "commissioner", targetId: "don", type: "commissioner_check" },
    ];
    const night = resolveNight(players, actions);
    players = markDead(players, night.killedPlayerIds);
    expect(night.killedPlayerIds).toEqual(["civilian-1"]);
    expect(night.commissionerChecks[0].isMafia).toBe(true);

    const dead = players.find((item) => item.id === "civilian-1")!;
    expect(canPublishAudio({ phase: "day_discussion", lifeStatus: dead.lifeStatus, team: dead.team, isHost: false, hostMuted: false })).toBe(false);
    expect(canSendChat({ lifeStatus: dead.lifeStatus, team: dead.team, blocked: false }, "alive_chat", "day_discussion", chatPolicy)).toBe(false);
    expect(canSendChat({ lifeStatus: dead.lifeStatus, team: dead.team, blocked: false }, "dead_chat", "day_discussion", chatPolicy)).toBe(true);

    const execution = resolveVotes(players, [
      { voterId: "doctor", targetId: "don" },
      { voterId: "commissioner", targetId: "don" },
      { voterId: "civilian-2", targetId: "don" },
      { voterId: "don", targetId: "doctor" },
      { voterId: "mafia", targetId: "doctor" },
      { voterId: "civilian-1", targetId: "doctor" },
    ]);
    expect(execution.eliminatedPlayerId).toBe("don");
    players = markDead(players, [execution.eliminatedPlayerId!]);
    expect(getWinner(players)).toBeNull();

    players = markDead(players, ["mafia"]);
    expect(getWinner(players)).toBe("city");
    phase = "game_over";
    expect(getNextPhase(phase)).toBe("lobby");
  });
});

const chatPolicy = { chatEnabled: true, deadChatEnabled: true, deadCanReadAliveChat: false };

function player(id: string, role: DomainGamePlayer["role"], team: DomainGamePlayer["team"], isHost = false): DomainGamePlayer {
  return { id, userId: `user-${id}`, role, team, lifeStatus: "alive", isHost };
}

function aliveRoles(players: DomainGamePlayer[]) {
  return players.filter((item) => item.lifeStatus === "alive").map((item) => item.role);
}

function markDead(players: DomainGamePlayer[], ids: string[]) {
  const deadIds = new Set(ids);
  return players.map((item) => deadIds.has(item.id) ? { ...item, lifeStatus: "dead" as const } : item);
}

function chatActor(players: DomainGamePlayer[], id: string) {
  const subject = players.find((item) => item.id === id)!;
  return { lifeStatus: subject.lifeStatus, team: subject.team, blocked: false };
}
