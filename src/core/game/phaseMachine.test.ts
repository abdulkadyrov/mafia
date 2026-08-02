import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, getNextPhase } from "./phaseMachine";

describe("phase machine", () => {
  it("walks through the complete default cycle", () => {
    const roles = ["mafia", "doctor", "commissioner", "civilian"] as const;
    expect(getNextPhase("lobby", roles)).toBe("role_reveal");
    expect(getNextPhase("role_reveal", roles)).toBe("night_intro");
    expect(getNextPhase("night_intro", roles)).toBe("night_mafia");
    expect(getNextPhase("night_mafia", roles)).toBe("night_doctor");
    expect(getNextPhase("night_doctor", roles)).toBe("night_commissioner");
    expect(getNextPhase("night_commissioner", roles)).toBe("night_resolution");
    expect(getNextPhase("night_resolution", roles)).toBe("day_announcement");
    expect(getNextPhase("day_announcement", roles)).toBe("day_discussion");
    expect(getNextPhase("day_discussion", roles)).toBe("day_voting");
    expect(getNextPhase("day_voting", roles)).toBe("day_execution");
    expect(getNextPhase("day_execution", roles)).toBe("night_intro");
  });

  it("skips absent special-role phases", () => {
    expect(getNextPhase("night_mafia", ["mafia", "civilian"])).toBe("night_resolution");
    expect(getNextPhase("night_mafia", ["mafia", "bodyguard", "civilian"])).toBe("night_doctor");
    expect(getNextPhase("night_doctor", ["doctor", "civilian"])).toBe("night_resolution");
  });

  it("allows game over only from resolution points", () => {
    expect(canTransition("night_resolution", "game_over")).toBe(true);
    expect(canTransition("day_execution", "game_over")).toBe(true);
    expect(() => assertTransition("day_discussion", "night_intro")).toThrow("Недопустимый переход");
    expect(getNextPhase("game_over")).toBe("lobby");
  });
});
