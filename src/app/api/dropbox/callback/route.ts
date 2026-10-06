import { exchangeDropboxCode } from "@/lib/dropbox-account";
import { requestOrigin } from "@/lib/format";
import { encryptSecret } from "@/lib/secrets";
import { withDb } from "@/lib/db";
import { programSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("nl_dropbox_state")?.value;
  jar.delete("nl_dropbox_state");
  const base = requestOrigin(await headers());
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${base}/admin/settings?error=${encodeURIComponent("Dropbox connection was interrupted.")}`);
  }
  try {
    const connected = await exchangeDropboxCode(code, `${base}/api/dropbox/callback`);
    await withDb(async (db) => {
      await db
        .update(programSettings)
        .set({
          dropboxRefreshToken: encryptSecret(connected.refreshToken),
          dropboxAccountId: connected.accountId,
          dropboxAccountLabel: connected.accountLabel,
          updatedAt: new Date(),
        })
        .where(eq(programSettings.id, 1));
    });
  } catch {
    return NextResponse.redirect(
      `${base}/admin/settings?error=${encodeURIComponent("Dropbox could not be connected.")}`,
    );
  }
  return NextResponse.redirect(`${base}/admin/settings?dropbox=connected`);
}
