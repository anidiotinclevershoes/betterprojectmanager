/**
 * Tell Me context assembly — reuses Capture context selection.
 */
import { buildCaptureContext } from "@/lib/capture/context";
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

  const contexts = scope.projectIdsForDeepContext.map((projectId) =>
    buildCaptureContext({
      state: args.state,
      projectId,
      captureText: args.question,
    }),
  );

  // Cross-project: also include lightweight index via empty project context
  if (scope.mode === "cross_project" && contexts.length === 0) {
    contexts.push(
      buildCaptureContext({
        state: args.state,
        projectId: undefined,
        captureText: args.question,
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
  contexts: Array<ReturnType<typeof buildCaptureContext>>;
  snapshot: ProjectIntelligenceSnapshot | null;
}): string {
  const lines: string[] = [];
  lines.push(`QUESTION: ${args.question}`);
  lines.push(
    `SCOPE: ${args.scope.mode}${args.scope.projectName ? ` · ${args.scope.projectName} (${args.scope.projectCode})` : ""}`,
  );

  if (args.snapshot) {
    lines.push("");
    lines.push("PROJECT INTELLIGENCE SNAPSHOT (may be stale — prefer live records for 'latest'):");
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
    const buckets: Array<[string, typeof ctx.todos]> = [
      ["Knowledge", ctx.knowledge],
      ["To Dos", ctx.todos],
      ["Risks", ctx.risks],
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
        lines.push(
          `- [${r.id}] ${r.title}${r.status ? ` (${r.status})` : ""}${r.date ? ` · ${r.date}` : ""}${r.summary ? ` — ${r.summary}` : ""}`,
        );
      }
    }
  }

  return lines.join("\n");
}
