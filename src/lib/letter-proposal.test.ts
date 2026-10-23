import assert from "node:assert/strict";
import test from "node:test";
import type { NewsletterContent } from "./content.ts";
import {
  PROPOSE_EDIT_TOOL,
  READ_ASSETS_TOOL,
  READ_ISSUE_TOOL,
  REVISE_TOOL_NAMES,
  acknowledgeProposal,
  assetsForModel,
  issueForModel,
  contentFromLetterForm,
  letterFields,
  letterFormData,
  missingIssue,
  reviseSystemPrompt,
  sanitizeLetterProposal,
  type LetterProposalInput,
} from "./letter-proposal.ts";
import { NO_INVENTION_RULES, draftInstructions } from "./newsletter-rules.ts";

const assets = [
  { id: "photo-1", kind: "image", name: "relay.jpg", caption: "Finish", included: true },
  { id: "photo-2", kind: "image", name: "snack.jpg", caption: "", included: true },
  { id: "clip", kind: "video", name: "race.mov", caption: "", included: true },
  { id: "out", kind: "image", name: "skip.jpg", caption: "", included: false },
];

function proposal(overrides: Partial<LetterProposalInput> = {}): LetterProposalInput {
  return {
    summary: "Shortened the opening.",
    headline: "Field day",
    subtitle: "Friday",
    intro: "The relay was close.",
    coverAssetId: "photo-1",
    sections: [
      {
        id: "races",
        heading: "Races",
        body: "The relay was close.",
        hidden: false,
        assetIds: ["photo-2"],
      },
    ],
    closing: "See you Monday.",
    ...overrides,
  };
}

test("a proposal keeps included photos and drops invented or unused files", () => {
  const saved = sanitizeLetterProposal(
    proposal({
      coverAssetId: "clip",
      sections: [
        {
          id: "races",
          heading: "Races",
          body: "The relay was close.",
          hidden: true,
          assetIds: ["photo-1", "photo-2", "made-up", "out", "clip"],
        },
      ],
    }),
    assets,
  );
  assert.equal(saved.coverAssetId, "");
  assert.equal(saved.sections[0]?.hidden, true);
  assert.deepEqual(saved.sections[0]?.assetIds, ["photo-1", "photo-2", "clip"]);
  assert.equal(saved.summary, "Shortened the opening.");
});

test("the main photo is used once, and a video cannot lead the letter", () => {
  const saved = sanitizeLetterProposal(
    proposal({
      coverAssetId: "photo-1",
      sections: [
        {
          id: "races",
          heading: "Races",
          body: "Fast.",
          hidden: false,
          assetIds: ["photo-1", "photo-2"],
        },
        {
          id: "snack",
          heading: "Snack",
          body: "",
          hidden: false,
          assetIds: ["photo-2", "clip"],
        },
      ],
    }),
    assets,
  );
  assert.equal(saved.coverAssetId, "photo-1");
  assert.deepEqual(saved.sections[0]?.assetIds, ["photo-2"]);
  assert.deepEqual(saved.sections[1]?.assetIds, ["clip"]);
});

test("long fields are clipped to the letter form limits", () => {
  const saved = sanitizeLetterProposal(
    proposal({ headline: "h".repeat(200), intro: "i".repeat(5000), summary: "s".repeat(500) }),
    assets,
  );
  assert.equal(saved.headline.length, 180);
  assert.equal(saved.intro.length, 4000);
  assert.equal(saved.summary.length, 400);
});

test("section ids stay stable and blank ids are filled in", () => {
  const saved = sanitizeLetterProposal(
    proposal({
      sections: [
        { id: "races", heading: "Races", body: "", hidden: false, assetIds: [] },
        { id: "races", heading: "Again", body: "", hidden: false, assetIds: [] },
        { id: "  ", heading: "New", body: "", hidden: false, assetIds: [] },
      ],
    }),
    assets,
  );
  assert.deepEqual(
    saved.sections.map((section) => section.id),
    ["races", "races-2", "section-3"],
  );
});

