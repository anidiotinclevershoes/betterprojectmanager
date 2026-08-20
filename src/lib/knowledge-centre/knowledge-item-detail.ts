/**
 * Slice 2C — resolve a selectable Ocean Knowledge item into a detail model.
 * Uses MissionState + stable domain/structured ids. Never fabricates evidence.
 */

import type {
  EpistemicStatus,
  ProvenanceEntry,
  CanonicalTruthItem,
} from "@/lib/canonical-truth/types";
import { emptyKnowledge } from "@/lib/knowledge";
import { isKnowledgeUuid } from "@/lib/knowledge-identity";
import {
  formatDueLabel,
  formatMilestoneLabel,
  formatShortDayMonth,
} from "@/lib/knowledge-centre/format-date-label";
import {
  getPersonBundle,
  type PersonBundle,
} from "@/lib/people/identity";
import {
  isClosedRiskStatus,
  isOpenRiskStatus,
  stripResolvedPrefix,
} from "@/lib/risks/lifecycle";
import type {
  KnowledgeSectionId,
  MissionState,
  ProjectKnowledge,
  TodoItem,
} from "@/lib/types";
import type { RiskStatus } from "@/types/database";

export type KnowledgeItemRef =
  | { kind: "structured"; itemId: string }
  | {
      kind: "section";
      sectionId: KnowledgeSectionId;
      itemId: string | null;
      body: string;
    }
  | { kind: "risk"; riskId: string }
  | {
      kind: "knowledge_risk";
      /** Stable-ish key for UI selection (not a domain UUID). */
      key: string;
      title: string;
    }
  | { kind: "todo"; todoId: string }
  | { kind: "person"; personId: string }
  | { kind: "timeline"; timelineId: string }
  | { kind: "unconfirmed_owner"; itemId: string };

export type KnowledgeDetailRelation = {
  kind: "person" | "risk" | "todo" | "date" | "dependency" | "knowledge";
  id: string;
  label: string;
};

export type KnowledgeDetailDomain =
  | "knowledge"
  | "risk"
  | "todo"
  | "person"
  | "date"
  | "dependency"
  | "observation";

export type KnowledgeDetailModel = {
  ref: KnowledgeItemRef;
  projectId: string;
  title: string;
  body: string;
  subtitle?: string;
  epistemic?: EpistemicStatus | null;
  epistemicLabel?: string | null;
  provenanceLines: string[];
  previousValue?: string;
  previousLabel?: string;
  relations: KnowledgeDetailRelation[];
  assumptions: string[];
  needsYouReason?: string;
  canEditBody: boolean;
  /** Section to rewrite when canEditBody (section-backed). */
  editSectionId?: KnowledgeSectionId;
  editItemId?: string | null;
  canToggleTodo: boolean;
  canResolveRisk: boolean;
  canResolveKnowledgeRisk: boolean;
  canConfirmOwner: boolean;
  confirmOwnerScope?: string;
  confirmOwnerTruthItemId?: string;
  honestyNotes: string[];
  domain: KnowledgeDetailDomain;
  riskStatus?: RiskStatus;
  todoDone?: boolean;
  personBundle?: PersonBundle;
};

function humanizeProvenanceType(type: ProvenanceEntry["type"]): string {
  switch (type) {
    case "capture":
      return "Learned from Capture";
    case "user_confirmation":
      return "Confirmed by you";
    case "manual_edit":
      return "Manually edited";
    case "import":
      return "Imported";
    case "system":
      return "System";
    case "legacy":
      return "Recorded earlier";
    default:
      return "Recorded";
  }
}

export function formatProvenanceLine(entry: ProvenanceEntry): string {
  const when = entry.at ? formatShortDayMonth(entry.at) : null;
  const base = humanizeProvenanceType(entry.type);
  const note = entry.note?.trim() ? ` — ${entry.note.trim()}` : "";
  if (when) return `${base} · ${when}${note}`;
  return `${base}${note}`;
}

export function formatProvenanceLines(
  provenance: ProvenanceEntry[] | null | undefined,
): string[] {
  if (!Array.isArray(provenance) || provenance.length === 0) return [];
  return provenance.map(formatProvenanceLine);
}

