import type { AIEntityType } from "@/ai/domain/types";
import type { CaptureProjectContext } from "@/lib/capture/context";
import {
  FINDING_TYPES,
  type CaptureFinding,
  type FindingTarget,
  type FindingType,
  type FindingsValidationReport,
  type IndexedContextRecord,
} from "./types";

const ENTITY_TYPES = new Set<AIEntityType>([
  "project",
  "todo",
  "meeting",
  "risk",
  "milestone",
  "knowledge",
  "stakeholder",
  "nudge",
  "history",
  "release",
]);

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeEntityType(raw: string): AIEntityType | null {
  const t = raw.toLowerCase().trim();
  if (t.startsWith("todo")) return "todo";
  if (t.startsWith("knowledge")) return "knowledge";
  if (t.startsWith("timeline") || t.includes("milestone")) return "milestone";
  if (t.startsWith("history")) return "history";
  if (ENTITY_TYPES.has(t as AIEntityType)) return t as AIEntityType;
  // Common AI aliases
  if (t === "action" || t === "task") return "todo";
  if (t === "decision") return "knowledge";
  return null;
}

/** Flatten Capture context into a stable ID index. */
export function buildContextRecordIndex(
  ctx: CaptureProjectContext | null | undefined,
): Map<string, IndexedContextRecord> {
  const map = new Map<string, IndexedContextRecord>();
  if (!ctx) return map;

  const buckets: Array<{ list: typeof ctx.todos; fallback: AIEntityType }> = [
    { list: ctx.todos, fallback: "todo" },
    { list: ctx.completedTodos, fallback: "todo" },
    { list: ctx.nudges, fallback: "nudge" },
    { list: ctx.meetings, fallback: "meeting" },
    { list: ctx.milestones, fallback: "milestone" },
    { list: ctx.risks, fallback: "risk" },
    { list: ctx.stakeholders, fallback: "stakeholder" },
    { list: ctx.knowledge, fallback: "knowledge" },
    { list: ctx.history, fallback: "history" },
    { list: ctx.releases, fallback: "release" },
  ];

  for (const bucket of buckets) {
    for (const r of bucket.list) {
      const entityType = normalizeEntityType(r.type) ?? bucket.fallback;
      map.set(r.id, {
        entityType,
        id: r.id,
        title: r.title,
        status: r.status,
        summary: r.summary,
        rawType: r.type,
      });
    }
  }

  if (ctx.project?.id) {
    map.set(ctx.project.id, {
      entityType: "project",
      id: ctx.project.id,
      title: `${ctx.project.code} — ${ctx.project.name}`,
      status: ctx.project.status,
      summary: ctx.project.currentFocus ?? ctx.project.summary,
      rawType: "project",
    });
  }

  return map;
}

