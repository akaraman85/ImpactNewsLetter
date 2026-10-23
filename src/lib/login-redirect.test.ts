import assert from "node:assert/strict";
import test from "node:test";
import { isLoginRedirect } from "./login-redirect.ts";

test("a staff login redirect is recognized for API routes", () => {
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/admin/login;307;",
  });
  assert.equal(isLoginRedirect(redirect), true);
  assert.equal(isLoginRedirect(new Error("Sign in required")), false);
  assert.equal(isLoginRedirect({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }), false);
});
