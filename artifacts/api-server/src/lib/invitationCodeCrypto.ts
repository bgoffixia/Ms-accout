import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ENCRYPTED_INVITATION_CODE_PREFIX = "ic:v1:";
const KEY_DERIVATION_CONTEXT = "msoft-account-protection-invitation-code-v1";

export type InvitationCodeScope = `guest:${string}` | `application:${string}`;

function invitationCodeKey(): Buffer {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required to protect Invitation Codes.");
  }
  return createHmac("sha256", sessionSecret)
    .update(KEY_DERIVATION_CONTEXT)
    .digest();
}

export function isEncryptedInvitationCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(ENCRYPTED_INVITATION_CODE_PREFIX)
  );
}

export function encryptInvitationCode(
  value: string,
  scope: InvitationCodeScope,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", invitationCodeKey(), iv);
  cipher.setAAD(Buffer.from(scope, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "ic:v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Legacy rows contain plaintext. Return it only to server-side callers that
 * have already authorized an explicit reveal or are migrating the row.
 */
export function decryptInvitationCode(
  value: unknown,
  scope: InvitationCodeScope,
): string | null {
  if (typeof value !== "string" || !value) return null;
  if (!isEncryptedInvitationCode(value)) return value;
  try {
    const [, version, ivPart, tagPart, ciphertextPart] = value.split(":");
    if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      invitationCodeKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAAD(Buffer.from(scope, "utf8"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
