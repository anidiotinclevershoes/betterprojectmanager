import type {
  CaseResult,
  FailureClass,
  FailureCluster,
  PipelineStage,
} from "./types";

function pattern(row: CaseResult): string {
  const actual = row.actual;
  if (row.productModelGap) return `product-gap:${row.baseScenario}`;
  if (
    /needs_you_identity_multiple/.test(actual) ||
    /needs_you_identity_mismatch/.test(actual) ||
    /identity_incomplete/.test(actual)
  ) {
    return "transcript-wide-identity-gate";
  }
  if (/decision write \(expected needs_you\)/.test(actual) && /first-name/.test(row.perturbation)) {
    return "first-name-still-writes";
  }
  if (/NP missing person/.test(actual)) {
    return "np-adapter-drops-rejected-people";
  }
  if (/contradiction locality/.test(actual)) return "contradictory-both-write";
  const cls = row.classification ?? "UNKNOWN";
  const stage = row.earliestStage ?? "UNKNOWN";
  return `${cls}|${stage}|${actual
    .replace(/obs-[a-z0-9-]+/gi, "obs-*")
    .replace(/h-[a-z0-9-]+/gi, "h-*")
    .slice(0, 120)}`;
}

function labelFor(key: string, sample: CaseResult): string {
  if (key === "transcript-wide-identity-gate") {
    return "Transcript-wide identity gate (identityEvidenceText uses the whole Capture)";
  }
  if (key === "first-name-still-writes") {
    return "First-name-only proposed identity still becomes a write";
  }
  if (key === "contradictory-both-write") {
    return "Contradictory sibling observations both stay Apply-eligible writes";
  }
  if (key === "np-adapter-drops-rejected-people") {
    return "New Project adapter silently drops schema-rejected people (Capture keeps them visible)";
  }
  if (key.startsWith("product-gap:")) {
    return `Product-model gap: ${sample.baseScenario}`;
  }
  const stage = sample.earliestStage ?? "UNKNOWN";
  if (sample.classification === "INFORMATION LOSS") return `Silent field drop at ${stage}`;
  if (sample.classification === "VALIDATION") return `Validation divergence at ${stage}`;
  if (sample.classification === "PLANNER") return `Planner / write-eligibility divergence at ${stage}`;
  if (sample.classification === "IDENTITY RESOLUTION") return `Identity coupling at ${stage}`;
  return `${sample.classification ?? "UNKNOWN"} at ${stage}`;
}

export function clusterFailures(failures: CaseResult[]): FailureCluster[] {
  const buckets = new Map<string, CaseResult[]>();
  for (const row of failures) {
    const key = pattern(row);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const clusters: FailureCluster[] = [...buckets.entries()].map(([key, rows], index) => {
    const sample = rows[0]!;
    return {
      id: `cluster-${String(index + 1).padStart(2, "0")}`,
      label: labelFor(key, sample),
      classification: (sample.classification ?? "UNKNOWN") as FailureClass,
      earliestStage: (sample.earliestStage ?? "PLANNER") as PipelineStage,
      caseIds: rows.map((row) => row.id),
      note: "Same observed semantic transition. Not a proven single root cause.",
    };
  });
  clusters.sort((a, b) => b.caseIds.length - a.caseIds.length);
  return clusters;
}

export function architectureJudgement(args: {
  clusters: FailureCluster[];
  contaminationFails: number;
  orderFails: number;
  irrelevantFails: number;
  ambiguityFails: number;
  compositionFails: number;
}): { judgement: "A" | "B" | "C"; note: string } {
  const identityClusters = args.clusters.filter(
    (row) => row.classification === "IDENTITY RESOLUTION" || row.earliestStage === "IDENTITY",
  );
  const couplingFails =
    args.contaminationFails + args.orderFails + args.irrelevantFails + args.ambiguityFails;
  const identityCaseCount = identityClusters.reduce((n, row) => n + row.caseIds.length, 0);

  const transcriptCluster = args.clusters.find((row) =>
    row.label.includes("Transcript-wide identity gate"),
  );
  if ((transcriptCluster?.caseIds.length ?? 0) >= 4 || (couplingFails >= 5 && identityCaseCount >= 4)) {
    return {
      judgement: "B",
      note: "Independent observations change identity reasonClass / bind when sibling names appear in the same Capture. Strong evidence of transcript-wide identity coupling. Product-model gaps are separate and should not be treated as the same defect.",
    };
  }
  if (args.clusters.length <= 4 && couplingFails < 8) {
    return {
      judgement: "A",
      note: "A small number of clusters account for most failures. Bounded defects are plausible; confirm before treating as a rewrite.",
    };
  }
  if (args.clusters.length >= 8 && args.compositionFails >= 5) {
    return {
      judgement: "C",
      note: "Many distinct clusters spanning composition and later stages. A larger resolver/planner simplification may be required; this is a hypothesis, not a mandate.",
    };
  }
  return {
    judgement: identityCaseCount >= 8 ? "B" : "A",
    note: "Mixed picture. Prefer the cluster list over this letter. Do not overclaim causality.",
  };
}
