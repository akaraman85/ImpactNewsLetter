// Chat Completions on the Vercel AI Gateway. The AI SDK already uses this
// gateway for drafts. An API key wins over OIDC, matching the gateway.
export const AI_GATEWAY_CHAT_BASE_URL = "https://ai-gateway.vercel.sh/v1";

export function gatewayKeyFromValues(apiKey: string | undefined, oidcToken: string | undefined) {
  const key = apiKey?.trim();
  if (key) return key;
  const token = oidcToken?.trim();
  return token || null;
}

export async function gatewayApiKey() {
  const fromEnv = gatewayKeyFromValues(process.env.AI_GATEWAY_API_KEY, undefined);
  if (fromEnv) return fromEnv;
  try {
    const { getVercelOidcToken } = await import("@vercel/oidc");
    return gatewayKeyFromValues(undefined, await getVercelOidcToken());
  } catch {
    return null;
  }
}
