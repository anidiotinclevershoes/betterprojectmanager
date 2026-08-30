/**
 * Reviewed create identity — the atomic value the user approved.
 *
 * `text` on Apply is source/evidence (often the full transcript).
 * Durable create titles/labels must never be copied from that argument.
 */
import type { PendingSuggestion } from "@/lib/capture/suggestions";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function proposedValues(item: PendingSuggestion): Record<string, unknown> {
  return item.proposedValues ?? {};
}

/**
 * Identity the user reviewed/approved for a create.
 * Review edits live on `item.content`. Proposed atomic fields are fallback
 * only when content is empty. Never the overloaded Apply `text` argument.
 */
export function reviewedCreateIdentity(item: PendingSuggestion): string | undefined {
  const content = asString(item.content);
  if (content) return content;
  const values = proposedValues(item);
  return (
    asString(values.title) ||
    asString(values.label) ||
    asString(values.name)
  );
}

export function reviewedCreateIdentityOrEmpty(item: PendingSuggestion): string {
  return reviewedCreateIdentity(item) ?? "";
}
