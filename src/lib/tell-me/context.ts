/**
 * Tell Me context assembly — reuses Capture context selection with
 * question-aware limits and labelled knowledge sections.
 */
import {
  buildCaptureContext,
  type CaptureContextLimits,
  type CaptureContextRecord,
  type CaptureProjectContext,
} from "@/lib/capture/context";
import { KNOWLEDGE_SECTIONS } from "@/lib/knowledge";
import {
  questionLooksCurrentState,
  questionLooksHistorical,
  questionLooksOwnership,
} from "@/lib/tell-me/question-shape";
import { resolveTellMeScope } from "@/lib/tell-me/scope";
import type { MissionState } from "@/lib/types";
import type {
  ProjectIntelligenceSnapshot,
  TellMeSourceRef,
} from "@/lib/tell-me/types";

export type TellMeContextBundle = {
  scope: ReturnType<typeof resolveTellMeScope>;
  contexts: Array<ReturnType<typeof buildCaptureContext>>;
  snapshot: ProjectIntelligenceSnapshot | null;
  recordsSelected: number;
  approxChars: number;
  promptBlock: string;
  sourceCatalogue: TellMeSourceRef[];
};

/** Cap history/risks for current-state asks so superseded narrative is less dominant. */
export function tellMeContextLimitsForQuestion(
  question: string,
): Partial<CaptureContextLimits> {
  if (questionLooksHistorical(question)) {
    return { historyEvents: 12, knowledgeItems: 14 };
  }
  if (questionLooksOwnership(question)) {
    return { historyEvents: 4, risks: 4, knowledgeItems: 14 };
  }
  if (questionLooksCurrentState(question)) {
    return { historyEvents: 4, risks: 5, knowledgeItems: 12 };
  }
  return {};
}

function knowledgeSectionLabel(type: string): string {
  const id = type.replace(/^knowledge:/, "");
  const known = KNOWLEDGE_SECTIONS.find((s) => s.id === id);
  return known?.label ?? `Knowledge · ${id}`;
}

/** Prefer Current position / Decisions first for current-state questions. */
function orderKnowledgeForQuestion(
  records: CaptureContextRecord[],
  question: string,
): CaptureContextRecord[] {
  const sectionRank = (type: string): number => {
    if (type === "knowledge:now") return 0;
    if (type === "knowledge:decisions") return 1;
    if (type === "knowledge:openLoops") return 2;
    if (type === "knowledge:people") return 3;
    if (type === "knowledge:risks") return 4;
    return 5;
  };
  const preferCurrent = questionLooksCurrentState(question);
  return [...records].sort((a, b) => {
    if (!preferCurrent) return 0;
    return sectionRank(a.type) - sectionRank(b.type);
  });
}

const SUPERSESSION_TOPICS = [
  "snyk",
  "go-live",
  "security approval",
  "rate limit",
  "msa",
  "design freeze",
  "cab ",
] as const;

/**
 * For current-state questions, drop older History rows about topics already
 * stated in Current position — avoids resurrecting superseded counts/dates
 * and reduces tokens. Historical questions keep full history selection.
 */
export function refineHistoryForQuestion(
  history: CaptureContextRecord[],
  knowledge: CaptureContextRecord[],
  question: string,
): CaptureContextRecord[] {
  if (!questionLooksCurrentState(question) || questionLooksHistorical(question)) {
    return history;
  }
  const nowText = knowledge
    .filter((k) => k.type === "knowledge:now" || k.type === "knowledge:decisions")
    .map((k) => `${k.title} ${k.summary ?? ""}`.toLowerCase())
    .join("\n");
  if (!nowText.trim()) return history;

  const covered = SUPERSESSION_TOPICS.filter((t) => nowText.includes(t.trim()));
  if (!covered.length) return history;

  return history.filter((h) => {
    const hay = `${h.title} ${h.summary ?? ""}`.toLowerCase();
    // Keep history that does not restate a topic already covered in Current position
    return !covered.some((t) => hay.includes(t.trim()));
  });
}

