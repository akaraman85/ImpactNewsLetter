import { DatabaseNotice, Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { setupStaff } from "@/lib/actions";
import { databaseConfigured } from "@/lib/db";
import { staffCount } from "@/lib/data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!databaseConfigured()) return <DatabaseNotice />;
  try {
    if ((await staffCount()) > 0) redirect("/admin/login");
  } catch {
    return <DatabaseNotice />;
  }
  const { error } = await searchParams;
  return (
    <main className="wrap">
      <form className="panel stack auth-card" action={setupStaff}>
        <p className="kicker">First visit</p>
        <h1>Create the staff account</h1>
        <p className="muted">
          This account opens the dashboard. Parents never use it. They open a private link instead.
        </p>
        <Notice message={error} />
        <label className="field">
          <span>Your name</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={10} required />
        </label>
        <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
      </form>
    </main>
  );
}
