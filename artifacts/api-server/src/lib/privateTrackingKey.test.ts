import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generatePrivateTrackingKey,
  hashPrivateTrackingKey,
  isValidPrivateTrackingKey,
  verifyPrivateTrackingKey,
} from "./privateTrackingKey";

describe("private applicant tracking keys", () => {
  it("generates unpredictable 256-bit base64url keys", () => {
    const first = generatePrivateTrackingKey();
    const second = generatePrivateTrackingKey();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(isValidPrivateTrackingKey(first)).toBe(true);
    expect(isValidPrivateTrackingKey("123456")).toBe(false);
  });

  it("stores only a SHA-256 hash and compares candidate keys safely", () => {
    const key = generatePrivateTrackingKey();
    const hash = hashPrivateTrackingKey(key);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(key);
    expect(verifyPrivateTrackingKey(hash, key)).toBe(true);
    expect(verifyPrivateTrackingKey(hash, generatePrivateTrackingKey())).toBe(
      false,
    );
    expect(verifyPrivateTrackingKey(null, key)).toBe(false);
    expect(verifyPrivateTrackingKey(hash, "123456")).toBe(false);
  });

  it("keeps legacy access-code storage out of runtime schema selections", () => {
    const schema = readFileSync(
      new URL("../../../../lib/db/src/schema/enrollment.ts", import.meta.url),
      "utf8",
    );
    const migration = readFileSync(
      new URL(
        "../../../../lib/db/migrations/0002_applicant_access_codes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const routes = readFileSync(
      new URL("../routes/enrollment.ts", import.meta.url),
      "utf8",
    );

    expect(schema).toMatch(
      /accessKeyHash:\s*text\("access_key_hash"\)\.unique\(\)/,
    );
    expect(schema).not.toMatch(/applicantAccessCodeHash/);
    expect(schema).not.toMatch(/applicant_access_code_attempts/);
    expect(routes).not.toMatch(/applicantAccessCodeHash|applicant_access_code_hash/);
    expect(routes).not.toMatch(/applicantAccessCodeAttemptsTable|applicant_access_code_attempts/);
    expect(migration).toMatch(/applicant_access_code_hash/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.applicant_access_code_attempts/i);
    expect(migration).toMatch(/ALTER COLUMN access_key_hash DROP NOT NULL/i);
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });
});
