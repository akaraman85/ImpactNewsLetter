import { DatabaseNotice, Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { setupStaff } from "@/lib/actions";
import { databaseConfigured } from "@/lib/db";
import { staffSignupOpen } from "@/lib/staff-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!databaseConfigured()) return <DatabaseNotice />;
  if (!staffSignupOpen()) redirect("/admin/login");
  const { error } = await searchParams;
  return (
    <main className="wrap">
      <form className="panel stack auth-card" action={setupStaff}>
        <p className="kicker">Owner</p>
        <h1>Create or reset the owner account</h1>
        <p className="muted">
          Use the owner email and the setup code. If that account already exists, this replaces its
          password and signs you in. Parents never use this account.
        </p>
        <Notice message={error} />
        <label className="field">
          <span>Setup code</span>
          <input name="code" type="password" autoComplete="off" required />
        </label>
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
        <SubmitButton pendingLabel="Saving…">Save and sign in</SubmitButton>
      </form>
    </main>
  );
}
