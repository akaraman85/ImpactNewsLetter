import assert from "node:assert/strict";
import test from "node:test";
import { AI_GATEWAY_CHAT_BASE_URL, gatewayKeyFromValues } from "./gateway-auth.ts";

test("the revise chat uses the Vercel AI Gateway chat endpoint", () => {
  assert.equal(AI_GATEWAY_CHAT_BASE_URL, "https://ai-gateway.vercel.sh/v1");
});

test("an existing gateway key wins over the OIDC token", () => {
  assert.equal(gatewayKeyFromValues(" gateway-key ", "oidc-token"), "gateway-key");
  assert.equal(gatewayKeyFromValues(undefined, " oidc-token "), "oidc-token");
  assert.equal(gatewayKeyFromValues("  ", ""), null);
});
