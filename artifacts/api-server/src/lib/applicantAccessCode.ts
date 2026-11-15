import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;
const SALT_LENGTH = 16;

function scrypt(value: string, salt: Buffer, n = SCRYPT_N): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      value,
      salt,
      KEY_LENGTH,
      { N: n, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, derivedKey) => error ? reject(error) : resolve(derivedKey),
    );
  });
}

export function isValidApplicantAccessCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export async function hashApplicantAccessCode(code: string): Promise<string> {
  if (!isValidApplicantAccessCode(code)) {
    throw new Error("Applicant access codes must contain exactly six digits.");
  }
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(code, salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

function parseStoredHash(storedHash: string) {
  const [algorithm, nText, rText, pText, saltText, keyText, extra] = storedHash.split("$");
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  const salt = saltText ? Buffer.from(saltText, "base64url") : Buffer.alloc(0);
  const key = keyText ? Buffer.from(keyText, "base64url") : Buffer.alloc(0);
  if (
    algorithm !== "scrypt" ||
    extra !== undefined ||
    n !== SCRYPT_N ||
    r !== SCRYPT_R ||
    p !== SCRYPT_P ||
    salt.length !== SALT_LENGTH ||
    key.length !== KEY_LENGTH
  ) return null;
  return { n, salt, key };
}

const dummySalt = Buffer.from("4f00c951d7db8f7639899c512fc01b7a", "hex");
const dummyHashPromise = scrypt("000000", dummySalt);

export async function verifyApplicantAccessCode(
  storedHash: string | null | undefined,
  code: string,
): Promise<boolean> {
  const parsed = typeof storedHash === "string" ? parseStoredHash(storedHash) : null;
  if (!parsed) {
    const dummyHash = await dummyHashPromise;
    const candidate = await scrypt(isValidApplicantAccessCode(code) ? code : "invalid", dummySalt);
    timingSafeEqual(candidate, dummyHash);
    return false;
  }
  const candidate = await scrypt(isValidApplicantAccessCode(code) ? code : "invalid", parsed.salt, parsed.n);
  return candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
}

export function applicantAccessAttemptKeys(
  reference: string,
  ipAddress: string,
  key: string,
) {
  const normalizedReference = reference.trim().toUpperCase();
  const hmac = (scope: string, value: string) =>
    createHmac("sha256", key).update(`${scope}\0${value}`, "utf8").digest("hex");
  return {
    referenceKey: hmac("reference", normalizedReference),
    ipKey: hmac("ip", ipAddress),
  };
}
