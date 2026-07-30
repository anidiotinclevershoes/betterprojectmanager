/**
 * Phase 1 — Capture project context assembly.
 * Pure, serialisable context for Capture AI. Does not mutate source records.
 */

import { buildNudgeItems } from "@/lib/workspace/frames-data";
import type {
  MissionState,
  Project,
  ProjectKnowledge,
  TimelineItem,
  TodoItem,
} from "@/lib/types";

export type CaptureContextLimits = {
  openTodos: number;
  recentCompletedTodos: number;
  nudges: number;
  meetings: number;
  milestones: number;
  risks: number;
  stakeholders: number;
  knowledgeItems: number;
  historyEvents: number;
  releases: number;
};

export const DEFAULT_CAPTURE_CONTEXT_LIMITS: CaptureContextLimits = {
  openTodos: 20,
  recentCompletedTodos: 8,
  nudges: 8,
  meetings: 8,
  milestones: 10,
  risks: 8,
  stakeholders: 12,
  knowledgeItems: 16,
  historyEvents: 10,
  releases: 3,
};

export type CaptureContextRecord = {
  id: string;
  type: string;
  title: string;
  status?: string;
  date?: string | null;
  summary?: string;
  updatedAt?: string;
};

export type CaptureProjectContext = {
  project: {
    id: string;
    name: string;
    code: string;
    status?: string;
    summary?: string;
    currentFocus?: string;
    mergeDate?: string | null;
    releaseDate?: string | null;
  } | null;
  todos: CaptureContextRecord[];
  completedTodos: CaptureContextRecord[];
  nudges: CaptureContextRecord[];
  meetings: CaptureContextRecord[];
  milestones: CaptureContextRecord[];
  risks: CaptureContextRecord[];
  stakeholders: CaptureContextRecord[];
  knowledge: CaptureContextRecord[];
  history: CaptureContextRecord[];
  releases: CaptureContextRecord[];
  /** Development diagnostic — approximate serialised size. */
  diagnostics: {
    recordCount: number;
    approxChars: number;
    projectScoped: boolean;
  };
};

export type CaptureContextState = Pick<
  MissionState,
  | "projects"
  | "todos"
  | "meetings"
  | "releases"
  | "knowledge"
  | "timeline"
  | "recommendations"
  | "history"
>;

