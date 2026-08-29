/**
 * Phase 3B — exhaustive typed Capture apply planner.
 *
 * Every supported domain has an explicit handler. Unknown / invalid
 * combinations fail closed (Needs you). There is no Todo fallback.
 */

import {
  namesMatchExact,
  peopleEvidencedByRecordedNameInText,
  recordedPersonNameAppearsInText,
} from "@/lib/people/identity";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import { classifyCaptureLegalDomain } from "./classify";
import { resolveCaptureProjectScope } from "./project-scope";
import {
  assertNever,
  hasInvalidOwnershipSemantics,
  isOwnershipSemantics,
  type CaptureApplyDecision,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
  type CaptureLegalOperation,
  type OwnershipSemantics,
  type PlanCaptureApplyInput,
} from "./types";
import { reviewedCreateIdentity } from "./reviewed-identity";

function needsYou(
  domain: CaptureLegalDomain,
  reason: string,
  extra?: Pick<Extract<CaptureApplyDecision, { kind: "needs_you" }>, "confirmOwner">,
): CaptureApplyDecision {
  return { kind: "needs_you", domain, reason, ...extra };
}

function noChange(domain: CaptureLegalDomain, reason: string): CaptureApplyDecision {
  return { kind: "no_change", domain, reason };
}

function write(
  domain: Exclude<CaptureLegalDomain, "unsupported">,
  operation: CaptureLegalOperation,
): CaptureApplyDecision {
  return { kind: "write", domain, operation };
}

function isoDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

function parseIsoDate(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10) + (trimmed.includes("T") ? trimmed.slice(10) : "T12:00:00.000Z");
  }
  return undefined;
}

