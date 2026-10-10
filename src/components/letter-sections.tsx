"use client";

import { useEffect, useRef, useState } from "react";
import { mediaPreviewSrc } from "@/lib/media-picker";
import {
  idsNotInSection,
  moveToSection,
  placementFromSections,
  removeFromSection,
} from "@/lib/section-placement";
import { MediaLightbox, useMediaViewer } from "./media-lightbox";
import { QueuedPreview } from "./queued-preview";

type PickerAsset = {
  id: string;
  name: string;
  kind: "image" | "video";
  src: string;
  caption?: string;
};

type PickerSection = {
  id: string;
  heading: string;
  body: string;
  assetIds: string[];
};

function PlaceBar({
  selectedCount,
  labels,
  canAdd,
  onAdd,
  onClear,
}: {
  selectedCount: number;
  labels: string[];
  canAdd: (index: number) => boolean;
  onAdd: (index: number) => void;
  onClear: () => void;
}) {
  return (
    <div className="picker-bar">
      <span>{selectedCount === 0 ? "Select photos, then add them to a section." : `${selectedCount} selected`}</span>
      {labels.map((label, index) => (
        <button
          key={index}
          type="button"
          className="btn secondary"
          title={`Add to ${label}`}
          disabled={!canAdd(index)}
          onClick={() => onAdd(index)}
        >
          Add to {label}
        </button>
      ))}
      {selectedCount > 0 ? (
        <button type="button" className="text-button" onClick={onClear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

function sectionLabel(heading: string, index: number) {
  const trimmed = heading.trim();
  return trimmed || `Section ${index + 1}`;
}

function toggleSelected(current: Set<string>, list: string[], anchorId: string | null, id: string, shift: boolean) {
  const next = new Set(current);
  if (shift && anchorId && list.includes(anchorId) && list.includes(id)) {
    const start = list.indexOf(anchorId);
    const end = list.indexOf(id);
    const [from, to] = start < end ? [start, end] : [end, start];
    const turnOn = !current.has(id);
    for (const item of list.slice(from, to + 1)) {
      if (turnOn) next.add(item);
      else next.delete(item);
    }
    return next;
  }
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function PickerPreview({ src, kind }: { src: string; kind: "image" | "video" }) {
  return (
    <QueuedPreview
      key={src}
      className="picker-preview"
      src={mediaPreviewSrc(src, "thumb")}
      alt=""
      fallback={<span className="picker-fallback">{kind === "video" ? "Video" : "Preview unavailable"}</span>}
    />
  );
}

function PhotoCard({
  asset,
  selected,
  note,
  onToggle,
  onRemove,
  onViewFull,
}: {
  asset: PickerAsset;
  selected: boolean;
  note?: string;
  onToggle: (shift: boolean) => void;
  onRemove?: () => void;
  onViewFull: () => void;
}) {
  return (
    <div className={selected ? "picker-card on" : "picker-card"}>
      <button
        type="button"
        className="picker-hit"
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} ${asset.name}`}
        onClick={(event) => onToggle(event.shiftKey)}
      >
        <span className="picker-frame">
          <PickerPreview src={asset.src} kind={asset.kind} />
          {asset.kind === "video" ? <span className="picker-kind">Video</span> : null}
        </span>
        <span className="picker-name">{asset.name}</span>
        {note ? <span className="picker-note">{note}</span> : null}
      </button>
      <button
        type="button"
        className="text-button picker-fullsize"
        aria-label={`View ${asset.name} full size`}
        onClick={onViewFull}
      >
        Full size
      </button>
      {onRemove ? (
        <button type="button" className="picker-remove" aria-label={`Remove ${asset.name} from this section`} onClick={onRemove}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

function SectionFilePicker({
  id,
  label,
  assets,
  placedIn,
  onAdd,
  onView,
}: {
  id: string;
  label: string;
  assets: PickerAsset[];
  placedIn: Record<string, string>;
  onAdd: (ids: string[]) => void;
  onView: (asset: PickerAsset, list: PickerAsset[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const anchorId = useRef<string | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = assets.filter((asset) => !needle || asset.name.toLowerCase().includes(needle));
  const shownIds = shown.map((asset) => asset.id);
  const shownAllSelected = shownIds.length > 0 && shownIds.every((assetId) => picked.has(assetId));
  const moves = shown.some((asset) => placedIn[asset.id]);

  return (
    <div className="section-add-panel" id={id}>
      <div className="picker-tools">
        <label className="field picker-filter">
          <span>Choose photos and videos for {label}</span>
          <input
            type="search"
            value={query}
            placeholder="File name"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        </label>
        {shown.length > 1 ? (
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setPicked((current) => {
                const next = new Set(current);
                for (const assetId of shownIds) {
                  if (shownAllSelected) next.delete(assetId);
                  else next.add(assetId);
                }
                return next;
              });
            }}
          >
            {shownAllSelected ? "Clear shown" : "Select shown"}
          </button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="muted">No files match that name.</p>
      ) : (
        <div className="picker-grid" role="group" aria-label={`Files to add to ${label}`}>
          {shown.map((asset) => (
            <PhotoCard
              key={asset.id}
              asset={asset}
              note={placedIn[asset.id] ? `In ${placedIn[asset.id]}` : undefined}
              selected={picked.has(asset.id)}
              onToggle={(shift) => {
                setPicked((current) => toggleSelected(current, shownIds, anchorId.current, asset.id, shift));
                anchorId.current = asset.id;
              }}
              onViewFull={() => onView(asset, shown)}
            />
          ))}
        </div>
      )}
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={picked.size === 0}
          onClick={() => {
            onAdd([...picked]);
            setPicked(new Set());
            anchorId.current = null;
          }}
        >
          {picked.size === 0 ? "Add to this section" : `Add ${picked.size} to this section`}
        </button>
      </div>
      {moves ? <p className="muted">A file already in another section moves here.</p> : null}
    </div>
  );
}

export function LetterSections({
  sections,
  assets,
}: {
  sections: PickerSection[];
  assets: PickerAsset[];
}) {
  const orderedIds = assets.map((asset) => asset.id);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const [placement, setPlacement] = useState(() =>
    placementFromSections(
      sections.map((section) => section.assetIds),
      orderedIds,
    ),
  );
  const [headings, setHeadings] = useState(() => sections.map((section) => section.heading));
  const [bodies, setBodies] = useState(() => sections.map((section) => section.body));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [adderIndex, setAdderIndex] = useState<number | null>(null);
  const anchorId = useRef<string | null>(null);
  const viewer = useMediaViewer<PickerAsset>();

  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash;
      const prefix = "#letter-section-";
      if (!hash.startsWith(prefix)) return;
      let id = hash.slice(prefix.length);
      try {
        id = decodeURIComponent(id);
      } catch {
        return;
      }
      const index = sections.findIndex((section) => section.id === id);
      if (index >= 0) setAdderIndex(index);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [sections]);

  const needle = query.trim().toLowerCase();
  const unassigned = placement.unassigned.filter((id) => {
    if (!needle) return true;
    return byId.get(id)?.name.toLowerCase().includes(needle) ?? false;
  });

  function toggle(id: string, list: string[], shift: boolean) {
    setSelected((current) => toggleSelected(current, list, anchorId.current, id, shift));
    anchorId.current = id;
  }

  function addIds(index: number, ids: string[]) {
    setPlacement((current) => moveToSection(current, orderedIds, index, ids));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function addTo(index: number) {
    addIds(index, [...selected]);
    setSelected(new Set());
    anchorId.current = null;
  }

  function removeIds(index: number, ids: string[]) {
    setPlacement((current) => removeFromSection(current, orderedIds, index, ids));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  const shownAllSelected = unassigned.length > 0 && unassigned.every((id) => selected.has(id));
  const placedIn: Record<string, string> = {};
  placement.sections.forEach((ids, sectionIndex) => {
    const name = sectionLabel(headings[sectionIndex] ?? "", sectionIndex);
    for (const id of ids) placedIn[id] = name;
  });

  function canAddTo(index: number) {
    const here = new Set(placement.sections[index]);
    return [...selected].some((id) => !here.has(id));
  }

  return (
    <div className="letter-sections">
      <div hidden>
        {placement.sections.map((ids, index) =>
          ids.map((id) => (
            <input key={`${sections[index]?.id ?? index}-${id}`} type="hidden" name={`section-assets-${index}`} value={id} />
          )),
        )}
      </div>

      {sections.map((section, index) => {
        const ids = placement.sections[index] ?? [];
        const selectedHere = ids.filter((id) => selected.has(id));
        const label = sectionLabel(headings[index] ?? "", index);
        const candidates = idsNotInSection(placement, orderedIds, index).flatMap((id) => {
          const asset = byId.get(id);
          return asset ? [asset] : [];
        });
        const adderOpen = adderIndex === index;
        return (
          <fieldset className="section-card" id={`letter-section-${section.id}`} key={section.id}>
            <input type="hidden" name={`section-id-${index}`} value={section.id} />
            <label className="field">
              <span>Section heading</span>
              <input
                name={`section-heading-${index}`}
                value={headings[index] ?? ""}
                onChange={(event) =>
                  setHeadings((current) => current.map((heading, headingIndex) => (headingIndex === index ? event.target.value : heading)))
                }
              />
            </label>
            <label className="field">
              <span>Section text</span>
              <textarea
                name={`section-body-${index}`}
                value={bodies[index] ?? ""}
                onChange={(event) =>
                  setBodies((current) => current.map((body, bodyIndex) => (bodyIndex === index ? event.target.value : body)))
                }
              />
            </label>
            <div className="stack">
              <div className="row">
                <span className="quiet-label">In this section</span>
                <span className="muted">{ids.length}</span>
                {candidates.length > 0 ? (
                  <button
                    type="button"
                    className={ids.length === 0 ? "btn" : "btn secondary"}
                    aria-expanded={adderOpen}
                    aria-controls={`section-add-${section.id}`}
                    onClick={() => setAdderIndex((current) => (current === index ? null : index))}
                  >
                    {adderOpen ? "Hide files" : "Add photos and videos"}
                  </button>
                ) : assets.length > 0 ? (
                  <span className="muted">All included files are in this section.</span>
                ) : null}
                {selectedHere.length > 0 ? (
                  <button type="button" className="btn secondary" onClick={() => removeIds(index, selectedHere)}>
                    Remove selected
                  </button>
                ) : null}
              </div>
              {assets.length === 0 ? (
                <p className="muted">
                  Include photos or videos in <a href="#photos-library">Photos and videos</a> and save, then add them here.
                </p>
              ) : null}
              {adderOpen && candidates.length > 0 ? (
                <SectionFilePicker
                  id={`section-add-${section.id}`}
                  label={label}
                  assets={candidates}
                  placedIn={placedIn}
                  onAdd={(picked) => {
                    addIds(index, picked);
                    setAdderIndex(null);
                  }}
                  onView={(asset, list) => viewer.open(asset, list)}
                />
              ) : null}
              {ids.length === 0 && !adderOpen ? (
                assets.length === 0 ? null : (
                  <p className="muted">Nothing in this section yet.</p>
                )
              ) : ids.length === 0 ? null : (
                <div className="picker-grid" role="group" aria-label={`Photos in ${label}`}>
                  {ids.map((id) => {
                    const asset = byId.get(id);
                    if (!asset) return null;
                    return (
                      <PhotoCard
                        key={id}
                        asset={asset}
                        selected={selected.has(id)}
                        onToggle={(shift) => toggle(id, ids, shift)}
                        onRemove={() => removeIds(index, [id])}
                        onViewFull={() =>
                          viewer.open(
                            asset,
                            ids.flatMap((itemId) => {
                              const item = byId.get(itemId);
                              return item ? [item] : [];
                            }),
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </fieldset>
        );
      })}

      <div className="stack">
        <p className="quiet-label">Photos still to place</p>
        <p className="muted">
          Each photo or video goes in one section. On a section, choose Add photos and videos, or
          select files here and add that group. Full size opens the whole picture. Anything left in
          this tray still shows on the family page under More from the day.
        </p>
        {assets.length > 0 && sections.length > 0 ? (
          <PlaceBar
            selectedCount={selected.size}
            labels={sections.map((section, index) => sectionLabel(headings[index] ?? "", index))}
            canAdd={canAddTo}
            onAdd={addTo}
            onClear={() => {
              setSelected(new Set());
              anchorId.current = null;
            }}
          />
        ) : null}
        {assets.length === 0 ? (
          <p className="muted">
            No photos or videos are included yet. In <a href="#photos-library">Photos and videos</a>, check Include and save.
          </p>
        ) : placement.unassigned.length === 0 ? (
          <p className="muted">Every included photo is in a section.</p>
        ) : (
          <>
            <div className="picker-tools">
              {placement.unassigned.length > 8 ? (
                <label className="field picker-filter">
                  <span>Filter by file name</span>
                  <input
                    type="search"
                    value={query}
                    placeholder="IMG_1802"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setSelected((current) => {
                    const next = new Set(current);
                    for (const id of unassigned) {
                      if (shownAllSelected) next.delete(id);
                      else next.add(id);
                    }
                    return next;
                  });
                }}
              >
                {shownAllSelected ? "Clear shown" : "Select shown"}
              </button>
              <span className="muted">
                {placement.unassigned.length} still to place
                {needle ? ` · ${unassigned.length} shown` : ""}
              </span>
            </div>
            {unassigned.length === 0 ? (
              <p className="muted">No files match that filter.</p>
            ) : (
              <div className="picker-grid" role="group" aria-label="Photos not in a section">
                {unassigned.map((id) => {
                  const asset = byId.get(id);
                  if (!asset) return null;
                  return (
                    <PhotoCard
                      key={id}
                      asset={asset}
                      selected={selected.has(id)}
                      onToggle={(shift) => toggle(id, unassigned, shift)}
                      onViewFull={() =>
                        viewer.open(
                          asset,
                          unassigned.flatMap((itemId) => {
                            const item = byId.get(itemId);
                            return item ? [item] : [];
                          }),
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
            {placement.unassigned.length > 8 && sections.length > 0 ? (
              <PlaceBar
                selectedCount={selected.size}
                labels={sections.map((section, index) => sectionLabel(headings[index] ?? "", index))}
                canAdd={canAddTo}
                onAdd={addTo}
                onClear={() => {
                  setSelected(new Set());
                  anchorId.current = null;
                }}
              />
            ) : null}
          </>
        )}
        {assets.length > 0 && sections.length === 0 ? (
          <p className="muted">Add a section, then you can place photos in it.</p>
        ) : null}
      </div>
      {viewer.current ? (
        <MediaLightbox
          src={viewer.current.src}
          name={viewer.current.name}
          kind={viewer.current.kind}
          caption={viewer.current.caption ?? ""}
          position={viewer.position}
          onClose={viewer.close}
          onPrevious={viewer.onPrevious}
          onNext={viewer.onNext}
        />
      ) : null}
    </div>
  );
}
