import { createHash, timingSafeEqual } from "node:crypto";

const SETUP_CODE_MIN = 12;

// Read through globalThis so Next does not bake an empty value into the build
// when the setup code is added later.
const env = globalThis.process.env;

function sameSecret(actual: string, expected: string) {
  const left = createHash("sha256").update(actual, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

export function ownerEmail() {
  return (env.ADMIN_OWNER_EMAIL ?? "").trim().toLowerCase();
}

export function isOwner(email: string) {
  const owner = ownerEmail();
  if (!owner.includes("@")) return false;
  return sameSecret(email.trim().toLowerCase(), owner);
}

export function staffSignupOpen() {
  const code = env.ADMIN_SETUP_CODE ?? "";
  return ownerEmail().includes("@") && code.length >= SETUP_CODE_MIN;
}

export function setupCodeMatches(code: string) {
  const expected = env.ADMIN_SETUP_CODE ?? "";
  if (expected.length < SETUP_CODE_MIN) return false;
  return sameSecret(code, expected);
}
