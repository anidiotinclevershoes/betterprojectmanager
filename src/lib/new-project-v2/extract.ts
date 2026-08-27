import { getOpenAIKey, withOpenAiChatPrivacy } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { buildNewProjectV2Prompt } from "./prompt";

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

export async function extractNewProjectV2WithOpenAI(content: string): Promise<{
  rawModelJson: unknown;
  responseText: string;
  model: string;
}> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const model = resolveOpenAIChatModel();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      withOpenAiChatPrivacy({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You organise messy project notes into a provisional JSON map. You do not persist anything.",
          },
          { role: "user", content: buildNewProjectV2Prompt(content) },
        ],
      }),
    ),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI new-project V2 failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned an empty new-project response");
  }
  return {
    rawModelJson: parseJsonObject(text),
    responseText: text,
    model,
  };
}
