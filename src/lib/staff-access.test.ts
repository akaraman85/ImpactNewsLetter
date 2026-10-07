import assert from "node:assert/strict";
import test from "node:test";
import { isOwner, setupCodeMatches, staffSignupOpen } from "./staff-access.ts";

const OWNER = "owner@example.com";
const CODE = "correct-horse-battery";

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) {
    previous.set(key, process.env[key]);
    const next = values[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("signup stays closed until an owner email and a long setup code are set", () => {
  withEnv({ ADMIN_OWNER_EMAIL: undefined, ADMIN_SETUP_CODE: undefined }, () => {
    assert.equal(staffSignupOpen(), false);
    assert.equal(isOwner(OWNER), false);
    assert.equal(setupCodeMatches(CODE), false);
  });
  withEnv({ ADMIN_OWNER_EMAIL: OWNER, ADMIN_SETUP_CODE: "short" }, () => {
    assert.equal(staffSignupOpen(), false);
    assert.equal(setupCodeMatches("short"), false);
  });
});

test("only the owner email and the setup code open the first account", () => {
  withEnv({ ADMIN_OWNER_EMAIL: `  ${OWNER.toUpperCase()}  `, ADMIN_SETUP_CODE: CODE }, () => {
    assert.equal(staffSignupOpen(), true);
    assert.equal(isOwner("owner@example.com"), true);
    assert.equal(isOwner("someone@example.com"), false);
    assert.equal(setupCodeMatches(CODE), true);
    assert.equal(setupCodeMatches("correct-horse-batterY"), false);
    assert.equal(setupCodeMatches(""), false);
  });
});
