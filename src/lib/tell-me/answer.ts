/**
 * Tell Me answer engine — grounded recall. AI only on explicit ask.
 */
import { knowledgeHasContent } from "@/lib/knowledge";
import { getOpenAIKey, isOpenAIConfigured } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { buildTellMeContext } from "@/lib/tell-me/context";
import {
  assessFreshness,
  questionImpliesLatest,
} from "@/lib/tell-me/freshness";
import {
  isFirstClassResponsibilitySource,
  ownershipTopicTokens,
  questionLooksCurrentRisk,
  questionLooksCurrentState,
  questionLooksHistorical,
  questionLooksOwnership,
  questionLooksScheduledDate,
  questionLooksTodoStatus,
  recordMentionsOwnershipOfTopic,
  RISK_AUTHORITY_KINDS,
  SCHEDULED_DATE_AUTHORITY_KINDS,
  TODO_AUTHORITY_KINDS,
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
import { findConfirmedOwners } from "@/lib/canonical-truth/confirm-responsibility";
import { isCanonicalTruthEnabled } from "@/lib/canonical-truth/flag";
import { isOpenRiskStatus } from "@/lib/risks/lifecycle";

export const TELL_ME_SYSTEM = `You are Tell Me for Lume — a project memory recall assistant for project managers.

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
- Scheduled dates (milestones, target dates, releases) are direct confirmation only from Milestones and Releases records. Knowledge or decision prose that mentions a date is related context, not a scheduled date record.
- Source authority: direct_confirmation requires first-class current domain records for that question (milestones/releases for scheduled dates; risk records for current risks; todos for todo/status; confirmed current responsibility for owners). Knowledge prose, history, and evidence may be related_context — they must not masquerade as first-class confirmed current truth.
- Epistemic status: informal, unofficial, suggested, rumoured, assumed, or casually mentioned items are not official/confirmed/approved fact. Answer "official / confirmed?" questions with the status first.
- Preserve qualifications in evidence (only / not / require / unconfirmed / informal) — never drop them when answering.
- Recent conversation is for continuity and reference resolution only. It is not project evidence. Previous assistant answers may be wrong and must not override or establish owners, dates, decisions, or approvals. Project records remain authoritative.
- For advisory "what should I do" questions, give factual context only and set confidence accordingly; the product may hand off to Coach.
- Do not expose chain-of-thought.
- Cite sourceIds from the evidence ids provided in brackets like [id].`;

/** Slice 1 canonical path — same trust rules + structured Answer / noticed / needsConfirmation. */
export const TELL_ME_SYSTEM_CANONICAL = `You are Tell Me for Lume — read-only project recall over AUTHORITATIVE PROJECT STATE.

You are READ-ONLY. Never create, update, or delete project state.
Never invent approvals, owners, dates, or decisions that are not evidenced.
Use only the canonical facts provided. Epistemic tags travel with facts (informal ≠ confirmed; legacy = unknown certainty).

Response JSON schema:
{
  "answer": string,
  "noticed": string[] | null,
  "needsConfirmation": Array<{ "id": string, "kind": "unknown_owner" | "conflict" | "ambiguity", "summary": string, "scope": string | null }> | null,
  "confidence": "direct_confirmation" | "related_context" | "not_found" | "inference",
  "sourceIds": string[],
  "capturePrefill": string | null
}

Rules:
- "answer" is required: direct, narrow, grounded.
- "noticed" is optional: useful supported implications/connections. Interpretation only — not new project truth.
- "needsConfirmation" is optional: only material gaps. Prefer the STORED AMBIGUITIES list when present. Do not invent owners or gaps from absence alone.
- Ownership: only state an owner when a responsibility fact explicitly assigns that exact scope (@Person → scope). Do not broaden (UX ≠ security).
- Current vs history: MODE:current excludes superseded; MODE:historical may include it.
- Scheduled dates (milestones, target dates, releases) are direct confirmation only from Milestones and Releases records. Knowledge or decision prose that mentions a date is related context, not a scheduled date record.
- Source authority: direct_confirmation requires first-class current domain records for that question (milestones/releases for scheduled dates; risk records for current risks; todos for todo/status; confirmed current responsibility for owners). Knowledge prose, history, and evidence may be related_context — they must not masquerade as first-class confirmed current truth.
- Epistemic: informal/suggested/unknown/legacy are not official confirmation.
- Preserve qualifications (only / not / unconfirmed / informal).
- Recent conversation is for continuity and reference resolution only. It is not project evidence. Previous assistant answers may be wrong and must not override or establish owners, dates, decisions, or approvals. Project records remain authoritative.
- For advisory "what should I do" questions, give factual context only and set confidence accordingly; the product may hand off to Coach.
- Do not expose chain-of-thought.
- Cite sourceIds from the evidence ids provided in brackets like [id].`;

/** Exported for verification — keep in sync with TELL_ME_SYSTEM above. */
export const TELL_ME_CONVERSATION_AUTHORITY_MARKER =
  "Recent conversation is for continuity and reference resolution only";

export const TELL_ME_SCHEDULED_DATE_AUTHORITY_MARKER =
  "Scheduled dates (milestones, target dates, releases) are direct confirmation only from Milestones and Releases records";

export const TELL_ME_SOURCE_AUTHORITY_MARKER =
  "Source authority: direct_confirmation requires first-class current domain records";

const SECONDARY_CONTEXT_KINDS = new Set([
  "knowledge",
  "history",
  "meeting",
  "capture",
  "snapshot",
]);

/**
 * Shared Ask source-authority boundary.
 *
 * First-class CURRENT domain authority may support direct_confirmation.
 * Secondary prose / history / evidence may support related_context
 * but must not masquerade as confirmed current truth.
 */
export function constrainAskConfidence(args: {
  question: string;
  confidence: TellMeAnswerConfidence;
  sources: TellMeSourceRef[];
}): TellMeAnswerConfidence {
  if (args.confidence !== "direct_confirmation") return args.confidence;

  const has = (kinds: Set<string>) =>
    args.sources.some((source) => kinds.has(source.kind));
  const onlySecondary =
    args.sources.length > 0 &&
    args.sources.every((source) => SECONDARY_CONTEXT_KINDS.has(source.kind));
  const onlyHistory =
    args.sources.length > 0 &&
    args.sources.every(
      (source) =>
        source.kind === "history" ||
        source.kind === "meeting" ||
        source.kind === "capture",
    );

  if (onlyHistory && !questionLooksHistorical(args.question)) {
    return "related_context";
  }

  if (questionLooksScheduledDate(args.question)) {
    return has(SCHEDULED_DATE_AUTHORITY_KINDS)
      ? args.confidence
      : "related_context";
  }

  if (questionLooksCurrentRisk(args.question)) {
    return has(RISK_AUTHORITY_KINDS) ? args.confidence : "related_context";
  }

  if (questionLooksOwnership(args.question)) {
    return args.sources.some(isFirstClassResponsibilitySource)
      ? args.confidence
      : "related_context";
  }

  if (questionLooksTodoStatus(args.question)) {
    return has(TODO_AUTHORITY_KINDS) ? args.confidence : "related_context";
  }

  if (onlySecondary && questionLooksCurrentState(args.question)) {
    return "related_context";
  }

  return args.confidence;
}

/**
 * Compatibility wrapper — scheduled-date questions use the shared
 * source-authority boundary.
 */
export function constrainScheduledDateConfidence(args: {
  question: string;
  confidence: TellMeAnswerConfidence;
  sources: TellMeSourceRef[];
}): TellMeAnswerConfidence {
  return constrainAskConfidence(args);
}

export async function answerTellMeQuestion(args: {
  question: string;
  state: MissionState;
  selectedProjectId?: string | null;
  snapshot?: ProjectIntelligenceSnapshot | null;
  conversation?: TellMeConversationTurn[];
  userDisplayName?: string | null;
  /** Eval/debug only — estimate prompt component tokens (tiktoken). */
  debugTokenBreakdown?: boolean;
  /** Slice 1: force canonical truth path. */
  useCanonicalTruth?: boolean;
}): Promise<TellMeAnswer> {
  const question = args.question.trim();
  const forEval = Boolean(args.debugTokenBreakdown);
  const useCanonical = isCanonicalTruthEnabled({
    forEval,
    explicit: args.useCanonicalTruth,
  });

  const bundle = buildTellMeContext({
    state: args.state,
    question,
    selectedProjectId: args.selectedProjectId,
    snapshot: args.snapshot,
    useCanonicalTruth: useCanonical,
    forEval,
  });

  const systemPrompt = bundle.usedCanonicalTruth
    ? TELL_ME_SYSTEM_CANONICAL
    : TELL_ME_SYSTEM;

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
      noticed: [],
      needsConfirmation: [],
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
      modelRequested: null,
      tokenBreakdown: null,
      usedCanonicalTruth: Boolean(bundle.usedCanonicalTruth),
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

  // Deterministic owners from confirmed structured responsibilities (Slice 1C/1D).
  // Supports multiple concurrent owners for the same scope — never invent exclusivity.
  if (questionLooksOwnership(question) && bundle.scope.projectId) {
    const knowledge = args.state.knowledge.find(
      (k) => k.projectId === bundle.scope.projectId,
    );
    const tokens = ownershipTopicTokens(question);
    for (const token of tokens) {
      const hits = findConfirmedOwners(knowledge, token);
      if (hits.length) {
        const names = hits.map((h) => h.personName);
        const scopeLabel = hits[0]!.scope;
        const answerText =
          names.length === 1
            ? `${names[0]} owns ${scopeLabel}.`
            : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} own ${scopeLabel}.`;
        const ownerSources = hits.map((hit) => ({
          id: hit.item.id,
          kind: "knowledge" as const,
          label: hit.item.body,
          projectId: bundle.scope.projectId,
          projectCode: bundle.scope.projectCode,
          detail: "confirmed responsibility",
        }));
        return {
          answer: answerText,
          confidence: constrainAskConfidence({
            question,
            confidence: "direct_confirmation",
            sources: ownerSources,
          }),
          sources: ownerSources,
          noticed: [],
          needsConfirmation: [],
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
          modelRequested: null,
          tokenBreakdown: null,
          usedCanonicalTruth: Boolean(bundle.usedCanonicalTruth),
          provider: "local",
          contextStats: {
            projectsConsidered: 1,
            recordsSelected: bundle.recordsSelected,
            snapshotUsed: false,
            knowledgeItems: hits.length,
            structuredItems: hits.length,
            approxChars: bundle.approxChars,
          },
        };
      }
    }
  }

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
  const modelRequested = resolveOpenAIChatModel({
    forEval: Boolean(args.debugTokenBreakdown),
  });
  const conversation = (args.conversation ?? []).slice(-6);

  const freshnessBlock = [
    `FRESHNESS: ${freshness.isStale ? "STALE snapshot vs live records" : "aligned or no snapshot"}`,
    freshness.message ? `NOTE: ${freshness.message}` : "",
    refreshRecommended
      ? "If the user asked for latest/current position and live records are incomplete for synthesis, say you can answer from what you know but recommend Refresh Lume — do not pretend certainty."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const conversationBlock = conversation.length
    ? `RECENT TURNS:\n${conversation.map((t) => `${t.role}: ${t.content}`).join("\n")}`
    : "";

  const userContent = [bundle.promptBlock, "", freshnessBlock, conversationBlock]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelRequested,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
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
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Tell Me returned an empty response");
  }

  let parsed: {
    answer?: string;
    noticed?: string[] | null;
    needsConfirmation?: TellMeAnswer["needsConfirmation"];
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

  const modelResolved = data.model ?? modelRequested;

  let tokenBreakdown: TellMeAnswer["tokenBreakdown"] = undefined;
  if (args.debugTokenBreakdown) {
    const { estimateLumeTokenBreakdown } = await import(
      "@/lib/evals/token-breakdown"
    );
    tokenBreakdown = estimateLumeTokenBreakdown({
      systemPrompt,
      promptBlock: bundle.promptBlock,
      conversationBlock,
      freshnessBlock,
      apiUsage: data.usage ?? null,
    });
  }

  const noticed = Array.isArray(parsed.noticed)
    ? parsed.noticed
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim())
    : [];

  const needsConfirmation = mergeNeedsConfirmation(
    Array.isArray(parsed.needsConfirmation) ? parsed.needsConfirmation : [],
    bundle.needsConfirmationHints ?? [],
  );

  const confidence = constrainAskConfidence({
    question,
    confidence: normaliseConfidence(parsed.confidence),
    sources,
  });

  return {
    answer: answerText,
    confidence,
    sources,
    noticed,
    needsConfirmation,
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
    model: modelResolved,
    modelRequested,
    provider: "openai",
    tokenBreakdown: tokenBreakdown ?? null,
    usedCanonicalTruth: Boolean(bundle.usedCanonicalTruth),
    contextStats: {
      projectsConsidered: bundle.scope.projectIdsForDeepContext.length || 1,
      recordsSelected: bundle.recordsSelected,
      snapshotUsed: Boolean(bundle.snapshot),
      knowledgeItems: bundle.usedCanonicalTruth
        ? bundle.recordsSelected
        : knowledgeItems,
      structuredItems: bundle.usedCanonicalTruth
        ? bundle.recordsSelected
        : structuredItems,
      approxChars: bundle.approxChars,
    },
  };
}

function mergeNeedsConfirmation(
  fromModel: NonNullable<TellMeAnswer["needsConfirmation"]>,
  hints: NonNullable<TellMeAnswer["needsConfirmation"]>,
): NonNullable<TellMeAnswer["needsConfirmation"]> {
  const out = [...hints];
  for (const item of fromModel) {
    if (!item?.summary) continue;
    const key = `${item.kind}|${(item.scope ?? item.summary).toLowerCase()}`;
    if (
      out.some(
        (o) => `${o.kind}|${(o.scope ?? o.summary).toLowerCase()}` === key,
      )
    ) {
      continue;
    }
    out.push({
      id: item.id || `nc-model-${out.length}`,
      kind: item.kind || "ambiguity",
      summary: item.summary,
      scope: item.scope ?? null,
      truthItemId: item.truthItemId ?? null,
    });
  }
  return out;
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
      const kind = hit.type.startsWith("knowledge") ? "knowledge" : "todo";
      sources.push({
        id: hit.id,
        kind,
        label: hit.title,
        projectId: args.bundle.scope.projectId,
        projectCode: args.bundle.scope.projectCode,
      });
      // Knowledge/todo prose is related context, not confirmed current ownership.
      confidence = "related_context";
    } else {
      answer =
        "I don't have a confirmed owner for that in the project records.";
      confidence = "not_found";
    }
  }

  const needsConfirmation = [
    ...(args.bundle.needsConfirmationHints ?? []),
  ];
  // Slice 1D / D-009: do not invent unknown_owner from topic tokens alone.
  // Only surface stored ambiguities already present in needsConfirmationHints.

  if (!answer && /risk/.test(q)) {
    const domainOpen = (args.state.risks ?? []).filter(
      (r) =>
        (!args.bundle.scope.projectId ||
          r.projectId === args.bundle.scope.projectId) &&
        isOpenRiskStatus(r.status),
    );
    if (!domainOpen.length && !risks.length) {
      const knowledgeRisks = knowledge.filter((k) => /risk/i.test(k.title));
      if (!knowledgeRisks.length) {
        answer = "I can’t find open risks recorded for this scope.";
        confidence = "not_found";
      } else {
        answer = `Related risk wording I can see:\n${knowledgeRisks
          .slice(0, 8)
          .map((k) => `• ${k.title}`)
          .join("\n")}`;
        confidence = "related_context";
        for (const k of knowledgeRisks.slice(0, 4)) {
          sources.push({
            id: k.id,
            kind: "knowledge",
            label: k.title,
            projectId: args.bundle.scope.projectId,
            projectCode: args.bundle.scope.projectCode,
          });
        }
      }
    } else {
      const lines = [
        ...domainOpen.map((r) => r.title),
        ...risks.map((r) => r.title),
      ].slice(0, 8);
      answer = `Open risks I can see:\n${lines.map((l) => `• ${l}`).join("\n")}`;
      confidence = "direct_confirmation";
      for (const r of domainOpen.slice(0, 4)) {
        sources.push({
          id: r.id,
          kind: "risk",
          label: r.title,
          projectId: args.bundle.scope.projectId,
          projectCode: args.bundle.scope.projectCode,
        });
      }
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
      for (const t of list.slice(0, 4)) {
        sources.push({
          id: t.id,
          kind: "todo",
          label: t.title,
          projectId: args.bundle.scope.projectId,
          projectCode: args.bundle.scope.projectCode,
        });
      }
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

  const cited =
    confidence === "not_found"
      ? []
      : filterRelevantSources(sources, args.question).slice(0, 6);
  const bounded = constrainAskConfidence({
    question: args.question,
    confidence,
    sources: cited,
  });

  return {
    answer,
    confidence: bounded,
    sources: bounded === "not_found" ? [] : cited,
    noticed: [],
    needsConfirmation,
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
    modelRequested: null,
    tokenBreakdown: null,
    usedCanonicalTruth: Boolean(args.bundle.usedCanonicalTruth),
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
