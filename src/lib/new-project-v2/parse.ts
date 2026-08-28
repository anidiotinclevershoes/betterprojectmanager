import {
  isObservationDisposition,
  isObservationDomain,
  type ObservationDisposition,
  type ObservationDomain,
} from "@/lib/capture-v2/types";
import { parseObservationEnvelope } from "@/lib/capture-v2/validate";
import {
  categoryFromDomain,
  isProvisionalCategory,
  type NewProjectV2Envelope,
  type ProvisionalCategory,
  type ProvisionalItem,
} from "./types";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Adapt a Capture observation envelope into New Project provisional items.
 * Does not invent Objective / summary / currentFocus. Empty metadata is valid.
 * Ambiguous dispositions become needsReview on the mapped item.
 */
export function parseNewProjectV2Envelope(raw: unknown): {
  project: { name: string; summary: string; currentFocus: string };
  items: ProvisionalItem[];
} {
  const obj = asObject(raw) as NewProjectV2Envelope | null;
  const projectRaw = asObject(obj?.project);
  const parsed = parseObservationEnvelope(obj ?? { observations: [] });
  const items: ProvisionalItem[] = [];

  parsed.observations.forEach((rawItem, index) => {
    const row = asObject(rawItem);
    if (!row) return;
    const statement = asString(row.statement);
    const evidence = asString(row.evidence) ?? statement;
    if (!statement || !evidence) return;
    const domainRaw = asString(row.domain);
    const domain: ObservationDomain =
      domainRaw && isObservationDomain(domainRaw) ? domainRaw : "unknown";
    const dispositionRaw = asString(row.disposition);
    const disposition: ObservationDisposition | undefined =
      dispositionRaw && isObservationDisposition(dispositionRaw)
        ? dispositionRaw
        : undefined;
    const categoryOverride = row.category;
    let category: ProvisionalCategory = isProvisionalCategory(categoryOverride)
      ? categoryOverride
      : categoryFromDomain(domain);
    if (disposition === "ignore" && !isProvisionalCategory(categoryOverride)) {
      category = "ignored";
    }
    items.push({
      id: asString(row.id) ?? `np-${index + 1}`,
      statement,
      evidence,
      modelDomain: domain,
      category,
      disposition,
      needsReview: disposition === "ambiguous",
      proposedValues:
        row.proposedValues &&
        typeof row.proposedValues === "object" &&
        !Array.isArray(row.proposedValues)
          ? (row.proposedValues as Record<string, unknown>)
          : null,
    });
  });

  return {
    project: {
      name: asString(projectRaw?.name) ?? "",
      summary: asString(projectRaw?.summary) ?? "",
      currentFocus: asString(projectRaw?.currentFocus) ?? "",
    },
    items,
  };
}

export function recategoriseItem(
  items: ProvisionalItem[],
  id: string,
  category: ProvisionalCategory,
): ProvisionalItem[] {
  return items.map((item) => (item.id === id ? { ...item, category } : item));
}
