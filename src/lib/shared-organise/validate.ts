/**
 * Deterministic check of a Project Change Form.
 * Reuses existing identity, title, date, and ownership contracts.
 * Does not write canonical truth. Apply still revalidates.
 */
import type { CaptureApplyDecision, CaptureLegalOperation } from "@/lib/capture/apply";
import { firstUsableIsoDate } from "@/lib/capture-v2/contract";
import { decideMilestoneDate } from "./date";
import { recordedTitleEvidencedInText } from "@/lib/capture/apply/recorded-title-evidence";
import {
  namesMatchExact,
  recordedPersonNameAppearsInText,
  scopesMatchExact,
} from "@/lib/people/identity";
import { scopeFromResponsiblePhrase } from "@/lib/people/responsibility-scope";
import type { RiskStatus } from "@/types/database";
import type { KnowledgeSectionId } from "@/lib/types";
import type { SharedOrganiseContext, TargetableRecord } from "./context";
import {
  isFormOperation,
  isFormOutcome,
  type FormOperationName,
  type FormOutcome,
  type ProjectChange,
  type ProjectChangeForm,
} from "./form";

const RISK_STATUS = new Set(["open", "watch", "resolved", "accepted"]);
const SECTIONS = new Set(["now", "decisions", "risks", "people", "openLoops"]);
const OWNERSHIP = new Set(["share", "replace", "continue", "ambiguous"]);

const PERSON_AUTHORITY =
  /\b(will own|owns|own|responsible for|taking over|take over|can sign|covers)\b/i;

export type SafetyTag =
  | "wrong_existing_person"
  | "duplicate_person"
  | "invented_stable_id"
  | "context_only_id"
  | "cross_project_create"
  | "knowledge_bypass"
  | "destructive"
  | "foreign_project_named"
  | "not_on_this_project"
  | "unresolved_person"
  | "role_update_unsupported";

export type ReviewedChange = {
  id: string;
  modelOutcome: FormOutcome | "unparsed";
  modelOperation: string;
  label: "Ready" | "Needs You" | "Left untouched" | "No change";
  reason: string;
  domain: string;
  operation: CaptureLegalOperation | null;
  decision: CaptureApplyDecision;
  safety: SafetyTag[];
  evidence: string;
  statement: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Existence only. The text is stored and never used to classify the input. */
function readMaterialUncertainty(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
  const items: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) items.push(trimmed);
      continue;
    }
    if (item == null || item === false) continue;
    items.push(typeof item === "object" ? JSON.stringify(item) : String(item));
  }
  return items;
}

function quoteInSource(source: string, evidence: string): boolean {
  const hay = source.replace(/\s+/g, " ").trim().toLowerCase();
  const quote = evidence.replace(/\s+/g, " ").trim().toLowerCase();
  if (!hay || !quote) return false;
  if (hay.includes(quote)) return true;
  const loosened = quote.replace(/[.,;:!?]+$/g, "").trim();
  return Boolean(loosened && hay.includes(loosened));
}

function evidenceText(source: string, evidence: string): string {
  if (!evidence.trim()) return "";
  return quoteInSource(source, evidence) ? evidence.trim() : "";
}

