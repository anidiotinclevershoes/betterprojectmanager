/**
 * New Project Talk/Paste uses the shared Capture observation extractor.
 * `LUME_NEW_PROJECT_V2` is ignored so a missing or mis-set flag cannot
 * restore the retired OpenAI assemble / regex success path.
 */
export function isNewProjectV2Enabled(
  _env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return true;
}
