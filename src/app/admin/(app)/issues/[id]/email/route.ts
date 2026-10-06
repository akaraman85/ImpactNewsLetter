import { readStaffSession } from "@/lib/auth";
import { getIssue, getSettings, issueContent, listShareLinks } from "@/lib/data";
import { renderEmailHtml } from "@/lib/email-html";
import { formatEventDate, requestOrigin } from "@/lib/format";
import { decryptSecret } from "@/lib/secrets";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readStaffSession();
  if (!session) return new NextResponse("Sign in required", { status: 401 });
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) return new NextResponse("Not found", { status: 404 });
  const [settings, links, headerStore] = await Promise.all([
    getSettings(),
    listShareLinks(id),
    headers(),
  ]);
  const active = links.find((link) => !link.revokedAt);
  let viewUrl: string | null = null;
  if (active) {
    try {
      viewUrl = `${requestOrigin(headerStore)}/v/${decryptSecret(active.tokenEncrypted)}`;
    } catch {
      viewUrl = null;
    }
  }
  const html = renderEmailHtml({
    programName: settings.programName,
    content: issueContent(issue),
    eventDate: formatEventDate(issue.eventDate),
    viewUrl,
  });
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter.html"`,
    },
  });
}
