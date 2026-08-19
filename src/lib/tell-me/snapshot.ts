/**
 * AI snapshot refresh — server-only. Do not import from client components.
 */
import { getOpenAIKey, isOpenAIConfigured } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { buildDeterministicSnapshot } from "@/lib/tell-me/snapshot-deterministic";
import type { MissionState } from "@/lib/types";
import type { ProjectIntelligenceSnapshot } from "@/lib/tell-me/types";
import { computeProjectRevision } from "@/lib/tell-me/revision";

export { buildDeterministicSnapshot } from "@/lib/tell-me/snapshot-deterministic";

export async function refreshSnapshotWithAi(args: {
  state: MissionState;
  projectId: string;
  userDisplayName?: string | null;
  workspaceId?: string | null;
}): Promise<{
  snapshot: ProjectIntelligenceSnapshot;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  model: string | null;
  provider: "openai" | "local";
}> {
  const base = buildDeterministicSnapshot(args);
  if (!isOpenAIConfigured()) {
    return {
      snapshot: { ...base, kind: "deterministic" },
      usage: null,
      model: null,
      provider: "local",
    };
  }

  const key = getOpenAIKey();
  const model = resolveOpenAIChatModel();
  const project = args.state.projects.find((p) => p.id === args.projectId);

  const userPrompt = [
    `Build a compact Project Intelligence Snapshot for ${project?.code ?? ""} ${project?.name ?? args.projectId}.`,
    "Return JSON with keys: summary (string, <= 400 chars), keyState (string[]), constraints (string[]), majorRisks (string[]), keyDependencies (string[]), keyStakeholders (string[]), importantKnowledge (string[]), significantDates (string[]).",
    "Only use the provided evidence. Do not invent facts. Prefer concise PM-useful bullets.",
    "",
    "EVIDENCE:",
    JSON.stringify(
      {
        summary: base.summary,
        keyState: base.keyState,
        constraints: base.constraints,
        majorRisks: base.majorRisks,
        keyDependencies: base.keyDependencies,
        keyStakeholders: base.keyStakeholders,
        importantKnowledge: base.importantKnowledge,
        significantDates: base.significantDates,
      },
      null,
      2,
    ),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You compress project memory for a PM coaching product called Lume. Never invent project facts. Snapshot refresh must not invent todos, owners, dates, or approvals.",
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Snapshot refresh failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Snapshot refresh returned empty response");
  }

  let parsed: Partial<ProjectIntelligenceSnapshot> = {};
  try {
    parsed = JSON.parse(content) as Partial<ProjectIntelligenceSnapshot>;
  } catch {
    throw new Error("Snapshot refresh returned malformed JSON");
  }

  const asStringArray = (v: unknown, fallback: string[]) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, 12)
      : fallback;

  const snapshot: ProjectIntelligenceSnapshot = {
    ...base,
    id: `snap_ai_${args.projectId}_${Date.now().toString(36)}`,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim().slice(0, 500)
        : base.summary,
    keyState: asStringArray(parsed.keyState, base.keyState),
    constraints: asStringArray(parsed.constraints, base.constraints),
    majorRisks: asStringArray(parsed.majorRisks, base.majorRisks),
    keyDependencies: asStringArray(parsed.keyDependencies, base.keyDependencies),
    keyStakeholders: asStringArray(parsed.keyStakeholders, base.keyStakeholders),
    importantKnowledge: asStringArray(
      parsed.importantKnowledge,
      base.importantKnowledge,
    ),
    significantDates: asStringArray(
      parsed.significantDates,
      base.significantDates,
    ),
    sourceRevision: computeProjectRevision(args.state, args.projectId),
    createdAt: new Date().toISOString(),
    kind: "ai_refresh",
  };

  return {
    snapshot,
    usage: data.usage ?? null,
    model,
    provider: "openai",
  };
}
