import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applicantAccessAttemptKeys,
  hashApplicantAccessCode,
  isValidApplicantAccessCode,
  verifyApplicantAccessCode,
} from "./applicantAccessCode";

describe("applicant-owned access codes", () => {
  it("accepts only six numeric digits", () => {
    expect(isValidApplicantAccessCode("004219")).toBe(true);
    expect(isValidApplicantAccessCode("04219")).toBe(false);
    expect(isValidApplicantAccessCode("12345x")).toBe(false);
  });

  it("stores a salted one-way scrypt hash and verifies it safely", async () => {
    const first = await hashApplicantAccessCode("004219");
    const second = await hashApplicantAccessCode("004219");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(first).not.toContain("004219");
    await expect(verifyApplicantAccessCode(first, "004219")).resolves.toBe(
      true,
    );
    await expect(verifyApplicantAccessCode(first, "004220")).resolves.toBe(
      false,
    );
    await expect(verifyApplicantAccessCode(null, "004219")).resolves.toBe(
      false,
    );
  });

  it("derives distinct opaque throttling keys for references and IP addresses", () => {
    const first = applicantAccessAttemptKeys(
      "case-1042",
      "192.0.2.4",
      "test-only-secret",
    );
    const normalized = applicantAccessAttemptKeys(
      "CASE-1042",
      "192.0.2.4",
      "test-only-secret",
    );
    const otherIp = applicantAccessAttemptKeys(
      "CASE-1042",
      "192.0.2.5",
      "test-only-secret",
    );
    expect(first.referenceKey).toBe(normalized.referenceKey);
    expect(first.ipKey).toBe(normalized.ipKey);
    expect(otherIp.ipKey).not.toBe(first.ipKey);
    expect(first.referenceKey).not.toContain("CASE-1042");
    expect(first.ipKey).not.toContain("192.0.2.4");
  });

  it("keeps the forward migration additive and retains legacy guest-key data", () => {
    const migration = readFileSync(
      new URL(
        "../../../../lib/db/migrations/0002_applicant_access_codes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const schema = readFileSync(
      new URL("../../../../lib/db/src/schema/enrollment.ts", import.meta.url),
      "utf8",
    );
    expect(migration).toMatch(
      /ALTER TABLE public\.guest_preapplications\s+ADD COLUMN IF NOT EXISTS applicant_access_code_hash text/i,
    );
    expect(migration).toMatch(
      /ALTER TABLE public\.enrollment_applications\s+ADD COLUMN IF NOT EXISTS applicant_access_code_hash text/i,
    );
    expect(migration).toMatch(/ALTER COLUMN access_key_hash DROP NOT NULL/i);
    expect(migration).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.applicant_access_code_attempts/i,
    );
    expect(migration).toMatch(
      /ALTER TABLE public\.applicant_access_code_attempts\s+ENABLE ROW LEVEL SECURITY/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL PRIVILEGES\s+ON TABLE public\.applicant_access_code_attempts\s+FROM PUBLIC/i,
    );
    expect(migration).toMatch(/WHERE rolname = 'anon'/i);
    expect(migration).toMatch(/WHERE rolname = 'authenticated'/i);
    expect(migration).not.toMatch(/FORCE ROW LEVEL SECURITY/i);
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(
      /UPDATE\s+(guest_preapplications|enrollment_applications)\b/i,
    );
    expect(schema).toMatch(
      /accessKeyHash:\s*text\("access_key_hash"\)\.unique\(\)/,
    );
    expect(
      schema.match(
        /applicantAccessCodeHash:\s*text\("applicant_access_code_hash"\)/g,
      ),
    ).toHaveLength(2);
    expect(schema).toMatch(
      /applicant_access_code_attempts_failed_attempts_check/,
    );
    expect(schema).toMatch(
      /applicantAccessCodeAttemptsTable[\s\S]*?\.enableRLS\(\)/,
    );
  });
});
