/**
 * Tell Me answer engine — grounded recall. AI only on explicit ask.
 */
import { knowledgeHasContent } from "@/lib/knowledge";
import { getOpenAIKey, isOpenAIConfigured } from "@/lib/openai";
import { buildTellMeContext } from "@/lib/tell-me/context";
import {
  assessFreshness,
  questionImpliesLatest,
} from "@/lib/tell-me/freshness";
import {
  ownershipTopicTokens,
  questionLooksOwnership,
  recordMentionsOwnershipOfTopic,
} from "@/lib/tell-me/question-shape";
import { questionLooksAdvisory } from "@/lib/tell-me/scope";
import type { MissionState } from "@/lib/types";
import type {
  ProjectIntelligenceSnapshot,
  TellMeAnswer,
  TellMeAnswerConfidence,
  TellMeConversationTurn,
  TellMeSourceRef,
} from "@/lib/tell-me/types";

const TELL_ME_SYSTEM = `You are Tell Me for Lume — a project memory recall assistant for project managers.

You answer questions using ONLY the provided project records and snapshot.
You are READ-ONLY. Never create, update, or delete project state.
Never invent approvals, owners, dates, or decisions that are not evidenced.

Response JSON schema:
{
  "answer": string,
  "confidence": "direct_confirmation" | "related_context" | "not_found" | "inference",
  "sourceIds": string[],
  "capturePrefill": string | null
}

Rules:
- Prefer short, direct answers. Add supporting detail only when useful.
- If evidence is missing, say you can't find confirmation.
- If related outstanding work exists (e.g. awaiting approval), say so without inventing the approval.
- Distinguish recorded fact from inference. Inference must be labelled in the prose.
- Ownership: only state an owner when a record explicitly assigns that exact responsibility. Do not broaden one ownership into another (UX ≠ security; discussion ≠ ownership; BA cover ≠ scope approval; vendor contact ≠ commercial approval). If no exact owner is recorded, say so — do not guess.
- Current vs history: for current-state questions, prefer Current position / Decisions over older History or superseded risk notes. Keep historical facts for historical questions.
- Epistemic status: informal, unofficial, suggested, rumoured, assumed, or casually mentioned items are not official/confirmed/approved fact. Answer "official / confirmed?" questions with the status first.
- Preserve qualifications in evidence (only / not / require / unconfirmed / informal) — never drop them when answering.
- Recent conversation is for continuity and reference resolution only. It is not project evidence. Previous assistant answers may be wrong and must not override or establish owners, dates, decisions, or approvals. Project records remain authoritative.
- For advisory "what should I do" questions, give factual context only and set confidence accordingly; the product may hand off to Coach.
- Do not expose chain-of-thought.
- Cite sourceIds from the evidence ids provided in brackets like [id].`;

/** Exported for verification — keep in sync with TELL_ME_SYSTEM above. */
export const TELL_ME_CONVERSATION_AUTHORITY_MARKER =
  "Recent conversation is for continuity and reference resolution only";

