/**
 * Eval-only token / prompt component estimates (js-tiktoken cl100k_base).
 * Not used on the production Tell Me hot path unless explicitly requested.
 */
import { getEncoding } from "js-tiktoken";
import type { TellMeContextBundle } from "@/lib/tell-me/context";

let encoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder() {
  if (!encoder) encoder = getEncoding("cl100k_base");
  return encoder;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    return getEncoder().encode(text).length;
  } catch {
    // Fail soft for evals — character heuristic only as last resort
    return Math.ceil(text.length / 4);
  }
}

export type LumeTokenBreakdown = {
  systemInstructions: number;
  questionAndScope: number;
  snapshot: number;
  knowledgeNow: number;
  knowledgeDecisions: number;
  knowledgePeople: number;
  knowledgeRisks: number;
  knowledgeOpenLoops: number;
  knowledgeOther: number;
  todos: number;
  risksBucket: number;
  history: number;
  milestones: number;
  meetings: number;
  releases: number;
  stakeholders: number;
  conversation: number;
  freshnessNotes: number;
  /** Sum of estimated input components (may differ slightly from API prompt_tokens). */
  estimatedInputTotal: number;
  apiPromptTokens: number | null;
  apiCompletionTokens: number | null;
  apiTotalTokens: number | null;
};

export type BaselineTokenBreakdown = {
  systemInstructions: number;
  contextDocument: number;
  question: number;
  estimatedInputTotal: number;
  apiPromptTokens: number | null;
  apiCompletionTokens: number | null;
  apiTotalTokens: number | null;
};

function sectionText(
  promptBlock: string,
  header: string,
  nextHeaders: string[],
): string {
  const start = promptBlock.indexOf(`${header}:`);
  if (start < 0) return "";
  let end = promptBlock.length;
  for (const h of nextHeaders) {
    const idx = promptBlock.indexOf(`\n${h}:`, start + 1);
    if (idx >= 0 && idx < end) end = idx;
  }
  return promptBlock.slice(start, end);
}

const KNOWLEDGE_HEADERS = [
  "Current position",
  "Decisions",
  "Waiting & open loops",
  "People & context",
  "Risks & blockers",
];

const BUCKET_HEADERS = [
  "To Dos",
  "Risks",
  "Milestones",
  "History",
  "Meetings",
  "Releases",
  "Stakeholders",
];

export function estimateLumeTokenBreakdown(args: {
  systemPrompt: string;
  promptBlock: string;
  conversationBlock?: string;
  freshnessBlock?: string;
  apiUsage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  } | null;
}): LumeTokenBreakdown {
  const allHeaders = [
    "QUESTION",
    "SCOPE",
    "PROJECT INTELLIGENCE SNAPSHOT",
    "PROJECT RECORDS",
    ...KNOWLEDGE_HEADERS,
    ...BUCKET_HEADERS,
  ];

  const qScope = [
    sectionText(args.promptBlock, "QUESTION", allHeaders),
    sectionText(args.promptBlock, "SCOPE", allHeaders),
  ].join("\n");

  const snap = sectionText(
    args.promptBlock,
    "PROJECT INTELLIGENCE SNAPSHOT",
    allHeaders,
  );

  const knowledgeNow = sectionText(args.promptBlock, "Current position", allHeaders);
  const knowledgeDecisions = sectionText(args.promptBlock, "Decisions", allHeaders);
  const knowledgeOpenLoops = sectionText(
    args.promptBlock,
    "Waiting & open loops",
    allHeaders,
  );
  const knowledgePeople = sectionText(
    args.promptBlock,
    "People & context",
    allHeaders,
  );
  const knowledgeRisks = sectionText(
    args.promptBlock,
    "Risks & blockers",
    allHeaders,
  );

  const todos = sectionText(args.promptBlock, "To Dos", allHeaders);
  const risksBucket = sectionText(args.promptBlock, "Risks", allHeaders);
  const history = sectionText(args.promptBlock, "History", allHeaders);
  const milestones = sectionText(args.promptBlock, "Milestones", allHeaders);
  const meetings = sectionText(args.promptBlock, "Meetings", allHeaders);
  const releases = sectionText(args.promptBlock, "Releases", allHeaders);
  const stakeholders = sectionText(args.promptBlock, "Stakeholders", allHeaders);

  const parts = {
    systemInstructions: estimateTokens(args.systemPrompt),
    questionAndScope: estimateTokens(qScope),
    snapshot: estimateTokens(snap),
    knowledgeNow: estimateTokens(knowledgeNow),
    knowledgeDecisions: estimateTokens(knowledgeDecisions),
    knowledgePeople: estimateTokens(knowledgePeople),
    knowledgeRisks: estimateTokens(knowledgeRisks),
    knowledgeOpenLoops: estimateTokens(knowledgeOpenLoops),
    knowledgeOther: 0,
    todos: estimateTokens(todos),
    risksBucket: estimateTokens(risksBucket),
    history: estimateTokens(history),
    milestones: estimateTokens(milestones),
    meetings: estimateTokens(meetings),
    releases: estimateTokens(releases),
    stakeholders: estimateTokens(stakeholders),
    conversation: estimateTokens(args.conversationBlock ?? ""),
    freshnessNotes: estimateTokens(args.freshnessBlock ?? ""),
  };

  const estimatedInputTotal = Object.values(parts).reduce((a, b) => a + b, 0);

  return {
    ...parts,
    estimatedInputTotal,
    apiPromptTokens: args.apiUsage?.prompt_tokens ?? null,
    apiCompletionTokens: args.apiUsage?.completion_tokens ?? null,
    apiTotalTokens: args.apiUsage?.total_tokens ?? null,
  };
}

export function estimateBaselineTokenBreakdown(args: {
  systemPrompt: string;
  contextDocument: string;
  question: string;
  apiUsage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  } | null;
}): BaselineTokenBreakdown {
  const systemInstructions = estimateTokens(args.systemPrompt);
  const contextDocument = estimateTokens(args.contextDocument);
  const question = estimateTokens(args.question);
  return {
    systemInstructions,
    contextDocument,
    question,
    estimatedInputTotal: systemInstructions + contextDocument + question,
    apiPromptTokens: args.apiUsage?.prompt_tokens ?? null,
    apiCompletionTokens: args.apiUsage?.completion_tokens ?? null,
    apiTotalTokens: args.apiUsage?.total_tokens ?? null,
  };
}

/** Aggregate many case breakdowns (sum). */
export function sumLumeBreakdowns(
  rows: LumeTokenBreakdown[],
): LumeTokenBreakdown | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]!) as Array<keyof LumeTokenBreakdown>;
  const out = { ...rows[0]! };
  for (const key of keys) {
    if (typeof out[key] === "number") {
      (out as Record<string, number | null>)[key] = rows.reduce(
        (s, r) => s + ((r[key] as number) || 0),
        0,
      );
    } else {
      (out as Record<string, number | null>)[key] = rows.reduce(
        (s, r) => s + ((r[key] as number | null) ?? 0),
        0,
      );
    }
  }
  return out;
}

export function summariseBundleChars(bundle: TellMeContextBundle): {
  promptChars: number;
  recordsSelected: number;
} {
  return {
    promptChars: bundle.approxChars,
    recordsSelected: bundle.recordsSelected,
  };
}
