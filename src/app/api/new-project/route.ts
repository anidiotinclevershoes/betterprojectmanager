import { NextResponse } from "next/server";
import {
  assembleFromInterview,
  suggestCode,
  type CreateProjectInput,
  type InterviewAnswers,
} from "@/lib/create-project";
import { getOpenAIKey, isOpenAIConfigured } from "@/lib/openai";

export const runtime = "nodejs";

type Body = {
  answers: InterviewAnswers;
  kind?: "delivery" | "release_ops";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body?.answers || typeof body.answers !== "object") {
      return NextResponse.json({ error: "Missing answers." }, { status: 400 });
    }

    const kind = body.kind ?? "delivery";
    const local = assembleFromInterview(body.answers, kind);

    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        draft: local,
        provider: "local" as const,
        openaiConfigured: false,
      });
    }

    try {
      const draft = await assembleWithOpenAI(body.answers, kind, local);
      return NextResponse.json({
        draft,
        provider: "openai" as const,
        openaiConfigured: true,
      });
    } catch {
      return NextResponse.json({
        draft: local,
        provider: "local" as const,
        openaiConfigured: true,
        note: "OpenAI assemble failed — used local parse.",
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not assemble project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function assembleWithOpenAI(
  answers: InterviewAnswers,
  kind: "delivery" | "release_ops",
  fallback: CreateProjectInput,
): Promise<CreateProjectInput> {
  const key = getOpenAIKey();
  const prompt = `You turn interview answers into a Mission Control project draft.

Return ONLY valid JSON with this shape:
{
  "name": string,
  "code": string (2-8 chars, uppercase),
  "summary": string,
  "kind": "delivery" | "release_ops",
  "currentFocus": string,
  "nextMilestone": string | null,
  "nextMilestoneAt": "YYYY-MM-DD" | null,
  "stakeholders": [{"name": string, "role": string, "concerns": string[]}],
  "knowledgeNow": string[],
  "knowledgeRisks": string[],
  "knowledgePeople": string[],
  "knowledgeOpenLoops": string[],
  "knowledgeDecisions": string[]
}

Rules:
- Do not invent people, dates, or risks that are not in the answers.
- Prefer short, concrete bullets.
- code should be a useful tab label.
- kind defaults to "${kind}".

ANSWERS JSON:
${JSON.stringify(answers, null, 2)}

LOCAL FALLBACK (improve; do not ignore real facts from answers):
${JSON.stringify(fallback, null, 2)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured project setup data for a PM coaching app. Never invent facts.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI assemble failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty assemble response");

  const parsed = JSON.parse(raw) as Partial<CreateProjectInput>;
  return {
    name: String(parsed.name || fallback.name).trim(),
    code: String(parsed.code || fallback.code || suggestCode(fallback.name))
      .trim()
      .toUpperCase()
      .slice(0, 12),
    summary: String(parsed.summary || fallback.summary || "").trim(),
    kind: parsed.kind === "release_ops" ? "release_ops" : kind,
    currentFocus: String(
      parsed.currentFocus || fallback.currentFocus || "",
    ).trim(),
    nextMilestone:
      parsed.nextMilestone === null
        ? undefined
        : String(parsed.nextMilestone || fallback.nextMilestone || "").trim() ||
          undefined,
    nextMilestoneAt:
      parsed.nextMilestoneAt === null
        ? undefined
        : String(parsed.nextMilestoneAt || fallback.nextMilestoneAt || "").trim() ||
          undefined,
    stakeholders: Array.isArray(parsed.stakeholders)
      ? parsed.stakeholders
          .map((s) => ({
            name: String(s?.name ?? "").trim(),
            role: String(s?.role ?? "Stakeholder").trim(),
            concerns: Array.isArray(s?.concerns)
              ? s.concerns.map((c) => String(c).trim()).filter(Boolean)
              : undefined,
          }))
          .filter((s) => s.name)
      : fallback.stakeholders,
    knowledgeNow: asStringArray(parsed.knowledgeNow) ?? fallback.knowledgeNow,
    knowledgeRisks:
      asStringArray(parsed.knowledgeRisks) ?? fallback.knowledgeRisks,
    knowledgePeople:
      asStringArray(parsed.knowledgePeople) ?? fallback.knowledgePeople,
    knowledgeOpenLoops:
      asStringArray(parsed.knowledgeOpenLoops) ?? fallback.knowledgeOpenLoops,
    knowledgeDecisions:
      asStringArray(parsed.knowledgeDecisions) ?? fallback.knowledgeDecisions,
  };
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((v) => String(v).trim()).filter(Boolean);
}
