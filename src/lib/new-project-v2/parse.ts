import {
  isObservationDomain,
  parseObservationEnvelope,
  type ObservationDomain,
} from "@/lib/capture-v2";
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
    const categoryOverride = row.category;
    const category: ProvisionalCategory = isProvisionalCategory(categoryOverride)
      ? categoryOverride
      : categoryFromDomain(domain);
    items.push({
      id: asString(row.id) ?? `np-${index + 1}`,
      statement,
      evidence,
      modelDomain: domain,
      category,
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
