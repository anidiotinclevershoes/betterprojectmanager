/**
 * Compact canonical truth serialiser for Tell Me / Knowledge Q&A.
 * Does not determine new truth — only projects stored state.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import {
  questionLooksHistorical,
  questionLooksCurrentState,
  questionLooksOwnership,
  ownershipTopicTokens,
} from "@/lib/tell-me/question-shape";
import type { MissionState, ProjectKnowledge } from "@/lib/types";
import type {
  CanonicalTruthBundle,
  CanonicalTruthItem,
  NeedsConfirmationItem,
} from "@/lib/canonical-truth/types";

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Build structured overlay from legacy string sections when none exists. */
export function deriveLegacyStructured(
  knowledge: ProjectKnowledge,
): CanonicalTruthItem[] {
  if (knowledge.structured?.length) {
    return knowledge.structured.map((i) => ({ ...i }));
  }
  const out: CanonicalTruthItem[] = [];
  const sections = knowledge.sections;
  const push = (
    section: keyof ProjectKnowledge["sections"],
    body: string,
    kind: CanonicalTruthItem["kind"],
  ) => {
    const cleaned = body.trim();
    if (!cleaned) return;
    out.push({
      id: newId("legacy"),
      projectId: knowledge.projectId,
      section,
      body: cleaned,
      kind,
      epistemic: null,
      lifecycle: "current",
      meta: null,
      provenance: [{ type: "legacy", note: "Pre-Slice-1 knowledge bullet" }],
    });
  };
  for (const b of sections.now ?? []) push("now", b, "fact");
  for (const b of sections.decisions ?? []) push("decisions", b, "decision");
  for (const b of sections.risks ?? []) push("risks", b, "risk");
  for (const b of sections.people ?? []) push("people", b, "fact");
  for (const b of sections.openLoops ?? []) push("openLoops", b, "open_loop");
  return out;
}

function formatItemLine(item: CanonicalTruthItem): string {
  const ep = item.epistemic ?? "legacy";
  const resp = item.meta?.responsibility;
  if (item.kind === "responsibility" && resp?.scope) {
    if (resp.ownerConfirmed && resp.personName) {
      return `[${item.id}] (responsibility, ${ep}) @${resp.personName} → ${resp.scope}`;
    }
    return `[${item.id}] (responsibility, ${ep}) ${resp.scope} · Owner: Not confirmed`;
  }
  if (item.kind === "date" && item.meta?.date) {
    const d = item.meta.date;
    return `[${item.id}] (date, ${ep}) ${d.label}${d.dateIso ? `: ${d.dateIso.slice(0, 10)}` : ""}`;
  }
  return `[${item.id}] (${item.kind}, ${ep}) ${item.body}`;
}

function findUnknownOwnerHints(
  items: CanonicalTruthItem[],
  question: string,
): NeedsConfirmationItem[] {
  const hints: NeedsConfirmationItem[] = [];
  for (const item of items) {
    if (item.lifecycle !== "current") continue;
    const resp = item.meta?.responsibility;
    if (
      item.kind === "responsibility" &&
      resp &&
      (item.epistemic === "unknown" || resp.ownerConfirmed === false)
    ) {
      hints.push({
        id: `nc-${item.id}`,
        kind: "unknown_owner",
        summary: `${resp.scope} owner is not confirmed.`,
        scope: resp.scope,
        truthItemId: item.id,
      });
    }
  }

  // Ownership question with no matching confirmed responsibility for the topic.
  if (questionLooksOwnership(question)) {
    const tokens = ownershipTopicTokens(question);
    const hasConfirmed = items.some((item) => {
      if (item.lifecycle !== "current") return false;
      if (item.kind !== "responsibility") return false;
      const resp = item.meta?.responsibility;
      if (!resp?.ownerConfirmed || !resp.personName) return false;
      const scope = resp.scope.toLowerCase();
      return tokens.some((t) => scope.includes(t) || t.includes(scope));
    });
    if (!hasConfirmed && tokens.length) {
      const scopeLabel = tokens
        .map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()))
        .join(" ");
      const already = hints.some((h) =>
        (h.scope ?? "").toLowerCase().includes(tokens[0]!),
      );
      if (!already) {
        hints.push({
          id: `nc-owner-${tokens.join("-")}`,
          kind: "unknown_owner",
          summary: `${scopeLabel} owner is not recorded.`,
          scope: scopeLabel,
          truthItemId: null,
        });
      }
    }
  }
  return hints;
}

