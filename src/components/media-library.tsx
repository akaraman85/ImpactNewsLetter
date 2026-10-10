"use client";

import { useEffect, useMemo, useState } from "react";
import { moveAsset, removeAsset } from "@/lib/actions";
import {
  filterLibrary,
  sectionHeading,
  sectionsForAsset,
  type LetterSectionRef,
  type LibraryFilter,
} from "@/lib/media-picker";
import { MediaLightbox, useMediaViewer } from "./media-lightbox";
import { FullMedia, MediaThumb } from "./media-thumb";

export type EditorMedia = {
  id: string;
  name: string;
  kind: "image" | "video";
  included: boolean;
  caption: string;
  src: string;
};

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Photos" },
  { id: "video", label: "Videos" },
  { id: "included", label: "Included" },
  { id: "excluded", label: "Left out" },
];

export function MediaLibrary({
  issueId,
  assets,
  sections,
}: {
  issueId: string;
  assets: EditorMedia[];
  sections: LetterSectionRef[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(assets.map((asset) => [asset.id, asset.included])),
  );
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(assets.map((asset) => [asset.id, asset.caption])),
  );
  const viewer = useMediaViewer<EditorMedia>();

  const visible = useMemo(
    () =>
      filterLibrary(
        assets.map((asset) => ({ ...asset, included: included[asset.id] ?? false })),
        filter,
        query,
      ),
    [assets, filter, included, query],
  );
  const open = visible.find((asset) => asset.id === openId) ?? null;
  const openShownId = open?.id ?? null;

  useEffect(() => {
    if (!openShownId) return;
    document.getElementById("media-detail")?.scrollIntoView({ block: "nearest" });
  }, [openShownId]);
  const openIndex = open ? assets.findIndex((asset) => asset.id === open.id) : -1;
  const photoCount = assets.filter((asset) => asset.kind === "image").length;
  const videoCount = assets.length - photoCount;

  return (
    <div className="stack">
      {assets.map((asset) => (
        <input
          key={`caption-${asset.id}`}
          type="hidden"
          form="photos"
          name={`caption-${asset.id}`}
          value={captions[asset.id] ?? ""}
        />
      ))}
      {assets.map((asset) =>
        included[asset.id] ? (
          <input key={`included-${asset.id}`} type="hidden" form="photos" name="included" value={asset.id} />
        ) : null,
      )}

      <div className="library-tools">
        <label className="field library-search">
          <span>Search files</span>
          <input
            type="search"
            value={query}
            placeholder="Name, photo, or video"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="chips" role="toolbar" aria-label="Filter files">
          {FILTERS.map((item) => {
            const count = filterLibrary(
              assets.map((asset) => ({ ...asset, included: included[asset.id] ?? false })),
              item.id,
              query,
            ).length;
            return (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "chip is-on" : "chip"}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="muted" aria-live="polite">
        {visible.length === assets.length
          ? `${assets.length} files · ${photoCount} photos · ${videoCount} videos`
          : `Showing ${visible.length} of ${assets.length}`}
      </p>

      <div className="library-scroll" tabIndex={0} aria-label="Photo and video files">
        {visible.length === 0 ? (
          <p className="muted">No files match.</p>
        ) : (
          <ul className="media-grid">
            {visible.map((asset) => {
              const isIncluded = included[asset.id] ?? false;
              const selected = openId === asset.id;
              return (
                <li
                  key={asset.id}
                  className={`media-tile${selected ? " is-selected" : ""}${isIncluded ? "" : " is-out"}`}
                >
                  <button
                    type="button"
                    className="tile-hit"
                    aria-expanded={selected}
                    onClick={() => setOpenId((current) => (current === asset.id ? null : asset.id))}
                  >
                    <MediaThumb alt={asset.name} src={asset.src} kind={asset.kind} />
                    <span className="tile-name">{asset.name}</span>
                    <span className="tile-kind">{asset.kind === "video" ? "Video" : "Photo"}</span>
                  </button>
                  <label className="tile-include">
                    <input
                      type="checkbox"
                      checked={isIncluded}
                      onChange={(event) =>
                        setIncluded((current) => ({ ...current, [asset.id]: event.target.checked }))
                      }
                    />
                    Include
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {open ? (
        <div className="media-detail" id="media-detail">
          <div className="row spread">
            <strong className="tile-name">{open.name}</strong>
            <button type="button" className="text-button" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
          <p className="muted">{open.kind === "video" ? "Video" : "Photo"}</p>
          {open.kind === "image" ? (
            <button
              type="button"
              className="detail-zoom"
              aria-label={`View ${open.name} full size`}
              onClick={() => viewer.open(open, visible)}
            >
              <FullMedia key={open.id} className="detail-photo" src={open.src} alt="" kind="image" />
              <span className="detail-zoom-label">Full size</span>
            </button>
          ) : (
            <div className="detail-stage">
              <FullMedia key={open.id} className="detail-photo" src={open.src} alt={open.name} kind="video" />
            </div>
          )}
          <PlacementLine assetId={open.id} sections={sections} />
          <label className="field">
            <span>Caption</span>
            <input
              value={captions[open.id] ?? ""}
              maxLength={300}
              placeholder="Optional"
              onChange={(event) =>
                setCaptions((current) => ({ ...current, [open.id]: event.target.value }))
              }
            />
          </label>
          <div className="row">
            <form action={moveAsset}>
              <input type="hidden" name="id" value={issueId} />
              <button
                className="btn secondary"
                name="move"
                value={`${open.id}:up`}
                type="submit"
                disabled={openIndex <= 0}
              >
                Up
              </button>
            </form>
            <form action={moveAsset}>
              <input type="hidden" name="id" value={issueId} />
              <button
                className="btn secondary"
                name="move"
                value={`${open.id}:down`}
                type="submit"
                disabled={openIndex < 0 || openIndex >= assets.length - 1}
              >
                Down
              </button>
            </form>
            <form action={removeAsset}>
              <input type="hidden" name="id" value={issueId} />
              <button className="btn danger" name="assetId" value={open.id} type="submit">
                Remove
              </button>
            </form>
            <button type="button" className="btn secondary" onClick={() => viewer.open(open, visible)}>
              Full size
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Select a file to see the whole picture, edit the caption, move it, or remove it.</p>
      )}
      {viewer.current ? (
        <MediaLightbox
          src={viewer.current.src}
          name={viewer.current.name}
          kind={viewer.current.kind}
          caption={captions[viewer.current.id] ?? ""}
          position={viewer.position}
          onClose={viewer.close}
          onPrevious={viewer.onPrevious}
          onNext={viewer.onNext}
        />
      ) : null}
    </div>
  );
}

function PlacementLine({ assetId, sections }: { assetId: string; sections: LetterSectionRef[] }) {
  const matches = sectionsForAsset(sections, assetId);
  if (matches.length === 0) {
    if (sections.length === 0) {
      return (
        <p className="muted">
          Add a section in the letter, then choose Add photos and videos on that section.
        </p>
      );
    }
    return (
      <p className="muted">
        Not in a section yet. Open a section and choose Add photos and videos:{" "}
        {sections.map((section, index) => (
          <span key={section.id}>
            {index > 0 ? (index === sections.length - 1 ? " or " : ", ") : null}
            <a href={`#letter-section-${section.id}`}>{sectionHeading(section)}</a>
          </span>
        ))}
        .
      </p>
    );
  }
  return (
    <p className="muted">
      In{" "}
      {matches.map((section, index) => (
        <span key={section.id}>
          {index > 0 ? ", " : null}
          <a href={`#letter-section-${section.id}`}>{sectionHeading(section)}</a>
        </span>
      ))}
      .
    </p>
  );
}