export function buildTellMeContext(args: {
  state: MissionState;
  question: string;
  selectedProjectId?: string | null;
  snapshot?: ProjectIntelligenceSnapshot | null;
}): TellMeContextBundle {
  const scope = resolveTellMeScope({
    question: args.question,
    selectedProjectId: args.selectedProjectId,
    state: args.state,
  });

  const limits = tellMeContextLimitsForQuestion(args.question);

  const contexts = scope.projectIdsForDeepContext.map((projectId) => {
    const ctx = buildCaptureContext({
      state: args.state,
      projectId,
      captureText: args.question,
      limits,
    });
    const knowledge = orderKnowledgeForQuestion(ctx.knowledge, args.question);
    const history = refineHistoryForQuestion(
      ctx.history,
      knowledge,
      args.question,
    );
    return {
      ...ctx,
      knowledge,
      history,
    };
  });

  // Cross-project: also include lightweight index via empty project context
  if (scope.mode === "cross_project" && contexts.length === 0) {
    contexts.push(
      buildCaptureContext({
        state: args.state,
        projectId: undefined,
        captureText: args.question,
        limits,
      }),
    );
  }

  const snapshot =
    args.snapshot &&
    scope.projectId &&
    args.snapshot.projectId === scope.projectId
      ? args.snapshot
      : null;

  const sourceCatalogue: TellMeSourceRef[] = [];
  for (const ctx of contexts) {
    const code = ctx.project?.code ?? null;
    const pid = ctx.project?.id ?? null;
    const pushAll = (
      records: typeof ctx.todos,
      kind: TellMeSourceRef["kind"],
    ) => {
      for (const r of records) {
        sourceCatalogue.push({
          id: r.id,
          kind,
          label: r.title,
          projectId: pid,
          projectCode: code,
          detail: r.summary ?? r.status ?? null,
        });
      }
    };
    pushAll(ctx.knowledge, "knowledge");
    pushAll(ctx.todos, "todo");
    pushAll(ctx.risks, "risk");
    pushAll(ctx.milestones, "timeline");
    pushAll(ctx.history, "history");
    pushAll(ctx.meetings, "meeting");
    pushAll(ctx.releases, "release");
    pushAll(ctx.stakeholders, "stakeholder");
  }

  if (snapshot) {
    sourceCatalogue.push({
      id: snapshot.id,
      kind: "snapshot",
      label: "Project intelligence snapshot",
      projectId: snapshot.projectId,
      projectCode: scope.projectCode,
      detail: snapshot.createdAt,
    });
  }

  const promptBlock = formatTellMePromptBlock({
    question: args.question,
    scope,
    contexts,
    snapshot,
  });

  const recordsSelected = contexts.reduce(
    (n, c) =>
      n +
      c.todos.length +
      c.knowledge.length +
      c.risks.length +
      c.milestones.length +
      c.history.length +
      c.meetings.length +
      c.releases.length +
      c.stakeholders.length,
    0,
  );

  return {
    scope,
    contexts,
    snapshot,
    recordsSelected,
    approxChars: promptBlock.length,
    promptBlock,
    sourceCatalogue,
  };
}

function formatTellMePromptBlock(args: {
  question: string;
  scope: ReturnType<typeof resolveTellMeScope>;
  contexts: CaptureProjectContext[];
  snapshot: ProjectIntelligenceSnapshot | null;
}): string {
  const lines: string[] = [];
  lines.push(`QUESTION: ${args.question}`);
  lines.push(
    `SCOPE: ${args.scope.mode}${args.scope.projectName ? ` · ${args.scope.projectName} (${args.scope.projectCode})` : ""}`,
  );

  if (args.snapshot) {
    lines.push("");
    lines.push(
      "PROJECT INTELLIGENCE SNAPSHOT (may be stale — prefer live records for 'latest'):",
    );
    lines.push(args.snapshot.summary);
    if (args.snapshot.keyState.length) {
      lines.push(`Key state: ${args.snapshot.keyState.join(" | ")}`);
    }
    if (args.snapshot.majorRisks.length) {
      lines.push(`Risks: ${args.snapshot.majorRisks.join(" | ")}`);
    }
  }

  for (const ctx of args.contexts) {
    lines.push("");
    lines.push(
      `PROJECT RECORDS${ctx.project ? `: ${ctx.project.code} — ${ctx.project.name}` : " (cross-project mix)"}`,
    );

    // Knowledge grouped by section so Current position is visible to the model.
    const bySection = new Map<string, CaptureContextRecord[]>();
    for (const r of ctx.knowledge) {
      const key = r.type.startsWith("knowledge:")
        ? r.type
        : "knowledge:other";
      const list = bySection.get(key) ?? [];
      list.push(r);
      bySection.set(key, list);
    }
    const sectionOrder = [
      "knowledge:now",
      "knowledge:decisions",
      "knowledge:openLoops",
      "knowledge:people",
      "knowledge:risks",
    ];
    for (const key of [
      ...sectionOrder,
      ...[...bySection.keys()].filter((k) => !sectionOrder.includes(k)),
    ]) {
      const records = bySection.get(key);
      if (!records?.length) continue;
      lines.push(`${knowledgeSectionLabel(key)}:`);
      for (const r of records.slice(0, 20)) {
        lines.push(formatRecordLine(r));
      }
    }

    const knowledgeSummaries = new Set(
      ctx.knowledge
        .map((r) => (r.summary ?? r.title).trim().toLowerCase())
        .filter(Boolean),
    );
    // Skip risk rows that duplicate knowledge:risks bullets (token waste).
    const uniqueRisks = ctx.risks.filter((r) => {
      const key = (r.summary ?? r.title).trim().toLowerCase();
      return !knowledgeSummaries.has(key);
    });

    const buckets: Array<[string, CaptureContextRecord[]]> = [
      ["To Dos", ctx.todos],
      ["Risks", uniqueRisks],
      ["Milestones", ctx.milestones],
      ["History", ctx.history],
      ["Meetings", ctx.meetings],
      ["Releases", ctx.releases],
      ["Stakeholders", ctx.stakeholders],
    ];
    for (const [label, records] of buckets) {
      if (!records.length) continue;
      lines.push(`${label}:`);
      for (const r of records.slice(0, 20)) {
        lines.push(formatRecordLine(r));
      }
    }
  }

  return lines.join("\n");
}

function formatRecordLine(r: CaptureContextRecord): string {
  return `- [${r.id}] ${r.title}${r.status ? ` (${r.status})` : ""}${r.date ? ` · ${r.date}` : ""}${r.summary ? ` — ${r.summary}` : ""}`;
}
