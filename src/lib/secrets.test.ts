import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, readSignedValue, signValue, verifyPassword } from "./secrets.ts";

test("a password matches only the hash created for it", () => {
  const stored = hashPassword("correct-horse");
  assert.equal(verifyPassword("correct-horse", stored), true);
  assert.equal(verifyPassword("Correct-horse", stored), false);
  assert.equal(verifyPassword("wrong-password", stored), false);
  assert.equal(verifyPassword("correct-horse", "not-a-hash"), false);
  assert.equal(verifyPassword("", stored), false);
});

test("a signed session value round-trips", () => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-secret-value-16";
  const payload = Buffer.from(JSON.stringify({ staffId: "staff-1", exp: 99 })).toString("base64url");
  const token = signValue(payload);
  assert.equal(readSignedValue(token), payload);
  assert.equal(readSignedValue(`${token}x`), null);
  assert.equal(readSignedValue("not-signed"), null);
});
