import { getOpenAIKey } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { buildObservationExtractionPrompt } from "./prompt";

export type ObservationExtractionCall = {
  rawModelJson: unknown;
  responseText: string;
  model: string;
  providerUsage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
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

export async function extractObservationsWithOpenAI(args: {
  transcript: string;
  projectBlock: string;
}): Promise<ObservationExtractionCall> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const model = resolveOpenAIChatModel();
  const prompt = buildObservationExtractionPrompt({
    transcript: args.transcript,
    projectBlock: args.projectBlock,
  });

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
            "You extract atomic project observations as JSON. You do not mutate a database. You never invent record IDs.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI capture V2 failed (${response.status}): ${detail}`);
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
    throw new Error("OpenAI returned an empty observation response");
  }

  return {
    rawModelJson: parseJsonObject(content),
    responseText: content,
    model,
    providerUsage: data.usage ?? null,
  };
}