export function epistemicDisplayLabel(
  status: EpistemicStatus | null | undefined,
): string | null {
  if (!status || status === "confirmed" || status === "legacy") return null;
  if (status === "unknown") return "Needs you";
  if (status === "informal") return "Informal";
  if (status === "conflicting") return "Conflicting";
  if (status === "suggested" || status === "pending" || status === "inferred") {
    return "Unconfirmed";
  }
  return null;
}

export function knowledgeDetailEquals(
  a: KnowledgeItemRef | null | undefined,
  b: KnowledgeItemRef | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "structured":
      return b.kind === "structured" && a.itemId === b.itemId;
    case "section":
      return (
        b.kind === "section" &&
        a.sectionId === b.sectionId &&
        a.itemId === b.itemId &&
        a.body === b.body
      );
    case "risk":
      return b.kind === "risk" && a.riskId === b.riskId;
    case "knowledge_risk":
      return b.kind === "knowledge_risk" && a.key === b.key;
    case "todo":
      return b.kind === "todo" && a.todoId === b.todoId;
    case "person":
      return b.kind === "person" && a.personId === b.personId;
    case "timeline":
      return b.kind === "timeline" && a.timelineId === b.timelineId;
    case "unconfirmed_owner":
      return b.kind === "unconfirmed_owner" && a.itemId === b.itemId;
    default:
      return false;
  }
}

function knowledgeFor(
  state: MissionState,
  projectId: string,
): ProjectKnowledge {
  return (
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId)
  );
}

function findStructured(
  knowledge: ProjectKnowledge,
  itemId: string,
): CanonicalTruthItem | undefined {
  return (knowledge.structured ?? []).find((i) => i.id === itemId);
}

function previousBodyFor(
  knowledge: ProjectKnowledge,
  item: CanonicalTruthItem,
): string | undefined {
  if (!item.supersedesId) return undefined;
  const prior = (knowledge.structured ?? []).find(
    (i) => i.id === item.supersedesId,
  );
  return prior?.body?.trim() || undefined;
}

function sectionHasEditableLine(
  knowledge: ProjectKnowledge,
  sectionId: KnowledgeSectionId,
  itemId: string | null,
  body: string,
): boolean {
  const bullets = knowledge.sections[sectionId] ?? [];
  const ids = knowledge.sectionItemIds?.[sectionId];
  if (itemId && Array.isArray(ids) && ids.some((id) => id === itemId)) {
    return true;
  }
  return bullets.some((b) => b.trim() === body.trim());
}

/**
 * Build next section bullet list for a single-line correction.
 * Identity via sectionItemIds UUID when present; else exact body match.
 * Returns null if the target line cannot be found (never mutates by index alone).
 */
export function buildCorrectedSectionBullets(
  knowledge: ProjectKnowledge,
  sectionId: KnowledgeSectionId,
  opts: { itemId?: string | null; oldBody: string; newBody: string },
): string[] | null {
  const bullets = [...(knowledge.sections[sectionId] ?? [])];
  const ids = knowledge.sectionItemIds?.[sectionId];
  const trimmedNew = opts.newBody.trim();
  if (!trimmedNew) return null;

  let idx = -1;
  if (opts.itemId && isKnowledgeUuid(opts.itemId) && Array.isArray(ids)) {
    idx = ids.findIndex((id) => id === opts.itemId);
  }
  if (idx < 0) {
    idx = bullets.findIndex((b) => b.trim() === opts.oldBody.trim());
  }
  if (idx < 0) return null;

  const next = [...bullets];
  next[idx] = trimmedNew;
  return next;
}

function historyHonestyNote(): string {
  return "Change history may be incomplete after reload (D-004). Only stored provenance is shown.";
}

/**
 * Resolve detail for a stable ref against MissionState.
 * Returns null if the item is not in this project / missing.
 */
