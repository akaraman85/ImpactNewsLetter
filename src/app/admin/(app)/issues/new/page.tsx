import { Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { createIssue } from "@/lib/actions";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, settings] = await Promise.all([searchParams, getSettings()]);
  return (
    <form className="panel stack" action={createIssue}>
      <p className="kicker">New issue</p>
      <h1>What happened?</h1>
      <Notice message={error} />
      <label className="field">
        <span>Title</span>
        <input name="title" placeholder="Field day" required />
      </label>
      <label className="field">
        <span>Event date</span>
        <input name="eventDate" type="date" />
      </label>
      <label className="field">
        <span>Notes for the draft</span>
        <textarea
          name="notes"
          placeholder="Third grade won the relay. Lunch moved inside after the rain."
        />
      </label>
      <label className="field">
        <span>Dropbox folder path or shared folder link</span>
        <input
          name="dropboxFolderPath"
          defaultValue={settings.dropboxFolderPath}
          placeholder="/Impact/Field Day"
        />
      </label>
      <p className="muted">
        Optional. After you create the issue, Import folder pulls photos and videos from this path.
      </p>
      <SubmitButton pendingLabel="Creating…">Create issue</SubmitButton>
    </form>
  );
}
