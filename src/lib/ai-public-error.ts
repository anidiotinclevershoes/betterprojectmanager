/**
 * Client-visible copy for AI route failures.
 * Never forward provider Error.message — OpenAI bodies can include org ids,
 * request snippets, or key hints.
 */
export function publicAiFailureMessage(
  error: unknown,
  fallback: string,
): { publicMessage: string; detail: string } {
  return {
    publicMessage: fallback,
    detail: error instanceof Error ? error.message : "unknown",
  };
}
