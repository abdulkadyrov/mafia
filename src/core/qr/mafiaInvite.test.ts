import { describe, expect, it } from "vitest";
import { extractMafiaRoomCode } from "./mafiaInvite";

describe("Mafia QR invitation", () => {
  it("extracts a room code from the generated hash invitation", () => {
    expect(extractMafiaRoomCode("https://example.com/mafia/#/game/mafia/join?roomCode=7Z5UE5")).toBe("7Z5UE5");
  });

  it("accepts a room code scanned as plain text", () => {
    expect(extractMafiaRoomCode("a1b2c3")).toBe("A1B2C3");
  });

  it("never forwards an unrelated or malformed QR destination", () => {
    expect(extractMafiaRoomCode("https://example.com/collect?roomCode=7Z5UE5")).toBeNull();
    expect(extractMafiaRoomCode("https://example.com/no-room")).toBeNull();
    expect(extractMafiaRoomCode("not a qr invitation")).toBeNull();
  });
});
