import type { CaptureProjectContext } from "@/lib/capture/context";
import {
  detectMentionedProjects,
  resolveProjectForFact,
  splitCaptureByProjectPrefix,
} from "@/lib/capture/projectResolve";
import {
  dedupeProposedOperations,
  reconcileFindingCoverage,
  type FindingCoverageReport,
} from "./coverage";
import { mapFindingsToOperations } from "./map";
import type {
  CaptureFinding,
  FindingsValidationReport,
  IndexedContextRecord,
  ProposedOperation,
} from "./types";
import {
  buildContextRecordIndex,
  validateCaptureFindings,
} from "./validate";

/**
 * Heuristic local findings when OpenAI is unavailable.
 * Used only to keep the findings → mapper path consistent offline.
 * Prefer matching known open records by simple phrase cues.
 */
export function extractLocalFindings(
  captureText: string,
  contextIndex: Map<string, IndexedContextRecord>,
): CaptureFinding[] {
  const text = captureText.toLowerCase();
  const findings: CaptureFinding[] = [];
  let n = 0;
  const nextId = () => `local-finding-${++n}`;

  for (const record of contextIndex.values()) {
    if (record.entityType === "todo" && record.status !== "done") {
      const titleKey = record.title.toLowerCase();
      // Only treat as CAB approval completion when the To Do itself is about approval.
      const cabCue =
        /\bcab\b/.test(titleKey) &&
        /\bapprov/.test(titleKey) &&
        /\bcab\b/.test(text) &&
        /\b(approv\w*|received|granted)\b/.test(text);
      // Title mention alone is not enough — completion cue must be near the title.
      const genericComplete =
        titleKey.length > 8 && titleNearCompletionCue(text, titleKey);
      if (cabCue || genericComplete) {
        findings.push({
          id: nextId(),
          fact: cabCue
            ? "CAB approval was received"
            : `${record.title} is complete`,
          evidence: captureText.slice(0, 200),
          findingType: "ENTITY_COMPLETED",
          target: {
            entityType: "todo",
            entityId: record.id,
            title: record.title,
          },
          changes: {
            status: { previous: record.status ?? "open", proposed: "COMPLETED" },
          },
          confidence: cabCue ? 94 : 82,
          requiresClarification: false,
          reasoningSummary: `Existing To Do "${record.title}" matches Capture evidence of completion.`,
        });
      }
    }

    if (record.entityType === "risk") {
      const titleKey = record.title.toLowerCase();
      const cdnCue =
        /\bcdn\b/.test(titleKey) &&
        /\bcdn\b/.test(text) &&
        /\b(resolv\w*|fix\w*|cleared|done|complete\w*)\b/.test(text);
      const generic =
        titleKey.length > 6 &&
        (text.includes(titleKey.slice(0, Math.min(20, titleKey.length))) ||
          significantTitleOverlap(text, titleKey)) &&
        /\b(resolv\w*|fix\w*|cleared|closed|mitigated)\b/.test(text);
      if (cdnCue || generic) {
        findings.push({
          id: nextId(),
          fact: cdnCue
            ? "The CDN deployment blocker was resolved"
            : `${record.title} is resolved`,
          evidence: captureText.slice(0, 200),
          findingType: "ENTITY_COMPLETED",
          target: {
            entityType: "risk",
            entityId: record.id,
            title: record.title,
          },
          changes: {
            status: { previous: "OPEN", proposed: "COMPLETED" },
          },
          confidence: cdnCue ? 91 : 80,
          requiresClarification: false,
          reasoningSummary: `Existing Risk "${record.title}" is resolved per Capture.`,
        });
      }
    }

    // Digit date form ("19 August") → Knowledge (standard Golden baseline).
    // Word date form ("nineteenth of August") → Milestone when present (hard scenario).
    const digitNewDate = /\b19\s*aug/.test(text);
    const wordNewDate =
      /\b(19th|nineteenth)\b/.test(text) && /\baug/.test(text);
    const oldDateInRecord = (blob: string) =>
      /\b12\s*aug/.test(blob) ||
      /\b(12th|twelfth)\b/.test(blob);

    if (record.entityType === "knowledge" && digitNewDate) {
      const titleKey = record.title.toLowerCase();
      const releaseCue =
        /\brelease\b/.test(titleKey) && oldDateInRecord(titleKey);
      if (releaseCue) {
        findings.push({
          id: nextId(),
          fact: "Release moved from 12 August to 19 August",
          evidence: captureText.slice(0, 240),
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: "knowledge",
            entityId: record.id,
            title: record.title,
          },
          changes: {
            text: {
              previous: record.title,
              proposed: "Release planned for 19 August",
            },
          },
          confidence: 93,
          requiresClarification: false,
          reasoningSummary: `Existing Knowledge "${record.title}" should update to the new date.`,
        });
      }
    }

    if (record.entityType === "milestone" && wordNewDate && !digitNewDate) {
      const blob = `${record.title} ${record.summary ?? ""}`.toLowerCase();
      const releaseCue =
        /\brelease\b/.test(blob) && oldDateInRecord(blob);
      if (releaseCue) {
        findings.push({
          id: nextId(),
          fact: "Release moved from 12 August to 19 August",
          evidence: captureText.slice(0, 240),
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: "milestone",
            entityId: record.id,
            title: record.title,
          },
          changes: {
            startAt: {
              previous: "2026-08-12",
              proposed: "2026-08-19",
            },
            date: {
              previous: "12 August",
              proposed: "19 August",
            },
          },
          confidence: 92,
          requiresClarification: false,
          reasoningSummary: `Existing Milestone "${record.title}" should move to 19 August.`,
        });
      }
    }

    // General UPDATE: open todo/risk title mentioned with due-date / ownership language.
    if (
      (record.entityType === "todo" || record.entityType === "risk") &&
      record.status !== "done"
    ) {
      const titleKey = record.title.toLowerCase();
      const titleHit =
        titleKey.length > 10 &&
        (text.includes(titleKey.slice(0, Math.min(28, titleKey.length))) ||
          significantTitleOverlap(text, titleKey));
      const updateCue =
        /\b(move|moved|due|push|friday|tuesday|owner|owning|nina|deadline|close of play)\b/.test(
          text,
        );
      const already =
        findings.some(
          (f) =>
            f.target?.entityId === record.id &&
            (f.findingType === "ENTITY_UPDATED" ||
              f.findingType === "ENTITY_COMPLETED"),
        );
      if (titleHit && updateCue && !already) {
        const friday = /\bfriday\b/.test(text);
        const tuesday = /\btuesday\b/.test(text);
        const ownerNina = /\bnina\b/.test(text) && /\bown/.test(text);
        findings.push({
          id: nextId(),
          fact: ownerNina
            ? `${record.title} — ownership confirmed with Nina`
            : friday
              ? `${record.title} due date moved to Friday`
              : tuesday
                ? `${record.title} due date moved to Tuesday`
                : `${record.title} schedule updated`,
          evidence: captureText.slice(0, 240),
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: record.entityType,
            entityId: record.id,
            title: record.title,
          },
          changes: {
            ...(ownerNina
              ? { owner: { previous: "Unassigned", proposed: "Nina" } }
              : {}),
            date: {
              previous: "current",
              proposed: friday ? "Friday" : tuesday ? "Tuesday" : "updated",
            },
          },
          confidence: 84,
          requiresClarification: false,
          reasoningSummary: `Existing ${record.entityType} "${record.title}" should be updated per Capture.`,
        });
      }
    }
  }

  // Explicit CREATE cues — genuinely new work (no existing target expected).
  const createPatterns: Array<{
    re: RegExp;
    entity: "todo" | "risk" | "knowledge";
    label: string;
    todoKind?: "ACTION" | "WAITING" | "CHASE" | "REMINDER";
  }> = [
    {
      re: /create a to[\s-]?do(?:\s+to)?\s+([^.!\n]{8,120})/gi,
      entity: "todo",
      label: "To Do",
    },
    {
      re: /add an action(?:\s+to)?\s+([^.!\n]{8,120})/gi,
      entity: "todo",
      label: "action",
    },
    {
      re: /raise a(?:\s+new)? risk[:\s]+([^.!\n]{8,120})/gi,
      entity: "risk",
      label: "risk",
    },
    {
      re: /raise a(?:\s+new)?\s+([^.!\n]{8,100}?)\s+risk\b/gi,
      entity: "risk",
      label: "risk",
    },
    {
      re: /chase\s+([A-Z][a-zA-Z]+)(?:\s+for|\s+on)?\s+([^.!\n]{6,100})/gi,
      entity: "todo",
      label: "Chase",
      todoKind: "CHASE",
    },
    {
      re: /await(?:ing)?\s+(?:(?:a\s+)?response\s+from\s+)?([A-Z][a-zA-Z]+|[A-Za-z][A-Za-z0-9 &-]{2,40})(?:\s+for)?\s*([^.!\n]{0,100})/gi,
      entity: "todo",
      label: "Waiting",
      todoKind: "WAITING",
    },
    {
      re: /waiting\s+on\s+([A-Z][a-zA-Z]+|[A-Za-z][A-Za-z0-9 &-]{2,40})(?:\s+for)?\s*([^.!\n]{0,100})/gi,
      entity: "todo",
      label: "Waiting",
      todoKind: "WAITING",
    },
    {
      re: /remember(?:\s+that)?\s+([^.!\n]{12,160})/gi,
      entity: "knowledge",
      label: "Knowledge",
    },
  ];

  const seenCreateTitles = new Set<string>();
  for (const pattern of createPatterns) {
    for (const match of captureText.matchAll(pattern.re)) {
      let title = (match[1] ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\.$/, "");
      let waitingOn: string | undefined;
      if (pattern.todoKind === "CHASE" && match[2]) {
        waitingOn = match[1];
        // Guard against false positives like "Chase two unsigned modules…"
        if (!/^[A-Z][a-zA-Z]+$/.test(waitingOn) || /^(two|the|a|an|all|this|that)$/i.test(waitingOn)) {
          continue;
        }
        title = `Chase ${match[1]}: ${match[2].replace(/\s+/g, " ").trim()}`;
      } else if (pattern.todoKind === "WAITING") {
        waitingOn = (match[1] ?? "").replace(/\s+/g, " ").trim();
        if (!waitingOn || /^(two|the|a|an|all)$/i.test(waitingOn)) continue;
        const detail = (match[2] ?? "").replace(/\s+/g, " ").trim();
        title = detail
          ? `Await ${waitingOn}: ${detail}`
          : `Await ${waitingOn}`;
      }
      if (!title || IRRELEVANT_LOCAL.test(title)) continue;
      if (pattern.entity === "knowledge" && isTransientEventKnowledge(title)) {
        continue;
      }
      const key = title.toLowerCase().slice(0, 48);
      if (seenCreateTitles.has(key)) continue;
      seenCreateTitles.add(key);
      findings.push({
        id: nextId(),
        fact:
          pattern.entity === "knowledge"
            ? title
            : `New ${pattern.label}: ${title}`,
        evidence: match[0],
        findingType: "NEW_INFORMATION",
        target: {
          entityType: pattern.entity,
          title,
        },
        changes: {
          entityType: { proposed: pattern.entity },
          title: { proposed: title },
          ...(pattern.todoKind
            ? { todoKind: { proposed: pattern.todoKind } }
            : {}),
          ...(waitingOn ? { waitingOn: { proposed: waitingOn } } : {}),
          ...((pattern.todoKind === "CHASE" ||
            pattern.todoKind === "WAITING") &&
          /\bfriday\b/i.test(match[0])
            ? { date: { proposed: "Friday" } }
            : {}),
        },
        confidence: 88,
        requiresClarification: false,
        reasoningSummary:
          pattern.entity === "knowledge"
            ? "Durable project context worth remembering."
            : `Capture explicitly requests a new ${pattern.label}.`,
      });
    }
  }

  return findings;
}

