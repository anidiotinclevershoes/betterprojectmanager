/**
 * One-call Astra interpreter. No preprocess, verify, repair, or fallback call.
 */
import { getOpenAIKey, withOpenAiChatPrivacy } from "@/lib/openai";
import {
  GATE1_ASTRA_MODEL,
  type Gate1Interpretation,
  type Gate1Observation,
  GATE1_DOMAINS,
  GATE1_REFERENCE_KINDS,
} from "./types";
import {
  GATE1_JSON_SCHEMA,
  GATE1_SYSTEM_MESSAGE,
  buildInterpretationContract,
} from "./contract";

export class AstraUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AstraUnavailableError";
  }
}

export type Gate1ModelCall = {
  requestedModel: typeof GATE1_ASTRA_MODEL;
  responseModel: string;
  interpretation: Gate1Interpretation;
  responseText: string;
  latencyMs: number;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
  } | null;
};

function isDomain(value: unknown): value is Gate1Observation["domain"] {
  return (
    typeof value === "string" &&
    (GATE1_DOMAINS as readonly string[]).includes(value)
  );
}

function isReferenceKind(
  value: unknown,
): value is Gate1Observation["referenceKind"] {
  return (
    typeof value === "string" &&
    (GATE1_REFERENCE_KINDS as readonly string[]).includes(value)
  );
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Schema-validate model JSON. Do not repair or reinterpret English.
 */
export function parseInterpretation(raw: unknown): Gate1Interpretation {
  if (!raw || typeof raw !== "object") {
    throw new Error("Astra output was not a JSON object");
  }
  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.observations)) {
    throw new Error("Astra output missing observations[]");
  }
  const observations: Gate1Observation[] = row.observations.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Observation ${index} was not an object`);
    }
    const obs = item as Record<string, unknown>;
    if (!isDomain(obs.domain)) {
      throw new Error(`Observation ${index} has invalid domain`);
    }
    if (typeof obs.subject !== "string" || !obs.subject.trim()) {
      throw new Error(`Observation ${index} missing subject`);
    }
    if (!isReferenceKind(obs.referenceKind)) {
      throw new Error(`Observation ${index} has invalid referenceKind`);
    }
    if (typeof obs.assertion !== "string" || !obs.assertion.trim()) {
      throw new Error(`Observation ${index} missing assertion`);
    }
    if (typeof obs.evidence !== "string" || !obs.evidence.trim()) {
      throw new Error(`Observation ${index} missing evidence`);
    }
    const referenced = asNullableString(obs.referencedCanonicalId);
    return {
      domain: obs.domain,
      subject: obs.subject.trim(),
      referencedCanonicalId: referenced,
      referenceKind: obs.referenceKind,
      assertion: obs.assertion.trim(),
      proposedValue: asNullableString(obs.proposedValue),
      evidence: obs.evidence.trim(),
      ambiguity: asNullableString(obs.ambiguity),
    };
  });
  return {
    observations,
    overallUncertainty: asNullableString(row.overallUncertainty),
  };
}

export function buildUserPrompt(args: {
  captureText: string;
  snapshot: string;
}): string {
  return [
    buildInterpretationContract(),
    "",
    "CANONICAL SNAPSHOT",
    args.snapshot,
    "",
    "RAW CAPTURE",
    args.captureText,
  ].join("\n");
}

export async function interpretCaptureWithAstra(args: {
  captureText: string;
  snapshot: string;
}): Promise<Gate1ModelCall> {
  const key = getOpenAIKey();
  if (!key) {
    throw new AstraUnavailableError(
      "OPENAI_API_KEY is not configured. Cannot call gpt-6-astra.",
    );
  }

  const userPrompt = buildUserPrompt(args);
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      withOpenAiChatPrivacy({
        model: GATE1_ASTRA_MODEL,
        response_format: {
          type: "json_schema",
          json_schema: GATE1_JSON_SCHEMA,
        },
        messages: [
          { role: "system", content: GATE1_SYSTEM_MESSAGE },
          { role: "user", content: userPrompt },
        ],
      }),
    ),
  });
  const latencyMs = Date.now() - started;
  const detail = await response.text();

  if (!response.ok) {
    const snippet = detail.slice(0, 800);
    if (response.status === 404 || /model_not_found|does not exist|not found/i.test(detail)) {
      throw new AstraUnavailableError(
        `gpt-6-astra was not available (${response.status}): ${snippet}`,
      );
    }
    if (response.status === 403 || /does not have access|not allowed/i.test(detail)) {
      throw new AstraUnavailableError(
        `This OpenAI key cannot use gpt-6-astra (${response.status}): ${snippet}`,
      );
    }
    throw new AstraUnavailableError(
      `Astra call failed (${response.status}): ${snippet}`,
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
  const responseModel = data.model?.trim() ?? "";
  if (!responseModel) {
    throw new AstraUnavailableError(
      "OpenAI returned no response.model; refusing to treat an unknown model as Astra.",
    );
  }
  if (!responseModel.toLowerCase().includes("astra")) {
    throw new AstraUnavailableError(
      `Refusing silent substitution. Requested gpt-6-astra, provider returned ${responseModel}.`,
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Astra returned an empty interpretation");
  }

  return {
    requestedModel: GATE1_ASTRA_MODEL,
    responseModel,
    interpretation: parseInterpretation(JSON.parse(content)),
    responseText: content,
    latencyMs,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          reasoning_tokens:
            data.usage.completion_tokens_details?.reasoning_tokens,
        }
      : null,
  };
}
