/**
 * Gate 2.5 Change 1 — exact same-value UPDATE → no_change.
 *
 * Pure canonical-field comparison against the open project's current rows.
 * Reuses existing normalizers only:
 *   - ISO day prefix (same as planMilestone / planCaptureApply `isoDay`)
 *   - namesMatchExact / normalisePersonName
 *   - responsibility scope trim+lowercase (same as currentOwners)
 *
 * Does not call planCaptureApply to adopt no_change. The planner's no_change
 * paths mix same-value with wording/semantics (e.g. ownershipSemantics
 * "continue", label===text). Those are not reused as outcomes.
 *
 * Does not repair partial updates: if no comparable proposed field is set,
 * the UPDATE is left unchanged.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { namesMatchExact } from "@/lib/people/identity";
import type { Gate1V2Item } from "@/lib/experiments/ai-first-capture-gate1-v2/types";

export const GATE25_NO_CHANGE_REASON =
  "Proposed values already equal current canonical truth.";

/** Same ISO-day extract as planCaptureApply's local isoDay. */
export function canonicalIsoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function canonicalScope(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().toLowerCase();
}

type Compared = { field: string; proposed: string; current: string; equal: boolean };

function compare(
  field: string,
  proposed: string | null,
  current: string | null,
  eq: (a: string, b: string) => boolean = (a, b) => a === b,
): Compared | null {
  if (!proposed) return null;
  if (!current) {
    return { field, proposed, current: "", equal: false };
  }
  return { field, proposed, current, equal: eq(proposed, current) };
}

function lookupCurrent(
  item: Gate1V2Item,
  world: CaptureApplyWorld,
  projectId: string,
): Record<string, string | null> | null {
  const id = item.targetCanonicalId;
  if (!id) return null;
  const project = world.projects.find((p) => p.id === projectId);

  if (item.domain === "milestone") {
    const row = world.timeline.find((t) => t.id === id && t.projectId === projectId);
    if (!row) return null;
    return {
      date: canonicalIsoDay(row.startAt),
      title: row.label?.trim() || null,
      name: row.label?.trim() || null,
    };
  }

  if (item.domain === "responsibility") {
    for (const pack of world.knowledge) {
      if (pack.projectId !== projectId) continue;
      const row = (pack.structured ?? []).find((s) => s.id === id);
      if (!row) continue;
      const resp = row.meta?.responsibility;
      return {
        scope: canonicalScope(resp?.scope ?? null),
        personName: resp?.personName?.trim() || null,
        name: resp?.personName?.trim() || null,
      };
    }
    return null;
  }

  if (item.domain === "risk") {
    const row = world.risks.find((r) => r.id === id && r.projectId === projectId);
    if (!row) return null;
    return {
      status: row.status?.trim().toLowerCase() || null,
      title: row.title?.trim() || null,
      name: row.title?.trim() || null,
    };
  }

  if (item.domain === "todo") {
    const row = world.todos.find((t) => t.id === id && t.projectId === projectId);
    if (!row) return null;
    return {
      title: row.title?.trim() || null,
      name: row.title?.trim() || null,
      date: canonicalIsoDay(row.dueAt ?? null),
    };
  }

  if (item.domain === "person") {
    const row = project?.stakeholders.find((p) => p.id === id);
    if (!row) return null;
    return { name: row.name?.trim() || null, personName: row.name?.trim() || null };
  }

  if (item.domain === "availability") {
    for (const pack of world.knowledge) {
      if (pack.projectId !== projectId) continue;
      const row = (pack.structured ?? []).find((s) => s.id === id);
      if (!row) continue;
      const avail = row.meta?.availability;
      return {
        personName: avail?.personName?.trim() || null,
        awayFromIso: canonicalIsoDay(avail?.awayFromIso ?? null),
        awayToIso: canonicalIsoDay(avail?.awayToIso ?? null),
      };
    }
    const person = project?.stakeholders.find((p) => p.id === id);
    if (person) {
      return { personName: person.name?.trim() || null, name: person.name?.trim() || null };
    }
    return null;
  }

  if (item.domain === "knowledge" || item.domain === "decision") {
    for (const pack of world.knowledge) {
      if (pack.projectId !== projectId) continue;
      const row = (pack.structured ?? []).find((s) => s.id === id);
      if (!row) continue;
      return { text: row.body?.trim() || null, title: row.body?.trim() || null };
    }
    return null;
  }

  return null;
}