function norm(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hold(
  change: ProjectChange,
  domain: string,
  reason: string,
  safety: SafetyTag[],
  kind: "needs_you" | "no_change" | "left_untouched",
): ReviewedChange {
  const label =
    kind === "needs_you" ? "Needs You" : kind === "no_change" ? "No change" : "Left untouched";
  const decision: CaptureApplyDecision =
    kind === "needs_you"
      ? { kind: "needs_you", domain: domain as "unsupported", reason }
      : kind === "no_change"
        ? { kind: "no_change", domain: domain as "unsupported", reason }
        : { kind: "needs_you", domain: "unsupported", reason };
  return {
    id: change.id,
    modelOutcome: change.outcome,
    modelOperation: change.operation,
    label: kind === "left_untouched" ? "Left untouched" : label,
    reason,
    domain,
    operation: null,
    decision:
      kind === "left_untouched"
        ? { kind: "no_change", domain: "unsupported", reason }
        : decision,
    safety,
    evidence: change.evidence,
    statement: reason,
  };
}

function ready(
  change: ProjectChange,
  domain: string,
  operation: CaptureLegalOperation,
  safety: SafetyTag[] = [],
): ReviewedChange {
  if (change.materialUncertainty.length > 0) {
    return hold(
      change,
      domain,
      "This change has a material unresolved assumption.",
      safety,
      "needs_you",
    );
  }
  return {
    id: change.id,
    modelOutcome: change.outcome,
    modelOperation: change.operation,
    label: "Ready",
    reason: "",
    domain,
    operation,
    decision: { kind: "write", domain: domain as "todo", operation },
    safety,
    evidence: change.evidence,
    statement: change.evidence,
  };
}

function parseChange(raw: unknown, index: number): ProjectChange | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const outcomeRaw = asString(row.outcome).toLowerCase();
  const operationRaw = asString(row.operation).toLowerCase() || "none";
  const operation = operationRaw === "write_decision" ? "write_knowledge" : operationRaw;
  if (!isFormOutcome(outcomeRaw) || !isFormOperation(operation)) return null;
  const values =
    row.values && typeof row.values === "object" && !Array.isArray(row.values)
      ? (row.values as Record<string, unknown>)
      : {};
  if (operationRaw === "write_decision" && !asString(values.section)) {
    values.section = "decisions";
  }
  return {
    id: asString(row.id) || `chg-${index + 1}`,
    outcome: outcomeRaw,
    operation,
    targetId: asString(row.targetId) || asString(values.personId) || asString(values.targetId) || null,
    evidence: asString(row.evidence),
    reason: asString(row.reason) || asString(row.commentary) || null,
    materialUncertainty: readMaterialUncertainty(row.materialUncertainty ?? values.materialUncertainty),
    values,
  };
}

export function parseProjectChangeForm(raw: unknown): ProjectChangeForm {
  const obj = raw && typeof raw === "object" ? (raw as { changes?: unknown }) : null;
  const list = Array.isArray(obj?.changes) ? obj.changes : [];
  return {
    changes: list.flatMap((item, index) => {
      const parsed = parseChange(item, index);
      return parsed ? [parsed] : [];
    }),
  };
}

function domainFor(operation: FormOperationName): string {
  if (operation.startsWith("create_todo") || operation.includes("todo")) return "todo";
  if (operation.includes("risk")) return "risk";
  if (operation.includes("milestone")) return "milestone";
  if (operation === "ensure_person") return "person";
  if (operation === "confirm_responsibility") return "responsibility";
  if (operation === "write_availability") return "availability";
  if (operation === "write_knowledge") return "knowledge";
  if (operation === "write_memory") return "memory";
  return "unsupported";
}

function knowledgeBypass(evidence: string): boolean {
  if (scopeFromResponsiblePhrase(evidence)) return true;
  return PERSON_AUTHORITY.test(evidence);
}

/**
 * Closed referents that do not identify a Person.
 * This is not a responsibility-language parser.
 */
export function isUnresolvedPersonReference(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return false;
  if (/^(someone|somebody|they|them|he|she|anyone|anybody)$/.test(normalized)) return true;
  if (/^(someone|somebody)\b/.test(normalized)) return true;
  if (/^one of the\b/.test(normalized)) return true;
  return false;
}

export function reviewProjectChangeForm(args: {
  form: ProjectChangeForm;
  context: SharedOrganiseContext;
  source: string;
}): ReviewedChange[] {
  return args.form.changes.map((change) => reviewOne(change, args.context, args.source));
}

