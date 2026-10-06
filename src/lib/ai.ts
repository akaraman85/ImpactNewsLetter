import { generateText, Output } from "ai";
import { z } from "zod";
import { placeUnusedAssets, type NewsletterContent } from "./content";
import type { Asset } from "./data";

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

export async function draftNewsletter(input: {
  title: string;
  eventDate: string | null;
  notes: string;
  programName: string;
  assets: Asset[];
}): Promise<NewsletterContent> {
  const included = input.assets.filter((asset) => asset.included);
  const catalog = included
    .map(
      (asset) =>
        `- id: ${asset.id}; kind: ${asset.kind}; file: ${asset.name}; caption: ${asset.caption || "(none)"}`,
    )
    .join("\n");

  const { output } = await generateText({
    model: process.env.NEWSLETTER_MODEL || DEFAULT_MODEL,
    output: Output.object({
      schema: draftSchema,
      name: "newsletter",
      description: "A short parent newsletter composed only from the supplied notes and photo ids.",
    }),
    instructions: [
      `You write a short newsletter for families in ${input.programName}, a program for elementary students.`,
      "Use only facts that appear in the staff notes. Do not invent names, scores, awards, quotes, or events.",
      "Do not add a child's full name unless the notes already include it.",
      "Write the way a trusted teacher would write to parents: warm, specific, and brief.",
      "Group the photos into a few sections. Use each supplied photo id at most once.",
      "If the notes are thin, keep the writing thin too. A short true note is better than a polished invention.",
    ].join(" "),
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
    assetIds: section.assetIds.filter((id) => known.has(id)),
  }));

  return placeUnusedAssets(
    {
      headline: output.headline.trim() || input.title,
      subtitle: output.subtitle.trim(),
      intro: output.intro.trim(),
      sections,
      closing: output.closing.trim(),
    },
    included.map((asset) => asset.id),
  );
}
