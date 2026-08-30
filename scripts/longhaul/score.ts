/**
 * Live-model quality scoring for the #113 release bar.
 * Does not change the oracle or production.
 *
 * A — wrong current truth
 * B — identity / duplicate / split-brain
 * C — safe Needs You / missed automation (not a release failure)
 * D — live extraction miss
 * E — wrong truthIntent
 * F — presentation / wording
 * G — product limit / oracle mismatch (not Ready→Apply)
 *
 * Ready→Apply non-effects are measured separately. They are not G.
 */
import type { CaptureSpec, ExpectedWrite } from "./types";

export type TaxonomyLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type LiveObservation = {
  id?: string;
  statement?: string;
  domain?: string;
  disposition?: string;
  truthIntent?: string;
  evidence?: string;
  candidateTargetId?: string | null;
  candidateTargetTitle?: string | null;
  proposedValues?: Record<string, unknown> | null;
};

export type Classification = {
  letter: TaxonomyLetter | "correct";
  detail: string;
};

export type LiveCaptureRecord = {
  capture: number;
  rawInput: string;
  model: {
    observations: LiveObservation[];
    observationCount: number;
  };
  resolution: string;
  apply: "wrote" | "no_change" | "failed" | "needs_you" | "mixed";
  appliedCount: number;
  oracle: {
    expectedWrites: ExpectedWrite[];
    expectedNeedsYou: Array<{ about: string; note: string }>;
    expectedNoChange: Array<{ key?: string; note: string }>;
  };
  classifications: Classification[];
  truthIntents: string[];
};

const DATE_INTENT_CAPTURES: Record<
  number,
  { expected: "current" | "non_current" | "uncertain"; note: string }
> = {
  63: { expected: "current", note: "UAT moves to the 20th — agreed current correction" },
  64: { expected: "current", note: "CAB is the 18th; UAT moves to the 18th — current" },
  71: { expected: "non_current", note: "Steering notes 22nd is stale; CAB stays 18th" },
  73: { expected: "non_current", note: "Discussed 30th, not agreed; release stays 27th" },
  76: { expected: "non_current", note: "Weekend cutover considered and rejected" },
  77: { expected: "non_current", note: "Explicit no change on release" },
  78: { expected: "non_current", note: "Quoted RAID UAT 14th is stale" },
  82: { expected: "non_current", note: "Steering PDF 12th is template cruft" },
};

function norm(value: string | undefined | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mentions(hay: string, needle: string) {
  const h = norm(hay);
  const n = norm(needle);
  if (!n) return false;
  return h.includes(n) || n.split(" ").filter((w) => w.length > 3).some((w) => h.includes(w));
}

function observationBlob(row: LiveObservation) {
  return `${row.statement ?? ""} ${row.candidateTargetTitle ?? ""} ${JSON.stringify(row.proposedValues ?? {})}`;
}

export function observationsFromRaw(raw: unknown): LiveObservation[] {
  if (!raw || typeof raw !== "object") return [];
  const observations = (raw as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) return [];
  return observations.map((row) => {
    const obj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: typeof obj.id === "string" ? obj.id : undefined,
      statement: typeof obj.statement === "string" ? obj.statement : undefined,
      domain: typeof obj.domain === "string" ? obj.domain : undefined,
      disposition: typeof obj.disposition === "string" ? obj.disposition : undefined,
      truthIntent: typeof obj.truthIntent === "string" ? obj.truthIntent : undefined,
      evidence: typeof obj.evidence === "string" ? obj.evidence : undefined,
      candidateTargetId:
        typeof obj.candidateTargetId === "string" ? obj.candidateTargetId : null,
      candidateTargetTitle:
        typeof obj.candidateTargetTitle === "string" ? obj.candidateTargetTitle : null,
      proposedValues:
        obj.proposedValues && typeof obj.proposedValues === "object"
          ? (obj.proposedValues as Record<string, unknown>)
          : null,
    };
  });
}

function coveringRows(obs: LiveObservation[], write: ExpectedWrite) {
  return obs.filter((row) => mentions(observationBlob(row), write.title));
}

function domainCompatible(obsDomain: string | undefined, writeDomain: string) {
  if (!obsDomain) return true;
  if (obsDomain === writeDomain) return true;
  if (
    (writeDomain === "knowledge" || writeDomain === "decision") &&
    (obsDomain === "knowledge" || obsDomain === "decision")
  ) {
    return true;
  }
  return false;
}

