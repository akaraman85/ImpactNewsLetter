import { z } from "zod";
import { emptyContent, normalizeContent, type NewsletterContent } from "./content";
import { FACTS_RULE, NAMES_RULE, NO_CATCHALL_RULE, THIN_NOTES_RULE, VOICE_RULE } from "./newsletter-rules";

export const READ_ISSUE_TOOL = "readIssue";
export const READ_ASSETS_TOOL = "readAssets";
export const PROPOSE_EDIT_TOOL = "proposeLetterEdit";

export const REVISE_TOOL_NAMES = [READ_ISSUE_TOOL, READ_ASSETS_TOOL, PROPOSE_EDIT_TOOL] as const;

const HEADLINE_LIMIT = 180;
const SUBTITLE_LIMIT = 220;
const INTRO_LIMIT = 4000;
const HEADING_LIMIT = 160;
const BODY_LIMIT = 4000;
const CLOSING_LIMIT = 2000;
const SUMMARY_LIMIT = 400;
const SECTION_LIMIT = 40;

const sectionSchema = z.object({
  id: z.string().describe("Keep this id when the section already exists."),
  heading: z.string(),
  body: z.string(),
  hidden: z.boolean().describe("True hides the section from families."),
  assetIds: z.array(z.string()).describe("Included asset ids. Use each id once in the whole letter."),
});

export const letterProposalSchema = z.object({
  summary: z.string().describe("One or two sentences telling staff what you changed."),
  headline: z.string(),
  subtitle: z.string(),
  intro: z.string(),
  coverAssetId: z.string().describe("Id of one included photo, or an empty string when there is no main image."),
  sections: z.array(sectionSchema),
  closing: z.string(),
});

export type LetterProposalInput = z.infer<typeof letterProposalSchema>;

const letterShape = z.object({
  headline: z.string(),
  subtitle: z.string(),
  intro: z.string(),
  coverAssetId: z.string(),
  closing: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      body: z.string(),
      hidden: z.boolean(),
      assetIds: z.array(z.string()),
    }),
  ),
});

export const modelIssueSchema = z.object({
  found: z.boolean(),
  title: z.string(),
  eventDate: z.string().nullable(),
  notes: z.string(),
  status: z.string(),
  letter: letterShape,
});

export const modelAssetSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  caption: z.string(),
  included: z.boolean(),
});

export const modelAssetsSchema = z.object({
  assets: z.array(modelAssetSchema),
});

export const proposalAckSchema = z.object({
  saved: z.literal(false),
  summary: z.string(),
  message: z.string(),
});

export type ProposalAsset = {
  id: string;
  kind: string;
  included: boolean;
  name?: string;
};

export type SanitizedProposal = NewsletterContent & { summary: string };

export function reviseSystemPrompt(programName: string) {
  return [
    `You revise a saved newsletter for families in ${programName}, a program for elementary students.`,
    FACTS_RULE,
    "You may keep a fact that is already in the saved letter. Do not add a fact that is in neither the staff notes nor the letter.",
    NAMES_RULE,
    VOICE_RULE,
    "Place photos and videos only by asset id from readAssets. Use each asset id at most once.",
    NO_CATCHALL_RULE,
    THIN_NOTES_RULE,
    "Do not publish, unpublish, archive, create a family link, or change who can read the letter. You cannot publish.",
    "Call readIssue and readAssets before you propose an edit. Both are read-only.",
    "When you have a concrete edit, call proposeLetterEdit with the full letter. Copy every field you are not changing. That tool does not save.",
    "Staff save by clicking Apply. Until they do, the letter is unchanged. Do not say you saved or published it.",
    "Keep a section id when you edit a section that already exists.",
  ].join(" ");
}

export function issueForModel(issue: {
  title: string;
  eventDate: string | null;
  notes: string;
  status: string;
  content: NewsletterContent;
}) {
  return {
    found: true as const,
    title: issue.title,
    eventDate: issue.eventDate,
    notes: issue.notes,
    status: issue.status,
    letter: {
      headline: issue.content.headline,
      subtitle: issue.content.subtitle,
      intro: issue.content.intro,
      coverAssetId: issue.content.coverAssetId,
      closing: issue.content.closing,
      sections: issue.content.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        body: section.body,
        hidden: section.hidden,
        assetIds: [...section.assetIds],
      })),
    },
  };
}

