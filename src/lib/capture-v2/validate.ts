import {
  isObservationDisposition,
  isObservationDomain,
  type CaptureObservationV2,
  type ObservationContextRecord,
  type ObservationValidationIssue,
  type ObservationValidationResult,
} from "./types";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Parse model JSON into raw observations. Malformed envelopes fail closed
 * (zero observations) rather than guessing.
 */
export function parseObservationEnvelope(raw: unknown): {
  observations: unknown[];
  issues: ObservationValidationIssue[];
} {
  const issues: ObservationValidationIssue[] = [];
  const obj = asObject(raw);
  if (!obj) {
    issues.push({
      code: "malformed",
      message: "Model output was not a JSON object.",
    });
    return { observations: [], issues };
  }
  const list = obj.observations;
  if (!Array.isArray(list)) {
    issues.push({
      code: "malformed",
      message: "Model output missing observations array.",
    });
    return { observations: [], issues };
  }
  return { observations: list, issues };
}

export function validateObservations(
  rawItems: unknown[],
  records: ObservationContextRecord[],
  scopedProjectId?: string | null,
): ObservationValidationResult {
  const byId = new Map(records.map((r) => [r.id, r]));
  const issues: ObservationValidationIssue[] = [];
  const accepted: CaptureObservationV2[] = [];
  const rejected: CaptureObservationV2[] = [];

  rawItems.forEach((raw, index) => {
    const obj = asObject(raw);
    if (!obj) {
      issues.push({
        code: "malformed",
        message: `Observation ${index} was not an object.`,
      });
      return;
    }

    const id = asString(obj.id) ?? `obs-${index + 1}`;
    const statement = asString(obj.statement);
    const evidence = asString(obj.evidence);
    const domainRaw = asString(obj.domain);
    const dispositionRaw = asString(obj.disposition);

    if (!statement) {
      issues.push({
        observationId: id,
        code: "missing_statement",
        message: "Observation has no statement.",
      });
      rejected.push(minimalRejected(id, obj));
      return;
    }
    if (!evidence) {
      issues.push({
        observationId: id,
        code: "missing_evidence",
        message: "Observation has no source evidence.",
      });
      rejected.push(minimalRejected(id, obj, statement));
      return;
    }
    if (!domainRaw || !isObservationDomain(domainRaw)) {
      issues.push({
        observationId: id,
        code: "unknown_domain",
        message: `Unknown domain ${JSON.stringify(obj.domain)}.`,
      });
      rejected.push(minimalRejected(id, obj, statement, evidence));
      return;
    }
    if (!dispositionRaw || !isObservationDisposition(dispositionRaw)) {
      issues.push({
        observationId: id,
        code: "unknown_disposition",
        message: `Unknown disposition ${JSON.stringify(obj.disposition)}.`,
      });
      rejected.push(minimalRejected(id, obj, statement, evidence));
      return;
    }

    const projectId = asString(obj.projectId);
    const candidateTargetId = asString(obj.candidateTargetId);

    if (
      scopedProjectId &&
      projectId &&
      projectId !== scopedProjectId
    ) {
      issues.push({
        observationId: id,
        code: "cross_project_id",
        message: `Observation project ${projectId} does not match Capture project ${scopedProjectId}.`,
      });
      rejected.push(
        buildObservation({
          id,
          statement,
          evidence,
          domain: domainRaw,
          disposition: "ambiguous",
          projectId: scopedProjectId,
          candidateTargetId: null,
          candidateTargetTitle: asString(obj.candidateTargetTitle),
          obj,
        }),
      );
      return;
    }

    if (candidateTargetId) {
      const hit = byId.get(candidateTargetId);
      if (!hit) {
        issues.push({
          observationId: id,
          code: "foreign_id",
          message: `Target ${candidateTargetId} is not in supplied project state.`,
        });
        rejected.push(
          buildObservation({
            id,
            statement,
            evidence,
            domain: domainRaw,
            disposition: "ambiguous",
            projectId,
            candidateTargetId: null,
            candidateTargetTitle: asString(obj.candidateTargetTitle),
            obj,
          }),
        );
        return;
      }
      if (scopedProjectId && hit.projectId !== scopedProjectId) {
        issues.push({
          observationId: id,
          code: "cross_project_id",
          message: `Target ${candidateTargetId} belongs to another project.`,
        });
        rejected.push(
          buildObservation({
            id,
            statement,
            evidence,
            domain: domainRaw,
            disposition: "ambiguous",
            projectId: scopedProjectId,
            candidateTargetId: null,
            candidateTargetTitle: hit.title,
            obj,
          }),
        );
        return;
      }
    }

    accepted.push(
      buildObservation({
        id,
        statement,
        evidence,
        domain: domainRaw,
        disposition: dispositionRaw,
        projectId: projectId ?? scopedProjectId ?? null,
        candidateTargetId,
        candidateTargetTitle: asString(obj.candidateTargetTitle),
        obj,
      }),
    );
  });

  return {
    ok: issues.length === 0,
    observations: accepted,
    rejected,
    issues,
  };
}

function buildObservation(args: {
  id: string;
  statement: string;
  evidence: string;
  domain: CaptureObservationV2["domain"];
  disposition: CaptureObservationV2["disposition"];
  projectId?: string | null;
  candidateTargetId?: string | null;
  candidateTargetTitle?: string | null;
  obj: Record<string, unknown>;
}): CaptureObservationV2 {
  const mergeWith = args.obj.mergeWithObservationId;
  const commentary = args.obj.commentary;
  const confidence = args.obj.modelConfidence ?? args.obj.confidence;
  const proposed = args.obj.proposedValues;
  return {
    id: args.id,
    statement: args.statement,
    evidence: args.evidence,
    domain: args.domain,
    disposition: args.disposition,
    projectId: args.projectId ?? null,
    candidateTargetId: args.candidateTargetId ?? null,
    candidateTargetTitle: args.candidateTargetTitle ?? null,
    mergeWithObservationId:
      typeof mergeWith === "string" ? mergeWith : null,
    proposedValues:
      proposed && typeof proposed === "object" && !Array.isArray(proposed)
        ? (proposed as Record<string, unknown>)
        : null,
    commentary: typeof commentary === "string" ? commentary : null,
    modelConfidence: typeof confidence === "number" ? confidence : null,
  };
}

function minimalRejected(
  id: string,
  obj: Record<string, unknown>,
  statement?: string | null,
  evidence?: string | null,
): CaptureObservationV2 {
  return {
    id,
    statement: statement ?? "",
    evidence: evidence ?? "",
    domain: "unknown",
    disposition: "ignore",
    projectId: null,
    candidateTargetId: null,
    candidateTargetTitle: null,
    mergeWithObservationId: null,
    proposedValues: null,
    commentary: null,
    modelConfidence: null,
  };
}
