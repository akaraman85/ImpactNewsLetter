import { DatabaseNotice, Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { login } from "@/lib/actions";
import { readStaffSession } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { staffCount } from "@/lib/data";
import { staffSignupOpen } from "@/lib/staff-access";
import { redirect, unstable_rethrow } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!databaseConfigured()) return <DatabaseNotice />;
  let count = 0;
  try {
    count = await staffCount();
    if (count === 0 && staffSignupOpen()) redirect("/admin/setup");
    if (count > 0 && (await readStaffSession())) redirect("/admin");
  } catch (error) {
    unstable_rethrow(error);
    return <DatabaseNotice />;
  }
  const { error } = await searchParams;
  if (count === 0) {
    return (
      <main className="wrap">
        <section className="panel stack auth-card">
          <p className="kicker">Staff</p>
          <h1>Signup is closed</h1>
          <p className="muted">Only the owner can create a staff account.</p>
          <Notice message={error} />
        </section>
      </main>
    );
  }
  return (
    <main className="wrap">
      <form className="panel stack auth-card" action={login}>
        <p className="kicker">Staff</p>
        <h1>Sign in</h1>
        <Notice message={error} />
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
    </main>
  );
}
