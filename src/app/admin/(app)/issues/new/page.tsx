import { Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { createIssue } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
      <SubmitButton pendingLabel="Creating…">Create issue</SubmitButton>
    </form>
  );
}
