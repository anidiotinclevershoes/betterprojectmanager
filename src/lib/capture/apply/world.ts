import type { MissionState } from "@/lib/types";
import type { CaptureApplyWorld } from "./types";

export function captureApplyWorldFromState(state: MissionState): CaptureApplyWorld {
  const projects = state.projects ?? [];
  return {
    projectIds: new Set(projects.map((p) => p.id)),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      stakeholders: (p.stakeholders ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
      })),
    })),
    risks: (state.risks ?? []).map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      status: r.status,
    })),
    todos: (state.todos ?? []).map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      done: t.done,
    })),
    timeline: (state.timeline ?? []).map((t) => ({
      id: t.id,
      projectId: t.projectId,
      label: t.label,
      startAt: t.startAt,
      notes: t.notes,
    })),
    knowledge: (state.knowledge ?? []).map((k) => ({
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
        meta: row.meta
          ? {
              personId:
                typeof (row.meta as { personId?: string }).personId === "string"
                  ? (row.meta as { personId?: string }).personId
                  : undefined,
              responsibility: row.meta.responsibility ?? null,
              availability: row.meta.availability ?? null,
            }
          : null,
      })),
    })),
  };
}
