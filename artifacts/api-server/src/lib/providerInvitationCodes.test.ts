import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITATION_CODE_LENGTH,
  INVITATION_CODE_PROVIDER_IDS,
  isInvitationCodeProviderId,
  isValidInvitationCodeLength,
  MAX_INVITATION_CODE_LENGTH,
  MIN_INVITATION_CODE_LENGTH,
  validateInvitationCode,
} from "./providerInvitationCodes";

describe("provider Invitation Code policy", () => {
  it("accepts only known provider identifiers", () => {
    expect(INVITATION_CODE_PROVIDER_IDS).toEqual([
      "category-1",
      "category-2",
      "category-3",
      "category-4",
    ]);
    expect(isInvitationCodeProviderId("category-3")).toBe(true);
    expect(isInvitationCodeProviderId("category-5")).toBe(false);
    expect(isInvitationCodeProviderId("../category-1")).toBe(false);
  });

  it("uses a bounded default and rejects invalid lengths", () => {
    expect(DEFAULT_INVITATION_CODE_LENGTH).toBe(8);
    expect(isValidInvitationCodeLength(MIN_INVITATION_CODE_LENGTH)).toBe(true);
    expect(isValidInvitationCodeLength(MAX_INVITATION_CODE_LENGTH)).toBe(true);
    expect(isValidInvitationCodeLength(3)).toBe(false);
    expect(isValidInvitationCodeLength(13)).toBe(false);
    expect(isValidInvitationCodeLength(8.5)).toBe(false);
  });

  it("accepts a new numeric code only at the provider's configured length", () => {
    expect(validateInvitationCode("80421357", 8)).toEqual({
      value: "80421357",
    });
    expect(validateInvitationCode("8042135", 8).error).toMatch(/8-digit/);
    expect(validateInvitationCode("8042AB57", 8).error).toMatch(/8-digit/);
  });

  it("keeps a previously saved code valid after a length change", () => {
    expect(validateInvitationCode("CASE-4826", 10, "CASE-4826")).toEqual({
      value: "CASE-4826",
      isLegacy: true,
    });
    expect(validateInvitationCode("80421357", 10, "80421357")).toEqual({
      value: "80421357",
      isLegacy: true,
    });
    expect(validateInvitationCode("CASE-4827", 10, "CASE-4826").error).toMatch(
      /10-digit/,
    );
  });

  it("keeps the field optional and rejects non-string inputs", () => {
    expect(validateInvitationCode("", 8)).toEqual({ value: undefined });
    expect(validateInvitationCode(undefined, 8)).toEqual({ value: undefined });
    expect(validateInvitationCode(12345678, 8).error).toMatch(/plain text/);
  });
});