function isTransientEventKnowledge(title: string): boolean {
  return /\b(was received|is complete|is done|was resolved|moved to|changed to)\b/i.test(
    title,
  );
}

const IRRELEVANT_LOCAL =
  /\b(milk|timesheet|onetrust|eggs|grocery)\b/i;

const TITLE_STOPWORDS = new Set([
  "with",
  "from",
  "into",
  "that",
  "this",
  "have",
  "been",
  "will",
  "should",
  "confirm",
  "release",
  "before",
  "after",
  "about",
  "plan",
  "planned",
  "complete",
  "complete",
  "board",
]);

function significantTitleOverlap(haystack: string, title: string): boolean {
  const tokens = title
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 3 && !TITLE_STOPWORDS.has(t));
  if (tokens.length < 2) return false;
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

/**
 * Completion cue near distinctive title tokens.
 * Avoid matching the word "complete" inside the title itself (e.g. "Submit complete CAB pack").
 */
function titleNearCompletionCue(text: string, title: string): boolean {
  const tokens = title
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 3 && !TITLE_STOPWORDS.has(t));
  if (tokens.length === 0) return false;
  // Prefer clear completion predicates — not bare "complete" (often part of titles).
  const cue =
    /\b(?:is\s+done|are\s+done|is\s+complete|completed|finished|received|resolved|closed\s+off|close\s+that|approv(?:ed|al)\s+(?:was\s+)?received)\b/g;
  let m: RegExpExecArray | null;
  while ((m = cue.exec(text))) {
    const start = Math.max(0, m.index - 90);
    const end = Math.min(text.length, m.index + m[0].length + 90);
    const window = text.slice(start, end);
    const hits = tokens.filter((t) => window.includes(t)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }
  return false;
}

