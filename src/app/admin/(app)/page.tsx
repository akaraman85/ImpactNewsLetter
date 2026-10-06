import { formatEventDate } from "@/lib/format";
import { listIssues } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = await listIssues();
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="kicker">Dashboard</p>
          <h1>Issues</h1>
        </div>
        <Link className="btn" href="/admin/issues/new">
          New issue
        </Link>
      </div>
      {issues.length === 0 ? (
        <section className="panel">
          <h2>No letters yet</h2>
          <p className="muted">
            Start one after the next event. You can pull photos from Dropbox, or paste file links
            until that connection is ready.
          </p>
        </section>
      ) : (
        <div className="issue-list">
          {issues.map((issue) => (
            <Link className="issue-link" href={`/admin/issues/${issue.id}`} key={issue.id}>
              <span>
                <strong>{issue.title}</strong>
                <span className="muted" style={{ display: "block" }}>
                  {formatEventDate(issue.eventDate) || "Date not set"}
                </span>
              </span>
              <span className={`pill ${issue.status}`}>{issue.status}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