/** Proposed keys that this domain's Apply write actually uses. Others are ignored. */
function writeRelevantProposedKeys(item: Gate1V2Item): string[] {
  const v = item.proposedValues;
  const present = new Set<string>();
  if (v.name) present.add("name");
  if (v.personName) present.add("personName");
  if (v.title) present.add("title");
  if (v.date) present.add("date");
  if (v.status) present.add("status");
  if (v.scope) present.add("scope");
  if (v.awayFromIso) present.add("awayFromIso");
  if (v.awayToIso) present.add("awayToIso");
  if (v.text) present.add("text");

  const allowed = new Set<string>();
  switch (item.domain) {
    case "milestone":
      allowed.add("date");
      break;
    case "responsibility":
      allowed.add("personName");
      allowed.add("name");
      allowed.add("scope");
      break;
    case "risk":
      allowed.add("status");
      allowed.add("title");
      allowed.add("name");
      break;
    case "todo":
      allowed.add("title");
      allowed.add("name");
      allowed.add("date");
      allowed.add("status");
      break;
    case "person":
      allowed.add("name");
      allowed.add("personName");
      break;
    case "availability":
      allowed.add("personName");
      allowed.add("name");
      allowed.add("awayFromIso");
      allowed.add("awayToIso");
      break;
    case "knowledge":
    case "decision":
      allowed.add("text");
      break;
    default:
      break;
  }
  return [...present].filter((key) => allowed.has(key));
}

function fieldCovers(compared: Compared[], key: string): boolean {
  if (compared.some((row) => row.field === key)) return true;
  if (key === "name" && compared.some((row) => row.field === "personName" || row.field === "title")) {
    return true;
  }
  if (key === "personName" && compared.some((row) => row.field === "name")) return true;
  if (key === "title" && compared.some((row) => row.field === "name")) return true;
  return false;
}

function proposedComparisons(item: Gate1V2Item, current: Record<string, string | null>): Compared[] {
  const v = item.proposedValues;
  const out: Compared[] = [];

  const push = (row: Compared | null) => {
    if (row) out.push(row);
  };

  if (item.domain === "milestone") {
    push(compare("date", canonicalIsoDay(v.date), current.date));
    return out;
  }

  if (item.domain === "responsibility") {
    push(
      compare("personName", v.personName?.trim() || v.name?.trim() || null, current.personName, namesMatchExact),
    );
    push(compare("scope", canonicalScope(v.scope), current.scope));
    return out;
  }

  if (item.domain === "risk") {
    push(compare("status", v.status?.trim().toLowerCase() || null, current.status));
    push(compare("title", v.title?.trim() || v.name?.trim() || null, current.title, namesMatchExact));
    return out;
  }

  if (item.domain === "todo") {
    push(compare("title", v.title?.trim() || v.name?.trim() || null, current.title, namesMatchExact));
    push(compare("date", canonicalIsoDay(v.date), current.date));
    return out;
  }

  if (item.domain === "person") {
    push(compare("name", v.name?.trim() || v.personName?.trim() || null, current.name, namesMatchExact));
    return out;
  }

  if (item.domain === "availability") {
    push(compare("personName", v.personName?.trim() || v.name?.trim() || null, current.personName, namesMatchExact));
    push(compare("awayFromIso", canonicalIsoDay(v.awayFromIso), current.awayFromIso));
    push(compare("awayToIso", canonicalIsoDay(v.awayToIso), current.awayToIso));
    return out;
  }

  if (item.domain === "knowledge" || item.domain === "decision") {
    push(compare("text", v.text?.trim() || null, current.text));
    return out;
  }

  return out;
}

export type SameValueDecision = {
  comparable: boolean;
  exactMatch: boolean;
  compared: Compared[];
};

export function inspectExactSameValues(
  item: Gate1V2Item,
  world: CaptureApplyWorld,
  projectId: string,
): SameValueDecision {
  if (item.operation !== "update") {
    return { comparable: false, exactMatch: false, compared: [] };
  }
  const current = lookupCurrent(item, world, projectId);
  if (!current) return { comparable: false, exactMatch: false, compared: [] };
  const compared = proposedComparisons(item, current);
  if (!compared.length) return { comparable: false, exactMatch: false, compared: [] };
  const extras = writeRelevantProposedKeys(item).filter((key) => !fieldCovers(compared, key));
  if (extras.length) {
    return { comparable: false, exactMatch: false, compared };
  }
  return {
    comparable: true,
    exactMatch: compared.every((row) => row.equal),
    compared,
  };
}

export function applyExactSameValueNoChange(
  item: Gate1V2Item,
  world: CaptureApplyWorld,
  projectId: string,
): { item: Gate1V2Item; decision: SameValueDecision; converted: boolean } {
  const decision = inspectExactSameValues(item, world, projectId);
  if (!decision.comparable || !decision.exactMatch) {
    return { item, decision, converted: false };
  }
  return {
    item: {
      ...item,
      operation: "no_change",
      question: null,
      leftUntouchedReason: null,
    },
    decision,
    converted: true,
  };
}
