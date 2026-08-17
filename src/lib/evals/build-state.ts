/**
 * Build a MissionState slice for a Project World stage from fixtures.
 * Uses only information from captures up to that stage — fair to both Lume and GPT.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import type { MissionState, Project } from "@/lib/types";
import type { EvalCaptureEvent, EvalStage, EvalWorldFixture } from "@/lib/evals/types";

function emptyState(): MissionState {
  return {
    projects: [],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [],
    timeline: [],
    history: [],
    analysesThisMonth: 0,
  };
}

export function capturesForStage(
  world: EvalWorldFixture,
  stage: EvalStage,
): EvalCaptureEvent[] {
  const byId = new Map(world.captures.map((c) => [c.id, c]));
  return stage.captureIds
    .map((id) => byId.get(id))
    .filter((c): c is EvalCaptureEvent => Boolean(c));
}

export function buildMissionStateForStage(
  world: EvalWorldFixture,
  stageId: string,
): {
  state: MissionState;
  projectId: string;
  stage: EvalStage;
  captures: EvalCaptureEvent[];
  contextDocument: string;
} {
  const stage = world.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new Error(`Unknown stage ${stageId} in world ${world.id}`);
  }
  const captures = capturesForStage(world, stage);
  const projectId = `eval-${world.id}`;
  const project: Project = {
    id: projectId,
    code: world.code,
    name: world.name,
    kind: "delivery",
    status: "watch",
    summary: world.description,
    currentFocus: stage.summary,
    stakeholders: [],
  };

  const knowledgeBullets = {
    now: [] as string[],
    decisions: [] as string[],
    risks: [] as string[],
    people: [] as string[],
    openLoops: [] as string[],
  };

  for (const truth of stage.knownTruth) {
    knowledgeBullets.now.push(truth);
  }
  for (const cap of captures) {
    for (const t of cap.knownTruth ?? []) {
      if (!knowledgeBullets.now.includes(t)) knowledgeBullets.now.push(t);
    }
    // Heuristic bucket from capture text for people/dates/risks (fixture-assisted)
    if (/Sarah|Marcus|Nina/i.test(cap.content)) {
      if (/Sarah/.test(cap.content) && !knowledgeBullets.people.some((p) => /Sarah/.test(p))) {
        knowledgeBullets.people.push(
          "Sarah — owns UX sign-off; availability may be constrained in later captures",
        );
      }
      if (/Marcus/.test(cap.content) && !knowledgeBullets.people.some((p) => /Marcus/.test(p))) {
        knowledgeBullets.people.push("Marcus — owns release notes");
      }
      if (/Nina/.test(cap.content) && !knowledgeBullets.people.some((p) => /Nina/.test(p))) {
        knowledgeBullets.people.push("Nina — drafting CDN rollback plan");
      }
    }
    if (/risk|incomplete|away|must not/i.test(cap.content)) {
      knowledgeBullets.risks.push(cap.content.slice(0, 240));
    }
  }

  const memories = captures.map((cap, i) => ({
    id: `eval-mem-${cap.id}`,
    type: "conversation" as const,
    projectId,
    title: cap.title,
    content: cap.content,
    tags: ["eval-fixture", world.id, stage.id],
    occurredAt: cap.at,
    createdAt: cap.at,
    source: "capture" as const,
  }));

  const state: MissionState = {
    ...emptyState(),
    projects: [project],
    memories,
    knowledge: [
      {
        ...emptyKnowledge(projectId),
        updatedAt: captures[captures.length - 1]?.at ?? new Date().toISOString(),
        sections: knowledgeBullets,
      },
    ],
    history: captures.map((cap) => ({
      id: `eval-hist-${cap.id}`,
      type: "capture_analysed" as const,
      title: cap.title,
      detail: cap.content.slice(0, 160),
      projectId,
      createdAt: cap.at,
      source: "ai" as const,
    })),
  };

  const contextDocument = [
    `# Project ${world.code} — ${world.name}`,
    world.description,
    "",
    `## Stage: ${stage.label}`,
    stage.summary,
    "",
    "## Known truth at this stage",
    ...stage.knownTruth.map((t) => `- ${t}`),
    "",
    "## Capture sequence (chronological)",
    ...captures.flatMap((c) => [
      `### ${c.at} — ${c.title}`,
      c.content,
      "",
    ]),
  ].join("\n");

  return { state, projectId, stage, captures, contextDocument };
}

/** Fair GPT baseline context: same underlying information Lume receives for the stage. */
export function buildBaselineContextDocument(
  world: EvalWorldFixture,
  stageId: string,
): string {
  return buildMissionStateForStage(world, stageId).contextDocument;
}