function reviewOne(
  change: ProjectChange,
  context: SharedOrganiseContext,
  source: string,
): ReviewedChange {
  const safety: SafetyTag[] = [];
  const quoted = evidenceText(source, change.evidence);
  const domain = domainFor(change.operation);

  if (change.outcome === "commentary") {
    return hold(change, "unsupported", change.reason || "Treated as commentary.", safety, "no_change");
  }
  if (change.outcome === "left_untouched") {
    return hold(
      change,
      "unsupported",
      change.reason || "Lume couldn't safely interpret this part of your capture.",
      safety,
      "left_untouched",
    );
  }
  if (change.outcome === "needs_you") {
    return hold(change, domain, change.reason || "Lume needs you to confirm this.", safety, "needs_you");
  }
  if (change.outcome === "no_change" || change.operation === "none") {
    return hold(change, domain, change.reason || "No change to current project truth.", safety, "no_change");
  }
  if (!quoted) {
    return hold(
      change,
      domain,
      "This change has no evidence quote from the input.",
      safety,
      "needs_you",
    );
  }
  if (/\bnot on this project\b/i.test(quoted)) {
    safety.push("not_on_this_project");
    return hold(change, domain, "The input says this is not on this project.", safety, "no_change");
  }
  let targetId = change.targetId;
  if (targetId && context.contextOnlyIds.has(targetId)) safety.push("context_only_id");
  if (targetId && !context.contextOnlyIds.has(targetId) && !context.targetable.has(targetId)) {
    safety.push("invented_stable_id");
  }
  if (targetId && context.contextOnlyIds.has(targetId)) {
    targetId = null;
  }
  if (targetId && !context.targetable.has(targetId)) {
    safety.push("invented_stable_id");
    return hold(
      change,
      domain,
      "That id is not a targetable record on this project.",
      safety,
      "needs_you",
    );
  }
  const target = targetId ? context.targetable.get(targetId) : undefined;
  if (target && target.projectId !== context.projectId) {
    return hold(change, domain, "That record belongs to another project.", ["cross_project_create"], "needs_you");
  }

  if (
    (change.operation === "write_knowledge" || change.operation === "write_memory") &&
    knowledgeBypass(quoted)
  ) {
    safety.push("knowledge_bypass");
    return hold(
      change,
      "responsibility",
      "This assertion names a person and a responsibility or authority. Knowledge cannot carry it.",
      safety,
      "needs_you",
    );
  }

  return checkOperation(change, context, quoted, target, safety);
}

