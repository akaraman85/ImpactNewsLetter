export type Placement = {
  sections: string[][];
  unassigned: string[];
};

export function placementFromSections(
  sectionAssetIds: string[][],
  orderedAssetIds: string[],
): Placement {
  const allowed = new Set(orderedAssetIds);
  const claimed = new Set<string>();
  const sections = sectionAssetIds.map((ids) => {
    const kept: string[] = [];
    for (const id of ids) {
      if (!allowed.has(id) || claimed.has(id)) continue;
      claimed.add(id);
      kept.push(id);
    }
    return kept;
  });
  return {
    sections,
    unassigned: orderedAssetIds.filter((id) => !claimed.has(id)),
  };
}

export function moveToSection(
  placement: Placement,
  orderedAssetIds: string[],
  sectionIndex: number,
  ids: string[],
): Placement {
  const section = placement.sections[sectionIndex];
  if (!section) return placement;
  const moving = new Set(ids);
  const incoming = orderedAssetIds.filter((id) => moving.has(id) && !section.includes(id));
  if (incoming.length === 0) return placement;
  const incomingSet = new Set(incoming);
  const sections = placement.sections.map((list, index) => {
    if (index === sectionIndex) return [...list, ...incoming];
    return list.filter((id) => !incomingSet.has(id));
  });
  const assigned = new Set(sections.flat());
  return {
    sections,
    unassigned: orderedAssetIds.filter((id) => !assigned.has(id)),
  };
}

export function removeFromSection(
  placement: Placement,
  orderedAssetIds: string[],
  sectionIndex: number,
  ids: string[],
): Placement {
  const section = placement.sections[sectionIndex];
  if (!section) return placement;
  const moving = new Set(ids);
  if (!section.some((id) => moving.has(id))) return placement;
  const sections = placement.sections.map((list, index) =>
    index === sectionIndex ? list.filter((id) => !moving.has(id)) : list,
  );
  const assigned = new Set(sections.flat());
  return {
    sections,
    unassigned: orderedAssetIds.filter((id) => !assigned.has(id)),
  };
}

export function idsNotInSection(
  placement: Placement,
  orderedAssetIds: string[],
  sectionIndex: number,
): string[] {
  const section = placement.sections[sectionIndex];
  if (!section) return [];
  const here = new Set(section);
  return orderedAssetIds.filter((id) => !here.has(id));
}
