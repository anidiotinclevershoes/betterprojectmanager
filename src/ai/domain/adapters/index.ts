import type { AIRecord } from "../types";
import { mapMeetingStatus, mapProjectStatus, mapTodoStatus } from "../statuses";
import type {
  HistoryEvent,
  Meeting,
  Project,
  ProjectKnowledge,
  Recommendation,
  Release,
  Stakeholder,
  TimelineItem,
  TodoItem,
} from "@/lib/types";
import type { NudgeItem } from "@/lib/workspace/frames-data";
import type { CaptureContextRecord } from "@/lib/capture/context";

export type ProjectStateLike = {
  projects?: Project[];
  todos?: TodoItem[];
  meetings?: Meeting[];
  timeline?: TimelineItem[];
  knowledge?: ProjectKnowledge[];
  recommendations?: Recommendation[];
  history?: HistoryEvent[];
  releases?: Release[];
  nudges?: NudgeItem[];
};

export function adaptTodo(todo: TodoItem): AIRecord {
  const ownerMatch = todo.detail?.match(/Owner:\s*([^.\n]+)/i);
  const blocked = Boolean(todo.detail?.toLowerCase().includes("block"));
  const summaryParts = [
    todo.detail?.slice(0, 180),
    blocked ? "Blocked dependency noted" : null,
  ].filter(Boolean);
  return {
    type: "todo",
    id: todo.id,
    title: todo.title,
    summary: summaryParts.join(" · ") || undefined,
    status: mapTodoStatus(todo.done, todo.detail),
    owner: ownerMatch?.[1]?.trim(),
    date: todo.dueAt ?? null,
    updatedAt: todo.createdAt,
    projectId: todo.projectId ?? null,
  };
}

export function adaptMeeting(meeting: Meeting): AIRecord {
  return {
    type: "meeting",
    id: meeting.id,
    title: meeting.title,
    summary: meeting.attendees.slice(0, 3).join(", ") || undefined,
    status: mapMeetingStatus(meeting.phase),
    owner: meeting.attendees[0],
    date: meeting.startsAt,
    projectId: meeting.projectId,
  };
}

export function adaptMilestone(item: TimelineItem): AIRecord {
  return {
    type: "milestone",
    id: item.id,
    title: item.label,
    summary: item.notes?.slice(0, 160) || `Timeline ${item.type}`,
    status: item.type.toUpperCase(),
    date: item.startAt,
    projectId: item.projectId,
  };
}

export function adaptStakeholder(
  stakeholder: Stakeholder,
  projectId?: string,
): AIRecord {
  return {
    type: "stakeholder",
    id: stakeholder.id,
    title: stakeholder.name,
    summary:
      [stakeholder.role, ...(stakeholder.concerns ?? []).slice(0, 2)]
        .filter(Boolean)
        .join(" · ") || undefined,
    status: "OPEN",
    date: stakeholder.lastContactAt ?? null,
    projectId: projectId ?? null,
  };
}

export function adaptProject(project: Project): AIRecord {
  return {
    type: "project",
    id: project.id,
    title: `${project.code} — ${project.name}`,
    summary: project.currentFocus || project.summary,
    status: mapProjectStatus(project.status),
    date: project.releaseDate ?? project.mergeDate ?? null,
    projectId: project.id,
  };
}

export function adaptRiskFromBullet(
  bullet: string,
  projectId: string,
  index: number,
  updatedAt?: string,
): AIRecord {
  return {
    type: "risk",
    id: `risk-${projectId}-${index}`,
    title: bullet.slice(0, 120),
    summary: bullet,
    status: "OPEN",
    updatedAt,
    projectId,
  };
}

export function adaptRiskFromRecommendation(rec: Recommendation): AIRecord {
  return {
    type: "risk",
    id: rec.id,
    title: rec.title,
    summary: rec.action,
    status: rec.status === "done" ? "COMPLETED" : rec.status === "dismissed" ? "ARCHIVED" : "OPEN",
    date: rec.createdAt,
    updatedAt: rec.createdAt,
    projectId: rec.projectId,
  };
}

/** Prefer recommendation when present; otherwise knowledge-bullet risk. */
export function adaptRisk(
  source: Recommendation | { bullet: string; projectId: string; index: number; updatedAt?: string },
): AIRecord {
  if ("title" in source && "action" in source) {
    return adaptRiskFromRecommendation(source);
  }
  return adaptRiskFromBullet(
    source.bullet,
    source.projectId,
    source.index,
    source.updatedAt,
  );
}

