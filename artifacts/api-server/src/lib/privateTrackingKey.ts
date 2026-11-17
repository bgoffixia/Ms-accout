import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TRACKING_KEY_BYTES = 32;
const TRACKING_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isValidPrivateTrackingKey(value: unknown): value is string {
  return typeof value === "string" && TRACKING_KEY_PATTERN.test(value);
}

export function generatePrivateTrackingKey(): string {
  return randomBytes(TRACKING_KEY_BYTES).toString("base64url");
}

export function hashPrivateTrackingKey(key: string): string {
  if (!isValidPrivateTrackingKey(key)) {
    throw new Error("Private tracking keys must be 32-byte base64url values.");
  }
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function verifyPrivateTrackingKey(
  storedHash: string | null | undefined,
  key: unknown,
): boolean {
  if (!isValidPrivateTrackingKey(key)) return false;
  const stored =
    typeof storedHash === "string" && /^[a-f0-9]{64}$/i.test(storedHash)
      ? Buffer.from(storedHash, "hex")
      : Buffer.alloc(32);
  const candidate = Buffer.from(hashPrivateTrackingKey(key), "hex");
  const matched = timingSafeEqual(stored, candidate);
  return (
    matched &&
    typeof storedHash === "string" &&
    /^[a-f0-9]{64}$/i.test(storedHash)
  );
}
