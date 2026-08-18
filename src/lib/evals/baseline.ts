/**
 * Fair generic GPT baseline for intelligence evaluation.
 * Same project information as Lume for the stage; no extra project facts.
 */
import { getOpenAIKey, isOpenAIConfigured } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { estimateBaselineTokenBreakdown } from "@/lib/evals/token-breakdown";
import type { SystemAnswerRecord, TokenUsage } from "@/lib/evals/types";

export const BASELINE_PROMPT_VERSION = "gpt-baseline-v1";

export const BASELINE_SYSTEM_PROMPT = `You are an experienced IT project manager.
Answer the user's question based only on the project information supplied.
Do not invent project facts, people, approvals, dates, or decisions that are not in the supplied information.
If the information is missing or insufficient, say so clearly.
Be concise and practical.`;

export async function runGptBaseline(args: {
  question: string;
  contextDocument: string;
  /** Eval/debug — estimate prompt component tokens. */
  debugTokenBreakdown?: boolean;
}): Promise<SystemAnswerRecord> {
  const started = Date.now();
  const modelRequested = resolveOpenAIChatModel({ forEval: true });

  if (!isOpenAIConfigured()) {
    return {
      system: "gpt_baseline",
      answer:
        "Baseline unavailable — OPENAI_API_KEY is not configured in this environment.",
      confidence: null,
      sources: [],
      model: null,
      modelRequested,
      provider: "none",
      usage: null,
      durationMs: Date.now() - started,
      error: "openai_not_configured",
    };
  }

  try {
    const key = getOpenAIKey();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelRequested,
        temperature: 0.2,
        messages: [
          { role: "system", content: BASELINE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `PROJECT INFORMATION:\n${args.contextDocument}\n\nQUESTION:\n${args.question}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        system: "gpt_baseline",
        answer: "",
        confidence: null,
        sources: [],
        model: modelRequested,
        modelRequested,
        provider: "openai",
        usage: null,
        durationMs: Date.now() - started,
        error: `Baseline request failed (${response.status}): ${detail.slice(0, 400)}`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      model?: string;
    };

    const answer = data.choices?.[0]?.message?.content?.trim() || "";
    const usage: TokenUsage | null = data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens ?? null,
          completion_tokens: data.usage.completion_tokens ?? null,
          total_tokens: data.usage.total_tokens ?? null,
        }
      : null;

    const modelResolved = data.model ?? modelRequested;
    const tokenBreakdown = args.debugTokenBreakdown
      ? estimateBaselineTokenBreakdown({
          systemPrompt: BASELINE_SYSTEM_PROMPT,
          contextDocument: args.contextDocument,
          question: args.question,
          apiUsage: usage,
        })
      : null;

    return {
      system: "gpt_baseline",
      answer,
      confidence: null,
      sources: [],
      model: modelResolved,
      modelRequested,
      provider: "openai",
      usage,
      durationMs: Date.now() - started,
      raw: tokenBreakdown ? { tokenBreakdown } : undefined,
      error: answer ? null : "empty_baseline_answer",
    };
  } catch (err) {
    return {
      system: "gpt_baseline",
      answer: "",
      confidence: null,
      sources: [],
      model: modelRequested,
      modelRequested,
      provider: "openai",
      usage: null,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : "baseline_failed",
    };
  }
}
