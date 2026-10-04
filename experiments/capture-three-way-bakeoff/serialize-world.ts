import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { SerializedWorld } from "./types";

export function serializeWorld(world: CaptureApplyWorld): SerializedWorld {
  return {
    projectIds: [...world.projectIds],
    projects: world.projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      stakeholders: p.stakeholders.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
      })),
    })),
    risks: world.risks.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      status: r.status,
    })),
    todos: world.todos.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      done: t.done,
      dueAt: t.dueAt,
      detail: t.detail,
    })),
    timeline: world.timeline.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      label: t.label,
      startAt: t.startAt,
      endAt: t.endAt,
      notes: t.notes,
    })),
    knowledge: world.knowledge.map((k) => ({
      projectId: k.projectId,
      sections: {
        people: k.sections.people,
        risks: k.sections.risks,
      },
      structured: (k.structured ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        lifecycle: row.lifecycle,
        body: row.body,
        meta: row.meta ?? null,
      })),
    })),
  };
}

export function cloneWorld(world: CaptureApplyWorld): CaptureApplyWorld {
  const json = serializeWorld(world);
  return {
    ...json,
    projectIds: new Set(json.projectIds),
  };
}
