import { currentAccount } from "./dropbox";
import { getSettings } from "./data";
import { decryptSecret } from "./secrets";

type CachedToken = { refresh: string; token: string; exp: number };
let cached: CachedToken | null = null;

export function dropboxAppConfigured() {
  return Boolean(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);
}

export async function dropboxAccessToken() {
  const settings = await getSettings();
  if (!settings.dropboxRefreshToken) return null;
  const refresh = decryptSecret(settings.dropboxRefreshToken);
  if (cached && cached.refresh === refresh && cached.exp > Date.now() + 60_000) {
    return cached.token;
  }
  if (!dropboxAppConfigured()) {
    throw new Error("Dropbox app keys are not set yet.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: process.env.DROPBOX_APP_KEY!,
    client_secret: process.env.DROPBOX_APP_SECRET!,
  });
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("Dropbox needs to be connected again.");
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cached = {
    refresh,
    token: json.access_token,
    exp: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export async function exchangeDropboxCode(code: string, redirectUri: string) {
  if (!dropboxAppConfigured()) {
    throw new Error("Dropbox app keys are not set yet.");
  }
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    client_id: process.env.DROPBOX_APP_KEY!,
    client_secret: process.env.DROPBOX_APP_SECRET!,
  });
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("Dropbox did not accept the connection.");
  }
  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    account_id?: string;
    expires_in: number;
  };
  if (!json.refresh_token) {
    throw new Error("Dropbox did not return a refresh token.");
  }
  const account = await currentAccount(json.access_token);
  cached = {
    refresh: json.refresh_token,
    token: json.access_token,
    exp: Date.now() + json.expires_in * 1000,
  };
  return {
    refreshToken: json.refresh_token,
    accountId: account?.id || json.account_id || "",
    accountLabel: account?.label || "Dropbox account",
  };
}
