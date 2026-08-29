/**
 * Deterministic observation envelopes from oracle writes.
 * LIVE mode ignores this and calls extractObservationsWithOpenAI.
 */
import type { CaptureObservationV2 } from "../../src/lib/capture-v2/types";
import type { CaptureSpec, ExpectedWrite, IdentityMap } from "./types";

function evidenceFrom(input: string, title: string): string {
  const idx = input.toLowerCase().indexOf(title.toLowerCase().slice(0, 12));
  if (idx >= 0) return input.slice(idx, Math.min(input.length, idx + 80)).trim();
  return title;
}

function dispositionFor(write: ExpectedWrite): CaptureObservationV2["disposition"] {
  if (write.op === "create") return "create_new";
  return "update_existing";
}

function proposedValues(write: ExpectedWrite): Record<string, unknown> {
  const values = { ...(write.values ?? {}) };
  if (write.domain === "person" && !values.name) values.name = write.title;
  if (write.domain === "todo" && !values.title) values.title = write.title;
  if (write.domain === "risk" && !values.title) values.title = write.title;
  if (write.domain === "milestone" && !values.label) values.label = write.title;
  if (write.op === "complete" && write.domain === "todo") values.status = "complete";
  if (write.op === "resolve" && write.domain === "risk") values.status = "resolved";
  if (write.scope) values.scope = write.scope;
  return values;
}

export function envelopeFromSpec(
  spec: CaptureSpec,
  identity: IdentityMap,
  projectId: string,
): { observations: CaptureObservationV2[] } {
  const observations: CaptureObservationV2[] = [];
  let i = 0;

  for (const write of spec.expectedWrites ?? []) {
    i += 1;
    const id = identity.get(write.key) ?? null;
    observations.push({
      id: `obs-${spec.n}-${i}`,
      statement: write.title,
      evidence: evidenceFrom(spec.input, write.title),
      domain: write.domain,
      disposition: dispositionFor(write),
      projectId,
      candidateTargetId: write.op === "create" ? null : id,
      candidateTargetTitle: write.title,
      proposedValues: proposedValues(write),
      modelConfidence: 0,
    });
  }

  for (const need of spec.expectedNeedsYou ?? []) {
    i += 1;
    observations.push({
      id: `obs-${spec.n}-ny-${i}`,
      statement: need.about,
      evidence: evidenceFrom(spec.input, need.about),
      domain: "responsibility",
      disposition: "ambiguous",
      projectId,
      commentary: need.note,
      proposedValues: { ownershipSemantics: "ambiguous" },
      modelConfidence: 0,
    });
  }

  for (const nc of spec.expectedNoChange ?? []) {
    i += 1;
    const id = nc.key ? identity.get(nc.key) ?? null : null;
    observations.push({
      id: `obs-${spec.n}-nc-${i}`,
      statement: nc.note,
      evidence: evidenceFrom(spec.input, nc.note),
      domain: "commentary",
      disposition: "no_change",
      projectId,
      candidateTargetId: id,
      commentary: nc.note,
      modelConfidence: 0,
    });
  }

  if (observations.length === 0) {
    observations.push({
      id: `obs-${spec.n}-empty`,
      statement: spec.input.slice(0, 80),
      evidence: spec.input.slice(0, 80),
      domain: "commentary",
      disposition: "commentary",
      projectId,
      modelConfidence: 0,
    });
  }

  return { observations };
}

/**
 * Hostile analyse envelope: create_new with no candidateTargetId.
 * Simulates a model that restates a known fact without binding.
 * The runner must never Apply these observations.
 */
export function envelopeAnalyseProbe(
  probe: {
    id: string;
    input: string;
    domain: CaptureObservationV2["domain"];
    title: string;
    proposedValues?: Record<string, unknown>;
  },
  projectId: string,
): { observations: CaptureObservationV2[] } {
  const values = { ...(probe.proposedValues ?? {}) };
  if (probe.domain === "person" && !values.name) values.name = probe.title;
  if (probe.domain === "todo" && !values.title) values.title = probe.title;
  if (probe.domain === "risk" && !values.title) values.title = probe.title;
  if (probe.domain === "milestone" && !values.label) values.label = probe.title;
  return {
    observations: [
      {
        id: `analyse-${probe.id}`,
        statement: probe.title,
        evidence: probe.input.slice(0, 120),
        domain: probe.domain,
        disposition: "create_new",
        projectId,
        candidateTargetId: null,
        candidateTargetTitle: probe.title,
        proposedValues: values,
        modelConfidence: 0,
      },
    ],
  };
}