function checkOperation(
  change: ProjectChange,
  context: SharedOrganiseContext,
  quoted: string,
  target: TargetableRecord | undefined,
  safety: SafetyTag[],
): ReviewedChange {
  const values = change.values;
  const projectId = context.projectId;

  if (change.operation === "ensure_person") {
    const name = asString(values.name) || asString(values.personName);
    if (isUnresolvedPersonReference(name)) {
      safety.push("unresolved_person");
      return hold(
        change,
        "person",
        "This does not identify a person. Lume will not create a Person from a generic reference.",
        safety,
        "needs_you",
      );
    }
    if (!name || !recordedPersonNameAppearsInText(quoted, name)) {
      return hold(change, "person", "This Person identity is not established in the input.", safety, "needs_you");
    }
    const existingPerson = context.people.find((person) => namesMatchExact(person.name, name));
    if (existingPerson) {
      const roleHint = asString(values.roleHint) || asString(values.role);
      if (roleHint && norm(existingPerson.role) !== norm(roleHint)) {
        safety.push("role_update_unsupported");
        return hold(
          change,
          "person",
          "This person is already on the project. A role change is not a supported write, so Lume will not pretend the role was updated.",
          safety,
          "needs_you",
        );
      }
      safety.push("duplicate_person");
      return hold(change, "person", `${name} is already on this project.`, safety, "no_change");
    }
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 && context.people.length > 0) {
      const first = tokens[0]!.toLowerCase();
      if (context.people.some((person) => person.name.trim().split(/\s+/)[0]?.toLowerCase() === first)) {
        safety.push("wrong_existing_person");
        return hold(
          change,
          "person",
          "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder.",
          safety,
          "needs_you",
        );
      }
    }
    const operation: CaptureLegalOperation = {
      type: "ensure_person",
      projectId,
      name,
      roleHint: asString(values.roleHint) || asString(values.role) || undefined,
    };
    return ready(change, "person", operation, safety);
  }

  if (change.operation === "confirm_responsibility") {
    return checkResponsibility(change, context, quoted, safety);
  }

  if (change.operation === "create_todo") {
    const title = asString(values.title);
    if (!title || !recordedTitleEvidencedInText(quoted, title)) {
      return hold(change, "todo", "This to-do title is not established in the input.", safety, "needs_you");
    }
    if ([...context.targetable.values()].some((row) => row.domain === "todo" && norm(row.title) === norm(title))) {
      return hold(change, "todo", "A to-do with this title already exists.", safety, "needs_you");
    }
    const due = firstUsableIsoDate(values.dueAt, values.date);
    return ready(change, "todo", {
      type: "create_todo",
      projectId,
      title,
      detail: asString(values.detail) || undefined,
      dueAt: due,
    }, safety);
  }

  if (change.operation === "complete_todo" || change.operation === "update_todo" || change.operation === "delete_todo") {
    if (!target || target.domain !== "todo") {
      return hold(change, "todo", "This does not identify that existing to-do.", safety, "needs_you");
    }
    if (!recordedTitleEvidencedInText(quoted, target.title)) {
      return hold(
        change,
        "todo",
        "This does not identify that existing record. Lume will not apply the change to a different item.",
        safety,
        "needs_you",
      );
    }
    if (change.operation === "delete_todo") {
      safety.push("destructive");
      if (!/\b(delete|remove)\b/i.test(quoted)) {
        return hold(change, "todo", "Removal needs an explicit delete or remove in the input.", safety, "needs_you");
      }
      return ready(change, "todo", { type: "delete_todo", projectId, todoId: target.id }, safety);
    }
    if (change.operation === "complete_todo") {
      if (target.done) {
        return hold(change, "todo", "This to-do is already complete.", safety, "no_change");
      }
      return ready(change, "todo", { type: "complete_todo", projectId, todoId: target.id }, safety);
    }
    return ready(change, "todo", {
      type: "update_todo",
      projectId,
      todoId: target.id,
      title: asString(values.title) || undefined,
      detail: asString(values.detail) || undefined,
      dueAt: firstUsableIsoDate(values.dueAt, values.date),
    }, safety);
  }

  if (change.operation === "create_risk") {
    const title = asString(values.title);
    if (!title || !recordedTitleEvidencedInText(quoted, title)) {
      return hold(change, "risk", "This risk title is not established in the input.", safety, "needs_you");
    }
    if ([...context.targetable.values()].some((row) => row.domain === "risk" && norm(row.title) === norm(title))) {
      return hold(change, "risk", "A risk with this title already exists.", safety, "needs_you");
    }
    return ready(change, "risk", { type: "create_risk", projectId, title }, safety);
  }

  if (change.operation === "update_risk_status") {
    if (!target || target.domain !== "risk") {
      return hold(change, "risk", "This does not identify that existing risk.", safety, "needs_you");
    }
    if (!recordedTitleEvidencedInText(quoted, target.title)) {
      return hold(
        change,
        "risk",
        "This does not identify that existing record. Lume will not apply the change to a different item.",
        safety,
        "needs_you",
      );
    }
    const status = asString(values.status).toLowerCase();
    if (!RISK_STATUS.has(status)) {
      return hold(change, "risk", "This risk update is not a supported status.", safety, "needs_you");
    }
    if (target.status && norm(target.status) === status) {
      return hold(change, "risk", "This risk already has that status.", safety, "no_change");
    }
    return ready(change, "risk", {
      type: "update_risk_status",
      projectId,
      riskId: target.id,
      status: status as RiskStatus,
    }, safety);
  }

  if (change.operation === "create_milestone" || change.operation === "update_milestone") {
    return reviewMilestone(change, context, quoted, target, safety);
  }

  if (change.operation === "write_availability") {
    const personName = asString(values.personName) || asString(values.name);
    const away = firstUsableIsoDate(values.awayFromIso, values.date);
    const until = firstUsableIsoDate(values.awayToIso) || away;
    if (!personName || !recordedPersonNameAppearsInText(quoted, personName) || !away || !until) {
      return hold(change, "availability", "Availability needs a full name in the input and ISO dates.", safety, "needs_you");
    }
    const person = context.people.find((row) => namesMatchExact(row.name, personName));
    if (!person) {
      return hold(change, "availability", "Availability needs an existing person on this project.", safety, "needs_you");
    }
    if (target && target.id !== person.id) {
      safety.push("wrong_existing_person");
      return hold(change, "availability", "The person id does not match the named person.", safety, "needs_you");
    }
    return ready(change, "availability", {
      type: "write_availability",
      projectId,
      personId: person.id,
      personName: person.name,
      awayFromIso: away,
      awayToIso: until,
    }, safety);
  }

  if (change.operation === "write_knowledge" || change.operation === "write_memory") {
    const text = asString(values.text) || asString(values.title);
    if (!text || !recordedTitleEvidencedInText(quoted, text) && !quoteInLoose(quoted, text)) {
      return hold(change, "knowledge", "This knowledge text is not established in the input.", safety, "needs_you");
    }
    if (change.operation === "write_memory") {
      return ready(change, "memory", { type: "write_memory", projectId, title: text }, safety);
    }
    const section = asString(values.section) || "now";
    if (!SECTIONS.has(section)) {
      return hold(change, "knowledge", "This knowledge section is not supported.", safety, "needs_you");
    }
    return ready(change, "knowledge", {
      type: "write_knowledge",
      projectId,
      section: section as KnowledgeSectionId,
      text,
    }, safety);
  }

  return hold(change, "unsupported", "This operation is not supported.", safety, "needs_you");
}

