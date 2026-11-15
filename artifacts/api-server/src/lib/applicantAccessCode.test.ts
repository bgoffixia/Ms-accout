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
    await expect(verifyApplicantAccessCode(first, "004219")).resolves.toBe(true);
    await expect(verifyApplicantAccessCode(first, "004220")).resolves.toBe(false);
    await expect(verifyApplicantAccessCode(null, "004219")).resolves.toBe(false);
  });

  it("derives distinct opaque throttling keys for references and IP addresses", () => {
    const first = applicantAccessAttemptKeys("case-1042", "192.0.2.4", "test-only-secret");
    const normalized = applicantAccessAttemptKeys("CASE-1042", "192.0.2.4", "test-only-secret");
    const otherIp = applicantAccessAttemptKeys("CASE-1042", "192.0.2.5", "test-only-secret");
    expect(first.referenceKey).toBe(normalized.referenceKey);
    expect(first.ipKey).toBe(normalized.ipKey);
    expect(otherIp.ipKey).not.toBe(first.ipKey);
    expect(first.referenceKey).not.toContain("CASE-1042");
    expect(first.ipKey).not.toContain("192.0.2.4");
  });
});
