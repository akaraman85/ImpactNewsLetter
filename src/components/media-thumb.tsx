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

export function FullMedia({
  src,
  alt,
  kind = "image",
  className,
}: {
  src: string;
  alt: string;
  kind?: "image" | "video";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={className ? `${className} is-unavailable` : "is-unavailable"}>
        {kind === "video" ? "Video unavailable" : "Preview unavailable"}
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        className={className}
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    // Dropbox links expire and are not served through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
