export type NewsletterSection = {
  id: string;
  heading: string;
  body: string;
  assetIds: string[];
  hidden: boolean;
};

export type NewsletterContent = {
  headline: string;
  subtitle: string;
  intro: string;
  coverAssetId: string;
  sections: NewsletterSection[];
  closing: string;
};

export function emptyContent(headline = ""): NewsletterContent {
  return {
    headline,
    subtitle: "",
    intro: "",
    coverAssetId: "",
    sections: [],
    closing: "",
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseContent(value: unknown, fallbackHeadline = ""): NewsletterContent {
  if (!value || typeof value !== "object") return emptyContent(fallbackHeadline);
  const record = value as Record<string, unknown>;
  const sections = Array.isArray(record.sections)
    ? record.sections.flatMap((section) => {
        if (!section || typeof section !== "object") return [];
        const item = section as Record<string, unknown>;
        const id = asString(item.id);
        if (!id) return [];
        const assetIds = Array.isArray(item.assetIds)
          ? item.assetIds.filter((id): id is string => typeof id === "string")
          : [];
        return [
          {
            id,
            heading: asString(item.heading),
            body: asString(item.body),
            assetIds,
            hidden: item.hidden === true,
          },
        ];
      })
    : [];
  return normalizeContent({
    headline: asString(record.headline) || fallbackHeadline,
    subtitle: asString(record.subtitle),
    intro: asString(record.intro),
    coverAssetId: asString(record.coverAssetId),
    sections,
    closing: asString(record.closing),
  });
}

// The main image leads the letter once. A hidden section stays in the editor
// and stays off the family page, with its photos still claimed.
export function normalizeContent(content: NewsletterContent): NewsletterContent {
  const coverAssetId = content.coverAssetId.trim();
  const seen = new Set<string>();
  if (coverAssetId) seen.add(coverAssetId);
  return {
    ...content,
    coverAssetId,
    sections: content.sections.map((section) => {
      const assetIds: string[] = [];
      for (const id of section.assetIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        assetIds.push(id);
      }
      return {
        ...section,
        hidden: section.hidden === true,
        assetIds,
      };
    }),
  };
}

export function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
