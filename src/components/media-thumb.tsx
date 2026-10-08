"use client";

import { useState } from "react";
import { mediaPreviewSrc, mediaStillSrc } from "@/lib/media-picker";
import { QueuedPreview } from "./queued-preview";

function PlayMark() {
  return (
    <svg className="play-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 8.2v7.6l6.2-3.8L10 8.2Z" fill="currentColor" />
    </svg>
  );
}

export function MediaThumb({
  src,
  alt,
  kind = "image",
}: {
  src: string;
  alt: string;
  kind?: "image" | "video";
}) {
  if (kind === "video") {
    return (
      <span className="thumb-frame">
        <QueuedPreview
          key={src}
          className="thumb"
          src={mediaPreviewSrc(src, "thumb")}
          alt=""
          fallback={
            <div className="thumb-fallback is-video" aria-hidden="true">
              <PlayMark />
            </div>
          }
        />
        <span className="thumb-play" aria-hidden="true">
          <PlayMark />
        </span>
      </span>
    );
  }
  return (
    <QueuedPreview
      key={src}
      className="thumb"
      src={mediaPreviewSrc(src, "thumb")}
      alt=""
      fallback={<div className="thumb-fallback">{alt}</div>}
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
  if (kind === "video") {
    return <VideoPlayer src={src} alt={alt} className={className} />;
  }
  const unavailableClass = className ? `${className} is-unavailable` : "is-unavailable";
  return (
    <QueuedPreview
      key={src}
      eager
      className={className}
      src={mediaPreviewSrc(src, "display")}
      alt={alt}
      draggable={false}
      fallback={<div className={unavailableClass}>Preview unavailable</div>}
    />
  );
}

function VideoPlayer({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={className ? `${className} is-unavailable` : "is-unavailable"}>Video unavailable</div>
    );
  }
  return (
    <video
      className={className}
      src={src}
      poster={mediaStillSrc(src, "display")}
      controls
      playsInline
      preload="metadata"
      aria-label={alt}
      onError={() => setFailed(true)}
    />
  );
}
