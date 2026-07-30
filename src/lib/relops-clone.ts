import type {
  Meeting,
  MissionState,
  Project,
  ProjectKnowledge,
  Recommendation,
  TimelineItem,
  TodoItem,
} from "./types";
import { emptyKnowledge } from "./knowledge";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function daysBetween(a: string, b: string) {
  return (
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

function shiftIso(iso: string, deltaDays: number) {
  return new Date(new Date(iso).getTime() + deltaDays * 86400000).toISOString();
}

function toIsoDate(dateOnly: string) {
  return new Date(`${dateOnly}T09:00:00`).toISOString();
}

function codeFromMonth(monthName: string) {
  const cleaned = monthName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return cleaned ? `REL-${cleaned}` : `REL-${Date.now().toString().slice(-4)}`;
}

export type CloneRelOpsInput = {
  monthName: string;
  /** yyyy-mm-dd */
  mergeDate: string;
  /** yyyy-mm-dd */
  releaseDate: string;
  templateProjectId?: string;
};

/**
 * Clone a release_ops project for a new month.
 * Shifts meetings/timeline/todos into the merge→release window.
 */
export function cloneRelOpsProject(
  state: MissionState,
  input: CloneRelOpsInput,
): MissionState {
  const template =
    state.projects.find((p) => p.id === input.templateProjectId) ??
    state.projects.find((p) => p.kind === "release_ops" && p.isTemplate) ??
    state.projects.find((p) => p.kind === "release_ops");

  if (!template) {
    throw new Error("No RELOPS template project found to clone.");
  }

  const mergeAt = toIsoDate(input.mergeDate);
  const releaseAt = toIsoDate(input.releaseDate);
  // Safety net: release must be on or after merge (UI validates first).
  if (new Date(releaseAt) < new Date(mergeAt)) {
    throw new Error("Release date must be on or after the merge date.");
  }

  const oldMerge = template.mergeDate ?? findEarliestTimeline(state, template.id);
  const oldRelease =
    template.releaseDate ?? findLatestTimeline(state, template.id);
  const oldSpan = Math.max(daysBetween(oldMerge, oldRelease), 1);
  const newSpan = Math.max(daysBetween(mergeAt, releaseAt), 1);

  const mapDay = (iso: string) => {
    const offset = daysBetween(oldMerge, iso);
    const ratio = offset / oldSpan;
    return shiftIso(mergeAt, ratio * newSpan);
  };

  const month = input.monthName.trim();
  const newProjectId = id("proj");
  const newProject: Project = {
    ...template,
    id: newProjectId,
    name: `${month} Release Operations`,
    code: codeFromMonth(month),
    kind: "release_ops",
    isTemplate: false,
    clonedFromId: template.id,
    releaseMonth: month,
    mergeDate: mergeAt,
    releaseDate: releaseAt,
    status: "watch",
    currentFocus: `${month} release train — CAB pack completeness and evidence chase`,
    nextMilestone: "CAB board submission",
    nextMilestoneAt: shiftIso(releaseAt, -3),
    summary: `Monthly release train for ${month}: collect evidence, chase artefacts, run process forums, submit CAB pack.`,
  };

  const meetings: Meeting[] = state.meetings
    .filter((m) => m.projectId === template.id)
    .map((m) => ({
      ...m,
      id: id("mtg"),
      projectId: newProjectId,
      startsAt: mapDay(m.startsAt),
      phase: "upcoming" as const,
      title: m.title.replace(/March|monthly|this month/gi, month),
    }));

  const templateTodos = (state.todos ?? []).filter(
    (t) => t.projectId === template.id,
  );
  const todos: TodoItem[] = templateTodos.map((t, index) => {
    const dueOffset =
      ((index + 1) / (templateTodos.length + 1)) * newSpan;
    return {
      ...t,
      id: id("todo"),
      projectId: newProjectId,
      done: false,
      createdAt: new Date().toISOString(),
      dueAt: shiftIso(mergeAt, dueOffset),
      sourceRecommendationId: undefined,
      title: t.title.replace(/March|monthly|this month/gi, month),
    };
  });

  const timeline: TimelineItem[] = (state.timeline ?? [])
    .filter((t) => t.projectId === template.id)
    .map((t) => ({
      ...t,
      id: id("tl"),
      projectId: newProjectId,
      startAt: mapDay(t.startAt),
      endAt: t.endAt ? mapDay(t.endAt) : undefined,
      source: "manual" as const,
      label: t.label.replace(/March|monthly/gi, month),
    }));

  // Ensure merge + release anchors exist
  const hasMerge = timeline.some((t) =>
    /merge|freeze/i.test(t.label),
  );
  const hasRelease = timeline.some((t) =>
    /go-live|production/i.test(t.label),
  );
  if (!hasMerge) {
    timeline.push({
      id: id("tl"),
      projectId: newProjectId,
      label: "Merge freeze",
      type: "phase",
      startAt: mergeAt,
      endAt: shiftIso(mergeAt, 1),
      source: "manual",
    });
  }
  if (!hasRelease) {
    timeline.push({
      id: id("tl"),
      projectId: newProjectId,
      label: "Production go-live",
      type: "deadline",
      startAt: releaseAt,
      source: "manual",
    });
  }

  const templateKnowledge = (state.knowledge ?? []).find(
    (k) => k.projectId === template.id,
  );
  const knowledge: ProjectKnowledge = templateKnowledge
    ? {
        projectId: newProjectId,
        updatedAt: new Date().toISOString(),
        sections: {
          now: [
            `${month} release train opened. Merge ${input.mergeDate}, release ${input.releaseDate}.`,
            ...templateKnowledge.sections.now.slice(0, 2),
          ].slice(0, 8),
          decisions: templateKnowledge.sections.decisions.slice(0, 4),
          risks: [],
          people: templateKnowledge.sections.people.slice(0, 4),
          openLoops: [
            "Confirm evidence tracker owners for this month",
            "Confirm CAB pack submission date 24h before board",
          ],
        },
      }
    : {
        ...emptyKnowledge(newProjectId),
        sections: {
          now: [
            `${month} release train opened. Merge ${input.mergeDate}, release ${input.releaseDate}.`,
          ],
          decisions: [
            "CAB pack must be complete 24h before board — no verbal-only risks",
          ],
          risks: [],
          people: [],
          openLoops: ["Confirm evidence tracker owners for this month"],
        },
      };

  const projects = state.projects.map((p) =>
    p.id === template.id ? { ...p, isTemplate: true } : p,
  );

  return {
    ...state,
    projects: [...projects, newProject],
    meetings: [...state.meetings, ...meetings],
    todos: [...todos, ...(state.todos ?? [])],
    timeline: [...(state.timeline ?? []), ...timeline],
    knowledge: [...(state.knowledge ?? []), knowledge],
    lastAnalyzedAt: new Date().toISOString(),
  };
}

function findEarliestTimeline(state: MissionState, projectId: string) {
  const items = (state.timeline ?? []).filter((t) => t.projectId === projectId);
  if (!items.length) return new Date().toISOString();
  return items
    .map((t) => t.startAt)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]!;
}

function findLatestTimeline(state: MissionState, projectId: string) {
  const items = (state.timeline ?? []).filter((t) => t.projectId === projectId);
  if (!items.length) {
    return new Date(Date.now() + 14 * 86400000).toISOString();
  }
  return items
    .map((t) => t.endAt ?? t.startAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]!;
}

/**
 * Rebuild active suggestions for a project from knowledge + open loops + risks.
 * Used by the Suggestions "Refresh" control.
 */
export function refreshProjectSuggestions(
  state: MissionState,
  projectId: string,
): Recommendation[] {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return state.recommendations;

  const knowledge = (state.knowledge ?? []).find(
    (k) => k.projectId === projectId,
  );
  const now = new Date().toISOString();
  const fresh: Recommendation[] = [];

  const push = (
    partial: Omit<Recommendation, "id" | "createdAt" | "status" | "projectId">,
  ) => {
    fresh.push({
      ...partial,
      id: id("rec"),
      projectId,
      createdAt: now,
      status: "active",
    });
  };

  for (const risk of knowledge?.sections.risks.slice(0, 3) ?? []) {
    push({
      kind: "risk",
      urgency: "today",
      title: `Address risk: ${risk.slice(0, 60)}`,
      action: `Turn this into an owned action with a date: ${risk}`,
      why: "It is in the project knowledge as an open risk and will surprise stakeholders if left unowned.",
      leadershipImpact:
        "You look like the person who converts known risks into controlled actions.",
    });
  }

  for (const loop of knowledge?.sections.openLoops.slice(0, 3) ?? []) {
    push({
      kind: "dependency",
      urgency: "now",
      title: `Close open loop: ${loop.slice(0, 60)}`,
      action: `Chase or confirm today: ${loop}`,
      why: "Open loops in the knowledge brief become release or meeting surprises.",
      leadershipImpact:
        "You stay ahead of silent waits instead of reacting to them.",
    });
  }

  for (const decision of knowledge?.sections.decisions.slice(0, 1) ?? []) {
    push({
      kind: "stakeholder_update",
      urgency: "this_week",
      title: "Communicate the latest decision",
      action: `Share this decision with anyone affected: ${decision}`,
      why: "Decisions that stay only in the brief do not change behaviour.",
      leadershipImpact:
        "You keep stakeholders aligned without waiting to be asked.",
    });
  }

  const upcoming = state.meetings.filter(
    (m) => m.projectId === projectId && m.phase === "upcoming",
  );
  for (const meeting of upcoming.slice(0, 2)) {
    push({
      kind: "meeting_prep",
      urgency: "today",
      title: `Prepare to lead: ${meeting.title}`,
      action: `Review objectives and bring evidence for: ${meeting.prep.decisionsToObtain[0] ?? meeting.prep.objectives[0]}`,
      why: "Walking in prepared is how you lead the room instead of reacting.",
      leadershipImpact:
        "You sound like the confident person leading the project.",
      suggestedScript: meeting.prep.openingScript,
    });
  }

  if (project.kind === "release_ops") {
    push({
      kind: "release",
      urgency: "today",
      title: "Confirm CAB pack completeness before submission",
      action:
        "Walk the pack checklist: change record, evidence links, rollback, roster, residual risks — every gap owned.",
      why: "RELOPS succeeds on pack completeness. Gaps become board embarrassment.",
      leadershipImpact:
        "You look process-tight and dependable in front of CAB.",
    });
  }

  const kept = state.recommendations.filter(
    (r) => !(r.projectId === projectId && r.status === "active"),
  );
  return [...fresh, ...kept];
}

/** Clamp a due date into a project's merge→release window when available. */
export function clampDueToWindow(
  project: Project | undefined,
  dueAt: string,
): string {
  if (!project?.mergeDate || !project?.releaseDate) return dueAt;
  const due = new Date(dueAt).getTime();
  const min = new Date(project.mergeDate).getTime();
  const max = new Date(project.releaseDate).getTime();
  if (Number.isNaN(due) || Number.isNaN(min) || Number.isNaN(max)) return dueAt;
  if (due < min) return project.mergeDate;
  if (due > max) return project.releaseDate;
  return dueAt;
}
