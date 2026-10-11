export type StoryLayout = "card" | "feature";

export const PRINT_PHOTO_LIMIT = 3;

type PrintableAsset = {
  id: string;
  kind: "image" | "video";
};

// The printed page keeps the letter, then a few photos. The cover leads,
// then one photo from each part of the day, then any leftovers up to the limit.
export function selectPrintImages<T extends PrintableAsset>(
  content: {
    coverAssetId: string;
    sections: { hidden: boolean; assetIds: string[] }[];
  },
  assets: T[],
  limit = PRINT_PHOTO_LIMIT,
): T[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const chosen: T[] = [];
  const seen = new Set<string>();
  const take = (id: string) => {
    if (!id || seen.has(id) || chosen.length >= limit) return false;
    const asset = byId.get(id);
    if (!asset || asset.kind !== "image") return false;
    seen.add(id);
    chosen.push(asset);
    return true;
  };

  take(content.coverAssetId);
  const leftovers: string[] = [];
  for (const section of content.sections) {
    if (section.hidden) continue;
    let tookFromSection = false;
    for (const id of section.assetIds) {
      if (!tookFromSection && take(id)) {
        tookFromSection = true;
        continue;
      }
      leftovers.push(id);
    }
  }
  for (const id of leftovers) take(id);
  return chosen;
}

export function storyIsWide(input: { id: string; imageCount: number; videoCount: number }) {
  if (input.id.startsWith("more-from-the-day")) return true;
  if (input.videoCount >= 2) return true;
  return input.imageCount >= 3;
}

// Pair short stories side by side. A leftover short story spans the row
// so it does not sit alone in the left column.
export function planStoryLayouts(wide: boolean[]): StoryLayout[] {
  const layout: StoryLayout[] = wide.map((isWide) => (isWide ? "feature" : "card"));
  let runStart = 0;
  const closeRun = (end: number) => {
    if ((end - runStart) % 2 === 1) layout[end - 1] = "feature";
  };
  wide.forEach((isWide, index) => {
    if (!isWide) return;
    closeRun(index);
    runStart = index + 1;
  });
  closeRun(wide.length);
  return layout;
}