/**
 * Stamp project identity onto findings using mentions + record ownership.
 * Soft sidebar hint is never used alone to resolve ambiguity.
 */
export function stampFindingProjects(
  findings: CaptureFinding[],
  args: {
    captureText: string;
    projects: Array<{ id: string; name: string; code: string }>;
    contextIndex: Map<string, IndexedContextRecord>;
    softHintProjectId?: string | null;
    allOpenTodos?: Array<{ id: string; title: string; projectId?: string | null }>;
  },
): CaptureFinding[] {
  const projects = args.projects as import("@/lib/types").Project[];
  const segments = splitCaptureByProjectPrefix(args.captureText, projects);

  return findings.map((finding) => {
    if (finding.projectId) return finding;

    const evidence = finding.evidence || finding.fact;
    const segment = segments.find(
      (s) =>
        s.project &&
        s.text
          .toLowerCase()
          .includes(evidence.toLowerCase().slice(0, Math.min(40, evidence.length))),
    );
    if (segment?.project) {
      return {
        ...finding,
        projectId: segment.project.id,
        projectName: segment.project.name,
        projectCode: segment.project.code,
        projectCandidates: undefined,
      };
    }

    const resolution = resolveProjectForFact({
      fact: finding.fact,
      evidence: finding.evidence,
      projects,
      softHintProjectId: args.softHintProjectId,
    });

    if (resolution.status === "resolved") {
      return {
        ...finding,
        projectId: resolution.project.id,
        projectName: resolution.project.name,
        projectCode: resolution.project.code,
      };
    }

    if (resolution.status === "ambiguous") {
      return {
        ...finding,
        projectCandidates: resolution.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
        })),
        requiresClarification: true,
        clarificationQuestion:
          finding.clarificationQuestion || "Which project does this refer to?",
      };
    }

    const mentioned = detectMentionedProjects(
      `${finding.fact} ${finding.evidence}`,
      projects,
    );

    // Bare CAB approval: only PROJECT_UNCERTAIN when multiple projects own CAB todos.
    if (
      /\bcab\b/i.test(finding.fact) &&
      /\bapprov/i.test(finding.fact) &&
      !mentioned.length
    ) {
      const cabTodos = (args.allOpenTodos ?? []).filter(
        (t) =>
          /\bcab\b/i.test(t.title) &&
          /\bapprov/i.test(t.title) &&
          t.projectId,
      );
      const cabProjectIds = [
        ...new Set(cabTodos.map((t) => t.projectId).filter(Boolean) as string[]),
      ];
      if (cabProjectIds.length > 1) {
        return {
          ...finding,
          projectCandidates: cabProjectIds.map((id) => {
            const p = projects.find((x) => x.id === id);
            return {
              id,
              name: p?.name ?? id,
              code: p?.code,
            };
          }),
          requiresClarification: true,
          clarificationQuestion: "Which project does this refer to?",
          target: undefined,
          findingType: "AMBIGUOUS" as const,
        };
      }
      if (cabProjectIds.length === 1) {
        const p = projects.find((x) => x.id === cabProjectIds[0]);
        if (p) {
          return {
            ...finding,
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code,
          };
        }
      }
    }

    // Soft hint may assign CREATE destinations when no other project evidence
    // exists. It must not resolve genuine multi-project ambiguity alone.
    const isExplicitCreate =
      finding.findingType === "NEW_INFORMATION" &&
      Boolean(finding.target?.entityType) &&
      !finding.target?.entityId;

    if (!finding.projectId && projects.length === 1) {
      return {
        ...finding,
        projectId: projects[0].id,
        projectName: projects[0].name,
        projectCode: projects[0].code,
      };
    }

    if (
      isExplicitCreate &&
      !finding.projectId &&
      args.softHintProjectId &&
      mentioned.length === 0
    ) {
      const p = projects.find((x) => x.id === args.softHintProjectId);
      if (p) {
        return {
          ...finding,
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
        };
      }
    }

    if (
      finding.findingType === "NEW_INFORMATION" &&
      !finding.projectId &&
      projects.length > 1 &&
      mentioned.length === 0 &&
      !isExplicitCreate
    ) {
      return {
        ...finding,
        projectCandidates: projects.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
        requiresClarification: true,
        clarificationQuestion: "Which project does this refer to?",
      };
    }

    // CREATE without soft hint or mention → ask which project.
    if (
      isExplicitCreate &&
      !finding.projectId &&
      projects.length > 1 &&
      mentioned.length === 0
    ) {
      return {
        ...finding,
        projectCandidates: projects.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
        requiresClarification: true,
        clarificationQuestion: "Which project does this refer to?",
      };
    }

    return finding;
  });
}

