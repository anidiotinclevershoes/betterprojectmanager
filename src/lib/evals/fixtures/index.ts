import { SAMPLE_BENCHMARK } from "@/lib/evals/fixtures/sample-world";
import { V1_INTELLIGENCE_BENCHMARK } from "@/lib/evals/fixtures/v1-benchmark";
import type {
  EvalBenchmarkManifest,
  EvalCaseFixture,
  EvalDimension,
  EvalWorldFixture,
} from "@/lib/evals/types";

/** Registry of in-repo benchmarks. Official V1 is the default scored suite. */
const BENCHMARKS: EvalBenchmarkManifest[] = [
  V1_INTELLIGENCE_BENCHMARK,
  SAMPLE_BENCHMARK,
];

export function listBenchmarks(): EvalBenchmarkManifest[] {
  return BENCHMARKS;
}

export function getBenchmark(
  version?: string | null,
): EvalBenchmarkManifest | null {
  if (!version) return null;
  return BENCHMARKS.find((b) => b.version === version) ?? null;
}

/** Default scored suite — official V1 (not the harness sample). */
export function getActiveBenchmark(): EvalBenchmarkManifest {
  return V1_INTELLIGENCE_BENCHMARK;
}

export function getOfficialBenchmark(): EvalBenchmarkManifest {
  return V1_INTELLIGENCE_BENCHMARK;
}

export function getSampleBenchmark(): EvalBenchmarkManifest {
  return SAMPLE_BENCHMARK;
}

export function getWorld(worldId: string): EvalWorldFixture | null {
  for (const b of BENCHMARKS) {
    const w = b.worlds.find((x) => x.id === worldId);
    if (w) return w;
  }
  return null;
}

export function getCase(caseId: string): EvalCaseFixture | null {
  for (const b of BENCHMARKS) {
    for (const w of b.worlds) {
      const c = w.cases.find((x) => x.id === caseId);
      if (c) return c;
    }
  }
  return null;
}

export function listAllCases(opts?: {
  benchmarkVersion?: string;
  worldIds?: string[];
  categories?: EvalDimension[];
}): EvalCaseFixture[] {
  const benchmark =
    getBenchmark(opts?.benchmarkVersion) ?? getActiveBenchmark();
  const worlds = benchmark.worlds.filter((w) =>
    opts?.worldIds?.length ? opts.worldIds.includes(w.id) : true,
  );
  const cases = worlds.flatMap((w) => w.cases);
  if (!opts?.categories?.length) return cases;
  return cases.filter((c) =>
    c.categories.some((cat) => opts.categories!.includes(cat)),
  );
}

export function getFixtureVersion(benchmarkVersion?: string | null): {
  version: string;
  label: string;
  kind: EvalBenchmarkManifest["kind"];
} {
  const b = getBenchmark(benchmarkVersion) ?? getActiveBenchmark();
  return { version: b.version, label: b.label, kind: b.kind };
}

export function summarizeBenchmark(b: EvalBenchmarkManifest) {
  const cases = b.worlds.flatMap((w) => w.cases);
  const multiEvidence = cases.filter(
    (c) =>
      c.categories.includes("dependency") ||
      c.categories.includes("inference") ||
      (c.expectedFacts?.length ?? 0) >= 3 ||
      Boolean(c.criticalInsight),
  ).length;
  const uncertainty = cases.filter(
    (c) => c.expectUncertainty || c.categories.includes("uncertainty"),
  ).length;
  const critical = cases.filter((c) => Boolean(c.criticalInsight)).length;
  return {
    version: b.version,
    label: b.label,
    kind: b.kind,
    worldCount: b.worlds.length,
    caseCount: cases.length,
    multiEvidenceCases: multiEvidence,
    uncertaintyCases: uncertainty,
    criticalCases: critical,
  };
}
