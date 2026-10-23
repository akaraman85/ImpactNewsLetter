import { generateText, Output } from "ai";
import { z } from "zod";
import { normalizeContent, type NewsletterContent } from "./content";
import type { Asset } from "./data";
import { draftInstructions } from "./newsletter-rules";

const sectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
  assetIds: z.array(z.string()),
});

const draftSchema = z.object({
  headline: z.string(),
  subtitle: z.string(),
  intro: z.string(),
  sections: z.array(sectionSchema),
  closing: z.string(),
});

const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

export function newsletterModel() {
  return process.env.NEWSLETTER_MODEL?.trim() || DEFAULT_MODEL;
}

export async function draftNewsletter(input: {
  title: string;
  eventDate: string | null;
  notes: string;
  programName: string;
  assets: Asset[];
  coverAssetId?: string;
}): Promise<NewsletterContent> {
  const included = input.assets.filter((asset) => asset.included);
  const catalog = included
    .map(
      (asset) =>
        `- id: ${asset.id}; kind: ${asset.kind}; file: ${asset.name}; caption: ${asset.caption || "(none)"}`,
    )
    .join("\n");

  const { output } = await generateText({
    model: newsletterModel(),
    output: Output.object({
      schema: draftSchema,
      name: "newsletter",
      description: "A short parent newsletter composed only from the supplied notes and photo ids.",
    }),
    instructions: draftInstructions(input.programName),
    prompt: [
      `Issue title: ${input.title}`,
      `Event date: ${input.eventDate || "not set"}`,
      "",
      "Staff notes:",
      input.notes || "(no notes yet)",
      "",
      "Photos and videos to place:",
      catalog || "(none selected)",
    ].join("\n"),
  });

  if (!output) {
    throw new Error("The model returned an empty draft.");
  }

  const known = new Set(included.map((asset) => asset.id));
  const sections = output.sections.map((section, index) => ({
    id: `section-${index + 1}`,
    heading: section.heading.trim(),
    body: section.body.trim(),
    hidden: false,
    assetIds: section.assetIds.filter((id) => known.has(id)),
  }));
  const coverAssetId =
    input.coverAssetId &&
    included.some((asset) => asset.id === input.coverAssetId && asset.kind !== "video")
      ? input.coverAssetId
      : "";

  return normalizeContent({
    headline: output.headline.trim() || input.title,
    subtitle: output.subtitle.trim(),
    intro: output.intro.trim(),
    coverAssetId,
    sections,
    closing: output.closing.trim(),
  });
}
