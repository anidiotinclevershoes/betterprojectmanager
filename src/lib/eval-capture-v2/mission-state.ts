/**
 * MissionState built from the existing experimental worlds.
 * Does not invent a second truth architecture — Candyland / Toyworld /
 * GamingStudio5000 remain the only fictional projects here.
 */

import { emptyKnowledge } from "@/lib/knowledge";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "@/lib/experiments/worlds";
import type { MissionState, Project, ProjectKnowledge } from "@/lib/types";

export const MISSION_STATE_STORAGE_KEY = "mission-control-state-v5";

export function experimentalMissionState(
  world: CaptureApplyWorld = experimentalApplyWorld(),
): MissionState {
  const now = "2026-08-26T12:00:00.000Z";
  const projects: Project[] = world.projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? p.id,
    summary:
      p.id === CANDYLAND_ID
        ? "Rebuild of the Candyland parade float and licorice stands."
        : p.id === TOYWORLD_ID
          ? "Toyworld wooden-track refresh for the autumn show."
          : "GamingStudio5000 console certification sprint.",
    status: "watch",
    kind: "delivery",
    currentFocus:
      p.id === CANDYLAND_ID
        ? "Parade day readiness"
        : p.id === TOYWORLD_ID
          ? "Track freeze"
          : "Console certification",
    nextMilestone: world.timeline.find((t) => t.projectId === p.id)?.label,
    nextMilestoneAt: world.timeline.find((t) => t.projectId === p.id)?.startAt,
    stakeholders: p.stakeholders.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role ?? "",
    })),
  }));

  const knowledge: ProjectKnowledge[] = world.projects.map((p) => {
    const fromWorld = world.knowledge.find((k) => k.projectId === p.id);
    const base = emptyKnowledge(p.id);
    const people = fromWorld?.sections.people ?? p.stakeholders.map((s) => `${s.name} — ${s.role ?? ""}`.trim());
    const risks = fromWorld?.sections.risks ?? [];
    const structured: CanonicalTruthItem[] = (fromWorld?.structured ?? []).map(
      (row) => ({
        id: row.id,
        projectId: p.id,
        body: row.body,
        kind: (row.kind as CanonicalTruthItem["kind"]) || "fact",
        epistemic: "confirmed",
        lifecycle: row.lifecycle === "superseded" ? "superseded" : "current",
        meta: row.meta
          ? {
              responsibility: row.meta.responsibility
                ? {
                    personId: row.meta.responsibility.personId ?? null,
                    personName: row.meta.responsibility.personName ?? null,
                    scope: row.meta.responsibility.scope ?? row.body,
                    ownerConfirmed: row.meta.responsibility.ownerConfirmed,
                  }
                : null,
              availability: row.meta.availability ?? null,
            }
          : null,
      }),
    );
    return {
      ...base,
      updatedAt: now,
      sections: {
        ...base.sections,
        people,
        risks,
      },
      structured,
    };
  });

  return {
    projects,
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: world.todos.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      done: Boolean(t.done),
      createdAt: now,
    })),
    knowledge,
    risks: world.risks.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      status: (r.status as "open" | "watch" | "resolved" | "accepted") || "open",
      source: "seed",
      createdAt: now,
      updatedAt: now,
    })),
    timeline: world.timeline.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      label: t.label,
      type: "milestone" as const,
      startAt: t.startAt ?? now,
      notes: t.notes,
      source: "seed" as const,
    })),
    history: [],
    analysesThisMonth: 0,
    analysesMonthKey: "2026-08",
  };
}

export { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID, experimentalApplyWorld };
