import type { ObservationDisposition } from "@/lib/capture-v2/types";
import {
  parseObservationEnvelope,
  validateObservations,
} from "@/lib/capture-v2/validate";
import {
  categoryFromDomain,
  type ProvisionalCategory,
  type ProvisionalItem,
} from "./types";

/**
 * Adapt shared Capture observations into the New Project provisional map.
 * This is not an extraction engine: envelope parse + validate come from Capture.
 * Envelope `project` metadata is ignored — shared Capture output has no project
 * object, and New Project must not invent Objective / summary / currentFocus.
 */
export function parseNewProjectV2Envelope(raw: unknown): {
  project: { name: string; summary: string; currentFocus: string };
  items: ProvisionalItem[];
  envelopeMalformed: boolean;
} {
  const parsed = parseObservationEnvelope(raw);
  const envelopeMalformed = parsed.issues.some((issue) => issue.code === "malformed");
  const validation = validateObservations(parsed.observations, [], null);

  const items: ProvisionalItem[] = validation.observations.map((obs, index) => ({
    id: obs.id || `np-${index + 1}`,
    statement: obs.statement,
    evidence: obs.evidence,
    modelDomain: obs.domain,
    category: categoryFromDisposition(obs.domain, obs.disposition),
    proposedValues: obs.proposedValues,
    disposition: obs.disposition,
  }));

  return {
    project: { name: "", summary: "", currentFocus: "" },
    items,
    envelopeMalformed,
  };
}

function categoryFromDisposition(
  domain: ProvisionalItem["modelDomain"],
  disposition: ObservationDisposition,
): ProvisionalCategory {
  if (disposition === "ignore") return "ignored";
  if (disposition === "commentary") return "commentary";
  return categoryFromDomain(domain);
}

export function recategoriseItem(
  items: ProvisionalItem[],
  id: string,
  category: ProvisionalCategory,
): ProvisionalItem[] {
  return items.map((item) => (item.id === id ? { ...item, category } : item));
}