test("apply fields match the letter form and cannot publish", () => {
  const content: NewsletterContent = {
    headline: "Field day",
    subtitle: "",
    intro: "Hello",
    coverAssetId: "photo-1",
    closing: "Bye",
    sections: [
      { id: "races", heading: "Races", body: "Fast.", hidden: true, assetIds: ["photo-2", "clip"] },
    ],
  };
  const fields = letterFields("issue-1", content);
  const names = fields.map((field) => field.name);
  assert.equal(fields.find((field) => field.name === "id")?.value, "issue-1");
  assert.equal(fields.find((field) => field.name === "sectionCount")?.value, "1");
  assert.equal(fields.find((field) => field.name === "section-hidden-0")?.value, "1");
  assert.deepEqual(
    fields.filter((field) => field.name === "section-assets-0").map((field) => field.value),
    ["photo-2", "clip"],
  );
  assert.equal(names.includes("status"), false);
  assert.equal(names.includes("publish"), false);
  assert.equal(names.some((name) => name.toLowerCase().includes("publish")), false);
});

test("apply posts the same letter saveLetter reads back", () => {
  const saved = sanitizeLetterProposal(proposal(), assets);
  const parsed = contentFromLetterForm(letterFormData("issue-1", saved), "Fallback title");
  assert.equal(parsed.headline, saved.headline);
  assert.equal(parsed.intro, saved.intro);
  assert.equal(parsed.coverAssetId, saved.coverAssetId);
  assert.equal(parsed.closing, saved.closing);
  assert.deepEqual(parsed.sections, saved.sections);

  const cleared = contentFromLetterForm(
    letterFormData("issue-1", { ...saved, headline: "   " }),
    "Picnic",
  );
  assert.equal(cleared.headline, "Picnic");
});

test("the reviser can read an issue and its files without secrets", () => {
  const issue = issueForModel({
    title: "Field day",
    eventDate: "2026-05-01",
    notes: "The relay was close.",
    status: "draft",
    content: {
      headline: "Field day",
      subtitle: "",
      intro: "",
      coverAssetId: "",
      closing: "",
      sections: [],
    },
  });
  assert.equal(issue.found, true);
  assert.equal(issue.notes, "The relay was close.");
  assert.equal("dropboxFolderPath" in issue, false);
  assert.deepEqual(missingIssue().found, false);

  const [asset] = assetsForModel([
    {
      ...assets[0],
      dropboxPath: "/secret",
      sourceUrl: "https://dropbox.example/secret",
      dropboxId: "id:1",
    },
  ]);
  assert.deepEqual(asset, {
    id: "photo-1",
    kind: "image",
    name: "relay.jpg",
    caption: "Finish",
    included: true,
  });
});

test("acknowledging a proposal does not save or publish", () => {
  const ack = acknowledgeProposal("  Move the relay photo.  ");
  assert.equal(ack.saved, false);
  assert.equal(ack.summary, "Move the relay photo.");
  assert.match(ack.message, /Not saved/);
  assert.match(ack.message, /does not publish/);
});

test("revise tools are read and propose only", () => {
  assert.deepEqual(REVISE_TOOL_NAMES, [READ_ISSUE_TOOL, READ_ASSETS_TOOL, PROPOSE_EDIT_TOOL]);
  const blocked = ["publish", "unpublish", "archive", "revoke", "password", "dropbox"];
  for (const name of REVISE_TOOL_NAMES) {
    assert.equal(
      blocked.some((word) => name.toLowerCase().includes(word)),
      false,
    );
  }
});

test("the revise prompt keeps the draft no-invention rules and forbids publishing", () => {
  const prompt = reviseSystemPrompt("Impact");
  for (const rule of NO_INVENTION_RULES) assert.equal(prompt.includes(rule), true);
  assert.match(prompt, /cannot publish/i);
  assert.match(prompt, /asset id/i);
  assert.match(prompt, /clicking Apply/);
  const draft = draftInstructions("Impact");
  assert.equal(draft.includes(NO_INVENTION_RULES[0] ?? ""), true);
  assert.match(draft, /More from the day/);
});
