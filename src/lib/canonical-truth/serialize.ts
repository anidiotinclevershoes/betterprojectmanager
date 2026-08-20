/**
 * Compact canonical truth serialiser for Tell Me / Knowledge Q&A.
 * Slice 1D: assemble from authoritative MissionState domains (Knowledge,
 * risks.status, stakeholders, responsibilities, todos, milestones).
 * Does not determine new truth — only projects stored state.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import {
  questionLooksHistorical,
  questionLooksCurrentState,
} from "@/lib/tell-me/question-shape";
import type { HistoryEvent, MissionState, ProjectKnowledge } from "@/lib/types";
import type {
  CanonicalTruthBundle,
  CanonicalTruthItem,
  NeedsConfirmationItem,
} from "@/lib/canonical-truth/types";
import {
  isClosedRiskStatus,
  isOpenRiskStatus,
  isResolvedProse,
  stripResolvedPrefix,
  titlesMatch,
} from "@/lib/risks/lifecycle";

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
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
  const life =
    item.lifecycle && item.lifecycle !== "current"
      ? `, ${item.lifecycle}`
      : "";
  const resp = item.meta?.responsibility;
  if (item.kind === "responsibility" && resp?.scope) {
    if (resp.ownerConfirmed && resp.personName) {
      return `[${item.id}] (responsibility, ${ep}${life}) @${resp.personName} → ${resp.scope}`;
    }
    return `[${item.id}] (responsibility, ${ep}${life}) ${resp.scope} · Owner: Not confirmed`;
  }
  if (item.kind === "date" && item.meta?.date) {
    const d = item.meta.date;
    return `[${item.id}] (date, ${ep}${life}) ${d.label}${d.dateIso ? `: ${d.dateIso.slice(0, 10)}` : ""}`;
  }
  if (item.kind === "availability") {
    return `[${item.id}] (availability, ${ep}${life}) ${item.body}`;
  }
  if (item.kind === "dependency") {
    return `[${item.id}] (dependency, ${ep}${life}) ${item.body}`;
  }
  return `[${item.id}] (${item.kind}, ${ep}${life}) ${item.body}`;
}

const HISTORY_STOP = new Set([
  "the",
  "and",
  "for",
  "what",
  "when",
  "who",
  "why",
  "how",
  "did",
  "was",
  "were",
  "about",
  "with",
  "this",
  "that",
  "from",
  "into",
  "have",
  "has",
  "had",
  "our",
  "you",
  "your",
]);

/**
 * Prefer history rows that share tokens with the question; fall back to recent
 * project history for open-ended change questions.
 */
function selectHistoryEvidenceForQuestion(
  history: HistoryEvent[],
  projectId: string,
  question: string,
): HistoryEvent[] {
  const scoped = history.filter((h) => !h.projectId || h.projectId === projectId);
  if (!scoped.length) return [];
  const tokens = (question.toLowerCase().match(/\b[a-z0-9][a-z0-9-]{2,}\b/g) ?? [])
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length >= 3 && !HISTORY_STOP.has(t));
  if (!tokens.length) return scoped.slice(-6);
  const scored = scoped
    .map((h) => {
      const text = `${h.title} ${h.detail ?? ""}`.toLowerCase();
      const hits = tokens.filter((t) => text.includes(t)).length;
      return { h, hits };
    })
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  if (scored.length) return scored.slice(0, 6).map((row) => row.h);
  return scoped.slice(-6);
}

/**
 * Slice 1D / D-009: only emit unknown-owner from **stored** unconfirmed
 * responsibility rows. Never invent "owner is not recorded" from topic tokens.
 */
export function findUnknownOwnerHints(
  items: CanonicalTruthItem[],
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
  return hints;
}