export function resolveKnowledgeItemDetail(
  state: MissionState,
  projectId: string,
  ref: KnowledgeItemRef,
): KnowledgeDetailModel | null {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const knowledge = knowledgeFor(state, projectId);
  const honestyNotes: string[] = [];

  if (ref.kind === "structured") {
    const item = findStructured(knowledge, ref.itemId);
    if (!item || item.projectId !== projectId) return null;
    const provenanceLines = formatProvenanceLines(item.provenance);
    if (!provenanceLines.length) {
      honestyNotes.push("No stored provenance for this item.");
      honestyNotes.push(historyHonestyNote());
    }
    const prev = previousBodyFor(knowledge, item);
    const sectionId =
      item.section &&
      (["now", "decisions", "risks", "people", "openLoops"] as const).includes(
        item.section,
      )
        ? item.section
        : undefined;
    const canEditBody = Boolean(
      sectionId &&
        sectionHasEditableLine(knowledge, sectionId, item.id, item.body),
    );
    if (!canEditBody && sectionId) {
      honestyNotes.push(
        "This item is not mirrored in editable Knowledge section lines yet.",
      );
    }
    const domain: KnowledgeDetailDomain =
      item.kind === "dependency"
        ? "dependency"
        : item.kind === "date"
          ? "date"
          : item.kind === "risk"
            ? "risk"
            : "knowledge";
    return {
      ref,
      projectId,
      title:
        item.kind === "decision"
          ? "Decision"
          : item.kind === "dependency"
            ? "Dependency"
            : item.kind === "date"
              ? "Date / milestone"
              : "Knowledge",
      body: item.body,
      subtitle: item.kind ? String(item.kind) : undefined,
      epistemic: item.epistemic,
      epistemicLabel: epistemicDisplayLabel(item.epistemic),
      provenanceLines,
      previousValue: prev,
      previousLabel: prev ? "Previously" : undefined,
      relations: [],
      assumptions: [],
      needsYouReason:
        item.epistemic === "conflicting"
          ? "Conflicting signals — needs your clarification."
          : item.epistemic === "unknown"
            ? "Unconfirmed — needs your confirmation."
            : undefined,
      canEditBody,
      editSectionId: canEditBody ? sectionId : undefined,
      editItemId: canEditBody ? item.id : undefined,
      canToggleTodo: false,
      canResolveRisk: false,
      canResolveKnowledgeRisk: false,
      canConfirmOwner: false,
      honestyNotes,
      domain,
    };
  }

  if (ref.kind === "section") {
    const bullets = knowledge.sections[ref.sectionId] ?? [];
    const ids = knowledge.sectionItemIds?.[ref.sectionId];
    let body = ref.body;
    let itemId = ref.itemId;
    if (itemId && Array.isArray(ids)) {
      const idx = ids.indexOf(itemId);
      if (idx >= 0 && typeof bullets[idx] === "string") {
        body = bullets[idx]!;
      } else if (!bullets.some((b) => b.trim() === body.trim())) {
        return null;
      }
    } else if (!bullets.some((b) => b.trim() === body.trim())) {
      return null;
    }
    const structured =
      (itemId && findStructured(knowledge, itemId)) ||
      (knowledge.structured ?? []).find(
        (i) =>
          i.section === ref.sectionId &&
          i.body.trim() === body.trim() &&
          i.lifecycle === "current",
      );
    const provenanceLines = formatProvenanceLines(structured?.provenance);
    if (!provenanceLines.length) {
      honestyNotes.push("No stored provenance for this line.");
      honestyNotes.push(historyHonestyNote());
    }
    const prev = structured ? previousBodyFor(knowledge, structured) : undefined;
    return {
      ref: { ...ref, body, itemId },
      projectId,
      title:
        ref.sectionId === "decisions"
          ? "Decision"
          : ref.sectionId === "openLoops"
            ? "Open loop"
            : "Knowledge",
      body,
      epistemic: structured?.epistemic ?? null,
      epistemicLabel: epistemicDisplayLabel(structured?.epistemic),
      provenanceLines,
      previousValue: prev,
      previousLabel: prev ? "Previously" : undefined,
      relations: [],
      assumptions: [],
      canEditBody: true,
      editSectionId: ref.sectionId,
      editItemId: itemId,
      canToggleTodo: false,
      canResolveRisk: false,
      canResolveKnowledgeRisk: false,
      canConfirmOwner: false,
      honestyNotes,
      domain: "knowledge",
    };
  }

  if (ref.kind === "risk") {
    const risk = (state.risks ?? []).find((r) => r.id === ref.riskId);
    if (!risk || risk.projectId !== projectId) return null;
    honestyNotes.push(
      "Risk status comes from the Risk domain (Slice 1B). No fabricated provenance.",
    );
    return {
      ref,
      projectId,
      title: "Risk",
      body: risk.title,
      subtitle: `Status: ${risk.status}`,
      epistemic: null,
      epistemicLabel: null,
      provenanceLines: [],
      relations: [],
      assumptions: [],
      canEditBody: false,
      canToggleTodo: false,
      canResolveRisk: isOpenRiskStatus(risk.status),
      canResolveKnowledgeRisk: false,
      canConfirmOwner: false,
      honestyNotes,
      domain: "risk",
      riskStatus: risk.status,
    };
  }

  if (ref.kind === "knowledge_risk") {
    const title = ref.title;
    const inSection = (knowledge.sections.risks ?? []).some((t) =>
      stripResolvedPrefix(t)
        .toLowerCase()
        .includes(stripResolvedPrefix(title).toLowerCase()),
    );
    // Still allow if open prose exists
    const match = (knowledge.sections.risks ?? []).find(
      (t) =>
        stripResolvedPrefix(t).toLowerCase() ===
        stripResolvedPrefix(title).toLowerCase(),
    );
    if (!match && !inSection) {
      // Card may still be showing; require exact title present
      if (!(knowledge.sections.risks ?? []).includes(title)) return null;
    }
    const body = match ?? title;
    return {
      ref,
      projectId,
      title: "Risk (Knowledge only)",
      body,
      subtitle: "No Risk-domain row — Knowledge projection",
      epistemic: null,
      epistemicLabel: null,
      provenanceLines: [],
      relations: [],
      assumptions: [],
      canEditBody: false,
      canToggleTodo: false,
      canResolveRisk: false,
      canResolveKnowledgeRisk: true,
      canConfirmOwner: false,
      honestyNotes: [
        "This risk exists only as Knowledge prose. Resolving uses the Knowledge-only path.",
        historyHonestyNote(),
      ],
      domain: "risk",
      riskStatus: "open",
    };
  }

  if (ref.kind === "todo") {
    const todo = (state.todos ?? []).find((t) => t.id === ref.todoId);
    if (!todo || todo.projectId !== projectId) return null;
    const relations: KnowledgeDetailRelation[] = [];
    if (todo.waitingOn?.trim()) {
      const person = project.stakeholders.find(
        (s) =>
          s.name.toLowerCase() === todo.waitingOn!.trim().toLowerCase(),
      );
      if (person) {
        relations.push({
          kind: "person",
          id: person.id,
          label: person.name,
        });
      }
    }
    return {
      ref,
      projectId,
      title: "To Do",
      body: todo.title,
      subtitle:
        formatDueLabel(todo.dueAt) ??
        (todo.kind ? `Kind: ${todo.kind}` : undefined),
      epistemic: null,
      epistemicLabel: null,
      provenanceLines: [],
      relations,
      assumptions: [],
      canEditBody: true,
      canToggleTodo: true,
      canResolveRisk: false,
      canResolveKnowledgeRisk: false,
      canConfirmOwner: false,
      honestyNotes: [
        "To-dos do not carry Capture provenance in V1; only the durable todo record is shown.",
      ],
      domain: "todo",
      todoDone: Boolean(todo.done),
    };
  }

  if (ref.kind === "person") {
    const bundle = getPersonBundle(state, projectId, ref.personId);
    if (!bundle) return null;
    const { person, currentResponsibilities, historicalResponsibilities, sharedScopes } =
      bundle;
    const relations: KnowledgeDetailRelation[] = currentResponsibilities.map(
      (r) => ({
        kind: "knowledge" as const,
        id: r.item.id,
        label: r.scope,
      }),
    );
    const assumptions: string[] = [];
    if (sharedScopes.length) {
      for (const s of sharedScopes) {
        assumptions.push(
          `Shared · ${s.scope} also with ${s.coOwnerNames.join(", ")}`,
        );
      }
    }
    const previousValue =
      historicalResponsibilities.length > 0
        ? historicalResponsibilities
            .map((r) => `${r.scope} (${r.lifecycle})`)
            .join("; ")
        : undefined;
    return {
      ref,
      projectId,
      title: person.name,
      body:
        currentResponsibilities.map((r) => r.scope).join(" · ") ||
        person.role ||
        "Person",
      subtitle: person.role || undefined,
      epistemic: null,
      epistemicLabel: null,
      provenanceLines: formatProvenanceLines(
        currentResponsibilities[0]?.item.provenance,
      ),
      previousValue,
      previousLabel: previousValue
        ? "Previous responsibilities"
        : undefined,
      relations,
      assumptions,
      canEditBody: false,
      canToggleTodo: false,
      canResolveRisk: false,
      canResolveKnowledgeRisk: false,
      canConfirmOwner: false,
      honestyNotes: [
        "Person identity is the project stakeholder UUID. Full handover UI is a later People slice (D-019).",
      ],
      domain: "person",
      personBundle: bundle,
    };
  }

  if (ref.kind === "timeline") {
    const item = (state.timeline ?? []).find((t) => t.id === ref.timelineId);
    if (!item || item.projectId !== projectId) return null;
    return {
      ref,
      projectId,
      title: "Date / milestone",
      body:
        formatMilestoneLabel(item.label, item.startAt) ?? item.label,
      subtitle: item.type ? String(item.type) : undefined,
      epistemic: null,
      epistemicLabel: null,
      provenanceLines: [],
      relations: [],
      assumptions: [],
      canEditBody: false,
      canToggleTodo: false,
      canResolveRisk: false,
      canResolveKnowledgeRisk: false,
      canConfirmOwner: false,
      honestyNotes: [
        "Milestone dates use the timeline record. Prior superseded date is shown only when a structured supersession link exists.",
        historyHonestyNote(),
      ],
      domain: "date",
    };
  }

  if (ref.kind === "unconfirmed_owner") {
    const item = findStructured(knowledge, ref.itemId);
    if (!item || item.projectId !== projectId) return null;
    if (item.kind !== "responsibility") return null;
    const resp = item.meta?.responsibility;
    if (!resp || resp.ownerConfirmed) return null;
    return {
      ref,
      projectId,
      title: "Needs you",
      body: item.body || `${resp.scope} · Owner not confirmed`,
      subtitle: resp.scope,
      epistemic: item.epistemic ?? "unknown",
      epistemicLabel: "Needs you",
      provenanceLines: formatProvenanceLines(item.provenance),
      relations: [],
      assumptions: [
        "Owner is unconfirmed. Confirming records a scoped responsibility.",
      ],
      needsYouReason: "Owner not confirmed for this responsibility.",
      canEditBody: false,
      canToggleTodo: false,
      canResolveRisk: false,
      canResolveKnowledgeRisk: false,
      canConfirmOwner: true,
      confirmOwnerScope: resp.scope,
      confirmOwnerTruthItemId: item.id,
      honestyNotes: [
        "Replace-vs-share choice remains for People UI (D-019). Confirm adds/shares unless replace is used elsewhere.",
      ],
      domain: "person",
    };
  }

  return null;
}

