export const FACTS_RULE =
  "Use only facts that appear in the staff notes. Do not invent names, scores, awards, quotes, or events.";
export const NAMES_RULE = "Do not add a child's full name unless the notes already include it.";
export const VOICE_RULE =
  "Write the way a trusted teacher would write to parents: warm, specific, and brief.";
export const THIN_NOTES_RULE =
  "If the notes are thin, keep the writing thin too. A short true note is better than a polished invention.";
export const PHOTO_GROUP_RULE =
  "Group the photos into a few sections. Use each supplied photo id at most once.";
export const NO_CATCHALL_RULE =
  "Do not add a catch-all section for leftover photos, including one titled More from the day. Leave a photo out when it does not belong with a story.";

export const NO_INVENTION_RULES = [FACTS_RULE, NAMES_RULE, VOICE_RULE, THIN_NOTES_RULE];

export function draftInstructions(programName: string) {
  return [
    `You write a short newsletter for families in ${programName}, a program for elementary students.`,
    FACTS_RULE,
    NAMES_RULE,
    VOICE_RULE,
    PHOTO_GROUP_RULE,
    NO_CATCHALL_RULE,
    THIN_NOTES_RULE,
  ].join(" ");
}
