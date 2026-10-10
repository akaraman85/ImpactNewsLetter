import { NewsletterView } from "@/components/newsletter";
import { Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { unlockViewer } from "@/lib/actions";
import { viewerGranted } from "@/lib/auth";
import { findActiveShare, getSettings, issueContent, listAssets } from "@/lib/data";
import { formatEventDate } from "@/lib/format";
import { hashToken, isShareToken } from "@/lib/secrets";
import { withDb } from "@/lib/db";
import { shareLinks } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { key } = await params;
  const { error } = await searchParams;
  if (!isShareToken(key)) return <Unavailable />;
  let found;
  try {
    found = await findActiveShare(hashToken(key));
  } catch {
    return <Unavailable />;
  }
  if (!found) return <Unavailable />;
  const settings = await getSettings();
  if (settings.viewerPasswordHash) {
    const allowed = await viewerGranted(key, settings.viewerPasswordHash.slice(0, 16));
    if (!allowed) {
      return (
        <main className="wrap">
          <form className="panel stack auth-card" action={unlockViewer}>
            <p className="kicker">{settings.programName}</p>
            <h1>This letter is locked.</h1>
            <p className="muted">Enter the family passphrase that came with the link.</p>
            <Notice message={error} />
            <input type="hidden" name="token" value={key} />
            <label className="field">
              <span>Passphrase</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <SubmitButton pendingLabel="Checking…">Open</SubmitButton>
          </form>
        </main>
      );
    }
  }

  await withDb(async (db) => {
    await db
      .update(shareLinks)
      .set({ viewCount: found.link.viewCount + 1 })
      .where(eq(shareLinks.id, found.link.id));
  });

  const media = await listAssets(found.issue.id);
  return (
    <NewsletterView
      programName={settings.programName}
      dateLabel={formatEventDate(found.issue.eventDate)}
      content={issueContent(found.issue)}
      assets={media
        .filter((asset) => asset.included)
        .map((asset) => ({
          id: asset.id,
          kind: asset.kind === "video" ? "video" : "image",
          name: asset.name,
          caption: asset.caption,
          src: `/api/media/${key}/${asset.id}`,
        }))}
    />
  );
}

function Unavailable() {
  return (
    <main className="wrap">
      <section className="panel auth-card">
        <h1>This link is not active.</h1>
        <p className="muted">Ask the program for a fresh link if you still need the photos.</p>
      </section>
    </main>
  );
}
