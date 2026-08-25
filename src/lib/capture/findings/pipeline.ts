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
      const genericComplete =
        titleKey.length > 8 && titleNearCompletionCue(text, titleKey);
      if (genericComplete) {
        findings.push({
          id: nextId(),
          fact: `${record.title} is complete`,
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
          confidence: 82,
          requiresClarification: false,
          reasoningSummary: `Existing To Do "${record.title}" matches Capture evidence of completion.`,
        });
      }
    }

    if (record.entityType === "risk") {
      const titleKey = record.title.toLowerCase();
      const generic =
        titleKey.length > 6 &&
        text.includes(titleKey) &&
        /\b(resolv\w*|fix\w*|cleared|closed|mitigated)\b/.test(text);
      if (generic) {
        findings.push({
          id: nextId(),
          fact: `${record.title} is resolved`,
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
          confidence: 80,
          requiresClarification: false,
          reasoningSummary: `Existing Risk "${record.title}" is resolved per Capture.`,
        });
      }
    }

    if (record.entityType === "milestone") {
      const titleKey = record.title.toLowerCase();
      const mentioned = titleKey.length > 4 && text.includes(titleKey);
      const moved = /\b(moved|move|now|changed|pushed|brought forward)\b/.test(text);
      if (mentioned && moved) {
        const proposed = extractIsoDateHint(captureText);
        const previous = record.date ?? undefined;
        if (proposed && previous && isoDay(proposed) === isoDay(previous)) {
          findings.push({
            id: nextId(),
            fact: `${record.title} remains ${proposed.slice(0, 10)}`,
            evidence: captureText.slice(0, 240),
            findingType: "NO_CHANGE",
            target: {
              entityType: "milestone",
              entityId: record.id,
              title: record.title,
            },
            confidence: 84,
            requiresClarification: false,
            reasoningSummary: `Existing date "${record.title}" is unchanged.`,
          });
        } else if (proposed) {
          findings.push({
            id: nextId(),
            fact: `${record.title} moved to ${proposed.slice(0, 10)}`,
            evidence: captureText.slice(0, 240),
            findingType: "ENTITY_UPDATED",
            target: {
              entityType: "milestone",
              entityId: record.id,
              title: record.title,
            },
            changes: {
              startAt: { previous, proposed },
              date: { previous, proposed },
            },
            confidence: 84,
            requiresClarification: false,
            reasoningSummary: `Existing Milestone "${record.title}" should move to the stated date.`,
          });
        } else if (moved) {
          findings.push({
            id: nextId(),
            fact: `${record.title} date change is unclear`,
            evidence: captureText.slice(0, 240),
            findingType: "AMBIGUOUS",
            target: {
              entityType: "milestone",
              entityId: record.id,
              title: record.title,
            },
            confidence: 60,
            requiresClarification: true,
            clarificationQuestion: "Which date should this milestone move to?",
            reasoningSummary: "A date change was mentioned but the new date is not clear.",
          });
        }
      }
    }

    // General UPDATE: open todo/risk title mentioned with due-date language.
    if (
      (record.entityType === "todo" || record.entityType === "risk") &&
      record.status !== "done"
    ) {
      const titleKey = record.title.toLowerCase();
      const titleHit = titleKey.length > 10 && text.includes(titleKey);
      const updateCue =
        /\b(move|moved|due date|push(?:ed)?(?:\s+that)?\s+due|deadline)\b/.test(
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
        findings.push({
          id: nextId(),
          fact: friday
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

  const stakeholders = [...contextIndex.values()].filter(
    (r) => r.entityType === "stakeholder",
  );
  const mentionedPeople = stakeholders.filter((s) => {
    const re = new RegExp(`\\b${escapeRegExpLocal(s.title)}\\b`, "i");
    return re.test(captureText);
  });

  for (const person of mentionedPeople) {
    const already = findings.some(
      (f) => f.target?.entityId === person.id && f.target.entityType === "stakeholder",
    );
    if (already) continue;

    const nameRe = escapeRegExpLocal(person.title);
    const remains = new RegExp(
      `\\b${nameRe}\\b[^.\\n]{0,80}\\b(remains?|still|continues)\\b|\\b(remains?|still|continues)\\b[^.\\n]{0,80}\\b${nameRe}\\b`,
      "i",
    );
    const away = new RegExp(
      `\\b${nameRe}\\b[^.\\n]{0,80}\\b(away|unavailable|on leave|out of office|ooo|holiday|vacation)\\b|\\b(away|unavailable|on leave)\\b[^.\\n]{0,80}\\b${nameRe}\\b`,
      "i",
    );
    const share = /\b(share|alongside|also|help(?:ing)? with|day-to-day)\b/i.test(
      captureText,
    );
    const replace = /\b(replace[sd]?|takes over|instead of|from now on)\b/i.test(
      captureText,
    );

    if (away.test(captureText)) {
      const from = extractAvailabilityDate(captureText, person.title);
      findings.push({
        id: nextId(),
        fact: from
          ? `${person.title} is away from ${from.slice(0, 10)}`
          : `${person.title} availability mentioned`,
        evidence: captureText.slice(0, 240),
        findingType: from ? "NEW_INFORMATION" : "AMBIGUOUS",
        target: {
          entityType: "knowledge",
          title: `${person.title} availability`,
        },
        changes: {
          entityType: { proposed: "knowledge" },
          kind: { proposed: "availability" },
          personId: { proposed: person.id },
          personName: { proposed: person.title },
          ...(from
            ? { awayFromIso: { proposed: from }, awayToIso: { proposed: from } }
            : {}),
        },
        confidence: from ? 86 : 60,
        requiresClarification: !from,
        clarificationQuestion: from
          ? undefined
          : "Which dates is this person away?",
        reasoningSummary: from
          ? `Structured availability for existing person "${person.title}".`
          : `Availability mentioned for "${person.title}" but dates are unclear.`,
      });
      continue;
    }

    if (share && replace && mentionedPeople.length >= 1) {
      const scope = extractRoleScope(captureText, person.title);
      findings.push({
        id: nextId(),
        fact: `${person.title} ownership change needs confirmation`,
        evidence: captureText.slice(0, 240),
        findingType: "AMBIGUOUS",
        target: {
          entityType: "stakeholder",
          entityId: person.id,
          title: person.title,
        },
        changes: {
          ownershipSemantics: { proposed: "ambiguous" },
          personId: { proposed: person.id },
          personName: { proposed: person.title },
          ...(scope ? { scope: { proposed: scope } } : {}),
        },
        confidence: 62,
        requiresClarification: true,
        clarificationQuestion: "Should this share or replace the current owner?",
        reasoningSummary:
          "Ownership language is ambiguous between sharing and replacing.",
      });
      continue;
    }

    if (replace && !share) {
      const scope = extractRoleScope(captureText, person.title);
      if (scope) {
        findings.push({
          id: nextId(),
          fact: `${person.title} takes ${scope}`,
          evidence: captureText.slice(0, 240),
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: "stakeholder",
            entityId: person.id,
            title: person.title,
          },
          changes: {
            ownershipSemantics: { proposed: "replace" },
            personId: { proposed: person.id },
            personName: { proposed: person.title },
            scope: { proposed: scope },
          },
          confidence: 80,
          requiresClarification: false,
          reasoningSummary: `Explicit replacement of ${scope} ownership.`,
        });
        continue;
      }
    }

    if (remains.test(captureText)) {
      const scope = extractRoleScope(captureText, person.title);
      findings.push({
        id: nextId(),
        fact: scope
          ? `${person.title} remains ${scope}`
          : `${person.title} remains in role`,
        evidence: captureText.slice(0, 240),
        findingType: "NO_CHANGE",
        target: {
          entityType: "stakeholder",
          entityId: person.id,
          title: person.title,
        },
        changes: {
          ownershipSemantics: { proposed: "continue" },
          personId: { proposed: person.id },
          personName: { proposed: person.title },
          ...(scope ? { scope: { proposed: scope } } : {}),
        },
        confidence: 88,
        requiresClarification: false,
        reasoningSummary: `Existing person "${person.title}" is already on the project.`,
      });
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
  "board",
  "the",
  "and",
  "for",
  "not",
  "but",
  "are",
  "was",
  "has",
  "had",
  "its",
]);

function escapeRegExpLocal(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isoDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

const MONTHS: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

/** Generic date parse — ISO or "8 October 2026". No demo-world special cases. */
function extractIsoDateHint(text: string): string | undefined {
  const all = extractAllIsoDateHints(text);
  return all[0];
}

function extractAllIsoDateHints(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const push = (iso: string) => {
    const day = iso.slice(0, 10);
    if (seen.has(day)) return;
    seen.add(day);
    found.push(iso);
  };
  for (const m of text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) {
    push(`${m[1]}T12:00:00.000Z`);
  }
  const wordRe =
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(?:\s+(20\d{2}))?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text))) {
    const day = m[1]!.padStart(2, "0");
    const month = MONTHS[m[2]!.toLowerCase()];
    if (!month) continue;
    const year = m[3] ?? String(new Date().getFullYear());
    push(`${year}-${month}-${day}T12:00:00.000Z`);
  }
  return found;
}

/**
 * Availability dates must come from the person clause, not some other date
 * mentioned in the same Capture. Multiple unrelated dates → Needs you.
 */
function extractAvailabilityDate(
  captureText: string,
  personName: string,
): string | undefined {
  const name = escapeRegExpLocal(personName);
  const windowRe = new RegExp(
    `.{0,80}\\b${name}\\b.{0,80}`,
    "i",
  );
  const window = captureText.match(windowRe)?.[0] ?? "";
  const near = extractAllIsoDateHints(window);
  if (near.length === 1) return near[0];
  if (near.length > 1) return undefined;
  const all = extractAllIsoDateHints(captureText);
  if (all.length === 1) return all[0];
  return undefined;
}

function extractRoleScope(text: string, personName: string): string | undefined {
  const name = escapeRegExpLocal(personName);
  const patterns = [
    new RegExp(
      `\\b${name}\\b[^.\\n]{0,60}\\b(?:remains?|still|continues as|as)\\s+(?:the\\s+)?([^.,\\n]{3,60})`,
      "i",
    ),
    new RegExp(
      `\\b(?:as|the)\\s+([^.,\\n]{3,40}?)\\b[^.\\n]{0,40}\\b${name}\\b`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const scope = m?.[1]?.replace(/\s+/g, " ").trim();
    if (
      scope &&
      !/^(owner|person|they|this|that|and|but)$/i.test(scope)
    ) {
      return scope.replace(/\b(remains?|still|continues)\b/i, "").trim();
    }
  }
  return undefined;
}

function titleTokens(title: string): string[] {
  return title
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 3 && !TITLE_STOPWORDS.has(t));
}

function tokenAppears(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  if (token.length >= 5) {
    const stem = token.slice(0, 5);
    return new RegExp(`\\b${stem}\\w*\\b`).test(haystack);
  }
  return false;
}

/**
 * Completion cue near distinctive title tokens.
 * Avoid matching the word "complete" inside the title itself (e.g. "Submit complete CAB pack").
 */
function titleNearCompletionCue(text: string, title: string): boolean {
  const tokens = titleTokens(title);
  if (tokens.length === 0) return false;
  // Prefer clear completion predicates — not bare "complete" (often part of titles).
  const cue =
    /\b(?:is\s+done|are\s+done|is\s+complete|completed|finished|received|resolved|closed\s+off|close\s+that|approv(?:ed|al)\s+(?:was\s+)?received|been\s+approved)\b/g;
  let m: RegExpExecArray | null;
  while ((m = cue.exec(text))) {
    const start = Math.max(0, m.index - 90);
    const end = Math.min(text.length, m.index + m[0].length + 90);
    const window = text.slice(start, end);
    const hits = tokens.filter((t) => tokenAppears(window, t)).length;
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

    // Same titled open work on more than one project cannot be auto-assigned,
    // including by selected-project / soft hint.
    const targetTitle = finding.target?.title?.trim().toLowerCase();
    if (targetTitle) {
      const colliding = [
        ...new Set(
          (args.allOpenTodos ?? [])
            .filter(
              (t) =>
                t.projectId &&
                t.title.trim().toLowerCase() === targetTitle,
            )
            .map((t) => t.projectId as string),
        ),
      ];
      if (colliding.length > 1) {
        return {
          ...finding,
          projectId: undefined,
          projectName: undefined,
          projectCode: undefined,
          projectCandidates: colliding.map((id) => {
            const p = projects.find((x) => x.id === id);
            return { id, name: p?.name ?? id, code: p?.code };
          }),
          requiresClarification: true,
          clarificationQuestion:
            finding.clarificationQuestion || "Which project does this refer to?",
          target: undefined,
          findingType: "AMBIGUOUS",
        };
      }
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
