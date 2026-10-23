import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
  PROPOSE_EDIT_TOOL,
  READ_ASSETS_TOOL,
  READ_ISSUE_TOOL,
  letterProposalSchema,
  modelAssetsSchema,
  modelIssueSchema,
  proposalAckSchema,
} from "./letter-proposal";

export const readIssueDef = toolDefinition({
  name: READ_ISSUE_TOOL,
  description:
    "Read the saved issue for this page: title, event date, staff notes, status, and the current letter. Read-only. Cannot publish or edit.",
  inputSchema: z.object({}),
  outputSchema: modelIssueSchema,
});

export const readAssetsDef = toolDefinition({
  name: READ_ASSETS_TOOL,
  description:
    "Read the photos and videos on this issue. Each item has an id, kind, file name, caption, and whether staff included it. Use only these ids. Read-only.",
  inputSchema: z.object({}),
  outputSchema: modelAssetsSchema,
});

export const proposeLetterEditDef = toolDefinition({
  name: PROPOSE_EDIT_TOOL,
  description:
    "Propose a full replacement for the letter. Does not save, publish, or change the issue. Staff must click Apply to save. Send every field, including fields that stay the same. Keep existing section ids.",
  needsApproval: true,
  inputSchema: letterProposalSchema,
  outputSchema: proposalAckSchema,
});
