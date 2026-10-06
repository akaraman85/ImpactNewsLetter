import { logout } from "@/lib/actions";
import Link from "next/link";

export function AdminShell({
  programName,
  children,
}: {
  programName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wrap">
      <header className="topbar">
        <Link className="brand" href="/admin">
          {programName}
        </Link>
        <nav className="nav">
          <Link href="/admin">Issues</Link>
          <Link href="/admin/settings">Settings</Link>
          <form action={logout}>
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <div className="stack" style={{ paddingBottom: "4rem" }}>
        {children}
      </div>
    </div>
  );
}

export function Notice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="alert" role="alert">
      {message}
    </p>
  );
}

export function DatabaseNotice() {
  return (
    <main className="wrap">
      <section className="panel auth-card">
        <p className="kicker">Impact Newsletter</p>
        <h1>The newsletter database is not connected yet.</h1>
        <p className="muted">
          This app stores issues in Neon. In the Vercel project, open Storage, create a Neon
          database, and set AUTH_SECRET. Then reload.
        </p>
      </section>
    </main>
  );
}
