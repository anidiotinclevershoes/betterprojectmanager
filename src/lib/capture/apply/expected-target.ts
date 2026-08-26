/**
 * Narrow stale-Apply protection: expected target fingerprint.
 * No schema version column. Compare durable identity + material fields.
 */
import type { CaptureApplyWorld, CaptureLegalDomain } from "./types";
import type { PendingSuggestion } from "@/lib/capture/suggestions";

export type CaptureExpectedTarget = {
  id: string;
  domain: CaptureLegalDomain;
  title?: string;
  status?: string;
  startAt?: string;
  name?: string;
  done?: boolean;
};

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
    name: typeof o.name === "string" ? o.name : undefined,
    done: typeof o.done === "boolean" ? o.done : undefined,
  };
}

export function fingerprintExpectedTarget(
  world: CaptureApplyWorld,
  item: PendingSuggestion,
): CaptureExpectedTarget | null {
  const id = item.targetEntityId?.trim();
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
    };
  }
  if (domain === "milestone" || item.kind === "milestone") {
    const ms = world.timeline.find((t) => t.id === id);
    if (!ms) return { id, domain: "milestone" };
    return {
      id,
      domain: "milestone",
      title: ms.label,
      startAt: ms.startAt,
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
        return {
          id,
          domain: domain === "unsupported" ? "person" : domain,
          name: person.name,
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
    return null;
  }

  return null;
}
