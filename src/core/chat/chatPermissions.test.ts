import { describe, expect, it } from "vitest";
import { canReadChat, canSendChat, normalizeChatMessage } from "./chatPermissions";

const policy = { chatEnabled: true, deadChatEnabled: true, deadCanReadAliveChat: false };
const aliveCity = { lifeStatus: "alive", team: "city", blocked: false } as const;
const aliveMafia = { lifeStatus: "alive", team: "mafia", blocked: false } as const;
const dead = { lifeStatus: "dead", team: "city", blocked: false } as const;

describe("chat permissions", () => {
  it("separates mafia, alive and dead channels", () => {
    expect(canSendChat(aliveMafia, "mafia_chat", "night_mafia", policy)).toBe(true);
    expect(canSendChat(aliveCity, "mafia_chat", "night_mafia", policy)).toBe(false);
    expect(canSendChat(dead, "dead_chat", "day_discussion", policy)).toBe(true);
    expect(canSendChat(dead, "alive_chat", "day_discussion", policy)).toBe(false);
    expect(canReadChat(dead, "alive_chat", policy)).toBe(false);
    expect(canReadChat(dead, "system_chat", policy)).toBe(true);
  });

  it("honors global chat and moderation switches", () => {
    expect(canSendChat({ ...aliveCity, blocked: true }, "alive_chat", "day_discussion", policy)).toBe(false);
    expect(canSendChat(aliveCity, "alive_chat", "day_discussion", { ...policy, chatEnabled: false })).toBe(false);
    expect(canSendChat(aliveCity, "room_chat", "lobby", policy)).toBe(true);
    expect(canSendChat(aliveCity, "system_chat", "lobby", policy)).toBe(false);
  });

  it("normalizes and validates content", () => {
    expect(normalizeChatMessage("  привет\r\nгород  ")).toBe("привет\nгород");
    expect(() => normalizeChatMessage("   ")).toThrow("пустое");
    expect(() => normalizeChatMessage("x".repeat(501))).toThrow("500");
  });
});
