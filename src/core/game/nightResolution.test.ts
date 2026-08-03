import { describe, expect, it } from "vitest";
import type { DomainGamePlayer } from "./gameTypes";
import { resolveNight } from "./nightResolution";

const players: DomainGamePlayer[] = [
  makePlayer("m1", "mafia", "mafia"),
  makePlayer("m2", "don", "mafia"),
  makePlayer("d", "doctor", "city"),
  makePlayer("k", "commissioner", "city"),
  makePlayer("m", "mistress", "city"),
  makePlayer("c1", "civilian", "city"),
  makePlayer("c2", "civilian", "city"),
];

describe("night resolution", () => {
  it("resolves mafia majority, healing and a private commissioner check", () => {
    const result = resolveNight(players, [
      { actorId: "m1", targetId: "c1", type: "mafia_kill" },
      { actorId: "m2", targetId: "c1", type: "mafia_kill" },
      { actorId: "d", targetId: "c1", type: "doctor_heal" },
      { actorId: "k", targetId: "m2", type: "commissioner_check" },
    ]);
    expect(result.killedPlayerIds).toEqual([]);
    expect(result.savedPlayerIds).toEqual(["c1"]);
    expect(result.commissionerChecks).toEqual([{ commissionerId: "k", targetId: "m2", isMafia: true }]);
  });

  it("cancels a blocked actor and ignores dead or invalid actors", () => {
    const result = resolveNight(players, [
      { actorId: "m", targetId: "m1", type: "mistress_block" },
      { actorId: "m1", targetId: "c1", type: "mafia_kill" },
      { actorId: "missing", targetId: "c2", type: "maniac_kill" },
    ]);
    expect(result.blockedPlayerIds).toEqual(["m1"]);
    expect(result.killedPlayerIds).toEqual([]);
  });

  it("never treats the host as a valid night target", () => {
    const state = [...players, { ...makePlayer("host", "host", "host"), isModerator: true }];
    expect(resolveNight(state, [{ actorId: "m1", targetId: "host", type: "mafia_kill" }]).killedPlayerIds).toEqual([]);
  });

  it("does not kill on a tied mafia choice", () => {
    const result = resolveNight(players, [
      { actorId: "m1", targetId: "c1", type: "mafia_kill" },
      { actorId: "m2", targetId: "c2", type: "mafia_kill" },
    ]);
    expect(result.killedPlayerIds).toEqual([]);
  });
});

function makePlayer(id: string, role: DomainGamePlayer["role"], team: DomainGamePlayer["team"]): DomainGamePlayer {
  return { id, userId: `u-${id}`, role, team, lifeStatus: "alive", isModerator: false };
}
