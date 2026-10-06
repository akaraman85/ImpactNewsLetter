"use client";

import { useState } from "react";

export function MediaThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="thumb-fallback">{alt}</div>;
  return (
    // Dropbox links expire and are not served through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="thumb"
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