/** Prompt lines listing every addressable record with stable IDs. */
export function formatContextRecordsForPrompt(
  index: Map<string, IndexedContextRecord>,
): string {
  if (!index.size) return "(No existing records in context.)";
  return [...index.values()]
    .map((r) => {
      const bits = [
        `entityType=${r.entityType}`,
        `id=${r.id}`,
        `title=${JSON.stringify(r.title)}`,
        r.status ? `status=${r.status}` : null,
        r.summary ? `summary=${JSON.stringify(r.summary.slice(0, 120))}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function clampConfidence(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < -5 || raw > 105) return null; // clearly invalid
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function parseTarget(
  raw: unknown,
  index: Map<string, IndexedContextRecord>,
): {
  target?: FindingTarget;
  invalidTarget?: boolean;
  warning?: string;
} {
  if (raw == null) return {};
  if (typeof raw !== "object") {
    return {
      invalidTarget: true,
      warning: "target must be an object",
    };
  }
  const obj = raw as Record<string, unknown>;
  const entityId = asString(obj.entityId) ?? asString(obj.id);
  const title = asString(obj.title) ?? "";
  const entityTypeRaw =
    asString(obj.entityType) ?? asString(obj.type) ?? "";
  const entityType = normalizeEntityType(entityTypeRaw);

  if (!entityId) {
    return {
      invalidTarget: true,
      warning: "target missing entityId",
    };
  }

  const existing = index.get(entityId);
  if (!existing) {
    return {
      invalidTarget: true,
      warning: `Unknown target ID "${entityId}" — not in provided context`,
    };
  }

  // Prefer context entity type; warn if AI mismatched type but keep the real record.
  const resolvedType = existing.entityType;
  if (entityType && entityType !== resolvedType) {
    return {
      target: {
        entityType: resolvedType,
        entityId: existing.id,
        title: existing.title || title,
      },
      warning: `target entityType "${entityTypeRaw}" did not match context (${resolvedType}); using context type`,
    };
  }

  return {
    target: {
      entityType: resolvedType,
      entityId: existing.id,
      title: existing.title || title,
    },
  };
}

function parseChanges(raw: unknown): CaptureFinding["changes"] | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const out: NonNullable<CaptureFinding["changes"]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim() || value == null || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (!("proposed" in row)) continue;
    out[key] = {
      previous: row.previous,
      proposed: row.proposed,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Runtime validation for AI findings payload.
 * Does not depend solely on TypeScript types.
 */
export function validateCaptureFindings(
  rawFindings: unknown,
  contextIndex: Map<string, IndexedContextRecord>,
): FindingsValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const findings: CaptureFinding[] = [];

  if (rawFindings == null) {
    return { ok: true, findings: [], errors, warnings, invalidTargetCount: 0 };
  }

  if (!Array.isArray(rawFindings)) {
    return {
      ok: false,
      findings: [],
      errors: ["findings must be an array"],
      warnings,
      invalidTargetCount: 0,
    };
  }

  let invalidTargetCount = 0;

  for (const [i, raw] of rawFindings.entries()) {
    if (raw == null || typeof raw !== "object") {
      warnings.push(`Finding[${i}] skipped: not an object`);
      continue;
    }
    const row = raw as Record<string, unknown>;
    const fact = asString(row.fact);
    const evidence = asString(row.evidence);
    const reasoningSummary = asString(row.reasoningSummary);
    const findingTypeRaw = asString(row.findingType);
    const confidence = clampConfidence(row.confidence);

    if (!fact) {
      warnings.push(`Finding[${i}] skipped: missing fact`);
      continue;
    }
    if (!evidence) {
      warnings.push(`Finding[${i}] skipped: missing evidence`);
      continue;
    }
    if (!reasoningSummary) {
      warnings.push(`Finding[${i}] skipped: missing reasoningSummary`);
      continue;
    }
    if (!findingTypeRaw || !FINDING_TYPES.includes(findingTypeRaw as FindingType)) {
      warnings.push(
        `Finding[${i}] skipped: unsupported findingType "${findingTypeRaw ?? ""}"`,
      );
      continue;
    }
    if (confidence == null) {
      warnings.push(`Finding[${i}] skipped: invalid confidence`);
      continue;
    }

    const targetParse = parseTarget(row.target, contextIndex);
    if (targetParse.warning) warnings.push(`Finding[${i}]: ${targetParse.warning}`);
    if (targetParse.invalidTarget) invalidTargetCount += 1;

    const requiresClarification = Boolean(row.requiresClarification);
    const clarificationQuestion =
      asString(row.clarificationQuestion) ?? undefined;

    const finding: CaptureFinding = {
      id: asString(row.id) ?? id("finding"),
      fact,
      evidence,
      findingType: findingTypeRaw as FindingType,
      target: targetParse.target,
      changes: parseChanges(row.changes),
      confidence,
      requiresClarification:
        requiresClarification ||
        Boolean(targetParse.invalidTarget) ||
        findingTypeRaw === "AMBIGUOUS",
      clarificationQuestion: targetParse.invalidTarget
        ? clarificationQuestion ??
          "Which existing project record does this fact refer to?"
        : clarificationQuestion,
      reasoningSummary,
      invalidTarget: targetParse.invalidTarget,
      validationWarning: targetParse.warning,
    };

    // Invalid ID → force ambiguous, no silent rematch
    if (targetParse.invalidTarget) {
      finding.findingType = "AMBIGUOUS";
      finding.target = undefined;
      finding.requiresClarification = true;
    }

    findings.push(finding);
  }

  // Hard failure only when the whole payload is unusable
  const ok = errors.length === 0;
  return { ok, findings, errors, warnings, invalidTargetCount };
}

export function findingMeaningLabel(finding: CaptureFinding): string {
  switch (finding.findingType) {
    case "ENTITY_COMPLETED":
      return "Existing record has been completed / resolved";
    case "ENTITY_UPDATED":
      return "Existing record should be updated";
    case "ENTITY_BLOCKED":
      return "Existing record is blocked";
    case "ENTITY_REOPENED":
      return "Existing record should be reopened";
    case "NEW_INFORMATION":
      return "New information without a clear existing match";
    case "NO_CHANGE":
      return "No project change required";
    case "AMBIGUOUS":
      return "Needs clarification before acting";
  }
}
