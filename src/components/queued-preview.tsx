"use client";

import { createSlotQueue } from "@/lib/preview-queue";
import { useEffect, useRef, useState, type ReactNode } from "react";

const slots = createSlotQueue(4);
const MAX_ATTEMPTS = 3;

function attemptSrc(src: string, attempt: number) {
  if (attempt === 0) return src;
  const join = src.includes("?") ? "&" : "?";
  return `${src}${join}retry=${attempt}`;
}

export function QueuedPreview({
  src,
  alt,
  className,
  fallback,
  eager = false,
  draggable,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  eager?: boolean;
  draggable?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const [visible, setVisible] = useState(eager);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const shownSrc = eager && !failed ? attemptSrc(src, attempt) : currentSrc;

  function settle() {
    releaseRef.current?.();
    releaseRef.current = null;
  }

  useEffect(() => {
    if (eager) return;
    const node = holder.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    if (eager || !visible || failed) return;
    let stopped = false;
    slots.acquire().then((release) => {
      if (stopped) {
        release();
        return;
      }
      releaseRef.current = release;
      setCurrentSrc(attemptSrc(src, attempt));
    });
    return () => {
      stopped = true;
      settle();
    };
  }, [eager, visible, failed, src, attempt]);

  if (failed) return fallback;
  if (!shownSrc) return <div ref={holder} className={className} />;

  return (
    // These addresses are app routes that resize a private Dropbox file.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={shownSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      draggable={draggable}
      onLoad={settle}
      onError={() => {
        settle();
        if (attempt + 1 >= MAX_ATTEMPTS) {
          setFailed(true);
          return;
        }
        if (!eager) setCurrentSrc(null);
        setAttempt((current) => current + 1);
      }}
    />
  );
}
