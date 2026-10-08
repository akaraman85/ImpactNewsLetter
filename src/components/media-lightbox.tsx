"use client";

import { useEffect, useId, useRef, useState } from "react";
import { viewerNeighbors } from "@/lib/media-picker";
import { FullMedia } from "./media-thumb";

export function useMediaViewer<T extends { id: string }>() {
  const [session, setSession] = useState<{ currentId: string; list: T[] } | null>(null);
  const current = session?.list.find((item) => item.id === session.currentId) ?? null;
  const neighbors = session && current ? viewerNeighbors(session.list, current.id) : null;

  function go(delta: -1 | 1) {
    setSession((value) => {
      if (!value) return value;
      const step = viewerNeighbors(value.list, value.currentId);
      const target = delta < 0 ? step.previous : step.next;
      if (!target) return value;
      return { ...value, currentId: target.id };
    });
  }

  return {
    current,
    position: neighbors?.label,
    open(item: T, list: readonly T[]) {
      setSession({ currentId: item.id, list: [...list] });
    },
    close() {
      setSession(null);
    },
    onPrevious: neighbors?.previous ? () => go(-1) : undefined,
    onNext: neighbors?.next ? () => go(1) : undefined,
  };
}

export function MediaLightbox({
  src,
  name,
  kind,
  caption = "",
  position,
  onClose,
  onPrevious,
  onNext,
}: {
  src: string;
  name: string;
  kind: "image" | "video";
  caption?: string;
  position?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [actualSize, setActualSize] = useState(false);
  const [shownSrc, setShownSrc] = useState(src);
  const enlarged = actualSize && kind === "image";

  if (src !== shownSrc) {
    setShownSrc(src);
    setActualSize(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const hasNav = Boolean(onPrevious || onNext);

  return (
    <dialog
      ref={dialogRef}
      className={enlarged ? "media-lightbox is-actual" : "media-lightbox"}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLVideoElement) return;
        if (event.key === "ArrowLeft" && onPrevious) {
          event.preventDefault();
          onPrevious();
        } else if (event.key === "ArrowRight" && onNext) {
          event.preventDefault();
          onNext();
        }
      }}
    >
      <div className="media-lightbox-bar">
        <div className="media-lightbox-title">
          <strong id={titleId}>{name}</strong>
          {position ? <span className="media-lightbox-count">{position}</span> : null}
        </div>
        {hasNav ? (
          <div className="media-lightbox-nav">
            <button type="button" className="btn secondary lightbox-btn" onClick={onPrevious} disabled={!onPrevious}>
              Previous
            </button>
            <button type="button" className="btn secondary lightbox-btn" onClick={onNext} disabled={!onNext}>
              Next
            </button>
          </div>
        ) : null}
        {kind === "image" ? (
          <button
            type="button"
            className="btn secondary lightbox-btn"
            aria-pressed={enlarged}
            onClick={() => setActualSize((value) => !value)}
          >
            {enlarged ? "Fit to screen" : "Actual size"}
          </button>
        ) : null}
        <button type="button" className="btn secondary lightbox-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="media-lightbox-stage">
        <FullMedia key={src} className="media-lightbox-media" src={src} alt={name} kind={kind} />
      </div>
      {caption ? <p className="media-lightbox-caption">{caption}</p> : null}
    </dialog>
  );
}