/**
 * One compact representation of relevant current project truth.
 */
export function serializeCanonicalTruth(args: {
  state: MissionState;
  projectId: string;
  question: string;
}): CanonicalTruthBundle {
  const knowledge =
    args.state.knowledge.find((k) => k.projectId === args.projectId) ??
    emptyKnowledge(args.projectId);

  let items = deriveLegacyStructured(knowledge).filter(
    (i) => i.projectId === args.projectId,
  );

  // Prefer structured overlay entries when both exist (dedupe by body).
  if (knowledge.structured?.length) {
    const structured = knowledge.structured.filter(
      (i) => i.projectId === args.projectId,
    );
    const bodies = new Set(
      structured.map((i) => i.body.trim().toLowerCase()),
    );
    const legacyOnly = items.filter(
      (i) => !bodies.has(i.body.trim().toLowerCase()),
    );
    items = [...structured, ...legacyOnly];
  }

  const historical = questionLooksHistorical(args.question);
  const currentState =
    questionLooksCurrentState(args.question) && !historical;

  const visible = items.filter((i) => {
    if (historical) {
      return (
        i.lifecycle === "current" ||
        i.lifecycle === "historical" ||
        i.lifecycle === "superseded"
      );
    }
    return i.lifecycle === "current";
  });

  // Deduplicate identical bodies (keep first — prefer structured order).
  const seen = new Set<string>();
  const deduped: CanonicalTruthItem[] = [];
  for (const item of visible) {
    const key = `${item.kind}|${item.body.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const needsConfirmationHints = findUnknownOwnerHints(
    deduped,
    args.question,
  );

  const project = args.state.projects.find((p) => p.id === args.projectId);
  const header = [
    "CANONICAL PROJECT TRUTH",
    `PROJECT: ${project?.code ?? ""} · ${project?.name ?? args.projectId}`,
    historical
      ? "MODE: historical — includes superseded/historical facts"
      : "MODE: current — superseded/historical excluded",
    "",
  ];

  const lines = deduped.map(formatItemLine);

  // Thin open waiting (not duplicated if already in open_loop items)
  const waiting = args.state.todos.filter(
    (t) =>
      t.projectId === args.projectId &&
      !t.done &&
      (t.kind === "WAITING" || t.kind === "CHASE" || Boolean(t.waitingOn)),
  );
  const waitingLines = waiting.slice(0, 8).map((t) => {
    return `[todo-${t.id}] (open_loop, legacy) ${t.title}${t.waitingOn ? ` · waiting on ${t.waitingOn}` : ""}`;
  });

  // Milestones as compact dates (current questions)
  const milestones = args.state.timeline
    .filter((t) => t.projectId === args.projectId)
    .slice(0, 8)
    .map(
      (t) =>
        `[ms-${t.id}] (date, legacy) ${t.label}: ${(t.startAt ?? "").slice(0, 10)}`,
    );

  let evidenceBlock = "";
  let includedHistoryEvidence = false;
  if (historical) {
    const history = (args.state.history ?? [])
      .filter((h) => !h.projectId || h.projectId === args.projectId)
      .slice(0, 6);
    if (history.length) {
      includedHistoryEvidence = true;
      evidenceBlock = [
        "",
        "EVIDENCE (history — for historical questions only):",
        ...history.map(
          (h) =>
            `[hist-${h.id}] ${h.title}${h.detail ? ` — ${h.detail.slice(0, 160)}` : ""}`,
        ),
      ].join("\n");
    }
  } else if (currentState) {
    // Explicitly omit History dump for current-state questions.
    includedHistoryEvidence = false;
  }

  const ambiguityBlock = needsConfirmationHints.length
    ? [
        "",
        "KNOWN GAPS (do not invent answers for these — use needsConfirmation):",
        ...needsConfirmationHints.map((h) => `- ${h.summary}`),
      ].join("\n")
    : "";

  const promptBlock = [
    ...header,
    "CURRENT FACTS:",
    ...(lines.length ? lines : ["(none recorded)"]),
    "",
    "MILESTONES:",
    ...(milestones.length ? milestones : ["(none)"]),
    "",
    "WAITING / OPEN:",
    ...(waitingLines.length ? waitingLines : ["(none)"]),
    evidenceBlock,
    ambiguityBlock,
    "",
    `QUESTION: ${args.question.trim()}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return {
    projectId: args.projectId,
    promptBlock,
    items: deduped,
    needsConfirmationHints,
    approxChars: promptBlock.length,
    includedHistoryEvidence,
  };
}
