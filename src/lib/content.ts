export type NewsletterSection = {
  id: string;
  heading: string;
  body: string;
  assetIds: string[];
};

export type NewsletterContent = {
  headline: string;
  subtitle: string;
  intro: string;
  sections: NewsletterSection[];
  closing: string;
};

export function emptyContent(headline = ""): NewsletterContent {
  return {
    headline,
    subtitle: "",
    intro: "",
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
          },
        ];
      })
    : [];
  return {
    headline: asString(record.headline) || fallbackHeadline,
    subtitle: asString(record.subtitle),
    intro: asString(record.intro),
    sections,
    closing: asString(record.closing),
  };
}

export function placeUnusedAssets(
  content: NewsletterContent,
  includedIds: string[],
): NewsletterContent {
  const used = new Set(content.sections.flatMap((section) => section.assetIds));
  const missing = includedIds.filter((id) => !used.has(id));
  if (missing.length === 0) return content;
  return {
    ...content,
    sections: [
      ...content.sections,
      {
        id: "more-from-the-day",
        heading: "More from the day",
        body: "",
        assetIds: missing,
      },
    ],
  };
}

export function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
