/**
 * Thin mechanical inspection only. Does not repair semantics.
 */
import {
  GATE1_V2_DOMAINS,
  GATE1_V2_OPERATIONS,
  type Gate1V2Envelope,
  type Gate1V2Item,
  type Gate1V2ProposedValues,
  type InspectIssue,
  type InspectedEnvelope,
} from "./types";

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyValues(): Gate1V2ProposedValues {
  return {
    name: null,
    personName: null,
    title: null,
    date: null,
    status: null,
    scope: null,
    ownershipSemantics: null,
    text: null,
    awayFromIso: null,
    awayToIso: null,
  };
}

function readValues(raw: unknown): Gate1V2ProposedValues {
  if (!raw || typeof raw !== "object") return emptyValues();
  const row = raw as Record<string, unknown>;
  return {
    name: asNullableString(row.name),
    personName: asNullableString(row.personName),
    title: asNullableString(row.title),
    date: asNullableString(row.date),
    status: asNullableString(row.status),
    scope: asNullableString(row.scope),
    ownershipSemantics: asNullableString(row.ownershipSemantics),
    text: asNullableString(row.text),
    awayFromIso: asNullableString(row.awayFromIso),
    awayToIso: asNullableString(row.awayToIso),
  };
}

export function inspectEnvelope(
  raw: unknown,
  knownIds: Set<string>,
): InspectedEnvelope {
  const issues: InspectIssue[] = [];
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      malformed: true,
      items: [],
      issues: [{ index: -1, code: "not_object", message: "Envelope was not an object" }],
    };
  }
  const itemsRaw = (raw as { items?: unknown }).items;
  if (!Array.isArray(itemsRaw)) {
    return {
      ok: false,
      malformed: true,
      items: [],
      issues: [{ index: -1, code: "not_object", message: "Missing items[]" }],
    };
  }

  const items: Gate1V2Item[] = [];
  for (let index = 0; index < itemsRaw.length; index += 1) {
    const entry = itemsRaw[index];
    if (!entry || typeof entry !== "object") {
      issues.push({ index, code: "not_object", message: "Item was not an object" });
      continue;
    }
    const row = entry as Record<string, unknown>;
    const operation = row.operation;
    const domain = row.domain;
    if (
      typeof operation !== "string" ||
      !(GATE1_V2_OPERATIONS as readonly string[]).includes(operation)
    ) {
      issues.push({ index, code: "invalid_enum", message: `Invalid operation ${String(operation)}` });
      continue;
    }
    if (
      typeof domain !== "string" ||
      !(GATE1_V2_DOMAINS as readonly string[]).includes(domain)
    ) {
      issues.push({ index, code: "invalid_enum", message: `Invalid domain ${String(domain)}` });
      continue;
    }
    if (typeof row.subject !== "string" || !row.subject.trim()) {
      issues.push({ index, code: "missing_field", message: "Missing subject" });
      continue;
    }
    if (typeof row.evidence !== "string" || !row.evidence.trim()) {
      issues.push({ index, code: "missing_field", message: "Missing evidence" });
      continue;
    }
    const target = asNullableString(row.targetCanonicalId);
    if (target && !knownIds.has(target)) {
      issues.push({
        index,
        code: "unknown_id",
        message: `targetCanonicalId ${target} is not in the snapshot`,
      });
      // Keep the item. Do not rewrite the id.
    }
    items.push({
      operation: operation as Gate1V2Item["operation"],
      domain: domain as Gate1V2Item["domain"],
      targetCanonicalId: target,
      subject: row.subject.trim(),
      proposedValues: readValues(row.proposedValues),
      evidence: row.evidence.trim(),
      understood:
        typeof row.understood === "string" ? row.understood.trim() : "",
      question: asNullableString(row.question),
      leftUntouchedReason: asNullableString(row.leftUntouchedReason),
    });
  }

  const malformed =
    issues.some((i) => i.code === "not_object" || i.code === "invalid_enum") ||
    (items.length === 0 && itemsRaw.length > 0);

  return {
    ok: issues.length === 0,
    malformed,
    items,
    issues,
  };
}

export function envelopeFromInspected(inspected: InspectedEnvelope): Gate1V2Envelope {
  return { items: inspected.items };
}
