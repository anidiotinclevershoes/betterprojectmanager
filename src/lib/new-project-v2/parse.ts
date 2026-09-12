import {
  asUsableString,
  newReviewOperationId,
  reviewSafetyGap,
} from "@/lib/capture-v2/contract";
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Name-only Person recovery from a VALIDATE reject.
 * Does not invent a responsibility scope. Does not change Capture
 * foreign_id fail-closed on a scoped project.
 */
function recoverablePersonName(raw: unknown): string | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const disposition = asUsableString(obj.disposition)?.toLowerCase();
  if (disposition === "ignore" || disposition === "commentary") return null;
  const domain = asUsableString(obj.domain)?.toLowerCase();
  if (domain === "commentary") return null;
  const values = asObject(obj.proposedValues) ?? {};
  return (
    asUsableString(values.name) ||
    asUsableString(values.personName) ||
    (domain === "person" ? asUsableString(obj.candidateTargetTitle) : undefined) ||
    null
  );
}

function nameOnlyPersonItem(raw: unknown, name: string): ProvisionalItem {
  const obj = asObject(raw) ?? {};
  return {
    id: newReviewOperationId(),
    modelObservationId: asUsableString(obj.id),
    statement: asUsableString(obj.statement) ?? name,
    evidence: asUsableString(obj.evidence) ?? asUsableString(obj.statement) ?? name,
    modelDomain: "person",
    category: "person",
    proposedValues: { name },
    disposition: "create_new",
    truthIntent: "current",
    needsReview: false,
    reviewReason: null,
  };
}

/**
 * Adapt shared Capture observations into the New Project provisional map.
 * This is not an extraction engine: envelope parse + validate come from Capture.
 * Envelope `project` metadata is ignored — shared Capture output has no project
 * object, and New Project must not invent Objective / summary / currentFocus.
 *
 * Row identity is system-generated. Model observation.id is trace only.
 *
 * Unscoped Organise has no records, so any invented candidateTargetId is
 * foreign_id. Holdout rematerializes `create_new` + foreign id as an accepted
 * create. Schema-near-miss rows (missing truthIntent, unknown disposition)
 * still reject. Those rejects must not erase a usable person name (D-052).
 */
export function parseNewProjectV2Envelope(raw: unknown): {
  project: { name: string; summary: string; currentFocus: string };
  items: ProvisionalItem[];
  envelopeMalformed: boolean;
} {
  const parsed = parseObservationEnvelope(raw);
  const envelopeMalformed = parsed.issues.some((issue) => issue.code === "malformed");
  const validation = validateObservations(parsed.observations, [], null);

  const items: ProvisionalItem[] = validation.observations.map((obs) => {
    const reason = reviewSafetyGap(obs);
    return {
      id: newReviewOperationId(),
      modelObservationId: obs.id,
      statement: obs.statement,
      evidence: obs.evidence,
      modelDomain: obs.domain,
      category: categoryFromDisposition(obs.domain, obs.disposition),
      proposedValues: obs.proposedValues,
      disposition: obs.disposition,
      truthIntent: obs.truthIntent,
      needsReview: Boolean(reason),
      reviewReason: reason,
    };
  });

  const acceptedIds = new Set(validation.observations.map((obs) => obs.id));
  const seenNames = new Set(
    items
      .map((item) =>
        (
          asUsableString(item.proposedValues?.name) ||
          asUsableString(item.proposedValues?.personName) ||
          ""
        ).toLowerCase(),
      )
      .filter(Boolean),
  );
  for (const rawObs of parsed.observations) {
    const obj = asObject(rawObs);
    const rawId = asUsableString(obj?.id);
    if (rawId && acceptedIds.has(rawId)) continue;
    const name = recoverablePersonName(rawObs);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    items.push(nameOnlyPersonItem(rawObs, name));
  }

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