function reviewMilestone(
  change: ProjectChange,
  context: SharedOrganiseContext,
  quoted: string,
  target: TargetableRecord | undefined,
  safety: SafetyTag[],
): ReviewedChange {
  const projectId = context.projectId;
  if (change.operation === "update_milestone") {
    if (!target || target.domain !== "milestone") {
      return hold(change, "milestone", "This does not identify that existing milestone.", safety, "needs_you");
    }
    if (!recordedTitleEvidencedInText(quoted, target.title)) {
      return hold(
        change,
        "milestone",
        "This does not identify that existing record. Lume will not apply the change to a different item.",
        safety,
        "needs_you",
      );
    }
  }
  const label = asString(change.values.label) || asString(change.values.title);
  if (change.operation === "create_milestone") {
    if (!label || !recordedTitleEvidencedInText(quoted, label)) {
      return hold(change, "milestone", "This milestone label is not established in the input.", safety, "needs_you");
    }
  }
  const hasDateProposal =
    asString(change.values.dateIntent) !== "" ||
    asString(change.values.date) !== "" ||
    asString(change.values.startAt) !== "" ||
    asString(change.values.direction) !== "" ||
    change.values.amount != null;
  if (!hasDateProposal && change.operation === "update_milestone" && label) {
    return ready(change, "milestone", {
      type: "update_milestone",
      projectId,
      milestoneId: target!.id,
      label,
    }, safety);
  }
  const decision = decideMilestoneDate({
    values: change.values,
    evidence: quoted,
    referenceDate: context.referenceDate,
    canonicalDate: target?.domain === "milestone" ? target.date : undefined,
  });
  if (decision.kind === "needs_you") {
    return hold(change, "milestone", decision.reason, safety, "needs_you");
  }
  if (decision.kind === "no_change") {
    return hold(change, "milestone", decision.reason, safety, "no_change");
  }
  if (change.operation === "create_milestone") {
    return ready(change, "milestone", {
      type: "create_milestone",
      projectId,
      label,
      startAt: decision.startAt,
    }, safety);
  }
  return ready(change, "milestone", {
    type: "update_milestone",
    projectId,
    milestoneId: target!.id,
    label: label || undefined,
    startAt: decision.startAt,
  }, safety);
}

function quoteInLoose(quoted: string, text: string): boolean {
  const hay = quoted.replace(/\s+/g, " ").toLowerCase();
  const needle = text.replace(/\s+/g, " ").trim().toLowerCase();
  return needle.length > 0 && hay.includes(needle);
}

