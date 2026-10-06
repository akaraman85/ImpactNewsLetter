import { DatabaseNotice, Notice } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { login } from "@/lib/actions";
import { readStaffSession } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { staffCount } from "@/lib/data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!databaseConfigured()) return <DatabaseNotice />;
  try {
    if ((await staffCount()) === 0) redirect("/admin/setup");
    if (await readStaffSession()) redirect("/admin");
  } catch {
    return <DatabaseNotice />;
  }
  const { error } = await searchParams;
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
