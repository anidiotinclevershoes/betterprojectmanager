import { NextResponse } from "next/server";
import {
  assembleFromInterview,
  assembleFromNarrative,
  suggestCode,
  type CreateProjectInput,
  type InterviewAnswers,
} from "@/lib/create-project";
import { getOpenAIKey, isOpenAIConfigured } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { requireAiCaller } from "@/lib/ai-gate";
import { isProductionRuntime } from "@/lib/runtime-config";

export const runtime = "nodejs";

type Body = {
  /** Free-form Talk / Paste narrative — preferred path. */
  content?: string;
  sourceMode?: "talk" | "paste";
  /** Legacy interview answers. */
  answers?: InterviewAnswers;
  kind?: "delivery" | "release_ops";
};

export async function POST(request: Request) {
  try {
    const gate = await requireAiCaller("new-project");
    if (!gate.ok) return gate.response;

    const body = (await request.json()) as Body;
    const kind = body.kind ?? "delivery";

    if (typeof body.content === "string" && body.content.trim()) {
      const sourceMode = body.sourceMode === "talk" ? "talk" : "paste";
      const local = assembleFromNarrative(body.content, kind, sourceMode);

      if (!isOpenAIConfigured()) {
        if (isProductionRuntime()) {
          return NextResponse.json(
            { error: "AI is not configured for this environment." },
            { status: 503 },
          );
        }
        return NextResponse.json({
          draft: local,
          provider: "local" as const,
          openaiConfigured: false,
        });
      }

      try {
        const draft = await assembleNarrativeWithOpenAI(
          body.content,
          kind,
          sourceMode,
          local,
        );
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
    }

    if (!body?.answers || typeof body.answers !== "object") {
      return NextResponse.json(
        { error: "Provide content or interview answers." },
        { status: 400 },
      );
    }

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

async function assembleNarrativeWithOpenAI(
  content: string,
  kind: "delivery" | "release_ops",
  sourceMode: "talk" | "paste",
  fallback: CreateProjectInput,
): Promise<CreateProjectInput> {
  const key = getOpenAIKey();
  const prompt = `You extract a Lume project setup draft from free-form PM notes or speech.

Return ONLY valid JSON with this shape:
{
  "name": string,
  "code": string (2-8 chars, uppercase),
  "summary": string,
  "kind": "delivery" | "release_ops",
  "currentFocus": string,
  "nextMilestone": string | null,
  "nextMilestoneAt": "YYYY-MM-DD" | null,
  "stakeholders": [{"name": string, "role": string, "concerns": string[], "needsReview": boolean}],
  "todos": [{"title": string, "dueAt": "YYYY-MM-DD"|null, "kind": "ACTION"|"WAITING"|"CHASE"|"REMINDER", "waitingOn": string|null, "needsReview": boolean}],
  "risks": [{"title": string, "needsReview": boolean}],
  "importantDates": [{"label": string, "date": "YYYY-MM-DD"|null, "needsReview": boolean}],
  "knowledgeRemember": [{"text": string, "remember": true}],
  "knowledgeNow": string[],
  "knowledgeRisks": string[],
  "knowledgePeople": string[],
  "knowledgeOpenLoops": string[],
  "knowledgeDecisions": string[],
  "notMentioned": string[]
}

Rules:
- Do NOT invent people, dates, risks, tasks or knowledge not evidenced in the source.
- Knowledge = durable project context (rules, preferences, constraints) — not transient events.
- Prefer short concrete bullets.
- Mark needsReview when role/date/risk is uncertain.
- kind defaults to "${kind}".

SOURCE (${sourceMode}):
"""
${content.slice(0, 12000)}
"""

LOCAL FALLBACK (improve; keep real facts):
${JSON.stringify(fallback, null, 2)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAIChatModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured project setup data for a PM coaching app. Never invent facts. Preserve useful Knowledge overlap.",
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
  return normalizeDraft(JSON.parse(raw) as Partial<CreateProjectInput>, {
    ...fallback,
    sourceMode,
    sourceNarrative: content,
  });
}

async function assembleWithOpenAI(
  answers: InterviewAnswers,
  kind: "delivery" | "release_ops",
  fallback: CreateProjectInput,
): Promise<CreateProjectInput> {
  const key = getOpenAIKey();
  const prompt = `You turn interview answers into a Lume project draft.

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
      model: resolveOpenAIChatModel(),
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

  return normalizeDraft(JSON.parse(raw) as Partial<CreateProjectInput>, {
    ...fallback,
    sourceMode: "interview",
  });
}

function normalizeDraft(
  parsed: Partial<CreateProjectInput>,
  fallback: CreateProjectInput,
): CreateProjectInput {
  const kind =
    parsed.kind === "release_ops"
      ? "release_ops"
      : (fallback.kind ?? "delivery");

  const stakeholders = Array.isArray(parsed.stakeholders)
    ? parsed.stakeholders
        .map((s) => ({
          name: String(s?.name ?? "").trim(),
          role: String(s?.role ?? "Stakeholder").trim(),
          concerns: Array.isArray(s?.concerns)
            ? s.concerns.map((c) => String(c).trim()).filter(Boolean)
            : undefined,
          needsReview: Boolean(s?.needsReview),
        }))
        .filter((s) => s.name)
    : fallback.stakeholders;

  const todos = Array.isArray(parsed.todos)
    ? parsed.todos
        .map((t) => ({
          title: String(t?.title ?? "").trim(),
          dueAt: t?.dueAt ? String(t.dueAt) : undefined,
          kind:
            t?.kind === "WAITING" ||
            t?.kind === "CHASE" ||
            t?.kind === "REMINDER" ||
            t?.kind === "ACTION"
              ? t.kind
              : ("ACTION" as const),
          waitingOn: t?.waitingOn ? String(t.waitingOn) : undefined,
          needsReview: Boolean(t?.needsReview),
        }))
        .filter((t) => t.title)
    : fallback.todos;

  const risks = Array.isArray(parsed.risks)
    ? parsed.risks
        .map((r) => ({
          title: String(r?.title ?? "").trim(),
          needsReview: Boolean(r?.needsReview),
        }))
        .filter((r) => r.title)
    : fallback.risks;

  const importantDates = Array.isArray(parsed.importantDates)
    ? parsed.importantDates
        .map((d) => ({
          label: String(d?.label ?? "").trim(),
          date: d?.date ? String(d.date) : undefined,
          needsReview: Boolean(d?.needsReview),
        }))
        .filter((d) => d.label)
    : fallback.importantDates;

  const knowledgeRemember = Array.isArray(parsed.knowledgeRemember)
    ? parsed.knowledgeRemember
        .map((k) => ({
          text: String(k?.text ?? "").trim(),
          remember: k?.remember !== false,
        }))
        .filter((k) => k.text)
    : fallback.knowledgeRemember;

  return {
    name: String(parsed.name || fallback.name).trim(),
    code: String(parsed.code || fallback.code || suggestCode(fallback.name))
      .trim()
      .toUpperCase()
      .slice(0, 12),
    summary: String(parsed.summary || fallback.summary || "").trim(),
    kind,
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
        : String(
            parsed.nextMilestoneAt || fallback.nextMilestoneAt || "",
          ).trim() || undefined,
    stakeholders,
    todos,
    risks,
    importantDates,
    knowledgeRemember,
    knowledgeNow: asStringArray(parsed.knowledgeNow) ?? fallback.knowledgeNow,
    knowledgeRisks:
      asStringArray(parsed.knowledgeRisks) ??
      risks?.map((r) => r.title) ??
      fallback.knowledgeRisks,
    knowledgePeople:
      asStringArray(parsed.knowledgePeople) ?? fallback.knowledgePeople,
    knowledgeOpenLoops:
      asStringArray(parsed.knowledgeOpenLoops) ?? fallback.knowledgeOpenLoops,
    knowledgeDecisions:
      asStringArray(parsed.knowledgeDecisions) ?? fallback.knowledgeDecisions,
    notMentioned:
      asStringArray(parsed.notMentioned) ?? fallback.notMentioned,
    sourceNarrative: fallback.sourceNarrative,
    sourceMode: fallback.sourceMode,
  };
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((v) => String(v).trim()).filter(Boolean);
}