/**
 * One compact representation of relevant current project truth.
 * Assembles from authoritative MissionState domains (Slice 1D).
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

  const domainRisks = (args.state.risks ?? []).filter(
    (r) => r.projectId === args.projectId,
  );
  const closedRiskTitles = domainRisks
    .filter((r) => isClosedRiskStatus(r.status))
    .map((r) => r.title);

  const visible = items.filter((i) => {
    if (historical) {
      return (
        i.lifecycle === "current" ||
        i.lifecycle === "historical" ||
        i.lifecycle === "superseded"
      );
    }
    if (i.lifecycle !== "current") return false;
    // Current-state: do not surface resolved Risk prose as open facts
    if (i.kind === "risk" || i.section === "risks") {
      if (isResolvedProse(i.body)) return false;
      if (
        closedRiskTitles.some((t) => titlesMatch(t, stripResolvedPrefix(i.body)))
      ) {
        return false;
      }
    }
    return true;
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

  const needsConfirmationHints = findUnknownOwnerHints(deduped);

  const project = args.state.projects.find((p) => p.id === args.projectId);
  const header = [
    "AUTHORITATIVE PROJECT STATE",
    `PROJECT: ${project?.code ?? ""} · ${project?.name ?? args.projectId}`,
    project?.status ? `STATUS: ${project.status}` : null,
    project?.currentFocus ? `FOCUS: ${project.currentFocus}` : null,
    project?.summary ? `OBJECTIVE: ${project.summary.slice(0, 200)}` : null,
    historical
      ? "MODE: historical — includes superseded/historical facts + history evidence"
      : "MODE: current — superseded/historical excluded; History omitted",
    "NOTE: Multiple people may share the same responsibility scope.",
    "",
  ].filter((l): l is string => Boolean(l));

  const lines = deduped.map(formatItemLine);

  // Slice 1B/1D: Risk domain lifecycle (open/watch only for current mode)
  const openDomainRisks = domainRisks.filter((r) =>
    historical ? true : isOpenRiskStatus(r.status),
  );
  const riskLines = openDomainRisks.slice(0, 12).map((r) => {
    return `[risk-${r.id}] (risk, ${r.status}) ${r.title}`;
  });

  // Stakeholders — durable Person identity (Slice 1C)
  const stakeholders = project?.stakeholders ?? [];
  const stakeholderLines = stakeholders.slice(0, 16).map((s) => {
    return `[person-${s.id}] (person) ${s.name}${s.role ? ` · ${s.role}` : ""}`;
  });

  // Waiting + general open todos (avoid dumping done)
  const projectTodos = args.state.todos.filter(
    (t) => t.projectId === args.projectId && !t.done,
  );
  const waiting = projectTodos.filter(
    (t) =>
      t.kind === "WAITING" || t.kind === "CHASE" || Boolean(t.waitingOn),
  );
  const generalTodos = projectTodos.filter(
    (t) =>
      t.kind !== "WAITING" && t.kind !== "CHASE" && !t.waitingOn,
  );
  const waitingLines = waiting.slice(0, 8).map((t) => {
    return `[todo-${t.id}] (waiting, legacy) ${t.title}${t.waitingOn ? ` · waiting on ${t.waitingOn}` : ""}`;
  });
  const todoLines = generalTodos.slice(0, 10).map((t) => {
    return `[todo-${t.id}] (todo, ${t.kind ?? "ACTION"}) ${t.title}`;
  });

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
    const history = selectHistoryEvidenceForQuestion(
      args.state.history ?? [],
      args.projectId,
      args.question,
    );
    if (history.length) {
      includedHistoryEvidence = true;
      evidenceBlock = [
        "",
        "EVIDENCE (history — for historical/change questions only):",
        ...history.map(
          (h) =>
            `[hist-${h.id}] ${h.title}${h.detail ? ` — ${h.detail.slice(0, 160)}` : ""}`,
        ),
      ].join("\n");
    }
  } else if (currentState) {
    includedHistoryEvidence = false;
  }

  const ambiguityBlock = needsConfirmationHints.length
    ? [
        "",
        "STORED AMBIGUITIES (do not invent further gaps):",
        ...needsConfirmationHints.map((h) => `- ${h.summary}`),
      ].join("\n")
    : "";

  const promptBlock = [
    ...header,
    "CURRENT FACTS:",
    ...(lines.length ? lines : ["(none recorded)"]),
    "",
    "RISKS (domain lifecycle):",
    ...(riskLines.length ? riskLines : ["(none open)"]),
    "",
    "PEOPLE (stakeholders):",
    ...(stakeholderLines.length ? stakeholderLines : ["(none)"]),
    "",
    "MILESTONES:",
    ...(milestones.length ? milestones : ["(none)"]),
    "",
    "TODOS:",
    ...(todoLines.length ? todoLines : ["(none)"]),
    "",
    "WAITING / CHASE:",
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
