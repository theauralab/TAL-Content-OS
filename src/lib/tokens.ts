import { createHash, randomBytes, randomInt } from "crypto";

export const RESET_TTL_MINUTES = 60;
export const RESET_MAX_PER_HOUR = 3;

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** The raw token goes in the email; only the hash is ever stored. */
export function newResetToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

// No 0/O, 1/l/I — people read these out of an email and type them.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** 14-char temporary password from a CSPRNG (randomInt is unbiased). */
export function generateTempPassword(length = 14) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
