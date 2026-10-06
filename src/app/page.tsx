import Link from "next/link";

export default function HomePage() {
  return (
    <main className="wrap">
      <header className="door-bar">
        <p className="brand">Impact Newsletter</p>
        <Link className="btn" href="/admin">
          Staff sign in
        </Link>
      </header>
      <section className="door">
        <div>
          <p className="kicker">For the families</p>
          <h1>A private letter after the fun.</h1>
          <p className="lede">
            After a field day, a concert, or a class visit, staff pull the pictures from Dropbox,
            shape a short note, and send parents one link. The link is the key.
          </p>
        </div>
        <aside className="panel">
          <h2>How a letter goes out</h2>
          <ol className="muted">
            <li>Point at the Dropbox folder from the day.</li>
            <li>Choose the shots and add a few sentences.</li>
            <li>Let the draft fill in the story, then edit it.</li>
            <li>Publish and share the private family link.</li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
