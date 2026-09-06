/**
 * Narrow stale-Apply protection: expected target fingerprint.
 * No schema version column. Compare durable identity + material fields.
 */
import type { CaptureApplyWorld, CaptureLegalDomain } from "./types";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import { currentOwners } from "./dispatch";

export type CaptureExpectedTarget = {
  id: string;
  domain: CaptureLegalDomain;
  title?: string;
  status?: string;
  startAt?: string;
  endAt?: string;
  notes?: string;
  name?: string;
  done?: boolean;
  dueAt?: string;
  detail?: string;
  replacePersonId?: string;
  ownerIds?: string;
  scope?: string;
  awayFromIso?: string;
  awayToIso?: string;
  availabilityKey?: string;
};

function asField(value: string | null | undefined): string {
  return value ?? "";
}

function changed(expected: string | undefined, actual: string | null | undefined) {
  if (expected === undefined) return false;
  return expected !== asField(actual);
}

export function parseExpectedTarget(raw: unknown): CaptureExpectedTarget | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  if (typeof o.domain !== "string" || !o.domain.trim()) return null;
  return {
    id: o.id.trim(),
    domain: o.domain as CaptureLegalDomain,
    title: typeof o.title === "string" ? o.title : undefined,
    status: typeof o.status === "string" ? o.status : undefined,
    startAt: typeof o.startAt === "string" ? o.startAt : undefined,
    endAt: typeof o.endAt === "string" ? o.endAt : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    name: typeof o.name === "string" ? o.name : undefined,
    done: typeof o.done === "boolean" ? o.done : undefined,
    dueAt: typeof o.dueAt === "string" ? o.dueAt : undefined,
    detail: typeof o.detail === "string" ? o.detail : undefined,
    replacePersonId:
      typeof o.replacePersonId === "string" ? o.replacePersonId : undefined,
    ownerIds: typeof o.ownerIds === "string" ? o.ownerIds : undefined,
    scope: typeof o.scope === "string" ? o.scope : undefined,
    awayFromIso: typeof o.awayFromIso === "string" ? o.awayFromIso : undefined,
    awayToIso: typeof o.awayToIso === "string" ? o.awayToIso : undefined,
    availabilityKey:
      typeof o.availabilityKey === "string" ? o.availabilityKey : undefined,
  };
}

/** Durable id the proposal currently names, if any. */
export function proposalTargetId(item: PendingSuggestion): string | undefined {
  if (item.targetEntityId?.trim()) return item.targetEntityId.trim();
  if (item.targetTodoId?.trim()) return item.targetTodoId.trim();
  return undefined;
}

/**
 * Session correction patch. Clear the Analyse fingerprint only when the
 * named target identity changes. An operation-only change must keep it.
 * Create is cleared later by reconcileExpectedTarget.
 */
export function applySessionSuggestionPatch(
  item: PendingSuggestion,
  patch: Partial<PendingSuggestion>,
): PendingSuggestion {
  const next = { ...item, ...patch };
  const targetIdentityChanged =
    (patch.targetEntityId !== undefined &&
      patch.targetEntityId !== item.targetEntityId) ||
    (patch.targetTodoId !== undefined &&
      patch.targetTodoId !== item.targetTodoId);
  if (targetIdentityChanged && patch.expectedTarget === undefined) {
    next.expectedTarget = null;
  }
  return next;
}

/**
 * Keep expectedTarget coherent with the current proposal.
 * Analyse fingerprints the first target; a later correction must not keep
 * describing that old record. Create explicitly declines an existing target.
 */
export function reconcileExpectedTarget(
  item: PendingSuggestion,
  world?: CaptureApplyWorld | null,
): PendingSuggestion {
  if (item.op === "create") {
    return item.expectedTarget ? { ...item, expectedTarget: null } : item;
  }

  const currentId = proposalTargetId(item);
  if (!currentId) {
    return item.expectedTarget ? { ...item, expectedTarget: null } : item;
  }
  if (item.expectedTarget?.id === currentId) {
    return item;
  }
  if (!world) {
    return { ...item, expectedTarget: null };
  }
  const fingerprinted = { ...item, targetEntityId: currentId };
  return {
    ...item,
    expectedTarget: fingerprintExpectedTarget(world, fingerprinted),
  };
}

/** Same predicate Apply uses when Review target and fingerprint diverge. */
export function expectedTargetMismatchReason(
  item: PendingSuggestion,
  expected?: CaptureExpectedTarget | null,
): string | null {
  const expectedId = (expected ?? item.expectedTarget)?.id?.trim();
  const currentId = proposalTargetId(item);
  if (expectedId && currentId && expectedId !== currentId) {
    return "Review target does not match. Capture again before applying.";
  }
  return null;
}

