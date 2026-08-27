/**
 * Catch Me Up briefing engine — read-only.
 * Calls the existing OpenAI provider. Never mutates project truth.
 */
import {
  getOpenAIKey,
  isOpenAIConfigured,
  withOpenAiChatPrivacy,
} from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { CATCH_ME_UP_SYSTEM } from "./prompt";
import { parseCatchMeUpModelJson } from "./parse";
import { buildCatchMeUpTruthView } from "./truth";
import type { CatchMeUpBriefing } from "./types";
import type { MissionState } from "@/lib/types";

export type CatchMeUpChatComplete = (args: {
  system: string;
  user: string;
  model: string;
}) => Promise<{
  content: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}>;

export type CatchMeUpUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

function thinWhereWeAre(projectName: string, currentFocus?: string): string {
  if (currentFocus?.trim()) {
    return `${projectName} is on the books, with current focus “${currentFocus.trim()}”. Beyond that, Lume doesn’t know much yet. Capture what’s happening and I’ll be able to brief you properly.`;
  }
  return `Lume doesn’t know much about ${projectName} yet. Use Capture to tell me what’s happening, and I’ll be able to brief you.`;
}

export async function defaultCatchMeUpChatComplete(args: {
  system: string;
  user: string;
  model: string;
}): Promise<{ content: string; model?: string; usage?: CatchMeUpUsage }> {
  const key = getOpenAIKey();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      withOpenAiChatPrivacy({
        model: args.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    ),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Catch Me Up failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: CatchMeUpUsage;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Catch Me Up returned an empty response");
  }
  return { content, model: data.model, usage: data.usage };
}

export async function generateCatchMeUpBriefing(args: {
  state: MissionState;
  projectId: string;
  now?: Date;
  completeChat?: CatchMeUpChatComplete;
}): Promise<CatchMeUpBriefing> {
  const view = buildCatchMeUpTruthView({
    state: args.state,
    projectId: args.projectId,
  });
  const generatedAt = (args.now ?? new Date()).toISOString();
  const project = args.state.projects.find((p) => p.id === args.projectId);
  const fallbackWhere = thinWhereWeAre(
    view.projectName,
    project?.currentFocus,
  );

  if (view.thinProject) {
    return {
      projectId: view.projectId,
      projectName: view.projectName,
      projectCode: view.projectCode,
      generatedAt,
      thinProject: true,
      facts: view.facts,
      whereWeAre: {
        epistemic: "known",
        prose: fallbackWhere,
        factIds: [],
      },
      needsAttention: [],
      mightHaveMissed: [],
      connections: [],
      model: null,
      provider: "none",
    };
  }

  if (!args.completeChat && !isOpenAIConfigured()) {
    throw new Error("AI is not configured for Catch Me Up.");
  }

  const complete = args.completeChat ?? defaultCatchMeUpChatComplete;
  const modelRequested = resolveOpenAIChatModel();
  const userContent = [
    view.promptBlock,
    "",
    "VALID FACT IDS (cite only these; never invent ids):",
    view.facts.map((f) => f.id).join(", ") || "(none)",
    "",
    "Write a Catch Me Up briefing for this project. Omit empty sections.",
  ].join("\n");

  const result = await complete({
    system: CATCH_ME_UP_SYSTEM,
    user: userContent,
    model: modelRequested,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content) as unknown;
  } catch {
    throw new Error("Catch Me Up returned a malformed response");
  }

  const sections = parseCatchMeUpModelJson({
    raw: parsed,
    factIds: view.factIds,
    needsConfirmationHints: view.needsConfirmationHints,
    fallbackWhereWeAre: `${view.projectName}${project?.currentFocus ? `: ${project.currentFocus}` : ""}.`,
  });

  return {
    projectId: view.projectId,
    projectName: view.projectName,
    projectCode: view.projectCode,
    generatedAt,
    thinProject: false,
    facts: view.facts,
    whereWeAre: sections.whereWeAre,
    needsAttention: sections.needsAttention,
    mightHaveMissed: sections.mightHaveMissed,
    connections: sections.connections,
    model: result.model ?? modelRequested,
    provider: "openai",
  };
}
