import { getIssue, issueContent, listAssets } from "./data";
import { acknowledgeProposal, assetsForModel, issueForModel, missingIssue } from "./letter-proposal";
import { proposeLetterEditDef, readAssetsDef, readIssueDef } from "./revise-definitions";

// The only tools the reviser can call. None of them publish or write the letter.
// proposeLetterEdit pauses for staff approval and, even if approved over the
// chat protocol, only acknowledges the proposal. Apply posts saveLetter.
export function reviseTools(issueId: string) {
  const readIssue = readIssueDef.server(async () => {
    const issue = await getIssue(issueId);
    if (!issue) return missingIssue();
    return issueForModel({
      title: issue.title,
      eventDate: issue.eventDate,
      notes: issue.notes,
      status: issue.status,
      content: issueContent(issue),
    });
  });

  const readAssets = readAssetsDef.server(async () => {
    const assets = await listAssets(issueId);
    return { assets: assetsForModel(assets) };
  });

  const proposeLetterEdit = proposeLetterEditDef.server((input) => acknowledgeProposal(input.summary));

  return [readIssue, readAssets, proposeLetterEdit];
}