function proposedValues(item: PendingSuggestion): Record<string, unknown> {
  return (
    (item as PendingSuggestion & { proposedValues?: Record<string, unknown> })
      .proposedValues ?? {}
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function targetId(item: PendingSuggestion): string | undefined {
  if (item.targetEntityId?.trim()) return item.targetEntityId.trim();
  return undefined;
}

function requireTodoOnProject(
  world: CaptureApplyWorld,
  projectId: string,
  todoId: string,
) {
  const todo = world.todos.find((t) => t.id === todoId);
  if (!todo || todo.projectId !== projectId) {
    return null;
  }
  return todo;
}

function planTodo(
  item: PendingSuggestion,
  text: string,
  projectId: string,
  world: CaptureApplyWorld,
): CaptureApplyDecision {
  const todoId = item.targetTodoId?.trim() || targetId(item);
  if (item.op === "complete") {
    if (!todoId) {
      return needsYou("todo", "This To Do cannot be completed — the target item is missing.");
    }
    if (!requireTodoOnProject(world, projectId, todoId)) {
      return needsYou("todo", "This To Do cannot be completed — the target is not on this project.");
    }
    return write("todo", { type: "complete_todo", projectId, todoId });
  }
  if (item.op === "delete" || item.op === "remove") {
    if (!todoId) {
      return needsYou("todo", "This To Do cannot be removed — the target item is missing.");
    }
    if (!requireTodoOnProject(world, projectId, todoId)) {
      return needsYou("todo", "This To Do cannot be removed — the target is not on this project.");
    }
    return write("todo", { type: "delete_todo", projectId, todoId });
  }
  if (item.op === "archive") {
    if (!todoId) {
      return needsYou("todo", "This To Do cannot be archived — the target item is missing.");
    }
    if (!requireTodoOnProject(world, projectId, todoId)) {
      return needsYou("todo", "This To Do cannot be archived — the target is not on this project.");
    }
    return write("todo", { type: "complete_todo", projectId, todoId });
  }
  if (item.op === "update") {
    if (!todoId) {
      return needsYou("todo", "This To Do cannot be updated — the target item is missing.");
    }
    if (!requireTodoOnProject(world, projectId, todoId)) {
      return needsYou("todo", "This To Do cannot be updated — the target is not on this project.");
    }
    const detail = item.recommendation?.action;
    const dueAt = item.date;
    if (!dueAt && detail === undefined) {
      return needsYou(
        "todo",
        "This To Do update is not specific enough to apply automatically.",
      );
    }
    return write("todo", {
      type: "update_todo",
      projectId,
      todoId,
      detail,
      dueAt,
    });
  }
  if (item.op !== "create") {
    return needsYou("todo", "This To Do operation is not supported.");
  }
  const title = reviewedCreateIdentity(item);
  if (!title) {
    return needsYou("todo", "This To Do has no title.");
  }
  if (todoId) {
    if (!requireTodoOnProject(world, projectId, todoId)) {
      return needsYou(
        "todo",
        "This To Do target is not on this project. Lume will not create a replacement.",
      );
    }
    return noChange("todo", "This To Do is already on the project.");
  }
  return write("todo", {
    type: "create_todo",
    projectId,
    title,
    detail: item.recommendation?.action,
    dueAt: item.date,
    todoKind: item.todoKind ?? (item.kind === "nudge" ? "CHASE" : "ACTION"),
    waitingOn: item.waitingOn,
    applyOperationId: item.id.trim() || undefined,
  });
}

function planRisk(
  item: PendingSuggestion,
  text: string,
  projectId: string,
  world: CaptureApplyWorld,
): CaptureApplyDecision {
  const id = targetId(item);
  const projectRisks = world.risks.filter((r) => r.projectId === projectId);

  const resolveExisting = () => {
    if (!id) return undefined;
    return projectRisks.find((r) => r.id === id);
  };

  if (item.op === "complete" || item.op === "update") {
    const existing = resolveExisting();
    if (!existing) {
      return needsYou(
        "risk",
        "This Risk cannot be updated — the existing Risk could not be identified.",
      );
    }
    if (item.op === "complete") {
      return write("risk", {
        type: "update_risk_status",
        projectId,
        riskId: existing.id,
        status: "resolved",
      });
    }
    const values = proposedValues(item);
    const statusRaw = asString(values.status)?.toLowerCase();
    if (statusRaw === "resolved" || statusRaw === "accepted" || statusRaw === "open" || statusRaw === "watch") {
      return write("risk", {
        type: "update_risk_status",
        projectId,
        riskId: existing.id,
        status: statusRaw,
      });
    }
    // Update without a legal status change is not a Todo and not a silent create.
    return needsYou(
      "risk",
      "This Risk update is not specific enough to apply automatically.",
    );
  }

  if (item.op !== "create") {
    return needsYou("risk", "This Risk operation is not supported.");
  }
  if (id) {
    const existing = projectRisks.find((r) => r.id === id);
    if (existing) {
      return noChange("risk", "This Risk is already on the project.");
    }
    return needsYou(
      "risk",
      "This Risk target is not on this project. Lume will not create another Risk.",
    );
  }
  const title = reviewedCreateIdentity(item);
  if (!title) {
    return needsYou("risk", "This Risk has no title.");
  }
  const needle = title.toLowerCase();
  const exactTitle = projectRisks.filter(
    (r) => r.title.trim().toLowerCase() === needle,
  );
  if (exactTitle.length === 1) {
    return noChange("risk", "This Risk is already on the project.");
  }
  if (exactTitle.length > 1) {
    return needsYou(
      "risk",
      "More than one existing Risk matches this title. Lume will not create another.",
    );
  }
  return write("risk", {
    type: "create_risk",
    projectId,
    title,
    applyOperationId: item.id.trim() || undefined,
  });
}

function planMilestone(
  item: PendingSuggestion,
  text: string,
  projectId: string,
  world: CaptureApplyWorld,
): CaptureApplyDecision {
  const id = targetId(item);
  const projectMilestones = world.timeline.filter((t) => t.projectId === projectId);
  const byId = id ? projectMilestones.find((t) => t.id === id) : undefined;

  if (item.op === "complete") {
    // Timeline items have no completed status in current architecture.
    return needsYou(
      "milestone",
      "Completing a date is not supported yet — Lume will not turn this into a To Do.",
    );
  }

  if (item.op === "update") {
    if (!byId) {
      return needsYou(
        "milestone",
        "This date cannot be updated — the existing milestone could not be identified.",
      );
    }
    const values = proposedValues(item);
    const nextDate =
      parseIsoDate(item.date) ||
      parseIsoDate(asString(values.startAt)) ||
      parseIsoDate(asString(values.date));
    const currentDay = isoDay(byId.startAt);
    const nextDay = isoDay(nextDate);
    if (nextDay && currentDay && nextDay === currentDay) {
      return noChange("milestone", "This date is already recorded.");
    }
    if (!nextDate) {
      if (text === byId.label) {
        return noChange("milestone", "This date is already recorded.");
      }
      return needsYou(
        "milestone",
        "This date change is not specific enough to apply automatically.",
      );
    }
    return write("milestone", {
      type: "update_milestone",
      projectId,
      milestoneId: byId.id,
      startAt: nextDate,
    });
  }

  if (item.op !== "create") {
    return needsYou("milestone", "This date operation is not supported.");
  }
  if (id) {
    if (!byId) {
      return needsYou(
        "milestone",
        "This date target is not on this project. Lume will not create another date.",
      );
    }
    return noChange("milestone", "This date is already on the project.");
  }
  const label = reviewedCreateIdentity(item);
  if (!label) {
    return needsYou("milestone", "This date has no label.");
  }
  const startAt =
    parseIsoDate(item.date) ||
    parseIsoDate(asString(proposedValues(item).startAt)) ||
    parseIsoDate(asString(proposedValues(item).date));
  if (!startAt) {
    return needsYou(
      "milestone",
      "This date cannot be saved — the date is missing.",
    );
  }
  return write("milestone", {
    type: "create_milestone",
    projectId,
    label,
    startAt,
    notes: item.timelineItem?.notes,
    applyOperationId: item.id.trim() || undefined,
  });
}

function resolvePerson(
  projectId: string,
  world: CaptureApplyWorld,
  item: PendingSuggestion,
  text: string,
) {
  const project = world.projects.find((p) => p.id === projectId);
  if (!project) return { status: "missing_project" as const };
  const personId = item.personId?.trim() || targetId(item);
  const named = item.personName?.trim();
  const evidenced = peopleEvidencedByRecordedNameInText(
    project.stakeholders,
    text,
  );

  if (personId) {
    const byId = project.stakeholders.find((s) => s.id === personId);
    if (!byId) return { status: "unknown" as const };
    if (named) {
      const namedMatchesOther = project.stakeholders.some(
        (s) => s.id !== byId.id && namesMatchExact(s.name, named),
      );
      const namedTokens = named.split(/\s+/).filter(Boolean);
      if (
        namedMatchesOther ||
        (namedTokens.length >= 2 && !namesMatchExact(named, byId.name))
      ) {
        return { status: "unknown" as const };
      }
    }
    const sameName = project.stakeholders.filter((s) =>
      namesMatchExact(s.name, byId.name),
    );
    if (sameName.length > 1) return { status: "ambiguous" as const };
    if (!recordedPersonNameAppearsInText(text, byId.name)) {
      return { status: "unknown" as const };
    }
    return { status: "known" as const, person: byId };
  }

  if (evidenced.length > 1) {
    return { status: "ambiguous" as const };
  }
  if (evidenced.length === 1) {
    return { status: "known" as const, person: evidenced[0]! };
  }

  if (named) {
    const byName = project.stakeholders.filter((s) =>
      namesMatchExact(s.name, named),
    );
    if (byName.length > 1) return { status: "ambiguous" as const };
    if (byName.length === 1) {
      if (!recordedPersonNameAppearsInText(text, byName[0]!.name)) {
        return { status: "unknown" as const };
      }
      return { status: "known" as const, person: byName[0]! };
    }
    const tokens = named.split(/\s+/).filter(Boolean);
    if (
      tokens.length >= 2 &&
      recordedPersonNameAppearsInText(text, named)
    ) {
      return { status: "new_named" as const, name: named, personId };
    }
    return { status: "unknown" as const };
  }

  return { status: "unknown" as const };
}

function planPerson(
  item: PendingSuggestion,
  text: string,
  projectId: string,
  world: CaptureApplyWorld,
): CaptureApplyDecision {
  if (item.op !== "create" && item.op !== "update") {
    return needsYou("person", "This person operation is not supported.");
  }
  const values = proposedValues(item);
  const ownershipRaw = item.ownershipSemantics ?? values.ownershipSemantics;
  if (
    hasInvalidOwnershipSemantics(ownershipRaw) ||
    item.responsibilityScope?.trim() ||
    asString(values.scope)
  ) {
    return needsYou(
      "person",
      "This looks like an ownership change, not a new person. Lume will not write a stakeholder.",
    );
  }
  const resolved = resolvePerson(projectId, world, item, text);
  if (resolved.status === "missing_project") {
    return needsYou("person", "This person cannot be saved — the project is missing.");
  }
  if (resolved.status === "ambiguous") {
    return needsYou("person", "More than one existing person matches this Capture. Choose who it refers to.");
  }
  if (resolved.status === "known") {
    if (item.op === "create") {
      return noChange(
        "person",
        `${resolved.person.name} is already on this project.`,
      );
    }
    return write("person", {
      type: "ensure_person",
      projectId,
      name: resolved.person.name,
      personId: resolved.person.id,
      roleHint: resolved.person.role,
    });
  }
  if (resolved.status === "new_named") {
    return write("person", {
      type: "ensure_person",
      projectId,
      name: resolved.name,
      personId: resolved.personId,
    });
  }
  return needsYou(
    "person",
    "Lume cannot tell which person this refers to, so it will not create a new stakeholder.",
  );
}

function currentOwners(
  world: CaptureApplyWorld,
  projectId: string,
  scope: string,
) {
  const knowledge = world.knowledge.find((k) => k.projectId === projectId);
  const hits: Array<{ personId?: string | null; personName?: string | null }> = [];
  for (const item of knowledge?.structured ?? []) {
    if (item.kind !== "responsibility" || item.lifecycle !== "current") continue;
    const resp = item.meta?.responsibility;
    if (!resp?.scope) continue;
    if (resp.scope.trim().toLowerCase() !== scope.trim().toLowerCase()) continue;
    if (!resp.ownerConfirmed) continue;
    hits.push({ personId: resp.personId, personName: resp.personName });
  }
  return hits;
}

function planResponsibility(
  item: PendingSuggestion,
  text: string,
  projectId: string,
  world: CaptureApplyWorld,
): CaptureApplyDecision {
  if (item.op !== "create" && item.op !== "update") {
    return needsYou(
      "responsibility",
      "This ownership operation is not supported.",
    );
  }
  const values = proposedValues(item);
  const scope =
    item.responsibilityScope?.trim() ||
    asString(values.scope) ||
    "";
  const personName = item.personName?.trim() || asString(values.personName) || "";
  const semanticsRaw = item.ownershipSemantics ?? values.ownershipSemantics;
  if (hasInvalidOwnershipSemantics(semanticsRaw)) {
    return needsYou(
      "responsibility",
      "This ownership change is not specific enough to apply automatically.",
    );
  }
  const semantics: OwnershipSemantics | undefined = isOwnershipSemantics(
    semanticsRaw,
  )
    ? semanticsRaw
    : undefined;

  if (!scope || !personName) {
    return needsYou(
      "responsibility",
      "This ownership change needs a person and a responsibility before it can be saved.",
    );
  }

  const claimedId = item.personId?.trim() || targetId(item);
  const person = resolvePerson(projectId, world, item, text);
  const personId = person.status === "known" ? person.person.id : undefined;
  if (claimedId && person.status !== "known") {
    return needsYou(
      "responsibility",
      "This person is not on this project. Lume will not change ownership.",
    );
  }

  if (
    semantics === "continue" ||
    (item.op === "update" &&
      semantics === undefined &&
      /\b(remain|still|continues)\b/i.test(text))
  ) {
    const owners = currentOwners(world, projectId, scope);
    const already = owners.some(
      (o) =>
        (personId && o.personId === personId) ||
        (o.personName && namesMatchExact(o.personName, personName)),
    );
    if (already || owners.length === 0) {
      // Continuing a known assignment, or no structured row yet but person exists:
      // do not mint a duplicate stakeholder. If the person is known, no-op.
      if (person.status === "known" || already) {
        return noChange("responsibility", "This responsibility is already recorded.");
      }
    }
  }

  if (semantics === "ambiguous" || !semantics) {
    const owners = currentOwners(world, projectId, scope);
    const others = owners.filter(
      (o) =>
        !(personId && o.personId === personId) &&
        !(o.personName && namesMatchExact(o.personName, personName)),
    );
    if (others.length > 0) {
      return needsYou(
        "responsibility",
        "This could share or replace the current owner. Confirm before Lume changes ownership.",
        {
          confirmOwner: {
            projectId,
            scope,
            personName,
            personId: personId ?? null,
          },
        },
      );
    }
  }

  if (semantics === "replace") {
    const replacePersonId =
      item.replacePersonId?.trim() || asString(values.replacePersonId) || null;
    if (!replacePersonId) {
      const owners = currentOwners(world, projectId, scope);
      if (owners.length !== 1 || !owners[0]?.personId) {
        return needsYou(
          "responsibility",
          "Replacement needs a confirmed current owner. Confirm before Lume changes ownership.",
          {
            confirmOwner: {
              projectId,
              scope,
              personName,
              personId: personId ?? null,
            },
          },
        );
      }
      return write("responsibility", {
        type: "confirm_responsibility",
        projectId,
        scope,
        personName,
        personId: personId ?? null,
        replacePersonId: owners[0].personId,
      });
    }
    const owners = currentOwners(world, projectId, scope);
    if (!owners.some((o) => o.personId === replacePersonId)) {
      return needsYou(
        "responsibility",
        "Replacement needs a confirmed current owner. Confirm before Lume changes ownership.",
        {
          confirmOwner: {
            projectId,
            scope,
            personName,
            personId: personId ?? null,
          },
        },
      );
    }
    return write("responsibility", {
      type: "confirm_responsibility",
      projectId,
      scope,
      personName,
      personId: personId ?? null,
      replacePersonId,
    });
  }

  // Explicit share, first assignment, or continue with no current row.
  return write("responsibility", {
    type: "confirm_responsibility",
    projectId,
    scope,
    personName,
    personId: personId ?? null,
    replacePersonId: null,
  });
}

function planAvailability(
  item: PendingSuggestion,
  text: string,
  projectId: string,
  world: CaptureApplyWorld,
): CaptureApplyDecision {
  if (item.op !== "create" && item.op !== "update") {
    return needsYou(
      "availability",
      "This availability operation is not supported.",
    );
  }
  const values = proposedValues(item);
  const person = resolvePerson(projectId, world, item, text);
  if (person.status === "ambiguous" || person.status === "unknown" || person.status === "missing_project") {
    return needsYou(
      "availability",
      "This availability cannot be saved — Lume cannot tell which person it refers to.",
    );
  }
  const personId = person.status === "known" ? person.person.id : person.personId;
  const personName = person.status === "known" ? person.person.name : person.name;
  if (!personId) {
    return needsYou(
      "availability",
      "This availability cannot be saved — the person is not a known identity on this project.",
    );
  }
  const from =
    parseIsoDate(asString(values.awayFromIso)) ||
    parseIsoDate(item.date) ||
    parseIsoDate(asString(values.from));
  const to =
    parseIsoDate(asString(values.awayToIso)) ||
    parseIsoDate(asString(values.to)) ||
    from;
  if (!from || !to) {
    return needsYou(
      "availability",
      "This availability cannot be saved — the dates are not clear.",
    );
  }

  const knowledge = world.knowledge.find((k) => k.projectId === projectId);
  const already = (knowledge?.structured ?? []).some((row) => {
    if (row.kind !== "availability" || row.lifecycle !== "current") return false;
    const meta = row.meta?.availability;
    const linked =
      meta?.personId === personId || row.meta?.personId === personId;
    if (!linked) return false;
    return (
      isoDay(meta?.awayFromIso ?? undefined) === isoDay(from) &&
      isoDay(meta?.awayToIso ?? undefined) === isoDay(to)
    );
  });
  if (already) {
    return noChange("availability", "This availability is already recorded.");
  }

  return write("availability", {
    type: "write_availability",
    projectId,
    personId,
    personName,
    awayFromIso: from,
    awayToIso: to,
    label: asString(values.label) || text,
  });
}

function planKnowledge(
  item: PendingSuggestion,
  text: string,
  projectId: string,
): CaptureApplyDecision {
  if (item.op !== "create" && item.op !== "update") {
    return needsYou("knowledge", "This knowledge operation is not supported.");
  }
  const body = reviewedCreateIdentity(item);
  if (!body) {
    return needsYou("knowledge", "This knowledge item has no text.");
  }
  const section =
    item.knowledgeSection ??
    (item.kind === "decision" ? "decisions" : "now");
  if (section === "people" || section === "risks") {
    // People/risks knowledge bullets are not a legal fallback for those domains.
    return needsYou(
      "knowledge",
      "This belongs to People or Risks, not a generic knowledge note.",
    );
  }
  return write("knowledge", {
    type: "write_knowledge",
    projectId,
    section,
    text: body,
  });
}

function planMemory(item: PendingSuggestion, text: string, projectId: string): CaptureApplyDecision {
  if (item.op !== "create" && item.op !== "update") {
    return needsYou("memory", "This memory operation is not supported.");
  }
  const title = reviewedCreateIdentity(item);
  if (!title) {
    return needsYou("memory", "This memory has no text.");
  }
  return write("memory", { type: "write_memory", projectId, title });
}

/**
 * Plan a legal apply. Pure — no I/O, no MissionState mutation.
 */
export function planCaptureApply(input: PlanCaptureApplyInput): CaptureApplyDecision {
  const { item, text, world, captureEntryProjectId } = input;
  const domain = classifyCaptureLegalDomain(item);

  if (domain === "unsupported") {
    return needsYou(
      "unsupported",
      "Lume cannot safely apply this finding to a maintained record.",
    );
  }

  if (item.truthIntent === "non_current") {
    return noChange(
      domain,
      "Not asserting current project truth — no mutation.",
    );
  }
  if (item.truthIntent === "uncertain") {
    return needsYou(
      domain,
      "It is unclear whether this should change current project truth.",
    );
  }

  const scope = resolveCaptureProjectScope({
    item,
    captureEntryProjectId,
    workspaceProjectIds: world.projectIds,
  });
  if (!scope.ok) {
    return needsYou(domain, scope.reason);
  }
  const projectId = scope.projectId;

  const hasReviewedIdentity = Boolean(reviewedCreateIdentity(item));
  if (!text && !hasReviewedIdentity && domain !== "todo") {
    // todo handler has its own empty-title check; other domains need payload.
    if (domain !== "risk" && item.op !== "complete") {
      return needsYou(domain, "This finding has no text to apply.");
    }
  }

  switch (domain) {
    case "todo":
      return planTodo(item, text, projectId, world);
    case "risk":
      return planRisk(item, text, projectId, world);
    case "milestone":
      return planMilestone(item, text, projectId, world);
    case "person":
      return planPerson(item, text, projectId, world);
    case "responsibility":
      return planResponsibility(item, text, projectId, world);
    case "availability":
      return planAvailability(item, text, projectId, world);
    case "knowledge":
      return planKnowledge(item, text, projectId);
    case "memory":
      return planMemory(item, text, projectId);
    default:
      return assertNever(domain, "unsupported Capture apply domain");
  }
}
