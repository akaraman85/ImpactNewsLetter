import { randomBytes } from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { dropboxAppConfigured } from "@/lib/dropbox-account";
import { requestOrigin } from "@/lib/format";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaff();
  const base = requestOrigin(await headers());
  if (!dropboxAppConfigured()) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=Add%20the%20Dropbox%20app%20keys%20first", base),
    );
  }
  const state = randomBytes(16).toString("base64url");
  const redirectUri = `${base}/api/dropbox/callback`;
  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DROPBOX_APP_KEY ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set(
    "scope",
    "files.metadata.read files.content.read account_info.read",
  );
  const response = NextResponse.redirect(url);
  response.cookies.set("nl_dropbox_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
