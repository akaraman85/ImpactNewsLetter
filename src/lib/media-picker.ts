export type LibraryFilter = "all" | "image" | "video" | "included" | "excluded";

export type LibraryItem = {
  name: string;
  kind: string;
  included: boolean;
};

export type LetterSectionRef = {
  id: string;
  heading: string;
  assetIds: string[];
};

export function sectionHeading(section: LetterSectionRef) {
  return section.heading.trim() || "Untitled section";
}

function kindWords(kind: string) {
  if (kind === "image") return "photo image";
  if (kind === "video") return "video";
  return kind;
}

export function matchesLibrary(asset: LibraryItem, filter: LibraryFilter, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle && !`${asset.name} ${kindWords(asset.kind)}`.toLowerCase().includes(needle)) return false;
  if (filter === "image" || filter === "video") return asset.kind === filter;
  if (filter === "included") return asset.included;
  if (filter === "excluded") return !asset.included;
  return true;
}

export function filterLibrary<T extends LibraryItem>(assets: T[], filter: LibraryFilter, query: string) {
  return assets.filter((asset) => matchesLibrary(asset, filter, query));
}

export function uniqueKnownIds(ids: string[], known: ReadonlySet<string>) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function toggleId(ids: string[], id: string) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  return [...ids, id];
}

export function moveId(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = ids.slice();
  const [item] = next.splice(index, 1);
  if (!item) return ids;
  next.splice(target, 0, item);
  return next;
}

export function sectionsForAsset(sections: LetterSectionRef[], assetId: string) {
  return sections.filter((section) => section.assetIds.includes(assetId));
}
