import { describe, expect, it } from "vitest";
import { assignRoles, buildRoleDeck, secureShuffle } from "./roleAssignment";
import { getRoleDefinition } from "./roleRegistry";

describe("role assignment", () => {
  it("builds a complete balanced deck", () => {
    const deck = buildRoleDeck({ don: 1, mafia: 1, doctor: 1, commissioner: 1 }, 7);
    expect(deck).toHaveLength(7);
    expect(deck.filter((role) => role === "civilian")).toHaveLength(3);
  });

  it("assigns each player exactly one role and team", () => {
    const players = Array.from({ length: 7 }, (_, index) => `p${index + 1}`);
    const assignments = assignRoles(players, { don: 1, mafia: 1, doctor: 1, commissioner: 1 }, () => 0.42);
    expect(new Set(assignments.map((item) => item.playerId)).size).toBe(7);
    expect(assignments.filter((item) => item.team === "mafia")).toHaveLength(2);
  });

  it("rejects invalid or mafia-majority decks", () => {
    expect(() => buildRoleDeck({ doctor: 1 }, 6)).toThrow("хотя бы одна мафия");
    expect(() => buildRoleDeck({ mafia: 3 }, 6)).toThrow("в меньшинстве");
    expect(() => buildRoleDeck({ mafia: -1 }, 6)).toThrow("Некорректное");
    expect(() => buildRoleDeck({ mafia: 1 }, 3)).toThrow("минимум 4");
  });

  it("uses the injected random source for a deterministic Fisher-Yates shuffle", () => {
    expect(secureShuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });

  it("exposes the registered role definition", () => {
    expect(getRoleDefinition("commissioner")).toMatchObject({ team: "city", nightAction: "commissioner_check" });
  });
});
