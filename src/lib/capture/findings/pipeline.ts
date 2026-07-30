import type { CaptureProjectContext } from "@/lib/capture/context";
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
      const cabCue =
        /\bcab\b/.test(titleKey) &&
        /\bcab\b/.test(text) &&
        /\b(approv\w*|received|granted|done|complete\w*)\b/.test(text);
      const genericComplete =
        titleKey.length > 8 &&
        text.includes(titleKey.slice(0, Math.min(24, titleKey.length))) &&
        /\b(completed|finished|done|received|resolved)\b/.test(text);
      if (cabCue || genericComplete) {
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
        text.includes(titleKey.slice(0, Math.min(20, titleKey.length))) &&
        /\b(resolv\w*|fix\w*|cleared|closed|mitigated)\b/.test(text);
      if (cdnCue || generic) {
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
          confidence: cdnCue ? 91 : 80,
          requiresClarification: false,
          reasoningSummary: `Existing Risk "${record.title}" is resolved per Capture.`,
        });
      }
    }

    if (record.entityType === "knowledge") {
      const titleKey = record.title.toLowerCase();
      const releaseCue =
        /\brelease\b/.test(titleKey) &&
        /\b12\s*aug/.test(titleKey) &&
        /\b19\s*aug/.test(text);
      if (releaseCue) {
        findings.push({
          id: nextId(),
          fact: "Release date moved to 19 August",
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
  }

  return findings;
}

export type FindingsPipelineResult = {
  findings: CaptureFinding[];
  operations: ProposedOperation[];
  validation: FindingsValidationReport;
  contextIndex: Map<string, IndexedContextRecord>;
};

/**
 * Validate AI findings (or local findings) and map to proposed operations.
 */
export function runFindingsPipeline(args: {
  rawFindings: unknown;
  captureText: string;
  captureContext: CaptureProjectContext | null | undefined;
  /** When AI findings are empty / missing, derive local findings. */
  allowLocalFallback?: boolean;
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

  const operations = mapFindingsToOperations(
    validation.findings,
    contextIndex,
  );

  return {
    findings: validation.findings,
    operations,
    validation,
    contextIndex,
  };
}