function tokensFrom(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function scoreText(haystack: string, needles: Set<string>): number {
  if (!needles.size) return 0;
  const hay = tokensFrom(haystack);
  let score = 0;
  for (const n of needles) {
    if (hay.has(n)) score += 1;
  }
  return score;
}

function rec(
  partial: CaptureContextRecord,
): CaptureContextRecord {
  return {
    id: partial.id,
    type: partial.type,
    title: partial.title,
    status: partial.status,
    date: partial.date ?? null,
    summary: partial.summary,
    updatedAt: partial.updatedAt,
  };
}

function takeRanked<T>(
  items: T[],
  limit: number,
  rank: (item: T) => number,
): T[] {
  return [...items]
    .map((item, index) => ({ item, index, score: rank(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((x) => x.item);
}

function knowledgeBullets(
  knowledge: ProjectKnowledge | undefined,
  limits: CaptureContextLimits,
  keywords: Set<string>,
): CaptureContextRecord[] {
  if (!knowledge) return [];
  const rows: CaptureContextRecord[] = [];
  for (const [section, bullets] of Object.entries(knowledge.sections)) {
    for (const [i, bullet] of (bullets ?? []).entries()) {
      rows.push(
        rec({
          id: `know-${knowledge.projectId}-${section}-${i}`,
          type: `knowledge:${section}`,
          title: bullet.slice(0, 120),
          summary: bullet,
          updatedAt: knowledge.updatedAt,
        }),
      );
    }
  }
  return takeRanked(rows, limits.knowledgeItems, (r) =>
    scoreText(`${r.title} ${r.summary ?? ""}`, keywords),
  );
}

function emptyContext(projectScoped: boolean): CaptureProjectContext {
  const base: CaptureProjectContext = {
    project: null,
    todos: [],
    completedTodos: [],
    nudges: [],
    meetings: [],
    milestones: [],
    risks: [],
    stakeholders: [],
    knowledge: [],
    history: [],
    releases: [],
    diagnostics: { recordCount: 0, approxChars: 0, projectScoped },
  };
  base.diagnostics.approxChars = JSON.stringify(stripDiagnostics(base)).length;
  return base;
}

function stripDiagnostics(ctx: CaptureProjectContext) {
  return {
    project: ctx.project,
    todos: ctx.todos,
    completedTodos: ctx.completedTodos,
    nudges: ctx.nudges,
    meetings: ctx.meetings,
    milestones: ctx.milestones,
    risks: ctx.risks,
    stakeholders: ctx.stakeholders,
    knowledge: ctx.knowledge,
    history: ctx.history,
    releases: ctx.releases,
  };
}

function countRecords(ctx: CaptureProjectContext) {
  return (
    ctx.todos.length +
    ctx.completedTodos.length +
    ctx.nudges.length +
    ctx.meetings.length +
    ctx.milestones.length +
    ctx.risks.length +
    ctx.stakeholders.length +
    ctx.knowledge.length +
    ctx.history.length +
    ctx.releases.length
  );
}

/**
 * Build a capped, project-scoped context for Capture analysis.
 * Pure — never mutates `state` or nested records.
 */
export function buildCaptureContext(args: {
  projectId?: string | null;
  captureText: string;
  state: CaptureContextState;
  limits?: Partial<CaptureContextLimits>;
}): CaptureProjectContext {
  const limits: CaptureContextLimits = {
    ...DEFAULT_CAPTURE_CONTEXT_LIMITS,
    ...args.limits,
  };
  const projectId = args.projectId || null;
  const keywords = tokensFrom(args.captureText);

  if (!projectId) {
    return emptyContext(false);
  }

  const project = args.state.projects.find((p) => p.id === projectId);
  if (!project) {
    return emptyContext(true);
  }

  // Snapshot arrays so callers cannot observe mutation through returned context.
  const todos = [...(args.state.todos ?? [])];
  const meetings = [...(args.state.meetings ?? [])];
  const timeline = [...(args.state.timeline ?? [])];
  const releases = [...(args.state.releases ?? [])];
  const history = [...(args.state.history ?? [])];
  const knowledgeList = [...(args.state.knowledge ?? [])];

  const projectTodos = todos.filter((t) => t.projectId === projectId);
  const openTodos = takeRanked(
    projectTodos.filter((t) => !t.done),
    limits.openTodos,
    (t) =>
      scoreText(`${t.title} ${t.detail ?? ""}`, keywords) * 3 +
      (t.dueAt ? 1 : 0),
  ).map((t) => todoRecord(t, "todo"));

  const completedTodos = takeRanked(
    projectTodos.filter((t) => t.done),
    limits.recentCompletedTodos,
    (t) =>
      scoreText(`${t.title} ${t.detail ?? ""}`, keywords) * 2 +
      Date.parse(t.createdAt || "") / 1e13,
  ).map((t) => todoRecord(t, "todo_completed"));

  const nudges = takeRanked(
    buildNudgeItems(
      {
        projects: [project],
        recommendations: [...(args.state.recommendations ?? [])],
        todos: projectTodos,
        meetings: [],
        memories: [],
        releases: [],
        knowledge: [],
        timeline: [],
        history: [],
        lastAnalyzedAt: undefined,
        analysesThisMonth: 0,
      },
      projectId,
    ),
    limits.nudges,
    (n) => scoreText(`${n.person} ${n.item}`, keywords) * 3 + n.daysWaiting,
  ).map((n) =>
    rec({
      id: n.id,
      type: "nudge",
      title: `${n.person} — ${n.item}`,
      status: n.urgency,
      summary: n.suggestedMessage?.slice(0, 160),
    }),
  );

  const meetingRows = takeRanked(
    meetings.filter((m) => m.projectId === projectId),
    limits.meetings,
    (m) =>
      scoreText(`${m.title} ${m.prep.openingScript}`, keywords) * 2 +
      Date.parse(m.startsAt || "") / 1e13,
  ).map((m) =>
    rec({
      id: m.id,
      type: "meeting",
      title: m.title,
      status: m.phase,
      date: m.startsAt,
      summary: m.prep.objectives.slice(0, 2).join("; ") || undefined,
    }),
  );

  const milestones = takeRanked(
    timeline.filter(
      (t) =>
        t.projectId === projectId &&
        (t.type === "milestone" ||
          t.type === "deadline" ||
          t.type === "submission" ||
          t.type === "phase"),
    ),
    limits.milestones,
    (t) => scoreText(`${t.label} ${t.notes ?? ""}`, keywords) * 2,
  ).map((t) => timelineRecord(t));

  const knowledge = knowledgeList.find((k) => k.projectId === projectId);
  const knowledgeRows = knowledgeBullets(knowledge, limits, keywords);

  const risksFromKnowledge = (knowledge?.sections.risks ?? []).map(
    (bullet, i) =>
      rec({
        id: `risk-${projectId}-${i}`,
        type: "risk",
        title: bullet.slice(0, 120),
        summary: bullet,
        updatedAt: knowledge?.updatedAt,
      }),
  );
  const riskRecs = (args.state.recommendations ?? [])
    .filter(
      (r) =>
        r.projectId === projectId &&
        r.status === "active" &&
        r.kind === "risk",
    )
    .map((r) =>
      rec({
        id: r.id,
        type: "risk",
        title: r.title,
        status: r.urgency,
        summary: r.action,
        updatedAt: r.createdAt,
      }),
    );
  const risks = takeRanked(
    [...risksFromKnowledge, ...riskRecs],
    limits.risks,
    (r) => scoreText(`${r.title} ${r.summary ?? ""}`, keywords),
  );

  const stakeholders = takeRanked(
    [...project.stakeholders],
    limits.stakeholders,
    (s) =>
      scoreText(
        `${s.name} ${s.role} ${(s.concerns ?? []).join(" ")}`,
        keywords,
      ) * 2,
  ).map((s) =>
    rec({
      id: s.id,
      type: "stakeholder",
      title: s.name,
      status: s.role,
      date: s.lastContactAt ?? null,
      summary: (s.concerns ?? []).slice(0, 2).join("; ") || undefined,
    }),
  );

  const historyRows = takeRanked(
    history.filter((h) => h.projectId === projectId),
    limits.historyEvents,
    (h) =>
      scoreText(`${h.title} ${h.detail ?? ""}`, keywords) +
      Date.parse(h.createdAt || "") / 1e13,
  ).map((h) =>
    rec({
      id: h.id,
      type: `history:${h.type}`,
      title: h.title,
      date: h.createdAt,
      summary: h.detail?.slice(0, 160),
      updatedAt: h.createdAt,
    }),
  );

  const releaseRows = takeRanked(
    releases.filter((r) => r.projectId === projectId),
    limits.releases,
    (r) => scoreText(`${r.name} ${r.risks.join(" ")}`, keywords),
  ).map((r) =>
    rec({
      id: r.id,
      type: "release",
      title: r.name,
      status: r.currentStage,
      summary: r.risks.slice(0, 2).join("; ") || undefined,
    }),
  );

  const ctx: CaptureProjectContext = {
    project: projectMeta(project),
    todos: openTodos,
    completedTodos,
    nudges,
    meetings: meetingRows,
    milestones,
    risks,
    stakeholders,
    knowledge: knowledgeRows,
    history: historyRows,
    releases: releaseRows,
    diagnostics: { recordCount: 0, approxChars: 0, projectScoped: true },
  };
  ctx.diagnostics.recordCount = countRecords(ctx);
  ctx.diagnostics.approxChars = JSON.stringify(stripDiagnostics(ctx)).length;
  return ctx;
}

function projectMeta(project: Project): CaptureProjectContext["project"] {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status,
    summary: project.summary,
    currentFocus: project.currentFocus,
    mergeDate: project.mergeDate ?? null,
    releaseDate: project.releaseDate ?? null,
  };
}

function todoRecord(t: TodoItem, type: string): CaptureContextRecord {
  return rec({
    id: t.id,
    type,
    title: t.title,
    status: t.done ? "done" : "open",
    date: t.dueAt ?? null,
    summary: t.detail?.slice(0, 160),
    updatedAt: t.createdAt,
  });
}

function timelineRecord(t: TimelineItem): CaptureContextRecord {
  return rec({
    id: t.id,
    type: `timeline:${t.type}`,
    title: t.label,
    date: t.startAt,
    summary: t.notes?.slice(0, 160),
  });
}

/** Prompt-safe payload (no diagnostics). */
export function serializeCaptureContextForPrompt(
  ctx: CaptureProjectContext,
): string {
  return JSON.stringify(stripDiagnostics(ctx), null, 2);
}

export function estimateCaptureContextSize(ctx: CaptureProjectContext) {
  return {
    recordCount: ctx.diagnostics.recordCount,
    approxChars: ctx.diagnostics.approxChars,
  };
}
