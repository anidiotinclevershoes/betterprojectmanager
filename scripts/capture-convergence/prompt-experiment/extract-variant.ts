/**
 * Experiment-only OpenAI extract. Not imported by /api/capture or production extract.ts.
 * Duplicates the production fetch shape (json_object, temperature 0.2) with a variant prompt.
 */
import { getOpenAIKey } from "../../../src/lib/openai";
import { PINNED_OPENAI_CHAT_MODEL } from "../../../src/lib/openai-model";
import { observationCountFromRaw } from "../../../src/lib/capture-v2/provenance";
import {
  PROMPT_VARIANT_META,
  systemMessageFor,
  userPromptFor,
  type PromptVariantId,
} from "./prompts";

export const PROMPT_EXPERIMENT_TEMPERATURE = 0.2;

export type VariantExtractionCall = {
  rawModelJson: unknown;
  responseText: string;
  requestedModel: string;
  responseModel: string;
  promptVersion: string;
  variant: PromptVariantId;
  observationCount: number;
  providerUsage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  elapsedMs: number;
};

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function redact(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9._-]+/g, "[redacted]");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/\((\d{3})\)/);
  return match ? Number(match[1]) : null;
}

export async function extractWithPromptVariant(args: {
  variant: PromptVariantId;
  transcript: string;
  projectBlock: string;
}): Promise<VariantExtractionCall> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requestedModel = PINNED_OPENAI_CHAT_MODEL;
  const prompt = userPromptFor(args.variant, {
    transcript: args.transcript,
    projectBlock: args.projectBlock,
  });

  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: requestedModel,
          temperature: PROMPT_EXPERIMENT_TEMPERATURE,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemMessageFor(args.variant) },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `OpenAI prompt-experiment failed (${response.status}): ${redact(detail).slice(0, 240)}`,
        );
      }

      const data = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI returned an empty observation response");
      }

      const rawModelJson = parseJsonObject(content);
      const responseModel =
        typeof data.model === "string" && data.model.trim()
          ? data.model.trim()
          : requestedModel;

      return {
        rawModelJson,
        responseText: content,
        requestedModel,
        responseModel,
        promptVersion: PROMPT_VARIANT_META[args.variant].promptVersion,
        variant: args.variant,
        observationCount: observationCountFromRaw(rawModelJson),
        providerUsage: data.usage ?? null,
        elapsedMs: Date.now() - started,
      };
    } catch (err) {
      lastError = err;
      const status = statusOf(err);
      const retryable = status === 429 || (status !== null && status >= 500);
      if (!retryable || attempt === 3) break;
      await sleep(1000 * 2 ** attempt);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(redact(message));
}
