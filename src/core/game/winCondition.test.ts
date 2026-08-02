import { describe, expect, it } from "vitest";
import type { DomainGamePlayer } from "./gameTypes";
import { getWinner } from "./winCondition";

const player = (id: string, role: DomainGamePlayer["role"], lifeStatus: DomainGamePlayer["lifeStatus"] = "alive"): DomainGamePlayer => ({
  id,
  userId: `user-${id}`,
  role,
  team: role === "mafia" || role === "don" ? "mafia" : role === "maniac" ? "neutral" : role === "host" ? "host" : "city",
  lifeStatus,
  isHost: role === "host",
});

describe("win conditions", () => {
  it("keeps the game running while neither side has won", () => {
    expect(getWinner([player("m", "mafia"), player("c1", "civilian"), player("c2", "doctor")])).toBeNull();
  });

  it("declares city when all threats are dead", () => {
    expect(getWinner([player("m", "mafia", "dead"), player("c", "civilian"), player("h", "host")])).toBe("city");
  });

  it("declares mafia at parity", () => {
    expect(getWinner([player("m1", "mafia"), player("m2", "don"), player("c1", "civilian"), player("c2", "doctor")])).toBe("mafia");
  });

  it("declares a lone maniac and handles an empty table", () => {
    expect(getWinner([player("x", "maniac"), player("c", "civilian", "dead")])).toBe("maniac");
    expect(getWinner([player("h", "host")])).toBe("draw");
  });
});
