import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateApiToken, hashApiToken } from "@/app/lib/api-tokens";

describe("generateApiToken", () => {
  it("uses the 'hd_' prefix followed by 48 hex chars (24 bytes)", () => {
    expect(generateApiToken()).toMatch(/^hd_[0-9a-f]{48}$/);
  });

  it("produces a different token on each call", () => {
    const a = generateApiToken();
    const b = generateApiToken();
    expect(a).not.toBe(b);
  });
});

describe("hashApiToken", () => {
  it("returns the SHA-256 hex digest of the token", () => {
    const token = "hd_deadbeef";
    const expected = createHash("sha256").update(token).digest("hex");
    expect(hashApiToken(token)).toBe(expected);
  });

  it("is deterministic - the same token always hashes the same", () => {
    const token = generateApiToken();
    expect(hashApiToken(token)).toBe(hashApiToken(token));
  });

  it("never returns the raw token (only its digest is stored)", () => {
    const token = generateApiToken();
    const hash = hashApiToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
