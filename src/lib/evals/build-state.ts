/**
 * Build a MissionState slice for a Project World stage from fixtures.
 * Uses only information from captures up to that stage — fair to both Lume and GPT.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import { truncatePreservingMeaning } from "@/lib/text/semantic-truncate";
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

/** Extract "Name — role…" style people lines from knownTruth / capture text. */
function extractPeopleLines(texts: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    // Keep explicit ownership / leave phrasing — do not collapse to bare name
    // (bare "Ava mentioned" invites inventing unrelated ownership).
    const ownership = text.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(owns|does not own|doesn't own)\b[^.]{0,120}/,
    );
    if (ownership) {
      const line = ownership[0]!.trim();
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(truncatePreservingMeaning(line, 240));
      }
    }
    const leave = text.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:is\s+away|returns|covering|promised|confirmed)\b[^.]{0,100}/,
    );
    if (leave) {
      const line = leave[0]!.trim();
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(truncatePreservingMeaning(line, 240));
      }
    }
    const dash = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+[—-]/);
    if (dash) {
      const line = truncatePreservingMeaning(text, 240);
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(line);
      }
    }
  }
  return out;
}

/**
 * Promote compact qualified decisions from capture knownTruth when stage `now`
 * does not already cover the subject (avoids resurrecting superseded Snyk counts).
 */
function shouldPromoteQualifiedDecision(
  truth: string,
  stageBlobLower: string,
): boolean {
  const t = truth.toLowerCase();
  // Must carry a restriction / epistemic / scope qualifier
  if (
    !/\b(only|require|requires|required|cannot|can't|must not|informal|unofficial|unconfirmed|speculation|not authorised|not authorized|not a decision|jointly|both own|unit tests|real staging)\b/i.test(
      truth,
    )
  ) {
    return false;
  }
  // Status/count lines about topics already in stage now → leave to Current position
  const statusTopics = ["snyk", "go-live", "cab "] as const;
  for (const topic of statusTopics) {
    if (t.includes(topic.trim()) && stageBlobLower.includes(topic.trim())) {
      if (/\b(one|two|three|\d+|remain|open|cleared|target)\b/i.test(truth)) {
        return false;
      }
    }
  }
  // Already present in stage truth
  if (stageBlobLower.includes(t.slice(0, Math.min(48, t.length)))) return false;
  return true;
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
    // Surface stage-current risks / open loops as structured bullets — not
    // superseded full capture narratives (those belong in History).
    if (
      /risk|incomplete|away|must not|blocked|outstanding|conflict|unconfirmed|no .+ approval|still open|remain open|not authorised|not authorized|unsigned|not ready|sole |SPOF|single point/i.test(
        truth,
      )
    ) {
      knowledgeBullets.risks.push(truth);
    }
    if (
      /waiting|promised|chase|await|due|outstanding|requested|owed|owes/i.test(
        truth,
      )
    ) {
      knowledgeBullets.openLoops.push(truth);
    }
  }
  // Only stage.knownTruth is "current" structured knowledge for status (Contract §4).
  // Promote concise *qualified decisions* from capture knownTruth when the stage
  // does not already cover that subject — preserves restrictions without dumping
  // full historical capture narratives (2C.1 token win).
  const truthBag: string[] = [...stage.knownTruth];
  const stageBlob = stage.knownTruth.join("\n").toLowerCase();
  for (const cap of captures) {
    for (const t of cap.knownTruth ?? []) {
      truthBag.push(t);
      if (shouldPromoteQualifiedDecision(t, stageBlob)) {
        knowledgeBullets.decisions.push(t);
      }
    }
  }
  knowledgeBullets.people = extractPeopleLines([
    ...truthBag,
    ...captures.map((c) => c.content),
  ]);

  const memories = captures.map((cap) => ({
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
      detail: truncatePreservingMeaning(cap.content, 220),
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