export async function answerTellMeQuestion(args: {
  question: string;
  state: MissionState;
  selectedProjectId?: string | null;
  snapshot?: ProjectIntelligenceSnapshot | null;
  conversation?: TellMeConversationTurn[];
  userDisplayName?: string | null;
}): Promise<TellMeAnswer> {
  const question = args.question.trim();
  const bundle = buildTellMeContext({
    state: args.state,
    question,
    selectedProjectId: args.selectedProjectId,
    snapshot: args.snapshot,
  });

  const freshness = assessFreshness({
    state: args.state,
    projectId: bundle.scope.projectId,
    snapshot: bundle.snapshot,
  });

  const empty = isProjectEmpty(args.state, bundle.scope.projectId);
  if (empty && bundle.scope.mode === "project") {
    return {
      answer:
        "Lume doesn’t know much about this project yet.\n\nUse Capture to tell me what’s happening, and I’ll be able to answer more useful questions.",
      confidence: "not_found",
      sources: [],
      scope: {
        mode: bundle.scope.mode,
        projectId: bundle.scope.projectId,
        projectCode: bundle.scope.projectCode,
        projectName: bundle.scope.projectName,
      },
      freshness,
      refreshRecommended: false,
      refreshReason: null,
      coachHandoff: false,
      capturePrefill: null,
      usage: null,
      model: null,
      provider: "local",
      contextStats: {
        projectsConsidered: bundle.scope.projectIdsForDeepContext.length,
        recordsSelected: 0,
        snapshotUsed: false,
        knowledgeItems: 0,
        structuredItems: 0,
        approxChars: 0,
      },
    };
  }

  const latestQuestion = questionImpliesLatest(question);
  const refreshRecommended =
    Boolean(bundle.snapshot) &&
    freshness.isStale &&
    (latestQuestion || freshness.changeCountHint >= 2);

  // Structured fast path for simple open-risks style questions (still may use AI for tone when configured)
  if (!isOpenAIConfigured()) {
    return localGroundedAnswer({
      question,
      bundle,
      freshness,
      refreshRecommended,
      state: args.state,
    });
  }

  const key = getOpenAIKey();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const conversation = (args.conversation ?? []).slice(-6);

  const userContent = [
    bundle.promptBlock,
    "",
    `FRESHNESS: ${freshness.isStale ? "STALE snapshot vs live records" : "aligned or no snapshot"}`,
    freshness.message ? `NOTE: ${freshness.message}` : "",
    refreshRecommended
      ? "If the user asked for latest/current position and live records are incomplete for synthesis, say you can answer from what you know but recommend Refresh Lume — do not pretend certainty."
      : "",
    conversation.length
      ? `RECENT TURNS:\n${conversation.map((t) => `${t.role}: ${t.content}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

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
        { role: "system", content: TELL_ME_SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Tell Me failed (${response.status}): ${detail}`);
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
    throw new Error("Tell Me returned an empty response");
  }

  let parsed: {
    answer?: string;
    confidence?: TellMeAnswerConfidence;
    sourceIds?: string[];
    capturePrefill?: string | null;
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    throw new Error("Tell Me returned a malformed response");
  }

  const sources = pickSources(bundle.sourceCatalogue, parsed.sourceIds ?? [], {
    confidence: normaliseConfidence(parsed.confidence),
    question,
  });
  const coachHandoff = questionLooksAdvisory(question);

  let answerText =
    typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : "I couldn’t form a reliable answer from the project records I have.";

  if (coachHandoff) {
    answerText +=
      "\n\nThis sounds like a coaching question — Ask Coach if you want advice on what to do next.";
  }

  const knowledgeItems = bundle.contexts.reduce(
    (n, c) => n + c.knowledge.length,
    0,
  );
  const structuredItems = Math.max(0, bundle.recordsSelected - knowledgeItems);

  return {
    answer: answerText,
    confidence: normaliseConfidence(parsed.confidence),
    sources,
    scope: {
      mode: bundle.scope.mode,
      projectId: bundle.scope.projectId,
      projectCode: bundle.scope.projectCode,
      projectName: bundle.scope.projectName,
    },
    freshness,
    refreshRecommended,
    refreshReason: refreshRecommended
      ? freshness.changeCountHint > 0
        ? `${freshness.changeCountHint} project change${freshness.changeCountHint === 1 ? "" : "s"} since the last refresh.`
        : "Project information has changed since the last refresh."
      : null,
    coachHandoff,
    capturePrefill:
      typeof parsed.capturePrefill === "string" ? parsed.capturePrefill : null,
    usage: data.usage ?? null,
    model,
    provider: "openai",
    contextStats: {
      projectsConsidered: bundle.scope.projectIdsForDeepContext.length || 1,
      recordsSelected: bundle.recordsSelected,
      snapshotUsed: Boolean(bundle.snapshot),
      knowledgeItems,
      structuredItems,
      approxChars: bundle.approxChars,
    },
  };
}

function normaliseConfidence(
  value: TellMeAnswerConfidence | undefined,
): TellMeAnswerConfidence {
  if (
    value === "direct_confirmation" ||
    value === "related_context" ||
    value === "not_found" ||
    value === "inference"
  ) {
    return value;
  }
  return "related_context";
}

/**
 * Select evidence that actually supports the answer.
 * Never fall back to arbitrary catalogue records.
 */
export function pickSources(
  catalogue: TellMeSourceRef[],
  ids: string[],
  opts?: {
    confidence?: TellMeAnswerConfidence;
    question?: string;
  },
): TellMeSourceRef[] {
  const byId = new Map(catalogue.map((s) => [s.id, s]));
  const picked: TellMeSourceRef[] = [];
  for (const id of ids) {
    const hit = byId.get(id);
    if (hit) picked.push(hit);
  }

  if (opts?.confidence === "not_found") {
    // Unsupported answers must not cite unrelated project records.
    return [];
  }

  if (picked.length) {
    if (opts?.question) {
      return filterRelevantSources(picked, opts.question).slice(0, 6);
    }
    return picked.slice(0, 6);
  }

  // No model-cited ids — do not invent evidence from the catalogue.
  return [];
}

function relevanceTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

/** Keep sources that share meaningful tokens with the question/answer topic. */
export function filterRelevantSources(
  sources: TellMeSourceRef[],
  question: string,
): TellMeSourceRef[] {
  const qTokens = new Set(relevanceTokens(question));
  if (!qTokens.size) return sources;
  const scored = sources
    .map((s) => {
      const hay = relevanceTokens(`${s.label} ${s.detail ?? ""}`);
      const overlap = hay.filter((t) => qTokens.has(t)).length;
      return { s, overlap };
    })
    .filter((row) => row.overlap > 0);
  if (!scored.length) return [];
  return scored.sort((a, b) => b.overlap - a.overlap).map((row) => row.s);
}

function isProjectEmpty(state: MissionState, projectId: string | null): boolean {
  if (!projectId) return state.projects.length === 0;
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  const hasKnowledge = knowledge ? knowledgeHasContent(knowledge) : false;
  const hasTodos = state.todos.some((t) => t.projectId === projectId);
  const hasTimeline = state.timeline.some((t) => t.projectId === projectId);
  const hasHistory = (state.history ?? []).some((h) => h.projectId === projectId);
  return !hasKnowledge && !hasTodos && !hasTimeline && !hasHistory;
}

function localGroundedAnswer(args: {
  question: string;
  bundle: ReturnType<typeof buildTellMeContext>;
  freshness: TellMeAnswer["freshness"];
  refreshRecommended: boolean;
  state: MissionState;
}): TellMeAnswer {
  const q = args.question.toLowerCase();
  const sources: TellMeSourceRef[] = [];
  let answer = "";
  let confidence: TellMeAnswerConfidence = "not_found";

  const knowledge = args.bundle.contexts.flatMap((c) => c.knowledge);
  const todos = args.bundle.contexts.flatMap((c) => c.todos);
  const risks = args.bundle.contexts.flatMap((c) => c.risks);

  if (questionLooksOwnership(args.question)) {
    const topic = ownershipTopicTokens(args.question);
    const pool = [...knowledge, ...todos];
    const hit = pool.find((k) =>
      recordMentionsOwnershipOfTopic(`${k.title} ${k.summary ?? ""}`, topic),
    );
    if (hit) {
      answer = hit.summary ? `${hit.title}. ${hit.summary}` : hit.title;
      confidence = "direct_confirmation";
      sources.push({
        id: hit.id,
        kind: hit.type.startsWith("knowledge") ? "knowledge" : "todo",
        label: hit.title,
        projectId: args.bundle.scope.projectId,
        projectCode: args.bundle.scope.projectCode,
      });
    } else {
      answer =
        "I don't have a confirmed owner for that in the project records.";
      confidence = "not_found";
    }
  }

  if (!answer && /risk/.test(q)) {
    if (!risks.length && !knowledge.some((k) => /risk/i.test(k.title))) {
      answer = "I can’t find open risks recorded for this scope.";
      confidence = "not_found";
    } else {
      const lines = [
        ...risks.map((r) => r.title),
        ...knowledge.filter((k) => /risk/i.test(k.title)).map((k) => k.title),
      ].slice(0, 8);
      answer = `Open risks I can see:\n${lines.map((l) => `• ${l}`).join("\n")}`;
      confidence = "direct_confirmation";
      for (const r of risks.slice(0, 4)) {
        sources.push({
          id: r.id,
          kind: "risk",
          label: r.title,
          projectId: args.bundle.scope.projectId,
          projectCode: args.bundle.scope.projectCode,
        });
      }
    }
  }

  if (!answer && /waiting|chase/.test(q)) {
    const waiting = todos.filter((t) =>
      /waiting|chase/i.test(`${t.title} ${t.summary ?? ""}`),
    );
    const fromState = args.state.todos.filter(
      (t) =>
        (!args.bundle.scope.projectId ||
          t.projectId === args.bundle.scope.projectId) &&
        !t.done &&
        (Boolean(t.waitingOn?.trim()) ||
          t.kind === "WAITING" ||
          t.kind === "CHASE"),
    );
    const list = fromState.length
      ? fromState
      : waiting.map((t) => ({
          id: t.id,
          title: t.title,
          waitingOn: t.summary,
        }));
    if (!list.length) {
      answer = "I can’t find anything currently recorded as waiting on someone.";
      confidence = "not_found";
    } else {
      answer = list
        .slice(0, 8)
        .map(
          (t) =>
            `• ${"waitingOn" in t && t.waitingOn ? `${t.title} (waiting on ${t.waitingOn})` : t.title}`,
        )
        .join("\n");
      confidence = "direct_confirmation";
    }
  }

  if (!answer && /approv|finance|budget/.test(q)) {
    const outstanding = [
      ...knowledge,
      ...todos,
    ].find((r) => /finance|budget|approv/i.test(`${r.title} ${r.summary ?? ""}`));
    if (outstanding) {
      answer = `I can’t find confirmation of approval. ${outstanding.title} is still recorded in project intelligence.`;
      confidence = "related_context";
      sources.push({
        id: outstanding.id,
        kind: "knowledge",
        label: outstanding.title,
        projectId: args.bundle.scope.projectId,
        projectCode: args.bundle.scope.projectCode,
      });
    } else {
      answer = "I can’t find confirmation that Finance has approved the budget.";
      confidence = "not_found";
    }
  }

  if (!answer) {
    answer =
      "I couldn’t find a grounded answer in the project records available without AI. Add an OpenAI key for fuller Tell Me answers, or ask a more specific question about risks, waiting items, or knowledge.";
    confidence = "not_found";
  }

  return {
    answer,
    confidence,
    sources:
      confidence === "not_found"
        ? []
        : filterRelevantSources(sources, args.question).slice(0, 6),
    scope: {
      mode: args.bundle.scope.mode,
      projectId: args.bundle.scope.projectId,
      projectCode: args.bundle.scope.projectCode,
      projectName: args.bundle.scope.projectName,
    },
    freshness: args.freshness,
    refreshRecommended: args.refreshRecommended,
    refreshReason: args.refreshRecommended
      ? args.freshness.message
      : null,
    coachHandoff: questionLooksAdvisory(args.question),
    capturePrefill: null,
    usage: null,
    model: null,
    provider: "local",
    contextStats: {
      projectsConsidered: args.bundle.scope.projectIdsForDeepContext.length || 1,
      recordsSelected: args.bundle.recordsSelected,
      snapshotUsed: Boolean(args.bundle.snapshot),
      knowledgeItems: args.bundle.contexts.reduce(
        (n, c) => n + c.knowledge.length,
        0,
      ),
      structuredItems: args.bundle.recordsSelected,
      approxChars: args.bundle.approxChars,
    },
  };
}
