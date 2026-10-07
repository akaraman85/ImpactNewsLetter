export type StoryLayout = "card" | "feature";

export function storyIsWide(input: { id: string; imageCount: number; videoCount: number }) {
  if (input.id === "more-from-the-day") return true;
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
