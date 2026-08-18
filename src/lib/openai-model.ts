/**
 * Shared OpenAI chat model resolution.
 *
 * Pin a snapshot id by default so request metadata matches API `response.model`
 * and Lume vs GPT baseline comparisons are apples-to-apples.
 *
 * Override with OPENAI_MODEL (production) or OPENAI_EVAL_MODEL (evals only when set).
 * Prefer snapshot ids (e.g. gpt-4o-mini-2024-07-18) over floating aliases (gpt-4o-mini).
 */
export const PINNED_OPENAI_CHAT_MODEL = "gpt-4o-mini-2024-07-18";

/** @deprecated alias — historical default before model tidy; resolves to same family */
export const LEGACY_OPENAI_CHAT_ALIAS = "gpt-4o-mini";

export function resolveOpenAIChatModel(opts?: {
  /** When true, OPENAI_EVAL_MODEL wins over OPENAI_MODEL if set. */
  forEval?: boolean;
}): string {
  const evalOverride = process.env.OPENAI_EVAL_MODEL?.trim();
  const general = process.env.OPENAI_MODEL?.trim();
  if (opts?.forEval && evalOverride) return evalOverride;
  if (general) {
    // Floating alias → pin snapshot so request and response.model align.
    if (general === LEGACY_OPENAI_CHAT_ALIAS) return PINNED_OPENAI_CHAT_MODEL;
    return general;
  }
  if (evalOverride) return evalOverride;
  return PINNED_OPENAI_CHAT_MODEL;
}

/** True when two model ids refer to the same controlled snapshot/alias family. */
export function modelsAlignedForComparison(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const norm = (m: string) =>
    m === LEGACY_OPENAI_CHAT_ALIAS ? PINNED_OPENAI_CHAT_MODEL : m;
  return norm(a) === norm(b);
}