export function classifyLiveCapture(args: {
  spec: CaptureSpec;
  rawModelJson: unknown;
  writeCount: number;
  needsYouCount: number;
  noChangeCount: number;
  applied: number;
  appliedFailed: boolean;
  identityCorruption: string | null;
  wrongProject: boolean;
  neighbourTouched: boolean;
}): LiveCaptureRecord {
  const observations = observationsFromRaw(args.rawModelJson);
  const writes = args.spec.expectedWrites ?? [];
  const needs = args.spec.expectedNeedsYou ?? [];
  const silent = args.spec.expectedNoChange ?? [];
  const classifications: Classification[] = [];
  const expectNeedsOnly = needs.length > 0 && writes.length === 0;
  const expectSilent = writes.length === 0 && needs.length === 0;

  if (args.wrongProject || args.neighbourTouched) {
    classifications.push({
      letter: "A",
      detail: "Wrong-project or neighbour-project mutation",
    });
  }
  if (args.identityCorruption) {
    classifications.push({ letter: "B", detail: args.identityCorruption });
  }

  for (const write of writes) {
    const covers = coveringRows(observations, write);
    if (!covers.length) {
      classifications.push({
        letter: "D",
        detail: `Missed expected ${write.op} ${write.domain} “${write.title}”`,
      });
      continue;
    }
    const compatible = covers.some((row) => domainCompatible(row.domain, write.domain));
    if (!compatible) {
      classifications.push({
        letter: "G",
        detail: `Oracle ${write.domain} “${write.title}” extracted as ${covers
          .map((row) => row.domain)
          .join(",")}`,
      });
    }
  }

  if (expectNeedsOnly && args.writeCount > 0) {
    const personLinkedWrite = observations.some(
      (row) =>
        (row.domain === "person" || row.domain === "responsibility") &&
        (row.disposition === "create_new" || row.disposition === "update_existing"),
    );
    if (args.applied > 0 && personLinkedWrite) {
      classifications.push({
        letter: "B",
        detail: `Unsafe Ready wrote person/responsibility on ambiguous capture (${args.writeCount} write(s))`,
      });
    } else if (args.applied > 0) {
      classifications.push({
        letter: "F",
        detail: `Complete knowledge/decision Ready on an ambiguous first-name capture (${args.writeCount} write(s)) — not a person merge`,
      });
    }
  } else if (expectNeedsOnly && args.needsYouCount > 0) {
    classifications.push({
      letter: "C",
      detail: "Correct conservative Needs You",
    });
  }

  if (writes.length > 0 && args.writeCount === 0 && args.needsYouCount > 0) {
    classifications.push({
      letter: "C",
      detail: "Expected apply; stayed Needs You (truth safe; missed automation)",
    });
  }

  if (expectSilent && args.applied > 0) {
    classifications.push({
      letter: "A",
      detail: "Silent/no-change capture wrote current truth",
    });
  }

  const intentRule = DATE_INTENT_CAPTURES[args.spec.n];
  if (intentRule) {
    const intents = observations
      .map((row) => row.truthIntent)
      .filter((value): value is string => Boolean(value));
    const hasExpected = intents.includes(intentRule.expected);
    const wroteCurrent =
      args.applied > 0 &&
      (intentRule.expected === "non_current" || intentRule.expected === "uncertain");
    if (wroteCurrent) {
      classifications.push({
        letter: "A",
        detail: `${intentRule.note} — wrote current truth from non-current/uncertain capture; truthIntents=${intents.join(",") || "none"}`,
      });
      classifications.push({
        letter: "E",
        detail: `${intentRule.note} — applied current write; truthIntents=${intents.join(",") || "none"}`,
      });
    } else if (!hasExpected && intents.length) {
      classifications.push({
        letter: "E",
        detail: `${intentRule.note} — expected ${intentRule.expected}, got ${intents.join(",")}`,
      });
    } else if (!intents.length) {
      classifications.push({
        letter: "E",
        detail: `${intentRule.note} — no truthIntent on observations`,
      });
    }
  }

  const invented = observations.filter((row) => {
    const statement = row.statement;
    if (!statement) return false;
    if (writes.some((write) => mentions(statement, write.title))) return false;
    if (needs.some((need) => mentions(statement, need.about))) return false;
    if (silent.some((rowSilent) => mentions(statement, rowSilent.note))) return false;
    if (row.disposition === "no_change" || row.truthIntent === "non_current") return false;
    if (row.domain === "commentary") return false;
    return args.applied > 0 && row.disposition === "create_new";
  });
  if (invented.length) {
    classifications.push({
      letter: "F",
      detail: `Extra create observation(s): ${invented
        .map((row) => row.statement)
        .slice(0, 3)
        .join(" | ")}`,
    });
  }

  // Ready→Apply non-effects are recorded in ready-apply.json, not as G.

  if (!classifications.length) {
    classifications.push({ letter: "correct", detail: "No live-quality discrepancy recorded" });
  }

  const apply: LiveCaptureRecord["apply"] = args.appliedFailed
    ? "failed"
    : args.applied > 0 && args.needsYouCount > 0
      ? "mixed"
      : args.applied > 0
        ? "wrote"
        : args.needsYouCount > 0
          ? "needs_you"
          : "no_change";

  return {
    capture: args.spec.n,
    rawInput: args.spec.input,
    model: {
      observations,
      observationCount: observations.length,
    },
    resolution:
      args.writeCount > 0 && args.needsYouCount > 0
        ? "mixed"
        : args.writeCount > 0
          ? "Ready"
          : args.needsYouCount > 0
            ? "Needs You"
            : args.noChangeCount > 0
              ? "no_change"
              : "empty",
    apply,
    appliedCount: args.applied,
    oracle: {
      expectedWrites: writes,
      expectedNeedsYou: needs,
      expectedNoChange: silent,
    },
    classifications,
    truthIntents: observations
      .map((row) => row.truthIntent)
      .filter((value): value is string => Boolean(value)),
  };
}

export function summariseTaxonomy(records: LiveCaptureRecord[]) {
  const counts: Record<TaxonomyLetter | "correct", number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    correct: 0,
  };
  for (const record of records) {
    const letters = new Set(record.classifications.map((row) => row.letter));
    for (const letter of letters) counts[letter] += 1;
  }
  return counts;
}

export { DATE_INTENT_CAPTURES };
