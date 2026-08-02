import { describe, expect, it } from "vitest";
import type { DomainGamePlayer } from "./gameTypes";
import { resolveVotes } from "./voting";

const players: DomainGamePlayer[] = ["a", "b", "c", "d"].map((id) => ({
  id,
  userId: `u-${id}`,
  role: "civilian",
  team: "city",
  lifeStatus: "alive",
  isHost: false,
}));

describe("voting", () => {
  it("counts one valid vote per living voter", () => {
    const result = resolveVotes(players, [
      { voterId: "a", targetId: "d" },
      { voterId: "a", targetId: "c" },
      { voterId: "b", targetId: "d" },
      { voterId: "c", targetId: "d" },
      { voterId: "ghost", targetId: "d" },
    ]);
    expect(result.eliminatedPlayerId).toBe("d");
    expect(result.counts).toEqual({ d: 3 });
  });

  it("returns tied candidates without eliminating anyone", () => {
    const result = resolveVotes(players, [
      { voterId: "a", targetId: "c" },
      { voterId: "b", targetId: "d" },
    ]);
    expect(result.eliminatedPlayerId).toBeNull();
    expect(result.tiedPlayerIds).toEqual(["c", "d"]);
  });

  it("rejects dead voters and dead targets", () => {
    const state = players.map((item) => item.id === "a" ? { ...item, lifeStatus: "dead" as const } : item);
    expect(resolveVotes(state, [{ voterId: "a", targetId: "b" }, { voterId: "b", targetId: "a" }]).counts).toEqual({});
  });
});