export function fingerprintExpectedTarget(
  world: CaptureApplyWorld,
  item: PendingSuggestion,
): CaptureExpectedTarget | null {
  const id = proposalTargetId(item);
  if (!id) return null;
  const domain = item.legalDomain ?? "unsupported";

  if (domain === "risk" || item.kind === "risk") {
    const risk = world.risks.find((r) => r.id === id);
    if (!risk) return { id, domain: "risk" };
    return {
      id,
      domain: "risk",
      title: risk.title,
      status: risk.status,
    };
  }
  if (domain === "todo" || item.kind === "action" || item.kind === "nudge") {
    const todo = world.todos.find((t) => t.id === id);
    if (!todo) return { id, domain: "todo" };
    return {
      id,
      domain: "todo",
      title: todo.title,
      done: Boolean(todo.done),
      dueAt: asField(todo.dueAt),
      detail: asField(todo.detail),
    };
  }
  if (domain === "milestone" || item.kind === "milestone") {
    const ms = world.timeline.find((t) => t.id === id);
    if (!ms) return { id, domain: "milestone" };
    return {
      id,
      domain: "milestone",
      title: ms.label,
      startAt: asField(ms.startAt),
      endAt: asField(ms.endAt),
      notes: asField(ms.notes),
    };
  }
  if (
    domain === "person" ||
    domain === "availability" ||
    domain === "responsibility" ||
    item.kind === "stakeholder" ||
    item.kind === "availability"
  ) {
    for (const project of world.projects) {
      const person = project.stakeholders.find((s) => s.id === id);
      if (person) {
        const projectId = item.projectId?.trim() || project.id;
        const scope = item.responsibilityScope?.trim() || "";
        const owners = scope
          ? currentOwners(world, projectId, scope)
              .map((o) => o.personId)
              .filter((pid): pid is string => Boolean(pid))
              .sort()
              .join(",")
          : "";
        return {
          id,
          domain: domain === "unsupported" ? "person" : domain,
          name: person.name,
          replacePersonId: asField(item.replacePersonId),
          ownerIds: owners,
          scope,
          availabilityKey: availabilityKeyFor(world, projectId, id),
        };
      }
    }
    return { id, domain: domain === "unsupported" ? "person" : domain };
  }

  return { id, domain };
}

export function staleExpectedTargetReason(
  world: CaptureApplyWorld,
  expected: CaptureExpectedTarget | null | undefined,
  projectId: string,
): string | null {
  if (!expected?.id) return null;

  if (expected.domain === "risk") {
    const risk = world.risks.find((r) => r.id === expected.id);
    if (!risk) return "That Risk is no longer on this project.";
    if (risk.projectId !== projectId) {
      return "That Risk does not belong to this project.";
    }
    if (expected.title && risk.title !== expected.title) {
      return "That Risk changed since Review. Capture again before applying.";
    }
    if (expected.status && risk.status !== expected.status) {
      return "That Risk changed since Review. Capture again before applying.";
    }
    return null;
  }

  if (expected.domain === "todo") {
    const todo = world.todos.find((t) => t.id === expected.id);
    if (!todo) return "That To Do is no longer on this project.";
    if (todo.projectId && todo.projectId !== projectId) {
      return "That To Do does not belong to this project.";
    }
    if (expected.title && todo.title !== expected.title) {
      return "That To Do changed since Review. Capture again before applying.";
    }
    if (expected.done != null && Boolean(todo.done) !== expected.done) {
      return "That To Do changed since Review. Capture again before applying.";
    }
    if (changed(expected.dueAt, todo.dueAt) || changed(expected.detail, todo.detail)) {
      return "That To Do changed since Review. Capture again before applying.";
    }
    return null;
  }

  if (expected.domain === "milestone") {
    const ms = world.timeline.find((t) => t.id === expected.id);
    if (!ms) return "That date is no longer on this project.";
    if (ms.projectId !== projectId) {
      return "That date does not belong to this project.";
    }
    if (expected.title && ms.label !== expected.title) {
      return "That date changed since Review. Capture again before applying.";
    }
    if (expected.startAt && (ms.startAt ?? "") !== expected.startAt) {
      return "That date changed since Review. Capture again before applying.";
    }
    if (changed(expected.endAt, ms.endAt) || changed(expected.notes, ms.notes)) {
      return "That date changed since Review. Capture again before applying.";
    }
    return null;
  }

  if (
    expected.domain === "person" ||
    expected.domain === "availability" ||
    expected.domain === "responsibility"
  ) {
    const project = world.projects.find((p) => p.id === projectId);
    const person = project?.stakeholders.find((s) => s.id === expected.id);
    if (!person) return "That person is no longer on this project.";
    if (expected.name && person.name !== expected.name) {
      return "That person changed since Review. Capture again before applying.";
    }
    if (expected.domain === "responsibility") {
      const owners = currentOwners(world, projectId, expected.scope ?? "");
      if (
        expected.replacePersonId &&
        !owners.some((o) => o.personId === expected.replacePersonId)
      ) {
        return "That ownership target changed since Review. Capture again before applying.";
      }
      const ownerIds = owners
        .map((o) => o.personId)
        .filter((pid): pid is string => Boolean(pid))
        .sort()
        .join(",");
      if (changed(expected.ownerIds, ownerIds)) {
        return "That ownership target changed since Review. Capture again before applying.";
      }
    }
    if (expected.domain === "availability") {
      const key = availabilityKeyFor(world, projectId, expected.id);
      if (changed(expected.availabilityKey, key)) {
        return "That availability changed since Review. Capture again before applying.";
      }
    }
    return null;
  }

  return null;
}

function availabilityKeyFor(
  world: CaptureApplyWorld,
  projectId: string,
  personId: string,
): string {
  const knowledge = world.knowledge.find((k) => k.projectId === projectId);
  return (knowledge?.structured ?? [])
    .filter(
      (row) =>
        row.kind === "availability" &&
        row.lifecycle === "current" &&
        (row.meta?.availability?.personId === personId ||
          row.meta?.personId === personId),
    )
    .map((row) => {
      const meta = row.meta?.availability;
      return `${asField(meta?.awayFromIso)}..${asField(meta?.awayToIso)}`;
    })
    .sort()
    .join("|");
}
