import { Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { addStaff, disconnectDropbox, saveProgram, saveViewerPassword } from "@/lib/actions";
import { dropboxAppConfigured } from "@/lib/dropbox-account";
import { getSettings, listStaff } from "@/lib/data";
import { headers } from "next/headers";
import { requestOrigin } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; dropbox?: string }>;
}) {
  const [{ error, dropbox }, settings, staff, headerStore] = await Promise.all([
    searchParams,
    getSettings(),
    listStaff(),
    headers(),
  ]);
  const origin = requestOrigin(headerStore);
  const redirectUri = `${origin}/api/dropbox/callback`;

  return (
    <>
      <div>
        <p className="kicker">Settings</p>
        <h1>Program</h1>
      </div>
      <Notice message={error} />
      {dropbox === "connected" ? <p className="alert">Dropbox is connected.</p> : null}

      <form className="panel stack" action={saveProgram}>
        <h2>Name</h2>
        <label className="field">
          <span>Program name</span>
          <input name="programName" defaultValue={settings.programName} />
        </label>
        <label className="field">
          <span>Tagline</span>
          <input name="tagline" defaultValue={settings.tagline} />
        </label>
        <label className="field">
          <span>Default Dropbox folder</span>
          <input name="dropboxFolderPath" defaultValue={settings.dropboxFolderPath} />
        </label>
        <SubmitButton>Save</SubmitButton>
      </form>

      <section className="panel stack">
        <h2>Dropbox</h2>
        {settings.dropboxAccountLabel ? (
          <p>Connected as {settings.dropboxAccountLabel}.</p>
        ) : (
          <p className="muted">Not connected yet. You can still paste individual Dropbox file links on an issue.</p>
        )}
        <p className="muted">
          Create a Dropbox app with scopes <code>files.metadata.read</code>,{" "}
          <code>files.content.read</code>, and <code>account_info.read</code>. Set the redirect URI
          to <code>{redirectUri}</code>, then add DROPBOX_APP_KEY and DROPBOX_APP_SECRET on Vercel.
        </p>
        <div className="row">
          {dropboxAppConfigured() ? (
            <a className="btn" href="/api/dropbox/start">
              {settings.dropboxRefreshToken ? "Reconnect Dropbox" : "Connect Dropbox"}
            </a>
          ) : (
            <p className="muted">App keys are not in the environment yet.</p>
          )}
          {settings.dropboxRefreshToken ? (
            <form action={disconnectDropbox}>
              <SubmitButton variant="secondary" pendingLabel="Disconnecting…">
                Disconnect
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </section>

      <form className="panel stack" action={saveViewerPassword}>
        <h2>Family passphrase</h2>
        <p className="muted">
          Optional. When this is set, the private link also asks for a short passphrase before the
          photos open.
        </p>
        <p>{settings.viewerPasswordHash ? "A passphrase is on." : "No passphrase is set."}</p>
        <label className="field">
          <span>New passphrase</span>
          <input name="viewerPassword" type="password" autoComplete="new-password" />
        </label>
        <div className="row">
          <SubmitButton pendingLabel="Saving…">Save passphrase</SubmitButton>
          <button className="btn secondary" name="clear" value="1" type="submit">
            Remove passphrase
          </button>
        </div>
      </form>

      <section className="panel stack">
        <h2>Staff</h2>
        <ul>
          {staff.map((person) => (
            <li key={person.id}>
              {person.name} · {person.email}
            </li>
          ))}
        </ul>
        <form className="stack" action={addStaff}>
          <label className="field">
            <span>Name</span>
            <input name="name" />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" />
          </label>
          <SubmitButton pendingLabel="Adding…">Add staff</SubmitButton>
        </form>
      </section>
    </>
  );
}
