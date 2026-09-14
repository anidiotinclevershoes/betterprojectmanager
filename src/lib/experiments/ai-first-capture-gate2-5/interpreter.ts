/**
 * Exactly one semantic Astra call. Gate 2.5 contract. Same json_schema.
 */
import { getOpenAIKey, withOpenAiChatPrivacy } from "@/lib/openai";
import {
  GATE1_V2_JSON_SCHEMA,
  GATE1_V2_SYSTEM,
  buildGate25Contract,
} from "./contract";
import {
  ModelUnavailableError,
  resolveGate1V2Model,
  type Gate1V2Call,
} from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";

export { ModelUnavailableError, resolveGate1V2Model };
export type { Gate1V2Call };

export function buildUserPrompt(captureText: string, snapshot: string): string {
  return [
    buildGate25Contract(),
    "",
    "CURRENT TRUTH SNAPSHOT",
    snapshot,
    "",
    "RAW CAPTURE",
    captureText,
  ].join("\n");
}

export async function interpretOnce(args: {
  captureText: string;
  snapshot: string;
}): Promise<Gate1V2Call> {
  const key = getOpenAIKey();
  if (!key) {
    throw new ModelUnavailableError("OPENAI_API_KEY is not configured.");
  }
  const requestedModel = resolveGate1V2Model();
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      withOpenAiChatPrivacy({
        model: requestedModel,
        response_format: {
          type: "json_schema",
          json_schema: GATE1_V2_JSON_SCHEMA,
        },
        messages: [
          { role: "system", content: GATE1_V2_SYSTEM },
          { role: "user", content: buildUserPrompt(args.captureText, args.snapshot) },
        ],
      }),
    ),
  });
  const latencyMs = Date.now() - started;
  const detail = await response.text();
  if (!response.ok) {
    throw new ModelUnavailableError(
      `${requestedModel} failed (${response.status}): ${detail.slice(0, 800)}`,
    );
  }
  const data = JSON.parse(detail) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const responseModel = data.model?.trim() || "";
  if (!responseModel) {
    throw new ModelUnavailableError("Provider returned no response.model.");
  }
  const requestedFamily = requestedModel.toLowerCase();
  if (
    requestedFamily.includes("astra") &&
    !responseModel.toLowerCase().includes("astra")
  ) {
    throw new ModelUnavailableError(
      `Refusing silent substitution. Requested ${requestedModel}, got ${responseModel}.`,
    );
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Model returned an empty body");
  }
  return {
    requestedModel,
    responseModel,
    raw: JSON.parse(content),
    responseText: content,
    latencyMs,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens,
        }
      : null,
  };
}