export function missingIssue() {
  const letter = emptyContent();
  return {
    found: false as const,
    title: "",
    eventDate: null,
    notes: "",
    status: "",
    letter: {
      headline: letter.headline,
      subtitle: letter.subtitle,
      intro: letter.intro,
      coverAssetId: letter.coverAssetId,
      closing: letter.closing,
      sections: letter.sections,
    },
  };
}

export function assetsForModel<
  T extends { id: string; kind: string; name: string; caption: string; included: boolean },
>(assets: T[]) {
  return assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    caption: asset.caption,
    included: asset.included,
  }));
}

export function acknowledgeProposal(summary: string) {
  return {
    saved: false as const,
    summary: summary.trim().slice(0, SUMMARY_LIMIT),
    message:
      "Not saved. Staff save this proposal with Apply on the issue page. That does not publish the letter.",
  };
}

function clip(value: string, limit: number) {
  return value.trim().slice(0, limit);
}

function uniqueSectionId(raw: string, index: number, used: Set<string>) {
  const base = clip(raw, 80) || `section-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

export function sanitizeLetterProposal(
  input: LetterProposalInput,
  assets: ProposalAsset[],
): SanitizedProposal {
  const known = new Map<string, ProposalAsset>();
  for (const asset of assets) {
    if (!asset.included || !asset.id) continue;
    known.set(asset.id, asset);
  }
  const cover = known.get(input.coverAssetId.trim());
  const coverAssetId = cover && cover.kind !== "video" ? cover.id : "";
  const usedIds = new Set<string>();
  const sections = input.sections.slice(0, SECTION_LIMIT).map((section, index) => ({
    id: uniqueSectionId(section.id, index, usedIds),
    heading: clip(section.heading, HEADING_LIMIT),
    body: clip(section.body, BODY_LIMIT),
    hidden: section.hidden === true,
    assetIds: section.assetIds.filter((id) => known.has(id.trim())).map((id) => id.trim()),
  }));
  const content = normalizeContent({
    headline: clip(input.headline, HEADLINE_LIMIT),
    subtitle: clip(input.subtitle, SUBTITLE_LIMIT),
    intro: clip(input.intro, INTRO_LIMIT),
    coverAssetId,
    sections,
    closing: clip(input.closing, CLOSING_LIMIT),
  });
  return { ...content, summary: clip(input.summary, SUMMARY_LIMIT) };
}

export function letterFields(issueId: string, content: NewsletterContent) {
  const fields: Array<{ name: string; value: string }> = [
    { name: "id", value: issueId },
    { name: "headline", value: content.headline },
    { name: "subtitle", value: content.subtitle },
    { name: "intro", value: content.intro },
    { name: "coverAssetId", value: content.coverAssetId },
    { name: "closing", value: content.closing },
    { name: "sectionCount", value: String(content.sections.length) },
  ];
  content.sections.forEach((section, index) => {
    fields.push(
      { name: `section-id-${index}`, value: section.id },
      { name: `section-heading-${index}`, value: section.heading },
      { name: `section-body-${index}`, value: section.body },
      { name: `section-hidden-${index}`, value: section.hidden ? "1" : "0" },
    );
    for (const assetId of section.assetIds) {
      fields.push({ name: `section-assets-${index}`, value: assetId });
    }
  });
  return fields;
}

export function letterFormData(issueId: string, content: NewsletterContent) {
  const data = new FormData();
  for (const field of letterFields(issueId, content)) data.append(field.name, field.value);
  return data;
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function contentFromLetterForm(formData: FormData, fallback: string): NewsletterContent {
  const sectionCount = Number(formText(formData, "sectionCount") || "0");
  const sections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const id = formText(formData, `section-id-${index}`) || `section-${index + 1}`;
    sections.push({
      id,
      heading: formText(formData, `section-heading-${index}`).slice(0, HEADING_LIMIT),
      body: formText(formData, `section-body-${index}`).slice(0, BODY_LIMIT),
      hidden: formText(formData, `section-hidden-${index}`) === "1",
      assetIds: formData
        .getAll(`section-assets-${index}`)
        .filter((value): value is string => typeof value === "string"),
    });
  }
  return normalizeContent({
    headline: formText(formData, "headline").slice(0, HEADLINE_LIMIT) || fallback,
    subtitle: formText(formData, "subtitle").slice(0, SUBTITLE_LIMIT),
    intro: formText(formData, "intro").slice(0, INTRO_LIMIT),
    coverAssetId: formText(formData, "coverAssetId"),
    sections,
    closing: formText(formData, "closing").slice(0, CLOSING_LIMIT),
  });
}