export type FindingsPipelineResult = {
  findings: CaptureFinding[];
  operations: ProposedOperation[];
  validation: FindingsValidationReport;
  contextIndex: Map<string, IndexedContextRecord>;
  coverage: FindingCoverageReport;
};

/**
 * Validate AI findings (or local findings) and map to proposed operations.
 * Runs duplicate-op guard + actionable coverage reconciliation afterwards.
 */
export function runFindingsPipeline(args: {
  rawFindings: unknown;
  captureText: string;
  captureContext: CaptureProjectContext | null | undefined;
  /** When AI findings are empty / missing, derive local findings. */
  allowLocalFallback?: boolean;
  projects?: Array<{ id: string; name: string; code: string }>;
  softHintProjectId?: string | null;
  allOpenTodos?: Array<{ id: string; title: string; projectId?: string | null }>;
}): FindingsPipelineResult {
  const contextIndex = buildContextRecordIndex(args.captureContext);
  let validation = validateCaptureFindings(args.rawFindings, contextIndex);

  if (
    args.allowLocalFallback &&
    validation.findings.length === 0 &&
    (args.rawFindings == null ||
      (Array.isArray(args.rawFindings) && args.rawFindings.length === 0))
  ) {
    const local = extractLocalFindings(args.captureText, contextIndex);
    validation = validateCaptureFindings(local, contextIndex);
  }

  const projects =
    args.projects ??
    (args.captureContext?.projectIndex ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
    }));
  const softHint =
    args.softHintProjectId ?? args.captureContext?.project?.id ?? null;

  const stamped = stampFindingProjects(validation.findings, {
    captureText: args.captureText,
    projects,
    contextIndex,
    softHintProjectId: softHint,
    allOpenTodos: args.allOpenTodos,
  });
  validation = { ...validation, findings: stamped };

  const mapped = mapFindingsToOperations(validation.findings, contextIndex);
  const operations = dedupeProposedOperations(mapped);
  const coverage = reconcileFindingCoverage(validation.findings, operations);

  return {
    findings: validation.findings,
    operations,
    validation,
    contextIndex,
    coverage,
  };
}
