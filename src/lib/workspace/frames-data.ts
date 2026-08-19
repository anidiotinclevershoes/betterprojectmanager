import {
  daysUntil,
  formatWhen,
  silentStakeholders,
  upcomingMeetings,
} from "@/lib/selectors";
import type { Meeting, MissionState, TodoItem } from "@/lib/types";

export type PrepConfidence = "ready" | "nearly" | "needs_prep";

export type MeetingPrepItem = {
  meeting: Meeting;
  projectCode: string;
  projectId: string;
  confidence: PrepConfidence;
  talkingPoints: number;
  questions: number;
  missing: string[];
  whenLabel: string;
};

export type NudgeItem = {
  id: string;
  person: string;
  item: string;
  projectId?: string;
  projectCode?: string;
  requestedAt?: string;
  daysWaiting: number;
  urgency: "now" | "soon" | "watch";
  source: "stakeholder" | "recommendation" | "todo";
  suggestedMessage?: string;
};

export function buildMeetingPrepItems(
  state: MissionState,
  projectId?: string,
): MeetingPrepItem[] {
  return upcomingMeetings(state, projectId).map((meeting) => {
    const project = state.projects.find((p) => p.id === meeting.projectId);
    const talkingPoints = meeting.prep.talkingPoints.length;
    const questions =
      meeting.prep.questionsToAsk.length +
      meeting.prep.stakeholderConcerns.length;
    const missing: string[] = [];
    if (!meeting.prep.openingScript.trim()) missing.push("Opening script");
    if (!meeting.prep.decisionsToObtain.length) missing.push("Decisions required");
    if (meeting.prep.risksToDiscuss.length === 0) {
      /* ok */
    } else if (
      !(state.knowledge ?? []).find((k) => k.projectId === meeting.projectId)
        ?.sections.risks.length
    ) {
      missing.push("Risk evidence");
    }

    let confidence: PrepConfidence = "ready";
    if (missing.length >= 2 || talkingPoints < 2) confidence = "needs_prep";
    else if (missing.length === 1 || questions < 2) confidence = "nearly";

    return {
      meeting,
      projectCode: project?.code ?? "—",
      projectId: meeting.projectId,
      confidence,
      talkingPoints,
      questions,
      missing,
      whenLabel: formatWhen(meeting.startsAt),
    };
  });
}

export function buildNudgeItems(
  state: MissionState,
  projectId?: string,
): NudgeItem[] {
  const items: NudgeItem[] = [];
  const projects = projectId
    ? state.projects.filter((p) => p.id === projectId)
    : state.projects;

  for (const project of projects) {
    for (const person of silentStakeholders(project, 7)) {
      const days = person.lastContactAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(person.lastContactAt).getTime()) /
                86400000,
            ),
          )
        : 14;
      items.push({
        id: `silent-${person.id}`,
        person: person.name,
        item: person.concerns?.[0] ?? "Catch-up / relationship touch",
        projectId: project.id,
        projectCode: project.code,
        requestedAt: person.lastContactAt,
        daysWaiting: days,
        urgency: days >= 14 ? "now" : days >= 10 ? "soon" : "watch",
        source: "stakeholder",
        suggestedMessage: `Hi ${person.name.split(" ")[0]}, checking in on ${project.code} — anything you need from me ahead of ${project.nextMilestone ?? "our next checkpoint"}?`,
      });
    }
  }

  for (const rec of state.recommendations.filter(
    (r) =>
      r.status === "active" &&
      (r.kind === "stakeholder_update" ||
        r.kind === "dependency" ||
        r.kind === "conversation") &&
      (!projectId || r.projectId === projectId),
  )) {
    const project = state.projects.find((p) => p.id === rec.projectId);
    items.push({
      id: `rec-${rec.id}`,
      person: project?.code ?? "Follow-up",
      item: rec.title,
      projectId: rec.projectId,
      projectCode: project?.code,
      daysWaiting: 0,
      urgency: rec.urgency === "now" ? "now" : rec.urgency === "today" ? "soon" : "watch",
      source: "recommendation",
      suggestedMessage: rec.suggestedScript,
    });
  }

  return items
    .sort((a, b) => {
      const u = { now: 0, soon: 1, watch: 2 };
      return u[a.urgency] - u[b.urgency] || b.daysWaiting - a.daysWaiting;
    })
    .slice(0, 12);
}

export function todoOriginLabel(todo: TodoItem): string {
  if (todo.sourceRecommendationId) return "Coach";
  return "Manual";
}

export function relativeDue(todo: TodoItem) {
  const d = daysUntil(todo.dueAt);
  if (d === null) return null;
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d}d`;
}
