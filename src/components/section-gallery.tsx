"use client";

import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  adoptMeasuredSize,
  galleryContainerWidth,
  galleryLabel,
  galleryRowConstraints,
  galleryRowHeight,
  sectionGalleryPhotos,
  sectionLightboxSlides,
  type GalleryAsset,
  type MeasuredSize,
} from "@/lib/section-gallery";
import { QueuedPreview } from "./queued-preview";

const SectionLightbox = dynamic(
  () => import("./section-lightbox").then((mod) => mod.SectionLightbox),
  { ssr: false },
);

function PlayMark() {
  return (
    <svg className="gallery-play-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 8.2v7.6l6.2-3.8L10 8.2Z" fill="currentColor" />
    </svg>
  );
}

export function SectionGallery({
  assets,
  span,
}: {
  assets: readonly GalleryAsset[];
  span: "card" | "feature";
}) {
  const [measured, setMeasured] = useState<Record<string, MeasuredSize>>({});
  const [index, setIndex] = useState(-1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const measuredRef = useRef(measured);
  const pending = useRef<Record<string, MeasuredSize>>({});
  const frame = useRef<number | null>(null);

  useEffect(() => {
    measuredRef.current = measured;
  }, [measured]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, []);

  function remember(id: string, width: number, height: number) {
    if (!assets.some((asset) => asset.id === id)) return;
    const next = adoptMeasuredSize("image", pending.current[id] ?? measuredRef.current[id], width, height);
    if (!next) return;
    pending.current[id] = next;
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const batch = pending.current;
      pending.current = {};
      setMeasured((current) => ({ ...current, ...batch }));
    });
  }

  const photos = useMemo(() => sectionGalleryPhotos(assets, measured), [assets, measured]);
  const slides = useMemo(() => sectionLightboxSlides(assets, measured), [assets, measured]);
  if (assets.length === 0) return null;

  return (
    <>
      <RowsPhotoAlbum
        photos={photos}
        spacing={8}
        padding={6}
        defaultContainerWidth={galleryContainerWidth(span)}
        targetRowHeight={(width) => galleryRowHeight(assets.length, width)}
        rowConstraints={(width) => galleryRowConstraints(assets.length, width)}
        onClick={({ index: photoIndex }) => setIndex(photoIndex)}
        componentsProps={{
          container: { className: "section-gallery", "aria-label": galleryLabel(assets) },
          button: ({ photo }) => ({ className: photo.kind === "video" ? "is-video" : undefined }),
        }}
        render={{
          image: (props, { photo }) => (
            <QueuedPreview
              className={props.className}
              src={typeof props.src === "string" ? props.src : ""}
              alt=""
              onReady={
                photo.kind === "image"
                  ? (image) => remember(photo.id, image.naturalWidth, image.naturalHeight)
                  : undefined
              }
              fallback={
                <span className={`${props.className ?? ""} gallery-missing`}>
                  {photo.kind === "video" ? "Video unavailable" : "Photo unavailable"}
                </span>
              }
            />
          ),
          extras: (_, { photo }) =>
            photo.kind === "video" ? (
              <span className="gallery-play" aria-hidden="true">
                <PlayMark />
              </span>
            ) : null,
        }}
      />
      {index >= 0 ? (
        <SectionLightbox
          index={index}
          slides={slides}
          reduceMotion={reduceMotion}
          onClose={() => setIndex(-1)}
        />
      ) : null}
    </>
  );
}
