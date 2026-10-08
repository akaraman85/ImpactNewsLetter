"use client";

import { useState } from "react";

export function MediaThumb({
  src,
  alt,
  kind = "image",
}: {
  src: string;
  alt: string;
  kind?: "image" | "video";
}) {
  const [failed, setFailed] = useState(false);
  if (kind === "video") {
    return (
      <div className="thumb-fallback is-video" aria-hidden="true">
        <svg className="play-mark" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 8.2v7.6l6.2-3.8L10 8.2Z" fill="currentColor" />
        </svg>
      </div>
    );
  }
  if (failed) return <div className="thumb-fallback">{alt}</div>;
  return (
    // Dropbox links expire and are not served through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="thumb"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
