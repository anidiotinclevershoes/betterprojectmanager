import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";

/** Same unscoped block Capture uses when there is no current project. */
export const NEW_PROJECT_UNSCOPED_PROJECT_BLOCK =
  "Current project: (unscoped)\nAuthoritative current records:\n(none)";

/**
 * New Project extraction is the shared Capture observation extractor
 * with an empty project block. Not a separate intelligence contract.
 */
export async function extractNewProjectV2WithOpenAI(content: string): Promise<{
  rawModelJson: unknown;
  responseText: string;
  model: string;
}> {
  const extracted = await extractObservationsWithOpenAI({
    transcript: content,
    projectBlock: NEW_PROJECT_UNSCOPED_PROJECT_BLOCK,
  });
  return {
    rawModelJson: extracted.rawModelJson,
    responseText: extracted.responseText,
    model: extracted.model,
  };
}
