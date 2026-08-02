import { describe, expect, it } from "vitest";
import { normalizePhone, validatePassword } from "./phonePasswordAuthService";

describe("phone password authentication", () => {
  it("normalizes a Russian local phone number", () => {
    expect(normalizePhone("8 (999) 123-45-67")).toBe("+79991234567");
  });

  it("keeps a valid international phone number", () => {
    expect(normalizePhone("+49 151 23456789")).toBe("+4915123456789");
  });

  it("rejects invalid phone numbers", () => {
    expect(() => normalizePhone("123")).toThrow("международном формате");
  });

  it("requires at least six password characters", () => {
    expect(() => validatePassword("12345")).toThrow("минимум 6");
    expect(() => validatePassword("123456")).not.toThrow();
  });
});