/** Refs builders used by Ocean frames — prefer domain/structured UUIDs. */

export function refForStructuredItem(itemId: string): KnowledgeItemRef {
  return { kind: "structured", itemId };
}

export function refForSectionLine(
  sectionId: KnowledgeSectionId,
  body: string,
  itemId?: string | null,
): KnowledgeItemRef {
  return {
    kind: "section",
    sectionId,
    body,
    itemId: itemId && isKnowledgeUuid(itemId) ? itemId : null,
  };
}

export function refForRisk(riskId: string): KnowledgeItemRef {
  return { kind: "risk", riskId };
}

export function refForKnowledgeRisk(
  key: string,
  title: string,
): KnowledgeItemRef {
  return { kind: "knowledge_risk", key, title };
}

export function refForTodo(todoId: string): KnowledgeItemRef {
  return { kind: "todo", todoId };
}

export function refForPerson(personId: string): KnowledgeItemRef {
  return { kind: "person", personId };
}

export function refForTimeline(timelineId: string): KnowledgeItemRef {
  return { kind: "timeline", timelineId };
}

export function refForUnconfirmedOwner(itemId: string): KnowledgeItemRef {
  return { kind: "unconfirmed_owner", itemId };
}

/**
 * Resolve person id from a People frame card id (`personId` or `personId-scope`).
 */
export function personIdFromPeopleCardId(
  cardId: string,
  stakeholderIds: string[],
): string | null {
  if (stakeholderIds.includes(cardId)) return cardId;
  for (const id of stakeholderIds) {
    if (cardId.startsWith(`${id}-`)) return id;
  }
  return isKnowledgeUuid(cardId) ? cardId : null;
}

export function isOpenDomainRisk(
  status: RiskStatus | undefined,
): boolean {
  return status ? isOpenRiskStatus(status) : false;
}

export function isClosedDomainRisk(
  status: RiskStatus | undefined,
): boolean {
  return status ? isClosedRiskStatus(status) : false;
}

export type TodoCorrection = Pick<TodoItem, "id" | "title" | "done">;
