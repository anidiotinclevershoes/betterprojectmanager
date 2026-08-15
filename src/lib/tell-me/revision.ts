/**
 * Deterministic project revision for Tell Me freshness.
 * Changes when meaningful project intelligence changes — not wall-clock alone.
 */
import type { MissionState } from "@/lib/types";

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function computeProjectRevision(
  state: Pick<
    MissionState,
    | "projects"
    | "todos"
    | "knowledge"
    | "timeline"
    | "recommendations"
  | "history"
  | "meetings"
  | "releases"
  >,
  projectId: string,
): string {
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  const todos = state.todos.filter((t) => t.projectId === projectId);
  const timeline = state.timeline.filter((t) => t.projectId === projectId);
  const recs = state.recommendations.filter((r) => r.projectId === projectId);
  const history = (state.history ?? []).filter((h) => h.projectId === projectId);
  const meetings = state.meetings.filter((m) => m.projectId === projectId);
  const releases = state.releases.filter((r) => r.projectId === projectId);

  const parts = [
    project
      ? `${project.id}|${project.name}|${project.status}|${project.summary}|${project.currentFocus ?? ""}|${project.mergeDate ?? ""}|${project.releaseDate ?? ""}`
      : "",
    knowledge
      ? [
          ...knowledge.sections.now,
          ...knowledge.sections.decisions,
          ...knowledge.sections.risks,
          ...knowledge.sections.people,
          ...knowledge.sections.openLoops,
        ].join("¶")
      : "",
    todos
      .map(
        (t) =>
          `${t.id}|${t.title}|${t.done ? "done" : "open"}|${t.dueAt ?? ""}|${t.waitingOn ?? ""}|${t.kind ?? ""}`,
      )
      .sort()
      .join("¶"),
    timeline
      .map((t) => `${t.id}|${t.label}|${t.startAt}|${t.type}`)
      .sort()
      .join("¶"),
    recs
      .filter((r) => r.status === "active" && r.kind === "risk")
      .map((r) => `${r.id}|${r.title}|${r.status}`)
      .sort()
      .join("¶"),
    history
      .slice(0, 40)
      .map((h) => `${h.id}|${h.type}|${h.title}|${h.createdAt}`)
      .join("¶"),
    meetings
      .map((m) => `${m.id}|${m.title}|${m.startsAt}`)
      .sort()
      .join("¶"),
    releases
      .map((r) => `${r.id}|${r.name}|${r.targetDate}`)
      .sort()
      .join("¶"),
  ];

  return stableHash(parts.join("∷"));
}

/** Approximate meaningful change count between two revision payloads when available. */
export function estimateMeaningfulChangeCount(
  state: MissionState,
  projectId: string,
  sinceIso: string | null | undefined,
): number {
  if (!sinceIso) return 0;
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return 0;
  let count = 0;
  for (const h of state.history ?? []) {
    if (h.projectId !== projectId) continue;
    if (Date.parse(h.createdAt) > since) count += 1;
  }
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  if (knowledge?.updatedAt && Date.parse(knowledge.updatedAt) > since) {
    count += 1;
  }
  return count;
}