function checkResponsibility(
  change: ProjectChange,
  context: SharedOrganiseContext,
  quoted: string,
  safety: SafetyTag[],
): ReviewedChange {
  const projectId = context.projectId;
  const personName = asString(change.values.personName) || asString(change.values.name);
  const scope = asString(change.values.scope);
  const semantics = asString(change.values.ownershipSemantics).toLowerCase();
  if (isUnresolvedPersonReference(personName)) {
    safety.push("unresolved_person");
    return hold(
      change,
      "responsibility",
      "This does not identify a person. Lume will not attach a responsibility to a generic reference.",
      safety,
      "needs_you",
    );
  }
  if (!personName || !recordedPersonNameAppearsInText(quoted, personName)) {
    safety.push("wrong_existing_person");
    return hold(
      change,
      "responsibility",
      "This Person identity is not established in the input. A supplied record id is not enough.",
      safety,
      "needs_you",
    );
  }
  if (!scope) {
    return hold(change, "responsibility", "Responsibility needs a scope.", safety, "needs_you");
  }
  if (semantics && !OWNERSHIP.has(semantics)) {
    return hold(change, "responsibility", "Ownership semantics are not supported.", safety, "needs_you");
  }
  const tokens = personName.split(/\s+/).filter(Boolean);
  const existing = context.people.filter((person) => namesMatchExact(person.name, personName));
  if (tokens.length < 2) {
    const first = tokens[0]?.toLowerCase();
    const firstMatches = context.people.filter(
      (person) => person.name.trim().split(/\s+/)[0]?.toLowerCase() === first,
    );
    if (firstMatches.length > 0) {
      safety.push("wrong_existing_person");
      return hold(
        change,
        "responsibility",
        "This Person identity is not established in the input. A supplied record id is not enough.",
        safety,
        "needs_you",
      );
    }
  }
  const requestedId = asString(change.values.personId) || change.targetId || "";
  if (requestedId && context.contextOnlyIds.has(requestedId)) {
    safety.push("context_only_id");
  } else if (requestedId && context.targetable.has(requestedId)) {
    const bound = context.targetable.get(requestedId)!;
    if (bound.domain !== "person" || !namesMatchExact(bound.title, personName)) {
      safety.push("wrong_existing_person");
      return hold(
        change,
        "responsibility",
        "The person id does not match the name established in the input.",
        safety,
        "needs_you",
      );
    }
    if (!recordedPersonNameAppearsInText(quoted, bound.title)) {
      safety.push("wrong_existing_person");
      return hold(
        change,
        "responsibility",
        "This Person identity is not established in the input. A supplied record id is not enough.",
        safety,
        "needs_you",
      );
    }
  }

  const owners = context.responsibilities.filter(
    (row) => row.ownerConfirmed && scopesMatchExact(row.scope, scope),
  );
  const sameOwner = owners.find((row) => namesMatchExact(row.personName, personName));
  if (semantics === "continue" || (sameOwner && semantics !== "replace" && semantics !== "share")) {
    if (sameOwner) {
      return hold(change, "responsibility", "This responsibility is already recorded.", safety, "no_change");
    }
  }
  if (semantics === "replace") {
    if (owners.length !== 1) {
      return hold(
        change,
        "responsibility",
        "Replacement needs a confirmed current owner. Confirm before Lume changes ownership.",
        safety,
        "needs_you",
      );
    }
    const owner = owners[0]!;
    const ownerRecord = owner.personId ? context.targetable.get(owner.personId) : undefined;
    if (!ownerRecord || ownerRecord.domain !== "person" || !namesMatchExact(ownerRecord.title, owner.personName)) {
      return hold(
        change,
        "responsibility",
        "Replacement needs a confirmed current owner on this project.",
        safety,
        "needs_you",
      );
    }
    if (!recordedPersonNameAppearsInText(quoted, owner.personName)) {
      return hold(
        change,
        "responsibility",
        "Replacement needs the current owner to be named in the input.",
        safety,
        "needs_you",
      );
    }
    const operation: CaptureLegalOperation = {
      type: "confirm_responsibility",
      projectId,
      scope,
      personName,
      personId: existing[0]?.id ?? null,
      replacePersonId: owner.personId,
    };
    return ready(change, "responsibility", operation, safety);
  }
  if ((semantics === "ambiguous" || !semantics) && owners.some((row) => !namesMatchExact(row.personName, personName))) {
    return hold(
      change,
      "responsibility",
      "It's unclear whether this ownership replaces or shares the current owner.",
      safety,
      "needs_you",
    );
  }
  const operation: CaptureLegalOperation = {
    type: "confirm_responsibility",
    projectId,
    scope,
    personName,
    personId: existing[0]?.id ?? null,
    replacePersonId: null,
  };
  return ready(change, "responsibility", operation, safety);
}