export function adaptKnowledgeBullet(
  projectId: string,
  section: string,
  bullet: string,
  index: number,
  updatedAt?: string,
): AIRecord {
  return {
    type: "knowledge",
    id: `know-${projectId}-${section}-${index}`,
    title: bullet.slice(0, 120),
    summary: `[${section}] ${bullet}`,
    status: "OPEN",
    updatedAt,
    projectId,
  };
}

export function adaptKnowledge(knowledge: ProjectKnowledge): AIRecord[] {
  const rows: AIRecord[] = [];
  for (const [section, bullets] of Object.entries(knowledge.sections)) {
    for (const [i, bullet] of (bullets ?? []).entries()) {
      rows.push(
        adaptKnowledgeBullet(
          knowledge.projectId,
          section,
          bullet,
          i,
          knowledge.updatedAt,
        ),
      );
    }
  }
  return rows;
}

export function adaptNudge(nudge: NudgeItem): AIRecord {
  return {
    type: "nudge",
    id: nudge.id,
    title: `${nudge.person} — ${nudge.item}`,
    summary: nudge.suggestedMessage?.slice(0, 160),
    status: "OPEN",
    owner: nudge.person,
    date: nudge.requestedAt ?? null,
    projectId: nudge.projectId ?? null,
  };
}

export function adaptHistory(event: HistoryEvent): AIRecord {
  return {
    type: "history",
    id: event.id,
    title: event.title,
    summary: event.detail?.slice(0, 160),
    status: "COMPLETED",
    date: event.createdAt,
    updatedAt: event.createdAt,
    projectId: event.projectId ?? null,
  };
}

export function adaptRelease(release: Release): AIRecord {
  return {
    type: "release",
    id: release.id,
    title: release.name,
    summary: release.risks.slice(0, 2).join("; ") || undefined,
    status: release.currentStage.toUpperCase(),
    date: release.targetDate,
    projectId: release.projectId,
  };
}

/** Convert Capture context records into AIRecords for prompt sections. */
export function adaptCaptureContextRecord(
  record: CaptureContextRecord,
  projectId?: string | null,
): AIRecord {
  return {
    type: inferEntityType(record.type),
    id: record.id,
    title: record.title,
    summary: record.summary,
    status: record.status,
    date: record.date ?? null,
    updatedAt: record.updatedAt,
    projectId: projectId ?? null,
  };
}

function inferEntityType(type: string): AIRecord["type"] {
  const t = type.toLowerCase();
  if (t.startsWith("todo")) return "todo";
  if (t.startsWith("timeline") || t.includes("milestone")) return "milestone";
  if (t.startsWith("knowledge")) return "knowledge";
  if (t.startsWith("history")) return "history";
  if (t === "nudge") return "nudge";
  if (t === "meeting") return "meeting";
  if (t === "risk") return "risk";
  if (t === "stakeholder") return "stakeholder";
  if (t === "release") return "release";
  if (t === "project") return "project";
  return "knowledge";
}

export function isValidAIRecord(record: AIRecord): boolean {
  return Boolean(
    record.type &&
      record.id &&
      record.title &&
      typeof record.title === "string",
  );
}

/** Compact lines for prompt context (reasoning-only fields). */
export function formatAIRecordsForPrompt(records: AIRecord[]): string {
  if (!records.length) return "(No AI records.)";
  return records
    .filter(isValidAIRecord)
    .map((r) => {
      const bits = [
        `${r.type}:${r.id}`,
        r.title,
        r.status ? `status=${r.status}` : null,
        r.owner ? `owner=${r.owner}` : null,
        r.date ? `date=${r.date}` : null,
        r.summary ? `summary=${r.summary}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");
}

/** Convert a slice of mission state into normalised AIRecords. */
export function projectStateToAIRecords(state: ProjectStateLike): AIRecord[] {
  const out: AIRecord[] = [];
  for (const p of state.projects ?? []) out.push(adaptProject(p));
  for (const t of state.todos ?? []) out.push(adaptTodo(t));
  for (const m of state.meetings ?? []) out.push(adaptMeeting(m));
  for (const item of state.timeline ?? []) {
    if (item.type === "milestone" || item.type === "deadline") {
      out.push(adaptMilestone(item));
    }
  }
  for (const k of state.knowledge ?? []) out.push(...adaptKnowledge(k));
  for (const rec of state.recommendations ?? []) {
    if (rec.kind === "risk" && rec.status === "active") {
      out.push(adaptRisk(rec));
    }
  }
  for (const h of state.history ?? []) out.push(adaptHistory(h));
  for (const r of state.releases ?? []) out.push(adaptRelease(r));
  for (const n of state.nudges ?? []) out.push(adaptNudge(n));
  for (const p of state.projects ?? []) {
    for (const s of p.stakeholders ?? []) {
      out.push(adaptStakeholder(s, p.id));
    }
  }
  return out.filter(isValidAIRecord);
}
