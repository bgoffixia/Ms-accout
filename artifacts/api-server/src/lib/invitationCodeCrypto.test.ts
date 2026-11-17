import { afterEach, describe, expect, it } from "vitest";
import {
  decryptInvitationCode,
  encryptInvitationCode,
  isEncryptedInvitationCode,
} from "./invitationCodeCrypto";

describe("Invitation Code encryption", () => {
  const originalSecret = process.env.SESSION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("encrypts each value with authenticated, record-scoped ciphertext", () => {
    process.env.SESSION_SECRET = "test-session-secret";
    const scope = "guest:application-1" as const;
    const first = encryptInvitationCode("12345678", scope);
    const second = encryptInvitationCode("12345678", scope);

    expect(isEncryptedInvitationCode(first)).toBe(true);
    expect(first).not.toContain("12345678");
    expect(first).not.toBe(second);
    expect(decryptInvitationCode(first, scope)).toBe("12345678");
    expect(decryptInvitationCode(first, "guest:application-2")).toBeNull();
  });

  it("fails closed when the key is unavailable or ciphertext is invalid", () => {
    delete process.env.SESSION_SECRET;
    expect(() =>
      encryptInvitationCode("12345678", "application:application-1"),
    ).toThrow("SESSION_SECRET");
    expect(
      decryptInvitationCode(
        "ic:v1:invalid:invalid:invalid",
        "application:application-1",
      ),
    ).toBeNull();
  });

  it("reads existing plaintext only through the explicit server-side legacy path", () => {
    expect(
      decryptInvitationCode("LEGACY-123", "application:application-1"),
    ).toBe("LEGACY-123");
  });
});
