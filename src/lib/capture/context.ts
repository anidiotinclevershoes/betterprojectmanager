/**
 * Phase 1 — Capture project context assembly.
 * Pure, serialisable context for Capture AI. Does not mutate source records.
 */

import { buildNudgeItems } from "@/lib/workspace/frames-data";
import {
  detectMentionedProjects,
  buildProjectIndex,
} from "@/lib/capture/projectResolve";
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

export type CaptureContextLimitHit = {
  bucket: string;
  included: number;
  available: number;
  excluded: CaptureContextRecord[];
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
  /** Lightweight catalogue of all projects — not deep records. */
  projectIndex?: Array<{
    id: string;
    name: string;
    code: string;
    conciseSummary?: string;
  }>;
  /** Project ids that contributed deeper context buckets. */
  deepContextProjectIds?: string[];
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
  diagnostics: {
    recordCount: number;
    approxChars: number;
    projectScoped: boolean;
    builtAt: string;
    limitsReached: CaptureContextLimitHit[];
  };
};

/** Traceability blob stored with a Capture analysis (not full source records). */
export type CaptureContextManifest = {
  builtAt: string;
  projectId?: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  requestId?: string | null;
  approximateCharacterCount: number;
  counts: Record<string, number>;
  limitsReached: string[];
  records: Array<{
    id: string;
    type: string;
    title: string;
    status?: string;
    date?: string | null;
  }>;
  excludedByLimit: Array<{
    id: string;
    type: string;
    title: string;
    status?: string;
    date?: string | null;
    bucket: string;
  }>;
  /** Development: modular prompt section presence + size (Phase 1.5). */
  promptAssembly?: {
    sections: Array<{ id: string; label: string; present: boolean }>;
    approximateCharacters: number;
    estimatedTokens: number;
    contextRecordCount: number;
    dictionaryEntryCount: number;
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

function rec(partial: CaptureContextRecord): CaptureContextRecord {
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

function takeRankedWithExclusions<T>(
  items: T[],
  limit: number,
  rank: (item: T) => number,
  toRecord: (item: T) => CaptureContextRecord,
  bucket: string,
): { included: CaptureContextRecord[]; hit: CaptureContextLimitHit | null } {
  const ranked = [...items]
    .map((item, index) => ({ item, index, score: rank(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const kept = ranked.slice(0, Math.max(0, limit));
  const dropped = ranked.slice(Math.max(0, limit));
  const included = kept.map((x) => toRecord(x.item));
  if (dropped.length === 0) {
    return { included, hit: null };
  }
  return {
    included,
    hit: {
      bucket,
      included: included.length,
      available: ranked.length,
      excluded: dropped.map((x) => toRecord(x.item)),
    },
  };
}

function knowledgeCandidates(
  knowledge: ProjectKnowledge | undefined,
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
  return rows;
}

function emptyContext(projectScoped: boolean): CaptureProjectContext {
  const builtAt = new Date().toISOString();
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
    diagnostics: {
      recordCount: 0,
      approxChars: 0,
      projectScoped,
      builtAt,
      limitsReached: [],
    },
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
  const softHintId = args.projectId || null;
  const keywords = tokensFrom(args.captureText);
  const builtAt = new Date().toISOString();
  const limitsReached: CaptureContextLimitHit[] = [];
  const projectIndex = buildProjectIndex(args.state.projects ?? []).map((p) => {
    const full = args.state.projects.find((x) => x.id === p.id);
    return {
      ...p,
      conciseSummary: full?.currentFocus || full?.summary?.slice(0, 120),
    };
  });
  const mentioned = detectMentionedProjects(
    args.captureText,
    args.state.projects ?? [],
  );
  // Deeper context: explicit mentions win; otherwise soft sidebar hint only.
  const deepContextProjectIds = mentioned.length
    ? mentioned.map((m) => m.id)
    : softHintId
      ? [softHintId]
      : [];

  const primaryId = deepContextProjectIds[0] ?? softHintId;
  if (!primaryId) {
    const empty = emptyContext(false);
    empty.projectIndex = projectIndex;
    empty.deepContextProjectIds = [];
    return empty;
  }

  const project = args.state.projects.find((p) => p.id === primaryId);
  if (!project) {
    const empty = emptyContext(Boolean(softHintId));
    empty.projectIndex = projectIndex;
    empty.deepContextProjectIds = [];
    return empty;
  }

  const projectId = primaryId;

  const todos = [...(args.state.todos ?? [])];
  const meetings = [...(args.state.meetings ?? [])];
  const timeline = [...(args.state.timeline ?? [])];
  const releases = [...(args.state.releases ?? [])];
  const history = [...(args.state.history ?? [])];
  const knowledgeList = [...(args.state.knowledge ?? [])];

  const projectTodos = todos.filter((t) => t.projectId === projectId);

  const openPick = takeRankedWithExclusions(
    projectTodos.filter((t) => !t.done),
    limits.openTodos,
    (t) =>
      scoreText(`${t.title} ${t.detail ?? ""}`, keywords) * 3 +
      (t.dueAt ? 1 : 0),
    (t) => todoRecord(t, "todo"),
    "To Dos",
  );
  if (openPick.hit) limitsReached.push(openPick.hit);

  const completedPick = takeRankedWithExclusions(
    projectTodos.filter((t) => t.done),
    limits.recentCompletedTodos,
    (t) =>
      scoreText(`${t.title} ${t.detail ?? ""}`, keywords) * 2 +
      Date.parse(t.createdAt || "") / 1e13,
    (t) => todoRecord(t, "todo_completed"),
    "Completed To Dos",
  );
  if (completedPick.hit) limitsReached.push(completedPick.hit);

  const nudgePick = takeRankedWithExclusions(
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
    (n) =>
      rec({
        id: n.id,
        type: "nudge",
        title: `${n.person} — ${n.item}`,
        status: n.urgency,
        summary: n.suggestedMessage?.slice(0, 160),
      }),
    "Nudges",
  );
  if (nudgePick.hit) limitsReached.push(nudgePick.hit);

  const meetingPick = takeRankedWithExclusions(
    meetings.filter((m) => m.projectId === projectId),
    limits.meetings,
    (m) =>
      scoreText(`${m.title} ${m.prep.openingScript}`, keywords) * 2 +
      Date.parse(m.startsAt || "") / 1e13,
    (m) =>
      rec({
        id: m.id,
        type: "meeting",
        title: m.title,
        status: m.phase,
        date: m.startsAt,
        summary: m.prep.objectives.slice(0, 2).join("; ") || undefined,
      }),
    "Meetings",
  );
  if (meetingPick.hit) limitsReached.push(meetingPick.hit);

  const milestonePick = takeRankedWithExclusions(
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
    (t) => timelineRecord(t),
    "Milestones",
  );
  if (milestonePick.hit) limitsReached.push(milestonePick.hit);

  const knowledge = knowledgeList.find((k) => k.projectId === projectId);
  const knowledgePick = takeRankedWithExclusions(
    knowledgeCandidates(knowledge),
    limits.knowledgeItems,
    (r) => scoreText(`${r.title} ${r.summary ?? ""}`, keywords),
    (r) => r,
    "Knowledge",
  );
  if (knowledgePick.hit) limitsReached.push(knowledgePick.hit);

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
  const riskPick = takeRankedWithExclusions(
    [...risksFromKnowledge, ...riskRecs],
    limits.risks,
    (r) => scoreText(`${r.title} ${r.summary ?? ""}`, keywords),
    (r) => r,
    "Risks",
  );
  if (riskPick.hit) limitsReached.push(riskPick.hit);

  const stakeholderPick = takeRankedWithExclusions(
    [...project.stakeholders],
    limits.stakeholders,
    (s) =>
      scoreText(
        `${s.name} ${s.role} ${(s.concerns ?? []).join(" ")}`,
        keywords,
      ) * 2,
    (s) =>
      rec({
        id: s.id,
        type: "stakeholder",
        title: s.name,
        status: s.role,
        date: s.lastContactAt ?? null,
        summary: (s.concerns ?? []).slice(0, 2).join("; ") || undefined,
      }),
    "Stakeholders",
  );
  if (stakeholderPick.hit) limitsReached.push(stakeholderPick.hit);

  const historyPick = takeRankedWithExclusions(
    history.filter((h) => h.projectId === projectId),
    limits.historyEvents,
    (h) =>
      scoreText(`${h.title} ${h.detail ?? ""}`, keywords) +
      Date.parse(h.createdAt || "") / 1e13,
    (h) =>
      rec({
        id: h.id,
        type: `history:${h.type}`,
        title: h.title,
        date: h.createdAt,
        summary: h.detail?.slice(0, 160),
        updatedAt: h.createdAt,
      }),
    "History",
  );
  if (historyPick.hit) limitsReached.push(historyPick.hit);

  const releasePick = takeRankedWithExclusions(
    releases.filter((r) => r.projectId === projectId),
    limits.releases,
    (r) => scoreText(`${r.name} ${r.risks.join(" ")}`, keywords),
    (r) =>
      rec({
        id: r.id,
        type: "release",
        title: r.name,
        status: r.currentStage,
        summary: r.risks.slice(0, 2).join("; ") || undefined,
      }),
    "Releases",
  );
  if (releasePick.hit) limitsReached.push(releasePick.hit);

  const ctx: CaptureProjectContext = {
    project: projectMeta(project),
    projectIndex,
    deepContextProjectIds,
    todos: openPick.included,
    completedTodos: completedPick.included,
    nudges: nudgePick.included,
    meetings: meetingPick.included,
    milestones: milestonePick.included,
    risks: riskPick.included,
    stakeholders: stakeholderPick.included,
    knowledge: knowledgePick.included,
    history: historyPick.included,
    releases: releasePick.included,
    diagnostics: {
      recordCount: 0,
      approxChars: 0,
      projectScoped: deepContextProjectIds.length === 1,
      builtAt,
      limitsReached,
    },
  };

  // Merge additional mentioned projects' open todos + risks (capped) without
  // loading every project in full.
  for (const extraId of deepContextProjectIds.slice(1)) {
    const extraTodos = (args.state.todos ?? [])
      .filter((t) => t.projectId === extraId && !t.done)
      .slice(0, 8)
      .map((t) => todoRecord(t, "todo"));
    ctx.todos = [...ctx.todos, ...extraTodos];
    const extraKnowledge = (args.state.knowledge ?? []).find(
      (k) => k.projectId === extraId,
    );
    const extraRisks = (extraKnowledge?.sections.risks ?? [])
      .slice(0, 6)
      .map((title, i) =>
        rec({
          id: `risk-${extraId}-${i}`,
          type: "risk",
          title: title.replace(/^\s*\[resolved\]\s*/i, ""),
          status: /^\s*\[resolved\]/i.test(title) ? "resolved" : "open",
        }),
      );
    ctx.risks = [...ctx.risks, ...extraRisks];
  }

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

export function contextTypeCounts(ctx: CaptureProjectContext) {
  return {
    "To Dos": ctx.todos.length,
    "Completed To Dos": ctx.completedTodos.length,
    Nudges: ctx.nudges.length,
    Meetings: ctx.meetings.length,
    Milestones: ctx.milestones.length,
    Risks: ctx.risks.length,
    Stakeholders: ctx.stakeholders.length,
    Knowledge: ctx.knowledge.length,
    History: ctx.history.length,
    Releases: ctx.releases.length,
  };
}

export function buildCaptureContextManifest(
  ctx: CaptureProjectContext,
  requestId?: string | null,
): CaptureContextManifest {
  const buckets: Array<[string, CaptureContextRecord[]]> = [
    ["todo", ctx.todos],
    ["todo_completed", ctx.completedTodos],
    ["nudge", ctx.nudges],
    ["meeting", ctx.meetings],
    ["milestone", ctx.milestones],
    ["risk", ctx.risks],
    ["stakeholder", ctx.stakeholders],
    ["knowledge", ctx.knowledge],
    ["history", ctx.history],
    ["release", ctx.releases],
  ];
  const records = buckets.flatMap(([, list]) =>
    list.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      status: r.status,
      date: r.date ?? null,
    })),
  );
  const excludedByLimit = ctx.diagnostics.limitsReached.flatMap((hit) =>
    hit.excluded.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      status: r.status,
      date: r.date ?? null,
      bucket: hit.bucket,
    })),
  );
  return {
    builtAt: ctx.diagnostics.builtAt,
    projectId: ctx.project?.id ?? null,
    projectName: ctx.project?.name ?? null,
    projectCode: ctx.project?.code ?? null,
    requestId: requestId ?? null,
    approximateCharacterCount: ctx.diagnostics.approxChars,
    counts: contextTypeCounts(ctx),
    limitsReached: ctx.diagnostics.limitsReached.map(
      (h) => `${h.bucket} — ${h.included} of ${h.available} included`,
    ),
    records,
    excludedByLimit,
  };
}

export function logCaptureContextDiagnostic(manifest: CaptureContextManifest) {
  if (process.env.NODE_ENV !== "development") return;
  const c = manifest.counts;
  console.info(
    [
      "[Capture Context]",
      `Project: ${manifest.projectCode ?? manifest.projectName ?? "None"}`,
      `Records: ${manifest.records.length}`,
      `To Dos: ${c["To Dos"] ?? 0}`,
      `Nudges: ${c.Nudges ?? 0}`,
      `Meetings: ${c.Meetings ?? 0}`,
      `Knowledge: ${c.Knowledge ?? 0}`,
      `Approx chars: ${manifest.approximateCharacterCount.toLocaleString()}`,
      manifest.requestId ? `Request: ${manifest.requestId}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
