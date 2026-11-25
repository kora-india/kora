import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptField, encryptField } from "../field-crypto";

const DATA_KEY = "a-test-data-encryption-key-of-32+chars";
const AUTH = "a-test-auth-secret-that-is-32+chars-long";

afterEach(() => vi.unstubAllEnvs());

describe("field encryption", () => {
  it("encrypts with the data key and reads it back", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", DATA_KEY);
    const stored = encryptField("234567890123");
    expect(stored).not.toContain("234567890123");
    expect(stored.startsWith("v1.d.")).toBe(true);
    expect(decryptField(stored)).toBe("234567890123");
  });

  it("gives a different result each time for the same number", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", DATA_KEY);
    expect(encryptField("1234")).not.toBe(encryptField("1234"));
  });

  it("falls back to a key made from the auth secret", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", "");
    vi.stubEnv("AUTH_SECRET", AUTH);
    const stored = encryptField("001234567890");
    expect(stored.startsWith("v1.a.")).toBe(true);
    expect(decryptField(stored)).toBe("001234567890");

    // Adding a data key later keeps old values readable.
    vi.stubEnv("DATA_ENCRYPTION_KEY", DATA_KEY);
    expect(decryptField(stored)).toBe("001234567890");
    expect(encryptField("x").startsWith("v1.d.")).toBe(true);
  });

  it("ignores a data key that's too short", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", "short");
    vi.stubEnv("AUTH_SECRET", AUTH);
    expect(encryptField("1").startsWith("v1.a.")).toBe(true);
  });

  it("reads nothing back from a changed value or the wrong key", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", DATA_KEY);
    const stored = encryptField("234567890123");
    const parts = stored.split(".");
    parts[4] = parts[4].slice(0, -2) + (parts[4].endsWith("A") ? "BB" : "AA");
    expect(decryptField(parts.join("."))).toBeNull();

    vi.stubEnv(
      "DATA_ENCRYPTION_KEY",
      "a-completely-different-key-of-32-chars!",
    );
    expect(decryptField(stored)).toBeNull();
    expect(decryptField("not encrypted")).toBeNull();
    expect(decryptField(null)).toBeNull();
  });

  it("refuses to save when there's no key at all", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", "");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(() => encryptField("1")).toThrow(/No encryption key/);
  });
});
