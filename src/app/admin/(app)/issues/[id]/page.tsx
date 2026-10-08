import { Notice } from "@/components/admin-shell";
import { CopyLink } from "@/components/copy-link";
import { LetterSections } from "@/components/letter-sections";
import { MediaLibrary, type EditorMedia } from "@/components/media-library";
import { SubmitButton } from "@/components/submit-button";
import {
  addMediaLink,
  archiveIssue,
  createLink,
  importDropboxFolder,
  publishIssue,
  revokeLink,
  saveAssets,
  saveIssueDetails,
  saveLetter,
  unpublishIssue,
  writeDraft,
  addSection,
} from "@/lib/actions";
import { getIssue, issueContent, listAssets, listShareLinks } from "@/lib/data";
import type { LetterSectionRef } from "@/lib/media-picker";
import { decryptSecret } from "@/lib/secrets";
import { formatEventDate, requestOrigin } from "@/lib/format";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const issue = await getIssue(id);
  if (!issue) notFound();
  const [media, links, headerStore] = await Promise.all([
    listAssets(id),
    listShareLinks(id),
    headers(),
  ]);
  const content = issueContent(issue);
  const library: EditorMedia[] = media.map((asset) => ({
    id: asset.id,
    name: asset.name,
    kind: asset.kind === "video" ? "video" : "image",
    included: asset.included,
    caption: asset.caption,
    src: `/api/admin/media/${asset.id}`,
  }));
  const letterSections: LetterSectionRef[] = content.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
    assetIds: section.assetIds,
  }));
  const origin = requestOrigin(headerStore);
  const activeLinks = links.filter((link) => !link.revokedAt);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="kicker">{formatEventDate(issue.eventDate) || "Undated"}</p>
          <h1>{issue.title}</h1>
        </div>
        <span className={`pill ${issue.status}`}>{issue.status}</span>
      </div>
      <Notice message={error} />
      <div className="row">
        <Link className="btn secondary" href={`/admin/issues/${id}/preview`}>
          Preview
        </Link>
        <a className="btn secondary" href={`/admin/issues/${id}/email`}>
          Download email HTML
        </a>
      </div>

      <form className="panel stack" action={saveIssueDetails}>
        <h2>The day</h2>
        <input type="hidden" name="id" value={issue.id} />
        <label className="field">
          <span>Title</span>
          <input name="title" defaultValue={issue.title} required />
        </label>
        <label className="field">
          <span>Event date</span>
          <input name="eventDate" type="date" defaultValue={issue.eventDate ?? ""} />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea name="notes" defaultValue={issue.notes} />
        </label>
        <label className="field">
          <span>Dropbox folder path or shared folder link</span>
          <input
            name="dropboxFolderPath"
            defaultValue={issue.dropboxFolderPath}
            placeholder="/Impact/Field Day or a shared folder link"
          />
        </label>
        <p className="muted">
          A shared folder link that anyone can open can be imported without connecting Dropbox.
        </p>
        <div className="row">
          <SubmitButton>Save details</SubmitButton>
          <button className="btn secondary" formAction={writeDraft} type="submit">
            Write a draft
          </button>
          <button className="btn secondary" formAction={importDropboxFolder} type="submit">
            Import folder
          </button>
        </div>
      </form>

      <section className="panel stack">
        <h2>Photos and videos</h2>
        <p className="muted">
          Imported files stay in Dropbox. The letter only stores a reference and loads each file
          from Dropbox when someone opens it. Include a file to show it to families, then place it
          from the tray in the letter. Select a photo to see the whole picture, and use Full size
          when you want it as large as the window.
        </p>
        <form className="row" action={addMediaLink}>
          <input type="hidden" name="id" value={issue.id} />
          <label className="field" style={{ flex: "1 1 16rem" }}>
            <span>Or paste one Dropbox file link</span>
            <input name="url" placeholder="https://www.dropbox.com/..." />
          </label>
          <label className="field" style={{ flex: "1 1 10rem" }}>
            <span>Name</span>
            <input name="name" placeholder="relay.jpg" />
          </label>
          <SubmitButton pendingLabel="Adding…">Add link</SubmitButton>
        </form>
        {media.length === 0 ? (
          <p className="muted">No files yet.</p>
        ) : (
          <>
            <form id="photos" action={saveAssets}>
              <input type="hidden" name="id" value={issue.id} />
            </form>
            <MediaLibrary issueId={issue.id} assets={library} sections={letterSections} />
            <div className="row">
              <button className="btn" form="photos" type="submit">
                Save photo choices
              </button>
            </div>
          </>
        )}
      </section>

      <form id="letter" className="panel stack" action={saveLetter}>
        <h2>The letter</h2>
        <input type="hidden" name="id" value={issue.id} />
        <input type="hidden" name="sectionCount" value={content.sections.length} />
        <label className="field">
          <span>Headline</span>
          <input name="headline" defaultValue={content.headline} />
        </label>
        <label className="field">
          <span>Subtitle</span>
          <input name="subtitle" defaultValue={content.subtitle} />
        </label>
        <label className="field">
          <span>Opening</span>
          <textarea name="intro" defaultValue={content.intro} />
        </label>
        <LetterSections
          sections={content.sections}
          assets={media
            .filter((asset) => asset.included)
            .map((asset) => ({
              id: asset.id,
              name: asset.name,
              kind: asset.kind === "video" ? "video" : "image",
              src: `/api/admin/media/${asset.id}`,
              caption: asset.caption,
            }))}
        />
        <label className="field">
          <span>Closing</span>
          <textarea name="closing" defaultValue={content.closing} />
        </label>
        <div className="row">
          <SubmitButton>Save letter</SubmitButton>
          <button className="btn secondary" formAction={addSection} type="submit">
            Add a section
          </button>
        </div>
      </form>

      <section id="share" className="panel stack">
        <h2>Share with families</h2>
        <p className="muted">
          Publishing turns on the private link. The long key in the address is the viewing login.
        </p>
        <form className="row" action={issue.status === "published" ? unpublishIssue : publishIssue}>
          <input type="hidden" name="id" value={issue.id} />
          {issue.status !== "published" ? (
            <label className="field">
              <span>Expire after days (optional)</span>
              <input name="expiresInDays" inputMode="numeric" placeholder="30" />
            </label>
          ) : null}
          <SubmitButton pendingLabel="Updating…">
            {issue.status === "published" ? "Unpublish" : "Publish"}
          </SubmitButton>
        </form>
        {activeLinks.length === 0 ? (
          <p className="muted">No active link yet.</p>
        ) : (
          activeLinks.map((link) => {
            let url = "";
            try {
              url = `${origin}/v/${decryptSecret(link.tokenEncrypted)}`;
            } catch {
              url = "";
            }
            return (
              <div className="stack" key={link.id}>
                {url ? (
                  <a className="link-box" href={url}>
                    {url}
                  </a>
                ) : (
                  <p className="muted">This link cannot be shown. Create a new one.</p>
                )}
                <p className="muted">
                  {link.viewCount} views
                  {link.expiresAt ? ` · expires ${link.expiresAt.toLocaleDateString("en-US")}` : " · no expiry"}
                </p>
                <div className="row">
                  {url ? <CopyLink url={url} /> : null}
                  <form action={revokeLink}>
                    <input type="hidden" name="id" value={issue.id} />
                    <input type="hidden" name="linkId" value={link.id} />
                    <SubmitButton variant="danger" pendingLabel="Revoking…">
                      Revoke
                    </SubmitButton>
                  </form>
                </div>
              </div>
            );
          })
        )}
        <form className="row" action={createLink}>
          <input type="hidden" name="id" value={issue.id} />
          <label className="field">
            <span>New link expiry in days</span>
            <input name="expiresInDays" inputMode="numeric" placeholder="optional" />
          </label>
          <SubmitButton variant="secondary" pendingLabel="Creating…">
            New link
          </SubmitButton>
        </form>
        <form action={archiveIssue}>
          <input type="hidden" name="id" value={issue.id} />
          <SubmitButton variant="danger" pendingLabel="Archiving…">
            Archive issue
          </SubmitButton>
        </form>
      </section>
    </>
  );
}
