import type { CaptureObservationV2 } from "../../src/lib/capture-v2/types";

export function envelope(observations: unknown[]) {
  return { observations };
}

export function observationsOf(raw: unknown): CaptureObservationV2[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { observations?: unknown }).observations;
  return Array.isArray(list) ? (list as CaptureObservationV2[]) : [];
}

export function withIds(raw: unknown, observations: CaptureObservationV2[]) {
  return { ...(typeof raw === "object" && raw ? raw : {}), observations };
}

export function obs(
  partial: Partial<CaptureObservationV2> &
    Pick<CaptureObservationV2, "id" | "statement" | "domain" | "disposition">,
): CaptureObservationV2 {
  return {
    evidence: partial.evidence ?? partial.statement,
    truthIntent: partial.truthIntent ?? "current",
    ...partial,
  };
}

export function cloneObs(
  row: CaptureObservationV2,
  id: string,
): CaptureObservationV2 {
  return {
    ...row,
    id,
    proposedValues: row.proposedValues ? { ...row.proposedValues } : row.proposedValues,
  };
}

export function statementJoin(rows: Array<{ statement: string }>) {
  return rows.map((row) => row.statement).join("\n\n");
}
